// Haunted Farm — a farm: its tiles (what a tap would do, the risk), hidden
// guard ghosts, the Expand button, and moving out.

import * as E from "../engine.js";
import { avatarSrc, cropSrc } from "../art-check.js";
import { inside } from "../clicks.js";
import { $, A, CFG, esc, fmtLeft, ico, iconHtml, pct, RULES, state } from "../core.js";
import { meP } from "../data.js";
import { farmName, farmOf, nameOf } from "../farms.js";
import { PULL_ACTS } from "../pull.js";
import { marksHtml } from "./marks.js";
import { PRACTICE_ID } from "./tutorial.js";

/** The field a farm shows: its bought size, or 3×3 when the village doesn't allow expansion. */

function fieldOf(plot) {
  const { cols, rows } = E.plotSize(plot);
  if (RULES.expansion.on) return { cols, rows, cells: plot.tiles.map((_, i) => i) };
  const c3 = Math.min(cols, E.RULES.baseCols);
  const r3 = Math.min(rows, E.RULES.baseRows);
  return { cols: c3, rows: r3, cells: Array.from({ length: c3 * r3 }, (_, k) => Math.floor(k / c3) * cols + (k % c3)) };
}

// ── hidden guard ghosts ──────────────────────────
// A guard ghost is seen only by its farm's owner. Everyone else sees the
// BASE risk on every tile and a farm-level "lurking" count — until they
// slip past one: then that guard stays revealed on that tile, for them.
const revealedKey = () => `haunted-farm:revealed:${CFG.seed}:${state.meId}`;
const guardId = (ownerId, i, tile) => `${ownerId}:${i}:${tile && tile.guardSince}`;
function loadRevealed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(revealedKey()) || "[]"));
  } catch {
    return new Set();
  }
}
function reveal(ownerId, i, tile) {
  state.revealed.add(guardId(ownerId, i, tile));
  try {
    localStorage.setItem(revealedKey(), JSON.stringify([...state.revealed].slice(-50)));
  } catch {
    /* revealed for this page only */
  }
}
/** Can this viewer see the guard on this tile? */
const guardSeen = (ownerId, i, tile, st) =>
  !!st.guarded && (ownerId === state.meId || state.revealed.has(guardId(ownerId, i, tile)));

/**
 * The catch chance for me stealing this tile. `chance`/`why` are what the
 * tile may SHOW (a hidden guard is left out); `real` is what the engine
 * will roll against, and `hiddenGuard` says a guard is about to pop out.
 */
function riskFor(ownerId, tile, t, i) {
  const thief = meP()?.player || E.newPlayer({}, t);
  const real = E.catchChance({ thief, victimId: ownerId, tile, now: t });
  const seen = guardSeen(ownerId, i, tile, real);
  const shown = seen ? real : E.catchChance({ thief, victimId: ownerId, tile: { ...tile, guardSince: null }, now: t });
  const why = [shown.guarded ? "Guarded tile" : null, shown.revenge ? `${nameOf(ownerId)} is watching for you` : null].filter(Boolean);
  return { chance: pct(shown.chance), why, real: real.chance, guarded: real.guarded, hiddenGuard: real.guarded && !seen };
}

function tileAction(ownerId, tile, st) {
  if (state.mode !== "play") return null;
  if (ownerId === state.meId) {
    if (state.guardMode) {
      const can = tile && !tile.ghostOnly && st.stage !== "rotten" && !st.guarded;
      return can ? ["guard", `Post a guard ghost (${E.RULES.guardCost} candy)`] : null;
    }
    if (st.haunted) return ["chaseOwn", `Chase the ghost (${E.RULES.ghostChaseCost} candy)`];
    if (st.stage === "empty") return ["plant", "Plant a seed"];
    if (st.stage === "rotten") return ["clearRot", "Clear the rotten pumpkin"];
    if (st.stage === "ripe") return ["harvest", "Harvest"];
    return null;
  }
  if (st.haunted) return ["chaseHelp", "Chase the ghost away (+1 candy)"];
  if (st.stage === "ripe" && st.stealable) return ["steal", "Steal 1 candy"];
  if (st.stage === "sprout" || st.stage === "growing") {
    return tile.helpedBy?.includes(state.meId) ? null : ["water", "Water it (+1 candy)"];
  }
  return null;
}

function tileHtml(ownerId, tile, i, t, area) {
  const st = E.tileState(tile, t);
  const act = tileAction(ownerId, tile, st);
  const kind = st.secret ? "secret" : st.kind;
  const mineTile = ownerId === state.meId;
  let crop = "";
  if (st.stage === "rotten") crop = `<img class="crop" alt="" src="${A("crops/rotten.png")}">`;
  else if (st.stage !== "empty" && st.stage !== "ghost") crop = `<img class="crop${st.rot === "off" ? " off" : ""}" alt="" src="${cropSrc(ownerId, kind, st.stage)}">`;
  const flies = st.rot === "off" ? '<span class="flies" aria-hidden="true"><i></i><i></i></span>' : "";
  const ghost = st.haunted ? `<img class="ghost" alt="ghost" src="${A("props/ghost.png")}">` : "";
  const seenGuard = guardSeen(ownerId, i, tile, st);
  const guard = seenGuard ? `<img class="guard" alt="guard ghost" src="${A("props/guard-ghost.png")}">` : "";
  let note = "";
  if (st.stage === "sprout" || st.stage === "growing") note = fmtLeft(st.ripeAt - t);
  else if (st.stage === "ripe" && !mineTile && !st.stealable && st.stealOpensAt > t) note = `{hourglass}${fmtLeft(st.stealOpensAt - t)}`;
  else if (st.stage === "ripe" && mineTile && st.rot === "off") note = "going off";
  else if (st.stage === "rotten" && mineTile) note = "rotten";
  const myGhost = mineTile && st.haunted && state.mode === "play";
  const risky = act && act[0] === "steal";
  const risk = risky ? riskFor(ownerId, tile, t, i) : null;
  // A neighbour's ripe pumpkin shows what it's worth right now (rot halves it).
  const value = !mineTile && st.stage === "ripe" ? `<span class="value" title="Worth ${st.value} candy now">${ico("candy")}${st.value}</span>` : "";
  const riskBadge = risk
    ? `<span class="risk${risk.why.length ? " raised" : ""}" title="${risk.chance}% chance a ghost catches you${risk.why.length ? ` — ${esc(risk.why.join(", "))}` : ""}">${ico("ghost", "catch chance")}${risk.chance}%</span>`
    : "";
  const shoo = myGhost ? `<span class="shoo" title="Tap to shoo it (${E.RULES.ghostChaseCost} candy)">shoo ${E.RULES.ghostChaseCost}${ico("candy")}</span>` : "";
  const soil = `<img class="soil" alt="" src="${A(tile && tile.helpedBy && tile.helpedBy.length ? "tiles/soil-watered.png" : "tiles/soil.png")}">`;
  const marks = mineTile && state.mode === "play" ? marksHtml(i, tile, area) : "";
  const inner = `${soil}${crop}${flies}${guard}${ghost}${note && !myGhost ? `<span class="note">${iconHtml(note)}</span>` : ""}${value}${riskBadge}${shoo}`;
  const label = `${st.stage}${st.kind ? ` ${st.kind}` : ""}${st.rot === "off" ? ", going off" : ""}${seenGuard ? ", guarded" : ""}${st.haunted ? ", haunted" : ""}`;
  const pull = act && PULL_ACTS.has(act[0]);
  const verb = act && act[1];
  const cls = `tile${myGhost ? " haunted-mine" : ""}${st.rot === "off" ? " going-off" : ""}`;
  const riskAttrs = risk ? ` data-risk="${risk.chance}" data-why="${esc(risk.why.join(" · "))}"` : "";
  // Every cell is placed explicitly, so a tile's marks can share it.
  const place = area ? ` style="grid-area:${area}"` : "";
  return (act
    ? `<button class="${cls} act-${act[0]}" data-owner="${esc(ownerId)}" data-i="${i}" data-act="${act[0]}"${pull ? " data-pull" : ""}${riskAttrs}${place} title="${esc(verb)}" aria-label="${esc(`${verb} — ${label}`)}">${inner}</button>`
    : `<div class="${cls}" data-owner="${esc(ownerId)}" data-i="${i}" data-stage="${st.stage}"${place} aria-label="${esc(label)}">${inner}</div>`) + marks;
}

// ── farm expansion: buy a bigger field ────────────────────
function expandHtml(plot, p) {
  const ex = RULES.expansion;
  if (!ex.on || state.mode !== "play") return "";
  const next = E.nextSize(plot, ex);
  if (!next) return "";
  const short = (p?.candy ?? 0) < ex.cost;
  return `<p class="expand-row"><button type="button" class="btn" id="expand" data-next="${next.cols}x${next.rows}"${short ? " disabled" : ""} title="${esc(short ? `You need ${ex.cost} candy` : `Grow your field to ${next.cols}×${next.rows}`)}">Expand field — ${ex.cost} ${ico("candy")}</button></p>`;
}

function farmHtml(id, t) {
  const me = id === state.meId;
  const entry = state.plots.get(id);
  const plot = entry ? entry.plot : E.newPlot();
  const p = state.players.get(id)?.player;
  const scare = farmOf(id)?.scarecrow || "classic";
  // A neighbour's guards: how many, never where.
  const lurking = me ? 0 : E.activeGuards(plot, t);
  let lurk = lurking
    ? `<p class="lurking" role="note">${ico("ghost")} ${lurking === 1 ? "1 guard ghost is" : `${lurking} guard ghosts are`} lurking somewhere on this farm</p>`
    : "";
  const field = fieldOf(plot);
  if (id === PRACTICE_ID) lurk = `<p class="lurking practice-note" role="note">Practice only — just you can see this patch, and nothing here counts.</p>`;
  return `<section class="farm${me ? " me" : ""}${field.cols > 3 ? " wide" : ""}" data-owner="${esc(id)}" data-size="${field.cols}x${field.rows}">${lurk}
    <header><img class="avatar" alt="" src="${avatarSrc(id)}"><b>${esc(farmName(id))}</b>${me ? '<span class="you">you</span>' : `<span class="who">${esc(nameOf(id))}</span>`}<span class="candy">${ico("candy")}${p?.candy ?? 0}</span></header>
    <div class="plot"><div class="grid" style="--cols:${field.cols};--rows:${field.rows}">${field.cells.map((i, n) => tileHtml(id, plot.tiles[i], i, t, `${Math.floor(n / field.cols) + 1}/${(n % field.cols) + 1}`)).join("")}</div><img class="scarecrow sc-${esc(scare)}" alt="" src="${A("props/scarecrow.png")}"></div>
    ${me ? expandHtml(plot, p) : ""}
  </section>`;
}

// ── clicks ──
const moveOutClick = inside("#move-out", () => {
  $("#move-out-name").textContent = farmName(state.meId);
  $("#move-out-dlg").showModal();
});

export { farmHtml, loadRevealed, moveOutClick, reveal, riskFor };
