#!/usr/bin/env node
// Builds a static pumpkin-patch site from a rolled patch.
//   node build.mjs --patch patch.json --out site/ [--og-image <absolute https URL>] [--grow-url <url>]
//                  [--brand brand/ [--url https://<live host>]]
//                  [--showcase '<share link from this patch, or just its p= part>']
// Output: site/index.html (engine + injected config, including everything check.mjs needs) and site/art/
// (all varieties, this patch's secret only, 4 stages, this patch's scene, the UI icons, the sticker control icons in art/ui/,
// the match for the video clip, and only the sprites this
// patch's weather + quirk use).
// Cache busting: every art file ships as <name>.<hash8>.webp (the first 8 hex of its content's SHA-256) and the page
// only ever references those names, so a redeploy with new art is a new URL that no browser or CDN can serve stale
// (the static host marks such names immutable). The brand icons ship as hashed copies only, which the <head> tags and
// the manifest point at; just four keep a fixed root name too, because crawlers and browsers ask for them by name:
// og.png (og:image stays <url>/og.png?v=<hash8>), favicon.ico, apple-touch-icon.png and site.webmanifest. The deed
// and the square card stay in brand/ (they're the owner's, not the page's). index.html itself is the one unhashed
// entry: the host serves HTML with max-age=0, must-revalidate.
// --showcase checks the owner's link with the page's own link rules, saves its fragment into patch.json
// ("showcase"), then builds. A patch.json without "secret" (rolled before dice v3) gets the one its seed rolls.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nameHasOwner, scriptFonts } from "./script-fonts.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const fail = (msg) => { console.error(`build.mjs: ${msg}`); process.exit(2); };
// the first 8 hex of a file's SHA-256: its cache-busting name part
const hash8 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 8);

const patchPath = flag("--patch") ?? "patch.json";
const outDir = resolve(flag("--out") ?? "site");
if (!existsSync(patchPath)) fail(`patch file not found: ${patchPath} (run roll.mjs first)`);
const dice = JSON.parse(readFileSync(join(here, "dice.json"), "utf8"));
let patch;
try { patch = JSON.parse(readFileSync(patchPath, "utf8")); } catch (e) { fail(`${patchPath} is not valid JSON: ${e.message}`); }

const byId = (list, id, what) => list.find((x) => x.id === id) ?? fail(`unknown ${what} "${id}" in ${patchPath}; valid: ${list.map((x) => x.id).join(", ")}`);
if (!/^[0-9a-f]{8}$/.test(String(patch.seed))) fail(`seed must be 8 lowercase hex characters`);
const scene = byId(dice.scenes, patch.scene, "scene");
const event = byId(dice.events, patch.event, "event");
const quirk = byId(dice.quirks, patch.quirk, "quirk");
const signature = byId(dice.varieties, patch.signature, "signature variety");
// The secret is roll.mjs's 5th draw from the seed (same mulberry32, same order).
function seededSecret(seed) {
  let a = parseInt(seed, 16);
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 4; i++) rnd(); // scene, event, quirk, signature
  return dice.secrets[Math.floor(rnd() * dice.secrets.length)].id;
}
const secret = byId(dice.secrets, patch.secret || seededSecret(patch.seed), "secret variety");

// Creator text: optional, trimmed, single line, length-capped by dice.json limits.
const text = (v, max, field) => {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") fail(`${field} must be a string`);
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if ([...s].length > max) fail(`${field} is ${[...s].length} characters; max ${max}: "${s}"`);
  return s;
};
const L = dice.limits;
const name = text(patch.name, L.name, "name") || scene.patchName || dice.namePattern.replace("{Scene}", scene.name);
const owner = text(patch.owner, L.owner, "owner");
const tagline = text(patch.tagline, L.tagline, "tagline") || dice.defaultTagline;
const welcome = text(patch.welcome, L.welcome, "welcome");
const blurbs = patch.blurbs && typeof patch.blurbs === "object" ? patch.blurbs : {};
for (const k of Object.keys(blurbs)) {
  if (dice.varieties.some((v) => v.id === k) || k === secret.id) continue;
  if (dice.secrets.some((v) => v.id === k)) fail(`blurbs has "${k}", but this patch's secret is "${secret.id}"; rename that key`);
  fail(`blurbs has unknown variety "${k}"`);
}
// "Maya's Scarecrow Field" (a leading "The" goes when the owner's name comes first), or just the patch name
// (also when the name already says whose it is: "899 的南瓜田", not "899's 899 的南瓜田").
const ownerInName = nameHasOwner(name, owner);
const credit = owner && !ownerInName ? `${owner}'s ${name.replace(/^the\s+/i, "")}` : name;
// the creator's words in a script Creepster / Gochi Hand can't draw get a matching web font, subset to their characters
const fonts = scriptFonts({ name, welcome, owner });
let growYourOwnUrl = flag("--grow-url") ?? patch.growYourOwnUrl ?? dice.growYourOwnUrl;
if (!/^https?:\/\/[^\s"<>]+$/i.test(growYourOwnUrl)) fail(`growYourOwnUrl must be an http(s) URL`);
// --brand: brand.mjs output. Its icons, manifest and og images go to the site root and its <head> link tags are
// injected; with --url (the live host) og:image becomes <url>/og.png. An explicit --og-image still wins.
const brandDir = flag("--brand") === undefined ? undefined : resolve(flag("--brand"));
const liveUrl = flag("--url")?.replace(/\/+$/, "");
if (liveUrl !== undefined && !/^https:\/\/[^\s"<>\/]+(\/[^\s"<>]*)?$/i.test(liveUrl)) fail(`--url must be the live https URL, got "${liveUrl}"`);
const BRAND_FILES = ["favicon.ico", "favicon.svg", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "site.webmanifest", "og.png", "head.html"];
// the brand files that also keep their fixed name at the site root (site.webmanifest is written from its hashed twin)
const ROOT_BRAND = ["og.png", "favicon.ico", "apple-touch-icon.png"];
if (brandDir) for (const f of BRAND_FILES) if (!existsSync(join(brandDir, f))) fail(`--brand ${brandDir} has no ${f}; run brand.mjs first`);
const ogImage = flag("--og-image") ?? (brandDir && liveUrl ? `${liveUrl}/og.png?v=${hash8(readFileSync(join(brandDir, "og.png")))}` : undefined);
// The brand files the <head> and the manifest reference, as hashed copies: name -> { file, buf }. The manifest's own
// hash is taken after its icon paths are rewritten to the hashed icons.
const hashedName = (f, buf) => f.replace(/(\.[a-z]+)$/, `.${hash8(buf)}$1`);
const brandOut = new Map();
if (brandDir) {
  for (const f of ["favicon.ico", "favicon.svg", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]) {
    const buf = readFileSync(join(brandDir, f)); brandOut.set(f, { file: hashedName(f, buf), buf });
  }
  let manifest;
  try { manifest = JSON.parse(readFileSync(join(brandDir, "site.webmanifest"), "utf8")); } catch (e) { fail(`${brandDir}/site.webmanifest is not valid JSON: ${e.message}`); }
  for (const ic of manifest.icons || []) if (brandOut.has(ic.src)) ic.src = brandOut.get(ic.src).file;
  const buf = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  brandOut.set("site.webmanifest", { file: hashedName("site.webmanifest", buf), buf });
}
if (ogImage !== undefined && !/^https:\/\/[^\s"<>]+$/i.test(ogImage)) fail(`--og-image must be an absolute https URL`);

// The owner's showcase: a share link (or its p= part) from THIS patch, checked with the page's own link rules
// (the template's //@link-rules block, run here as-is), so build and page can never disagree about a link.
const template = readFileSync(join(here, "template", "index.html"), "utf8");
const rules = (() => {
  const m = /\/\/@link-rules-start\n([\s\S]*?)\/\/@link-rules-end/.exec(template);
  if (!m) fail("template has no //@link-rules block");
  const VAR = new Map([...dice.varieties, secret].map((v) => [v.id, v]));
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // VARIETY_ORDER: what a v4 link's variety index means (the page builds the same list from its config)
  const VARIETY_ORDER = [...dice.varieties.map((v) => v.id), ...dice.secrets.map((v) => v.id)];
  return new Function("VAR", "has", "SECRET_IDS", "VARIETY_ORDER", `${m[1]}\nreturn { validate, parsePayload, encodeV4, MAX, FRAG_RE };`)(VAR, has, dice.secrets.map((v) => v.id), VARIETY_ORDER);
})();
const varietyName = (id) => (dice.varieties.find((v) => v.id === id) || dice.secrets.find((v) => v.id === id) || { name: id }).name;
function decodeShowcase(input, where) {
  const s = String(input).trim(), m = /#p=([^#\s]*)/.exec(s) || /^p=(\S*)$/.exec(s), frag = m ? m[1] : s;
  const bad = (why) => fail(`${where} is not a pumpkin link from this patch: ${why}`);
  if (!rules.FRAG_RE.test(frag)) bad("expected a link with #p=… in it (or just the part after p=)");
  let raw, obj;
  try { raw = new Uint8Array(inflateRawSync(Buffer.from(frag, "base64url"), { maxOutputLength: rules.MAX.inflated })); }
  catch (e) { bad(`it doesn't decode (${e.code || e.message}); was the link cut short when it was copied?`); }
  try { obj = rules.parsePayload(raw); } catch (_) { bad("it doesn't decode to a pumpkin"); }
  let sc;
  try { sc = { frag, v: obj.v, ...rules.validate(obj) }; }
  catch (e) {
    const why = String(e.message).replace(/^invalid: /, "");
    if (why === "foreign secret" || why === "variety") bad(`its pumpkin ("${String(obj.variety)}") doesn't grow in this patch; carve one here and use that link`);
    bad(`its ${why} is invalid`);
  }
  // the owner's own carving can't be cut from the owner's stencil: that stencil IS the showcase being replaced
  if (sc.stencil === "owner") bad("it was carved with the owner's stencil (the current showcase); carve the new showcase freehand or with a built-in stencil");
  return sc;
}
if (flag("--showcase") !== undefined) {
  const sc = decodeShowcase(flag("--showcase"), "--showcase");
  // a link from before v4 (JSON, every cut spelled out) is stored as the compact v4 payload: the landing's link to it
  // gets that much shorter. Only for a NEW showcase: re-encoding a saved one would change its hash, which old
  // owner-stencil links carry.
  if (sc.v !== 4) {
    const bytes = rules.encodeV4({ variety: sc.variety, pseed: sc.pseed, strokes: sc.strokes, texts: sc.texts.map((t) => ({ ...t, st: false })), from: sc.from, msg: sc.msg });
    const frag = deflateRawSync(Buffer.from(bytes)).toString("base64url");
    console.log(`Re-encoded the showcase link as v4: ${sc.frag.length} -> ${frag.length} characters after #p=`);
    sc.frag = decodeShowcase(frag, "--showcase (re-encoded)").frag;
  }
  patch.showcase = sc.frag;
  writeFileSync(`${patchPath}.tmp`, JSON.stringify(patch, null, 2) + "\n");
  renameSync(`${patchPath}.tmp`, patchPath);
  console.log(`Saved the showcase to ${patchPath}: ${varietyName(sc.variety)}, ${sc.stencil ? `the ${sc.stencil} stencil + ` : ""}${sc.strokes.length} strokes, ${sc.texts.length} carved word(s)`);
}
if (patch.showcase !== undefined && patch.showcase !== null && typeof patch.showcase !== "string") fail(`showcase must be a string (the p= part of a link)`);
const showcase = patch.showcase ? decodeShowcase(patch.showcase, `${patchPath} "showcase"`) : null;

// Art is WebP; copy only what this patch uses.
// Stand-in art carries the XMP marker "pumpkin-patch-placeholder" (see PLACEHOLDERS.txt); dropping the
// real WebP at the same path swaps it in and silences the warning.
const PLACEHOLDER = Buffer.from("pumpkin-patch-placeholder");
const placeholders = [];
const findArt = (dir, id) => {
  const p = join(here, "art", dir, `${id}.webp`);
  if (!existsSync(p)) fail(`missing art: art/${dir}/${id}.webp`);
  const buf = readFileSync(p);
  const placeholder = buf.includes(PLACEHOLDER);
  if (placeholder) placeholders.push(`art/${dir}/${id}.webp`);
  return { src: p, rel: `art/${dir}/${id}.${hash8(buf)}.webp`, placeholder, size: webpSize(buf) };
};
// Pixel size from the WebP header (VP8X / VP8L / VP8), so sprites keep their aspect ratio in the page.
function webpSize(b) {
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === "VP8L") { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
  if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return [1, 1];
}
// Optional art/<dir>/<id>.json next to a sprite: where its eyes or tail are, for the blink / tail flick.
// It describes one particular drawing, so it only applies while its "forPlaceholder" matches the file.
const spriteMeta = (a) => {
  const p = join(here, "art", a.dir, `${a.id}.json`);
  if (!existsSync(p)) return undefined;
  try { const m = JSON.parse(readFileSync(p, "utf8")); return !!m.forPlaceholder === a.placeholder ? m : undefined; } catch { return undefined; }
};
const UI_ICONS = ["seed", "watering-can", "pumpkin", "knife", "candle", "send"];
const EVENT_ART = {
  "full-moon": [["fx", "moon"]],
  "crow-visit": [["fx", "crow-fly"]],
  thunderstorm: [["fx", "storm-cloud"], ["fx", "lightning"]],
  "shooting-star": [],
  "firefly-swarm": [["sprites", "firefly"]],
  "ghost-parade": [["sprites", "ghost"]],
};
const QUIRK_ART = {
  "waving-vines": [["fx", "vine"]],
  "sneezing-pumpkins": [],
  "midnight-glow": [],
  "hooting-owl": [["sprites", "owl"]],
  "black-cat": [["sprites", "black-cat"]],
};
// Sticker icons for the controls: every art/ui/<name>.webp that exists ships and replaces that icon's SVG fallback
// (the template's ICONS map). The match for the video clip: unlit -> struck -> lit, its flame and the matchbox.
const UI_ART = existsSync(join(here, "art", "ui")) ? readdirSync(join(here, "art", "ui")).filter((f) => /^[a-z0-9-]+\.webp$/.test(f)).map((f) => f.slice(0, -5)).sort() : [];
const MATCH_ART = { unlit: "match-unlit", lit: "match-lit", flame: "flame", box: "matchbox" };
// The plant step: the dug soil the seed goes in, the glowing ring round it and the tapping glove (the idle cue).
const PLANT_ART = { dig: "dig-spot", ring: "glow-ring", hand: "tap-hand" };
if (!EVENT_ART[event.id]) fail(`build.mjs has no art list for event "${event.id}"`);
if (!QUIRK_ART[quirk.id]) fail(`build.mjs has no art list for quirk "${quirk.id}"`);
const wanted = [
  ...dice.varieties.map((v) => ["varieties", v.id]),
  ...dice.stages.map((s) => ["stages", s]),
  ["secrets", secret.id],
  ["scenes", scene.id],
  ...[...new Set([...UI_ICONS, event.icon, quirk.icon])].map((i) => ["icons", i]),
  ...EVENT_ART[event.id], ...QUIRK_ART[quirk.id],
  ...UI_ART.map((n) => ["ui", n]),
  ...Object.values(MATCH_ART).map((n) => ["fx", n]),
  ...Object.values(PLANT_ART).map((n) => ["fx", n]),
];
const art = wanted.map(([dir, id]) => ({ dir, id, ...findArt(dir, id) }));
const rel = (dir, id) => art.find((a) => a.dir === dir && a.id === id).rel;
const focus = Number.isFinite(scene.focus) ? Math.min(1, Math.max(0, scene.focus)) : 0.5;
// ground: where the open soil starts in the scene art (0-1 of its height); the grow plot stands just below it
const ground = Number.isFinite(scene.ground) ? Math.min(0.95, Math.max(0.3, scene.ground)) : 0.64;

// Everything the page AND check.mjs need lives in this config, so check.mjs works when it is
// copied alone into a project folder (no sibling dice.json).
const config = {
  version: dice.version,
  seed: patch.seed,
  name, owner, ownerInName, tagline, welcome, credit, growYourOwnUrl,
  // font stacks for the creator's own words (absent for Latin): name in the display face, note + owner handwritten
  fonts: fonts.stacks,
  hashtag: dice.hashtag,
  scene: { id: scene.id, name: scene.name, palette: scene.palette, focus, ground, image: rel("scenes", scene.id) },
  event: { id: event.id, name: event.name, icon: rel("icons", event.icon), chip: event.chip, caption: event.caption },
  quirk: { id: quirk.id, name: quirk.name, icon: rel("icons", quirk.icon), chip: quirk.chip },
  signature: signature.id,
  signatureMultiplier: dice.signatureMultiplier,
  // The patch's own secret: a flat share of every harvest that no weather changes. secretIds lets the page tell
  // a friend who opens ANOTHER patch's secret why it won't grow here.
  secret: { id: secret.id, name: secret.name, tier: dice.secretTier.id, chance: dice.secretTier.chance,
    blurb: text(blurbs[secret.id], L.blurb, `blurbs.${secret.id}`) || secret.blurb, image: rel("secrets", secret.id) },
  secretIds: dice.secrets.map((v) => v.id),
  showcase: showcase && { frag: showcase.frag, variety: showcase.variety, pseed: showcase.pseed, ...(showcase.stencil ? { stencil: showcase.stencil } : {}), strokes: showcase.strokes, texts: showcase.texts },
  tiers: dice.tiers,
  eventIds: dice.events.map((e) => e.id),
  // a weather's tierMultipliers scale that tier's share of every harvest (x2 = exactly twice as likely)
  eventMods: Object.fromEntries(dice.events.filter((e) => e.tierMultipliers).map((e) => [e.id, e.tierMultipliers])),
  varieties: dice.varieties.map((v) => ({
    id: v.id, name: v.name, tier: v.tier,
    blurb: text(blurbs[v.id], L.blurb, `blurbs.${v.id}`) || v.blurb,
    image: rel("varieties", v.id),
  })),
  stages: Object.fromEntries(dice.stages.map((s) => [s, rel("stages", s)])),
  icons: Object.fromEntries(UI_ICONS.map((i) => [i, rel("icons", i)])),
  ui: Object.fromEntries(UI_ART.map((n) => [n, rel("ui", n)])),
  match: Object.fromEntries(Object.entries(MATCH_ART).map(([k, n]) => [k, rel("fx", n)])),
  plant: Object.fromEntries(Object.entries(PLANT_ART).map(([k, n]) => [k, rel("fx", n)])),
  art: Object.fromEntries([...EVENT_ART[event.id], ...QUIRK_ART[quirk.id]].map(([d, id]) => [id, rel(d, id)])),
  sprites: Object.fromEntries([...EVENT_ART[event.id], ...QUIRK_ART[quirk.id]].map(([d, id]) => {
    const a = art.find((x) => x.dir === d && x.id === id);
    return [id, { w: a.size[0], h: a.size[1], meta: spriteMeta(a) }];
  })),
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// JSON inside <script>: neutralise "</script", "<!--" and the JS line separators.
const json = JSON.stringify(config).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const title = owner && !ownerInName ? `${name} · ${owner}'s pumpkin patch` : ownerInName ? `${name} · pumpkin patch` : name;
const ogTitle = `${credit}: grow a pumpkin, carve it, send it 🎃`;
const description = owner && !ownerInName ? `${owner}'s pumpkin patch, ${name}. ${tagline}` : `${name}. ${tagline}`;

const SYSTEM_STACK = `system-ui,-apple-system,"PingFang TC","Hiragino Sans","Noto Sans CJK TC","Microsoft JhengHei",sans-serif`;
function scriptFontTags(f) {
  if (!f.href) return "";
  // the script face first, then the page's own face and the system's for that script (if the font can't load)
  const v = (k, css, rest) => (f.stacks[k] ? `--${css}-font:${f.stacks[k].family},${rest};--${css}-weight:${f.stacks[k].weight};` : "");
  const hand = `"Gochi Hand",${SYSTEM_STACK}`;
  return `<link href="${esc(f.href)}" rel="stylesheet">\n<style>:root{${v("name", "name", `"Creepster",${SYSTEM_STACK}`)}${v("welcome", "note", hand)}${v("owner", "owner", hand)}}</style>`;
}
let html = template;
// Each scene has a music theme in the template's THEMES table; a scene without one falls back to the graveyard's.
const themeWarning = new RegExp(`"${scene.id}":\\s*\\{[^}\\n]*\\bkey:`).test(html) ? "" : `  WARNING: the template has no music theme for scene "${scene.id}"; it will play the moonlit-graveyard theme.`;
const slots = {
  "{{TITLE}}": esc(title),
  "{{OG_TITLE}}": esc(ogTitle),
  "{{DESCRIPTION}}": esc(description),
  "{{THEME_COLOR}}": esc(scene.palette.bg),
  "{{TWITTER_CARD}}": ogImage ? "summary_large_image" : "summary",
  // the script faces' stylesheet and the font stacks the page's CSS reads (--name-font, --note-font, --owner-font)
  "<!--{{SCRIPT_FONTS}}-->": scriptFontTags(fonts),
  "<!--{{OG_IMAGE}}-->": ogImage
    ? `<meta property="og:image" content="${esc(ogImage)}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:image" content="${esc(ogImage)}">`
    : "",
};
if (brandDir) {
  // brand.mjs writes the full tag set; take its <link> tags always, its image alt/type only when og:image is set
  // (og:image, its size and twitter:card already come from the slots above).
  const tags = readFileSync(join(brandDir, "head.html"), "utf8").split("\n").filter((l) =>
    l.startsWith("<link ") || (ogImage && /property="og:image:(alt|type)"|name="twitter:image:alt"/.test(l)))
    .map((l) => l.replace(/ href="([^"]+)"/, (m, f) => { if (!brandOut.has(f)) fail(`brand head.html links ${f}, which build.mjs doesn't ship`); return ` href="${brandOut.get(f).file}"`; }));
  slots["<!--{{OG_IMAGE}}-->"] = [slots["<!--{{OG_IMAGE}}-->"], ...tags].filter(Boolean).join("\n");
}
for (const [k, v] of Object.entries(slots)) {
  if (!html.includes(k)) fail(`template is missing slot ${k}`);
  html = html.split(k).join(v);
}
if (html.split("{{PATCH_CONFIG}}").length !== 2) fail("template must contain {{PATCH_CONFIG}} exactly once");
html = html.replace("{{PATCH_CONFIG}}", () => json);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), html);
for (const a of art) {
  mkdirSync(join(outDir, dirname(a.rel)), { recursive: true });
  copyFileSync(a.src, join(outDir, a.rel));
}
if (brandDir) {
  for (const f of ROOT_BRAND) copyFileSync(join(brandDir, f), join(outDir, f));
  // the root site.webmanifest gets the same hashed icon paths as its hashed twin
  for (const [f, { file, buf }] of brandOut) { writeFileSync(join(outDir, file), buf); if (f === "site.webmanifest") writeFileSync(join(outDir, f), buf); }
}
console.log(`Built ${name} (seed ${patch.seed}) -> ${outDir}`);
console.log(`  ${art.length} art files (content-hashed names), scene ${scene.id}, event ${event.id}, quirk ${quirk.id}, signature ${signature.id}, secret ${secret.id}${patch.secret ? "" : " (from the seed)"}`);
console.log(`  credit "${credit}"${welcome ? ", welcome note" : ""}${fonts.faces.length ? `, script fonts: ${fonts.faces.map((x) => `${x.family} ${x.weight}`).join(", ")}` : ""}${showcase ? `, showcase: ${varietyName(showcase.variety)}` : ""}`);
if (brandDir) console.log(`  brand: icons, manifest and og.png from ${brandDir}${ogImage ? `, og:image ${ogImage}` : " (no --url, so no og:image tag yet)"}`);
if (themeWarning) console.warn(themeWarning);
if (placeholders.length) {
  console.warn(`  WARNING: ${placeholders.length} placeholder art file(s) shipped (see PLACEHOLDERS.txt):`);
  for (const p of placeholders) console.warn(`    ${p}`);
}
