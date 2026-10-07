#!/usr/bin/env node
// An image from the agent's own image tool → a custom avatar (24×24) or
// crop skin (32×32) in the village's palette. The same steps as
// the art pipeline in MANIFEST.md, in node + the Playwright browser's canvas
// (it decodes any PNG/JPEG/WebP; no Python):
//   1. chroma-key the background away (--key #rrggbb, default: the colour of
//      the four corners) — ask the image tool for a flat, solid background;
//   2. crop to what's left, pad to a square, box-downscale to --size
//      (a cell is transparent unless at least half of it is opaque);
//   3. snap every pixel to the nearest of the 16 palette colours.
//   node make-your-own/pixelate.mjs --in drawing.png --size 24 --out face.png [--key #00ff00] [--tolerance 60] [--no-crop]
// --no-crop keeps the whole (square) picture instead of cropping to the
// subject: use it for crop skins, which sit bottom-aligned on their tile.
// Prints the data URL and its length; fails if it's over the cap.
// Playwright comes from --playwright or ./node_modules (playwright-core).
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { decodeImage, launchBrowser, loadChromium } from "../browser.mjs";
import { LIMITS, checkDataUrl, dataUrl, encodePng, nearest } from "./png.mjs";

const args = process.argv.slice(2);
const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const fail = (msg) => {
  console.error(`pixelate.mjs: ${msg}`);
  process.exit(2);
};

/** RGBA pixels of an image file, decoded by the browser. */
async function decode(file) {
  const chromium = (await loadChromium(flag("--playwright"))) ?? fail("Playwright not found. In this folder run: npm i playwright-core");
  const browser = (await launchBrowser(chromium)) ?? fail("no browser could start (npx playwright-core install --only-shell chromium)");
  try {
    const page = await browser.newPage();
    const type = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extname(file).toLowerCase()] ?? "image/png";
    const img = await decodeImage(page, readFileSync(file), type);
    return { w: img.w, h: img.h, data: Array.from(img.data) };
  } finally {
    await browser.close();
  }
}

/** Steps 1–3 on decoded RGBA: palette indices (-1 = transparent), size × size. */
export function pixelate({ w, h, data }, size, { key = null, tolerance = 60, crop = true } = {}) {
  const at = (x, y) => data.slice((y * w + x) * 4, (y * w + x) * 4 + 4);
  const bg = key ?? [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)].reduce((s, p) => s.map((v, k) => v + p[k] / 4), [0, 0, 0, 0]).slice(0, 3);
  const keep = new Uint8Array(w * h);
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const dist = Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
      if (p[3] >= 128 && dist > tolerance) {
        keep[y * w + x] = 1;
        [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      }
    }
  }
  if (x1 < 0) throw new Error("nothing left after removing the background — check --key / --tolerance");
  if (!crop) [x0, y0, x1, y1] = [0, 0, w - 1, h - 1];
  const side = Math.max(x1 - x0 + 1, y1 - y0 + 1);
  const ox = x0 - (side - (x1 - x0 + 1)) / 2;
  const oy = y0 - (side - (y1 - y0 + 1)) / 2;
  const out = [];
  for (let cy = 0; cy < size; cy++) {
    for (let cx = 0; cx < size; cx++) {
      const [sx0, sx1] = [Math.floor(ox + (cx * side) / size), Math.floor(ox + ((cx + 1) * side) / size)];
      const [sy0, sy1] = [Math.floor(oy + (cy * side) / size), Math.floor(oy + ((cy + 1) * side) / size)];
      let n = 0;
      let all = 0;
      const sum = [0, 0, 0];
      for (let y = sy0; y < Math.max(sy1, sy0 + 1); y++) {
        for (let x = sx0; x < Math.max(sx1, sx0 + 1); x++) {
          all++;
          if (x < 0 || y < 0 || x >= w || y >= h || !keep[y * w + x]) continue;
          const p = at(x, y);
          sum[0] += p[0];
          sum[1] += p[1];
          sum[2] += p[2];
          n++;
        }
      }
      out.push(n * 2 >= all ? nearest(sum.map((v) => v / n)) : -1);
    }
  }
  return out;
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
  const hex = flag("--key");
  if (hex && !/^#[0-9a-f]{6}$/i.test(hex)) fail("--key is a colour like #00ff00");
  try {
    const img = await decode(resolve(flag("--in") ?? fail("--in <image>")));
    const px = pixelate(img, size, { key: hex ? [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) : null, tolerance: Number(flag("--tolerance") ?? 60), crop: !args.includes("--no-crop") });
    const png = encodePng(size, size, px);
    const url = dataUrl(png);
    const bad = checkDataUrl(url, kind);
    if (bad) fail(`the result is ${bad} — ask for a simpler drawing (fewer colours, bigger flat areas)`);
    if (flag("--out")) writeFileSync(flag("--out"), png);
    console.log(url);
    console.error(`pixelate.mjs: ${img.w}×${img.h} → ${size}×${size}, ${png.length} bytes, data URL ${url.length}/${kind.maxChars} characters`);
  } catch (e) {
    fail(e.message);
  }
}
