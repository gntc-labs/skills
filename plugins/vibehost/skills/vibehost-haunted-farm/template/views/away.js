// Haunted Farm — "While you were away": a small card you swipe through.

import * as E from "../engine.js";
import * as FX from "../fx.js";
import { avatarSrc } from "../art-check.js";
import { inside } from "../clicks.js";
import { $, A, CFG, esc, iconHtml, iconPlain, KIND_NAME, kindOf, now, state } from "../core.js";
import { mine } from "../data.js";
import { nameOf } from "../farms.js";
import { fmtLeft } from "../shared.js";

const seenKey = () => `haunted-farm:seen:${CFG.seed}:${state.meId}`;
function markSeen() {
  try {
    localStorage.setItem(seenKey(), String(now()));
  } catch {
    /* every load is a first visit */
  }
}

// ── "While you were away": a small card you swipe through ──
// One event at a time (avatar + one line + when), a summary first, newest
// next, repeats collapsed. No backdrop: the game stays tappable behind it.
// Swipe / drag / ← → / ‹ › to move; swipe down, ✕ or Esc to dismiss; it
// leaves by itself 4 s after the last card was seen — unless you're on it.

const AWAY_TEXT = {
  steal: (who, what, n) => (n > 1 ? `${who} stole ${n} from your pumpkins` : `${who} stole 1 from your ${what}`),
  caught: (who, _w, n) => `${who} got caught by your ghost${n > 1 ? ` ×${n}` : ""}`,
  help: (who, what, n) => (n > 1 ? `${who} watered your pumpkins ×${n}` : `${who} watered your ${what}`),
  chase: (who, what, n) => (n > 1 ? `${who} chased ghosts off your farm ×${n}` : `${who} chased a ghost off your ${what}`),
  rot: (_w, what, n) => (n > 1 ? `${n} of your pumpkins rotted — clear them to plant again` : `Your ${what} rotted — clear it to plant again`),
  off: (_w, what, n) => (n > 1 ? `${n} of your pumpkins started going off — worth half now` : `Your ${what} started going off — it's worth half now`),
};
const AWAY_ICON = { steal: "sack", caught: "ghost", help: "water", chase: "ghost", rot: "warning", off: "warning" };

/** What happened to me since `last`, newest first, one entry per (what, who). */
function awayItems(last, t) {
  const raw = [];
  for (const [id, v] of state.players) {
    if (id === state.meId) continue;
    for (const ev of v.player.events || []) {
      if (ev.victim === state.meId && ev.at > last && AWAY_TEXT[ev.t]) raw.push({ k: ev.t, who: id, kind: ev.kind, at: ev.at });
    }
  }
  // My own crops that went off or rotted while I was gone.
  for (const tile of mine()?.plot.tiles ?? []) {
    if (!tile || tile.ghostOnly) continue;
    const r = E.ripeAt(tile, t);
    const rotted = r + E.rottenAfter(tile.kind);
    const off = r + E.goingOffAfter(tile.kind);
    if (rotted > last && rotted <= t) raw.push({ k: "rot", who: null, kind: kindOf(tile), at: rotted });
    else if (off > last && off <= t) raw.push({ k: "off", who: null, kind: kindOf(tile), at: off });
  }
  const order = Object.keys(AWAY_TEXT);
  raw.sort((a, b) => b.at - a.at || order.indexOf(a.k) - order.indexOf(b.k));
  const groups = new Map();
  for (const e of raw) {
    const key = `${e.k}|${e.who || ""}`;
    const g = groups.get(key);
    if (g) {
      g.n++;
      g.oldest = e.at;
    } else groups.set(key, { ...e, n: 1, newest: e.at, oldest: e.at });
  }
  return [...groups.values()];
}

/** The first card: everything in one line ("Bob pinched 2 {candy}, 1 pumpkin rotted, you caught Eve"). */
function awaySummary(items) {
  const sum = (k) => items.filter((x) => x.k === k);
  const n = (k) => sum(k).reduce((a, x) => a + x.n, 0);
  const parts = [
    ...sum("steal").map((x) => `${nameOf(x.who)} pinched ${x.n} {candy}`),
    ...sum("caught").map((x) => `you caught ${nameOf(x.who)}`),
    ...sum("help").map((x) => `${nameOf(x.who)} watered ${x.n === 1 ? "1 pumpkin" : `${x.n} pumpkins`}`),
    ...sum("chase").map((x) => `${nameOf(x.who)} chased off ${x.n === 1 ? "a ghost" : `${x.n} ghosts`}`),
    n("rot") ? `${n("rot")} pumpkin${n("rot") === 1 ? "" : "s"} rotted` : "",
    n("off") ? `${n("off")} started going off` : "",
  ].filter(Boolean);
  const line = parts.join(", ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

const away = { cards: [], i: 0, seenLast: false, hold: false, timer: 0 };

function showAway() {
  let last = null;
  try {
    const v = localStorage.getItem(seenKey());
    last = v === null ? null : Number(v);
  } catch {
    last = null;
  }
  markSeen();
  if (last === null || !Number.isFinite(last)) return; // first visit: nothing was "missed"
  const t = now();
  const items = awayItems(last, t);
  if (!items.length) return;
  away.cards = [
    { summary: true, text: awaySummary(items), at: items[0].newest, icon: A("props/candy.png") },
    ...items.map((x) => ({
      text: `{${AWAY_ICON[x.k]}} ${AWAY_TEXT[x.k](nameOf(x.who), KIND_NAME[x.kind] || "pumpkin", x.n)}`,
      at: x.newest,
      oldest: x.oldest,
      n: x.n,
      icon: x.who ? avatarSrc(x.who) : A("crops/rotten.png"),
    })),
  ];
  away.i = 0;
  away.seenLast = false;
  away.hold = false;
  $("#away-dots").innerHTML = away.cards.map((_, k) => `<i data-dot="${k}"></i>`).join("");
  $("#away").hidden = false;
  drawAway(0);
  FX.sfx("bell", { queue: true }); // on load: it rings at the first tap
}

function drawAway(dir) {
  const c = away.cards[away.i];
  const t = now();
  // Time gone by rounds down (fmtLeft rounds a countdown up).
  const ago = (ms) => fmtLeft(Math.max(E.MIN, Math.floor(ms / E.MIN) * E.MIN));
  const when = c.n > 1 && c.oldest !== c.at ? `${ago(t - c.at)}–${ago(t - c.oldest)} ago` : `${ago(t - c.at)} ago`;
  const slide = $("#away-slide");
  slide.innerHTML = `<img class="face" alt="" src="${c.icon}"><span class="txt" title="${esc(iconPlain(c.text))}">${iconHtml(c.text)}</span><span class="when">${when}</span>`;
  slide.dataset.summary = c.summary ? "1" : "";
  $("#away-count").textContent = `${away.i + 1} / ${away.cards.length}`;
  document.querySelectorAll("#away-dots i").forEach((d, k) => d.classList.toggle("on", k === away.i));
  $("#away-prev").disabled = away.i === 0;
  $("#away-next").disabled = away.i === away.cards.length - 1;
  // Slide in from the side it came from; reduced motion: a crossfade.
  slide.classList.remove("from-left", "from-right", "fade");
  void slide.offsetWidth;
  if (dir) slide.classList.add(FX.reducedMotion() ? "fade" : dir > 0 ? "from-right" : "from-left");
  if (away.i === away.cards.length - 1) away.seenLast = true;
  armAwayTimer();
}

function stepAway(dir) {
  if ($("#away").hidden) return;
  const next = Math.max(0, Math.min(away.cards.length - 1, away.i + dir));
  if (next === away.i) return;
  away.i = next;
  drawAway(dir);
}

function closeAway() {
  clearTimeout(away.timer);
  $("#away").hidden = true;
}

/** Gone 4 s after the last card was seen — never while the player is on it. */
function armAwayTimer() {
  clearTimeout(away.timer);
  if (away.seenLast && !away.hold && !$("#away").hidden) away.timer = setTimeout(closeAway, 4000);
}

// Touch and mouse drags: left/right moves, down (a phone's flick) dismisses.
{
  const card = () => $("#away");
  let start = null;
  document.addEventListener("pointerdown", (ev) => {
    if (!ev.target.closest("#away") || ev.target.closest("button")) return;
    start = { x: ev.clientX, y: ev.clientY };
    card().setPointerCapture?.(ev.pointerId);
  });
  document.addEventListener("pointermove", (ev) => {
    if (!start || FX.reducedMotion()) return;
    const dx = ev.clientX - start.x;
    const dy = ev.clientY - start.y;
    $("#away-slide").style.transform = Math.abs(dx) >= Math.abs(dy) ? `translateX(${dx * 0.5}px)` : dy > 0 ? `translateY(${dy * 0.4}px)` : "";
  });
  document.addEventListener("pointerup", (ev) => {
    if (!start) return;
    const dx = ev.clientX - start.x;
    const dy = ev.clientY - start.y;
    start = null;
    $("#away-slide").style.transform = "";
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) stepAway(dx < 0 ? 1 : -1);
    else if (dy > 50 && dy > Math.abs(dx)) closeAway();
  });
  document.addEventListener("pointercancel", () => {
    start = null;
    $("#away-slide").style.transform = "";
  });
  // On it (hover, focus, a finger down) = interacting: no auto-dismiss.
  for (const [type, hold] of [["pointerenter", true], ["pointerleave", false], ["focusin", true], ["focusout", false]]) {
    card().addEventListener(type, () => {
      away.hold = hold;
      armAwayTimer();
    });
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && state.mode === "play") markSeen();
});

// ── clicks ──
const awayClicks = [inside("#away-close", () => closeAway()), inside("#away-prev", () => stepAway(-1)), inside("#away-next", () => stepAway(1))];

export { awayClicks, closeAway, showAway, stepAway };
