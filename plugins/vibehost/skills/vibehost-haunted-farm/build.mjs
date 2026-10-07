#!/usr/bin/env node
// Builds the static village site from a rolled village.
//   node build.mjs --village village.json --out site/ [--url https://<live host>] [--workspace <slug>] [--mock [--speed 60]] [--playwright <path>]
// Output (exactly what gets deployed):
//   site/index.html         the village (config injected as <script id="village">)
//   site/how-to-play.html   the explainer for visitors who can't play
//   site/*.js, views/*.js   the page's ES modules: app.js (entry), engine.js
//                           (pure rules), fx.js (game feel) and the rest,
//                           each at a content-hashed URL via an import map
//   site/art/...            this village's background + every sprite
//   site/og.png             this village's link-preview card, 1200×630 (fixed name:
//                           crawlers ask for it); rendered with Playwright from
//                           the project folder, else the generic card
//   site/favicon.ico, favicon-16/32/48.png, apple-touch-icon.png, icon-192/512.png,
//   site/site.webmanifest   the icon set (art/ui/icons, from make-your-own/icons.mjs)
//   site/vibehost.json      rewrites /farm/* and /setup to index.html: one
//                           village, one link per farm. VibeHost
//                           reads it at deploy time and doesn't serve it.
// Every URL in the pages is root-absolute, because the same index.html is
// served at /farm/<slug>, where a relative "app.js" would miss.
// Cache busting: every reference carries ?v=<first 8 hex of the file's sha256>,
// so dropping real art over a placeholder is a new URL on the next deploy.
// The game talks to /__vh/data/* (App Data) on the live host; nothing here
// stores state.
// --mock builds a single-player TRY-OUT site for hosts where App Data is off:
// mock-sdk.js replaces /__vh/data/sdk.js (store in localStorage, a pretend
// neighbour, the clock ?speed= times faster — default --speed, 60) and a
// fixed banner says so, with a Reset link. Without --mock none of that is in
// the output at all; check.mjs asserts it.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { launchBrowser, loadChromium } from "./browser.mjs";
import { renderCard, villageCardHtml } from "./og.mjs";
import { fillSharedSlot } from "./template/shared.js";
import { normalizeRules } from "./village-rules.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const fail = (msg) => {
  console.error(`build.mjs: ${msg}`);
  process.exit(2);
};
const hash8 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 8);

const villagePath = flag("--village") ?? "village.json";
const outDir = resolve(flag("--out") ?? "site");
const liveUrl = flag("--url")?.replace(/\/+$/, "");
const workspace = flag("--workspace");
// The campaign landing page ("What it is: …" in the invite message).
const LANDING_URL = (flag("--landing") ?? "https://halloween-vibehost-official.vibehost.space").replace(/\/+$/, "");
if (!/^https:\/\/[^/]+$/.test(LANDING_URL)) fail(`--landing must be https://<host>, got "${LANDING_URL}"`);
if (workspace !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(workspace)) fail(`--workspace must be a workspace slug, got "${workspace}"`);
const mock = args.includes("--mock");
const speed = Number(flag("--speed") ?? 60);
if (!mock && flag("--speed") !== undefined) fail("--speed only applies to --mock builds");
if (!(speed > 0 && speed <= 3600)) fail(`--speed must be between 1 and 3600, got "${flag("--speed")}"`);
if (liveUrl && !/^https:\/\/[^/]+$/.test(liveUrl)) fail(`--url must be https://<host>, got "${liveUrl}"`);
if (!existsSync(villagePath)) fail(`village file not found: ${villagePath} (run roll.mjs first)`);

const dice = JSON.parse(readFileSync(join(here, "dice.json"), "utf8"));
let village;
try {
  village = JSON.parse(readFileSync(villagePath, "utf8"));
} catch (e) {
  fail(`${villagePath} is not valid JSON: ${e.message}`);
}
const byId = (list, id, what) => list.find((x) => x.id === id) ?? fail(`unknown ${what} "${id}"; valid: ${list.map((x) => x.id).join(", ")}`);
if (!/^[0-9a-f]{8}$/.test(String(village.seed))) fail("seed must be 8 lowercase hex characters");
const theme = byId(dice.themes, village.theme, "theme");
const weather = byId(dice.weathers, village.weather, "weather");
byId(dice.secrets, village.secret, "secret");
let villageRules;
try {
  villageRules = normalizeRules(village.rules);
} catch (e) {
  fail(`${villagePath} rules: ${e.message} (see village-rules.mjs)`);
}

const text = (v, max, field) => {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") fail(`${field} must be a string`);
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if ([...s].length > max) fail(`${field} is ${[...s].length} characters; max ${max}: "${s}"`);
  return s;
};
const name = text(village.name, dice.limits.name, "name") || theme.villageName;
const tagline = text(village.tagline, dice.limits.tagline, "tagline") || `A haunted ${theme.name.toLowerCase()} where neighbours grow — and pinch — pumpkins.`;

// ── art ───────────────────────────────────────────────────────────────
const artList = JSON.parse(readFileSync(join(here, "art/art.json"), "utf8")).files;
const wanted = artList.filter((f) => !f.path.startsWith("backgrounds/") || f.path === `backgrounds/${theme.id}.png`);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const art = {};
let placeholders = 0;
for (const f of wanted) {
  const src = join(here, "art", f.path);
  if (!existsSync(src)) fail(`missing art file art/${f.path} (run make-your-own/placeholders.mjs)`);
  const buf = readFileSync(src);
  if (buf.includes(Buffer.from("haunted-farm-placeholder"))) placeholders++;
  const dst = join(outDir, "art", f.path);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  art[f.path] = `/art/${f.path}?v=${hash8(buf)}`;
}
if (placeholders) console.warn(`build.mjs: warning: ${placeholders} placeholder art file(s) copied (see art/MANIFEST.md)`);
// ── link preview + icons ───────────────────────────────────────────────
// og.png: this village's own card (its map, name and tagline), rendered with
// Playwright like check.mjs uses it. Without Playwright (or a browser) the
// generic card ships instead, and the output says so.
const palette = JSON.parse(readFileSync(join(here, "art/palette.json"), "utf8")).colors;
let ogKind = "generic";
const chromium = await loadChromium(flag("--playwright"));
const browser = chromium && (await launchBrowser(chromium));
if (browser) {
  try {
    const { fonts } = await renderCard(browser, villageCardHtml({ name, tagline, art: (p) => join(here, "art", p), colors: palette }), join(outDir, "og.png"));
    ogKind = fonts ? "village" : "village (fonts offline: monospace)";
  } finally {
    await browser.close();
  }
} else {
  copyFileSync(join(here, "art/ui/og.png"), join(outDir, "og.png"));
  console.warn("build.mjs: warning: no Playwright here, so the generic link-preview card ships (npm i playwright-core, then build again)");
}
const og = readFileSync(join(outDir, "og.png"));
// The favicon set (make-your-own/icons.mjs) at the site root, where browsers look.
const ICONS = ["favicon.ico", "favicon-16.png", "favicon-32.png", "favicon-48.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
for (const f of ICONS) copyFileSync(join(here, "art/ui/icons", f), join(outDir, f));
const THEME = palette.void;
writeFileSync(
  join(outDir, "site.webmanifest"),
  JSON.stringify(
    {
      name,
      short_name: [...name].length <= 12 ? name : "Haunted Farm",
      description: tagline,
      start_url: "/",
      display: "standalone",
      theme_color: THEME,
      background_color: THEME,
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  join(outDir, "vibehost.json"),
  JSON.stringify(
    {
      rewrites: [
        { source: "/farm/:slug*", destination: "/index.html" },
        { source: "/setup", destination: "/index.html" },
      ],
    },
    null,
    2,
  ) + "\n",
);

// ── scripts ───────────────────────────────────────────────────────────
// The page is ES modules (app.js and the modules it imports, views/ too).
// Each ships as-is; an import map in index.html points every module at its
// content-hashed URL, so a change to any of them busts its cache.
const scripts = [];
const listJs = (dir) =>
  readdirSync(join(here, "template", dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listJs(join(dir, e.name)) : e.name.endsWith(".js") ? [join(dir, e.name).split(sep).join("/")] : [],
  );
const importMap = { imports: {} };
for (const rel of listJs("")) {
  const buf = readFileSync(join(here, "template", rel));
  mkdirSync(dirname(join(outDir, rel)), { recursive: true });
  writeFileSync(join(outDir, rel), buf);
  importMap.imports[`/${rel}`] = `/${rel}?v=${hash8(buf)}`;
  scripts.push(rel);
}
for (const must of ["app.js", "engine.js", "fx.js", "shared.js"]) if (!scripts.includes(must)) fail(`template/${must} is missing`);
const engine = readFileSync(join(here, "template/engine.js"));
let mockSdk = null;
if (mock) {
  mockSdk = Buffer.from(fillSharedSlot(readFileSync(join(here, "mock-sdk.js"), "utf8")));
  writeFileSync(join(outDir, "mock-sdk.js"), mockSdk);
}

// ── pages ─────────────────────────────────────────────────────────────
const config = {
  seed: village.seed,
  name,
  tagline,
  theme: theme.id,
  weather: weather.id,
  weatherName: weather.name,
  art,
  loginUrl: "https://app.vibehost.com/login",
  homeUrl: "https://vibehost.com",
  // Where a solo farmer goes to invite teammates (the workspace's members).
  membersUrl: workspace ? `https://app.vibehost.com/workspace/${workspace}/settings` : "https://app.vibehost.com",
  // The invite card: the village's own address and the landing page.
  villageUrl: liveUrl || null,
  landingUrl: LANDING_URL,
  installLine: 'Use the vibehost-haunted-farm skill to build my team a haunted farm on VibeHost.',
  // What this village allows (custom avatars, farm expansion, crop
  // skins) — set in village.json, so only a redeploy can change it.
  rules: villageRules,
  // The 16 colours a custom avatar / crop skin may use (the page checks every pixel).
  palette: Object.values(JSON.parse(readFileSync(join(here, "art/palette.json"), "utf8")).colors),
};
if (mock) config.mock = { speed, engine: `engine.js?v=${hash8(engine)}` };
// A </script> inside a string must not end the config block.
const configJson = JSON.stringify(config).replace(/</g, "\\u003c");
const escHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Absolute URLs once the live address is known (--url); scrapers need them.
const ogImage = `${liveUrl ?? ""}/og.png?v=${hash8(og)}`;
const ogAlt = `${name}: a Haunted Farm village map`;
/** The page's <head> extras: description, Open Graph, Twitter, icons. */
const headFor = (title, path) =>
  [
    `<meta name="description" content="${escHtml(tagline)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Haunted Farm">`,
    `<meta property="og:title" content="${escHtml(title)}">`,
    `<meta property="og:description" content="${escHtml(tagline)}">`,
    liveUrl ? `<meta property="og:url" content="${escHtml(liveUrl + path)}">` : "",
    `<meta property="og:image" content="${escHtml(ogImage)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escHtml(ogAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escHtml(title)}">`,
    `<meta name="twitter:description" content="${escHtml(tagline)}">`,
    `<meta name="twitter:image" content="${escHtml(ogImage)}">`,
    `<meta name="twitter:image:alt" content="${escHtml(ogAlt)}">`,
    `<meta name="theme-color" content="${THEME}">`,
    `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">`,
    `<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`,
    `<link rel="manifest" href="/site.webmanifest">`,
  ]
    .filter(Boolean)
    .join("\n");
const PAGES = { "index.html": { title: name, path: "/" }, "how-to-play.html": { title: `How to play · ${name}`, path: "/how-to-play.html" } };

// The rules table, written once (template/rules.html), shown both in the
// village's "How to play" overlay and on how-to-play.html.
// Its numbers come from the engine: __RULE:key__ → "30 min",
// __RULE:key:long__ → "30 minutes", __RULE:key:num__ → "30" (unit dropped).
const E = await import(pathToFileURL(join(here, "template/engine.js")).href);
const dur = (ms, form) => {
  const [n, unit, units] = ms % E.HOUR ? [ms / E.MIN, "min", "minutes"] : [ms / E.HOUR, "h", ms === E.HOUR ? "hour" : "hours"];
  return form === "num" ? String(n) : form === "long" ? `${n} ${units}` : `${n} ${unit}`;
};
const RULE_VALUES = {
  open: E.RULES.stealOpensAfterMs,
  steals: E.RULES.dailyStealCap,
  helps: E.RULES.dailyHelpCap,
  ...Object.fromEntries(
    Object.entries(E.RULES.kinds).flatMap(([k, v]) => [
      [`grow.${k}`, v.growMs],
      [`yield.${k}`, v.yield],
      [`off.${k}`, E.goingOffAfter(k)],
      [`rot.${k}`, E.rottenAfter(k)],
    ]),
  ),
};
const ruleText = (key, form) => {
  if (!(key in RULE_VALUES)) fail(`template/rules.html names __RULE:${key}__, which build.mjs doesn't know`);
  return /^(open|grow|off|rot)\b/.test(key) ? dur(RULE_VALUES[key], form) : String(RULE_VALUES[key]);
};
const RULES_HTML = readFileSync(join(here, "template/rules.html"), "utf8")
  .replace(/^<!--[\s\S]*?-->\n/, "")
  .replace(/__RULE:([\w.]+)(?::(long|num))?__/g, (_, key, form) => ruleText(key, form));

// Only ever written into --mock builds.
const TRYOUT_BANNER = `<style>
  #tryout { position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; padding: 8px 16px; text-align: center; font-size: 13px; line-height: 1.35; color: var(--void); background: var(--candle); border-top: 3px solid var(--void); }
  #tryout a { color: var(--void); font-weight: 700; margin-left: 8px; }
  body { padding-bottom: 56px; }
  #toast { bottom: 64px; }
</style>
<div id="tryout" role="note">Try-out mode — your farm lives in this browser only. Neighbours are pretend.<a href="#" id="tryout-reset">Reset</a></div>
<script>document.getElementById("tryout-reset").addEventListener("click", function (e) { e.preventDefault(); if (window.VibeHostData && window.VibeHostData.resetTryout) window.VibeHostData.resetTryout(); });</script>`;

for (const page of ["index.html", "how-to-play.html"]) {
  let html = readFileSync(join(here, "template", page), "utf8");
  for (const token of ["__TITLE__", "__VILLAGE__", "<!--HEAD-->", "<!--RULES-->"]) {
    if (!html.includes(token)) fail(`template/${page} lost its ${token} slot`);
  }
  if (page === "index.html" && !html.includes("<!--IMPORTMAP-->")) fail("template/index.html lost its <!--IMPORTMAP--> slot");
  const SDK_TAG = '<script src="/__vh/data/sdk.js"></script>';
  if (!html.includes(SDK_TAG)) fail(`template/${page} lost its App Data SDK tag`);
  // Replacer functions throughout: a string replacement would expand
  // "$&", "$'", "$`" or "$$" in a village's own name or tagline.
  const put = (token, value) => () => value;
  if (mock) html = html.replace(SDK_TAG, put(SDK_TAG, `<script src="/mock-sdk.js?v=${hash8(mockSdk)}"></script>`));
  html = html.replace("<!--TRYOUT-->", put("", mock && page === "index.html" ? TRYOUT_BANNER : ""));
  html = html.replace("<!--RULES-->", put("", RULES_HTML));
  html = html
    .replaceAll("__TITLE__", put("", escHtml(name)))
    .replace("__VILLAGE__", put("", configJson))
    .replace("<!--HEAD-->", put("", headFor(PAGES[page].title, PAGES[page].path)))
    .replace("<!--IMPORTMAP-->", put("", `<script type="importmap">${JSON.stringify(importMap)}</script>`))
    .replace("__APP_JS__", put("", importMap.imports["/app.js"]))
    // A sprite in static markup (the rules' icons, the settings menu): its cache-busted URL.
    .replace(/__ART:([\w/.-]+)__/g, (_, p) => art[p] ?? fail(`${page} names art/${p}, which art/art.json doesn't list`));
  writeFileSync(join(outDir, page), html);
}

console.log(JSON.stringify({ out: outDir, name, theme: theme.id, weather: weather.id, files: wanted.length + 5 + ICONS.length + scripts.length + (mock ? 1 : 0), placeholders, og: ogKind, url: liveUrl ?? null, mock, ...(mock ? { speed } : {}) }));
