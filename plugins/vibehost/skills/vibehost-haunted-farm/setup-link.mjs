#!/usr/bin/env node
// Makes a farmer's personal "set up my farm" link for an existing village.
//   node setup-link.mjs --url https://<village host> --name "<farm name>" --slug <link-name> --avatar <1-6> --scarecrow <colour>
//        [--avatar-png face.png] [--skins <dir>]
// When the village allows them: --avatar-png is a 24×24 face made
// with make-your-own/pixel-grid.mjs or pixelate.mjs; --skins is a folder of
// 32×32 <kind>-<stage>.png (kind: common/rare/legendary; all three stages
// sprout/growing/ripe for each kind you skin). They ride in the link as data
// URLs — no redeploy — and the page checks every pixel before showing them.
// Prints the link: <village>/setup#<base64url JSON>. Opening it while signed
// in as a member of the village's workspace writes farms/<you> and goes to
// /farm/<slug>. Same rules as the page's own setup form (template/farms.js
// cleanFarm), so a link this prints is a link the page accepts; if the
// link name is taken in the village, the page says so and shows the form.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { LIMITS, SKIN_KINDS, SKIN_STAGES, checkDataUrl, dataUrl } from "./make-your-own/png.mjs";
import { AVATARS, SCARECROW_IDS, SLUG_RE, slugify } from "./template/shared.js";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const fail = (msg) => {
  console.error(`setup-link.mjs: ${msg}`);
  process.exit(2);
};

export { slugify };

/** --avatar-png / --skins → the farm's avatarPng / skins fields (checked). */
export function customArt({ avatarPng, skinsDir } = {}) {
  const out = {};
  if (avatarPng) {
    const url = dataUrl(readFileSync(avatarPng));
    const bad = checkDataUrl(url, LIMITS.avatar);
    if (bad) throw new Error(`--avatar-png: ${bad}`);
    out.avatarPng = url;
  }
  if (skinsDir) {
    const skins = {};
    for (const kind of SKIN_KINDS) {
      const files = SKIN_STAGES.map((st) => join(skinsDir, `${kind}-${st}.png`));
      const have = files.filter((f) => existsSync(f));
      if (!have.length) continue;
      if (have.length !== 3) throw new Error(`--skins: ${kind} needs all three of ${SKIN_STAGES.map((st) => `${kind}-${st}.png`).join(", ")}`);
      skins[kind] = {};
      SKIN_STAGES.forEach((st, k) => {
        const url = dataUrl(readFileSync(files[k]));
        const bad = checkDataUrl(url, LIMITS.skin);
        if (bad) throw new Error(`--skins: ${kind}-${st}.png is ${bad}`);
        skins[kind][st] = url;
      });
    }
    const total = Object.values(skins).flatMap((k) => Object.values(k)).join("").length;
    if (!Object.keys(skins).length) throw new Error(`--skins: no <kind>-<stage>.png files in ${skinsDir}`);
    if (total > LIMITS.skinsTotalChars) throw new Error(`--skins: ${total} characters in all (at most ${LIMITS.skinsTotalChars})`);
    out.skins = skins;
  }
  return out;
}

export function setupLink(url, raw) {
  const name = String(raw.name ?? "").replace(/\s+/g, " ").trim();
  const slug = String(raw.slug ?? slugify(name)).trim().toLowerCase();
  const avatar = Number(raw.avatar);
  const scarecrow = String(raw.scarecrow ?? "classic");
  // Every problem at once, so one fix-up round is enough.
  const problems = [];
  if (!/^https:\/\/[^/]+$/.test(url)) problems.push(`--url must be https://<village host>, got "${url}"`);
  if (!name || [...name].length > 30) problems.push("the farm name must be 1–30 characters");
  if (!SLUG_RE.test(slug)) problems.push(`the link name "${slug}" needs 2–31 lowercase letters, digits or dashes, starting with a letter or digit`);
  if (!AVATARS.includes(avatar)) problems.push(`--avatar must be ${AVATARS[0]}–${AVATARS.at(-1)}`);
  if (!SCARECROW_IDS.includes(scarecrow)) problems.push(`--scarecrow must be one of ${SCARECROW_IDS.join(", ")}`);
  let art = {};
  try {
    art = customArt({ avatarPng: raw.avatarPng, skinsDir: raw.skinsDir });
  } catch (e) {
    problems.push(e.message);
  }
  if (problems.length === 1) throw new Error(problems[0]);
  if (problems.length) throw new Error(`${problems.length} problems:\n  - ${problems.join("\n  - ")}`);
  const json = JSON.stringify({ name, slug, avatar, scarecrow, ...art });
  return `${url}/setup#${Buffer.from(json, "utf8").toString("base64url")}`;
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
  const url = (flag("--url") ?? "").replace(/\/+$/, "");
  try {
    console.log(setupLink(url, { name: flag("--name"), slug: flag("--slug"), avatar: flag("--avatar"), scarecrow: flag("--scarecrow"), avatarPng: flag("--avatar-png"), skinsDir: flag("--skins") }));
  } catch (e) {
    fail(e.message);
  }
}
