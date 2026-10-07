// Haunted Farm — constants shared by the page, the try-out's fake SDK, the
// skill's scripts (setup-link.mjs, make-your-own/) and the checks. Pure ESM,
// no DOM: Node imports it too. Game rules live in engine.js; this holds the
// shapes and limits around them, so no copy can drift.
import { RULES } from "./engine.js";

/** A farm's link name (/farm/<slug>): 2–31 lowercase letters, digits or dashes. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;
/** A link name made from a farm name: accents dropped, anything else → "-". */
export function slugify(s) {
  return (
    String(s || "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 31) || "my-farm"
  );
}

/** Scarecrow colours: id → label. */
export const SCARECROWS = Object.freeze({ classic: "Classic", plum: "Plum", moss: "Moss", bone: "Bone", blood: "Blood", spirit: "Spirit" });
export const SCARECROW_IDS = Object.freeze(Object.keys(SCARECROWS));
/** The preset farmers, art/avatars/farmer-<n>.png. */
export const AVATARS = Object.freeze([1, 2, 3, 4, 5, 6]);

/** What a custom image may be: exact size and a data-URL length cap (palette colours only, checked elsewhere). */
export const IMAGE_LIMITS = Object.freeze({
  avatar: Object.freeze({ size: 24, maxChars: 2048 }),
  skin: Object.freeze({ size: 32, maxChars: 2048 }),
  skinsTotalChars: 12288,
});
export const SKIN_KINDS = Object.freeze(["common", "rare", "legendary"]);
export const SKIN_STAGES = Object.freeze(["sprout", "growing", "ripe"]);

/** How long each variety takes to ripen (ms) — the engine's numbers. */
export const GROW_MS = Object.freeze(Object.fromEntries(Object.entries(RULES.kinds).map(([kind, k]) => [kind, k.growMs])));
/** Houses on one district's map. */
export const LOTS_PER_DISTRICT = 8;
/** The tour, in order: step n is TUTORIAL_STEPS[n - 1]. */
export const TUTORIAL_STEPS = Object.freeze(["plant", "village", "steal", "guard", "harvest"]);

/**
 * The fake SDK is a classic script (it must exist before the page's modules
 * run), so it can't import this file: whoever serves it fills its slot.
 */
export const SHARED_SLOT = "/*@shared*/null";
export const fillSharedSlot = (src) =>
  String(src).replace(SHARED_SLOT, () => JSON.stringify({ scarecrows: SCARECROW_IDS, avatars: AVATARS, growMs: GROW_MS, lots: LOTS_PER_DISTRICT }));
