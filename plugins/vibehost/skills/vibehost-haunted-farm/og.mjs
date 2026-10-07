// Haunted Farm — link-preview cards (1200×630 PNG), rendered in a headless
// browser from HTML, then stored as an indexed PNG (≤ 256 colours, small).
// build.mjs renders one per village (its name, tagline and map); the
// campaign landing page renders its own card with renderCard() too.
//
// Chat apps crop: Slack / iMessage often show the centre square (x 285–915),
// others the full 1.91:1. Everything that must be read sits in that square.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { decodeImage } from "./browser.mjs";
import { encodePng8 } from "./make-your-own/png.mjs";

export const OG = Object.freeze({ width: 1200, height: 630, maxBytes: 300 * 1024 });
/** The part of the card a square crop keeps. */
export const SQUARE = Object.freeze({ left: (1200 - 630) / 2, right: (1200 + 630) / 2 });
export const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Jersey+10&family=Space+Mono:wght@400;700&display=block";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fileUrl = (p) => pathToFileURL(p).href;

/**
 * A village's card: its map with a few houses, the name (Jersey 10), the
 * tagline (Space Mono), a "Haunted Farm" badge and "a VibeHost village".
 * `art(path)` → the absolute file path of art/<path>.
 */
export function villageCardHtml({ name, tagline, art, colors }) {
  const c = colors;
  // Houses on the map's lots (in % of the map), clear of the title panel.
  const houses = [
    { x: 13, y: 30, h: 1 },
    { x: 12, y: 74, h: 3 },
    { x: 87, y: 28, h: 2 },
    { x: 88, y: 72, h: 1 },
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><link href="${FONTS_CSS}" rel="stylesheet"><style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:${c.void};}
  body{position:relative;font-synthesis:none;}
  img{position:absolute;image-rendering:pixelated;}
  .map{left:0;top:-22px;width:1200px;height:675px;}
  .shade{position:absolute;inset:0;background:radial-gradient(ellipse 430px 330px at 50% 50%, ${c.void}e6 0 55%, ${c.void}66 100%);}
  .house{width:144px;height:144px;transform:translate(-50%,-60%);}
  .ghost{width:96px;height:96px;}
  .panel{position:absolute;left:${SQUARE.left + 12}px;top:64px;width:${630 - 24}px;height:502px;box-sizing:border-box;padding:30px 34px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;background:${c.night}ee;border:6px solid ${c.void};box-shadow:8px 8px 0 ${c.void};}
  .badge{display:inline-flex;align-items:center;gap:10px;padding:4px 16px 4px 8px;font:34px/1 "Jersey 10",monospace;color:${c.void};background:${c.spirit};}
  .badge img{position:static;width:36px;height:36px;}
  h1{margin:0;max-width:530px;text-wrap:balance;font:400 96px/0.98 "Jersey 10",monospace;color:${c.candle};text-shadow:5px 5px 0 ${c.void};overflow-wrap:anywhere;}
  .tag{margin:0;max-width:530px;text-wrap:balance;font:400 25px/1.35 "Space Mono",monospace;color:${c.bone};}
  .by{margin:0;font:400 19px/1 "Space Mono",monospace;color:${c.ash};}
</style></head><body>
<img class="map" src="${fileUrl(art("map/village.png"))}" alt="">
<div class="shade"></div>
${houses.map((h) => `<img class="house" src="${fileUrl(art(`map/house-${h.h}.png`))}" style="left:${h.x}%;top:${h.y}%" alt="">`).join("\n")}
<img class="ghost" src="${fileUrl(art("props/ghost.png"))}" style="left:1040px;top:250px" alt="">
<div class="panel">
  <span class="badge"><img src="${fileUrl(art("ui/favicon.png"))}" alt="">Haunted Farm</span>
  <h1 id="title">${esc(name)}</h1>
  <p class="tag" id="tag">${esc(tagline)}</p>
  <p class="by">a VibeHost village</p>
</div>
<script>
  // Long names and taglines shrink until they fit the panel (2 and 3 lines).
  window.fit = () => {
    const lines = (el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
    const shrink = (el, max, min, rows) => {
      for (let s = max; s >= min; s -= 2) {
        el.style.fontSize = s + "px";
        if (lines(el) <= rows && el.scrollWidth <= el.clientWidth + 1) return;
      }
    };
    shrink(document.getElementById("title"), 96, 44, 2);
    shrink(document.getElementById("tag"), 25, 17, 3);
  };
</script>
</body></html>`;
}

/**
 * Render `html` (a full page; file:// assets allowed) to a 1200×630 indexed
 * PNG at `out`. `browser` is a launched Playwright browser. Returns
 * { bytes, fonts } — fonts false when the web fonts couldn't load (offline:
 * the card then uses the monospace fallback).
 */
export async function renderCard(browser, html, out) {
  const dir = mkdtempSync(join(tmpdir(), "hf-og-"));
  try {
    writeFileSync(join(dir, "card.html"), html);
    const page = await browser.newPage({ viewport: { width: OG.width, height: OG.height } });
    await page.goto(pathToFileURL(join(dir, "card.html")).href, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 5000))])).catch(() => {});
    const fonts = await page.evaluate(() => document.fonts.check('40px "Jersey 10"') && [...document.fonts].some((f) => f.family.includes("Jersey") && f.status === "loaded")).catch(() => false);
    await page.evaluate(() => window.fit?.()).catch(() => {});
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    const shot = await page.screenshot({ type: "png" });
    const img = await decodeImage(page, shot);
    await page.close();
    const bytes = encodePng8(img.w, img.h, img.data);
    writeFileSync(out, bytes);
    return { bytes, fonts };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
