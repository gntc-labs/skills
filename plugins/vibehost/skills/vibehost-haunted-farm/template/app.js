// Haunted Farm — the village page's entry module: it boots the page and keeps
// it polling. The page talks to App Data through the platform SDK
// (/__vh/data/sdk.js → window.VibeHostData) and runs every game rule in
// engine.js (pure); fx.js draws. The rest is split by job: core, sync (pure),
// read, data, farms, art-check, actions, pull, render, events + clicks, and
// views/ (map, farm, marks, hud, feed, away, tutorial, invite, settings, setup).
//
// One village app per workspace, one link per farm, districts of 8 lots:
//   /                 the village map: a house per farm (plus the setup form
//                     if you have no farm yet)
//   /farm/<slug>      that farm — yours, or a neighbour's to steal from / help
//   /setup#<base64url JSON>   writes farms/<you> from a skill-made link
// The site's vibehost.json rewrites /farm/* and /setup to this page.
//
// Data: farms/<userId> (with its district + lot), players/<userId>, and
// plots stored PER DISTRICT in plots-d<district>/<userId>. A page loads only
// what it shows: the map lists the viewed district's plots; a farm page gets
// that one farm's plot (and yours, which a steal writes a ghost onto).
//
// Modes:
//   play   — me.player: the full game
//   watch  — signed out / not a member / password: read-only, the "Play"
//            button goes to /how-to-play.html?reason=…
//   rest   — no SDK, /me failed, flag off: "the village is resting"
// There is no season and no end: the village runs indefinitely.
// Every listener (clicks, keys, the feed sheet, moving out) is wired in events.js.

import { $, CFG, state } from "./core.js";
import { backoff, ensureMine, enterRest, refresh } from "./data.js";
import { farmOf, migrateMyArt, runSetupLink, viewedFarmId } from "./farms.js";
import { render } from "./render.js";
import { showAway } from "./views/away.js";
import { loadRevealed } from "./views/farm.js";
import { feedSeen } from "./views/feed.js";
import { replayTutorial, tutorialDid } from "./views/tutorial.js";

import "./events.js";

// check.mjs replays stale lists and quick double clears through these.
window.__hauntedFarmHooks = {
  refresh: () => refresh(),
  tutorialDid: (key) => tutorialDid(key),
  // check.mjs: the polling state, and "nobody has touched it for ms".
  poll: () => ({ paused: !poll.timer, delay: pollDelay() }),
  idleFor: (ms) => {
    poll.lastInput = performance.now() - ms;
    schedulePoll();
  },
};

// ── boot ──────────────────────────────────────────────────────────────

async function boot() {
  $("#title").textContent = CFG.name;
  if (!window.VibeHostData) return enterRest();
  try {
    state.vh = await window.VibeHostData.connect();
  } catch {
    return enterRest();
  }
  if (state.vh.player && state.vh.user) {
    state.mode = "play";
    state.meId = state.vh.user.id;
    state.revealed = loadRevealed();
    state.feedSeenAt = feedSeen();
    try {
      await ensureMine();
    } catch {
      return enterRest();
    }
  } else if (!state.vh.reason) {
    // Not a player and no reason: the workspace is frozen. Rest, don't tease.
    return enterRest();
  } else {
    state.mode = "watch";
    state.reason = state.vh.reason;
  }
  if (state.route.view === "setup" && state.mode !== "play") state.route = { view: "home" };
  if (location.hash === "#new-house") {
    state.newHouse = true;
    history.replaceState(null, "", "/");
  }
  await refresh();
  if (state.route.view === "setup") await runSetupLink();
  if (state.mode === "play") migrateMyArt().catch(() => {});
  // "Replay tutorial" from how-to-play.html lands here as /?tutorial=replay.
  if (new URLSearchParams(location.search).get("tutorial") === "replay") {
    history.replaceState(null, "", location.pathname + location.hash);
    await replayTutorial();
  }
  if (state.mode === "play" && farmOf(state.meId) && (state.route.view === "home" || viewedFarmId() === state.meId)) showAway();
  // Land on the map with your house in view (the map may scroll sideways).
  document.querySelector(".house.mine")?.scrollIntoView({ block: "nearest", inline: "center" });
  // Countdowns run in seconds, so the village redraws every second (an SDK
  // may ask for another cadence with tickMs).
  const tick = state.vh && state.vh.tickMs ? Math.max(500, state.vh.tickMs) : 1000;
  schedulePoll();
  setInterval(() => document.hidden || render(), tick);
}

// ── polling: only while someone's looking ─────────────────────────────
// Every open tab lists the village: every 5 s while someone's here (a 30 s
// steal window shows within one poll), every 15 s once nobody has touched it
// for 2 minutes, paused while the tab is hidden (one refresh the moment it's
// back), and back to the usual pace on the next touch.
const poll = { every: 5_000, idleEvery: 15_000, idleAfter: 2 * 60_000, timer: 0, lastInput: performance.now() };
// Never sooner than a 429's retryAfter allows.
const pollDelay = () => Math.max(performance.now() - poll.lastInput > poll.idleAfter ? Math.max(poll.every, poll.idleEvery) : poll.every, backoff.until - Date.now());
function schedulePoll() {
  clearTimeout(poll.timer);
  poll.timer = 0;
  if (document.hidden || !state.vh) return;
  poll.timer = setTimeout(async () => {
    await refresh();
    schedulePoll();
  }, pollDelay());
}
for (const type of ["pointerdown", "keydown", "wheel", "touchstart"]) {
  document.addEventListener(
    type,
    () => {
      const wasIdle = performance.now() - poll.lastInput > poll.idleAfter;
      poll.lastInput = performance.now();
      if (wasIdle) schedulePoll(); // back to the usual pace right away
    },
    { capture: true, passive: true },
  );
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return schedulePoll(); // clears it
  refresh().then(schedulePoll);
});

boot();
