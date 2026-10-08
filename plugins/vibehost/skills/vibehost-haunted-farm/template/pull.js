// Haunted Farm — the feel of a tap: the quick pull, the guard and expand
// confirm chips, the seed picker, and playing a result (Treat, Trick, BOO).

import * as E from "./engine.js";
import * as FX from "./fx.js";
import { run } from "./actions.js";
import { inside, NEXT } from "./clicks.js";
import { $, A, esc, ico, KIND_NAME, kindOf, now, pct, rand, say, state, toast } from "./core.js";
import { meP } from "./data.js";
import { farmUrl, viewedFarmId } from "./farms.js";
import { render } from "./render.js";
import { durText } from "./shared.js";
import { riskFor } from "./views/farm.js";

// One tap does it; these play the quick pull animation after the tap.

const PULL_ACTS = new Set(["harvest", "steal", "chaseOwn", "clearRot"]);

// ── tap → a quick pull ────────────────────────────────────────────────
// One tap acts. The pull is played AFTER the tap as a ~300 ms sequence
// (wobble → stretch → pop → particles → fly), while the write goes out —
// nobody waits on a hold. A tile ignores taps while its own animation runs,
// so a double tap can't harvest or steal twice.

const PULL_MS = 300;
const busyTiles = new Set();
const tileKey = (btn) => `${btn.dataset.owner}:${btn.dataset.i}`;

function unfreeze() {
  state.freeze = Math.max(0, state.freeze - 1);
  if (state.freeze === 0 && state.dirty) render();
}

function pullTransform(p, ts, sneaky, stalled) {
  // Squash & stretch: taller and thinner as it comes loose, wobbling harder
  // the closer it gets; a thief pulls crouched and tilted. A Trick stalls.
  const amp = (sneaky ? 5 : 9) * p * (stalled ? 0.35 : 1);
  const wobble = Math.sin(ts / (stalled ? 60 : 28)) * amp;
  const tilt = sneaky ? -10 * p : 0;
  return `translateY(${(-6 * p).toFixed(2)}px) rotate(${(tilt + wobble).toFixed(2)}deg) scaleY(${(1 + 0.28 * p).toFixed(3)}) scaleX(${(1 - 0.12 * p).toFixed(3)})`;
}

/** The real chance for this tile, and why — shown on every steal. */
function showRiskHint(btn, { chance = btn.dataset.risk, why = btn.dataset.why } = {}) {
  const r = btn.getBoundingClientRect();
  const d = document.createElement("div");
  d.id = "risk-hint";
  if (why) d.className = "raised";
  d.innerHTML = `${esc(chance)}% chance a ghost catches you${why ? `<small>${esc(why)}</small>` : ""}`;
  Object.assign(d.style, { left: `${r.left + r.width / 2}px`, top: `${r.top}px` });
  document.body.appendChild(d);
}
const hideRiskHint = () => document.getElementById("risk-hint")?.remove();

/** The quick pull: p runs 0 → 1 over PULL_MS (a Trick stalls at ½). */
function quickPull(h) {
  const reduce = FX.reducedMotion();
  h.btn.classList.add("pulling");
  if (h.sneaky) h.btn.classList.add("sneaky");
  return new Promise((done) => {
    const t0 = performance.now();
    const step = (ts) => {
      const p = Math.min(1, (ts - t0) / PULL_MS);
      const shown = h.caught ? Math.min(p, 0.5) : p;
      h.btn.style.setProperty("--p", shown.toFixed(3));
      if (h.crop && !reduce) h.crop.style.transform = pullTransform(shown, ts, h.sneaky, h.caught && p >= 0.5);
      if (p >= 1) return done();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function springBack(h) {
  h.btn.classList.remove("pulling", "sneaky");
  h.btn.style.removeProperty("--p");
  if (!h.crop) return;
  const from = h.crop.style.transform;
  h.crop.style.transform = "";
  if (from && !FX.reducedMotion()) {
    h.crop.animate([{ transform: from }, { transform: "scaleY(.88) scaleX(1.08)" }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(.3,1.6,.5,1)" });
  }
}

/** Tap on a tile whose action plays a pull (harvest, steal, shoo, clear) — or a confirmed guard. */
async function tapAct(btn, act = btn.dataset.act) {
  if (state.mode !== "play") return;
  const key = tileKey(btn);
  if (busyTiles.has(key)) return; // its animation is still running: ignore
  busyTiles.add(key);
  state.freeze++;
  FX.wakeAudio();
  const sneaky = act === "steal";
  const roll = sneaky ? rand() : null;
  // Roll against the REAL chance (a hidden guard counts), not the badge.
  const owner = btn.dataset.owner;
  const at = Number(btn.dataset.i);
  const risk = sneaky ? riskFor(owner, state.plots.get(owner)?.plot.tiles[at], now(), at) : null;
  const chance = sneaky ? risk.real : 0;
  const h = {
    btn,
    act,
    owner: btn.dataset.owner,
    i: Number(btn.dataset.i),
    roll,
    sneaky,
    // The same comparison the engine makes with this roll (catchChance).
    caught: sneaky && roll >= 1 - chance,
    crop: act === "guard" ? null : btn.querySelector(".crop") || btn.querySelector(".ghost"),
  };
  // A guarded tile shows no hint until its guard has popped out.
  if (sneaky && !risk.guarded) showRiskHint(btn);
  let leaving = false;
  let result = null;
  try {
    const cropRect = (h.crop || h.btn).getBoundingClientRect();
    const tileRect = h.btn.getBoundingClientRect();
    if (sneaky && risk.guarded) {
      // The steal landed on a guard: it pops out — BOO! — before the roll.
      FX.sfx("boo");
      FX.buzz([30, 20, 30]);
      await FX.booPop(tileRect, A("props/guard-ghost.png"));
      showRiskHint(btn, { chance: pct(risk.real), why: "A guard ghost!" });
    }
    const cropSrc = h.crop ? h.crop.src : A("props/candy.png");
    [result] = await Promise.all([run(act, h.owner, h.i, h.roll), act === "guard" ? null : quickPull(h)]);
    hideRiskHint();
    if (!result) springBack(h);
    else leaving = (await playResult(h, result, { cropRect, tileRect, cropSrc })) === "leave";
  } finally {
    hideRiskHint();
    if (act === "guard" && result) state.guardMode = false;
    if (!leaving) {
      busyTiles.delete(key);
      unfreeze();
      FX.bump(document.getElementById("hud-candy"));
    }
  }
}

// ── the one confirm: spending candy on a guard ghost ───────────────────

function closeChip() {
  const chip = document.getElementById("guard-chip");
  if (!chip) return;
  chip.remove();
  unfreeze();
}

function showGuardChip(btn) {
  closeChip();
  state.freeze++; // the tile stays put while the chip points at it
  const r = btn.getBoundingClientRect();
  const chip = document.createElement("div");
  chip.id = "guard-chip";
  chip.setAttribute("role", "group");
  chip.setAttribute("aria-label", "Post a guard ghost here?");
  chip.innerHTML = `<span>Post guard? ${E.RULES.guardCost} ${ico("candy")}</span><button class="yes" data-chip="yes" aria-label="Yes, post a guard for ${E.RULES.guardCost} candy">✓</button><button class="no" data-chip="no" aria-label="No">✕</button>`;
  Object.assign(chip.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px` });
  chip._tile = btn;
  document.body.appendChild(chip);
  chip.querySelector(".yes").focus();
}

/** "Expand? <price> candy ✓ ✕" on the Expand button: only ✓ spends (Enter = ✓, Esc = ✕). */
function showExpandChip(btn) {
  closeExpandChip();
  closeChip();
  state.freeze++; // the button stays put while the chip points at it
  const cost = Number(btn.dataset.cost);
  const r = btn.getBoundingClientRect();
  const chip = document.createElement("div");
  chip.id = "expand-chip";
  chip.className = "confirm-chip";
  chip.setAttribute("role", "group");
  chip.setAttribute("aria-label", `Expand your field for ${cost} candy?`);
  chip.innerHTML = `<span>Expand? ${cost} ${ico("candy")}</span><button class="yes" data-chip="yes" aria-label="Yes, expand for ${cost} candy">✓</button><button class="no" data-chip="no" aria-label="No">✕</button>`;
  Object.assign(chip.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px` });
  document.body.appendChild(chip);
  chip.querySelector(".yes").focus();
}
let expandYesAt = -Infinity; // when ✓ was last tapped (a double tap's second half follows)
/** Close the expand chip (if open); true when there was one. */
function closeExpandChip() {
  const chip = document.getElementById("expand-chip");
  if (!chip) return false;
  chip.remove();
  unfreeze();
  return true;
}

async function playResult(h, result, { cropRect, tileRect, cropSrc }) {
  const counter = document.getElementById("hud-candy")?.getBoundingClientRect();
  if (result.say) say(result.say);
  if (result.fx === "harvest") {
    if (h.crop) h.crop.style.opacity = "0";
    FX.sfx("harvest");
    FX.buzz(15);
    FX.dirt(tileRect);
    FX.floatText(tileRect, `+${result.candy}`, { icon: A("props/candy.png") });
    await FX.popAndFly(cropSrc, cropRect, counter);
    return;
  }
  if (result.fx === "treat") {
    // The pumpkin stays in the ground (it gave one candy): the loss rises
    // from IT, big and red, while your +1 flies to your counter.
    springBack(h);
    FX.sfx("treat");
    FX.buzz(15);
    FX.dirt(tileRect, { soft: true });
    FX.confetti(tileRect, A("props/candy.png"));
    FX.floatText(tileRect, "-1", { victim: true, icon: A("props/candy.png") });
    if (result.guarded) toast("Phew — a guard ghost was here, you slipped past it");
    // Practice candy never reaches your counter: it rises and fades, labelled.
    if (result.practice) return FX.floatText(tileRect, "+1 practice", { icon: A("props/candy.png") });
    await FX.flyText("+1", tileRect, counter, { icon: A("props/candy.png") });
    return;
  }
  if (result.fx === "clear") {
    if (h.crop) h.crop.style.opacity = "0";
    FX.sfx("clear");
    FX.dirt(tileRect);
    await FX.popAndFly(cropSrc, cropRect, null);
    return;
  }
  if (result.fx === "guard") {
    FX.sfx("guard");
    FX.floatText(tileRect, `-${E.RULES.guardCost}`, { icon: A("props/candy.png") });
    await FX.fadeIn(A("props/guard-ghost.png"), tileRect);
    return;
  }
  if (result.fx === "shoo") {
    if (h.crop) h.crop.style.opacity = "0";
    FX.sfx("shoo");
    FX.buzz(15);
    FX.floatText(tileRect, `-${E.RULES.ghostChaseCost}`, { icon: A("props/candy.png") });
    await FX.popAndFly(A("props/ghost.png"), cropRect, null);
    return;
  }
  if (result.fx === "trick") return playTrick(h, result, tileRect);
}

async function playTrick(h, result, tileRect) {
  FX.sfx("scream");
  FX.buzz([40, 30, 60]);
  const ghost = await FX.ghostBurst(tileRect, A(result.guarded ? "props/guard-ghost.png" : "props/ghost.png"));
  await FX.shakeAndFlash($(".wrap"));
  springBack(h);
  const choice = await showTrickCard(result);
  // It followed you home either way: off past the Village button.
  const back = document.querySelector(".to-village")?.getBoundingClientRect();
  await FX.ghostFlyTo(ghost, back || null);
  if (choice === "home" && viewedFarmId() !== state.meId && farmUrl(state.meId)) {
    location.href = farmUrl(state.meId);
    return "leave";
  }
  return undefined;
}

function trickCost(result) {
  const shoo = `${E.RULES.ghostChaseCost} candy`;
  if (result.practice) return `Just practice: on a real farm it would follow you home and haunt a crop until you shoo it for ${shoo}.`;
  if (result.ghostTile == null) return "It tried to follow you home, but there was nowhere on your farm for it to sit.";
  const t = result.haunted;
  if (!t || t.ghostOnly) return `It followed you home and sits on an empty patch — nothing can grow there until you shoo it for ${shoo}.`;
  return `It followed you home and sits on your ${KIND_NAME[kindOf(t)]} — it grows at half speed until you shoo it for ${shoo}.`;
}

function showTrickCard(result) {
  const dlg = $("#trick");
  $("#trick-ghost").src = A(result.guarded ? "props/guard-ghost.png" : "props/ghost.png");
  $("#trick").classList.toggle("trap", !!result.guarded);
  $("#trick-who").textContent = result.guarded ? `You walked into ${result.ownerName}'s guard ghost trap!` : `${result.ownerName}'s farm ghost caught you`;
  $("#trick-cost").textContent = trickCost(result);
  $("#trick-count").textContent = result.practice
    ? `Practice doesn't count toward today's ${E.RULES.dailyStealCap} steals.`
    : `The steal still counted toward today's ${E.RULES.dailyStealCap} (${result.stealsToday} used).`;
  say(`Trick! ${result.guarded ? `You walked into ${result.ownerName}'s guard ghost trap.` : `${result.ownerName}'s ghost caught you.`} ${trickCost(result)}`);
  // "Keep sneaking" stays on this farm (Esc too); "Back to my farm" goes home.
  return new Promise((resolve) => {
    let choice = "stay";
    const close = () => {
      dlg.removeEventListener("close", close);
      if (dlg.open) dlg.close();
      resolve(choice);
    };
    dlg.addEventListener("close", close);
    $("#trick-stay").onclick = close;
    $("#trick-go").onclick = () => {
      choice = "home";
      close();
    };
    dlg.showModal();
    $("#trick-stay").focus();
  });
}

function openSeeds(i) {
  const dlg = $("#seeds");
  const candy = meP()?.player.candy ?? 0;
  dlg.querySelector(".choices").innerHTML = Object.entries(E.RULES.kinds)
    .map(([kind, k]) => `<button data-kind="${kind}" ${candy < k.cost ? "disabled" : ""}><img alt="" src="${A(`crops/${kind}-ripe.png`)}"><b>${kind[0].toUpperCase() + kind.slice(1)}</b><span>${durText(k.growMs)} · yields ${k.yield}</span><span>${k.cost ? `${k.cost} candy` : "free"}</span></button>`)
    .join("");
  dlg.dataset.tile = String(i);
  dlg.showModal();
}
$("#seeds").addEventListener("click", (ev) => {
  const dlg = $("#seeds");
  const b = ev.target.closest("button[data-kind]");
  if (ev.target.closest("[data-close]") || ev.target === dlg) return dlg.close();
  if (!b) return;
  dlg.close();
  run("plant", state.meId, Number(dlg.dataset.tile), b.dataset.kind);
});

// ── clicks ──
// Just after ✓ on "Expand?": the field grows under the finger, so a double
// tap's second half would land on whatever moved there (a new tile, the
// button). Swallow it.
const swallowAfterExpand = {
  match: () => performance.now() - expandYesAt < 400,
  run: (_, ev) => ev.preventDefault(),
};
// Expanding spends candy, so it asks first, like a guard ghost.
const expandClicks = [
  inside("#expand-chip [data-chip]", (btn) => {
    const yes = btn.dataset.chip === "yes";
    closeExpandChip();
    if (yes) {
      expandYesAt = performance.now();
      run("expand", state.meId, 0);
    }
  }),
  { match: (ev) => document.getElementById("expand-chip") && !ev.target.closest("#expand-chip"), run: () => (closeExpandChip(), NEXT) }, // tap elsewhere = no
  inside("#expand", (btn) => {
    if (state.busy) return; // the last purchase is still going out
    showExpandChip(btn);
  }),
];
const guardChipClicks = [
  inside("#guard-chip [data-chip]", (btn) => {
    const tile = document.getElementById("guard-chip")._tile;
    const yes = btn.dataset.chip === "yes";
    closeChip();
    if (yes && tile) tapAct(tile, "guard");
  }),
  { match: (ev) => document.getElementById("guard-chip") && !ev.target.closest("#guard-chip"), run: () => (closeChip(), NEXT) }, // tap elsewhere = no
];
/** Last in line: a tap on a tile does what the tile says. */
const tileClick = {
  match: () => true,
  run: (_, ev) => {
    const tile = ev.target.closest("button.tile");
    if (!tile) {
      // A tile with nothing to do here: a soft thunk, not silence.
      if (state.mode === "play" && ev.target.closest(".farm .grid > div.tile")) FX.sfx("nope");
      return;
    }
    const { owner, act } = tile.dataset;
    const i = Number(tile.dataset.i);
    if (busyTiles.has(tileKey(tile))) return;
    if (act === "plant") return openSeeds(i);
    if (act === "guard") return showGuardChip(tile);
    if (tile.hasAttribute("data-pull")) return void tapAct(tile);
    run(act, owner, i);
  },
};

export { closeChip, closeExpandChip, expandClicks, guardChipClicks, PULL_ACTS, swallowAfterExpand, tileClick };
