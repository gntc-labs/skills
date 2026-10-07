// Haunted Farm — the page's listeners: every click goes through the route list
// below (clicks.js), plus keys, the move-out dialog and the feed sheet.

import * as FX from "./fx.js";
import { installClicks } from "./clicks.js";
import { $, state, toast } from "./core.js";
import { moveOut } from "./farms.js";
import { closeChip, closeExpandChip, expandClicks, guardChipClicks, swallowAfterExpand, tileClick } from "./pull.js";
import { render } from "./render.js";
import { awayClicks, closeAway, stepAway } from "./views/away.js";
import { moveOutClick } from "./views/farm.js";
import { feedClicks } from "./views/feed.js";
import { hudClicks, playClick } from "./views/hud.js";
import { closeInvite, inviteClicks } from "./views/invite.js";
import { districtClick, leaveClick } from "./views/map.js";
import { closeMarkPop, markClicks, markPop } from "./views/marks.js";
import { menuClicks, openSettings, rulesClicks, settingsOpen } from "./views/settings.js";
import { coachClicks } from "./views/tutorial.js";

// Autoplay rules: no AudioContext until the first gesture. Capture phase,
// so it's awake before any handler below wants a sound.
for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, () => FX.wakeAudio(), { capture: true });

// Every click goes through these, in this order (see clicks.js).
installClicks([
  swallowAfterExpand,
  playClick,
  ...inviteClicks,
  ...markClicks,
  ...menuClicks,
  leaveClick,
  ...coachClicks,
  ...feedClicks,
  ...expandClicks,
  moveOutClick,
  districtClick,
  ...hudClicks,
  ...awayClicks,
  ...guardChipClicks,
  ...rulesClicks,
  tileClick,
]);

document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (markPop.anchor) {
    ev.preventDefault();
    return closeMarkPop();
  }
  if (closeInvite()) {
    ev.preventDefault();
    return;
  }
  if (settingsOpen()) {
    ev.preventDefault(); // Esc closes the menu, and only the menu
    openSettings(false);
    return $("#gear").focus();
  }
  if (document.getElementById("guard-chip")) return closeChip();
  if (closeExpandChip()) return $("#expand")?.focus();
  if (state.guardMode) {
    state.guardMode = false;
    render();
  }
});
$("#move-out-no").addEventListener("click", () => $("#move-out-dlg").close());
document.addEventListener("keydown", (ev) => {
  if (ev.defaultPrevented) return;
  // The away card: ← → between events, Esc dismisses (not while typing).
  if (!$("#away").hidden && !ev.target.closest?.("input, textarea")) {
    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      return stepAway(ev.key === "ArrowRight" ? 1 : -1);
    }
    if (ev.key === "Escape") return closeAway();
  }
  if (ev.key === "Escape" && state.feedOpen) {
    state.feedOpen = false;
    render();
    document.getElementById("feed-bar")?.focus();
  }
});
$("#move-out-yes").addEventListener("click", async () => {
  const b = $("#move-out-yes");
  b.disabled = true;
  try {
    await moveOut();
    location.href = "/";
  } catch (e) {
    b.disabled = false;
    $("#move-out-dlg").close();
    toast(`Couldn't move out: ${e.message || e}`);
  }
});
