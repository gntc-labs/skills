// Haunted Farm — the HUD: readable counters with tips, the banner, the Play button.

import * as E from "../engine.js";
import { inside, NEXT } from "../clicks.js";
import { $, CFG, esc, ico, pct, state, VILLAGE_BTN } from "../core.js";
import { meP, mine } from "../data.js";
import { viewedFarmId } from "../farms.js";
import { render } from "../render.js";

function bannerHtml(t) {
  if (state.mode === "rest") {
    return `<div class="banner"><b>The village is resting.</b> The farmers are asleep for now — come back a little later. <a class="btn" href="/how-to-play.html?reason=RESTING">What's going on?</a></div>`;
  }
  if (state.mode === "watch") {
    const why = { SIGNED_OUT: "You're watching.", NOT_MEMBER: "You're visiting another team's village.", PASSWORD_REQUIRED: "You're watching." }[state.reason] || "You're watching.";
    return `<div class="banner">${why} Only this village's team can farm here. <button class="btn" id="play">Play</button></div>`;
  }
  return "";
}

// ── the HUD: readable counters ─────────────────────────────
// Every chip says what it counts in words (remaining, not used), and has a
// one-sentence tip: hover or focus on a desktop, a tap on a phone. Desktop
// shows the long wording, a phone the short one (CSS picks, by .long/.short).

/** When the daily counters reset, in words that are true here. */
const resetsWhen = () =>
  CFG.mock ? "at midnight Taipei time — in game time, which runs fast in this try-out" : "at midnight Taipei time";

function chip(key, long, short, tip, { cls = "", tag = "span", attrs = "" } = {}) {
  const t = esc(tip);
  return tag === "button"
    ? `<button type="button" class="chip ${cls}" data-chip="${key}" data-tip="${t}" aria-describedby="hud-tip"${attrs}><span class="long">${long}</span><span class="short">${short}</span></button>`
    : `<span class="chip ${cls}" data-chip="${key}" data-tip="${t}" tabindex="0" role="button" aria-describedby="hud-tip"${attrs}><span class="long">${long}</span><span class="short">${short}</span></span>`;
}

function hudHtml(t) {
  const me = meP()?.player;
  if (!me || state.mode !== "play") return ""; // no season, no countdown
  const p = E.freshDay(me, t);
  const stealsLeft = Math.max(0, E.RULES.dailyStealCap - p.stealsToday);
  const helpsLeft = Math.max(0, E.RULES.dailyHelpCap - p.helpsToday);
  const candy = chip(
    "candy",
    `${ico("candy", "")} ${p.candy} candy`,
    `candy ${p.candy}`,
    "Your candy: earned by harvesting, stealing and helping; spent on seeds, guard ghosts and shooing ghosts. It never resets.",
    { cls: "candy", attrs: ' id="hud-candy"' },
  );
  const counter = (key, icon, word, n, cap, tipWhat) =>
    chip(
      key,
      n ? `${icon} ${n} ${word}${n === 1 ? "" : "s"} left` : `${icon} 0 ${word}s left · resets 00:00`,
      // A phone has no room for "· resets 00:00" (the tip says it): ↻ marks it.
      n ? `${word} ${n}` : `${word} 0 ↻`,
      `${tipWhat} — ${cap} a day; ${n} left today. Resets ${resetsWhen()}.`,
      { cls: `count${n ? "" : " out"}` },
    );
  const steals = counter("steals", ico("sack", ""), "steal", stealsLeft, E.RULES.dailyStealCap, "Steals: pinching a ripe pumpkin from a neighbour's farm");
  const helps = counter("helps", ico("water", ""), "help", helpsLeft, E.RULES.dailyHelpCap, "Helps: watering a neighbour's pumpkin or chasing a ghost off their farm (+1 candy each)");
  const onMyFarm = state.route.view === "farm" && viewedFarmId() === state.meId;
  const guardsLeft = onMyFarm ? Math.max(0, E.RULES.maxGuards - E.activeGuards(mine()?.plot ?? E.newPlot(), t)) : 0;
  const guardBtn = onMyFarm
    ? chip(
        "guards",
        state.guardMode ? `${ico("ghost", "")} Pick a pumpkin…` : `${ico("ghost", "")} Guard: ${guardsLeft} left`,
        state.guardMode ? "pick…" : `guard ${guardsLeft}`,
        `Guard ghosts: tap, then a pumpkin, to post one (${E.RULES.guardCost} candy, ${pct(E.RULES.guardCatchChance)}% catch chance there, ${E.RULES.guardLastsMs / E.HOUR} hours). Up to ${E.RULES.maxGuards} on your farm; only you can see them.`,
        { tag: "button", cls: `hudbtn${state.guardMode ? " on" : ""}`, attrs: ` id="guard-mode" aria-pressed="${state.guardMode}"` },
      )
    : "";
  // On my own farm the way back to the map lives in the HUD (a phone has it in the title row).
  const village = onMyFarm ? VILLAGE_BTN : "";
  return `${candy}${steals}${helps}${guardBtn}${village}`;
}

// ── the chip tips: one popover, shown on hover/focus, pinned by a tap ──
function showTip(el, pinned = false) {
  const tip = $("#hud-tip");
  if (!el || !el.dataset.tip) return hideTip();
  tip.textContent = el.dataset.tip;
  tip.hidden = false;
  state.tip = { key: el.dataset.chip, pinned };
  const r = el.getBoundingClientRect();
  const w = Math.min(300, window.innerWidth - 16);
  tip.style.width = `${w}px`;
  tip.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${r.bottom + window.scrollY + 6}px`;
}
function hideTip() {
  $("#hud-tip").hidden = true;
  state.tip = null;
}
/** After the HUD redraws, keep an open tip on its (new) chip. */
function reTip() {
  if (!state.tip) return;
  const el = document.querySelector(`#hud [data-chip="${state.tip.key}"]`);
  if (el) showTip(el, state.tip.pinned);
  else hideTip();
}
document.addEventListener("pointerover", (ev) => {
  // Hover never overrides a tip that was tapped open (pinned).
  if (ev.pointerType !== "mouse" || (state.tip && state.tip.pinned)) return;
  const el = ev.target.closest("#hud [data-tip]");
  if (el) showTip(el);
  else if (state.tip && !state.tip.pinned) hideTip();
});
document.addEventListener("focusin", (ev) => {
  if (state.tip && state.tip.pinned) return; // focus never overrides a tapped-open tip either
  const el = ev.target.closest?.("#hud [data-tip]");
  if (el) showTip(el);
});
document.addEventListener("focusout", (ev) => {
  if (ev.target.closest?.("#hud [data-tip]") && state.tip && !state.tip.pinned) hideTip();
});

// ── clicks ──
// Only a tap sends a visitor to the explainer — never on page load, so a
// public visitor still gets to look at the village.
const playClick = inside("#play", () => {
  location.href = `/how-to-play.html?reason=${encodeURIComponent(state.reason || "SIGNED_OUT")}`;
});
const hudClicks = [
  {
    match: (ev) => {
      const el = ev.target.closest("#hud [data-tip]");
      return el && el.id !== "guard-mode" ? el : null;
    },
    run: (tipChip) => {
      if (state.tip && state.tip.key === tipChip.dataset.chip && state.tip.pinned) hideTip();
      else showTip(tipChip, true);
    },
  },
  { match: (ev) => state.tip && state.tip.pinned && !ev.target.closest("#hud-tip"), run: () => (hideTip(), NEXT) },
  inside("#guard-mode", () => {
    state.guardMode = !state.guardMode;
    render();
  }),
];

export { bannerHtml, hudClicks, hudHtml, playClick, reTip };
