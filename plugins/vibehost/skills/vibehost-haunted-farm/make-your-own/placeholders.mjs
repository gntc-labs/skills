#!/usr/bin/env node
// Writes flat-colour placeholder PNGs for every file in art/MANIFEST.md, at
// its final (native) pixel size, using only the 16-colour palette.
//   node make-your-own/placeholders.mjs [--force]
// A placeholder is a solid fill with a 1-px darker border and a 2-px
// "PLACEHOLDER" corner notch, so it reads as a stand-in in screenshots.
// Existing files are kept unless --force: once real art is dropped in at the
// same path, rerunning this never overwrites it. Real art is generated later
// from MANIFEST.md (see its prompts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const force = process.argv.includes("--force");
const palette = JSON.parse(readFileSync(join(root, "art/palette.json"), "utf8")).colors;
const ART = JSON.parse(readFileSync(join(root, "art/art.json"), "utf8")).files;

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function png(w, h, fill, edge) {
  const [fr, fg, fb] = rgb(fill);
  const [er, eg, eb] = rgb(edge);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const border = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const notch = x >= w - 3 && y <= 2;
      const [r, g, b] = border || notch ? [er, eg, eb] : [fr, fg, fb];
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("tEXt", Buffer.from("Comment\0haunted-farm-placeholder", "latin1")),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let wrote = 0;
for (const f of ART) {
  const out = join(root, "art", f.path);
  if (existsSync(out) && !force) continue;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png(f.w, f.h, palette[f.fill], palette[f.edge ?? "void"]));
  wrote++;
}
console.log(`placeholders: wrote ${wrote}, kept ${ART.length - wrote} (of ${ART.length})`);
