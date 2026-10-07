#!/usr/bin/env node
// A pixel image from a grid of palette letters — the way to make a custom
// avatar (24×24) or crop skin (32×32) when the agent has no image tool.
// One line per row, one letter per pixel; "." is transparent:
//   v void  n night  d dusk  p plum  m moss  l leaf  g lime  s soil
//   b loam  o pumpkin  a amber  c candle  w bone  h ash  r blood  t spirit
//   node make-your-own/pixel-grid.mjs --in face.txt --size 24 --out face.png
// Prints the data URL (what setup-link.mjs puts on the farm) and its length.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { LETTERS, LIMITS, PALETTE, checkDataUrl, dataUrl, encodePng } from "./png.mjs";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const fail = (msg) => {
  console.error(`pixel-grid.mjs: ${msg}`);
  process.exit(2);
};

/** Grid text → palette indices (-1 = transparent); throws on a bad grid. */
export function gridToPixels(text, size) {
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  if (rows.length !== size) throw new Error(`${rows.length} rows (needs exactly ${size})`);
  const byName = Object.fromEntries(PALETTE.map((c, k) => [c.name, k]));
  return rows.flatMap((row, y) => {
    if ([...row].length !== size) throw new Error(`row ${y + 1} has ${[...row].length} letters (needs ${size})`);
    return [...row].map((ch, x) => {
      if (ch === ".") return -1;
      const name = LETTERS[ch];
      if (!name) throw new Error(`row ${y + 1}, column ${x + 1}: "${ch}" is not a palette letter`);
      return byName[name];
    });
  });
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
  const size = Number(flag("--size") ?? 24);
  const kind = size === LIMITS.avatar.size ? LIMITS.avatar : size === LIMITS.skin.size ? LIMITS.skin : fail("--size is 24 (avatar) or 32 (crop skin)");
  try {
    const png = encodePng(size, size, gridToPixels(readFileSync(flag("--in") ?? fail("--in <grid.txt>"), "utf8"), size));
    const url = dataUrl(png);
    const bad = checkDataUrl(url, kind);
    if (bad) fail(`the image is ${bad} — simplify it (fewer colours, bigger flat areas)`);
    if (flag("--out")) writeFileSync(flag("--out"), png);
    console.log(url);
    console.error(`pixel-grid.mjs: ${size}×${size}, ${png.length} bytes, data URL ${url.length}/${kind.maxChars} characters`);
  } catch (e) {
    fail(e.message);
  }
}
