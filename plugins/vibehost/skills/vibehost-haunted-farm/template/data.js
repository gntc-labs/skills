// Haunted Farm — App Data I/O: listing, refreshing what's on screen, and the one
// write path (versioned, retried, each action applied exactly once).

import * as E from "./engine.js";
import { now, rand, state } from "./core.js";
import { avatarFor, farmBySlug } from "./farms.js";
import { farmIn, playerRead, plotRead } from "./read.js";
import { render } from "./render.js";
import { mergeFarm, newer, playerIn, playerOut, plotIn, plotOut, rebasePlayer, rebasePlot, withAct } from "./sync.js";

/** One doc, or null when there is none. The SDK's get() answers `{ doc }`. */
async function getDoc(collection, id) {
  const r = await state.vh.get(collection, id);
  return r ? r.doc : null;
}

async function listAll(collection) {
  const out = [];
  let cursor;
  for (let page = 0; page < 5; page++) {
    const r = await state.vh.list(collection, { limit: 200, cursor });
    out.push(...r.docs);
    if (!r.nextCursor) break;
    cursor = r.nextCursor;
  }
  return out;
}

// A 429 says how long to wait (retryAfter, seconds): no read before then.
const backoff = { until: 0 };
/** Note a 429's retryAfter; returns the wait in ms (0 when the error has none). */
function noteRateLimit(e) {
  const ms = e && e.retryAfter > 0 ? e.retryAfter * 1000 : 0;
  if (ms) backoff.until = Math.max(backoff.until, Date.now() + ms);
  return ms;
}

async function refresh() {
  if (!state.vh) return;
  if (Date.now() < backoff.until) return render(); // rate-limited: redraw, read later
  try {
    const [players, farms] = await Promise.all([listAll("players"), listAll("farms")]);
    // A farm doc counts only when its owner wrote it (docId = owner).
    const okFarms = farms.filter((d) => d.ownerUserId === d.docId).map((d) => [d, farmIn(d.docId, d.data)]).filter(([, f]) => f);
    state.farms = newer(state.farms, new Map(okFarms.map(([d, f]) => [d.docId, { version: d.version, farm: f, createdAt: d.createdAt }])), mergeFarm, state.meId);
    state.plots = newer(state.plots, await loadPlots(), null, state.meId);
    const okPlayers = players.map((d) => [d, playerRead(d.docId, d.data)]).filter(([, p]) => p);
    state.players = newer(state.players, new Map(okPlayers.map(([d, p]) => [d.docId, { version: d.version, player: p, acts: Array.isArray(d.data.acts) ? d.data.acts : [] }])), null, state.meId);
  } catch (e) {
    if (e && e.status === 404) return enterRest();
    noteRateLimit(e);
  }
  render();
}

const plotsColl = (district) => `plots-d${district}`;
const lotsColl = (district) => `lots-d${district}`;
const districtOf = (id) => state.farms.get(id)?.farm.district ?? null;
/** The district the map shows: the one picked in the switcher, else mine, else 1. */
const viewDistrict = () => state.district ?? districtOf(state.meId) ?? 1;

/** Plots for what's on screen only: the viewed district on the map; one
 *  farm (plus mine, for a steal's ghost) on a farm page. */
async function loadPlots() {
  const out = new Map();
  const add = (d) => {
    const plot = d && plotRead(d.docId, d.data);
    if (plot) out.set(d.docId, { version: d.version, plot, acts: Array.isArray(d.data.acts) ? d.data.acts : [] });
  };
  if (state.route.view === "farm") {
    const ids = [farmBySlug(state.route.slug), state.meId].filter((id, k, a) => id && districtOf(id) && a.indexOf(id) === k);
    const docs = await Promise.all(ids.map((id) => getDoc(plotsColl(districtOf(id)), id)));
    docs.forEach(add);
  } else {
    (await listAll(plotsColl(viewDistrict()))).forEach(add);
  }
  return out;
}

async function ensureMine() {
  const id = state.meId;
  const at = now();
  if (await getDoc("players", id)) return;
  try {
    await state.vh.put("players", id, playerOut({ ...E.newPlayer(state.vh.user, at), avatar: avatarFor(id) }, at), { expectedVersion: 0 });
  } catch (e) {
    if (e.code !== "APP_DATA_VERSION_CONFLICT") throw e; // another tab made it first
  }
}

// ── actions ───────────────────────────────────────────────────────────

const mine = () => state.plots.get(state.meId);
const meP = () => state.players.get(state.meId);
const action = { id: null, landed: false };
const newActionId = () => `a${Date.now().toString(36)}${Math.floor(rand() * 1e9).toString(36)}`;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function write(collection, id, data) {
  const isPlot = collection === "plots";
  const map = isPlot ? state.plots : state.players;
  const cur = map.get(id);
  // Plots live in their farm's district: a steal from district 1 by a
  // farmer in district 3 writes plots-d1 (theirs) and plots-d3 (yours).
  const coll = isPlot ? plotsColl(districtOf(id)) : collection;
  const hold = (d) => map.set(id, { ...cur, version: d.version, ...(isPlot ? { plot: plotIn(d.data) } : { player: playerIn(d.data, now()) }) });
  // What `data` was worked out from: on a lost race, only OUR change is
  // carried onto the winner's doc — never the whole stale object.
  const base = isPlot ? plotOut(cur.plot) : playerOut(cur.player);
  let out = withAct(data, cur.acts ?? (isPlot ? [] : cur.player.acts), action.id);
  let version = cur.version;
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = (await state.vh.patch(coll, id, out, { expectedVersion: version })).doc;
      hold(doc);
      map.get(id).acts = doc.data.acts;
      action.landed = true;
      return;
    } catch (e) {
      if (attempt >= 5) throw e;
      const conflict = e && e.code === "APP_DATA_VERSION_CONFLICT";
      const busy = e && (e.code === "APP_DATA_RATE_LIMITED" || e.status === 429);
      const lost = e && !e.code && !e.status && !(e instanceof E.EngineError); // the network: it may have landed
      if (busy) {
        await sleep(Math.max(300 * 2 ** attempt, noteRateLimit(e))); // the same write, a little later (never before retryAfter)
        continue;
      }
      if (!conflict && !lost) throw e;
      const fresh = (conflict && e.current) || (await getDoc(coll, id));
      if (!fresh) throw e;
      hold(fresh); // run()'s retry (if it comes to that) starts from the winner's doc
      map.get(id).acts = fresh.data.acts;
      if ((fresh.data.acts || []).includes(action.id)) {
        action.landed = true; // an earlier attempt landed: done, never twice
        return;
      }
      const rebased = (isPlot ? rebasePlot : rebasePlayer)(base, data, fresh.data);
      if (!rebased) throw e; // both changed the same thing: run() works the rules out again (if nothing landed yet)
      out = withAct(rebased, fresh.data.acts, action.id);
      version = fresh.version;
    }
  }
}

/**
 * Change my farm doc: `change(farm)` returns the fields to write, worked out
 * from the freshest copy. Shown at once (optimistic); on a version race the
 * doc is re-read, `change` runs again on it, and the write is retried — never
 * the same stale fields twice.
 */
async function updateMyFarm(change) {
  const me = state.meId;
  let cur = state.farms.get(me);
  if (!cur) return;
  for (let attempt = 0; ; attempt++) {
    const fields = change(cur.farm);
    if (!fields) return;
    const held = state.farms.get(me);
    state.farms.set(me, { ...held, farm: mergeFarm(held.farm, { ...cur.farm, ...fields }) });
    try {
      const doc = await state.vh.patch("farms", me, fields, { expectedVersion: cur.version });
      const latest = state.farms.get(me);
      if (latest.version <= doc.doc.version) state.farms.set(me, { ...latest, version: doc.doc.version, farm: mergeFarm(latest.farm, doc.doc.data) });
      return;
    } catch (e) {
      if (e.code !== "APP_DATA_VERSION_CONFLICT" || attempt >= 3) throw e;
      const d = e.current || (await getDoc("farms", me));
      if (!d) return;
      cur = { version: d.version, farm: d.data }; // the server's copy alone: `change` decides afresh
    }
  }
}

/** No App Data here (or not for me): the village rests. */
function enterRest() {
  state.mode = "rest";
  state.vh = null;
  state.plots = new Map();
  state.players = new Map();
  state.farms = new Map();
  render();
}

export { action, backoff, districtOf, ensureMine, enterRest, getDoc, listAll, lotsColl, meP, mine, newActionId, plotsColl, refresh, updateMyFarm, viewDistrict, write };
