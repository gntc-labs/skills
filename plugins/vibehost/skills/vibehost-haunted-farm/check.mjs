#!/usr/bin/env node
// Browser check of a built vibehost-haunted-farm site. Exits 1 if any check fails.
//   node <skill-dir>/check.mjs --site site/ --shots preview/ [--gate | --all]
//        [--playwright <path>] [--browser chrome|chromium|shell] [--no-fonts] [--verbose]
// --gate (the default, about a minute): what an agent runs after every build —
//   the map, my farm, a neighbour's farm and a steal, the phone layout with
//   this village's name and tagline, setup, a spectator, a resting village,
//   what the build ships (and the try-out itself for a --mock build). It
//   writes preview/phone-map.png, desktop-map.png and phone-bob-farm.png.
// --all: the gate plus every feature suite in dev/checks/ (the skill's source
//   repo only; a few minutes).
// App Data is MOCKED by mock-sdk.js (the same in-page fake a --mock try-out
// build ships), from fixed scenarios, in memory, served in place of
// /__vh/data/sdk.js. It behaves like the real API (versions, 409s,
// "$serverTime"), so this needs no VibeHost account and touches no server.
// Run it from the project folder: Playwright comes from --playwright or that
// folder's node_modules (playwright-core, then playwright).
import gate from "./check/gate.mjs";
import { args, die, finish, IS_MOCK, plan } from "./check/harness.mjs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// How many checks each run makes: [gate, all] for a normal / a try-out build.
const COUNTS = { normal: [18, 107], mock: [26, 114] };
const all = args.includes("--all");
if (all && args.includes("--gate")) die("--gate and --all: pick one");
let suites = [];
if (all) {
  const index = join(dirname(fileURLToPath(import.meta.url)), "dev/checks/index.mjs");
  if (!existsSync(index)) die("--all needs dev/checks/ (the skill's source repo); the published skill has the gate only");
  suites = (await import(index)).SUITES;
}
plan(COUNTS[IS_MOCK ? "mock" : "normal"][all ? 1 : 0]);
try {
  await gate();
  for (const suite of suites) await suite();
} finally {
  await finish();
}
