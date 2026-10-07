// Haunted Farm rules engine — pure, no I/O, no clock, no randomness of its own.
//
// Every function takes `now` (epoch ms, the App Data skew-corrected server
// time: vh.now().getTime()) and, where dice are involved, `rand` (a () =>
// [0,1) function). It returns NEW objects and never mutates its inputs, so
// the page can hand the result straight to App Data as a PATCH and, on a
// 409 APP_DATA_VERSION_CONFLICT, simply re-run the same rule against the
// fresh document.
//
// The shapes stored in App Data:
//   plots-d<district>/<userId>   { tiles: Tile[cols × rows], cols?, rows? }
//                    (3×3 unless expanded; row-major: tile i = row·cols + col)
//   players/<userId> { name, avatar, candy, steals, helps, day,
//                      stealsToday, helpsToday, events: Event[] }
//   Tile = null | { kind, secret, plantedAt, growMs, boostMs, ghostSince,
//                   ghostMs, stolen, stolenBy[], helpedBy[], guardSince,
//                   marks?: Mark[] }
//   Mark = { by: userId, at, caught?: true } — who took a bite (or got caught
//          trying) of this crop, for its owner to see; gone with the crop.
//         | { ghostOnly: true, ghostSince }     (a ghost on an empty tile)
//   Event = { t: "steal"|"caught"|"help"|"chase", victim, kind, at, guarded? }
//         | { t: "harvest", kind: "legendary"|"secret", at }  (notable only)
//         — the last few things this player did to someone else's farm.
//           Revenge reads them; so does the victim's "while you were away".
// Times are epoch ms in the engine. The page writes `plantedAt` as the
// server's "$serverTime" marker, then converts the stored ISO string back
// to ms with `fromStored` before calling in.
//
// Spec: docs/superpowers/specs/2026-10-06-haunted-farm-design.md "Game rules (v1)".

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;

export const RULES = Object.freeze({
  tiles: 9, // a new plot: 3×3
  baseCols: 3,
  baseRows: 3,
  kinds: Object.freeze({
    common: Object.freeze({ growMs: 30 * MIN, cost: 0, yield: 4 }),
    rare: Object.freeze({ growMs: 2 * HOUR, cost: 5, yield: 8 }),
    legendary: Object.freeze({ growMs: 6 * HOUR, cost: 15, yield: 20 }),
  }),
  secretChance: 0.01, // on Legendary only
  stealOpensAfterMs: 15 * MIN,
  stealAmount: 1,
  maxStealsPerCrop: 2,
  ownerKeepsAtLeast: 0.5,
  dailyStealCap: 20,
  stealSuccessChance: 0.7,
  ghostSlowdown: 0.5, // a haunted crop grows at half speed
  ghostChaseCost: 2,
  helpBoost: 0.1, // a help makes the crop ripen 10% (of its grow time) sooner
  helpReward: 1,
  dailyHelpCap: 10,
  // Rotting, counted from the moment the crop ripened.
  // Per variety — going off (half value) after max(its grow
  // time, 2 h) ripe, rotten (worth nothing, must be cleared) after twice
  // that: Common/Rare 2 h / 4 h, Legendary (and the secret) 6 h / 12 h.
  goingOffMinMs: 2 * HOUR,
  // Fighting back. Catch chance = 1 - stealSuccessChance
  // (30%) unless raised by revenge or a guard; both together hit the cap.
  revengeWindowMs: 10 * MIN,
  revengeCatchChance: 0.6,
  guardCatchChance: 0.6,
  catchChanceCap: 0.8,
  guardCost: 5,
  maxGuards: 2,
  guardLastsMs: 6 * HOUR,
  // Beginner's luck: a farmer's very first crop ripens this soon.
  beginnersLuckMs: 5 * MIN,
  eventsKept: 20,
  // Thief marks on a tile: every steal (≤ 2 a crop) plus the
  // newest caught attempts, at most this many in all.
  marksKept: 4,
  // No season — the village runs indefinitely. Only the daily
  // caps reset, at Taipei midnight (UTC+8, no DST).
  taipeiOffsetMs: 8 * HOUR,
});

export class EngineError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.name = "EngineError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new EngineError(code, message);
};

// ── time ─────────────────────────────────────────────────────────────

/** The Taipei calendar day `now` falls in, as "YYYY-MM-DD". */
export function dayKey(now) {
  return new Date(now + RULES.taipeiOffsetMs).toISOString().slice(0, 10);
}

/** App Data stores times as ISO strings; the engine works in ms. */
export function fromStored(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

// ── new documents ────────────────────────────────────────────────────

export function newPlot() {
  return { tiles: Array.from({ length: RULES.tiles }, () => null) };
}

/** A plot's field size; a plot that never expanded carries none and is 3×3. */
export function plotSize(plot) {
  return { cols: plot.cols || RULES.baseCols, rows: plot.rows || RULES.baseRows };
}

// ── farm expansion ───────────────────────────────────────
// The village config sets the price and the largest field (`rules`:
// { cost, maxCols, maxRows }; defaults 30 candy, 4×4). Each step adds a row
// while there are no more rows than columns, else a column: 3×3 → 3×4 → 4×4.

export const EXPANSION_DEFAULTS = Object.freeze({ cost: 30, maxCols: 4, maxRows: 4 });

/** The size one step up, or null at the largest field. */
export function nextSize(plot, rules = EXPANSION_DEFAULTS) {
  const { cols, rows } = plotSize(plot);
  if (rows <= cols && rows < rules.maxRows) return { cols, rows: rows + 1 };
  if (cols < rules.maxCols) return { cols: cols + 1, rows };
  if (rows < rules.maxRows) return { cols, rows: rows + 1 };
  return null;
}

/** Buy one step of field. Every crop keeps its row and column. */
export function expand({ player, plot, rules = EXPANSION_DEFAULTS }) {
  const next = nextSize(plot, rules);
  if (!next) fail("MAX_SIZE", "Your field is as big as it gets.");
  if (player.candy < rules.cost) fail("NOT_ENOUGH_CANDY");
  const { cols } = plotSize(plot);
  const tiles = Array.from({ length: next.cols * next.rows }, (_, i) => {
    const r = Math.floor(i / next.cols);
    const c = i % next.cols;
    return c < cols ? (plot.tiles[r * cols + c] ?? null) : null;
  });
  return { player: { ...player, candy: player.candy - rules.cost }, plot: { ...plot, tiles, cols: next.cols, rows: next.rows } };
}

export function newPlayer(user, now) {
  return {
    name: (user && user.name) || "Farmer",
    avatar: 0,
    candy: 0,
    steals: 0,
    helps: 0,
    day: dayKey(now),
    stealsToday: 0,
    helpsToday: 0,
    events: [],
  };
}

/** Daily counters reset on a new Taipei day. */
export function freshDay(player, now) {
  const day = dayKey(now);
  if (player.day === day) return player;
  return { ...player, day, stealsToday: 0, helpsToday: 0 };
}

// ── a tile's state ───────────────────────────────────────────────────

function isCrop(tile) {
  return !!tile && !tile.ghostOnly;
}

function ghostTimeAt(tile, now) {
  return (tile.ghostMs || 0) + (tile.ghostSince != null ? now - tile.ghostSince : 0);
}

function needMs(tile) {
  return tile.growMs - (tile.boostMs || 0);
}

/**
 * When the crop is (or will be) ripe, in epoch ms. Growth runs at full speed
 * except while a ghost sits on it (half speed); ghosts only ever land on a
 * crop that is still growing, so every closed ghost interval lies before
 * ripeness.
 */
export function ripeAt(tile, now) {
  const need = needMs(tile);
  if (tile.ghostSince == null) {
    return tile.plantedAt + need + RULES.ghostSlowdown * (tile.ghostMs || 0);
  }
  const effAtGhost =
    tile.ghostSince - tile.plantedAt - RULES.ghostSlowdown * (tile.ghostMs || 0);
  if (effAtGhost >= need) {
    return tile.plantedAt + need + RULES.ghostSlowdown * (tile.ghostMs || 0);
  }
  return tile.ghostSince + (need - effAtGhost) / (1 - RULES.ghostSlowdown);
}

/** 0..1 growth progress. */
export function progress(tile, now) {
  const eff = now - tile.plantedAt - RULES.ghostSlowdown * ghostTimeAt(tile, Math.min(now, ripeAt(tile, now)));
  return Math.max(0, Math.min(1, eff / needMs(tile)));
}

export function yieldOf(tile) {
  return RULES.kinds[tile.kind].yield;
}

/** How long a ripe crop of `kind` stays fresh before going off. By variety, so a crop planted under older rules rots on today's clock. */
export function goingOffAfter(kind) {
  return Math.max(RULES.kinds[kind].growMs, RULES.goingOffMinMs);
}
/** …and how long until it's rotten: twice that. */
export function rottenAfter(kind) {
  return 2 * goingOffAfter(kind);
}

/** "fresh" | "off" | "rotten" for a ripe crop, null while it grows. */
export function rotOf(tile, now) {
  if (!isCrop(tile)) return null;
  const since = now - ripeAt(tile, now);
  if (since < 0) return null;
  if (since >= rottenAfter(tile.kind)) return "rotten";
  if (since >= goingOffAfter(tile.kind)) return "off";
  return "fresh";
}

/**
 * Candy the crop is worth right now: what's left after steals, halved
 * (rounded down, at least 1) while going off, 0 once rotten or unripe.
 */
export function valueOf(tile, now) {
  const rot = rotOf(tile, now);
  if (!rot || rot === "rotten") return 0;
  const left = yieldOf(tile) - (tile.stolen || 0);
  return rot === "off" ? Math.max(1, Math.floor(left / 2)) : left;
}

export function guardActive(tile, now) {
  return !!tile && !tile.ghostOnly && tile.guardSince != null && now - tile.guardSince < RULES.guardLastsMs;
}

export function activeGuards(plot, now) {
  return plot.tiles.filter((t) => guardActive(t, now)).length;
}

const fromMs = (v) => (typeof v === "number" ? v : fromStored(v));

/** Did `thief` steal from (or get caught on) `victimId`'s farm in the last 10 minutes? */
export function inRevengeWindow(thief, victimId, now) {
  return (thief.events || []).some((ev) => {
    if (ev.victim !== victimId || (ev.t !== "steal" && ev.t !== "caught")) return false;
    const at = fromMs(ev.at);
    return at != null && at <= now && now - at < RULES.revengeWindowMs;
  });
}

/**
 * The chance a steal of `tile` on `victimId`'s farm by `thief` is caught:
 * 30%; 60% while the victim is "watching for" this thief (revenge) or the
 * tile is guarded; 80% (the cap) when both.
 */
export function catchChance({ thief, victimId, tile, now }) {
  const revenge = inRevengeWindow(thief, victimId, now);
  const guarded = guardActive(tile, now);
  let chance = 1 - RULES.stealSuccessChance;
  if (revenge) chance = Math.max(chance, RULES.revengeCatchChance);
  if (guarded) chance = Math.max(chance, RULES.guardCatchChance);
  if (revenge && guarded) chance = RULES.catchChanceCap;
  return { chance, revenge, guarded };
}

/**
 * What a viewer sees on a tile:
 *   empty | ghost (ghost on an empty tile) | sprout | growing | ripe | rotten
 * plus `haunted`, `ripeAt`, `stealOpensAt`, `stealable`, `rot`, `value`,
 * `guarded`.
 */
export function tileState(tile, now) {
  if (!tile) return { stage: "empty", haunted: false };
  if (tile.ghostOnly) return { stage: "ghost", haunted: true };
  const r = ripeAt(tile, now);
  const p = progress(tile, now);
  const ripe = now >= r;
  const rot = rotOf(tile, now);
  const stealOpensAt = r + RULES.stealOpensAfterMs;
  return {
    stage: rot === "rotten" ? "rotten" : ripe ? "ripe" : p < 0.5 ? "sprout" : "growing",
    kind: tile.kind,
    secret: !!tile.secret,
    haunted: tile.ghostSince != null,
    progress: p,
    ripeAt: r,
    stealOpensAt,
    rot,
    value: valueOf(tile, now),
    guarded: guardActive(tile, now),
    stealable: ripe && rot !== "rotten" && now >= stealOpensAt && stealsLeft(tile) > 0,
  };
}

/** Steals the crop can still take: ≤ 2 per crop and the owner keeps ≥ 50%. */
export function stealsLeft(tile) {
  const y = yieldOf(tile);
  const keep = Math.ceil(y * RULES.ownerKeepsAtLeast);
  const byShare = Math.floor((y - keep - (tile.stolen || 0)) / RULES.stealAmount);
  const byCount = RULES.maxStealsPerCrop - (tile.stolen || 0) / RULES.stealAmount;
  return Math.max(0, Math.min(byShare, byCount));
}

// ── owner actions ────────────────────────────────────────────────────

function setTile(plot, i, tile) {
  const tiles = plot.tiles.slice();
  tiles[i] = tile;
  return { ...plot, tiles };
}

function tileAt(plot, i) {
  if (!Number.isInteger(i) || i < 0 || i >= plot.tiles.length) fail("BAD_TILE");
  return plot.tiles[i] ?? null;
}

/**
 * Plant a seed. `beginnersLuck: true` — the caller's word that this farmer
 * has never used it (the farm doc's `firstCropBoost === false`) — makes this
 * crop ripen in RULES.beginnersLuckMs; the result says `luck: true` so the
 * caller records it (`firstCropBoost: true`) and never passes it again.
 */
export function plant({ player, plot, i, kind, now, rand, beginnersLuck = false }) {
  const k = RULES.kinds[kind];
  if (!k) fail("BAD_KIND");
  const tile = tileAt(plot, i);
  if (tile && tile.ghostOnly) fail("HAUNTED", "Chase the ghost away first.");
  if (tile) fail("OCCUPIED");
  if (player.candy < k.cost) fail("NOT_ENOUGH_CANDY");
  const secret = kind === "legendary" && rand() < RULES.secretChance;
  const luck = beginnersLuck === true;
  return {
    luck,
    player: { ...player, candy: player.candy - k.cost },
    plot: setTile(plot, i, {
      kind,
      secret,
      plantedAt: now,
      growMs: k.growMs,
      boostMs: luck ? Math.max(0, k.growMs - RULES.beginnersLuckMs) : 0,
      ghostSince: null,
      ghostMs: 0,
      stolen: 0,
      stolenBy: [],
      helpedBy: [],
    }),
  };
}

export function harvest({ player, plot, i, now }) {
  const tile = tileAt(plot, i);
  if (!isCrop(tile)) fail("NOTHING_TO_HARVEST");
  if (now < ripeAt(tile, now)) fail("NOT_RIPE");
  if (rotOf(tile, now) === "rotten") fail("ROTTEN", "It's rotten — clear it away first.");
  const got = valueOf(tile, now);
  const kind = kindOf(tile);
  // Only the moments worth telling the village about are remembered.
  const told = kind === "legendary" || kind === "secret" ? withEvent(player, { t: "harvest", kind, at: now }) : player;
  return {
    player: { ...told, candy: player.candy + got },
    plot: setTile(plot, i, null),
    candy: got,
  };
}

/** Clear a rotten crop off your own tile (free); the tile can be planted again. */
export function clearRotten({ plot, i, now }) {
  const tile = tileAt(plot, i);
  if (rotOf(tile, now) !== "rotten") fail("NOT_ROTTEN");
  return { plot: setTile(plot, i, null) };
}

/** Post a guard ghost on one of your own crops: 5 candy, max 2 per farm, 6 h. */
export function placeGuard({ player, plot, i, now }) {
  const tile = tileAt(plot, i);
  if (!isCrop(tile)) fail("NOTHING_TO_GUARD", "Guards stand watch over a crop.");
  if (rotOf(tile, now) === "rotten") fail("ROTTEN", "Nothing worth guarding there.");
  if (guardActive(tile, now)) fail("ALREADY_GUARDED");
  if (activeGuards(plot, now) >= RULES.maxGuards) fail("TOO_MANY_GUARDS", `At most ${RULES.maxGuards} guards per farm.`);
  if (player.candy < RULES.guardCost) fail("NOT_ENOUGH_CANDY");
  return {
    player: { ...player, candy: player.candy - RULES.guardCost },
    plot: setTile(plot, i, { ...tile, guardSince: now }),
  };
}

const kindOf = (tile) => (tile && tile.secret ? "secret" : (tile && tile.kind) || "common");
function withEvent(player, ev) {
  return { ...player, events: [...(player.events || []), ev].slice(-RULES.eventsKept) };
}

/** Close a ghost's interval, counting only the time before the crop ripened. */
function withoutGhost(tile, now) {
  if (tile.ghostOnly) return null;
  if (tile.ghostSince == null) return tile;
  const until = Math.min(now, ripeAt(tile, now));
  return {
    ...tile,
    ghostMs: (tile.ghostMs || 0) + Math.max(0, until - tile.ghostSince),
    ghostSince: null,
  };
}

/** The owner clicks their own ghost away: costs candy. */
export function chaseOwnGhost({ player, plot, i, now }) {
  const tile = tileAt(plot, i);
  if (!tile || (!tile.ghostOnly && tile.ghostSince == null)) fail("NO_GHOST");
  if (player.candy < RULES.ghostChaseCost) fail("NOT_ENOUGH_CANDY");
  return {
    player: { ...player, candy: player.candy - RULES.ghostChaseCost },
    plot: setTile(plot, i, withoutGhost(tile, now)),
  };
}

// ── Trick or Treat ───────────────────────────────────────────────────

/** Where a caught thief's ghost lands: a growing crop first, else an empty tile. */
export function ghostLanding(plot, now, rand) {
  const growing = [];
  const empty = [];
  plot.tiles.forEach((t, i) => {
    if (!t) empty.push(i);
    else if (!t.ghostOnly && t.ghostSince == null && now < ripeAt(t, now)) growing.push(i);
  });
  const pool = growing.length ? growing : empty;
  if (!pool.length) return null;
  return pool[Math.floor(rand() * pool.length)];
}

function haunt(plot, now, rand) {
  const i = ghostLanding(plot, now, rand);
  if (i === null) return { plot, ghostTile: null };
  const t = plot.tiles[i];
  return {
    plot: setTile(plot, i, t ? { ...t, ghostSince: now } : { ghostOnly: true, ghostSince: now }),
    ghostTile: i,
  };
}

function guardStealBudget(thief) {
  if (thief.stealsToday >= RULES.dailyStealCap) {
    fail("DAILY_STEAL_CAP", `You've used today's ${RULES.dailyStealCap} steals.`);
  }
}

/** Add a thief mark: steals always stay (≤ 2 a crop); caught attempts keep only the newest. */
export function withMark(tile, mark) {
  const marks = [...(tile.marks || []), mark];
  const steals = marks.filter((m) => !m.caught);
  const caught = marks.filter((m) => m.caught).slice(-Math.max(0, RULES.marksKept - steals.length));
  return { ...tile, marks: marks.filter((m) => !m.caught || caught.includes(m)) };
}

/**
 * Steal from a neighbour's ripe crop. Every attempt counts toward the daily
 * cap. The catch chance comes from `catchChance` (30%, more with revenge or
 * a guard); a Treat takes one candy, a Trick sends a ghost home with you.
 * Either way the attempt is recorded on the thief, which is what starts
 * the victim's revenge window. A crop that's going off still gives 1.
 */
export function steal({ thief, thiefId, thiefPlot, victimId, victimPlot, i, now, rand }) {
  if (thiefId === victimId) fail("OWN_CROP", "That's your own crop — harvest it.");
  thief = freshDay(thief, now);
  guardStealBudget(thief);
  const tile = tileAt(victimPlot, i);
  if (!isCrop(tile)) fail("NOTHING_TO_STEAL");
  const st = tileState(tile, now);
  if (st.stage === "rotten") fail("ROTTEN", "It's rotten — nothing worth taking.");
  if (st.stage !== "ripe") fail("NOT_RIPE");
  if (now < st.stealOpensAt) fail("TOO_SOON", "The owner still has time to harvest.");
  if (stealsLeft(tile) <= 0) fail("PICKED_CLEAN");
  if ((tile.stolenBy || []).includes(thiefId)) fail("ALREADY_STOLEN", "You already took a bite of this one.");

  const risk = catchChance({ thief, victimId, tile, now });
  const counted = { ...thief, stealsToday: thief.stealsToday + 1 };
  const kind = kindOf(tile);
  if (rand() >= 1 - risk.chance) {
    const h = haunt(thiefPlot, now, rand);
    return {
      outcome: "caught",
      risk,
      thief: withEvent(counted, { t: "caught", victim: victimId, kind, at: now, ...(risk.guarded ? { guarded: true } : {}) }),
      thiefPlot: h.plot,
      // The owner sees who tried (the crop itself is untouched).
      victimPlot: setTile(victimPlot, i, withMark(tile, { by: thiefId, at: now, caught: true })),
      ghostTile: h.ghostTile,
    };
  }
  return {
    outcome: "success",
    risk,
    thief: withEvent({ ...counted, candy: counted.candy + RULES.stealAmount, steals: (counted.steals || 0) + 1 }, { t: "steal", victim: victimId, kind, at: now }),
    thiefPlot,
    victimPlot: setTile(
      victimPlot,
      i,
      withMark({ ...tile, stolen: (tile.stolen || 0) + RULES.stealAmount, stolenBy: [...(tile.stolenBy || []), thiefId] }, { by: thiefId, at: now }),
    ),
  };
}

// ── helping ──────────────────────────────────────────────────────────

/**
 * Water a neighbour's growing crop, or chase a ghost off it. The crop ripens
 * 10% sooner (a growing crop only), the helper gets a candy. One help per
 * helper per crop; RULES.dailyHelpCap helps a day.
 */
export function help({ helper, helperId, ownerId, plot, i, action, now }) {
  if (helperId === ownerId) fail("OWN_CROP", "Helping is for neighbours.");
  helper = freshDay(helper, now);
  if (helper.helpsToday >= RULES.dailyHelpCap) {
    fail("DAILY_HELP_CAP", `You've helped ${RULES.dailyHelpCap} times today — kind!`);
  }
  const tile = tileAt(plot, i);
  if (!tile) fail("NOTHING_TO_HELP");
  let next;
  if (action === "chase") {
    if (!tile.ghostOnly && tile.ghostSince == null) fail("NO_GHOST");
    next = withoutGhost(tile, now);
  } else if (action === "water") {
    if (tile.ghostOnly) fail("NOTHING_TO_HELP");
    next = tile;
  } else {
    fail("BAD_ACTION");
  }
  if (next) {
    if ((next.helpedBy || []).includes(helperId)) fail("ALREADY_HELPED");
    const growing = now < ripeAt(next, now);
    if (action === "water" && !growing) fail("ALREADY_RIPE");
    next = {
      ...next,
      boostMs: (next.boostMs || 0) + (growing ? RULES.helpBoost * next.growMs : 0),
      helpedBy: [...(next.helpedBy || []), helperId],
    };
  }
  return {
    helper: withEvent(
      {
        ...helper,
        candy: helper.candy + RULES.helpReward,
        helps: (helper.helps || 0) + 1,
        helpsToday: helper.helpsToday + 1,
      },
      { t: action === "water" ? "help" : "chase", victim: ownerId, kind: kindOf(tile), at: now },
    ),
    plot: setTile(plot, i, next),
  };
}
