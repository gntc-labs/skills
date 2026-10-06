#!/usr/bin/env node
// Rolls the build-time dice for a new pumpkin patch.
//   node roll.mjs [--seed <8hex>] [--out patch.json] [--json]
// The seed fully determines the patch: same seed -> same scene/event/quirk/signature/secret.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const fail = (msg) => { console.error(`roll.mjs: ${msg}`); process.exit(2); };

const dice = JSON.parse(readFileSync(join(here, "dice.json"), "utf8"));

let seed = flag("--seed");
if (seed === undefined) seed = randomBytes(4).toString("hex");
seed = String(seed).toLowerCase();
if (!/^[0-9a-f]{8}$/.test(seed)) fail(`--seed must be 8 hex characters, got "${seed}"`);
const out = resolve(flag("--out") ?? "patch.json");

// mulberry32: tiny, well-known, deterministic. Draw order is part of the contract:
// scene, event, quirk, signature, secret. Never reorder, or seeds change meaning; new dice are only ever
// appended (the secret came in dice.json v3 as a 5th draw, so v2 seeds keep their first four results). (dice.json v2 grew every
// list, so a v1 seed rolls a different patch under v2; patches built from v1 keep their patch.json.)
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(parseInt(seed, 16));
const pick = (list) => list[Math.floor(rnd() * list.length)];

const scene = pick(dice.scenes);
const event = pick(dice.events);
const quirk = pick(dice.quirks);
const signature = pick(dice.varieties);
const secret = pick(dice.secrets);

const name = scene.patchName || dice.namePattern.replace("{Scene}", scene.name);
const patch = {
  seed,
  scene: scene.id,
  event: event.id,
  quirk: quirk.id,
  signature: signature.id,
  secret: secret.id,
  name,
  owner: "",
  tagline: "",
  welcome: "",
  showcase: "",
  blurbs: Object.fromEntries([...dice.varieties, secret].map((v) => [v.id, ""])),
};
writeFileSync(out, JSON.stringify(patch, null, 2) + "\n");

// Odds shown to the creator, same rule the engine uses.
const tierW = Object.fromEntries(dice.tiers.map((t) => [t.id, t.weight]));
const raw = dice.varieties.map((v) => {
  const n = dice.varieties.filter((o) => o.tier === v.tier).length;
  return [v, (tierW[v.tier] / n) * (v.id === signature.id ? dice.signatureMultiplier : 1)];
});
const total = raw.reduce((a, [, w]) => a + w, 0);
// The weather multiplies a tier's share (x2 = exactly twice as likely); the other tiers shrink in proportion.
const mods = event.tierMultipliers || {};
const boosted = raw.reduce((a, [v, w]) => a + (mods[v.tier] ? (w / total) * mods[v.tier] : 0), 0);
const plain = raw.reduce((a, [v, w]) => a + (mods[v.tier] ? 0 : w / total), 0);
const shrink = (1 - boosted) / plain;
// The secret takes a flat share (the weather never changes it); the rest shrink in proportion.
const S = dice.secretTier.chance;
const odds = Object.fromEntries(raw.map(([v, w]) => [v.id, Math.round((w / total) * (mods[v.tier] ?? shrink) * (100 - S) * 10) / 10]));
odds[secret.id] = S;
const tierOdds = Object.fromEntries(dice.tiers.map((t) => [t.id, Math.round(raw.filter(([v]) => v.tier === t.id).reduce((a, [v, w]) => a + (w / total) * (mods[v.tier] ?? shrink), 0) * (100 - S) * 10) / 10]));
const boostText = Object.entries(mods).map(([t, m]) => `${t} odds ${m === 2 ? "doubled" : `x${m}`}`).join(", ");
const sigText = `odds x${dice.signatureMultiplier}`;

const summary = {
  seed, name, out,
  scene: { id: scene.id, name: scene.name },
  event: { id: event.id, name: event.name, effect: boostText || "animation only" },
  quirk: { id: quirk.id, name: quirk.name },
  signature: { id: signature.id, name: signature.name, tier: signature.tier, multiplier: dice.signatureMultiplier },
  secret: { id: secret.id, name: secret.name, tier: dice.secretTier.id, chance: S },
  odds,
  tierOdds,
};
if (args.includes("--json")) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`Seed ${seed} -> ${name}`);
  console.log(`  Scene:     ${scene.name}`);
  console.log(`  Weather:   ${event.name}${boostText ? ` (${boostText})` : ""}`);
  console.log(`  Quirk:     ${quirk.name}`);
  console.log(`  Signature: ${signature.name} (${signature.tier}, ${sigText})`);
  console.log(`  Secret:    ${secret.name} (${dice.secretTier.id}, ${S}%, only grows in this patch)`);
  console.log(`  Tiers:     ${dice.tiers.map((t) => `${t.id} ${tierOdds[t.id]}%`).join(", ")}, ${dice.secretTier.id} ${S}%`);
  console.log(`  Odds:      ${dice.varieties.map((v) => `${v.name} ${odds[v.id]}%`).join(", ")}, ${secret.name} ${S}%`);
  const n = [dice.scenes, dice.events, dice.quirks, dice.varieties, dice.secrets].map((l) => l.length);
  console.log(`  (${n[0]} scenes x ${n[1]} weathers x ${n[2]} quirks x ${n[3]} signatures x ${n[4]} secrets = ${n.reduce((a, b) => a * b)} possible patches)`);
  console.log(`Wrote ${out}`);
}
