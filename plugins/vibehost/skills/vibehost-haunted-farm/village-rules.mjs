#!/usr/bin/env node
// Village rules: what this village allows, set in village.json
// under "rules" and baked into the deployed page by build.mjs. Players can't
// change them — only someone who can redeploy the app (VibeHost deployer+).
//   node village-rules.mjs --village village.json                         show them
//   node village-rules.mjs --village village.json --set cropSkins=off \
//        --set expansion.cost=40 --set expansion.maxCols=3                change them
// then rebuild and redeploy (deploy.md). Defaults: everything on.
//   node village-rules.mjs --url https://<village host>                   read a live village's
// (what a joiner's Step F uses: which optional questions to ask).
//   customAvatar   farmers may bring their own 24×24 face (setup link)
//   expansion      buy a bigger field in game: on, cost (candy a step),
//                  maxCols / maxRows (3–4 each; 3×3 → 3×4 → 4×4)
//   cropSkins      farmers may re-skin their varieties (cosmetic only)
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const RULE_DEFAULTS = Object.freeze({
  customAvatar: true,
  expansion: Object.freeze({ on: true, cost: 30, maxCols: 4, maxRows: 4 }),
  cropSkins: true,
});

const bool = (v, what) => {
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (["on", "true", "yes"].includes(String(v).toLowerCase())) return true;
  if (["off", "false", "no"].includes(String(v).toLowerCase())) return false;
  throw new Error(`${what} is on or off, got "${v}"`);
};
const int = (v, lo, hi, what) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${what} must be a whole number ${lo}–${hi}, got "${v}"`);
  return n;
};

/** village.json "rules" (missing = defaults) → the full, checked set. Throws on anything else. */
export function normalizeRules(raw = {}) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error('"rules" must be an object');
  const known = ["customAvatar", "expansion", "cropSkins"];
  const extra = Object.keys(raw).filter((k) => !known.includes(k));
  if (extra.length) throw new Error(`unknown rule ${extra.map((k) => `"${k}"`).join(", ")} (rules are ${known.join(", ")})`);
  const ex = typeof raw.expansion === "object" && raw.expansion !== null ? raw.expansion : { on: raw.expansion };
  const d = RULE_DEFAULTS.expansion;
  return {
    customAvatar: bool(raw.customAvatar, "customAvatar") ?? RULE_DEFAULTS.customAvatar,
    expansion: {
      on: bool(ex.on, "expansion") ?? d.on,
      cost: ex.cost === undefined ? d.cost : int(ex.cost, 1, 500, "expansion.cost"),
      // The farm's layout holds at most 4×4 on a 390 px phone.
      maxCols: ex.maxCols === undefined ? d.maxCols : int(ex.maxCols, 3, 4, "expansion.maxCols"),
      maxRows: ex.maxRows === undefined ? d.maxRows : int(ex.maxRows, 3, 4, "expansion.maxRows"),
    },
    cropSkins: bool(raw.cropSkins, "cropSkins") ?? RULE_DEFAULTS.cropSkins,
  };
}

/** Apply "path=value" edits (customAvatar=off, expansion.cost=40, …) to a village's rules. */
export function setRules(raw, edits) {
  const r = JSON.parse(JSON.stringify(normalizeRules(raw)));
  for (const e of edits) {
    const m = /^([a-zA-Z]+)(?:\.([a-zA-Z]+))?=(.+)$/.exec(e);
    if (!m) throw new Error(`--set takes rule=value or expansion.field=value, got "${e}"`);
    const [, top, sub, v] = m;
    if (top === "expansion" && sub) r.expansion[sub] = v;
    else if (top === "expansion") r.expansion.on = v;
    else r[top] = v;
  }
  return normalizeRules(r);
}

/** A live village's rules, read from its page config (a page built before village rules → all on). */
export async function liveRules(url) {
  const res = await fetch(`${url.replace(/\/+$/, "")}/`, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const m = /<script id="village" type="application\/json">([\s\S]*?)<\/script>/.exec(await res.text());
  if (!m) throw new Error(`${url} doesn't look like a haunted village (a workspace-only village shows its login page to a script: ask anyway — the page ignores what it doesn't allow)`);
  return normalizeRules(JSON.parse(m[1]).rules ?? {});
}

// Run as a command (also through a symlink or a path with spaces).
const runAsCommand = (() => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();
if (runAsCommand) {
  const args = process.argv.slice(2);
  const file = args.includes("--village") ? args[args.indexOf("--village") + 1] : "village.json";
  const edits = args.flatMap((a, k) => (a === "--set" ? [args[k + 1]] : []));
  try {
    const url = args.includes("--url") ? args[args.indexOf("--url") + 1] : null;
    if (url && edits.length) throw new Error("--url only reads a live village; change rules in its village.json with --set");
    const village = url ? { rules: await liveRules(url) } : JSON.parse(readFileSync(file, "utf8"));
    const rules = edits.length ? setRules(village.rules, edits) : normalizeRules(village.rules);
    if (edits.length) writeFileSync(file, JSON.stringify({ ...village, rules }, null, 2) + "\n");
    const on = (b) => (b ? "on" : "off");
    console.log(
      `${edits.length ? "Saved" : "Village rules"} (${url ?? file}):\n` +
        `  custom avatars  ${on(rules.customAvatar)}\n` +
        `  farm expansion  ${on(rules.expansion.on)}${rules.expansion.on ? ` — ${rules.expansion.cost} candy a step, up to ${rules.expansion.maxCols}×${rules.expansion.maxRows}` : ""}\n` +
        `  crop skins      ${on(rules.cropSkins)}` +
        (edits.length ? "\nRebuild and redeploy for the village to use them (deploy.md)." : ""),
    );
  } catch (e) {
    console.error(`village-rules.mjs: ${e.message}`);
    process.exit(2);
  }
}
