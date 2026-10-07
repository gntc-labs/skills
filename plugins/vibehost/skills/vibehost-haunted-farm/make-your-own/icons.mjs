#!/usr/bin/env node
// The favicon set, from the pixel pumpkin (art/ui/favicon.png, 32×32), into
// art/ui/icons/: favicon-16/32/48.png, favicon.ico (16 + 32 + 48),
// apple-touch-icon.png (180, on the night colour, padded) and icon-192/512.png
// for site.webmanifest. Whole-pixel scaling only, never a blur: 16 takes the
// most common colour of each 2×2 cell, 48 is that ×3, the rest are 32 × an
// integer on a padded night square. build.mjs and the landing copy these.
//   node make-your-own/icons.mjs [--playwright <path>]   (decodes with the browser, like pixelate.mjs)
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decodeImage, launchBrowser, loadChromium } from "../browser.mjs";
import { encodeIco, encodePng8 } from "./png.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, "..", "art");
export const ICON_DIR = join(ART, "ui/icons");
const NIGHT = JSON.parse(readFileSync(join(ART, "palette.json"), "utf8")).colors.night;
const night = [1, 3, 5].map((k) => parseInt(NIGHT.slice(k, k + 2), 16));

/** `img` scaled by an integer factor, nearest neighbour. */
export function upscale({ w, h, data }, f) {
  const out = new Uint8Array(w * f * h * f * 4);
  for (let y = 0; y < h * f; y++)
    for (let x = 0; x < w * f; x++) out.set(data.subarray(((Math.floor(y / f) * w + Math.floor(x / f)) * 4), ((Math.floor(y / f) * w + Math.floor(x / f)) * 4) + 4), (y * w * f + x) * 4);
  return { w: w * f, h: h * f, data: out };
}
/** Half size: each 2×2 cell becomes its most common opaque colour (darker wins a tie), or clear. */
export function halve({ w, h, data }) {
  const out = new Uint8Array((w / 2) * (h / 2) * 4);
  for (let y = 0; y < h / 2; y++)
    for (let x = 0; x < w / 2; x++) {
      const cell = [0, 1, 2, 3].map((k) => data.subarray(((y * 2 + (k >> 1)) * w + x * 2 + (k & 1)) * 4, ((y * 2 + (k >> 1)) * w + x * 2 + (k & 1)) * 4 + 4)).filter((p) => p[3] >= 128);
      if (cell.length < 2) continue;
      const tally = new Map();
      for (const p of cell) tally.set(p.join(), (tally.get(p.join()) || 0) + 1);
      const lum = (s) => s.split(",").slice(0, 3).reduce((a, v, k) => a + v * [0.3, 0.59, 0.11][k], 0);
      const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || lum(a[0]) - lum(b[0]))[0][0];
      out.set(best.split(",").map(Number), (y * (w / 2) + x) * 4);
    }
  return { w: w / 2, h: h / 2, data: out };
}
/** `img` centred on a size × size night square. */
export function onNight(img, size) {
  const out = new Uint8Array(size * size * 4);
  for (let k = 0; k < size * size; k++) out.set([...night, 255], k * 4);
  const ox = (size - img.w) / 2;
  const oy = (size - img.h) / 2;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const p = img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4);
      if (p[3] >= 128) out.set([p[0], p[1], p[2], 255], ((y + oy) * size + x + ox) * 4);
    }
  return { w: size, h: size, data: out };
}

const runAsCommand = (() => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();
if (runAsCommand) {
  const args = process.argv.slice(2);
  const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const fail = (m) => {
    console.error(`icons.mjs: ${m}`);
    process.exit(2);
  };
  const chromium = (await loadChromium(flag("--playwright"))) ?? fail("Playwright not found. In this folder run: npm i playwright-core");
  const browser = (await launchBrowser(chromium)) ?? fail("no browser could start");
  let src;
  try {
    src = await decodeImage(await browser.newPage(), readFileSync(join(ART, "ui/favicon.png")));
  } finally {
    await browser.close();
  }
  if (src.w !== 32 || src.h !== 32) fail(`art/ui/favicon.png is ${src.w}×${src.h}, expected 32×32`);
  const png = (img) => encodePng8(img.w, img.h, img.data);
  const sixteen = halve(src);
  const files = {
    "favicon-16.png": png(sixteen),
    "favicon-32.png": png(src),
    "favicon-48.png": png(upscale(sixteen, 3)),
    "apple-touch-icon.png": png(onNight(upscale(src, 5), 180)),
    "icon-192.png": png(onNight(upscale(src, 5), 192)),
    "icon-512.png": png(onNight(upscale(src, 14), 512)),
  };
  files["favicon.ico"] = encodeIco([files["favicon-16.png"], files["favicon-32.png"], files["favicon-48.png"]]);
  mkdirSync(ICON_DIR, { recursive: true });
  for (const [name, buf] of Object.entries(files)) writeFileSync(join(ICON_DIR, name), buf);
  console.log(Object.entries(files).map(([n, b]) => `${n} ${b.length} B`).join("\n"));
}
