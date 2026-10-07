# Haunted Farm — art manifest

**Status:** 50 files — 50 real art, 0 placeholder (read from the files when this list was generated). A placeholder is a flat-colour PNG at the final native size written by `make-your-own/placeholders.mjs` (PNG `tEXt Comment = haunted-farm-placeholder`); `build.mjs` warns for each one it copies. Dropping a real file at the same path needs no code change.

## How the real art was made

Generated on the Mac (2026-10) from the prompts below, one file per prompt:

1. **EntryDesk** (Gemini image tool) generated each image from its prompt below.
2. **Chroma-keyed** to transparency.
3. **Box-downscaled** to the native size in the table.
4. **Snapped to the 16-colour palette** (`art/palette.json`).
5. **rsynced** over the placeholders in `art/`.

Exception: `ui/og.png` is a **Lanczos resize** to 1200×630 and is **not** palette-snapped (it is a link-preview photo, never drawn on the pixel grid). It is the **generic** card: `build.mjs` renders each village its own (`og.mjs`: the map, the name, the tagline) and ships this one only when no Playwright is at hand. The favicon set in `ui/icons/` (16/32/48, `favicon.ico`, 180, 192, 512) is made from `ui/favicon.png` by `make-your-own/icons.mjs`, whole-pixel scaling only.

**Art batch 2**: `crops/rare-sprout`, `crops/common-growing`, `crops/rare-growing`, `crops/legendary-growing`, `crops/secret-ripe`, `tiles/soil`, `props/sack`, `props/watering-can` and `ui/frame` were regenerated the same way. `ui/frame.png` is now chroma-keyed (transparent outside the wood); the template 9-slices it at 16 px — re-measure the corner studs and change `.panel` in both templates if the frame is ever redrawn.

**Art batch 3**: `crops/rotten.png` (a rotted jack-o'-lantern) and `props/guard-ghost.png` (a guard ghost with a lantern) were drawn the same way. The NPC ghost-farm art (`crops/npc-*`, `npc/ghost-farmer-*`) was retired (no computer-run farms) and deleted.

**Art batch 4**: the six `avatars/farmer-*` become face-only, and Rare and Legendary change colour — **Rare is ghost-white, Legendary is gold** (their growing/ripe sprites are redrawn; the sprouts are green either way). The prompts below say so, and the redrawn files are in `art/` (rsynced from the Mac, same pipeline).

**Art batch 5**: the village map `map/village.png` (eight empty house lots ringing a central plaza) and three houses `map/house-1..3.png`, drawn the same way. The lot centres were measured off the drawn map and live in `template/views/map.js` `MAP_LOTS` (in % of 480×270) — if the map is ever redrawn, re-measure them.

**Art batch 6**: twelve 24×24 `ui/icon-*` sprites replace every emoji the UI used (HUD chips, the Village button, map pips, feed, cards, the settings menu). Shown with `image-rendering: pixelated` at 1× or 2× only. Same pipeline; dropped in unedited.

Art issues still open are listed in the latest round report (`~/haunted-farm-report-9.md`).

- **Palette:** 16 colours, `art/palette.json`: `void` #0d0b14 · `night` #1d1730 · `dusk` #3a2a52 · `plum` #6b3d7a · `moss` #2f4a2c · `leaf` #5b8a3a · `lime` #a6c64b · `soil` #4a2f22 · `loam` #7a4b2e · `pumpkin` #e8731c · `amber` #f5a623 · `candle` #ffe08a · `bone` #f2ead8 · `ash` #9a93a6 · `blood` #a3243b · `spirit` #7fe3d4
- **Grid:** 32×32 tiles. Sprites are drawn at native size and the page upscales them **3×** with `image-rendering: pixelated`.
- **Style reference:** `~/.claude/skills/pumpkin-patch/art/` (attach 2–3 of its `varieties/` and `scenes/` images).
- **This list is generated** from `make-your-own/art-list.mjs`; edit that and rerun, don't edit this file.

50 files.

| File | Native px | Status | Placeholder colour |
|---|---|---|---|
| `art/tiles/grass.png` | 32×32 | real | `moss` #2f4a2c |
| `art/tiles/soil.png` | 32×32 | real | `soil` #4a2f22 |
| `art/tiles/soil-watered.png` | 32×32 | real | `loam` #7a4b2e |
| `art/crops/common-sprout.png` | 32×32 | real | `leaf` #5b8a3a |
| `art/crops/common-growing.png` | 32×32 | real | `pumpkin` #e8731c |
| `art/crops/common-ripe.png` | 32×32 | real | `pumpkin` #e8731c |
| `art/crops/rare-sprout.png` | 32×32 | real | `leaf` #5b8a3a |
| `art/crops/rare-growing.png` | 32×32 | real | `bone` #f2ead8 |
| `art/crops/rare-ripe.png` | 32×32 | real | `bone` #f2ead8 |
| `art/crops/legendary-sprout.png` | 32×32 | real | `leaf` #5b8a3a |
| `art/crops/legendary-growing.png` | 32×32 | real | `candle` #ffe08a |
| `art/crops/legendary-ripe.png` | 32×32 | real | `candle` #ffe08a |
| `art/crops/secret-sprout.png` | 32×32 | real | `leaf` #5b8a3a |
| `art/crops/secret-growing.png` | 32×32 | real | `spirit` #7fe3d4 |
| `art/crops/secret-ripe.png` | 32×32 | real | `spirit` #7fe3d4 |
| `art/props/scarecrow.png` | 32×48 | real | `loam` #7a4b2e |
| `art/props/ghost.png` | 32×32 | real | `bone` #f2ead8 |
| `art/crops/rotten.png` | 32×32 | real | `moss` #2f4a2c |
| `art/props/guard-ghost.png` | 32×32 | real | `spirit` #7fe3d4 |
| `art/props/candy.png` | 16×16 | real | `blood` #a3243b |
| `art/props/watering-can.png` | 16×16 | real | `ash` #9a93a6 |
| `art/props/sack.png` | 16×16 | real | `loam` #7a4b2e |
| `art/avatars/farmer-1.png` | 32×32 | real | `plum` #6b3d7a |
| `art/avatars/farmer-2.png` | 32×32 | real | `blood` #a3243b |
| `art/avatars/farmer-3.png` | 32×32 | real | `bone` #f2ead8 |
| `art/avatars/farmer-4.png` | 32×32 | real | `night` #1d1730 |
| `art/avatars/farmer-5.png` | 32×32 | real | `ash` #9a93a6 |
| `art/avatars/farmer-6.png` | 32×32 | real | `pumpkin` #e8731c |
| `art/ui/frame.png` | 96×96 | real | `dusk` #3a2a52 |
| `art/ui/favicon.png` | 32×32 | real | `pumpkin` #e8731c |
| `art/ui/og.png` | 1200×630 (400×210 ×3) | real (Lanczos, not palette-snapped) | `night` #1d1730 |
| `art/ui/icon-sound-on.png` | 24×24 | real | `bone` #f2ead8 |
| `art/ui/icon-sound-off.png` | 24×24 | real | `ash` #9a93a6 |
| `art/ui/icon-music-on.png` | 24×24 | real | `amber` #f5a623 |
| `art/ui/icon-music-off.png` | 24×24 | real | `ash` #9a93a6 |
| `art/ui/icon-gear.png` | 24×24 | real | `ash` #9a93a6 |
| `art/ui/icon-map.png` | 24×24 | real | `bone` #f2ead8 |
| `art/ui/icon-pumpkin.png` | 24×24 | real | `pumpkin` #e8731c |
| `art/ui/icon-ghost.png` | 24×24 | real | `bone` #f2ead8 |
| `art/ui/icon-warning.png` | 24×24 | real | `amber` #f5a623 |
| `art/ui/icon-water.png` | 24×24 | real | `spirit` #7fe3d4 |
| `art/ui/icon-sack.png` | 24×24 | real | `loam` #7a4b2e |
| `art/ui/icon-hourglass.png` | 24×24 | real | `loam` #7a4b2e |
| `art/map/village.png` | 480×270 (480×270, shown 640–960 px wide) | real | `moss` #2f4a2c |
| `art/map/house-1.png` | 48×48 | real | `pumpkin` #e8731c |
| `art/map/house-2.png` | 48×48 | real | `plum` #6b3d7a |
| `art/map/house-3.png` | 48×48 | real | `leaf` #5b8a3a |
| `art/backgrounds/graveyard.png` | 480×270 | real | `night` #1d1730 |
| `art/backgrounds/witch-forest.png` | 480×270 | real | `dusk` #3a2a52 |
| `art/backgrounds/haunted-school.png` | 480×270 | real | `void` #0d0b14 |

## Prompts (one per file, ready to paste)

### tiles

**`art/tiles/grass.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a seamless tileable patch of dark night-time grass with a few lime blades. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/tiles/soil.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a tilled square of dark farm soil with three furrows, seamless edges. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/tiles/soil-watered.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: the same tilled soil square, darker and glistening as if just watered, two tiny spirit-teal droplets. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

### crops

**`art/crops/common-sprout.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a small round orange pumpkin; stage 1 of 3: a tiny two-leaf sprout poking out of the soil, no pumpkin yet; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/common-growing.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a small round orange pumpkin; stage 2 of 3: a leafy vine with a small unripe green-tinged pumpkin; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/common-ripe.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a small round orange pumpkin; stage 3 of 3: the fully grown ripe pumpkin sitting on its vine, ready to harvest; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/rare-sprout.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a tall ribbed GHOST-WHITE pumpkin, pale bone-white with cool ash shading, with a curly stem — eerie, clearly not orange; stage 1 of 3: a tiny two-leaf sprout poking out of the soil, no pumpkin yet; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/rare-growing.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a tall ribbed GHOST-WHITE pumpkin, pale bone-white with cool ash shading, with a curly stem — eerie, clearly not orange; stage 2 of 3: a leafy vine with a small unripe green-tinged pumpkin; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/rare-ripe.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a tall ribbed GHOST-WHITE pumpkin, pale bone-white with cool ash shading, with a curly stem — eerie, clearly not orange; stage 3 of 3: the fully grown ripe pumpkin sitting on its vine, ready to harvest; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/legendary-sprout.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a huge warty GOLD pumpkin, gleaming candle-yellow with amber shading and a faint candle glow inside — clearly gold, not orange or red; stage 1 of 3: a tiny two-leaf sprout poking out of the soil, no pumpkin yet; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/legendary-growing.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a huge warty GOLD pumpkin, gleaming candle-yellow with amber shading and a faint candle glow inside — clearly gold, not orange or red; stage 2 of 3: a leafy vine with a small unripe green-tinged pumpkin; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/legendary-ripe.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a huge warty GOLD pumpkin, gleaming candle-yellow with amber shading and a faint candle glow inside — clearly gold, not orange or red; stage 3 of 3: the fully grown ripe pumpkin sitting on its vine, ready to harvest; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/secret-sprout.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a rare glowing spirit-teal pumpkin with swirling plum markings, clearly magical; stage 1 of 3: a tiny two-leaf sprout poking out of the soil, no pumpkin yet; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/secret-growing.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a rare glowing spirit-teal pumpkin with swirling plum markings, clearly magical; stage 2 of 3: a leafy vine with a small unripe green-tinged pumpkin; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/crops/secret-ripe.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a rare glowing spirit-teal pumpkin with swirling plum markings, clearly magical; stage 3 of 3: the fully grown ripe pumpkin sitting on its vine, ready to harvest; transparent background, centred on the tile, bottom-aligned. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

### props

**`art/props/scarecrow.png`** — 32×48

```text
Pixel art, native resolution 32×48 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a friendly-spooky scarecrow with a carved jack-o'-lantern head, patched plum coat, straw arms; stands at a farm's corner. Output exactly 32×48 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/props/ghost.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a small cute sheet ghost floating, bone-white with a spirit-teal glow and two dark eyes, mischievous; it sits on a crop to slow it. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

### crops

**`art/crops/rotten.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a rotten, collapsed moldy jack-o'-lantern slumped on its vine, grey-green mold patches, a sad sagging carved face; it must read as 'worthless, clear me away' next to the ripe pumpkins. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

### props

**`art/props/guard-ghost.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a guard ghost standing watch: a sturdier sheet ghost holding a small lit lantern, alert eyes, a little guard's cap; clearly different from the mischievous punishment ghost. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/props/candy.png`** — 16×16

```text
Pixel art, native resolution 16×16 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a single wrapped Halloween candy, blood-red wrapper with bone-white twists; the game's currency icon. Output exactly 16×16 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/props/watering-can.png`** — 16×16

```text
Pixel art, native resolution 16×16 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a tiny grey watering can pouring two spirit-teal drops; the help icon. Output exactly 16×16 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/props/sack.png`** — 16×16

```text
Pixel art, native resolution 16×16 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a tiny burlap loot sack with a candy peeking out; the steal icon. Output exactly 16×16 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

### avatars

**`art/avatars/farmer-1.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: player avatar, FACE ONLY — the head fills the frame, no shoulders or body — a farmer in a witch hat and plum dress, holding a hoe; cheerful, readable at 32 px. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/avatars/farmer-2.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: player avatar, FACE ONLY — the head fills the frame, no shoulders or body — a farmer in a vampire cape and straw hat; cheerful, readable at 32 px. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/avatars/farmer-3.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: player avatar, FACE ONLY — the head fills the frame, no shoulders or body — a farmer in a mummy wrap with an orange scarf; cheerful, readable at 32 px. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/avatars/farmer-4.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: player avatar, FACE ONLY — the head fills the frame, no shoulders or body — a farmer dressed as a black cat, with a basket; cheerful, readable at 32 px. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/avatars/farmer-5.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: player avatar, FACE ONLY — the head fills the frame, no shoulders or body — a farmer in a skeleton onesie and dungarees; cheerful, readable at 32 px. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/avatars/farmer-6.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: player avatar, FACE ONLY — the head fills the frame, no shoulders or body — a farmer with a pumpkin-shaped beanie and a lantern; cheerful, readable at 32 px. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

### ui

**`art/ui/frame.png`** — 96×96

```text
Pixel art, native resolution 96×96 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 9-slice UI panel frame: carved dark wood with tiny pumpkin corner studs, 32-px corners, flat dusk-purple centre that tiles cleanly. Output exactly 96×96 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/favicon.png`** — 32×32

```text
Pixel art, native resolution 32×32 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a jack-o'-lantern face icon, bold, readable at 16 px. Output exactly 32×32 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/og.png`** — 1200×630

```text
Pixel art, native resolution 1200×630 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: link-preview card: a moonlit pixel village of three small farms with pumpkins, a scarecrow and a ghost; leave the left third darker for a title overlay. Draw at 400×210 and upscale 3× nearest-neighbour. Output exactly 1200×630 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-sound-on.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: a loudspeaker with two sound waves (sound ON), bone-white with amber waves; transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-sound-off.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: the same loudspeaker, greyed, with a blood-red ✕ instead of the waves (sound OFF); transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-music-on.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: a pair of beamed eighth notes with a tiny sparkle (music ON), amber and candle-yellow; transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-music-off.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: the same pair of notes, greyed plum, with a blood-red diagonal slash (music OFF); transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-gear.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: a settings gear cog in ash grey with a tiny pumpkin in its hub; transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-map.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: a folded parchment village map with paths and a pumpkin marker; transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-pumpkin.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: a small round orange pumpkin with a green stem: 'something is ripe here'; transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-ghost.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: a small bone-white sheet ghost with dark eyes; transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-warning.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: an amber warning triangle with a void exclamation mark; transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-water.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: a single spirit-teal water drop; transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-sack.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: a tied loam-brown candy sack with a pumpkin patch; transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/ui/icon-hourglass.png`** — 24×24

```text
Pixel art, native resolution 24×24 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a 24×24 UI icon, readable at 24 and 48 px: a wooden hourglass with amber sand running (time left); transparent background. Output exactly 24×24 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

### map

**`art/map/village.png`** — 480×270

```text
Pixel art, native resolution 480×270 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: top-down pixel-art overworld of a small haunted village at night, seen from directly above: winding dirt paths, dark grass, a few tombstones, pumpkins and dead trees at the edges, and EIGHT EMPTY GRASSY HOUSE LOTS (flat clearings about 75×45 px, no buildings on them) in a ring around a central jack-o'-lantern plaza — three along the top, one each left and right of the plaza, three along the bottom — centred at (x, y) ≈ (139, 59), (238, 51), (343, 54), (134, 127), (343, 130), (144, 205), (238, 203), (341, 203) px, joined by the paths. Output exactly 480×270 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/map/house-1.png`** — 48×48

```text
Pixel art, native resolution 48×48 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a small crooked timber cottage with a dark purple roof and glowing windows, seen from slightly above (3/4 view, matching the map), sitting on a small patch of grass; transparent background; it stands on one house lot of the village map and must read at 60–90 px wide. Output exactly 48×48 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/map/house-2.png`** — 48×48

```text
Pixel art, native resolution 48×48 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a narrow witchy house with a plum-purple pointed roof and a crooked chimney, seen from slightly above (3/4 view, matching the map), sitting on a small patch of grass; transparent background; it stands on one house lot of the village map and must read at 60–90 px wide. Output exactly 48×48 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/map/house-3.png`** — 48×48

```text
Pixel art, native resolution 48×48 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: a squat mossy-green farmhouse with a lantern by the door, seen from slightly above (3/4 view, matching the map), sitting on a small patch of grass; transparent background; it stands on one house lot of the village map and must read at 60–90 px wide. Output exactly 48×48 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

### backgrounds

**`art/backgrounds/graveyard.png`** — 480×270

```text
Pixel art, native resolution 480×270 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: village map background (16:9), an old graveyard at night: crooked tombstones, iron fence, a full moon, mist between the graves; the middle 70% is open ground where farm plots are placed, so keep it calm and low-contrast; displayed at 3× (1440×810). Output exactly 480×270 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/backgrounds/witch-forest.png`** — 480×270

```text
Pixel art, native resolution 480×270 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: village map background (16:9), a witch's forest clearing at night: twisted purple trees, glowing mushrooms, a bubbling cauldron in the distance; the middle 70% is open ground where farm plots are placed, so keep it calm and low-contrast; displayed at 3× (1440×810). Output exactly 480×270 px PNG; it is shown upscaled 3× with nearest-neighbour.
```

**`art/backgrounds/haunted-school.png`** — 480×270

```text
Pixel art, native resolution 480×270 px, hard 1-px pixels, no anti-aliasing, no gradients, no blur; only these 16 colours plus full transparency: void #0d0b14, night #1d1730, dusk #3a2a52, plum #6b3d7a, moss #2f4a2c, leaf #5b8a3a, lime #a6c64b, soil #4a2f22, loam #7a4b2e, pumpkin #e8731c, amber #f5a623, candle #ffe08a, bone #f2ead8, ash #9a93a6, blood #a3243b, spirit #7fe3d4. 1-px outline in void #0d0b14. Cozy-spooky Halloween farm game look, 3/4 top-down view, light from the moon at top-left. Match the style of the pumpkin-patch skill art (pumpkin-patch/art: warm orange pumpkins, deep purple night, bone-white highlights). Transparent background unless stated. Subject: village map background (16:9), a haunted schoolyard at night: a dark brick school with one lit window, a bell tower, swings moving by themselves; the middle 70% is open ground where farm plots are placed, so keep it calm and low-contrast; displayed at 3× (1440×810). Output exactly 480×270 px PNG; it is shown upscaled 3× with nearest-neighbour.
```
