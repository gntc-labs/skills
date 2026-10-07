// Haunted Farm — one way to get a headless browser for the skill's scripts
// (build.mjs's link-preview card, make-your-own/ images). Playwright comes
// from --playwright <path> or the current folder's node_modules
// (playwright-core, then playwright); the browser is Google Chrome, else
// Playwright's Chromium, else its headless shell.
import { statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Playwright's chromium, or null when it isn't installed here. */
export async function loadChromium(playwrightPath) {
  const tries = [];
  if (playwrightPath) tries.push(resolve(playwrightPath));
  const req = createRequire(join(process.cwd(), "noop.js"));
  for (const m of ["playwright-core", "playwright"]) {
    try {
      tries.push(req.resolve(m));
    } catch {
      /* not here */
    }
  }
  for (const t of tries) {
    try {
      const m = await import(pathToFileURL(statSync(t).isDirectory() ? join(t, "index.js") : t).href);
      const pw = m.chromium ? m : m.default;
      if (pw?.chromium) return pw.chromium;
    } catch {
      /* next */
    }
  }
  return null;
}

/** A launched browser, or null when none starts. */
export async function launchBrowser(chromium) {
  for (const opts of [{ channel: "chrome" }, { channel: "chromium" }, {}]) {
    try {
      return await chromium.launch(opts);
    } catch {
      /* next */
    }
  }
  return null;
}

/** RGBA pixels of an image (bytes + MIME type), decoded by the page's browser. */
export async function decodeImage(page, bytes, type = "image/png") {
  const src = `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  const { w, h, b64 } = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = "";
    for (let k = 0; k < d.length; k += 0x8000) s += String.fromCharCode(...d.subarray(k, k + 0x8000));
    return { w: c.width, h: c.height, b64: btoa(s) };
  }, src);
  return { w, h, data: new Uint8Array(Buffer.from(b64, "base64")) };
}
