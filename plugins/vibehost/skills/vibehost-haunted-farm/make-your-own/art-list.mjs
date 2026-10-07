#!/usr/bin/env node
// Source of truth for every art file: writes art/art.json (read by
// placeholders.mjs, build.mjs and check.mjs) and art/MANIFEST.md (the
// human list + ready-to-paste image prompts). Edit THIS file, rerun it.
//   node make-your-own/art-list.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const palette = JSON.parse(readFileSync(join(root, "art/palette.json"), "utf8")).colors;
const PAL = Object.entries(palette).map(([k, v]) => `${k} ${v}`).join(", ");

const files = [];
const add = (group, path, w, h, fill, subject, extra = {}) =>
  files.push({ group, path, w, h, fill, subject, ...extra });

add("tiles", "tiles/grass.png", 32, 32, "moss", "a seamless tileable patch of dark night-time grass with a few lime blades");
add("tiles", "tiles/soil.png", 32, 32, "soil", "a tilled square of dark farm soil with three furrows, seamless edges");
add("tiles", "tiles/soil-watered.png", 32, 32, "loam", "the same tilled soil square, darker and glistening as if just watered, two tiny spirit-teal droplets");

const KINDS = {
  common: ["pumpkin", "a small round orange pumpkin"],
  rare: ["bone", "a tall ribbed GHOST-WHITE pumpkin, pale bone-white with cool ash shading, with a curly stem — eerie, clearly not orange"],
  legendary: ["candle", "a huge warty GOLD pumpkin, gleaming candle-yellow with amber shading and a faint candle glow inside — clearly gold, not orange or red"],
  secret: ["spirit", "a rare glowing spirit-teal pumpkin with swirling plum markings, clearly magical"],
};
const STAGES = {
  sprout: "stage 1 of 3: a tiny two-leaf sprout poking out of the soil, no pumpkin yet",
  growing: "stage 2 of 3: a leafy vine with a small unripe green-tinged pumpkin",
  ripe: "stage 3 of 3: the fully grown ripe pumpkin sitting on its vine, ready to harvest",
};
for (const [kind, [fill, look]] of Object.entries(KINDS)) {
  for (const [stage, what] of Object.entries(STAGES)) {
    add("crops", `crops/${kind}-${stage}.png`, 32, 32, stage === "sprout" ? "leaf" : fill, `${look}; ${what}; transparent background, centred on the tile, bottom-aligned`);
  }
}

add("props", "props/scarecrow.png", 32, 48, "loam", "a friendly-spooky scarecrow with a carved jack-o'-lantern head, patched plum coat, straw arms; stands at a farm's corner");
add("props", "props/ghost.png", 32, 32, "bone", "a small cute sheet ghost floating, bone-white with a spirit-teal glow and two dark eyes, mischievous; it sits on a crop to slow it");
add("crops", "crops/rotten.png", 32, 32, "moss", "a rotten, collapsed moldy jack-o'-lantern slumped on its vine, grey-green mold patches, a sad sagging carved face; it must read as 'worthless, clear me away' next to the ripe pumpkins");
add("props", "props/guard-ghost.png", 32, 32, "spirit", "a guard ghost standing watch: a sturdier sheet ghost holding a small lit lantern, alert eyes, a little guard's cap; clearly different from the mischievous punishment ghost");
add("props", "props/candy.png", 16, 16, "blood", "a single wrapped Halloween candy, blood-red wrapper with bone-white twists; the game's currency icon");
add("props", "props/watering-can.png", 16, 16, "ash", "a tiny grey watering can pouring two spirit-teal drops; the help icon");
add("props", "props/sack.png", 16, 16, "loam", "a tiny burlap loot sack with a candy peeking out; the steal icon");

const FARMERS = [
  "a farmer in a witch hat and plum dress, holding a hoe",
  "a farmer in a vampire cape and straw hat",
  "a farmer in a mummy wrap with an orange scarf",
  "a farmer dressed as a black cat, with a basket",
  "a farmer in a skeleton onesie and dungarees",
  "a farmer with a pumpkin-shaped beanie and a lantern",
];
FARMERS.forEach((d, i) => add("avatars", `avatars/farmer-${i + 1}.png`, 32, 32, ["plum", "blood", "bone", "night", "ash", "pumpkin"][i], `player avatar, FACE ONLY — the head fills the frame, no shoulders or body — ${d}; cheerful, readable at 32 px`));

add("ui", "ui/frame.png", 96, 96, "dusk", "a 9-slice UI panel frame: carved dark wood with tiny pumpkin corner studs, 32-px corners, flat dusk-purple centre that tiles cleanly");
add("ui", "ui/favicon.png", 32, 32, "pumpkin", "a jack-o'-lantern face icon, bold, readable at 16 px");
add("ui", "ui/og.png", 1200, 630, "night", "link-preview card: a moonlit pixel village of three small farms with pumpkins, a scarecrow and a ghost; leave the left third darker for a title overlay. Draw at 400×210 and upscale 3× nearest-neighbour", { native: "400×210 ×3", root: true });
add("ui", "ui/icon-sound-on.png", 24, 24, "bone", "a 24×24 UI icon, readable at 24 and 48 px: a loudspeaker with two sound waves (sound ON), bone-white with amber waves; transparent background");
add("ui", "ui/icon-sound-off.png", 24, 24, "ash", "a 24×24 UI icon, readable at 24 and 48 px: the same loudspeaker, greyed, with a blood-red ✕ instead of the waves (sound OFF); transparent background");
add("ui", "ui/icon-music-on.png", 24, 24, "amber", "a 24×24 UI icon, readable at 24 and 48 px: a pair of beamed eighth notes with a tiny sparkle (music ON), amber and candle-yellow; transparent background");
add("ui", "ui/icon-music-off.png", 24, 24, "ash", "a 24×24 UI icon, readable at 24 and 48 px: the same pair of notes, greyed plum, with a blood-red diagonal slash (music OFF); transparent background");
add("ui", "ui/icon-gear.png", 24, 24, "ash", "a 24×24 UI icon, readable at 24 and 48 px: a settings gear cog in ash grey with a tiny pumpkin in its hub; transparent background");
add("ui", "ui/icon-map.png", 24, 24, "bone", "a 24×24 UI icon, readable at 24 and 48 px: a folded parchment village map with paths and a pumpkin marker; transparent background");
add("ui", "ui/icon-pumpkin.png", 24, 24, "pumpkin", "a 24×24 UI icon, readable at 24 and 48 px: a small round orange pumpkin with a green stem: 'something is ripe here'; transparent background");
add("ui", "ui/icon-ghost.png", 24, 24, "bone", "a 24×24 UI icon, readable at 24 and 48 px: a small bone-white sheet ghost with dark eyes; transparent background");
add("ui", "ui/icon-warning.png", 24, 24, "amber", "a 24×24 UI icon, readable at 24 and 48 px: an amber warning triangle with a void exclamation mark; transparent background");
add("ui", "ui/icon-water.png", 24, 24, "spirit", "a 24×24 UI icon, readable at 24 and 48 px: a single spirit-teal water drop; transparent background");
add("ui", "ui/icon-sack.png", 24, 24, "loam", "a 24×24 UI icon, readable at 24 and 48 px: a tied loam-brown candy sack with a pumpkin patch; transparent background");
add("ui", "ui/icon-hourglass.png", 24, 24, "loam", "a 24×24 UI icon, readable at 24 and 48 px: a wooden hourglass with amber sand running (time left); transparent background");

// Village map. The lot centres are template/views/map.js MAP_LOTS —
// the prompt names them so the drawn lots land where the houses go.
add("map", "map/village.png", 480, 270, "moss", "top-down pixel-art overworld of a small haunted village at night, seen from directly above: winding dirt paths, dark grass, a few tombstones, pumpkins and dead trees at the edges, and EIGHT EMPTY GRASSY HOUSE LOTS (flat clearings about 75×45 px, no buildings on them) in a ring around a central jack-o'-lantern plaza — three along the top, one each left and right of the plaza, three along the bottom — centred at (x, y) ≈ (139, 59), (238, 51), (343, 54), (134, 127), (343, 130), (144, 205), (238, 203), (341, 203) px, joined by the paths", { native: "480×270, shown 640–960 px wide" });
for (const [n, d] of [
  [1, "a small crooked timber cottage with a dark purple roof and glowing windows"],
  [2, "a narrow witchy house with a plum-purple pointed roof and a crooked chimney"],
  [3, "a squat mossy-green farmhouse with a lantern by the door"],
]) {
  add("map", `map/house-${n}.png`, 48, 48, ["pumpkin", "plum", "leaf"][n - 1], `${d}, seen from slightly above (3/4 view, matching the map), sitting on a small patch of grass; transparent background; it stands on one house lot of the village map and must read at 60–90 px wide`);
}

const THEMES = {
  graveyard: "an old graveyard at night: crooked tombstones, iron fence, a full moon, mist between the graves",
  "witch-forest": "a witch's forest clearing at night: twisted purple trees, glowing mushrooms, a bubbling cauldron in the distance",
  "haunted-school": "a haunted schoolyard at night: a dark brick school with one lit window, a bell tower, swings moving by themselves",
};
for (const [id, d] of Object.entries(THEMES)) {
  add("backgrounds", `backgrounds/${id}.png`, 480, 270, id === "graveyard" ? "night" : id === "witch-forest" ? "dusk" : "void", `village map background (16:9), ${d}; the middle 70% is open ground where farm plots are placed, so keep it calm and low-contrast; displayed at 3× (1440×810)`);
}

// og.png is the generic card, used only when build.mjs can't render the village's own (site/og.png):
// it isn't in art.json, so it isn't copied into site/art/ as well.
writeFileSync(join(root, "art/art.json"), JSON.stringify({ palette: "palette.json", files: files.filter((f) => !f.root) }, null, 2) + "\n");

// Real art vs placeholder is read from the files themselves: placeholders
// carry the PNG tEXt marker placeholders.mjs writes.
const statusOf = (f) => {
  const path = join(root, "art", f.path);
  if (!existsSync(path)) return "missing";
  return readFileSync(path).includes(Buffer.from("haunted-farm-placeholder")) ? "placeholder" : "real";
};
const counts = files.reduce((a, f) => ((a[statusOf(f)] = (a[statusOf(f)] || 0) + 1), a), {});

const STYLE = `Pixel art, native resolution {W}×{H} px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: ${PAL}. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: {S}. Output exactly {W}×{H} px PNG; it is shown upscaled 3× with nearest-neighbour.`;

const lines = [
  "# Haunted Farm — art manifest",
  "",
  `**Status:** ${files.length} files — ${counts.real || 0} real art, ${counts.placeholder || 0} placeholder${counts.missing ? `, ${counts.missing} missing` : ""} (read from the files when this list was generated). A placeholder is a flat-colour PNG at the final native size written by \`make-your-own/placeholders.mjs\` (PNG \`tEXt Comment = haunted-farm-placeholder\`); \`build.mjs\` warns for each one it copies. Dropping a real file at the same path needs no code change.`,
  "",
  "## How the real art was made",
  "",
  "Generated on the Mac (2026-10) from the prompts below, one file per prompt:",
  "",
  "1. **EntryDesk** (Gemini image tool) generated each image from its prompt below.",
  "2. **Chroma-keyed** to transparency.",
  "3. **Box-downscaled** to the native size in the table.",
  "4. **Snapped to the 16-colour palette** (`art/palette.json`).",
  "5. **rsynced** over the placeholders in `art/`.",
  "",
  "Exception: `ui/og.png` is a **Lanczos resize** to 1200×630 and is **not** palette-snapped (it is a link-preview photo, never drawn on the pixel grid). It is the **generic** card: `build.mjs` renders each village its own (`og.mjs`: the map, the name, the tagline) and ships this one only when no Playwright is at hand. The favicon set in `ui/icons/` (16/32/48, `favicon.ico`, 180, 192, 512) is made from `ui/favicon.png` by `make-your-own/icons.mjs`, whole-pixel scaling only.",
  "",
  "**Art batch 2**: `crops/rare-sprout`, `crops/common-growing`, `crops/rare-growing`, `crops/legendary-growing`, `crops/secret-ripe`, `tiles/soil`, `props/sack`, `props/watering-can` and `ui/frame` were regenerated the same way. `ui/frame.png` is now chroma-keyed (transparent outside the wood); the template 9-slices it at 16 px — re-measure the corner studs and change `.panel` in both templates if the frame is ever redrawn.",
  "",
  "**Art batch 3**: `crops/rotten.png` (a rotted jack-o'-lantern) and `props/guard-ghost.png` (a guard ghost with a lantern) were drawn the same way. The NPC ghost-farm art (`crops/npc-*`, `npc/ghost-farmer-*`) was retired (no computer-run farms) and deleted.",
  "",
  "**Art batch 4**: the six `avatars/farmer-*` become face-only, and Rare and Legendary change colour — **Rare is ghost-white, Legendary is gold** (their growing/ripe sprites are redrawn; the sprouts are green either way). The prompts below say so, and the redrawn files are in `art/` (rsynced from the Mac, same pipeline).",
  "",
  "**Art batch 5**: the village map `map/village.png` (eight empty house lots ringing a central plaza) and three houses `map/house-1..3.png`, drawn the same way. The lot centres were measured off the drawn map and live in `template/views/map.js` `MAP_LOTS` (in % of 480×270) — if the map is ever redrawn, re-measure them.",
  "",
  "**Art batch 6**: twelve 24×24 `ui/icon-*` sprites replace every emoji the UI used (HUD chips, the Village button, map pips, feed, cards, the settings menu). Shown with `image-rendering: pixelated` at 1× or 2× only. Same pipeline; dropped in unedited.",
  "",
  "Art issues still open are listed in the latest round report (`~/haunted-farm-report-9.md`).",
  "",
  "- **Palette:** 16 colours, `art/palette.json`: " + Object.entries(palette).map(([k, v]) => `\`${k}\` ${v}`).join(" · "),
  "- **Grid:** 32×32 tiles. Sprites are drawn at native size and the page upscales them **3×** with `image-rendering: pixelated`.",
  "- **Style reference:** `~/.claude/skills/pumpkin-patch/art/` (attach 2–3 of its `varieties/` and `scenes/` images).",
  "- **This list is generated** from `make-your-own/art-list.mjs`; edit that and rerun, don't edit this file.",
  "",
  `${files.length} files.`,
  "",
  "| File | Native px | Status | Placeholder colour |",
  "|---|---|---|---|",
  ...files.map((f) => `| \`art/${f.path}\` | ${f.w}×${f.h}${f.native ? ` (${f.native})` : ""} | ${statusOf(f)}${f.path === "ui/og.png" ? " (Lanczos, not palette-snapped)" : ""} | \`${f.fill}\` ${palette[f.fill]} |`),
  "",
  "## Prompts (one per file, ready to paste)",
  "",
];
let group = "";
for (const f of files) {
  if (f.group !== group) {
    group = f.group;
    lines.push(`### ${group}`, "");
  }
  lines.push(`**\`art/${f.path}\`** — ${f.w}×${f.h}`, "", "```text", STYLE.replaceAll("{W}", String(f.w)).replaceAll("{H}", String(f.h)).replace("{S}", f.subject), "```", "");
}
writeFileSync(join(root, "art/MANIFEST.md"), lines.join("\n"));
console.log(`art-list: ${files.length} files → art/art.json, art/MANIFEST.md`);
