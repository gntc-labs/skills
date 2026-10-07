// Tiny indexed-PNG writer + the rules a custom avatar / crop skin must meet.
// No dependencies: node:zlib + a CRC table. Shared by
// pixel-grid.mjs, pixelate.mjs and setup-link.mjs; the page applies the same
// rules again before it shows anything (template/art-check.js checkPng).
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pal = JSON.parse(readFileSync(join(here, "../art/palette.json"), "utf8")).colors;

/** The 16 colours, in palette.json order: [{ name, hex, rgb: [r, g, b] }]. */
export const PALETTE = Object.entries(pal).map(([name, hex]) => ({ name, hex, rgb: [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) }));

/** One letter per colour for hand-written grids ("." is transparent). */
export const LETTERS = { v: "void", n: "night", d: "dusk", p: "plum", m: "moss", l: "leaf", g: "lime", s: "soil", b: "loam", o: "pumpkin", a: "amber", c: "candle", w: "bone", h: "ash", r: "blood", t: "spirit" };

/** What a custom image may be: exact size, a data-URL length cap, palette colours only (template/shared.js). */
export { IMAGE_LIMITS as LIMITS, SKIN_KINDS, SKIN_STAGES } from "../template/shared.js";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/**
 * An indexed PNG: `px` holds one palette index (0–15) per pixel, row by row,
 * or -1 for transparent. Only the colours used go into PLTE, so it stays small.
 */
export function encodePng(width, height, px) {
  const used = [...new Set(px.filter((v) => v >= 0))];
  const hasClear = px.some((v) => v < 0);
  const order = hasClear ? [-1, ...used] : used; // index 0 = transparent when needed
  const at = new Map(order.map((v, k) => [v, k]));
  const plte = Buffer.from(order.flatMap((v) => (v < 0 ? [0, 0, 0] : PALETTE[v].rgb)));
  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = at.get(px[y * width + x]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 3, 0, 0, 0], 8); // 8-bit, indexed colour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    ...(hasClear ? [chunk("tRNS", Buffer.from(order.map((v) => (v < 0 ? 0 : 255))))] : []),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Any RGBA image as an indexed PNG (≤ 256 colours): exact when it has that
 * few, else a median-cut palette with each pixel mapped to its nearest
 * colour. Pixel art stays exact; anti-aliased text edges lose a little.
 */
export function encodePng8(width, height, rgba) {
  const n = width * height;
  const key = (k) => (rgba[k * 4 + 3] < 128 ? -1 : (rgba[k * 4] << 16) | (rgba[k * 4 + 1] << 8) | rgba[k * 4 + 2]);
  const counts = new Map();
  for (let k = 0; k < n; k++) {
    const c = key(k);
    if (c >= 0) counts.set(c, (counts.get(c) || 0) + 1);
  }
  const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  let palette = [...counts.keys()];
  const hasClear = (() => {
    for (let k = 0; k < n; k++) if (key(k) < 0) return true;
    return false;
  })();
  const room = hasClear ? 255 : 256;
  if (palette.length > room) {
    // Median cut over the distinct colours, weighted by how often each is used.
    let boxes = [palette];
    while (boxes.length < room) {
      const i = boxes.reduce((best, b, j) => (b.length > 1 && (best < 0 || b.length > boxes[best].length) ? j : best), -1);
      if (i < 0) break;
      const box = boxes[i];
      const span = [0, 1, 2].map((ch) => {
        const v = box.map((c) => rgb(c)[ch]);
        return Math.max(...v) - Math.min(...v);
      });
      const ch = span.indexOf(Math.max(...span));
      box.sort((a, b) => rgb(a)[ch] - rgb(b)[ch]);
      const total = box.reduce((s, c) => s + counts.get(c), 0);
      let acc = 0;
      let cut = 1;
      for (; cut < box.length - 1; cut++) if ((acc += counts.get(box[cut - 1])) >= total / 2) break;
      boxes.splice(i, 1, box.slice(0, cut), box.slice(cut));
    }
    palette = boxes.map((box) => {
      const w = box.reduce((s, c) => s + counts.get(c), 0);
      const avg = [0, 1, 2].map((ch) => Math.round(box.reduce((s, c) => s + rgb(c)[ch] * counts.get(c), 0) / w));
      return (avg[0] << 16) | (avg[1] << 8) | avg[2];
    });
  }
  const index = new Map();
  const nearestOf = (c) => {
    let hit = index.get(c);
    if (hit !== undefined) return hit;
    const [r, g, b] = rgb(c);
    let best = 0;
    let bestD = Infinity;
    palette.forEach((p, k) => {
      const [pr, pg, pb] = rgb(p);
      const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
      if (d < bestD) [best, bestD] = [k, d];
    });
    index.set(c, best);
    return best;
  };
  const off = hasClear ? 1 : 0;
  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = key(y * width + x);
      raw[y * (width + 1) + 1 + x] = c < 0 ? 0 : nearestOf(c) + off;
    }
  const plte = Buffer.from([...(hasClear ? [0, 0, 0] : []), ...palette.flatMap(rgb)]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 3, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    ...(hasClear ? [chunk("tRNS", Buffer.from([0, ...palette.map(() => 255)]))] : []),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A .ico holding PNG images (each ≤ 256 px square), as browsers read it. */
export function encodeIco(pngs) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2); // icon
  head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const dir = pngs.map((png) => {
    const e = Buffer.alloc(16);
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    e[0] = w >= 256 ? 0 : w;
    e[1] = h >= 256 ? 0 : h;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...pngs]);
}

export const dataUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;

/** Nearest palette colour (plain RGB distance). */
export function nearest([r, g, b]) {
  let best = 0;
  let bestD = Infinity;
  PALETTE.forEach((c, k) => {
    const d = (c.rgb[0] - r) ** 2 + (c.rgb[1] - g) ** 2 + (c.rgb[2] - b) ** 2;
    if (d < bestD) [best, bestD] = [k, d];
  });
  return best;
}

/**
 * The cheap checks (the page also checks every pixel's colour): a PNG data
 * URL of the right size, under the length cap. Returns an error string or null.
 */
export function checkDataUrl(url, { size, maxChars }) {
  if (typeof url !== "string" || !url.startsWith("data:image/png;base64,")) return "not a PNG data URL";
  if (url.length > maxChars) return `${url.length} characters (at most ${maxChars})`;
  const buf = Buffer.from(url.slice(22), "base64");
  if (buf.length < 33 || buf.toString("latin1", 1, 4) !== "PNG" || buf.toString("ascii", 12, 16) !== "IHDR") return "not a PNG";
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== size || h !== size) return `${w}×${h} (must be exactly ${size}×${size})`;
  return null;
}
