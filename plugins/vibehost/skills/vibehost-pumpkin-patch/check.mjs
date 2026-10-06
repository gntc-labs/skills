#!/usr/bin/env node
// Quick browser check of a built pumpkin-patch site (well under a minute). Exits 1 if any check fails.
//   node check.mjs --site site/ --shots preview/ [--showcase] [--playwright <path to playwright-core or playwright>] [--browser chrome|chromium|shell] [--verbose]
// Phone (390x844) and desktop (1280x800) run side by side in one browser. The page runs with ?fast=1 (the grow plays
// at repeat-run speed) so the whole plant -> water -> night -> harvest -> carve -> light -> send flow takes seconds.
// Works when copied ALONE into a project folder: everything it needs is in the config build.mjs injects into
// site/index.html. Playwright comes from --playwright, else the project's own node_modules (playwright-core, then
// playwright). Browser: the installed Google Chrome first, then Playwright's Chromium, then its headless shell.
// --showcase (SKILL.md Step 6): only the landing (phone + desktop), the owner's showcase and the file checks; ~10 s.
// Each check prints as it completes ([n/N]); failures are listed again at the end. Exit 0 = all passed.
// The full ~11-minute test suite lives in the skill's source repo (dev/), not in the installed skill.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const t0 = Date.now();
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const site = resolve(flag("--site") ?? "site");
const shots = resolve(flag("--shots") ?? "preview");
const SHOWCASE_ONLY = args.includes("--showcase");
const die = (msg) => { console.error(`check.mjs: ${msg}`); process.exit(2); };
if (!existsSync(join(site, "index.html"))) die(`no index.html in ${site}`);
mkdirSync(shots, { recursive: true });
const SHOTS = ["phone-landing.png", "phone-grow-reveal.png", "phone-carve-lit.png", "desktop-landing.png"];
for (const f of SHOWCASE_ONLY ? ["phone-landing.png", "desktop-landing.png"] : SHOTS) rmSync(join(shots, f), { force: true }); // a failed run must not leave an old screenshot looking current

// ---------- Playwright + browser ----------
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
  die("Playwright not found. In this project folder run:\n  npm i playwright-core\nthen run check.mjs again (or pass --playwright <path/to/node_modules/playwright-core>).");
}
// Installed Google Chrome first (no download), then Playwright's own Chromium, then its headless shell.
async function launch(chromium) {
  const errors = [], chain = [["chrome", "Google Chrome", { channel: "chrome" }], ["chromium", "Playwright Chromium", { channel: "chromium" }], ["shell", "Playwright headless shell", {}]];
  // --browser chromium|shell starts further down the chain (to test the fallbacks on a machine that has Chrome)
  const from = chain.findIndex(([id]) => id === (flag("--browser") ?? "chrome"));
  if (from < 0) die(`--browser takes chrome, chromium or shell`);
  for (const [, label, opts] of chain.slice(from)) {
    try { const b = await chromium.launch(opts); return { browser: b, label: `${label} ${b.version()}` }; }
    catch (e) { errors.push(`${label}: ${String(e.message).split("\n")[0]}`); }
  }
  die(`no browser could start.\n  ${errors.join("\n  ")}\nIf Google Chrome isn't installed, run: npx playwright-core install --only-shell chromium`);
}
const { chromium, devices } = await loadPlaywright();

// ---------- the patch, from the built page ----------
const html = readFileSync(join(site, "index.html"), "utf8");
const cfgMatch = /<script id="patch" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
if (!cfgMatch) die("site/index.html has no patch config; rebuild it with build.mjs");
const CFG = JSON.parse(cfgMatch[1]);
if (SHOWCASE_ONLY && !CFG.showcase) die("--showcase: this build has no showcase (build.mjs --showcase '<link>' first)");
const TOTAL = (SHOWCASE_ONLY ? 5 : 9) + (CFG.showcase ? 1 : 0);

// ---------- static server ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(site, path.endsWith("/") ? path + "index.html" : path));
  if (!(file + sep).startsWith(site + sep) && file !== site) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ---------- harness ----------
const results = [];
const check = (name, ok, details) => {
  results.push({ name, ok: !!ok, details });
  console.log(`[${results.length}/${Math.max(TOTAL, results.length)}] ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok || args.includes("--verbose")) console.log("      " + JSON.stringify(details));
};
const FONTS = /fonts\.(googleapis|gstatic)\.com/;
const errorsOf = (page, tag) => {
  const bucket = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // the display fonts are the only third-party requests; an offline sandbox must not fail the run
    if (FONTS.test(m.location()?.url ?? "") || FONTS.test(m.text())) return;
    bucket.push(`${tag} console: ${m.text()}`);
  });
  page.on("pageerror", (e) => bucket.push(`${tag} pageerror: ${e.message}`));
  page.on("dialog", (d) => { bucket.push(`${tag} DIALOG: ${d.message()}`); d.dismiss().catch(() => {}); });
  page.on("requestfailed", (r) => { if (!FONTS.test(r.url())) bucket.push(`${tag} requestfailed: ${r.url()}`); });
  page.on("response", (r) => { if (r.status() >= 400 && !FONTS.test(r.url())) bucket.push(`${tag} HTTP ${r.status()}: ${r.url()}`); });
  return bucket;
};
// Records every AudioContext the page creates, and whether a user gesture was active at that moment.
const AUDIO_SPY = () => {
  window.__ac = [];
  for (const k of ["AudioContext", "webkitAudioContext"]) {
    const Orig = window[k];
    if (typeof Orig !== "function") continue;
    window[k] = class extends Orig {
      constructor(...a) { super(...a); window.__ac.push({ at: Math.round(performance.now()), gesture: !!(navigator.userActivation && navigator.userActivation.isActive) }); }
    };
  }
};
// Share is stubbed: it records what would have been shared.
const SHARE_STUB = () => { window.__shared = []; navigator.share = async (d) => { window.__shared.push(d); }; };
const wait = (page, ms) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: join(shots, name) });
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout });
const phaseIs = (page, p) => until(page, (p) => document.getElementById("grow").dataset.phase === p, p);
const ready = async (page) => { await until(page, () => !!window.__pumpkinPatch && document.readyState === "complete"); await page.evaluate(() => document.fonts && document.fonts.ready); };

// Decorations (quirk sprites, bubbles, glows) must never sit on text, buttons or the footer; every running
// animation is sampled across its cycle.
const LANDING_TARGETS = "#landing .intro > *, #landing .outro > *, #landing button, #landing .dice li, footer p, #mute, #note";
const decoOverlaps = (page) => page.evaluate((targetSel) => {
  const shown = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const sect = (a, b, pad = 0) => { const l = Math.max(a.left, b.left) + pad, t = Math.max(a.top, b.top) + pad, r = Math.min(a.right, b.right) - pad, bt = Math.min(a.bottom, b.bottom) - pad; return r > l && bt > t ? { left: l, top: t, right: r, bottom: bt } : null; };
  const decos = [...document.querySelectorAll("[data-deco]")];
  const targets = [...document.querySelectorAll(targetSel)].filter(shown);
  const anims = document.getAnimations();
  for (const a of anims) a.pause();
  const hits = new Set(); const N = 24; let sampled = 0;
  for (let k = 0; k < N; k++) {
    for (const a of anims) {
      const tm = a.effect.getTiming(), dur = Number(tm.duration) || 0, span = dur * (String(tm.direction).includes("alternate") ? 2 : 1);
      a.currentTime = Math.max(0, tm.delay || 0) + (k / N) * span;
    }
    for (const d of decos) {
      let r = d.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const clip = d.closest("[data-deco-clip]"); if (clip) { r = sect(r, clip.getBoundingClientRect()); if (!r) continue; }
      sampled++;
      for (const t of targets) {
        if (t.contains(d) || d.contains(t)) continue;
        if (sect(r, t.getBoundingClientRect(), 1)) hits.add(`${d.className || d.tagName} x ${t.id || t.className || t.tagName}`);
      }
    }
  }
  for (const a of anims) a.play();
  return { decorations: decos.length, sampled, overlaps: [...hits] };
}, LANDING_TARGETS);
const holeMask = (page) => page.evaluate(() => window.__pumpkinPatch.holeMask());
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < 65536; k++) { const x = a[k] === "1", y = b[k] === "1"; if (x && y) i++; if (x || y) u++; } return u ? +(i / u).toFixed(4) : 0; };

const { browser, label } = await launch(chromium);
console.log(`Browser: ${label}`);
const newCtx = async (opts) => { const c = await browser.newContext(opts); await c.addInitScript(AUDIO_SPY); await c.addInitScript(SHARE_STUB); return c; };

// ===== phone: landing, then the whole flow, then the link it made =====
async function phoneRun() {
  const ctx = await newCtx({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  try {
    const page = await ctx.newPage(); const errs = errorsOf(page, "phone");
    await page.goto(BASE + "?fast=1"); await ready(page); await wait(page, 900);
    const landing = await page.evaluate(() => ({ name: document.getElementById("patchName").textContent, title: document.title, audio: window.__ac.length }));
    check("phone: landing loads (no console errors / failed requests) and shows the patch name", landing.name.includes(CFG.name) && errs.length === 0, { landing, errors: errs.slice() });
    const deco = await decoOverlaps(page);
    check("phone: no decoration overlaps text / buttons on the landing", deco.overlaps.length === 0 && (deco.decorations === 0 || deco.sampled > 0), deco);
    await shot(page, "phone-landing.png");
    if (SHOWCASE_ONLY) return;

    // plant -> water x3 -> night (skip) -> harvest -> reveal
    const steps = [];
    await page.click("#plantBtn"); await phaseIs(page, "plant");
    const audio = await page.evaluate(() => window.__ac.slice());
    await page.click("#plot"); await phaseIs(page, "water"); steps.push("planted");
    for (let i = 0; i < 12 && (await page.evaluate(() => document.getElementById("grow").dataset.phase)) === "water"; i++) { await page.click("#growBtn"); await wait(page, 250); }
    await phaseIs(page, "night"); steps.push("watered");
    await until(page, () => /Skip/.test(document.getElementById("growSkip").textContent) && !document.getElementById("growSkip").hidden);
    await page.click("#growSkip"); steps.push("night skipped");
    await until(page, () => !document.getElementById("reveal").hidden);
    await page.click("#card");
    await until(page, () => !document.getElementById("card").classList.contains("mystery")); steps.push("revealed");
    const rev = await page.evaluate(() => document.getElementById("revealName").textContent);
    await wait(page, 900);
    await shot(page, "phone-grow-reveal.png");

    // carve a stroke + a stencil + a word, light it, sign it, send it
    await page.click("#toCarve");
    await until(page, () => !!window.__pumpkinPatch.look());
    await wait(page, 200);
    const box = await page.locator("#c").boundingBox();
    const at = (u, v) => [box.x + box.width * u, box.y + box.height * v];
    await page.mouse.move(...at(0.3, 0.86)); await page.mouse.down();
    for (let i = 0; i <= 10; i++) await page.mouse.move(...at(0.3 + i * 0.04, 0.86 - Math.sin(i / 3) * 0.03));
    await page.mouse.up();
    await page.click('[data-tab="stencils"]'); await page.click('[data-stencil="classic"]');
    await page.click('[data-tab="words"]'); await page.fill("#textIn", "BOO"); await page.click("#addText");
    await wait(page, 250);
    const carved = await page.evaluate(() => { const l = window.__pumpkinPatch.look(); return { variety: l.variety, strokes: JSON.parse(l.strokes).length, texts: JSON.parse(l.texts).length }; });
    steps.push(`carved ${carved.strokes} strokes + ${carved.texts} word`);
    await page.click("#light");
    await until(page, () => document.body.classList.contains("lit") && !!document.getElementById("from").offsetParent);
    await page.fill("#from", "Morgan"); await page.fill("#msg", "Happy Halloween from the patch!");
    await page.locator("#msg").blur(); await wait(page, 1400);
    await shot(page, "phone-carve-lit.png");
    await page.click("#send");
    await until(page, () => !!document.getElementById("linkOut").value);
    const link = await page.inputValue("#linkOut");
    const shared = await page.evaluate(() => window.__shared);
    const sent = await holeMask(page);
    steps.push("sent");
    const flowOk = link.includes("#p=") && shared.length === 1 && shared[0].url === link && carved.strokes > 1 && carved.texts === 1 && errs.length === 0;
    check("phone: plant -> water x3 -> night (skip) -> harvest -> reveal -> carve (stroke, stencil, word) -> light -> sign -> send", flowOk,
      { steps, revealed: rev, carved, linkLength: link.length, shared: shared.map((s) => ({ url: s.url?.slice(0, 80), text: s.text })), errors: errs.slice() });
    check("phone: no AudioContext before a gesture; one, created inside the first tap",
      landing.audio === 0 && audio.length === 1 && audio[0].gesture, { beforeTap: landing.audio, afterPlant: audio });

    // the link reopens the same pumpkin
    const view = await ctx.newPage(); const verrs = errorsOf(view, "phone link");
    await view.goto(link);
    await until(view, () => document.body.classList.contains("s-view") && /1/.test(window.__pumpkinPatch.holeMask() || ""), null, 10000);
    const got = await holeMask(view);
    const lk = await view.evaluate(() => ({ variety: window.__pumpkinPatch.look().variety, audio: window.__ac.length }));
    const score = sent && got ? iou(sent, got) : 0;
    check("phone: the share link reopens the same pumpkin (hole IoU >= 0.95), no sound without a tap", score >= 0.95 && lk.variety === carved.variety && lk.audio === 0 && verrs.length === 0,
      { iou: score, variety: lk.variety, audioContexts: lk.audio, errors: verrs });
  } finally { await ctx.close(); }
}

// ===== desktop: landing, and a garbage link =====
async function desktopRun() {
  const ctx = await newCtx({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  try {
    const page = await ctx.newPage(); const errs = errorsOf(page, "desktop");
    await page.goto(BASE + "?fast=1"); await ready(page); await wait(page, 900);
    const landing = await page.evaluate(() => ({ name: document.getElementById("patchName").textContent, audio: window.__ac.length }));
    const deco = await decoOverlaps(page);
    check("desktop: landing loads (no console errors / failed requests), no decoration overlaps, no sound without a tap",
      landing.name.includes(CFG.name) && landing.audio === 0 && deco.overlaps.length === 0 && errs.length === 0, { landing, deco, errors: errs.slice() });
    await shot(page, "desktop-landing.png");
    if (SHOWCASE_ONLY) return;
    const bad = await ctx.newPage(); const berrs = errorsOf(bad, "garbage link");
    await bad.goto(BASE + "#p=garbage"); await ready(bad);
    await until(bad, () => !document.getElementById("note").hidden).catch(() => {});
    const fb = await bad.evaluate(() => ({ note: document.getElementById("note").hidden ? null : document.getElementById("note").textContent, landing: !document.getElementById("landing").hidden, view: document.body.classList.contains("s-view") }));
    check("a garbage #p= link shows the friendly fallback on the landing", fb.note && fb.landing && !fb.view && berrs.length === 0, { ...fb, errors: berrs });
  } finally { await ctx.close(); }
}

// ===== the owner's showcase (only when the build has one): lit on the landing, opens as itself, works as a stencil =====
async function showcaseRun() {
  const ctx = await newCtx({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    const page = await ctx.newPage(); const errs = errorsOf(page, "showcase");
    const S = CFG.showcase, own = CFG.owner ? `${CFG.owner}'s` : "The owner's";
    await page.goto(BASE + "?fast=1"); await ready(page);
    const cuts = await page.evaluate(() => window.__pumpkinPatch.showcaseStrokes());
    await until(page, () => { const cv = document.getElementById("showcaseCv"); return !document.getElementById("showcase").hidden && cv.width > 0; });
    const land = await page.evaluate(() => {
      const sc = document.getElementById("showcase"), cv = document.getElementById("showcaseCv"); let any = 0, lit = 0;
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 20) any++; if (d[i + 3] > 200 && d[i] > 230 && d[i + 1] > 150) lit++; }
      return { name: document.getElementById("showcaseName").textContent, href: sc.getAttribute("href"), pixels: any, litPixels: lit };
    });
    await page.click("#showcase");
    await until(page, () => document.body.classList.contains("s-view") && !!window.__pumpkinPatch.look(), null, 10000);
    const view = await page.evaluate(() => { const l = window.__pumpkinPatch.look(); return { variety: l.variety, strokes: JSON.parse(l.strokes).length, texts: JSON.parse(l.texts).length }; });
    // the owner's stencil on another pumpkin: same cuts, refitted
    await page.click("#carveBack"); await until(page, () => !document.getElementById("landing").hidden);
    const other = CFG.varieties.find((v) => v.id !== S.variety).id;
    await page.evaluate((id) => window.__pumpkinPatch.forceNext(id), other);
    await page.click("#skipCarve"); await until(page, () => !!window.__pumpkinPatch.look() && !document.getElementById("ownerStencil").disabled);
    await page.click('[data-tab="stencils"]'); await page.click("#ownerStencil"); await wait(page, 300);
    const st = await page.evaluate(() => { const l = window.__pumpkinPatch.look(); return { variety: l.variety, strokes: JSON.parse(l.strokes).length, label: document.getElementById("ownerStencilName").textContent }; });
    const ok = land.name === `${own} pumpkin` && land.href === "#p=" + S.frag && land.pixels > 200 && land.litPixels > 5 &&
      view.variety === S.variety && view.strokes === cuts && view.texts === S.texts.length && st.variety === other && st.strokes === cuts && st.label === own && errs.length === 0;
    check("showcase: lit on the landing, opens as the same pumpkin, and works as the owner's stencil on another pumpkin", ok, { land, cuts, view, stencil: st, errors: errs });
  } finally { await ctx.close(); }
}

// ===== files: every referenced asset exists and carries its content hash; brand files; nothing private ships =====
function fileChecks() {
  const h8 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 8);
  const urls = new Map(); // local path -> where it was referenced
  const add = (u, where) => { if (typeof u === "string" && u && !/^(data:|https?:\/\/)/.test(u)) urls.set(u, where); };
  const walk = (o, at) => { if (typeof o === "string") { if (/^art\//.test(o)) add(o, at); } else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`); };
  walk(CFG, "config");
  const head = html.slice(0, html.indexOf("</head>"));
  for (const m of head.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/g)) add(m[1], "<link>");
  for (const m of html.matchAll(/url\(\s*["']?((?:\.\/)?art\/[^"')]+)["']?\s*\)/g)) add(m[1], "css url()");
  for (const m of html.matchAll(/["'(]((?:\.\/)?art\/[a-z0-9-]+\/[a-z0-9.-]+\.(?:webp|png|jpe?g|json))/g)) add(m[1], "page text");
  const manifests = [...urls.keys()].filter((u) => /\.webmanifest$/.test(u));
  if (existsSync(join(site, "site.webmanifest"))) manifests.push("site.webmanifest");
  for (const mf of manifests) { try { for (const ic of JSON.parse(readFileSync(join(site, mf), "utf8")).icons || []) add(ic.src, mf); } catch (e) { urls.set(mf, "unparseable manifest"); } }
  const missing = [], unhashed = [], wrongHash = [];
  for (const [u, where] of urls) {
    const f = join(site, decodeURI(u.replace(/^\.\//, "").split(/[?#]/)[0]));
    if (!existsSync(f) || !statSync(f).isFile()) { missing.push(`${u} (${where})`); continue; }
    const m = /\.([0-9a-f]{8})\.[a-z0-9]+$/.exec(u);
    if (!m) { if (/^art\//.test(u) || where === "<link>" || /\.webmanifest$/.test(where)) unhashed.push(`${u} (${where})`); continue; }
    if (m[1] !== h8(f)) wrongHash.push(`${u}: file hashes to ${h8(f)}`);
  }
  const og = [...head.matchAll(/<meta (?:property="og:image"|name="twitter:image") content="([^"]+)"/g)].map((m) => m[1]);
  const ogBad = og.filter((u) => { const m = /\/og\.png\?v=([0-9a-f]{8})$/.exec(u); return !m || !/^https:\/\//.test(u) || !existsSync(join(site, "og.png")) || m[1] !== h8(join(site, "og.png")); });
  const art = []; const ls = (d) => { for (const e of readdirSync(join(site, d), { withFileTypes: true })) e.isDirectory() ? ls(`${d}/${e.name}`) : art.push(`${d}/${e.name}`); };
  if (existsSync(join(site, "art"))) ls("art");
  const strayArt = art.filter((f) => !/\.[0-9a-f]{8}\.webp$/.test(f));
  check("files: every referenced asset exists with a matching content hash; og:image (if set) is absolute and matches og.png",
    urls.size > 0 && !missing.length && !unhashed.length && !wrongHash.length && !ogBad.length && !strayArt.length,
    { referenced: urls.size, missing, unhashed, wrongHash, ogBad, strayArt, og });
  // built with --brand (the head links a manifest): the conventional root names must be there; the deed and the
  // square card are the owner's, never published
  const branded = /<link rel="manifest"/.test(head);
  const ROOT = ["og.png", "favicon.ico", "apple-touch-icon.png", "site.webmanifest"];
  const absent = branded ? ROOT.filter((f) => !existsSync(join(site, f))) : [];
  const privateFiles = readdirSync(site).filter((f) => /^(deed|og-square)\b/.test(f));
  const bytes = (() => { let n = 0; const du = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) e.isDirectory() ? du(join(d, e.name)) : (n += statSync(join(d, e.name)).size); }; du(site); return n; })();
  check(branded ? "files: brand files present (og.png, favicon.ico, apple-touch-icon.png, site.webmanifest); no deed / og-square in site/" : "files: no brand build (no --brand), no deed / og-square in site/",
    !absent.length && !privateFiles.length, { branded, absent, privateFiles, siteMB: +(bytes / 1e6).toFixed(2) });
}

try {
  fileChecks();
  const guard = (label, p) => p.catch((e) => check(label, false, { error: String(e && e.stack || e).split("\n").slice(0, 4).join(" | ") }));
  await Promise.all([guard("phone", phoneRun()), guard("desktop", desktopRun()), ...(CFG.showcase ? [guard("showcase", showcaseRun())] : [])]);
} catch (e) {
  check("harness", false, { error: String(e && e.stack || e) });
} finally {
  await browser.close();
  server.close();
}

const missingShots = (SHOWCASE_ONLY ? ["phone-landing.png", "desktop-landing.png"] : SHOTS).filter((f) => !existsSync(join(shots, f)));
if (missingShots.length) check(`screenshots: missing ${missingShots.join(", ")}`, false, {});
const failed = results.filter((r) => !r.ok).length;
if (failed) { console.log("\nFailed:"); for (const r of results) if (!r.ok) console.log(`FAIL  ${r.name}`); }
console.log(`\n${results.length - failed}/${results.length} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)} s · screenshots in ${shots}`);
process.exit(failed ? 1 : 0);
