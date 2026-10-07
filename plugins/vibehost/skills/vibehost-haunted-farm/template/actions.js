// Haunted Farm — what a tap does to the docs: plant, harvest, steal, help,
// guard, expand… worked out by the engine, written through data.js, with
// conflict retries (run).

import * as E from "./engine.js";
import * as FX from "./fx.js";
import { now, rand, RULES, state, toast } from "./core.js";
import { action, meP, mine, newActionId, refresh, updateMyFarm, write } from "./data.js";
import { farmName, farmOf, nameOf } from "./farms.js";
import { render } from "./render.js";
import { playerOut, plotOut } from "./sync.js";
import { reveal } from "./views/farm.js";
import { PRACTICE_ID, practiceSteal, tutorialDid } from "./views/tutorial.js";

// The first dice roll of a steal is made when the pull STARTS (so a Trick
// can visibly stall halfway); the engine then gets that roll first.

const seqRand = (first) => {
  let used = first == null;
  return () => (used ? rand() : ((used = true), first));
};

const ACTIONS = {
  async plant(_owner, i, kind) {
    const at = now();
    const luckLeft = farmOf(state.meId)?.firstCropBoost === false;
    const r = E.plant({ player: meP().player, plot: mine().plot, i, kind, now: at, rand, beginnersLuck: luckLeft });
    await write("plots", state.meId, plotOut(r.plot, at)); // the doc that can refuse goes first
    await write("players", state.meId, playerOut(r.player, at)); // then my candy: always applies
    if (r.luck) await updateMyFarm((f) => (f.firstCropBoost === true ? null : { firstCropBoost: true })); // once, ever
    FX.sfx("plant");
    if (r.luck) toast(`Beginner's luck! Your first ${kind} pumpkin ripens in ${E.RULES.beginnersLuckMs / E.MIN} minutes.`, "pumpkin");
    else toast(r.plot.tiles[i].secret ? "Something strange sprouted…" : `Planted a ${kind} seed.`);
    await tutorialDid("plant");
    return { fx: "none" };
  },
  async harvest(_owner, i) {
    const at = now();
    const r = E.harvest({ player: meP().player, plot: mine().plot, i, now: at });
    await write("plots", state.meId, plotOut(r.plot, at));
    await write("players", state.meId, playerOut(r.player, at));
    return { fx: "harvest", candy: r.candy, say: `Harvested: +${r.candy} candy.` };
  },
  async clearRot(_owner, i) {
    const at = now();
    const r = E.clearRotten({ plot: mine().plot, i, now: at });
    await write("plots", state.meId, plotOut(r.plot, at));
    return { fx: "clear", say: "Cleared the rotten pumpkin." };
  },
  async guard(_owner, i) {
    const at = now();
    const r = E.placeGuard({ player: meP().player, plot: mine().plot, i, now: at });
    await write("plots", state.meId, plotOut(r.plot, at)); // the doc that can refuse goes first
    await write("players", state.meId, playerOut(r.player, at)); // then my candy: always applies
    return { fx: "guard", say: "A guard ghost now stands watch over that pumpkin." };
  },
  async chaseOwn(_owner, i) {
    const at = now();
    const r = E.chaseOwnGhost({ player: meP().player, plot: mine().plot, i, now: at });
    await write("plots", state.meId, plotOut(r.plot, at)); // the doc that can refuse goes first
    await write("players", state.meId, playerOut(r.player, at)); // then my candy: always applies
    return { fx: "shoo", say: "Shoo! The ghost floats away." };
  },
  async steal(owner, i, roll) {
    const at = now();
    const r = E.steal({
      thief: meP().player,
      thiefId: state.meId,
      thiefPlot: mine().plot,
      victimId: owner,
      victimPlot: state.plots.get(owner).plot,
      i,
      now: at,
      rand: seqRand(roll),
    });
    if (r.outcome === "success") {
      // The contested write goes first: if another thief beat us to this
      // version, nothing of ours has been written yet.
      await write("plots", owner, plotOut(r.victimPlot, at));
      await write("players", state.meId, playerOut(r.thief, at));
      if (r.risk.guarded) reveal(owner, i, state.plots.get(owner).plot.tiles[i]);
      return { fx: "treat", guarded: r.risk.guarded, say: `Treat! +1 candy from ${farmName(owner)}.` };
    }
    await write("plots", state.meId, plotOut(r.thiefPlot, at)); // the ghost lands first (can refuse)
    await write("players", state.meId, playerOut(r.thief, at)); // then the attempt counts: always applies
    // The owner sees who tried. Best effort: the attempt already counted, and
    // a race on that tile must never re-roll it.
    await write("plots", owner, plotOut(r.victimPlot, at)).catch(() => {});
    return {
      fx: "trick",
      owner,
      ownerName: nameOf(owner),
      guarded: r.risk.guarded,
      ghostTile: r.ghostTile,
      haunted: r.ghostTile == null ? null : r.thiefPlot.tiles[r.ghostTile],
      stealsToday: r.thief.stealsToday,
    };
  },
  async expand() {
    const r = E.expand({ player: meP().player, plot: mine().plot, rules: RULES.expansion });
    // The contested write first: a neighbour's steal on the old layout wins
    // the race and this is worked out again on the fresh plot.
    await write("plots", state.meId, plotOut(r.plot));
    await write("players", state.meId, playerOut(r.player));
    const { cols, rows } = E.plotSize(r.plot);
    FX.sfx("plant");
    toast(`Your field grew to ${cols}×${rows}!`);
    return { fx: "none" };
  },
  async water(owner, i) {
    return helpAction(owner, i, "water", "Watered! +1 candy for being kind.", "water");
  },
  async chaseHelp(owner, i) {
    return helpAction(owner, i, "chase", "You chased the ghost away. +1 candy.", "ghost");
  },
};

async function helpAction(owner, i, action, msg, icon) {
  const at = now();
  const r = E.help({ helper: meP().player, helperId: state.meId, ownerId: owner, plot: state.plots.get(owner).plot, i, action, now: at });
  await write("plots", owner, plotOut(r.plot, at));
  await write("players", state.meId, playerOut(r.helper, at));
  FX.sfx("water");
  toast(msg, icon);
  return { fx: "none" };
}

const ENGINE_MESSAGES = {
  NOT_ENOUGH_CANDY: "Not enough candy.",
  TOO_SOON: "The owner still has time to harvest.",
  PICKED_CLEAN: "This one's been picked clean.",
  DAILY_STEAL_CAP: `That's all ${E.RULES.dailyStealCap} steals for today.`,
  DAILY_HELP_CAP: `You've helped ${E.RULES.dailyHelpCap} times today — so kind!`,
  ROTTEN: "It's rotten.",
  TOO_MANY_GUARDS: `At most ${E.RULES.maxGuards} guard ghosts per farm.`,
  ALREADY_GUARDED: "A guard is already standing there.",
  MAX_SIZE: "Your field is as big as it gets.",
};

/** Run one action with conflict retries. Returns its result, or null when
 *  it was refused (the reason is toasted). */
async function run(kind, owner, i, extra) {
  if (state.busy || state.mode !== "play") return null;
  state.busy = true;
  document.body.dataset.busy = "1";
  let result = null;
  // One id for this tap, kept across retries: what already landed is never applied again.
  action.id = newActionId();
  action.landed = false;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = owner === PRACTICE_ID ? (kind === "steal" ? practiceSteal(i, extra) : null) : await ACTIONS[kind](owner, i, extra);
        // Done for real (either way a steal ends): that tutorial step is cleared.
        if (result && TUTORIAL_FOR[kind]) await tutorialDid(TUTORIAL_FOR[kind]);
        break;
      } catch (e) {
        // Someone moved first on the contested doc: re-check the rules on the
        // fresh docs — but only while nothing of this action has landed.
        if (e && e.code === "APP_DATA_VERSION_CONFLICT" && attempt < 2 && !action.landed) {
          await refresh();
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    FX.sfx("nope");
    // Codes without a written message (NOT_RIPE, OCCUPIED…) never reach the
    // player as a raw code.
    if (e instanceof E.EngineError) toast(ENGINE_MESSAGES[e.code] || (e.message !== e.code ? e.message : "That can't be done right now."));
    else if (e && e.code === "APP_DATA_RATE_LIMITED") toast("Whoa, slow down a little.");
    else if (action.landed) toast("Only part of that was saved — check your connection, then look again.");
    else if (e && e.code === "APP_DATA_VERSION_CONFLICT") toast("Someone got there first — try again.");
    else toast("Something went bump in the night. Try again.");
  } finally {
    state.busy = false;
    delete document.body.dataset.busy;
    render();
  }
  return result;
}
/** Which action clears which step (plant clears its own, inside the action). */
const TUTORIAL_FOR = { harvest: "harvest", guard: "guard", steal: "steal" };

export { run, seqRand };
