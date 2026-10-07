#!/usr/bin/env node
// Rolls the dice for a new haunted farm village.
//   node roll.mjs [--seed <8hex>] [--out village.json]
// The seed fully determines the roll: theme, weather of the week, secret
// pumpkin. Draw order is part of the contract (theme, weather, secret):
// never reorder; new dice are only ever appended.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const fail = (msg) => {
  console.error(`roll.mjs: ${msg}`);
  process.exit(2);
};

const dice = JSON.parse(readFileSync(join(here, "dice.json"), "utf8"));
let seed = String(flag("--seed") ?? randomBytes(4).toString("hex")).toLowerCase();
if (!/^[0-9a-f]{8}$/.test(seed)) fail(`--seed must be 8 hex characters, got "${seed}"`);
const out = resolve(flag("--out") ?? "village.json");

// mulberry32 — same generator as pumpkin-patch's roll.mjs.
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

const theme = pick(dice.themes);
const weather = pick(dice.weathers);
const secret = pick(dice.secrets);

const village = {
  seed,
  theme: theme.id,
  weather: weather.id,
  secret: secret.id,
  name: theme.villageName || dice.namePattern.replace("{Theme}", theme.name),
  tagline: "",
  visibility: "",
};
writeFileSync(out, JSON.stringify(village, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      seed,
      name: village.name,
      theme: { id: theme.id, name: theme.name, flavour: theme.flavour },
      weather: { id: weather.id, name: weather.name, flavour: weather.flavour },
      secret: { id: secret.id, hint: "keep the name a surprise — it grows on 1% of Legendary seeds" },
      wrote: out,
    },
    null,
    2,
  ),
);
