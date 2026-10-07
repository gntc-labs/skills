// Haunted Farm — one player can't break the village: every doc is checked on read.
// Anyone in the workspace can write their own farm, plot and player docs
// with devtools. Whatever comes back from a list is checked here; a doc
// that doesn't make sense is ignored (logged once) and never rendered.

import * as E from "./engine.js";
import { now } from "./core.js";
import { AVATARS, LOTS_PER_DISTRICT, SCARECROWS, SLUG_RE } from "./shared.js";
import { playerIn, plotIn } from "./sync.js";

const rejected = new Set();
function reject(kind, id, why) {
  const key = `${kind}:${id}`;
  if (!rejected.has(key)) {
    rejected.add(key);
    console.warn(`haunted-farm: ignoring ${kind} ${id}: ${why}`);
  }
  return null;
}
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isTime = (v) => v != null && Number.isFinite(E.fromStored(v));
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** A farm doc as the page may use it, or null (ignored). */
function farmIn(id, f) {
  if (!isObj(f)) return reject("farm", id, "not an object");
  if (typeof f.name !== "string" || !f.name.trim() || [...f.name].length > 30) return reject("farm", id, "bad name");
  if (typeof f.slug !== "string" || !SLUG_RE.test(f.slug)) return reject("farm", id, "bad link name");
  if (!AVATARS.includes(f.avatar)) return reject("farm", id, "bad avatar");
  if (!Object.hasOwn(SCARECROWS, f.scarecrow)) return reject("farm", id, "bad scarecrow");
  if (!isInt(f.district, 1, 50) || !isInt(f.lot, 0, LOTS_PER_DISTRICT - 1)) return reject("farm", id, "bad lot");
  const out = { ...f };
  // Custom images are checked pixel by pixel before they're shown (pngOk); here only their shape.
  if (out.avatarPng !== undefined && typeof out.avatarPng !== "string") delete out.avatarPng;
  if (out.skins !== undefined && !isObj(out.skins)) delete out.skins;
  if (out.artVersion !== undefined && !(typeof out.artVersion === "string" && out.artVersion.length <= 32)) delete out.artVersion;
  if (out.tutorial !== undefined && !isObj(out.tutorial)) delete out.tutorial;
  return out;
}
/** One tile of a plot, or false when it can't be a tile. */
function tileOk(t) {
  if (t === null) return true;
  if (!isObj(t)) return false;
  if (t.ghostOnly) return t.ghostOnly === true && isTime(t.ghostSince);
  const k = E.RULES.kinds[t.kind];
  if (!k || !isTime(t.plantedAt)) return false;
  if (!(Number.isFinite(t.growMs) && t.growMs > 0 && t.growMs <= 24 * E.HOUR)) return false;
  if (t.boostMs != null && !(Number.isFinite(t.boostMs) && t.boostMs >= 0)) return false;
  if (t.stolen != null && !isInt(t.stolen, 0, k.yield)) return false;
  for (const f of ["stolenBy", "helpedBy", "marks"]) if (t[f] != null && !Array.isArray(t[f])) return false;
  for (const f of ["ghostSince", "guardSince"]) if (t[f] != null && !isTime(t[f])) return false;
  return true;
}
/** A plot doc as read: size clamped to 3–4 × 3–4, tiles to cols × rows; null when a tile is nonsense. */
function plotRead(id, data) {
  if (!isObj(data) || !Array.isArray(data.tiles)) return reject("plot", id, "no tiles");
  const clamp = (v) => (Number.isInteger(v) ? Math.min(4, Math.max(3, v)) : 3);
  const shaped = { tiles: data.tiles, ...(data.cols != null ? { cols: clamp(data.cols), rows: clamp(data.rows) } : {}) };
  const { cols, rows } = E.plotSize(shaped);
  shaped.tiles = Array.from({ length: cols * rows }, (_, i) => data.tiles[i] ?? null);
  if (!shaped.tiles.every(tileOk)) return reject("plot", id, "a tile that can't be a pumpkin");
  return plotIn(shaped);
}
/** A player doc as read: numbers that are numbers, a short name, events as a list. */
function playerRead(id, data) {
  if (!isObj(data)) return reject("player", id, "not an object");
  if (!Number.isFinite(data.candy) || data.candy < 0) return reject("player", id, "bad candy");
  if (data.events != null && !Array.isArray(data.events)) return reject("player", id, "bad events");
  const p = playerIn({ ...data, events: (data.events || []).filter((ev) => isObj(ev) && isTime(ev.at)) }, now());
  p.name = typeof p.name === "string" && p.name.trim() ? [...p.name].slice(0, 30).join("") : "A neighbour";
  return p;
}

export { farmIn, isObj, playerRead, plotRead };
