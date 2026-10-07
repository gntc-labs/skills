// Haunted Farm — custom avatars and crop skins: fetched from art/<userId>, and
// shown only once every pixel passes; anything else shows the preset art.

import { A, CFG, RULES, state } from "./core.js";
import { avatarFor, farmOf } from "./farms.js";
import { isObj } from "./read.js";
import { render } from "./render.js";
import { IMAGE_LIMITS, SKIN_KINDS, SKIN_STAGES } from "./shared.js";
import { PRACTICE_ID } from "./views/tutorial.js";

function avatarSrc(id) {
  if (id === PRACTICE_ID) return A("props/scarecrow.png");
  const farm = farmOf(id);
  const png = RULES.customAvatar ? artOf(id)?.avatarPng : null;
  if (png && pngOk(png, IMAGE_LIMITS.avatar)) return png;
  const chosen = farm?.avatar; // 1–6 from setup
  const n = chosen ? chosen - 1 : (state.players.get(id)?.player.avatar ?? avatarFor(id));
  return A(`avatars/farmer-${(n % 6) + 1}.png`);
}

// ── custom avatars + crop skins ───────────────────────────
// Stored on farms/<id> as PNG data URLs (from the setup link). Nothing is
// shown until it passes: a PNG, exactly 24×24 (avatar) / 32×32 (skin),
// under the length cap, every pixel transparent or one of the 16 palette
// colours. Anything else — or a rule that's off — means the preset art.

// The pictures live in art/<userId> = { avatarPng?, skins? }, not on the farm
// doc: farms are listed every poll, and a few KB of PNG per farm adds up. The
// farm doc carries only `artVersion`; the art doc is fetched once per version,
// and only when something on screen asks for that farm's pictures. Farms saved
// before this keep them inline (still shown) until the owner's next save.
const artCache = new Map(); // userId → { v, art, loading }
window.__hauntedFarmArt = artCache; // check.mjs waits on these
function artOf(id) {
  const farm = farmOf(id);
  if (!farm) return null;
  if (!farm.artVersion) return farm.avatarPng || farm.skins ? { avatarPng: farm.avatarPng, skins: farm.skins } : null;
  const v = farm.artVersion;
  const hit = artCache.get(id);
  if (hit && hit.v === v) return hit.art;
  if (!state.vh) return null;
  artCache.set(id, { v, art: null, loading: true });
  state.vh
    .get("art", id)
    .then((r) => r && r.doc)
    .then((d) => (d && d.ownerUserId === id && isObj(d.data) ? artIn(d.data) : null))
    .catch(() => null)
    .then((art) => {
      if (artCache.get(id)?.v !== v) return;
      artCache.set(id, { v, art, loading: false });
      if (art) render();
    });
  return null;
}
/** An art doc's shape (the pixels are checked again before anything is shown). */
const artIn = (d) => ({ avatarPng: typeof d.avatarPng === "string" ? d.avatarPng : undefined, skins: isObj(d.skins) ? d.skins : undefined });
const pngChecked = new Map(); // "size:url" → true | false | "pending"
window.__hauntedFarmPng = pngChecked; // check.mjs waits on these
const PALETTE_RGB = new Set((CFG.palette || []).map((hex) => parseInt(hex.slice(1), 16)));

/** Has `url` passed the checks? Starts the check the first time (and redraws once it passes). */
function pngOk(url, { size, maxChars }) {
  const key = `${size}:${url}`;
  if (pngChecked.has(key)) return pngChecked.get(key) === true;
  if (typeof url !== "string" || url.length > maxChars || !url.startsWith("data:image/png;base64,")) {
    pngChecked.set(key, false);
    return false;
  }
  pngChecked.set(key, "pending");
  checkPng(url, size).then((ok) => {
    pngChecked.set(key, ok);
    if (ok) render();
  });
  return false;
}
async function checkPng(url, size) {
  try {
    const bin = atob(url.slice("data:image/png;base64,".length));
    const u32 = (k) => ((bin.charCodeAt(k) << 24) | (bin.charCodeAt(k + 1) << 16) | (bin.charCodeAt(k + 2) << 8) | bin.charCodeAt(k + 3)) >>> 0;
    if (bin.slice(1, 4) !== "PNG" || bin.slice(12, 16) !== "IHDR" || u32(16) !== size || u32(20) !== size) return false;
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth !== size || img.naturalHeight !== size) return false;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, size, size).data;
    for (let k = 0; k < d.length; k += 4) {
      if (d[k + 3] === 0) continue;
      if (d[k + 3] !== 255 || !PALETTE_RGB.has((d[k] << 16) | (d[k + 1] << 8) | d[k + 2])) return false;
    }
    return true;
  } catch {
    return false;
  }
}
/** A farmer's skins, if the village allows them and they fit the budget (else none at all). */
function skinsOf(id) {
  const skins = RULES.cropSkins ? artOf(id)?.skins : null;
  if (!skins || typeof skins !== "object") return null;
  const urls = SKIN_KINDS.flatMap((k) => (skins[k] ? SKIN_STAGES.map((st) => skins[k][st]) : []));
  return urls.join("").length <= IMAGE_LIMITS.skinsTotalChars ? skins : null;
}
/** The picture of `kind` at `stage` on `owner`'s farm: their skin when it passes, else the preset. */
function cropSrc(owner, kind, stage) {
  const url = skinsOf(owner)?.[kind]?.[stage];
  return url && SKIN_STAGES.includes(stage) && pngOk(url, IMAGE_LIMITS.skin) ? url : A(`crops/${kind}-${stage}.png`);
}

export { artIn, avatarSrc, cropSrc, pngOk, skinsOf };
