// Haunted Farm — who robbed me: thief marks on my tiles.
// Only the owner sees them (they never hint at a hidden guard to anyone
// else). Up to 2 faces, top-left: steals first (-1), then the newest caught
// attempts (a tiny ghost). Tap one: who, when, the revenge window, a link.

import * as E from "../engine.js";
import { avatarSrc } from "../art-check.js";
import { inside, NEXT } from "../clicks.js";
import { $, esc, ico, now, state } from "../core.js";
import { mine } from "../data.js";
import { farmUrl, nameOf } from "../farms.js";

/** The marks to draw on tile `i`: steals first, then the newest caught attempts. */
function shownMarks(tile) {
  const marks = tile?.marks || [];
  return [...marks.filter((m) => !m.caught), ...marks.filter((m) => m.caught).reverse()].slice(0, 2).map((m) => ({ m, k: marks.indexOf(m) }));
}
/** The marks on tile `i`, laid over its grid cell (`area`) as their own buttons — never inside the tile's button. */
function marksHtml(i, tile, area) {
  const shown = shownMarks(tile);
  if (!shown.length) return "";
  return `<div class="marks" data-mark-i="${i}" style="grid-area:${area}">${shown
    .map(({ m, k }) => {
      const what = m.caught ? `${nameOf(m.by)} got caught by your ghost` : `${nameOf(m.by)} pinched 1 candy`;
      return `<button type="button" class="mark${m.caught ? " caught" : ""}" data-mark-i="${i}" data-mark-k="${k}" data-by="${esc(m.by)}" aria-label="${esc(what)}" title="${esc(what)}"><img class="thief" alt="" src="${avatarSrc(m.by)}">${m.caught ? ico("ghost", "caught") : "<b>-1</b>"}</button>`;
    })
    .join("")}</div>`;
}

const markPop = { i: null, k: null, anchor: null, timer: 0 };
const agoText = (ms) => {
  const m = Math.floor(Math.max(0, ms) / E.MIN);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
};
/** How long `thiefId` still faces the revenge catch chance on my farm (ms), or 0. */
function revengeLeft(thiefId, t) {
  const p = state.players.get(thiefId)?.player;
  if (!p || !E.inRevengeWindow(p, state.meId, t)) return 0;
  const last = Math.max(...(p.events || []).filter((ev) => ev.victim === state.meId && (ev.t === "steal" || ev.t === "caught")).map((ev) => ev.at));
  return Math.max(0, last + E.RULES.revengeWindowMs - t);
}
function drawMarkPop() {
  const pop = $("#mark-pop");
  const m = mine()?.plot.tiles[markPop.i]?.marks?.[markPop.k];
  if (!m) return closeMarkPop();
  const t = now();
  const who = esc(nameOf(m.by));
  const left = revengeLeft(m.by, t);
  const mmss = `${Math.floor(left / E.MIN)}:${String(Math.floor((left % E.MIN) / 1000)).padStart(2, "0")}`;
  const url = farmUrl(m.by);
  pop.innerHTML =
    `<p class="what">${m.caught ? `<b>${who}</b> tried to pinch it — caught by your ghost ${ico("ghost")}` : `<b>${who}</b> pinched 1 ${ico("candy")}`} · ${agoText(t - m.at)}</p>` +
    (left > 0 ? `<p class="revenge">${Math.round(E.RULES.revengeCatchChance * 100)}% catch chance on ${who} for <span class="left">${mmss}</span> more</p>` : "") +
    (url ? `<a class="btn" id="mark-go" href="${esc(url)}">Go to ${who}'s farm →</a>` : "");
}
function placeMarkPop() {
  const pop = $("#mark-pop");
  const a = markPop.anchor;
  if (pop.hidden || !a || !a.isConnected) return;
  const r = a.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const w = Math.min(280, vw - 16);
  pop.style.width = `${w}px`;
  pop.style.left = `${Math.max(8, Math.min(vw - w - 8, r.left))}px`;
  pop.style.top = `${r.bottom + 6}px`;
}
function openMarkPop(el) {
  markPop.i = Number(el.dataset.markI);
  markPop.k = Number(el.dataset.markK);
  markPop.anchor = el;
  $("#mark-pop").hidden = false;
  drawMarkPop();
  placeMarkPop();
  clearInterval(markPop.timer);
  markPop.timer = setInterval(drawMarkPop, 1000); // the revenge countdown is live
}
function closeMarkPop() {
  clearInterval(markPop.timer);
  markPop.i = markPop.k = markPop.anchor = null;
  const pop = $("#mark-pop");
  if (pop) pop.hidden = true;
}
window.addEventListener("scroll", placeMarkPop, { passive: true });

/** The latest thief on my farm (a real steal, not a caught attempt), for the map's "robbed" pip. */
function latestThief() {
  const marks = (mine()?.plot.tiles ?? []).flatMap((tile) => (tile?.marks || []).filter((m) => !m.caught));
  return marks.sort((a, b) => b.at - a.at)[0] || null;
}

// ── clicks ──
const markClicks = [
  inside(".mark", (markEl, ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (markPop.anchor && markPop.i === Number(markEl.dataset.markI) && markPop.k === Number(markEl.dataset.markK)) closeMarkPop();
    else openMarkPop(markEl);
  }),
  { match: (ev) => markPop.anchor && !ev.target.closest("#mark-pop"), run: () => (closeMarkPop(), NEXT) }, // and still does what it was for
];

export { closeMarkPop, latestThief, markClicks, markPop, marksHtml, placeMarkPop };
