// Haunted Farm — drawing the page: render() rebuilds the HUD, banner and farms
// from `state`, keeps keyboard focus, and listen() turns changes into sounds.

import * as E from "./engine.js";
import * as FX from "./fx.js";
import { $, CFG, esc, now, say, state, VILLAGE_BTN } from "./core.js";
import { meP } from "./data.js";
import { farmOf, viewedFarmId } from "./farms.js";
import { farmHtml } from "./views/farm.js";
import { feedBarHtml, feedOn, feedRendered } from "./views/feed.js";
import { bannerHtml, hudHtml, reTip } from "./views/hud.js";
import { fitMap, mapHtml } from "./views/map.js";
import { placeMarkPop } from "./views/marks.js";
import { syncSettings } from "./views/settings.js";
import { setupHtml } from "./views/setup.js";
import { coach, nothingToPinch, practiceRowHtml, stealStepOpen, syncPractice } from "./views/tutorial.js";

// Resizing only re-fits the map and re-anchors what floats (the coach, an
// open tip, the thief pop-up) — once it settles, without a full redraw.

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    fitMap();
    coach();
    reTip();
    placeMarkPop();
  }, 120);
});

/**
 * Sounds for what changes on screen by itself: a crop on the farm you're
 * looking at turning ripe (twinkle) or going off / rotting (bwomp), and my
 * candy counter moving (ticks). The first look only takes a baseline.
 */
function listen(viewed, t) {
  const stages = new Map();
  const plot = state.route.view === "farm" && viewed ? state.plots.get(viewed)?.plot : null;
  (plot?.tiles ?? []).forEach((tile, i) => {
    const st = E.tileState(tile, t);
    stages.set(`${viewed}:${i}`, st.stage === "ripe" && st.rot === "off" ? "off" : st.stage);
  });
  const was = state.heard.stages;
  if (was) {
    let ripe = false;
    let rot = false;
    for (const [k, now2] of stages) {
      const before = was.get(k);
      if (!before) continue;
      if ((before === "sprout" || before === "growing") && now2 === "ripe") ripe = true;
      if ((before === "ripe" && (now2 === "off" || now2 === "rotten")) || (before === "off" && now2 === "rotten")) rot = true;
    }
    if (ripe) FX.sfx("ripe");
    if (rot) FX.sfx("rot");
  }
  state.heard.stages = stages;
  const candy = meP()?.player.candy;
  if (candy != null && state.heard.candy != null && candy !== state.heard.candy) {
    FX.sfx("tick", { count: Math.abs(candy - state.heard.candy) });
    // The live region speaks only this; the HUD itself redraws silently.
    say(`${candy > state.heard.candy ? "+" : "−"}${Math.abs(candy - state.heard.candy)} candy — ${candy} in all.`, { append: true });
  }
  state.heard.candy = candy ?? null;
}

// A redraw replaces the HUD, the map and the farm: whatever had keyboard
// focus there gets it back (found again by what it is, not by node).
const REDRAWN = "#hud, #banner, #farms, #top-village";
function focusKey() {
  const el = document.activeElement;
  if (!el || el === document.body || !el.closest(REDRAWN)) return null;
  const css = (v) => CSS.escape(v);
  const d = el.dataset;
  if (el.id) return `#${css(el.id)}`;
  if (d.markI !== undefined) return `.mark[data-mark-i="${css(d.markI)}"][data-mark-k="${css(d.markK)}"]`;
  if (d.i !== undefined && d.owner) return `.tile[data-owner="${css(d.owner)}"][data-i="${css(d.i)}"]`;
  if (d.owner) return `${el.tagName.toLowerCase()}.${css(el.classList[0] || "x")}[data-owner="${css(d.owner)}"]`;
  if (d.chip) return `[data-chip="${css(d.chip)}"]`;
  return null;
}
function restoreFocus(key) {
  if (!key) return;
  const el = document.querySelector(key);
  if (el && el !== document.activeElement && el.closest(REDRAWN)) el.focus({ preventScroll: true });
}

/** The tab says when one of my crops is ripe (a pumpkin + "Ready!"), and goes back once none is. */
function readyTitle(t) {
  const ripe = state.mode === "play" && (state.plots.get(state.meId)?.plot.tiles ?? []).some((tile) => E.tileState(tile, t).stage === "ripe");
  const title = ripe ? `\u{1F383} Ready! · ${CFG.name}` : CFG.name;
  if (document.title !== title) document.title = title;
}

function render() {
  if (state.freeze > 0) {
    state.dirty = true;
    return;
  }
  state.dirty = false;
  const t = now();
  const refocus = focusKey();
  syncPractice();
  readyTitle(t);
  document.body.dataset.mode = state.mode;
  const route = state.route;
  const viewed = viewedFarmId();
  document.body.dataset.view = route.view !== "farm" ? "map" : !viewed ? "missing" : viewed === state.meId ? "mine" : "neighbour";
  $("#hud").innerHTML = hudHtml(t);
  syncSettings();
  reTip();
  $("#banner").innerHTML = bannerHtml(t);
  let main = "";
  if (state.mode === "rest") {
    main = "";
  } else if (route.view === "farm") {
    if (!viewed) main = `<div class="banner">There's no farm called “${esc(route.slug)}” in this village. ${VILLAGE_BTN}</div>`;
    else if (viewed === state.meId) main = `${feedOn() ? feedBarHtml(t) : ""}${farmHtml(viewed, t)}${state.mode === "play" ? '<p class="move-out-row"><button type="button" id="move-out">Move out of the village…</button></p>' : ""}`;
    else main = `${feedOn() ? feedBarHtml(t) : ""}${VILLAGE_BTN}${farmHtml(viewed, t)}`;
  } else {
    // The map; a farmer with no farm yet gets the setup form above it.
    const needsSetup = state.mode === "play" && !farmOf(state.meId);
    const practiceRow = stealStepOpen() && nothingToPinch(t) ? practiceRowHtml() : "";
    main = `${needsSetup ? setupHtml(null) : ""}${feedOn() ? feedBarHtml(t) : ""}${practiceRow}${mapHtml(t)}`;
  }
  // A background refresh never wipes what the farmer is typing in setup.
  const typing = document.getElementById("setup") && main.includes('id="setup"');
  if (typing) {
    const map = document.querySelector("#farms .village-map");
    if (map) map.outerHTML = mapHtml(t);
  } else {
    const scroll = document.querySelector("#farms .map-wrap")?.scrollLeft ?? null;
    $("#farms").innerHTML = main;
    if (scroll !== null && document.querySelector("#farms .map-wrap")) document.querySelector("#farms .map-wrap").scrollLeft = scroll;
  }
  state.newHouse = false;
  listen(viewed, t);
  // On a farm page a phone has its Village button in the header row.
  $("#top-village").innerHTML = route.view === "farm" && state.mode !== "rest" ? VILLAGE_BTN : "";
  document.body.dataset.page = route.view === "farm" ? "farm" : "map";
  fitMap();
  feedRendered(t);
  coach();
  restoreFocus(refocus);
  state.renders = (state.renders || 0) + 1; // check.mjs: a resize doesn't redraw
  window.__hauntedFarm.ready = true;
}

export { render };
