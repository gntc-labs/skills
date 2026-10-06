#!/usr/bin/env node
// The patch's identity images: the land deed, the link preview (Open Graph) and the favicon set.
//   node brand.mjs --patch patch.json --out brand/ [--url https://<live host>] [--only deed|og|icons[,…]]
//                  [--playwright <path to playwright-core>] [--browser chrome|chromium|shell] [--skill-dir <dir with dice.json + art/>]
// Outputs (in --out):
//   deed.png 1600×1000          the "land deed" shown to the creator right after the roll
//   og.png 1200×630 (≤ 600 KB: re-encoded, colour depth trimmed with dithering only if needed)   the link preview
//   og-square.jpg 1080×1080 (JPEG q85)   for posting; stays in brand/, never in site/
//   favicon.ico (16+32+48), favicon-32.png, apple-touch-icon.png (180, opaque), icon-192.png, icon-512.png,
//   site.webmanifest, head.html (the <head> tags, also printed)
// Playwright comes from --playwright, else the project's own node_modules (the current folder: playwright-core, then
// playwright), same as check.mjs. Browser: the installed Google Chrome first, then Playwright's Chromium, then its
// headless shell.
// dice.json and art/ come from this script's own folder (the skill folder) unless --skill-dir says otherwise.
// The lit jack-o'-lantern in og.png, og-square.jpg and the app icons is drawn by the PAGE's own carving renderer:
// brand.mjs builds the patch's page into a temporary folder (build.mjs, same skill folder), serves it on 127.0.0.1
// and asks it (window.__pumpkinPatch.brandPumpkin) for the signature pumpkin carved with the Classic stencil, fitted
// exactly as the Stencils tab fits it, lit, at each image's own output size. og.png carries that pumpkin's hole mask
// and placement in a PNG text chunk ("pumpkin-patch:brand") so the full test suite can hold it against the page's carving.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { deflateSync, inflateSync, crc32 } from "node:zlib";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { nameHasOwner, scriptFonts } from "./script-fonts.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const fail = (msg) => { console.error(`brand.mjs: ${msg}`); process.exit(2); };

const skillDir = resolve(flag("--skill-dir") ?? here);
const patchPath = flag("--patch") ?? "patch.json";
const outDir = resolve(flag("--out") ?? "brand");
const only = new Set((flag("--only") ?? "deed,og,icons").split(",").map((s) => s.trim()).filter(Boolean));
for (const o of only) if (!["deed", "og", "icons"].includes(o)) fail(`--only takes deed, og and/or icons, got "${o}"`);
let liveUrl = flag("--url");
if (liveUrl !== undefined) {
  if (!/^https:\/\/[^\s"<>]+$/i.test(liveUrl)) fail(`--url must be an absolute https URL, got "${liveUrl}"`);
  liveUrl = liveUrl.replace(/[#?].*$/, "").replace(/\/+$/, "");
}

if (!existsSync(join(skillDir, "dice.json"))) fail(`no dice.json in ${skillDir} (pass --skill-dir)`);
if (!existsSync(patchPath)) fail(`patch file not found: ${patchPath} (run roll.mjs first)`);
const dice = JSON.parse(readFileSync(join(skillDir, "dice.json"), "utf8"));
let patch;
try { patch = JSON.parse(readFileSync(patchPath, "utf8")); } catch (e) { fail(`${patchPath} is not valid JSON: ${e.message}`); }
if (!/^[0-9a-f]{8}$/.test(String(patch.seed))) fail("seed must be 8 lowercase hex characters");

const byId = (list, id, what) => list.find((x) => x.id === id) ?? fail(`unknown ${what} "${id}" in ${patchPath}`);
const scene = byId(dice.scenes, patch.scene, "scene");
const event = byId(dice.events, patch.event, "event");
const quirk = byId(dice.quirks, patch.quirk, "quirk");
const signature = byId(dice.varieties, patch.signature, "signature");
// A patch rolled before dice v3 has no "secret": take the one its seed rolls (5th draw, same as roll.mjs/build.mjs).
function seedSecret(seed) {
  let a = parseInt(seed, 16);
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (const n of [dice.scenes, dice.events, dice.quirks, dice.varieties].map((l) => l.length)) Math.floor(rnd() * n);
  return dice.secrets[Math.floor(rnd() * dice.secrets.length)];
}
const secret = patch.secret ? byId(dice.secrets, patch.secret, "secret") : seedSecret(patch.seed);
const name = String(patch.name || scene.patchName || dice.namePattern.replace("{Scene}", scene.name)).trim();
const owner = String(patch.owner ?? "").trim();
const possible = [dice.scenes, dice.events, dice.quirks, dice.varieties, dice.secrets].reduce((n, l) => n * l.length, 1);
const pal = scene.palette;

// ---------- Playwright ----------
async function loadPlaywright() {
  const tries = [];
  if (flag("--playwright")) tries.push(resolve(flag("--playwright")));
  const req = createRequire(join(process.cwd(), "noop.js"));
  for (const m of ["playwright-core", "playwright"]) { try { tries.push(req.resolve(m)); } catch (_) { /* not installed here */ } }
  for (const t of tries) {
    try {
      const m = await import(pathToFileURL(statSync(t).isDirectory() ? join(t, "index.js") : t).href);
      const pw = m.chromium ? m : m.default;
      if (pw && pw.chromium) return pw;
    } catch (_) { /* next */ }
  }
  fail("Playwright not found. In this project folder run:\n  npm i playwright-core\nthen run brand.mjs again (or pass --playwright <path/to/node_modules/playwright-core>).");
}
// Installed Google Chrome first (no download), then Playwright's own Chromium, then its headless shell.
async function launch(chromium) {
  const errors = [], chain = [["chrome", "Google Chrome", { channel: "chrome" }], ["chromium", "Playwright Chromium", { channel: "chromium" }], ["shell", "Playwright headless shell", {}]];
  // --browser chromium|shell starts further down the chain (to test the fallbacks on a machine that has Chrome)
  const from = chain.findIndex(([id]) => id === (flag("--browser") ?? "chrome"));
  if (from < 0) fail(`--browser takes chrome, chromium or shell`);
  for (const [, label, opts] of chain.slice(from)) {
    try { const b = await chromium.launch(opts); return { browser: b, label: `${label} ${b.version()}` }; }
    catch (e) { errors.push(`${label}: ${String(e.message).split("\n")[0]}`); }
  }
  fail(`no browser could start.\n  ${errors.join("\n  ")}\nIf Google Chrome isn't installed, run: npx playwright-core install --only-shell chromium`);
}

// ---------- PNG re-encoding (Chrome writes big PNGs) ----------
// Decodes an 8-bit RGB/RGBA non-interlaced PNG (what Chrome screenshots are), re-encodes it with a per-row filter
// choice (zlib level 6, Z_FILTERED: level 9 is 4x slower for ~3%) and drops an all-opaque alpha channel. If it is still over maxBytes, the colour depth is
// trimmed to 6 bits per channel with a 4x4 ordered dither (gradients stay smooth; each value keeps the same two low
// bits, so the PNG filters leave clean multiples of 4 that deflate well). Anything else: returned as is.
function slimPng(png, maxBytes = Infinity) {
  let o = 8, ihdr; const idat = [];
  while (o + 8 <= png.length) {
    const len = png.readUInt32BE(o), type = png.toString("latin1", o + 4, o + 8);
    if (type === "IHDR") ihdr = png.subarray(o + 8, o + 8 + len);
    if (type === "IDAT") idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  if (!ihdr || ihdr[8] !== 8 || ihdr[12] !== 0 || (ihdr[9] !== 2 && ihdr[9] !== 6)) return png;
  const W = ihdr.readUInt32BE(0), H = ihdr.readUInt32BE(4), bpp = ihdr[9] === 6 ? 4 : 3, stride = W * bpp;
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  // unfilter into px (H rows of stride bytes)
  const raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(H * stride);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], r = y * (stride + 1) + 1, p = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[p + x - bpp] : 0, b = y ? px[p - stride + x] : 0, c = x >= bpp && y ? px[p - stride + x - bpp] : 0;
      px[p + x] = (raw[r + x] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0)) & 255;
    }
  }
  let ch = bpp;
  if (bpp === 4) { ch = 3; for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) { ch = 4; break; } }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "latin1"), data])) >>> 0);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, crc]);
  };
  const rowLen = W * ch;
  const encode = (src) => {
    // packed rows (alpha dropped when opaque), then each row filtered 5 ways; the smallest sum of |residual| wins
    const img = ch === bpp ? src : Buffer.alloc(H * rowLen);
    if (img !== src) for (let i = 0, j = 0; i < src.length; i += bpp) { img[j++] = src[i]; img[j++] = src[i + 1]; img[j++] = src[i + 2]; }
    const out = Buffer.alloc(H * (rowLen + 1)), zero = Buffer.alloc(rowLen), cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(rowLen));
    for (let y = 0; y < H; y++) {
      const row = img.subarray(y * rowLen, (y + 1) * rowLen), up = y ? img.subarray((y - 1) * rowLen, y * rowLen) : zero;
      const [c0, c1, c2, c3, c4] = cand, sums = [0, 0, 0, 0, 0];
      for (let x = 0; x < rowLen; x++) {
        const v = row[x], a = x >= ch ? row[x - ch] : 0, b = up[x], c = x >= ch ? up[x - ch] : 0;
        const r0 = v, r1 = (v - a) & 255, r2 = (v - b) & 255, r3 = (v - ((a + b) >> 1)) & 255, r4 = (v - paeth(a, b, c)) & 255;
        c0[x] = r0; c1[x] = r1; c2[x] = r2; c3[x] = r3; c4[x] = r4;
        sums[0] += r0 < 128 ? r0 : 256 - r0; sums[1] += r1 < 128 ? r1 : 256 - r1; sums[2] += r2 < 128 ? r2 : 256 - r2;
        sums[3] += r3 < 128 ? r3 : 256 - r3; sums[4] += r4 < 128 ? r4 : 256 - r4;
      }
      let best = 0; for (let f = 1; f < 5; f++) if (sums[f] < sums[best]) best = f;
      out[y * (rowLen + 1)] = best; cand[best].copy(out, y * (rowLen + 1) + 1);
    }
    const h = Buffer.from(ihdr); h[9] = ch === 4 ? 6 : 2;
    return Buffer.concat([png.subarray(0, 8), chunk("IHDR", h), chunk("IDAT", deflateSync(out, { level: 6, strategy: 1 })), chunk("IEND", Buffer.alloc(0))]);
  };
  let best = encode(px);
  if (best.length > maxBytes) {
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], q = Buffer.from(px);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;
      for (let k = 0, i = y * stride + x * bpp; k < 3; k++, i++) q[i] = Math.max(0, Math.min(63, Math.round((px[i] - 2) / 4 + d))) * 4 + 2;
    }
    best = encode(q);
  }
  return best.length < png.length ? best : png;
}

// ---------- shared bits ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const artCache = new Map();
const art = (kind, id) => {
  const f = join(skillDir, "art", kind, `${id}.webp`);
  if (!existsSync(f)) fail(`missing art ${kind}/${id}.webp in ${skillDir}`);
  if (!artCache.has(f)) artCache.set(f, `data:image/webp;base64,${readFileSync(f).toString("base64")}`);
  return artCache.get(f);
};
const TIER = {
  Common: "background:#2f4430;color:#cdeec0",
  Uncommon: "background:#174652;color:#a6eef7",
  Rare: "background:#35286a;color:#d2c3ff",
  Legendary: "background:linear-gradient(90deg,#ffe08a,#ffad3a);color:#3a1d00;box-shadow:0 0 14px rgba(255,200,90,.55)",
  Secret: "background:linear-gradient(90deg,#1d1036,#3a1f66 50%,#1d1036);color:#efe3ff;box-shadow:0 0 0 1px #b48cff,0 0 16px rgba(180,140,255,.65)",
};
const tierBadge = (tier, extra = "") => `<span class="tier" style="${TIER[tier]};${extra}">${esc(tier)}</span>`;
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Gochi+Hand&family=Cinzel:wght@600;800&family=Creepster&family=Inter:wght@500;700;800&display=block" rel="stylesheet">`;
const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.display{font-family:Creepster,ui-rounded,system-ui,cursive;font-weight:400;letter-spacing:.03em;line-height:1.02}
.tier{display:inline-block;font-family:Inter,system-ui,sans-serif;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:4px 12px;font-size:15px;line-height:1.2;white-space:nowrap}
.jack{position:relative}
.jack .halo{position:absolute;left:50%;top:54%;width:168%;height:168%;transform:translate(-50%,-50%);border-radius:50%;
  background:radial-gradient(closest-side,rgba(255,176,80,.5),rgba(255,130,40,.2) 45%,rgba(255,110,30,0) 100%)}
.jack img.pk{position:absolute;inset:0;width:100%;height:100%;display:block}
.ghostpk{position:relative}
.ghostpk img.sil{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:brightness(0) drop-shadow(0 0 2px rgba(200,170,255,.95)) drop-shadow(0 0 16px rgba(160,110,255,.65))}
.ghostpk b{position:absolute;left:0;right:0;top:50%;transform:translateY(-38%);text-align:center;font-family:Creepster,cursive;font-weight:400;color:#d9c6ff;text-shadow:0 0 12px rgba(180,140,255,.9)}
`;

// The brand pumpkin: the signature variety, a neutral look (pseed 0x8080: scale 1, no hue shift, not flipped), the
// Classic stencil, lit. PUMPKIN maps an output size to the page's render at that size (filled in before any HTML).
const BRAND_PSEED = 0x8080, BRAND_STENCIL = "classic";
// favicons and app icons are always the classic orange jack-o'-lantern, whatever the signature (orange reads best in
// tabs and on home screens); only the opaque icons' background follows the scene palette
const ICON_VARIETY = "classic-orange";
const PUMPKIN = new Map();
// A lit jack-o'-lantern: the candle's warm spill behind it (the page's .spill), then the page's own render.
const jack = (variety, size, { halo = true } = {}) => {
  const r = PUMPKIN.get(Math.round(size));
  if (!r) fail(`internal: no pumpkin render at ${size}px`);
  return `<div class="jack" data-jack style="width:${size}px;height:${size}px">
${halo ? '<div class="halo"></div>' : ""}<img class="pk" data-pk src="${r.png}"></div>`;
};
const ghost = (size, qSize) => `<div class="ghostpk" style="width:${size}px;height:${size}px"><img class="sil" src="${art("secrets", secret.id)}"><b style="font-size:${qSize}px">???</b></div>`;

// Runs in the page: place faces, fit text, report the signature's colour. Sets window.__done.
const PAGE_JS = String.raw`
// shrink until the box fits its width and maxLines lines
function fits(el,n){const lh=parseFloat(getComputedStyle(el).lineHeight)||parseFloat(el.style.fontSize)*1.05;return el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().height<=lh*n+2;}
function fit(el,max,min,maxLines){
  let s=max; el.style.fontSize=s+'px';
  const lh=()=>parseFloat(getComputedStyle(el).lineHeight)||s*1.05;
  while(s>min&&(el.scrollWidth>el.clientWidth+1||el.getBoundingClientRect().height>lh()*maxLines+2)){s-=2;el.style.fontSize=s+'px';}
  return s;
}
// Titles (data-title="max1,min1|max2,min2"): one line first, shrunk to fit. Only a name still too wide at min1 wraps,
// into two balanced lines broken between words (Intl.Segmenter, so CJK words too), never between a number/Latin run
// and the CJK word after it ("899 的南瓜田" never reads "899" / "的南瓜田") unless no other two-line split fits.
// Last resort: the browser's own wrap, shrunk as before.
const CJK=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}]/u;
function splits(t){
  let w; try{w=[...new Intl.Segmenter(undefined,{granularity:'word'}).segment(t)].map(x=>x.segment);}catch(e){w=t.split(/(\s+)/).filter(Boolean);}
  const out=[],seen=new Set();
  for(let i=1;i<w.length;i++){
    const a=w.slice(0,i).join(''),b=w.slice(i).join(''),l1=a.trimEnd(),l2=b.trimStart();
    if(!l1||!l2||seen.has(l1))continue;
    const pc=l1.slice(-1),nc=l2[0],space=a!==l1||b!==l2;
    // Latin breaks only at a space or after a hyphen; CJK between any two words; never before punctuation
    if(/[\p{P}]/u.test(nc)&&!/[(\[{「『（]/u.test(nc))continue;
    if(/[(\[{「『（]/u.test(pc))continue;
    if(!space&&pc!=='-'&&!(CJK.test(pc)||CJK.test(nc)))continue;
    seen.add(l1);
    out.push({l1,l2,glued:/[\p{L}\p{N}]/u.test(pc)&&!CJK.test(pc)&&CJK.test(nc)});
  }
  return out;
}
function nowrapW(el,txt){const s=document.createElement('span');s.style.whiteSpace='nowrap';s.textContent=txt;el.appendChild(s);const w=s.getBoundingClientRect().width;s.remove();return w;}
function fitTitle(el,spec){
  const [[mx1,mn1],[mx2,mn2]]=spec.split('|').map(x=>x.split(',').map(Number)),name=el.textContent;
  el.style.whiteSpace='nowrap';
  let s=mx1; el.style.fontSize=s+'px';
  while(s>mn1&&el.scrollWidth>el.clientWidth+1){s-=2;el.style.fontSize=s+'px';}
  if(el.scrollWidth<=el.clientWidth+1){el.dataset.lines='1';return;}
  el.style.fontSize=mx2+'px'; el.textContent='';
  const W=el.clientWidth,c=splits(name).map(x=>({...x,w:Math.max(nowrapW(el,x.l1),nowrapW(el,x.l2))}));
  for(const glued of [false,true]){
    const best=c.filter(x=>x.glued===glued).sort((a,b)=>a.w-b.w)[0];
    if(!best)continue;
    s=Math.min(mx2,Math.floor(W*mx2/best.w/2)*2);
    if(s<mn2)continue;
    el.replaceChildren(best.l1,document.createElement('br'),best.l2);
    el.style.fontSize=s+'px';
    while(s>mn2&&el.scrollWidth>el.clientWidth+1){s-=2;el.style.fontSize=s+'px';}
    el.dataset.lines='2';el.dataset.split=best.l1+'|'+best.l2;return;
  }
  el.style.whiteSpace='';el.textContent=name;fit(el,mx2,mn2,2);el.dataset.lines='wrap';
}
async function domColor(src){
  const im=new Image(); im.src=src; await im.decode();
  const c=document.createElement('canvas'); c.width=64; c.height=64; const g=c.getContext('2d'); g.drawImage(im,0,0,64,64);
  const d=g.getImageData(0,0,64,64).data; let r=0,gg=0,b=0,n=0;
  for(let y=26;y<58;y++)for(let x=12;x<52;x++){const i=(y*64+x)*4;if(d[i+3]>230){r+=d[i];gg+=d[i+1];b+=d[i+2];n++;}}
  return n?[r/n,gg/n,b/n]:[242,138,46];
}
window.__run=async function(){
  await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,8000))]);
  try{await Promise.race([Promise.all(['400 40px Creepster','800 20px Cinzel','400 20px "Gochi Hand"','800 20px Inter',...(window.__sf||[])].map(f=>document.fonts.load(f,document.body.textContent))),new Promise(r=>setTimeout(r,8000))]);}catch(e){}
  await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));
  for(const el of document.querySelectorAll('[data-title]'))fitTitle(el,el.dataset.title);
  for(const el of document.querySelectorAll('[data-fit]')){const specs=el.dataset.fit.split('|').map(x=>x.split(',').map(Number));for(const [mx,mn,ln] of specs){fit(el,mx,mn,ln);if(fits(el,ln))break;}}
  return {creepster:document.fonts.check('40px Creepster')};
};
window.__domColor=domColor;
`;
// The name and owner in a script Creepster / Gochi Hand can't draw (Chinese, Japanese, Korean, Cyrillic, ...): the same
// subset web faces the page uses (script-fonts.mjs), for the title, the deed's "Granted to" line and the kicker.
const SF = scriptFonts({ name, owner }, { name: "display", owner: "hand" });
const SF_CSS = [
  SF.stacks.name ? `.title.display,.name.display{font-family:${SF.stacks.name.family},Creepster,sans-serif;font-weight:${SF.stacks.name.weight};letter-spacing:.02em;word-break:keep-all;overflow-wrap:anywhere;text-wrap:balance}` : "",
  SF.stacks.owner ? `.grant .who{font-family:${SF.stacks.owner.family},"Gochi Hand",cursive;font-weight:${SF.stacks.owner.weight}}` : "",
  // Inter has no CJK: the owner's name in the kicker falls back to the subset face (it carries those characters)
  SF.stacks.owner || SF.stacks.name ? `body,.kick{font-family:Inter,${(SF.stacks.owner || SF.stacks.name).family},ui-sans-serif,system-ui,sans-serif}` : "",
].join("");
const SF_LOAD = JSON.stringify(Object.values(SF.stacks).map((x) => `${x.weight} 40px ${x.family}`));
const page = (w, h, css, body, bg = "transparent") => `<!doctype html><html><head><meta charset="utf-8">${FONTS}${SF.href ? `<link href="${esc(SF.href)}" rel="stylesheet">` : ""}
<style>${BASE_CSS}html,body{width:${w}px;height:${h}px;background:${bg}}${css}${SF_CSS}</style></head><body>${body}<script>window.__sf=${SF_LOAD};${PAGE_JS}</script></body></html>`;

// Background crop of the scene, centred on its landmark (palette "focus" is the x of the landmark).
const sceneBg = (pos = `${Math.round(scene.focus * 100)}% 60%`) => `background:url(${art("scenes", scene.id)}) ${pos}/cover no-repeat`;
// "899 的南瓜田" already says whose it is: no "899's pumpkin patch" over it
const NO_OWNER_KICKER = "A Halloween pumpkin patch";
const kicker = owner && !nameHasOwner(name, owner) ? `${owner}'s pumpkin patch` : NO_OWNER_KICKER;
// the kicker is uppercase, the owner's name never: "乂煞氣a芭九九乂's" keeps the case it was typed in
const kickerHtml = kicker === NO_OWNER_KICKER ? esc(kicker) : `<span class="nm">${esc(owner)}'s</span> pumpkin patch`;

// ---------- 1. the land deed ----------
function deedHtml() {
  const W = 1600, H = 1000;
  const item = (label, icon, title, sub, extra = "") => `<div class="item">
<div class="ico">${icon}</div><div class="txt"><div class="lab">${esc(label)}</div><div class="nm">${esc(title)}</div>${sub ? `<div class="sub">${sub}</div>` : ""}${extra}</div></div>`;
  const css = `
body{${sceneBg()};position:relative}
body::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,color-mix(in srgb,${pal.bg} 55%,transparent),${pal.bg} 85%);backdrop-filter:blur(6px)}
.sheet{position:absolute;left:46px;top:36px;width:${W - 92}px;height:${H - 72}px}
.paper{position:absolute;inset:0;filter:url(#rough);border-radius:6px;
  background:
   radial-gradient(ellipse 30% 22% at 78% 82%,rgba(140,90,30,.16),transparent 70%),
   radial-gradient(ellipse 18% 14% at 14% 22%,rgba(140,90,30,.14),transparent 70%),
   radial-gradient(ellipse 75% 70% at 50% 46%,#f6ebcf 0%,#ecdcb4 55%,#d7bc85 88%,#b58a4c 100%);
  box-shadow:inset 0 0 70px rgba(98,52,8,.55),inset 0 0 14px rgba(60,28,4,.7),0 30px 80px rgba(0,0,0,.65),0 0 0 1px rgba(60,30,6,.4)}
.grain{position:absolute;inset:0;mix-blend-mode:multiply;opacity:.32;border-radius:6px;filter:url(#rough)}
.frame{position:absolute;inset:30px;border:2px solid #6b3f1a;outline:1px solid rgba(107,63,26,.55);outline-offset:-10px;border-radius:3px}
.web{position:absolute;width:170px;height:170px;opacity:.55}
.content{position:absolute;inset:0;color:#3b2410}
.head{position:absolute;left:150px;right:150px;top:58px;height:310px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}
.pre{font-family:Cinzel,serif;font-weight:800;font-size:30px;letter-spacing:.32em;color:#6b3f1a;text-transform:uppercase}
.pre i{display:inline-block;width:1.1em;height:2px;background:#a0602a;vertical-align:.32em;margin:0 .5em}
.title{width:100%;margin-top:4px;color:#9a3608;text-shadow:0 1px 0 rgba(255,240,200,.6),0 0 1px rgba(80,20,0,.4);line-height:1.04;overflow-wrap:break-word}
.grant{margin:auto 0;text-align:center;padding-top:8px}
.grant .g{font-family:Cinzel,serif;font-weight:600;font-size:22px;letter-spacing:.24em;color:#7a5230;text-transform:uppercase}
.grant .who{display:inline-block;font-family:"Gochi Hand",cursive;font-weight:400;font-size:62px;line-height:1;color:#2a1608;border-bottom:2px solid rgba(107,63,26,.6);padding:0 40px 2px;margin-top:2px;max-width:900px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.grant .who.none{color:#7a5a3a;font-size:56px}
.pic{position:absolute;left:96px;top:380px;width:648px;height:364px;transform:rotate(-1.2deg);
  border:12px solid #3a2414;box-shadow:0 0 0 2px #c9a35a inset,0 14px 30px rgba(50,25,5,.45),0 0 0 1px #1d1008;background:${pal.bg}}
.pic div{position:absolute;inset:0;${sceneBg(`${Math.round(scene.focus * 100)}% 55%`)};filter:saturate(1.05)}
.pic .corner{position:absolute;width:44px;height:44px;background:#2a1a10;filter:none}
.cap{position:absolute;left:96px;width:648px;top:760px;text-align:center;font-family:Cinzel,serif;font-weight:800;font-size:22px;letter-spacing:.2em;color:#6b3f1a;text-transform:uppercase}
.items{position:absolute;left:800px;top:376px;width:650px;display:grid;grid-template-columns:1fr 1fr;gap:20px 22px}
.item{display:flex;gap:16px;align-items:center;height:174px;padding:16px 16px;border:1.5px solid rgba(107,63,26,.45);border-radius:14px;background:rgba(255,250,230,.35);box-shadow:inset 0 0 18px rgba(150,100,40,.18)}
.ico{flex:0 0 112px;height:112px;display:grid;place-items:center}
.ico img{width:104px;height:104px;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(60,30,5,.35))}
.txt{min-width:0}
.lab{font-family:Cinzel,serif;font-weight:800;font-size:16px;letter-spacing:.2em;color:#8a5a2c;text-transform:uppercase}
.nm{font-weight:800;font-size:27px;line-height:1.1;color:#2a1608;margin-top:4px}
.sub{font-size:16px;line-height:1.3;color:#5d4128;margin-top:6px;font-weight:500}
.item .tier{margin-top:8px;font-size:13px}
.item.secret{background:rgba(40,22,60,.08);border-color:rgba(90,50,140,.45)}
.foot{position:absolute;left:0;right:0;top:790px;height:100px}
.seal{position:absolute;left:62px;top:-26px;width:150px;height:150px;transform:rotate(-8deg)}
.odds{position:absolute;left:300px;right:300px;top:30px;text-align:center}
.odds .o1{font-family:Cinzel,serif;font-weight:800;font-size:30px;letter-spacing:.06em;color:#3b2410}
.odds .o2{font-size:17px;color:#6b4a2a;margin-top:6px;font-weight:500;letter-spacing:.02em}
.sign{position:absolute;right:84px;top:16px;width:330px;text-align:center}
.sign .sc{font-family:"Gochi Hand",cursive;font-weight:400;font-size:38px;white-space:nowrap;color:#3a1c0a;line-height:1;transform:rotate(-4deg)}
.sign .ln{border-top:1.5px solid rgba(107,63,26,.7);margin-top:4px;padding-top:6px;font-family:Cinzel,serif;font-weight:800;font-size:15px;letter-spacing:.2em;color:#7a5230;text-transform:uppercase}
.bat{position:absolute;fill:#2a1608;opacity:.8}
`;
  const web = (style, rot) => `<svg class="web" style="${style};transform:rotate(${rot}deg)" viewBox="0 0 100 100" fill="none" stroke="#5a3616" stroke-width=".9">
<path d="M0 0 L100 6 M0 0 L92 38 M0 0 L70 70 M0 0 L38 92 M0 0 L6 100"/>
${[22, 40, 60, 80].map((r) => { const p = [[r, r * .06], [r * .92, r * .38], [r * .7, r * .7], [r * .38, r * .92], [r * .06, r]]; return `<path d="M${p[0]} Q${r * .7} ${r * .2} ${p[1]} Q${r * .62} ${r * .5} ${p[2]} Q${r * .5} ${r * .62} ${p[3]} Q${r * .2} ${r * .7} ${p[4]}"/>`; }).join("")}
</svg>`;
  const bat = (x, y, s, r) => `<svg class="bat" style="left:${x}px;top:${y}px;width:${s}px;transform:rotate(${r}deg)" viewBox="-32 -12 64 24"><path d="M0 -2 C-8 -12 -22 -10 -31 1 C-23 -1 -19 5 -15 8 C-11 2 -5 4 0 9 C5 4 11 2 15 8 C19 5 23 -1 31 1 C22 -10 8 -12 0 -2Z"/></svg>`;
  const seal = `<svg class="seal" viewBox="0 0 200 200">
<defs><radialGradient id="wax" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#d23a2a"/><stop offset=".55" stop-color="#9b1611"/><stop offset="1" stop-color="#5c0907"/></radialGradient>
<filter id="wob"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="16"/></filter>
<path id="arcT" d="M40 100 A60 60 0 0 1 160 100"/><path id="arcB" d="M44 100 A56 56 0 0 0 156 100"/></defs>
<g filter="url(#wob)"><circle cx="100" cy="104" r="86" fill="#3a0503" opacity=".35"/><circle cx="100" cy="100" r="86" fill="url(#wax)"/></g>
<circle cx="100" cy="100" r="66" fill="none" stroke="#5e0a07" stroke-width="3" opacity=".8"/>
<circle cx="100" cy="100" r="64" fill="none" stroke="#f08a70" stroke-width="1.2" opacity=".35"/>
<text font-family="Cinzel,serif" font-weight="800" font-size="15" letter-spacing="4" fill="#ffd0c0" opacity=".85"><textPath href="#arcT" startOffset="50%" text-anchor="middle">PATCH SEED</textPath></text>
<text x="100" y="110" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="700" font-size="25" fill="#ffe3d6" stroke="#4a0604" stroke-width=".6" letter-spacing="1">${esc(patch.seed)}</text>
<path d="M78 128 q22 14 44 0" stroke="#ffcfbf" stroke-width="2" fill="none" opacity=".55"/>
<ellipse cx="72" cy="66" rx="20" ry="9" fill="#fff" opacity=".16" transform="rotate(-30 72 66)"/>
</svg>`;
  const body = `<svg width="0" height="0" style="position:absolute"><filter id="rough" x="-2%" y="-2%" width="104%" height="104%">
<feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="12"/></filter>
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .15  0 0 0 .55 0"/></filter></svg>
<div class="sheet">
 <div class="paper"></div>
 <svg class="grain" width="100%" height="100%"><rect width="100%" height="100%" filter="url(#noise)"/></svg>
 <div class="frame"></div>
 ${web("left:31px;top:31px", 0)}${web("right:31px;top:31px", 90)}
 ${bat(62, 232, 54, -14)}${bat(104, 290, 32, 10)}${bat(1392, 236, 50, 12)}${bat(1364, 296, 30, -8)}
 <div class="content">
  <div class="head"><div class="pre"><i></i>Deed of Land<i></i></div><div class="title display" data-title="96,60|72,44">${esc(name)}</div>
  <div class="grant">${owner ? `<div class="g">Granted to</div><div class="who">${esc(owner)}</div>` : `<div class="g">Hereby recorded as</div><div class="who none">Unclaimed land</div>`}</div></div>
  <div class="pic"><div></div></div>
  <div class="cap">${esc(scene.name)}</div>
  <div class="items">
   ${item("Weather", `<img src="${art("icons", event.icon)}">`, event.name, esc(event.chip))}
   ${item("Quirk", `<img src="${art("icons", quirk.icon)}">`, quirk.name, esc(quirk.chip))}
   ${item("Signature pumpkin", `<img src="${art("varieties", signature.id)}">`, signature.name, "", `${tierBadge(signature.tier)} <span class="sub" style="display:inline-block;margin-left:6px;white-space:nowrap">odds ×${dice.signatureMultiplier}</span>`)}
   <div class="item secret"><div class="ico">${ghost(108, 34)}</div><div class="txt"><div class="lab">Secret pumpkin</div><div class="nm">???</div><div class="sub">Only grows in this patch</div>${tierBadge("Secret")} <span class="sub" style="display:inline;margin-left:6px">${dice.secretTier.chance}%</span></div></div>
  </div>
  <div class="foot">${seal}
   <div class="odds"><div class="o1">One of ${possible.toLocaleString("en-US")} possible patches</div><div class="o2">${dice.scenes.length} scenes · ${dice.events.length} weathers · ${dice.quirks.length} quirks · ${dice.varieties.length} signatures · ${dice.secrets.length} secrets</div></div>
   <div class="sign"><div class="sc">The Pumpkin Council</div><div class="ln">Keeper of the rolls</div></div>
  </div>
 </div>
</div>`;
  return page(W, H, css, body, pal.bg);
}

// ---------- 2. Open Graph ----------
const secretPill = (size) => `<div class="pill">${ghost(size, Math.round(size * .32))}<span>Can you grow the secret pumpkin?</span></div>`;
const OG_CSS = `
.pill{display:inline-flex;align-items:center;gap:12px;padding:6px 22px 6px 8px;border-radius:999px;background:linear-gradient(90deg,rgba(29,16,54,.92),rgba(58,31,102,.92));box-shadow:0 0 0 1.5px #b48cff,0 0 22px rgba(180,140,255,.5);color:#efe3ff;font-weight:800}
.name{color:#ffd27a;text-shadow:0 0 28px rgba(255,170,60,.55),0 4px 0 rgba(0,0,0,.45),0 0 2px #000;overflow-wrap:break-word}
.kick{font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:${pal.accent};text-shadow:0 2px 8px rgba(0,0,0,.8);white-space:nowrap;line-height:1.2}
.kick .nm{text-transform:none;letter-spacing:.06em}
.line{font-weight:700;color:#f4ead8;text-shadow:0 2px 10px rgba(0,0,0,.85)}
`;
function ogHtml() {
  const W = 1200, H = 630;
  const css = `${OG_CSS}
body{position:relative;${sceneBg(`${Math.round(scene.focus * 100)}% 62%`)}}
.dark{position:absolute;inset:0;background:
  linear-gradient(90deg,color-mix(in srgb,${pal.bg} 94%,transparent) 0%,color-mix(in srgb,${pal.bg} 82%,transparent) 42%,color-mix(in srgb,${pal.bg} 30%,transparent) 68%,color-mix(in srgb,${pal.bg} 20%,transparent) 100%),
  linear-gradient(180deg,rgba(0,0,0,.25),transparent 30%,transparent 70%,rgba(0,0,0,.5))}
.jk{position:absolute;right:64px;bottom:34px}
.txt{position:absolute;left:64px;top:60px;width:640px;height:510px;display:flex;flex-direction:column;justify-content:center;gap:18px}
.kick{font-size:28px;width:640px}
.name{width:640px}
.line{font-size:31px}
.pill{font-size:25px;align-self:flex-start;margin-top:8px}
`;
  const body = `<div class="dark"></div><div class="jk">${jack(signature, 440)}</div>
<div class="txt"><div class="kick" data-fit="28,17,1">${kickerHtml}</div><div class="name display" data-title="124,84|112,64">${esc(name)}</div>
<div class="line">Grow a pumpkin and carve it for a friend</div>${secretPill(54)}</div>`;
  return page(W, H, css, body, pal.bg);
}
function ogSquareHtml() {
  const S = 1080;
  const css = `${OG_CSS}
body{position:relative;${sceneBg(`${Math.round(scene.focus * 100)}% 60%`)}}
.dark{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,${pal.bg} 92%,transparent) 0%,color-mix(in srgb,${pal.bg} 70%,transparent) 34%,color-mix(in srgb,${pal.bg} 18%,transparent) 58%,color-mix(in srgb,${pal.bg} 55%,transparent) 84%,color-mix(in srgb,${pal.bg} 92%,transparent) 100%)}
.top{position:absolute;left:70px;right:70px;top:76px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.kick{font-size:32px;width:940px}
.name{width:940px;text-align:center}
.jk{position:absolute;left:50%;top:430px;transform:translateX(-50%)}
.bot{position:absolute;left:70px;right:70px;bottom:72px;display:flex;flex-direction:column;align-items:center;gap:18px}
.line{font-size:36px}
.pill{font-size:28px}
`;
  const body = `<div class="dark"></div><div class="jk">${jack(signature, 470)}</div>
<div class="top"><div class="kick" data-fit="32,20,1">${kickerHtml}</div><div class="name display" data-title="132,96|120,70">${esc(name)}</div></div>
<div class="bot"><div class="line">Grow a pumpkin and carve it for a friend</div>${secretPill(60)}</div>`;
  return page(S, S, css, body, pal.bg);
}

// ---------- 3. icons ----------
// Simplified glyph for 16/32/48 in the page's lit look: the body darkened and warmed from inside, the Classic face
// glowing candle-yellow with a soft bloom, no outlines on the cuts (a faint rim in the body's own dark tone only).
const hex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
function glyphColors(rgb) {
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  let body = rgb;
  if (lum < 0.3) { const k = 0.3 / Math.max(lum, 0.02); body = rgb.map((v) => Math.min(255, v * Math.min(k, 2.6) + 18)); } // dark pumpkins still show on a dark tab
  const warm = [255, 138, 42], mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return { core: hex(mix(body.map((v) => v * 0.8), warm, 0.5)), body: hex(body.map((v) => v * 0.6)), edge: hex(body.map((v) => v * 0.4)), rim: hex(body.map((v) => v * 0.26)) };
}
function glyphSvg(px, col) {
  const defs = (blur) => `<defs><radialGradient id="gl" cx="50%" cy="58%" r="60%"><stop offset="0" stop-color="#fffbea"/><stop offset=".45" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffae45"/></radialGradient>
<radialGradient id="bd" cx="50%" cy="66%" r="62%"><stop offset="0" stop-color="${col.core}"/><stop offset=".6" stop-color="${col.body}"/><stop offset="1" stop-color="${col.edge}"/></radialGradient>
<filter id="bl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>`;
  const face = (d) => `<g filter="url(#bl)" fill="#ffa53e" opacity=".95">${d}</g><g fill="url(#gl)">${d}</g>`;
  if (px <= 16) {
    // a 16-unit grid so edges land on pixels: wide body, 3px eyes, a 2px-tall grin
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 16 16">${defs(0.55)}
<path d="M7 3.6 L7 1 L9.6 0.6 L9.4 2 L8.8 2.2 L8.8 3.6Z" fill="#3f7a2a"/>
<path d="M8 3.4 C4.5 2.4 0.6 4.4 0.6 9.6 C0.6 13.6 4 15.6 8 15.3 C12 15.6 15.4 13.6 15.4 9.6 C15.4 4.4 11.5 2.4 8 3.4Z" fill="url(#bd)" stroke="${col.rim}" stroke-width=".5"/>
${face(`<path d="M2.6 8.4 L6.6 8.4 L4.6 5.2Z M9.4 8.4 L13.4 8.4 L11.4 5.2Z"/><path d="M2.4 10 Q8 12.2 13.6 10 Q12.6 14.2 8 14.2 Q3.4 14.2 2.4 10Z"/>`)}
</svg>`;
  }
  // 32/48: ribs, the Classic face (triangle eyes and nose, a grin with two teeth up and one down)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64">${defs(1.8)}
<path d="M29 15 C28.5 10 29.5 6 33 2.5 L39 4.5 C35.5 8 35 11 35.5 15 Z" fill="#3f7a2a"/>
<path d="M32 13 C19 9 2 15 2 37 C2 55 16 62 32 60.5 C48 62 62 55 62 37 C62 15 45 9 32 13 Z" fill="url(#bd)" stroke="${col.rim}" stroke-width="1.2"/>
<path d="M21 14 C11 24 11 51 21 60 M43 14 C53 24 53 51 43 60" fill="none" stroke="${col.rim}" stroke-width="1.6" opacity=".55"/>
${face(`<path d="M10 33 L27 33 L18.5 19 Z M37 33 L54 33 L45.5 19 Z M29 39 L35 39 L32 34 Z"/>
<path d="M8 40 Q16 45 22 46 L22 50 L28 50 L28 46.8 Q32 47 36 46.8 L36 50 L42 50 L42 46 Q48 45 56 40 Q53 57 35 57.4 L35 53 L29 53 L29 57.4 Q11 57 8 40 Z"/>`)}
</svg>`;
}
const glyphHtml = (px, col) => `<!doctype html><html><head><style>*{margin:0}html,body{width:${px}px;height:${px}px;background:transparent;overflow:hidden}svg{display:block}</style></head><body>${glyphSvg(px, col)}</body></html>`;
function appIconHtml(px) {
  const css = `
body{position:relative;background:radial-gradient(circle at 50% 62%,color-mix(in srgb,${pal.accent} 30%,${pal.ground}) 0%,${pal.ground} 38%,${pal.bg} 78%)}
.jk{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%)}
.jack .halo{width:118%;height:112%}`;
  return page(px, px, css, `<div class="jk">${jack(signature, Math.round(px * 0.74))}</div>`, pal.bg);
}

function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

function shortName(n) {
  const words = n.replace(/^the\s+/i, "").split(/\s+/);
  let s = "";
  for (const w of words) { const t = s ? `${s} ${w}` : w; if (t.length > 12) break; s = t; }
  return s || words[0].slice(0, 12);
}

// ---------- render ----------
const { chromium } = await loadPlaywright();
mkdirSync(outDir, { recursive: true });
const { browser, label: browserLabel } = await launch(chromium);
console.log(`Browser: ${browserLabel}`);
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const wrote = [];

// ---------- the pumpkin, from the page's own renderer ----------
// A PNG tEXt chunk (inserted before IEND): how the full test suite finds the brand pumpkin's holes in og.png.
function withText(png, key, text) {
  const body = Buffer.concat([Buffer.from(key, "latin1"), Buffer.from([0]), Buffer.from(text, "latin1")]);
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const type = Buffer.from("tEXt"), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, body])) >>> 0);
  const iend = png.length - 12;
  return Buffer.concat([png.subarray(0, iend), len, type, body, crc, png.subarray(iend)]);
}
const packBits = (bits) => { const b = Buffer.alloc(bits.length >> 3); for (let i = 0; i < bits.length; i++) if (bits[i] === "1") b[i >> 3] |= 128 >> (i & 7); return b; };
let brandMeta = null;
if (only.has("og") || only.has("icons")) {
  const tmp = mkdtempSync(join(tmpdir(), "pumpkin-brand-"));
  try {
    try { execFileSync(process.execPath, [join(here, "build.mjs"), "--patch", resolve(patchPath), "--out", join(tmp, "site")], { stdio: "pipe" }); }
    catch (e) { fail(`could not build the page to draw the pumpkin with:\n${String(e.stderr || e.message).trim()}`); }
    const root = join(tmp, "site");
    const TYPES = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".png": "image/png" };
    const srv = createServer((req, res) => {
      const f = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html")));
      if (!(f + sep).startsWith(root + sep) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }); res.end(readFileSync(f));
    });
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    try {
      const p = await ctx.newPage();
      await p.goto(`http://127.0.0.1:${srv.address().port}/?fog=off`, { waitUntil: "load", timeout: 30000 });
      await p.waitForFunction(() => !!window.__pumpkinPatch, null, { timeout: 15000 });
      // the carving font, in case a stencil ever carries words
      await p.evaluate(() => document.fonts && document.fonts.load('40px "Luckiest Guy"').catch(() => {}));
      // og images: the patch's signature pumpkin; app icons: always the classic orange one (clearest on a home screen)
      const sizes = new Map();
      if (only.has("og")) { sizes.set(440, signature.id); sizes.set(470, signature.id); }
      if (only.has("icons")) for (const px of [180, 192, 512]) sizes.set(Math.round(px * 0.74), ICON_VARIETY);
      for (const [size, variety] of sizes) {
        // drawn twice at most: a render without its carved face (no holes) is never used
        let r = null;
        for (let tries = 0; tries < 2 && !(r && r.png && (r.hole.match(/1/g) || []).length > 300); tries++)
          r = await p.evaluate((o) => window.__pumpkinPatch.brandPumpkin(o), { variety, pseed: BRAND_PSEED, stencil: BRAND_STENCIL, size });
        if (!r || !r.png || (r.hole.match(/1/g) || []).length <= 300) fail(`the page could not draw the carved ${variety} pumpkin`);
        PUMPKIN.set(size, r);
      }
      await p.close();
    } finally { srv.close(); }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
let fontWarn = false;
async function shot(html, w, h, file, { transparent = false, run = true, jpeg = 0, slim = false } = {}) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(html, { waitUntil: "load", timeout: 30000 });
  if (run) { const r = await p.evaluate(() => window.__run()); if (!r.creepster) fontWarn = true; }
  let buf = await p.screenshot(jpeg ? { type: "jpeg", quality: jpeg, clip: { x: 0, y: 0, width: w, height: h } } : { type: "png", omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
  if (slim) buf = slimPng(buf);
  if (file) { writeFileSync(join(outDir, file), buf); wrote.push(file); }
  return buf;
}

if (only.has("deed")) await shot(deedHtml(), 1600, 1000, "deed.png");
if (only.has("og")) {
  {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 1200, height: 630 });
    await p.setContent(ogHtml(), { waitUntil: "load", timeout: 30000 });
    const r = await p.evaluate(() => window.__run()); if (!r.creepster) fontWarn = true;
    const box = await p.evaluate(() => { const b = document.querySelector("[data-pk]").getBoundingClientRect(); return [b.left, b.top, b.width]; });
    const png = await p.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await p.close();
    const R = PUMPKIN.get(440), k = box[2] / 440;
    brandMeta = { v: 1, variety: signature.id, pseed: BRAND_PSEED, stencil: BRAND_STENCIL,
      map: { a: R.map.a * k, e: box[0] + R.map.e * k, f: box[1] + R.map.f * k }, hole: deflateSync(packBits(R.hole)).toString("base64") };
    // og.png is published: kept at or under 600 KB
    writeFileSync(join(outDir, "og.png"), withText(slimPng(png, 600000), "pumpkin-patch:brand", JSON.stringify(brandMeta))); wrote.push("og.png");
  }
  // the square card is for posting by hand: a JPEG, and it never goes into site/
  await shot(ogSquareHtml(), 1080, 1080, "og-square.jpg", { jpeg: 85 });
  rmSync(join(outDir, "og-square.png"), { force: true }); // from an older brand.mjs
}
if (only.has("icons")) {
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><body><script>${PAGE_JS}</script></body>`);
  const rgb = await p.evaluate((src) => window.__domColor(src), art("varieties", ICON_VARIETY));
  await p.close();
  const col = glyphColors(rgb);
  const g = {};
  for (const px of [16, 32, 48]) g[px] = await shot(glyphHtml(px, col), px, px, null, { transparent: true, run: false });
  writeFileSync(join(outDir, "favicon-32.png"), g[32]); wrote.push("favicon-32.png");
  writeFileSync(join(outDir, "favicon.ico"), ico([16, 32, 48].map((size) => ({ size, buf: g[size] })))); wrote.push("favicon.ico");
  writeFileSync(join(outDir, "favicon.svg"), glyphSvg(64, col)); wrote.push("favicon.svg");
  await shot(appIconHtml(180), 180, 180, "apple-touch-icon.png", { slim: true });
  await shot(appIconHtml(192), 192, 192, "icon-192.png", { slim: true });
  await shot(appIconHtml(512), 512, 512, "icon-512.png", { slim: true });
  const manifest = {
    name, short_name: shortName(name),
    description: owner ? `${owner}'s pumpkin patch. Grow a pumpkin and carve it for a friend.` : "Grow a pumpkin and carve it for a friend.",
    start_url: "./", scope: "./", display: "standalone",
    theme_color: pal.bg, background_color: pal.bg,
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
  writeFileSync(join(outDir, "site.webmanifest"), JSON.stringify(manifest, null, 2) + "\n"); wrote.push("site.webmanifest");
}
await browser.close();

// ---------- head tags ----------
const ogUrl = liveUrl ? `${liveUrl}/og.png` : "og.png";
const alt = `${kicker === NO_OWNER_KICKER ? name : `${name}, ${owner}'s pumpkin patch`}: a glowing ${signature.name} jack-o'-lantern in the ${scene.name}`;
const head = [
  `<link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48">`,
  `<link rel="icon" href="favicon.svg" type="image/svg+xml">`,
  `<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">`,
  `<link rel="apple-touch-icon" href="apple-touch-icon.png" sizes="180x180">`,
  `<link rel="manifest" href="site.webmanifest">`,
  `<meta property="og:image" content="${esc(ogUrl)}">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`,
  `<meta property="og:image:type" content="image/png">`,
  `<meta property="og:image:alt" content="${esc(alt)}">`,
  `<meta name="twitter:card" content="summary_large_image">`,
  `<meta name="twitter:image" content="${esc(ogUrl)}">`,
  `<meta name="twitter:image:alt" content="${esc(alt)}">`,
].join("\n");
writeFileSync(join(outDir, "head.html"), head + "\n"); wrote.push("head.html");

console.log(`Brand for ${name} (seed ${patch.seed}) -> ${outDir}`);
console.log(`  ${wrote.join(", ")}`);
if (fontWarn) console.warn("  WARNING: the Creepster web font did not load (offline?); titles fell back to a system face. Re-run with network.");
if (!liveUrl) console.warn("  NOTE: no --url, so og:image is relative. Chat apps need an absolute URL: re-run with --url https://<live host> once it is known.");
console.log("\n<head> tags:\n" + head);
