// Haunted Farm — the village map: houses on their lots, pips, "For rent",
// the district switcher and the phone's neighbour list.

import * as E from "../engine.js";
import * as FX from "../fx.js";
import { avatarSrc } from "../art-check.js";
import { inside, plainClick } from "../clicks.js";
import { $, A, CFG, esc, ico, state } from "../core.js";
import { districtOf, refresh, viewDistrict } from "../data.js";
import { farmName, farmOf, farmUrl, nameOf } from "../farms.js";
import { latestThief } from "./marks.js";
import { tutorialDid } from "./tutorial.js";

// Lot centres in % of art/map/village.png (480×270), measured off the drawn
// map; listed in the order farms move in (by join order), so the first
// farmers settle around the central plaza.
const MAP_LOTS = [
  { x: 49.5, y: 19 }, // top, middle
  { x: 28, y: 47 }, // left of the plaza
  { x: 71.5, y: 48 }, // right of the plaza
  { x: 49.5, y: 75 }, // bottom, middle
  { x: 29, y: 22 }, // top left
  { x: 71.5, y: 20 }, // top right
  { x: 30, y: 76 }, // bottom left
  { x: 71, y: 75 }, // bottom right
];
// Which of the three houses a farm lives in, from its scarecrow colour (stable).
const HOUSE_FOR = { classic: 3, plum: 2, moss: 3, bone: 1, blood: 1, spirit: 2 };

const ripeAndStealable = (id, t) => (state.plots.get(id)?.plot.tiles ?? []).some((tile) => E.tileState(tile, t).stealable);

/** Pips over a house: ripe & stealable · a guard posted · they just stole from me. */
function pipsHtml(id, t) {
  const me = id === state.meId;
  const plot = state.plots.get(id)?.plot;
  const p = state.players.get(id)?.player;
  const robbed = me && state.mode === "play" ? latestThief() : null;
  const pips = [
    robbed ? `<span class="pip robbed" title="${esc(`${nameOf(robbed.by)} robbed you`)}"><img class="thief" alt="${esc(`robbed by ${nameOf(robbed.by)}`)}" src="${avatarSrc(robbed.by)}"><b>-1</b></span>` : "",
    !me && ripeAndStealable(id, t) ? `<span class="pip ripe" title="Something ripe and stealable now">${ico("pumpkin", "ripe")}</span>` : "",
    plot && E.activeGuards(plot, t) ? `<span class="pip guard" title="A guard ghost is posted">${ico("ghost", "guarded")}</span>` : "",
    !me && p && state.meId && E.inRevengeWindow(p, state.meId, t) ? `<span class="pip warn" title="They stole from your farm just now">${ico("warning", "stole from you")}</span>` : "",
  ].join("");
  return pips ? `<span class="pips">${pips}</span>` : "";
}

/** First name, at most 10 characters: the label a phone-sized map has room for. */
const shortName = (id) => (id === state.meId ? "You" : (nameOf(id).trim().split(/\s+/)[0] || "?").slice(0, 10));

function houseHtml(id, lot, t) {
  const me = id === state.meId;
  const pips = pipsHtml(id, t);
  const house = HOUSE_FOR[farmOf(id)?.scarecrow] || 1;
  const fresh = me && state.newHouse ? " pop-in" : "";
  return `<a class="house${me ? " mine" : ""}${fresh}" href="${esc(farmUrl(id))}" data-owner="${esc(id)}" style="left:${lot.x}%;top:${lot.y}%" aria-label="${esc(`${farmName(id)}${me ? " (you)" : ` — ${nameOf(id)}`}`)}">
    <img class="house-img" alt="" src="${A(`map/house-${house}.png`)}">
    <img class="face" alt="" src="${avatarSrc(id)}">
    ${pips}
    <span class="label" title="${esc(farmName(id))}"><b>${esc(farmName(id))}</b>${me ? '<i class="you">You</i>' : ""}</span>
    <span class="short">${esc(shortName(id))}</span>
    <span class="hit" aria-hidden="true"></span>
  </a>`;
}

function lotHtml(lot, freeNote, k) {
  const note = freeNote ? "<small>(Free fits 3 farmers — upgrade for more)</small>" : "";
  const sign = `<span class="sign">For rent — invite a teammate${note}</span><span class="hit" aria-hidden="true"></span>`;
  // Spectators can't invite anyone; for them it's just an empty lot. A
  // farmer's tap opens the "Invite a neighbour" card; the link
  // stays for a new-tab / middle click.
  return state.mode === "play"
    ? `<a class="lot" data-lot="${k}" data-invite href="${esc(CFG.membersUrl)}" target="_blank" rel="noopener" style="left:${lot.x}%;top:${lot.y}%">${sign}</a>`
    : `<span class="lot" data-lot="${k}" style="left:${lot.x}%;top:${lot.y}%">${sign}</span>`;
}

/**
 * The map of ONE district (8 lots). Farms sit on the lot they claimed at
 * setup. A switcher appears only when the village has more than one
 * district; every free lot shows "For rent".
 */
function mapHtml(t) {
  const placed = [...state.farms.entries()].filter(([, v]) => v.farm.district);
  const districts = Math.max(1, ...placed.map(([, v]) => v.farm.district));
  const d = viewDistrict();
  const byLot = new Map(placed.filter(([, v]) => v.farm.district === d).map(([id, v]) => [v.farm.lot, id]));
  // The plan note goes on the first empty lot only: once is enough.
  let freeNote = districts === 1 && placed.length <= 3;
  // Every free lot is joinable — a newcomer takes the first one — so every
  // gap says "For rent", in any district.
  const cells = MAP_LOTS.map((lot, k) => {
    if (byLot.has(k)) return houseHtml(byLot.get(k), lot, t);
    const html = lotHtml(lot, freeNote, k);
    freeNote = false;
    return html;
  }).join("");
  const switcher =
    districts > 1
      ? `<nav class="districts" aria-label="Districts">${Array.from({ length: districts }, (_, k) => k + 1)
          .map((n) => `<button class="district${n === d ? " on" : ""}" data-district="${n}" aria-pressed="${n === d}">${n === 1 ? "District 1" : n}${n === districtOf(state.meId) ? " ★" : ""}</button>`)
          .join('<span aria-hidden="true">·</span>')}</nav>`
      : "";
  return `<div class="village-map">${switcher}<div class="map-stage"><section class="map-wrap" aria-label="The village map, district ${d}"><div class="map" style="--segs:1"><div class="map-seg" data-district="${d}" style="background-image:url(${A("map/village.png")})">${cells}</div></div></section></div>${neighbourListHtml(d, t)}</div>`;
}

/**
 * Phone only (CSS): the district's farms as a list under the map — the map
 * is small there, the list is what you tap. Mine first and highlighted.
 */
function neighbourListHtml(d, t) {
  const ids = [...state.farms.entries()].filter(([, v]) => v.farm.district === d).map(([id]) => id);
  if (!ids.length) return "";
  ids.sort((a, b) => (a === state.meId ? -1 : b === state.meId ? 1 : (farmOf(a).lot ?? 0) - (farmOf(b).lot ?? 0)));
  const rows = ids.map((id) => {
    const me = id === state.meId;
    const plot = state.plots.get(id)?.plot;
    const ripe = me ? (plot?.tiles ?? []).some((tile) => E.tileState(tile, t).stage === "ripe") : ripeAndStealable(id, t);
    const status = ripe ? (me ? "ripe to harvest" : "ripe & stealable") : "nothing yet";
    return `<li><a class="nrow${me ? " mine" : ""}" href="${esc(farmUrl(id))}" data-owner="${esc(id)}"><img class="face" alt="" src="${avatarSrc(id)}"><span class="who"><b>${esc(farmName(id))}</b><small>${me ? "you" : esc(nameOf(id))}</small></span>${pipsHtml(id, t)}<span class="status${ripe ? " ripe" : ""}">${status}</span></a></li>`;
  });
  return `<ul class="neighbours" aria-label="Farms in this district">${rows.join("")}</ul>`;
}

/** The map is the first screen: it may be no taller than what's left of the viewport. */
function fitMap() {
  // The try-out's fixed banner takes the bottom of the screen.
  const banner = document.getElementById("tryout")?.offsetHeight || 0;
  document.documentElement.style.setProperty("--tryout-h", `${banner}px`);
  const stage = document.querySelector("#farms .map-stage");
  if (!stage) return;
  const top = stage.getBoundingClientRect().top + window.scrollY;
  document.documentElement.style.setProperty("--map-room", `${Math.max(240, window.innerHeight - banner - top - 12)}px`);
}

// ── clicks ──
// Leaving for a farm (creaky door) or back to the map (a gust of wind): the
// sound gets a moment before the page changes. A new-tab / modified click
// is left alone.
const leaveClick = {
  match: (ev) => !ev.defaultPrevented && plainClick(ev) && ev.target.closest("a.house, a.to-village"),
  run: (link, ev) => {
    ev.preventDefault();
    FX.sfx(link.classList.contains("house") ? "door" : "wind");
    // Tapping the Village button during the "village" step does that step.
    const did = link.classList.contains("to-village") && $("#coach").dataset.step === "village" && !$("#coach").hidden ? tutorialDid("village") : null;
    Promise.all([did, new Promise((ok) => setTimeout(ok, 180))]).then(() => (location.href = link.href));
  },
};
const districtClick = inside("button.district", (btn) => {
  state.district = Number(btn.dataset.district);
  refresh(); // loads that district's plots, and only those
});

export { districtClick, fitMap, leaveClick, MAP_LOTS, mapHtml, ripeAndStealable };
