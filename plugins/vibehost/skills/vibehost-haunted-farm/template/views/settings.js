// Haunted Farm — the settings menu (one pixel gear) and How to play.

import * as FX from "../fx.js";
import { inside, NEXT } from "../clicks.js";
import { $, A, ICONS, RULES, state } from "../core.js";
import { farmOf } from "../farms.js";
import { render } from "../render.js";
import { replayTutorial } from "./tutorial.js";

/** How to play only tells the rules this village has on, with its own numbers. */

(function rulesCopy() {
  const on = { expansion: RULES.expansion.on, customAvatar: RULES.customAvatar, cropSkins: RULES.cropSkins };
  for (const el of document.querySelectorAll("[data-rule]")) if (!on[el.dataset.rule]) el.remove();
  for (const el of document.querySelectorAll('[data-fill="cost"]')) el.textContent = RULES.expansion.cost;
  for (const el of document.querySelectorAll('[data-fill="max"]')) el.textContent = `${RULES.expansion.maxCols}×${RULES.expansion.maxRows}`;
})();

// ── settings: one pixel gear in the header's top-right ─────
// It opens a small framed menu — Sound, Music, Replay tutorial, How to play.
// The menu is static markup (index.html), so a redraw never closes it; this
// only keeps its toggles in step with fx.js (which remembers them).

function syncSettings() {
  const toggle = (sel, on, kind) => {
    const b = $(sel);
    const name = `${kind}-${on ? "on" : "off"}`;
    const img = b.querySelector("img");
    b.setAttribute("aria-checked", String(on));
    img.src = A(ICONS[name][0]);
    img.dataset.icon = name;
    b.querySelector(".state").textContent = on ? "on" : "off";
  };
  toggle("#mute", !FX.isMuted(), "sound");
  toggle("#ambience", FX.ambienceOn(), "music");
  $("#menu-replay").hidden = !(state.mode === "play" && farmOf(state.meId));
}
const settingsOpen = () => !$("#settings-menu").hidden;
function openSettings(open, { focus = true } = {}) {
  $("#settings-menu").hidden = !open;
  $("#gear").setAttribute("aria-expanded", String(open));
  if (open) {
    syncSettings();
    if (focus) $("#settings-menu button").focus({ preventScroll: true });
  }
}
function openRules() {
  const replay = document.querySelector("#rules .replay");
  if (replay) replay.hidden = !(state.mode === "play" && farmOf(state.meId));
  $("#rules").showModal();
}

// ── clicks ──
const menuClicks = [
  inside("#gear", (_, ev) => openSettings(!settingsOpen(), { focus: ev.detail === 0 })), // a keyboard press lands in the menu
  // The toggles leave the menu open (try one, then the other); the rest close it.
  inside("#mute", () => {
    FX.setMuted(!FX.isMuted());
    render();
  }),
  inside("#ambience", () => {
    FX.wakeAudio();
    FX.setAmbience(!FX.ambienceOn());
    render();
  }),
  inside("#menu-replay", () => {
    openSettings(false);
    replayTutorial();
  }),
  inside("#menu-rules", () => {
    openSettings(false);
    openRules();
  }),
  // A click anywhere else closes the menu — and still does what it was for.
  { match: (ev) => settingsOpen() && !ev.target.closest("#settings"), run: () => (openSettings(false), NEXT) },
];
const rulesClicks = [
  // The rules open over the village: no navigation, no reload, no flicker.
  inside("#open-rules", (_, ev) => {
    ev.preventDefault();
    openRules();
  }),
  { match: (ev) => ev.target.closest("#rules-close") || ev.target === $("#rules"), run: () => $("#rules").close() },
];

export { menuClicks, openSettings, rulesClicks, settingsOpen, syncSettings };
