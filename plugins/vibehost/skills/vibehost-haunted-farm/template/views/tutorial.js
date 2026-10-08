// Haunted Farm — the first-run tour (coach marks) and its Practice Patch.

import * as E from "../engine.js";
import * as FX from "../fx.js";
import { seqRand } from "../actions.js";
import { inside } from "../clicks.js";
import { $, A, firstVisible, iconHtml, now, pct, state, toast } from "../core.js";
import { meP, mine, updateMyFarm } from "../data.js";
import { farmOf } from "../farms.js";
import { render } from "../render.js";
import { durText, TUTORIAL_STEPS } from "../shared.js";
import { freshTutorial, mergeTutorial } from "../sync.js";
import { ripeAndStealable } from "./map.js";

// When the tutorial's steal step has nothing real to pinch, a scarecrow's
// farm with one ripe pumpkin stands in — for me only, only while the
// tutorial runs. It lives in this page alone: never in App Data, never on
// the map, never in anyone's feed. A pinch there plays the real pull,
// Trick / Treat and BOO, and writes nothing shared (only my tutorial
// progress moves on). It is not a computer-run farm: nobody plays it.

const PRACTICE_ID = "~practice";
const PRACTICE_SLUG = "_practice"; // no real link name starts with "_"
const practice = { plot: null };
/** It exists while my tutorial runs; the map offers it while the steal step is still to do. */
const practiceOn = () => !!tutorial();
function stealStepOpen() {
  const t = tutorial();
  return !!t && !(t.cleared || []).includes(TUTORIAL.find((x) => x.key === "steal").n);
}
/** No real neighbour on screen has anything to pinch right now. */
const nothingToPinch = (t) => ![...state.farms.keys()].some((id) => id !== state.meId && id !== PRACTICE_ID && ripeAndStealable(id, t));
/** Put the patch into (or take it out of) what the page draws from. */
function syncPractice() {
  if (!practiceOn()) {
    practice.plot = null;
    for (const m of [state.farms, state.plots, state.players]) m.delete(PRACTICE_ID);
    return;
  }
  if (!practice.plot) {
    // One Common, ripe and past the owner's grace time.
    const k = E.RULES.kinds.common;
    const at = now() - k.growMs - E.RULES.stealOpensAfterMs - E.MIN;
    practice.plot = E.plant({ player: { candy: k.cost }, plot: E.newPlot(), i: 4, kind: "common", now: at, rand: () => 1 }).plot;
  }
  state.farms.set(PRACTICE_ID, { version: 0, farm: { name: "Practice Patch", slug: PRACTICE_SLUG, avatar: 1, scarecrow: "classic" } });
  state.plots.set(PRACTICE_ID, { version: 0, plot: practice.plot, acts: [] });
  state.players.set(PRACTICE_ID, { version: 0, player: { ...E.newPlayer({ name: "The scarecrow" }, now()), candy: 0 }, acts: [] });
}
/** A pinch on the Practice Patch: the real rules and dice on copies — nothing is written. */
function practiceSteal(i, roll) {
  const at = now();
  const r = E.steal({ thief: meP().player, thiefId: state.meId, thiefPlot: mine().plot, victimId: PRACTICE_ID, victimPlot: practice.plot, i, now: at, rand: seqRand(roll) });
  if (r.outcome === "success") {
    practice.plot = r.victimPlot;
    return { fx: "treat", practice: true, say: "Treat! +1 practice candy — on a real farm it would be yours." };
  }
  return { fx: "trick", practice: true, owner: PRACTICE_ID, ownerName: "The scarecrow", guarded: false, ghostTile: null };
}
const practiceRowHtml = () =>
  `<p class="practice-row"><a class="btn practice-go" href="/farm/${PRACTICE_SLUG}"><img class="ico" alt="" src="${A("props/scarecrow.png")}" width="24" height="24"> Practice Patch — try a pinch</a><small>Only you see it, and only in the tour. Nothing there counts.</small></p>`;
// What each step says; their order (and numbers) come from TUTORIAL_STEPS.
const TUTORIAL_TEXT = {
  plant: { text: `Tap to plant a free Common pumpkin. Tap it again to water it: ${pct(E.RULES.helpBoost)}% sooner.` },
  village: { text: "Your neighbours live here. {pumpkin} over a house means something is ripe to pinch.", ok: true },
  steal: { text: `Tap to pinch ${E.RULES.stealAmount} {candy}. ${pct(1 - E.RULES.stealSuccessChance)}% chance a ghost catches you.` },
  guard: { text: "Hide a guard ghost on your pumpkin. Thieves who step on it get a BOO!" },
  harvest: { text: `Tap to harvest. Leave it ${durText(E.goingOffAfter("common"))} and it starts going off.` },
};
const TUTORIAL = TUTORIAL_STEPS.map((key, k) => ({ n: k + 1, key, ...TUTORIAL_TEXT[key] }));
const tutorial = () => {
  const t = farmOf(state.meId)?.tutorial;
  return state.mode === "play" && t && !t.done && !t.skipped ? t : null;
};

/** Where step `s` points on THIS page, and what it says there — or null (parked / elsewhere). */
function coachTarget(s) {
  const view = document.body.dataset.view;
  const onMine = view === "mine";
  switch (s.key) {
    case "plant":
      if (onMine) return { el: firstVisible('.farm.me button.tile[data-act="plant"]'), text: s.text };
      if (view === "map") return { el: firstVisible(".map .house.mine"), text: "This is your house — tap it to visit your farm." };
      return null;
    case "village":
      return onMine ? { el: firstVisible(".to-village"), text: s.text } : null;
    case "steal":
      if (view === "neighbour") return { el: firstVisible('.farm button.tile[data-act="steal"]'), text: s.text };
      if (view === "map") {
        const ripe = [...document.querySelectorAll(".map .house:not(.mine)")].find((h) => h.querySelector(".pip.ripe"));
        if (ripe) return { el: ripe, text: "{pumpkin} Something's ripe here — tap the house to go and pinch it." };
        const patch = firstVisible(".practice-go");
        return patch ? { el: patch, text: "Nothing's ripe next door yet. Practise on the scarecrow's patch — it's just for you." } : null;
      }
      return null;
    case "guard":
      if (!onMine || (meP()?.player.candy ?? 0) < E.RULES.guardCost) return null;
      if (state.guardMode) return { el: firstVisible('.farm.me button.tile[data-act="guard"]'), text: "Now tap one of your pumpkins to hide the guard there." };
      return { el: firstVisible("#guard-mode"), text: s.text };
    case "harvest":
      return onMine ? { el: firstVisible('.farm.me button.tile[data-act="harvest"]'), text: s.text } : null;
    default:
      return null;
  }
}

/** The step to show now: the first uncleared one that has a target here (1 → 2 → the rest). */
function coachStep(t) {
  const cleared = new Set(t.cleared || []);
  for (const s of TUTORIAL) {
    if (cleared.has(s.n)) continue;
    if (s.n > 2 && !(cleared.has(1) && cleared.has(2))) return null; // 1 and 2 come first, in order
    const at = coachTarget(s);
    if (at && at.el) return { ...s, ...at };
    if (s.n <= 2) return null;
  }
  return null;
}

let coachEl = null; // the element currently spotlit
function coach() {
  const box = $("#coach");
  const t = tutorial();
  const s = t && coachStep(t);
  if (!s) {
    box.hidden = true;
    coachEl = null;
    state.coachShown = null;
    return;
  }
  const fresh = state.coachShown !== `${s.n}:${s.text}`;
  if (fresh && state.coachShown?.split(":")[0] !== String(s.n)) FX.sfx("bell", { queue: true });
  state.coachShown = `${s.n}:${s.text}`;
  coachEl = s.el;
  box.dataset.step = s.key;
  $("#coach-text").innerHTML = iconHtml(s.text);
  $("#coach-count").textContent = `${s.n}/5`;
  $("#coach-ok").hidden = !s.ok;
  box.hidden = false;
  if (fresh) s.el.scrollIntoView({ block: "center", inline: "nearest" });
  placeCoach();
}

/** Spotlight over the target; the bubble below it (or above), never off-screen. */
function placeCoach() {
  const box = $("#coach");
  if (box.hidden || !coachEl || !coachEl.isConnected) return;
  const r = coachEl.getBoundingClientRect();
  const pad = 6;
  Object.assign($("#coach-spot").style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` });
  const bubble = $("#coach-bubble");
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight - (document.getElementById("tryout")?.offsetHeight || 0);
  const bw = Math.min(320, vw - 16);
  bubble.style.width = `${bw}px`;
  const bh = bubble.offsetHeight;
  const below = r.bottom + pad + 10;
  const above = r.top - pad - 10 - bh;
  const top = below + bh <= vh - 8 ? below : above >= 8 ? above : Math.max(8, Math.min(vh - 8 - bh, below));
  bubble.style.top = `${top}px`;
  bubble.style.left = `${Math.max(8, Math.min(vw - bw - 8, r.left + r.width / 2 - bw / 2))}px`;
  bubble.dataset.side = top >= r.bottom ? "below" : "above";
}
window.addEventListener("scroll", placeCoach, { passive: true });
/** Merge a change into my tutorial (fresh copy in, merged copy out). */
const updateTutorial = (fn) => updateMyFarm((farm) => {
  const t = farm.tutorial;
  if (!t) return null;
  const next = fn(t);
  return next ? { tutorial: next } : null;
});

/** A tutorial step was done for real: clear it (and finish the tour after the last). */
async function tutorialDid(key) {
  const t = tutorial();
  const s = TUTORIAL.find((x) => x.key === key);
  if (!t || !s || (t.cleared || []).includes(s.n)) return;
  let finished = false;
  await updateTutorial((fresh) => {
    if ((fresh.cleared || []).includes(s.n)) return null;
    const next = mergeTutorial(fresh, { ...fresh, cleared: [...(fresh.cleared || []), s.n] });
    finished = next.done && !fresh.done;
    return next;
  }).catch(() => {});
  if (finished) toast("That's the tour — happy haunting!", "pumpkin");
}

async function replayTutorial() {
  if (state.mode !== "play" || !farmOf(state.meId)) return;
  state.coachShown = null;
  // An explicit restart: a new round, which outranks every copy of the old one.
  await updateMyFarm((f) => ({ tutorial: freshTutorial((f.tutorial?.round || 0) + 1) })); // beginner's luck is NOT given back
  render();
}

// ── clicks ──
const coachClicks = [
  inside("#coach-skip", () => {
    if (tutorial()) updateTutorial((t) => (t.skipped ? null : mergeTutorial(t, { ...t, skipped: true }))).catch(() => {});
    coach();
  }),
  inside("#coach-ok", () => {
    tutorialDid("village").then(() => coach());
  }),
  inside("#replay-tutorial", (_, ev) => {
    ev.preventDefault();
    if ($("#rules").open) $("#rules").close();
    replayTutorial();
  }),
];

export { coach, coachClicks, nothingToPinch, PRACTICE_ID, practiceRowHtml, practiceSteal, replayTutorial, stealStepOpen, syncPractice, tutorialDid };
