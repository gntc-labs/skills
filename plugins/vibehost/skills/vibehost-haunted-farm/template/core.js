// Haunted Farm — what every module needs: the village config, the art and icon
// helpers, the route, the one `state` object, the clock, toasts and the live region.

const CFG = JSON.parse(document.getElementById("village").textContent);
const A = (p) => (CFG.art && CFG.art[p]) || `/art/${p}`;
// What this village allows: baked in at deploy (village.json), so only
// someone who can redeploy can change it.
const RULES = CFG.rules;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ── pixel icons, never emoji ───────────────────────────────
// OS emoji clash with the pixel art, so every icon the UI shows is a sprite,
// drawn at exactly 1× or 2× its native size (never in between) — the size
// is set inline, so no stylesheet rule can stretch it.
const ICONS = {
  candy: ["props/candy.png", 16, "candy"],
  pumpkin: ["ui/icon-pumpkin.png", 24, "pumpkin"],
  ghost: ["ui/icon-ghost.png", 24, "ghost"],
  warning: ["ui/icon-warning.png", 24, "warning"],
  water: ["ui/icon-water.png", 24, "water"],
  sack: ["ui/icon-sack.png", 24, "sack"],
  hourglass: ["ui/icon-hourglass.png", 24, "time left"],
  map: ["ui/icon-map.png", 24, "map"],
  gear: ["ui/icon-gear.png", 24, "settings"],
  "sound-on": ["ui/icon-sound-on.png", 24, "sound on"],
  "sound-off": ["ui/icon-sound-off.png", 24, "sound off"],
  "music-on": ["ui/icon-music-on.png", 24, "music on"],
  "music-off": ["ui/icon-music-off.png", 24, "music off"],
};
const ico = (name, alt = ICONS[name][2], scale = 1) => {
  const [path, n] = ICONS[name];
  return `<img class="ico" data-icon="${name}" src="${A(path)}" alt="${esc(alt)}" width="${n * scale}" height="${n * scale}" style="width:${n * scale}px;height:${n * scale}px">`;
};
/** Copy with {icon} tokens: as HTML (sprites) or as plain words (titles, screen readers). */
const iconHtml = (s) => esc(s).replace(/\{([a-z-]+)\}/g, (m, k) => (ICONS[k] ? ico(k) : m));
const iconPlain = (s) => s.replace(/\{([a-z-]+)\}/g, (m, k) => (ICONS[k] ? ICONS[k][2] : m));

// ── route ─────────────────────────────────────────────────────────────

function parseRoute(loc) {
  const path = loc.pathname.replace(/\/+$/, "") || "/";
  const farm = /^\/farm\/(_?[a-z0-9-]+)$/.exec(path);
  if (farm) return { view: "farm", slug: farm[1] };
  if (path === "/setup") return { view: "setup", hash: loc.hash.slice(1) };
  return { view: "home" };
}

const state = {
  vh: null,
  mode: "loading",
  reason: null,
  meId: null,
  route: parseRoute(location),
  plots: new Map(), // userId -> { version, plot }
  players: new Map(), // userId -> { version, player }
  farms: new Map(), // userId -> { version, farm: {name, slug, avatar, scarecrow} }
  busy: false,
  guardMode: false,
  revealed: new Set(), // guard ghosts I slipped past (guardId)
  heard: { stages: null, candy: null }, // what listen() last saw
  feedOpen: false, // desktop panel expanded ("▾ more")
  feedTop: undefined, // newest feed entry last rendered (a new one slides in)
  feedSeenAt: 0, // last look at the full list (the unread badge)
  tip: null, // the HUD chip whose tip is showing: { key, pinned }
  coachShown: null, // the tutorial step on screen ("n:text"), for its bell
  newHouse: false, // just set up: my house pops in on the map
  // While > 0 a pull or its effects are on screen: render() waits, so a
  // redraw never yanks the tile out from under the player's finger.
  freeze: 0,
  dirty: false,
};
window.__hauntedFarm = state;

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const now = () => (state.vh ? state.vh.now().getTime() : Date.now());
const KIND_NAME = { common: "Common pumpkin", rare: "Rare pumpkin", legendary: "Legendary pumpkin", secret: "mystery pumpkin" };
const kindOf = (tile) => (tile && tile.secret ? "secret" : (tile && tile.kind) || "common");
const visible = (el) => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden";
const firstVisible = (sel) => [...document.querySelectorAll(sel)].find(visible) || null;

// ── rendering ─────────────────────────────────────────────────────────

const pct = (x) => Math.round(x * 100);
const VILLAGE_BTN = `<a class="btn to-village" href="/">${ico("map", "")} Village</a>`;

let toastTimer;
function toast(msg, icon) {
  const el = $("#toast");
  el.innerHTML = `${icon ? `${ico(icon)} ` : ""}${esc(msg)}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
}
let saidAt = 0;
/** Speak `msg` in the live region; `append` adds it to what was just said (an action, then its candy). */
const say = (msg, { append = false } = {}) => {
  const el = $("#sr");
  if (!el) return;
  el.textContent = append && el.textContent && performance.now() - saidAt < 1500 ? `${el.textContent} ${msg}` : msg;
  saidAt = performance.now();
};

export { $, A, CFG, esc, firstVisible, ico, iconHtml, iconPlain, ICONS, KIND_NAME, kindOf, now, pct, rand, RULES, say, state, toast, VILLAGE_BTN };
