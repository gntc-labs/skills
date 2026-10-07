// Haunted Farm — docs in and out, pure (no DOM, no clock of its own: Node tests
// it, dev/sync.test.mjs). Stored ISO times <-> engine ms, "$serverTime" stamps,
// version-safe merging of a stale list, and rebasing my change onto a fresh doc.

import * as E from "./engine.js";
import { TUTORIAL_STEPS } from "./shared.js";

const TIME_FIELDS = ["plantedAt", "ghostSince", "guardSince"];
function tileIn(t) {
  if (!t) return null;
  const o = { ...t };
  for (const f of TIME_FIELDS) if (f in o) o[f] = E.fromStored(o[f]);
  if (o.marks) o.marks = o.marks.map((m) => ({ ...m, at: E.fromStored(m.at) }));
  return o;
}
// A time the engine just set to `at` is "now": the server stamps it, so a
// player's clock never decides when something was planted.
const stamp = (v, at) => (v === at ? "$serverTime" : new Date(v).toISOString());
function tileOut(t, at) {
  if (!t) return null;
  const o = { ...t };
  for (const f of TIME_FIELDS) if (o[f] != null) o[f] = stamp(o[f], at);
  if (o.marks) o.marks = o.marks.map((m) => ({ ...m, at: stamp(m.at, at) }));
  return o;
}
function plotIn(data) {
  const { cols, rows } = E.plotSize(data || {});
  const plot = { tiles: Array.from({ length: cols * rows }, (_, i) => tileIn((data?.tiles ?? [])[i] ?? null)) };
  if (data?.cols) Object.assign(plot, { cols, rows });
  return plot;
}

function plotOut(plot, at) {
  const out = { tiles: plot.tiles.map((t) => tileOut(t, at)) };
  if (plot.cols) Object.assign(out, { cols: plot.cols, rows: plot.rows });
  return out;
}
/** A player doc as the engine wants it; `at` dates the defaults a doc lacks. */
function playerIn(data, at) {
  const p = { ...E.newPlayer({ name: "Farmer" }, at), ...data };
  p.events = (p.events || []).map((ev) => ({ ...ev, at: E.fromStored(ev.at) }));
  return p;
}
function playerOut(p, at) {
  return { ...p, events: (p.events || []).map((ev) => ({ ...ev, at: stamp(ev.at, at) })) };
}

/**
 * A list response can be OLDER than what we hold: it was in flight while one
 * of our writes landed. Never step a doc back to a lower version (the step
 * just cleared would reappear, and get written back). My farm doc is also
 * merged, so its one-way fields (tutorial, beginner's luck) never undo.
 */
function newer(held, fresh, merge, meId) {
  for (const [id, f] of fresh) {
    const h = held.get(id);
    if (!h) continue;
    if (h.version > f.version) fresh.set(id, h);
    else if (merge && id === meId) fresh.set(id, { ...f, farm: merge(h.farm, f.farm) });
  }
  return fresh;
}

// One user action = one id, carried on every doc it writes (`acts`, the last
// few). A write whose response got lost is recognised on the next read, so a
// retry never applies it twice; a write that landed is never replayed.
const ACTS_KEPT = 8;
/** `data` with action `id` added to the last few on the doc (`prev`). */
const withAct = (data, prev, id) => ({ ...data, acts: [...(prev || []).filter((a) => a !== id).slice(-(ACTS_KEPT - 1)), id] });

// Key order and time formats can differ between what we sent and what comes
// back, so docs are compared in one normal form.
const norm = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const normTile = (t) => norm(tileOut(tileIn(t ?? null)));

/** My tile changes onto the fresh plot — or null when someone changed one of the same tiles. */
function rebasePlot(base, mine, fresh) {
  // A change of field size (an expansion) only ever goes onto the doc it was worked out from.
  const size = (p) => `${E.plotSize(p).cols}x${E.plotSize(p).rows}`;
  if (size(mine) !== size(base) || size(fresh) !== size(base)) return null;
  const tiles = Array.from({ length: mine.tiles.length }, (_, i) => (fresh.tiles ?? [])[i] ?? null);
  for (let i = 0; i < tiles.length; i++) {
    const b = normTile(base.tiles[i]);
    if (norm(mine.tiles[i] ?? null) === b) continue; // not mine to change
    if (normTile(tiles[i]) !== b) return null;
    tiles[i] = mine.tiles[i] ?? null;
  }
  return { ...fresh, tiles };
}

const COUNTERS = ["candy", "steals", "helps"];
const DAILY = ["stealsToday", "helpsToday"];
/** My player change as a DELTA onto the fresh doc (candy, counters, new events). Always applies: another tab's spending can't make it fail (candy stops at 0). */
function rebasePlayer(base, mine, fresh) {
  const out = { ...fresh };
  for (const k of Object.keys(mine)) if (k !== "events" && k !== "day" && k !== "acts" && !COUNTERS.includes(k) && !DAILY.includes(k) && norm(mine[k]) !== norm(base[k])) out[k] = mine[k];
  for (const k of COUNTERS) out[k] = (fresh[k] || 0) + (mine[k] || 0) - (base[k] || 0);
  // Daily counters count on the latest day either side has seen.
  const day = [fresh.day, mine.day].filter(Boolean).sort().pop();
  const on = (p, k) => (p.day === day ? p[k] || 0 : 0);
  for (const k of DAILY) out[k] = on(fresh, k) + on(mine, k) - on(base, k);
  if (day) out.day = day;
  out.candy = Math.max(0, out.candy);
  const had = new Set((base.events || []).map(norm));
  out.events = [...(fresh.events || []), ...(mine.events || []).filter((ev) => !had.has(norm(ev)))].slice(-E.RULES.eventsKept);
  return out;
}

// ── first-run tutorial: coach marks ──────────────────────
// Learn by doing: each step spotlights the real thing and advances when the
// farmer does it (only "village" has a "Got it"). Steps 3–5 wait ("park")
// until they can be shown: something to steal, 5 candy, a ripe crop.
// Progress lives on farms/<me>.tutorial, so it follows the farmer around.
// It only moves FORWARD: `cleared` only grows, done/skipped only turn on, and
// every write merges onto the server's copy — so a stale read or a second
// tab can never bring a finished step back. Replay starts a new `round`;
// the higher round wins outright. The step on screen is derived, never stored.

const freshTutorial = (round = 0) => ({ round, cleared: [], done: false, skipped: false });
/** Two copies of the tour → the one that knows the most (same round: union). */
function mergeTutorial(a, b) {
  if (!a || !b) return a || b || null;
  const ra = a.round || 0;
  const rb = b.round || 0;
  if (ra !== rb) return ra > rb ? a : b;
  const cleared = [...new Set([...(a.cleared || []), ...(b.cleared || [])])].sort((x, y) => x - y);
  return { round: ra, cleared, done: !!(a.done || b.done) || TUTORIAL_STEPS.every((_, k) => cleared.includes(k + 1)), skipped: !!(a.skipped || b.skipped) };
}
/** My farm doc, as held vs as read: the one-way fields keep their furthest value. */
function mergeFarm(held, read) {
  if (!held || !read) return read || held;
  const out = { ...read, tutorial: mergeTutorial(held.tutorial, read.tutorial) };
  if (held.firstCropBoost === true) out.firstCropBoost = true; // beginner's luck is spent once, ever
  if (!out.tutorial) delete out.tutorial;
  return out;
}

export { ACTS_KEPT, COUNTERS, DAILY, freshTutorial, mergeFarm, mergeTutorial, newer, norm, normTile, playerIn, playerOut, plotIn, plotOut, rebasePlayer, rebasePlot, stamp, tileIn, tileOut, TIME_FIELDS, withAct };
