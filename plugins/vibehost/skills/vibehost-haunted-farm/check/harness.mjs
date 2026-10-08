// Haunted Farm checks — the harness: flags, the local server (with the site's
// vibehost.json rewrites), Playwright and the browser, the mocked App Data
// SDK (mock-sdk.js, served in place of /__vh/data/sdk.js), open() / ready() /
// check() / guarded(), and the small page helpers every suite shares.
import { fillSharedSlot } from "../template/shared.js";
import { H, NOW } from "./fixtures.mjs";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const t0 = Date.now();
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const site = resolve(flag("--site") ?? "site");
const shots = resolve(flag("--shots") ?? "preview");
const die = (msg) => {
  console.error(`check.mjs: ${msg}`);
  process.exit(2);
};
if (!existsSync(join(site, "index.html"))) die(`no index.html in ${site}`);
mkdirSync(shots, { recursive: true });
const SHOTS = [
  "phone-my-farm.png",
  "desktop-my-farm.png",
  "phone-map.png",
  "desktop-map.png",
  "phone-map-crowd.png",
  "phone-map-district-2.png",
  "phone-9th-farmer.png",
  "phone-moved-out.png",
  "desktop-feed-bar.png",
  "desktop-feed-open.png",
  "desktop-farm-feed.png",
  "phone-feed-sheet.png",
  "phone-compact-header.png",
  "phone-header.png",
  "tut-1-plant.png",
  "tut-2-village.png",
  "tut-3-steal.png",
  "tut-4-guard.png",
  "tut-5-harvest.png",
  "tut-desktop-plant.png",
  "desktop-header.png",
  "desktop-hud-tip.png",
  "phone-hud-tip.png",
  "phone-newcomer-in-gap.png",
  "phone-bob-farm.png",
  "phone-setup.png",
  "phone-village-spectator.png",
  "phone-village-resting.png",
  "phone-how-to-play-signed-out.png",
  "phone-how-to-play-not-member.png",
  "phone-how-to-play-password.png",
  "phone-how-to-play-resting.png",
  "phone-tryout.png",
  "desktop-tryout.png",
  "phone-tryout-districts.png",
  "phone-mid-pull.png",
  "phone-caught.png",
  "phone-away.png",
  "phone-away-card.png",
  "desktop-away-card.png",
  "phone-steal-feedback.png",
  "phone-guard-chip.png",
  "phone-boo.png",
  "phone-trap-card.png",
  "phone-slipped-past.png",
  "desktop-rules.png",
  "phone-map-pips.png",
  "phone-settings-menu.png",
  "desktop-settings-menu.png",
  "phone-how-to-play-rules.png",
  "desktop-how-to-play-rules.png",
  "phone-thief-marks.png",
  "phone-thief-popover.png",
  "phone-custom-face-map.png",
  "phone-farm-4x4.png",
  "phone-expand-chip.png",
  "phone-invite-card.png",
  "desktop-invite-card.png",
];
for (const f of SHOTS) rmSync(join(shots, f), { force: true });

// ---------- Playwright + browser (same chain as pumpkin-patch) ----------
async function loadPlaywright() {
  const tries = [];
  if (flag("--playwright")) tries.push(resolve(flag("--playwright")));
  const req = createRequire(join(process.cwd(), "noop.js"));
  for (const m of ["playwright-core", "playwright"]) {
    try {
      tries.push(req.resolve(m));
    } catch (_) {
      /* not installed here */
    }
  }
  for (const t of tries) {
    try {
      const m = await import(pathToFileURL(statSync(t).isDirectory() ? join(t, "index.js") : t).href);
      const pw = m.chromium ? m : m.default;
      if (pw && pw.chromium) return pw;
    } catch (_) {
      /* next */
    }
  }
  die("Playwright not found. In this project folder run:\n  npm i playwright-core\nthen run check.mjs again.");
}
async function launch(chromium) {
  const errors = [];
  const chain = [
    ["chrome", "Google Chrome", { channel: "chrome" }],
    ["chromium", "Playwright Chromium", { channel: "chromium" }],
    ["shell", "Playwright headless shell", {}],
  ];
  const from = chain.findIndex(([id]) => id === (flag("--browser") ?? "chrome"));
  if (from < 0) die("--browser takes chrome, chromium or shell");
  for (const [, label, opts] of chain.slice(from)) {
    try {
      const b = await chromium.launch(opts);
      return { browser: b, label: `${label} ${b.version()}` };
    } catch (e) {
      errors.push(`${label}: ${String(e.message).split("\n")[0]}`);
    }
  }
  die(`no browser could start.\n  ${errors.join("\n  ")}\nIf Google Chrome isn't installed, run: npx playwright-core install --only-shell chromium`);
}
const { chromium } = await loadPlaywright();

// ---------- static server (with the site's vibehost.json rewrites) ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".json": "application/json" };
// Same matching the VibeHost dispatcher does for 200 rewrites: exact paths,
// or a prefix ending in "*" ("/farm/:slug*" is stored as "/farm/*").
const REWRITES = (() => {
  const p = join(site, "vibehost.json");
  if (!existsSync(p)) return [];
  const cfg = JSON.parse(readFileSync(p, "utf8"));
  return (cfg.rewrites || []).map((r) => ({ from: r.source.replace(/\/:[\w]+\*$/, "/*"), to: r.destination }));
})();
function rewrite(path) {
  const p = path === "/" ? "/" : path.replace(/\/+$/, "");
  for (const r of REWRITES) {
    if (r.from.endsWith("*") ? p.startsWith(r.from.slice(0, -1)) : p === r.from) return r.to;
  }
  return path;
}
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const direct = normalize(join(site, path.endsWith("/") ? path + "index.html" : path));
  if (!existsSync(direct) || !statSync(direct).isFile()) path = rewrite(path);
  const file = normalize(join(site, path.endsWith("/") ? path + "index.html" : path));
  if (!(file + sep).startsWith(site + sep) && file !== site) return void res.writeHead(403).end();
  if (!existsSync(file) || !statSync(file).isFile()) return void res.writeHead(404).end("not found");
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ---------- the mock App Data SDK (one fake: mock-sdk.js) ----------
/** The skill folder (check.mjs, mock-sdk.js, art/). */
const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOCK_PATH = join(SKILL_DIR, "mock-sdk.js");
if (!existsSync(MOCK_PATH)) die(`mock-sdk.js not found at ${MOCK_PATH} — run check.mjs from the skill folder, as is`);
const MOCK_SDK = fillSharedSlot(readFileSync(MOCK_PATH, "utf8"));
const CFG = JSON.parse(/<script id="village" type="application\/json">([\s\S]*?)<\/script>/.exec(readFileSync(join(site, "index.html"), "utf8"))?.[1] ?? die("site/index.html has no village config; rebuild it with build.mjs"));
const IS_MOCK = !!CFG.mock;
console.log(`check.mjs: ${IS_MOCK ? `try-out (--mock) build, speed ${CFG.mock.speed}` : "normal build"}`);

// ---------- harness ----------
const results = [];
let TOTAL = 0;
/** How many checks this run makes (for the [n/total] counter). */
const plan = (n) => (TOTAL = n);
const check = (name, ok, details) => {
  results.push({ name, ok: !!ok, details });
  console.log(`[${results.length}/${Math.max(TOTAL, results.length)}] ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok || args.includes("--verbose")) console.log("      " + JSON.stringify(details));
};
const FONTS = /fonts\.(googleapis|gstatic)\.com/;
// The real fonts (Jersey 10 + Space Mono), fetched once per run and served
// from memory, so every fixed-height budget is measured with the glyphs a
// player sees. Offline (or --no-fonts) they're blocked and the fallback
// monospace is measured instead; the run says so.
const fontCache = new Map();
let fontsOffline = args.includes("--no-fonts");
async function serveFont(route) {
  if (fontsOffline) return route.abort();
  const url = route.request().url();
  try {
    if (!fontCache.has(url)) {
      fontCache.set(
        url,
        fetch(url, { headers: { "user-agent": route.request().headers()["user-agent"] }, signal: AbortSignal.timeout(8000) }).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { contentType: res.headers.get("content-type") || "", body: Buffer.from(await res.arrayBuffer()) };
        }),
      );
    }
    const f = await fontCache.get(url);
    await route.fulfill({ status: 200, contentType: f.contentType, body: f.body, headers: { "access-control-allow-origin": "*" } });
  } catch (e) {
    fontCache.delete(url);
    if (!fontsOffline) console.log(`check.mjs: fonts unreachable (${e.message}) — measuring with the fallback monospace`);
    fontsOffline = true;
    await route.abort();
  }
}
const { browser, label } = await launch(chromium);
console.log(`check.mjs: ${label}`);

async function open(viewport, scenario, path = "", { rest = false, reducedMotion = "no-preference", init = [], rules = null, permissions = [] } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, reducedMotion });
  if (permissions.length) await ctx.grantPermissions(permissions, { origin: BASE.slice(0, -1) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000); // a missing element fails in seconds, not 30
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  if (args.includes("--verbose")) page.on("console", (m) => console.log(`      [page ${m.type()}] ${m.text()}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !FONTS.test(m.text()) && !FONTS.test(m.location()?.url ?? "") && !/__vh\/data\/sdk\.js/.test(m.location()?.url ?? "") && !/404/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !FONTS.test(r.url()) && !r.url().includes("/__vh/data/sdk.js")) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  await page.route(FONTS, serveFont);
  await page.route("**/__vh/data/sdk.js", (r) =>
    rest ? r.fulfill({ status: 404, body: "not found" }) : r.fulfill({ status: 200, contentType: "text/javascript", body: MOCK_SDK }),
  );
  if (scenario) await page.addInitScript((s) => (window.__HF_SCENARIO = s), scenario);
  await page.addInitScript(ICON_TEXT);
  // As if village.json had these rules: the same pages, other config.
  if (rules)
    await page.route((u) => u.href.startsWith(BASE) && !/\.(js|png|json)$/.test(u.pathname), async (r) => {
      const res = await r.fetch();
      const body = (await res.text()).replace(/(<script id="village" type="application\/json">)([\s\S]*?)(<\/script>)/, (_, a, json, b) => a + JSON.stringify({ ...JSON.parse(json), rules }).replace(/</g, "\\u003c") + b);
      await r.fulfill({ response: res, body });
    });
  for (const [fn, arg] of init) await page.addInitScript(fn, arg);
  await page.goto(BASE + path.replace(/^\//, ""));
  return { page, ctx, errors };
}
// An element's text with each pixel icon written as [name] (the UI
// shows sprites, never emoji), so checks can say which icon sits where.
const ICON_TEXT = () => {
  window.__iconText = (el) => {
    if (!el) return undefined;
    const c = el.cloneNode(true);
    c.querySelectorAll("img.ico").forEach((i) => i.replaceWith(`[${i.dataset.icon || i.alt}]`));
    return c.textContent;
  };
};
// Custom avatars / skins are shown only once their pixels pass; wait for every check.
const pngsSettled = (page) =>
  page.waitForFunction(() => ![...(window.__hauntedFarmPng?.values() ?? [])].includes("pending") && ![...(window.__hauntedFarmArt?.values() ?? [])].some((a) => a.loading), null, { timeout: 5000 });
const RULES_OFF = { customAvatar: false, expansion: { on: false, costs: [150, 400], maxCols: 4, maxRows: 4 }, cropSkins: false };
const ready = async (page) => {
  await page.waitForFunction(() => window.__hauntedFarm && window.__hauntedFarm.ready === true && document.readyState === "complete", null, { timeout: 8000 });
  // Measure with the fonts in place (display=swap would show the fallback first).
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 4000))]));
};
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const shot = (page, name) => page.screenshot({ path: join(shots, name), fullPage: true });
const viewShot = (page, name) => page.screenshot({ path: join(shots, name) });
// Centre a tile in the viewport (clear of the fixed try-out banner) and
// return its box: a raw mouse press, unlike click(), doesn't dodge overlays.
async function pressAt(page, selector) {
  const el = page.locator(selector).first();
  await el.evaluate((e) => e.scrollIntoView({ block: "center", inline: "center" }));
  return el.boundingBox();
}
// One tap on a tile, at its centre (every action is a single tap now).
async function tap(page, selector) {
  const b = await pressAt(page, selector);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  return b;
}
// A check whose steps throw (a selector never appears, a wait times out)
// is that check FAILING, not the whole run crashing.
async function guarded(name, fn) {
  // HF_ONLY=<words>: run only the checks whose name has them (while working on a few).
  if (process.env.HF_ONLY && !process.env.HF_ONLY.split("|").some((w) => name.includes(w))) return;
  const ref = {};
  try {
    await fn(ref);
  } catch (e) {
    check(name, false, { error: String(e.message).split("\n")[0] });
  } finally {
    await ref.ctx?.close().catch(() => {});
  }
}
// Tap a steal and, if it was a Trick, dismiss the card.
async function pullSteal(page, selector) {
  await tap(page, selector);
  await page.waitForTimeout(1200);
  if (await page.locator("dialog#trick[open]").count()) await page.click("#trick-go");
}
// Every dice roll comes up 0.99…: a steal is always a Trick.
const FORCE_TRICK = () => {
  crypto.getRandomValues = (a) => a.fill(0xffffffff);
};
// Every dice roll comes up 0: a steal is always a Treat.
const FORCE_TREAT = () => {
  crypto.getRandomValues = (a) => a.fill(0);
};
// Keep every risk hint shown (they come and go within a few hundred ms).
const RECORD_HINTS = () => {
  window.__hints = [];
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) if (n.id === "risk-hint") window.__hints.push(n.textContent);
  }).observe(document, { childList: true, subtree: true });
};
// Another newcomer wins the race for the first free lot: just before MY
// first lot claim lands, theirs is already in the store.
const RACE_FOR_GAP = () => {
  let real;
  Object.defineProperty(window, "VibeHostData", {
    configurable: true,
    get: () => real,
    set(v) {
      const connect = v.connect;
      real = {
        ...v,
        connect: () =>
          connect().then((vh) => {
            const put = vh.put;
            let raced = false;
            vh.put = (c, id, data, o) => {
              if (!raced && c.startsWith("lots-d")) {
                raced = true;
                sessionStorage.setItem("hf-raced", `${c}/${id}`); // survives the redirect to /
                (window.__HF_STORE[c] ??= {})[id] = { owner: "u_racer", version: 1, data: { userId: "u_racer" }, createdAt: new Date().toISOString() };
              }
              return put(c, id, data, o);
            };
            return vh;
          }),
      };
    },
  });
};
// ── sound ──
// Count AudioContexts made: none may exist before the first gesture.
const COUNT_AUDIO = () => {
  const AC = window.AudioContext;
  window.__acMade = 0;
  if (AC) window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__acMade++; } };
};
// The sfx log dies with the page; keep the names of a page we navigate away from.
const KEEP_SFX_ON_LEAVE = () => addEventListener("pagehide", () => sessionStorage.setItem("hf-sfx-left", JSON.stringify((window.__hauntedFarmSfx || []).map((e) => e.name))));
const sfxLog = (page) => page.evaluate(() => (window.__hauntedFarmSfx || []).map((e) => ({ name: e.name, played: e.played })));
const audio = (page) =>
  page.evaluate(async () => {
    // The very URL the page loaded (with its ?v= cache-buster): the same module instance.
    const url = performance.getEntriesByType("resource").map((r) => r.name).find((n) => /\/fx\.js(\?|$)/.test(n));
    const FX = await import(url);
    return { ready: FX.audioReady(), muted: FX.isMuted(), ambience: FX.ambienceOn(), playing: FX.ambiencePlaying(), gain: FX.ambienceGain() };
  });
const count = (names, n) => names.filter((x) => x === n).length;
// What one step makes heard: the sfx names logged while it runs.
async function heard(page, step, settle = 1300) {
  const n = (await sfxLog(page)).length;
  await step();
  await page.waitForTimeout(settle);
  return (await sfxLog(page)).slice(n).map((e) => e.name);
}
// A tap somewhere that does nothing but count as a gesture.
const gesture = async (page) => {
  const b = await page.locator("#title").boundingBox();
  await page.mouse.click(b.x + 4, b.y + 4);
};
// Count every time anything gets the "shake" class.
const COUNT_SHAKES = () => {
  window.__shakes = 0;
  new MutationObserver((ms) => {
    for (const m of ms) if (m.target.classList && m.target.classList.contains("shake")) window.__shakes++;
  }).observe(document, { attributes: true, attributeFilter: ["class"], subtree: true });
};
const STEAL = (owner, i) => `.farm[data-owner="${owner}"] button.tile[data-act="steal"]${i == null ? "" : `[data-i="${i}"]`}`;
// Layout the real art depends on: tile gutters; the scarecrow stands beside
// the field, never on a tile; the header is the framed (9-slice
// ui/frame.png) panel with the title inside; the theme scene is a layer
// behind the first screen, not a fixed body background.
const layout = (page) =>
  page.evaluate(() => {
    const box = (el) => el.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const tiles = [...document.querySelectorAll(".tile")].map(box);
    const crows = [...document.querySelectorAll(".farm .scarecrow")].map(box);
    const top = document.querySelector(".top");
    const title = box(document.getElementById("title"));
    const tb = box(top);
    const scene = document.querySelector(".scene");
    const firstRow = [...document.querySelectorAll(".farm .grid")][0]?.querySelectorAll(".tile");
    const tileGap = firstRow && firstRow.length > 1 ? box(firstRow[1]).left - box(firstRow[0]).right : 0;
    return {
      tileGap,
      scarecrows: crows.length,
      scarecrowOnTile: crows.filter((c) => tiles.some((t) => hit(c, t))).length,
      framed: /frame\.png/.test(getComputedStyle(top).borderImageSource),
      titleInPanel: title.left >= tb.left && title.right <= tb.right && title.top >= tb.top && title.bottom <= tb.bottom,
      scene: !!scene && /backgrounds\//.test(getComputedStyle(scene).backgroundImage),
      fixedBody: getComputedStyle(document.body).backgroundAttachment === "fixed",
    };
  });
const layoutOk = (l) => l.tileGap >= 2 && l.scarecrows >= 1 && l.scarecrowOnTile === 0 && l.framed && l.titleInPanel && l.scene && !l.fixedBody;
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const scan = (re, filter = /\.(html|js|json|webmanifest)$/) =>
  walk(site).flatMap((f) => {
    const rel = f.slice(site.length + 1);
    const m = re.exec(rel) || (filter.test(f) ? re.exec(readFileSync(f, "utf8")) : null);
    return m ? [`${rel}: ${m[0]}`] : [];
  });
// "Last seen" this long ago, set before the page loads: the away card shows what happened since.
const awaySeen = (ago = 2 * H) => [([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} }, [`haunted-farm:seen:${CFG.seed}:u_alice`, String(NOW - ago)]];
/** Close the browser and server; print the summary and exit 1 if anything failed. */
async function finish() {
  await browser.close();
  server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed in ${((Date.now() - t0) / 1000).toFixed(1)} s. Screenshots: ${shots}`);
  if (failed.length) {
    for (const f of failed) console.log(`FAIL ${f.name}: ${JSON.stringify(f.details)}`);
    process.exit(1);
  }
}
// Overflow anywhere: the page itself, or any box that scrolls sideways.
const sideways = (page) =>
  page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    boxes: [...document.querySelectorAll("body *")]
      .filter((el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.id || el.className),
  }));

export { args, audio, awaySeen, BASE, browser, CFG, check, count, COUNT_AUDIO, COUNT_SHAKES, DESKTOP, die, finish, FONTS, fontsOffline, FORCE_TREAT, FORCE_TRICK, gesture, guarded, heard, ICON_TEXT, IS_MOCK, KEEP_SFX_ON_LEAVE, layout, layoutOk, open, PHONE, plan, pngsSettled, pressAt, pullSteal, RACE_FOR_GAP, ready, RECORD_HINTS, RULES_OFF, scan, serveFont, sfxLog, shot, shots, sideways, site, SKILL_DIR, STEAL, tap, viewShot };
