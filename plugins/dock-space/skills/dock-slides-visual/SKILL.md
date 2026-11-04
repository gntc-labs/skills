---
name: dock-slides-visual
description: The look of every Dock deck, built from native objects — custom-geometry shapes, texture fills, shadow and glow, theme fonts, Morph and entrance builds — with style packs for torn-paper collage, kinetic typography, retro CRT, board explainer and pixel art. Load it after dock-slides for every deck; a style, mood or "video-like" ask (拼貼, 撕紙, 動態字, 復古, 像素, 視覺化說明) picks its pack.
---

# High-design decks in Dock

Load `dock-slides` first: its plan, art direction, numbers, writing rules and rubric all still apply. This page
adds the visual layer. Every recipe below was built through the MCP tools on Dock staging and read
back. A note that starts with **Today** and an issue number describes current behaviour that issue
is changing; check the issue before you work around it.

**Native first.** Build every visible thing from native objects: real text, shapes with custom
geometry, picture fills, effects, rotation, blend. They show the same in the editor, the server
render, thumbnails, exports and PowerPoint. An HTML block is for what native objects cannot do: live
3-D, a simulation, data that moves (section 3.11). It is also a draft you convert to native objects
(3.10, **Draft in HTML, then convert**).

If your host defers tool schemas, load these in one search:
`dock_slides_apply`, `dock_slides_script`, `dock_slides_verb_search`, `dock_slides_verb_describe`,
`dock_slides_lint`, `dock_slides_render`, `dock_slides_verify`,
`dock_slides_layouts`, `dock_slides_insert_from_asset`, `dock_slides_edit_html_block`,
`dock_slides_edit_link`, `dock_slides_edit_transition`, `dock_slides_edit_batch`, `dock_slides_arrange`, `dock_slides_get`, `dock_slides_create`,
`dock_slides_export`, `dock_slides_upsert_chart`, `dock_asset_upload` and `dock_image_generate` when the deck needs them.

## 0. Storyboard before the first slide

A deck's look is its art direction (`dock-slides/plan`) plus a sequence of compositions. The art
direction is a pack from section 4 when the user names a style, and your own at the same detail
when they do not (section 4 ends with a kit to start from); either way it is locked into the theme
once. The compositions are the storyboard, and they are what makes a deck worth looking at. Write
the storyboard into the plan (`dock-slides/plan`, each slide's `composition`) before you build
anything. A roster or catalog is the exception: its items are one pattern repeated on one layout
(`dock-slides/compose`), so it takes the art direction and the motif but no storyboard.

- **A motif** that carries the deck's concept, runs through every slide and changes place: a lime
  rule that crosses the cover, splits two lines on the next slide and becomes the axis of the
  closing diagram; one notebook whose page changes kind. Name it in the art direction.
- **A composition per slide**, drawn from this set and its kin: a giant word cropped off an edge
  (3.4); a full-colour inversion slide; bands that mask the words they carry; a word filled with a
  picture (3.10); a grid of letters, one of them pushed in by Morph; scattered items on one half
  pulled into a grid on the other; a full-bleed picture with text laid on it; comic panels; cards
  or sticky notes at small tilts (3.1); speech bubbles that build in order; a map. Each slide takes a
  different one from its neighbours.
- **A motion score**: the moves between and within slides, written slide by slide before any
  motion is added. Motion in a keynote is spent like emphasis in a sentence: a deck where every
  slide moves has no moment that stands out.
  - _Grammar_: one transition plus Morph, and one entrance verb: the style pack's (section 4), or
    floatIn about 500 ms with smoothEnd (3.8). The everyday transition stays quiet: fade, cut or
    Morph. Wipe from left draws a line, rule or strip and
    nothing else. A direction means the same thing on every slide (left to right is progress).
    Durations and staggers are tokens the whole deck reuses: entrance 500 ms, stagger 60–100 ms,
    Morph 800–1000 ms, or the pack's own.
  - _Signature move_: the style pack's signature move is the one place the grammar bends (a
    different verb, a longer Morph, a slide that builds by itself), and it plays only at a
    signature moment. In a deck presented in Dock, a Dock Original (3.7) is a signature move: spend
    one on an act break, a reveal or the close.
  - _Budget_: one signature moment per act, about three in a deck; builds on a third of the slides
    or fewer; every other slide changes by cut, fade or Morph alone.
  - _Cue_: each build names the speaker line that reveals it and plays on that click; a slide's
    motion starts by itself only at a signature moment. Write each cue into the speaker notes.
  - _Continuity_: a motif persists through Morph `!!` pairs (3.6), so the same object travels from
    slide to slide where a new one would otherwise enter.
  - _Stillness_: a live material layer (3.11) belongs to a cover or section slide with no build of
    its own; behind a build, its Fallback is enough.

The storyboard is done when, read top to bottom, slide N never predicts slide N+1's composition,
every slide names the one thing that reads first, and every animation in the motion score answers
"what does it reveal, on which line". Build slide 1 to its frame and render it once, alone, against
the style: it fixes the art direction. Then build every later slide to its own frame and render
them together, eight per call (`dock-slides/check`).

## 1. How every verb is sent

- **MCP end to end is the default.** Build several slides with ONE `dock_slides_script`
  (`dock-slides`, **Several slides of native objects: one script**): emit each slide's ops together,
  its shapes as one `DrawStyled`, and it sends neighbouring ops as one atomic apply (up to 100); the same
  `idempotency_key` resumes it. Build or fix one slide with ONE `dock_slides_apply` call,
  `execution:"atomic"` (one commit, about a second). A generated .pptx (section 2.1) only saves
  calls, for a sandbox agent or many repeated pages.
- **One op per element.** A shape, text box or line with its fill (solid, gradient, alpha),
  outline, glow, shadow and styled paragraphs (text glow and shadow too) is ONE `DrawShape` /
  `DrawLine` op; a picture with its crop, opacity, rounded or preset frame, border, glow and shadow
  is ONE `DrawImage` op; each one's arguments are in `dock_slides_verb_describe`. Style with separate verbs only
  what they do not carry: custom geometry, texture and picture fills, blend, 3-D, WordArt, a
  picture's recolour.
- **Shapes that share a look: ONE `DrawStyled` op.** Name each look once in `styles` (every
  `DrawShape` field except `slide`, `x`, `y`, `w`, `h` and the words), then list each slide's shapes
  as rows `[style, x, y, w, h, paragraphs?, extra?]`. A paragraph is a string, laid over the style's
  `text.paragraphs` entry at its position (or the last entry); write a paragraph object instead for
  runs. `extra` holds `DrawShape` fields for that one row (`name`, `rotation`, a different `fill`). A
  list in x, y, w or h draws one shape per entry. The server expands it into the plain `DrawShape`
  ops, so the result, the undo and the refusals are the same as writing them out, at about half the
  output. Indexes (`@<index>`, `minted`) count the expanded shapes in row order. Use it for every
  title, body, card, label and repeated mark; keep one-off shapes as `DrawShape`.

  ```json
  {
    "method": "DrawStyled",
    "styles": {
      "title": {
        "textBox": true,
        "text": {
          "font": "Inter",
          "eaFont": "Noto Sans TC",
          "color": "0F172A",
          "insets": { "left": 0, "top": 0, "right": 0, "bottom": 0 },
          "paragraphs": [{ "size": 36, "bold": true }]
        }
      },
      "card": {
        "geom": "roundRect",
        "fill": { "color": "1E3A8A" },
        "text": {
          "font": "Inter",
          "eaFont": "Noto Sans TC",
          "color": "FFFFFF",
          "anchor": "top",
          "paragraphs": [{ "size": 40, "bold": true }, { "size": 14 }]
        }
      },
      "dot": { "geom": "ellipse", "fill": { "color": "FBBF24" } }
    },
    "slides": {
      "sl3": [
        ["title", 60, 40, 840, 70, ["三個數字"]],
        ["card", 60, 160, 260, 180, ["2.4M", "每月人次"]],
        ["card", 350, 160, 260, 180, ["61%", "一次性餐具"]],
        ["dot", [60, 90, 120, 150], 380, 12, 12]
      ]
    }
  }
  ```

- Find a verb with `dock_slides_verb_search`, read its fields with `dock_slides_verb_describe`
  (`{"methods": ["SetRot"]}`), and send
  the NAMED form `{"method":"SetRot","slide":"sl1","shape":4,"deg":-2}`. The values below are the
  ones that worked. Describe gives each field as one line (`name?: type — note`). The note is the
  first sentence of the field's description; it ends in `…` whenever anything was left out (a long
  sentence cut short, or the sentences after it), and a note without `…` is the whole description.
  `detail: "schema"` on that one verb gives its full ranges and whole notes.
- Search takes plain words ("strikethrough", "rounded corners", "chart text colour"). Describe
  names the keys of a chart's JSON patch (EditChart, EditChartEx, FormatChartEx), says when an op
  needs `asOfSeq`, and answers a verb you cannot send under `withheld` with the reason. A verb neither tool finds is
  not one Dock lacks until you have tried a second wording.
- Send every verb on this page through `dock_slides_apply` (`ops`, `execution`, `idempotency_key`,
  `summary`), or emit it from a script. One apply call carries one slide or a small edit: up to 100
  ops atomic once `DrawStyled` rows are expanded, 20 resumable. Creates, pictures, backgrounds, theme
  fonts, transitions, charts, animations and HTML blocks alike. A refusal in its pre-check sends
  nothing, so fix that op and re-send the same call. Keep it apart from `dock_slides_edit_batch`: that
  older batch tool refuses the background, theme-font, transition, chart and HTML-block families.
- A single-op tool needs an `idempotency_key` too: `dock_slides_edit_link` and
  `dock_slides_edit_transition` refuse a call without one.
- Ops that address an ordinal (a run's `p`/`r` in `StyleRange` or `SetRunText`, a table cell, a
  chart series or point) are dated by a top-level `asOfSeq` beside `ops`, from your latest read.
  When anyone else writes the deck, read again and pass the fresh `asOfSeq` before each such call.
- **Build a slide in one batch where you can.** Create each element styled (`DrawStyled` /
  `DrawShape` / `DrawLine` / `DrawImage`), and give whatever it does not carry to the same batch by `"@<index>"`, the index of
  the op that made it: `{"method":"SetShapeName","slide":"sl3","shape":"@0","name":"!!motif"}`.
  Read `dock_slides_get {geometry:"boxes"}` only to address shapes an EARLIER call made, and map their
  `{#n}` ids in creation order (on a blank slide of a new deck they run 2, 3, 4…). The `sid_…` handle
  a create returns is not an edit id.
- New slides: `AddSlideWithLayout {slide:"end", layoutRef}` with the Blank layout's `stableRef` from
  `dock_slides_layouts` gives an empty slide, and `AddSlideOnLayout {slide:"end"}` gives empty
  placeholders; both render blank. A bare `AddSlide` writes a literal "Click to add title" run (lint
  reports it as `prompt-text`), so write its title or delete it.
- Text: `AddText` and `SetText` take one paragraph. Several lines go through `SetParagraphs` with
  `paras` as a JSON string: `[{"srcP":0,"segs":[{"cid":null,"text":"line 1"}]},{"srcP":0,"segs":[{"cid":null,"text":"line 2"}]}]`.
  Style a whole box with `StyleShape attr ∈ b, sz, color, spc, font, eafont` (values are strings:
  `"1"`, `"64"`, `"#111111"`); `spc` takes −5..20.
- Display text boxes: `SetBodyPr` `ins "0,0,0,0"`, `autofit "none"`, and `wrap "none"` for big
  words, so the editor and the server render break lines the same way.
- Read-back is in fractions and 0–360: `SetRot -2` reads `rot: 358`, `SetFillAlpha 82` reads
  `fillFmt.alpha: 0.82`, a tile sent as `sx=100` reads `fillFmt.picture.sx: 1`. Send percent
  (`sx=100`) and expect the ratio back.
- `committed` means the room accepted the op. Several verbs commit and then skip (`SetMorphOption`
  on a slide without Morph, `SetAnchor` / `SetLineSpacing` on a shape with no text), so trust the
  read-back and the render.

## 2. Getting your own textures and pictures in

Image slots (`AddImage.image`, `SetShapePictureFill.imgB64`, `SetSlideBgFill.imgB64`) take either
raw base64 bytes or a `dock-asset://asset_…`. Pick the path by what you are running in:

| You are                                                           | Path                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| An agent with a code sandbox behind Dock's remote MCP (EntryDesk) | **A**: generate in the sandbox, hand Dock its `ed://` uri |
| An agent on the local Dock MCP server (stdio)                     | `dock_asset_upload` with `file_path`                      |
| Any agent that can produce a few KB of PNG bytes                  | **B**: base64 straight into the slot                      |
| No code at all                                                    | **C**: native-only texture, or `dock_image_generate`      |

**A: sandbox → `ed://` uri → asset.** EntryDesk's sandbox has Python with pillow and numpy
(`pip install python-pptx` works too).

1. Write the PNG (a 128–256 px seamless paper tile, a tape strip with alpha, a scanline background)
   or a whole .pptx to a file in the sandbox.
2. Call `sandbox__get_file_download_url` on it. It answers with an `ed://assets/<id>` uri.
3. Call `dock_asset_upload` with that uri as `url`, unchanged and as the whole value (a list of
   uris in one call is fine). EntryDesk swaps it for a fresh https URL before Dock fetches it. A
   file the user attached arrives as `ed://uploads/<fileId>` and goes in the same way.
4. Use the returned `dock-asset://asset_…` in the image slot, or bring a .pptx in (2.1).
   The `ed://` uri is not a picture address: keep it out of slides and pages.

**B: inline base64.** Send the PNG bytes as base64 (no `data:` prefix). Measured on staging: a
3.5 KB kraft tile and a 57 KB paper tile both filled shapes and a background; anything over 32 KiB
is staged out of the op log for you. Every base64 character is output you write, so keep tiles to a
few KB (64–128 px, few colours) and reuse one tile on many shapes.

**C: no bytes.** Paper and light from native fills only: `SetShapeGradient` (stops `"0:F3EFE6,1:E7E1D4"`,
positions 0–1), `SetFillAlpha` over a solid fill, a background gradient
(`SetSlideBgFill kind:"grad", opts:"stops=0:F3EFE6|1:E7E1D4,type=linear,angle=90"`), and torn
custom geometry (3.1), which carries most of the paper look. A real picture you lack:
`dock_image_generate` (it draws to a daily budget, so ask once), else leave a labelled frame and
say so in the handover.

### 2.1 Bringing in a whole .pptx

| Entry point                                                                       | Use it for                         | What arrives                                                   |
| --------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `dock_slides_create {from_asset}`                                                 | a NEW deck from the file           | everything: masters, theme fonts, backgrounds, objects, motion |
| `dock_slides_insert_from_asset {asset_id, after, slides?}`                        | pages merged into an existing deck | the pages on the DESTINATION's master, layout and theme        |
| `dock slides replace <id> <file> --base-generation <n>` (CLI / REST, no MCP tool) | swapping the whole file of a deck  | the file as is                                                 |

Insert, measured on staging: custGeom, tile fills, blend, shadow and glow, rotation, a slide's own
background, `!!` names, animations and transitions all arrive; the source's THEME FONTS and MASTER
BACKGROUND do not. Text that followed the source theme takes the destination's theme face; text
with an explicit `SetFont` keeps its face. So before inserting, give the destination the same
`SetMasterThemeFonts` and `SetMasterBgFill`, or put the background on each slide in the source.
Pages over 30 go in slices of `slides`, and the slide size is not reconciled.

Replace is conditional: `--base-generation` is the generation `dock slides export` printed, and a
replace in between answers 409. It is also refused while the deck's room is live, including right
after your own MCP edits, so replace a deck before you style it with verbs, or style a new one.

## 3. Recipes

### 3.1 Torn-paper card

1. `AddShape {x,y,w,h, geom:"rect"}` twice: the rim, and the face inset 6 pt each side.
2. `SetCustGeom {x,y,w,h, path}` on each, with the same box as the shape. `path` is integer EMU
   (12700 per pt) from the box's top-left: `"M x,y L x,y … Z"`; `C` curves and several `M…Z`
   subpaths are allowed, and a 300-point path is fine. Keep points no denser than the look needs:
   every vertex adds slide XML, and the heavier the deck, the slower it renders.
   Torn outline for a w×h box: depth `d = clamp(min(w,h)·0.032, 4.5, 11)` pt. Walk the four edges
   clockwise; put `round(edge/23)` points evenly on each edge, each pushed inward by a random
   0..d; between neighbours add a midpoint jittered by ±0.3·d. Use a different seed per layer.
3. `SetShapeLine {hex:"", widthPt:0}` on both.
4. Rim: `SetShapeFill "#FFFDF7"` and
   `SetShapeEffect {effect:"shadow", opts:"color=000000,alpha=28,blur=14,dist=7,angle=90,rotWithShape=0"}`.
   The direction key is `angle`; `dir` is refused.
5. Face: `SetShapePictureFill {opts:"fit=tile,sx=100,sy=100,algn=tl", imgB64:<tile>}`.
6. `SetRot` the same −1° to −3.5° on rim, face and every text on the card. Text on a rotated card is
   its own `AddText` with the same rotation, placed by rotating its card-local centre about the
   card's centre.
   A second, harder shadow is another shape with the same path, `SetShapeFill "#000000"`,
   `SetFillAlpha 22`, 1.5 pt lower, behind the card (one shape holds one outer shadow).

### 3.2 Tape, stamps, overlays

- **Tape:** a custGeom strip torn only at its two ends, `SetShapeFill "#ECE2C4"`, `SetFillAlpha 82`,
  `SetBlend multiply`, `SetRot` −4 to −6 (−38 to −40 on a corner). A transparent tape PNG through
  `AddImage` reads more like real tape.
- **Corners and adjust handles:** `SetRectRadius {pct}` is a fraction 0–0.5 of the shorter side
  (0.25, not 25); `SetAdj {name, value}` takes the ratio `dock_slides_get` lists under `adj`. A
  percentage is clamped or refused.
- **Stamp:** `roundRect`, `SetShapeFill "none"`, `SetShapeLine {hex:"#FF4A1C", widthPt:4}`, `SetText`,
  `StyleShape` colour/size 22–26/`b "1"`, `SetParaAlign center`, `SetAnchor middle`, `SetRot −9..−12`,
  `SetBlend multiply`.
- **Blend:** `SetBlend {mode}`, read back as `blend`. Multiply makes a colour band show only over
  dark glyphs and lets tape and halftone pictures sit into the paper. Refused on groups, connectors,
  tables and charts.
  **Today (#23049):** the editor and the server render composite it; Play, video export and the
  CLI/server PPTX export draw it normal. Build any effect that must survive Play from solid shapes.
- **Picture opacity:** `SetPicAlpha {opacity:55..85}` on a picture (halftone dots, a coffee ring).
- **Picture corrections:** `SetImageAdjust {spec:"bright=20,contrast=30"}` through `dock_slides_apply`
  (resumable). Send the spec alone and leave out `imgB64` and `origB64`: the room bakes the picture
  from its original, as the editor does. `spec:""` resets the picture.

### 3.3 Glow and text shadow

- Text glow: `SetTextEffect {effect:"glow", opts:"rad=10,color=FF9A00,alpha=38"}` on large type,
  `rad=6,…,alpha=32` on medium. Shape glow: `SetShapeEffect {effect:"glow", opts:"rad=7,color=FF9A00,alpha=45"}`.
- Hard text shadow (cut-paper type): `SetTextEffect {effect:"shadow", opts:"blur=0,dist=4,angle=45,color=000000,alpha=100"}`;
  `opts:""` removes it.
- `SetShapeEffect` with `shadow` or `glow` and no `opts` replaces the whole effect list; with `opts`
  it changes that one effect. The inner shadow is `innerShdw`.

### 3.4 Type

- **Lock the faces in the theme** with `SetMasterThemeFonts {masterRef:"0", fonts:<JSON string>}`:
  `{"name":"Retro","major":{"typeface":"IBM Plex Mono"},"minor":{"typeface":"IBM Plex Mono"},"majorEa":{"typeface":"Noto Sans TC","scripts":[{"script":"Hant","typeface":"Noto Sans TC"}]},"minorEa":{"typeface":"Noto Sans TC","scripts":[{"script":"Hant","typeface":"Noto Sans TC"}]}}`.
  The CJK slots are `majorEa` / `minorEa`. Text you never `SetFont` keeps following the theme.
- **Faces measured in the server render:** IBM Plex Mono, Courier New, Noto Sans TC, Chiron Hei HK H,
  also when a run names them on its own. Pixel and VT faces (VT323, Press Start 2P,
  DotGothic16) fall back to sans there unless the deck embeds them (3.10). Render one test line
  before you build on any other face. **Today (#24894):** the render's font list is not published.
- **Heavy CJK:** `SetFont {which:"all", typeface:"Chiron Hei HK H"}`, no `b`. It is a 900 weight of the
  Source Han design (昭源黑體 Heavy), and the render, the editor, Play and the .pptx export (the face is
  embedded) all draw it. `Noto Sans TC Black` and `Source Han Sans TC Heavy` draw this face in Dock, but an
  export does not embed it under those names, so PowerPoint draws its own fallback for them.
- **Giant type:** 300–620 pt, `spc -5`, `wrap none`, boxes allowed to bleed off the slide. For a
  glyph top at `top`, place the box at `y = top − 0.08·size` for CJK and `top − 0.23·size` for
  numerals. A rotated word: `SetRot 90` on a box sized about 640 × 1.2·size, centred.

### 3.5 Backgrounds

`SetSlideBg {hexOrNone:"#0E1217"}` for a flat colour; `SetSlideBgFill` for the rest:
`kind:"grad"` (above), `kind:"pic", opts:"fit=stretch"` for a full-slide picture (1920×1080
scanlines, an illustration), `kind:"pic", opts:"fit=tile,sx=60,sy=60"` for a paper texture.
`imgB64` is `""` for every kind but `pic`. The background cannot be animated; animate the objects
on it. Read it back as the slide's `background.kind`, not as an item.

### 3.6 Morph

1. On the destination slide: `SetSlideTransition {type:"morph"}`, then `SetTransitionDuration {durMs:700..1000}`,
   then `SetMorphOption {option:"byObject"}`, in that order.
2. `SetShapeName {name:"!!card"}` on one object on each slide, same type (shape↔shape, picture↔picture),
   unique per slide, exact case. A group's name never pairs; name its children.
3. Check with `dock_slides_verify {checks:[{kind:"morph", slides:[1,2], name:"!!card"}]}`: it holds
   only if they pair AND slide B plays Morph.
4. Morph a line or band only between slides where it keeps its orientation. Morph interpolates
   width and height together, so a rule that turns from horizontal to vertical passes through a
   fat block halfway. Play also pairs same-kind rectangles by itself, so renaming the `!!` names
   leaves the pairing in place: give the destination slide a fade instead.

### 3.7 Transitions

`SetSlideTransition {type}` first, then `SetTransitionDuration {durMs}` and
`SetTransitionOption {kind, option}`.
The option names where content MOVES: push `"l"` is From Right. Native kinds played as built in
the 2026-10 style decks: fade (`smooth`, `thruBlk`), cut, push, split `horzOut`, morph, peelOff,
randomBar, shred, flash, checker, blinds, dissolve, wipe. pageCurlSingle plays like push and
pageCurlDouble draws thin bands; use neither.

**Dock Originals** are thirteen transitions of Dock's own, the "Dock Originals" group of the
Transitions gallery, most of them moving the slide's objects one by one instead of the page. They
are high-end and loud, so they are signature moves (section 0), never the everyday grammar: at
most one per act, on an act break, a reveal or the close, and never on two slides in a row. Each
plays in Play, and the HTML and video exports play them as well (the video export turns `cascade`
and `flow` into a crossfade of the two papers). A .pptx carries a fallback that PowerPoint plays
instead (last column), so choose one when the deck is presented in Dock or exported to HTML or
video; when the deck is handed off as a .pptx, choose a native kind. The knobs are the kind, its
option, `SetTransitionDuration`, and for `cascade` and `colorWipe` one number each, written with
`SetTransitionParam {slide, kind, param, value}` (below the table). The length shapes the feel most
(`chop` reads as a blade at 900 ms and a flicker at 500, `dolly` at 2400 ms is a slow push). Each row
was recorded in Play on staging (2026-10-21):

| Kind          | What moves                                                                                                   | Suits                                                      | Option (`SetTransitionOption`)                        | Length          | PowerPoint plays |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------- | --------------- | ---------------- |
| `cascade`     | objects fade out one at a time in shape-tree order, then the new ones fade in in theirs                      | a quiet, ordered change; text slides                       | — (`stagger`, below)                                  | 80 ms an object | fade             |
| `flow`        | objects slide off along the direction and the new ones slide in behind them, staggered; the paper stays      | slides with the same structure; a sequence                 | `l` `u` `r` `d`                                       | ~1.1 s          | fade             |
| `colorWipe`   | bands in the two slides' paper colours and two tints sweep across, then the new slide wipes in               | a change of section between slides of different paper      | `l` `u` `r` `d`, corners `lu` `ru` `ld` `rd`; `bands` | ~0.8 s          | wipe             |
| `chop`        | the new slide swings in about a corner like a blade                                                          | a hard, fast break                                         | `cw`/`ccw` then the corner, e.g. `cw-tl`              | 500 ms          | wheel, one spoke |
| `table`       | the page lies back like a tabletop; objects slide off along it and the new ones slide on                     | a table or a list that is replaced                         | `l` `r`                                               | 1500 ms         | fade             |
| `domino`      | the page leans in; objects tip over flat in a wave and the new ones stand up                                 | a row of cards or columns                                  | `lr` `rl`                                             | 1800 ms         | fade             |
| `pairFlip`    | each object Morph would pair flips edge-on into its partner's place; the rest shrink and fade                | two slides that share objects                              | `y` `x`                                               | 1600 ms         | fade             |
| `ring`        | the page curls onto a turning cylinder and the new page unrolls from its back                                | a turn to the other side of an argument                    | `l` `r`                                               | 1800 ms         | fade             |
| `teardown`    | the page tilts back and peels into layers that fly off top first; the new layers stack up from the bottom    | showing what a slide is built from                         | `tight` `normal` `wide`                               | 1600 ms         | fade             |
| `orbitLayers` | the layers stand apart and the camera walks half round them to the new page at the back                      | a reveal, a before/after                                   | `tight` `normal` `wide`                               | 2000 ms         | fade             |
| `dolly`       | the camera pushes through the layers, which sweep past; the new page walks in from the depth                 | going deeper into a topic                                  | —                                                     | 1600 ms         | fade             |
| `rack`        | the focus pulls from the front layer to the back as each fades; the new layers come into focus back to front | a shift of attention                                       | —                                                     | 1600 ms         | fade             |
| `morphChart`  | a chart's bars and values tween from slide A's numbers to slide B's                                          | the same chart with new data                               | —                                                     | ~1.5 s          | morph            |
| `magicMove`   | Keynote's Magic Move: paired objects travel to their new place on one curve; the rest fade (or not)          | a Keynote deck, or a slide that rearranges its own objects | `<curve>-fade` `<curve>-nofade`, e.g. `easeIn-fade`   | 2000 ms         | morph            |

The two numbers, recorded in Play on staging (2026-10-21) on a slide of 13 objects:

- `cascade` `stagger` (1..5000 ms, default 80) is the wait between one object and the next. The run
  is `(objects leaving + objects arriving + 1) × stagger`: at 40 the whole change was a quick ripple
  of ~1.0 s, at 200 a slow roll call of ~6.2 s in which each object is read. Set
  `SetTransitionDuration` to at least that run, because a shorter duration shrinks every slot evenly
  to fit and the stagger stops mattering.
- `colorWipe` `bands` (1..4, default 4) is how many bands sweep across; the length stays ~0.8 s
  whatever the count. 1 is one clean sheet of the new paper, like a door; 2 is a two-tone stripe;
  3 and 4 lead with the new paper and trail pale tints of the old, the most layered. Fewer bands
  read quieter.

Both are refused on a slide carrying another kind, so set the kind first; re-applying the same kind
and `SetTransitionOption` keep the number.

What the content needs for each one to read as itself:

- `colorWipe` draws its bands in the two slides' paper colours. Between two slides of the same paper
  it is a flash of that colour; give the two slides different backgrounds (3.5).
- `pairFlip` pairs objects by Morph's rules (3.6): a `!!` name, then matching content. It is at its
  best on the same objects in a new order (four cards reversed flip into each other's places);
  slides with nothing in common get a soft crossfade.
- `teardown`, `orbitLayers`, `dolly` and `rack` are tuned for a stack of objects. On a slide of four
  or five, teardown's middle is ~0.5 s of bare paper on black, at `tight` 900 ms as well; keep these
  for slides with many objects.
- `morphChart` tweens a chart that keeps its size and place on both slides and only changes data.
- `magicMove` pairs objects by Keynote's rules and plays them on one curve (`easeInOut`, `easeIn`, `easeOut`,
  `linear`); with `-nofade` the unpaired objects vanish on the first frame and appear on the last instead of
  fading. Download as Keynote keeps both.
- `table`, `domino`, `teardown` and `orbitLayers` turn the page in 3D, so black shows around it
  while they run.

What a signature moment can carry, from the kinetic Palantir deck replayed with Originals at its
act breaks (staging, 2026-10-21):

- `flow` `l` opening an act lifted it: the giant words of the new act ride in from the right, in
  the deck's own direction for progress.
- `rack` opening the next act, after a slide pushed into one giant letter, moved the focus from that
  letter back to the raw sources behind it: quiet and right. `dolly` in the same place repeated the
  push the slide before had just made, and was too much.
- `orbitLayers` on the closing slide, whose own build is the signature, turned the page for two
  seconds and held that build back by ~0.8 s; the two competed. A slide whose build is its moment
  enters by fade, and the Original goes on a slide with no build.

### 3.8 Entrances and builds

- `AddAnimation {slide, shape, preset, trigger, durMs?, delayMs?}` appends to the slide's sequence;
  `shape` is the numeric id. The default build is the motion score's (section 0): `floatIn`,
  `durMs:500`, then smoothEnd (below), which reads back as `decel: 60000`.
- `trigger:"onClick"` puts the effect on the presenter's click: use it for every build the motion
  score cues to a line. A slide's first effect with `afterPrev` or `withPrev` starts with the slide,
  no click; keep that for a signature moment. Build a row of separate objects as one leader plus
  `withPrev` members, staggered 60–100 ms with `delayMs`.
- A card made of several shapes (rim, face, text) enters as ONE effect: group it first with
  `dock_slides_arrange {slide, actions:[{do:"group", shapes:[2,3,4]}]}`, read the group's `{#n}` from
  `dock_slides_get`, then one `AddAnimation` on that id. Not one effect per shape. `GroupShapes` and
  `MoveShape` are not `dock_slides_apply` verbs: `dock_slides_arrange` groups, ungroups
  (`{do:"ungroup", group}`), restacks (`{do:"order", shape, where:"front"|"back"|"forward"|"backward"}`)
  and moves a group whole (`{do:"move", shape, x, y}`). A group must
  be its call's last action and an ungroup its only one.
- `durMs` is the whole effect's length on every preset but `appear`, `disappear`, `randomEffects`
  and `randomEffectsOut`, which play in 1 ms. For those: add without `durMs`, read the `ref` from
  `dock_slides_get {animations:true}`, then `SetAnimationDuration {slide, effect:"an26", durMs}`.
  On a preset with several behaviours (`pulse`, `teeter`, `bounce`), the read-back `durMs` is the
  main behaviour's, shorter than the effect.
- Set a wipe's direction: `SetAnimationDirection {effect, direction}` with 8 = from left,
  2 = from right, 1 = from top, 4 = from bottom; read back the filter (`wipe(left)`). A new wipe
  reads subtype 4 (from bottom) whatever its shape, so on a line wider than tall add
  `SetAnimationDirection 8` (a tall one: 1) or lint warns `anim-direction-mismatch`. Effects play in
  the order you add them: add a timeline's axis before its points, or fix it with `MoveAnimation
{effect:"an<axis>", to:"an<first point>:before"}` (lint: `anim-order-axis-after-points`).
  `growAndTurn` ends a tilted object at its own angle.
- Easing: `SetAnimationOption {option:"smoothEnd", value:"60000"}` on floatIn moves a multi-shape
  card as one. Set direction, then duration, then smoothEnd.
- An Effect Options verb that answers `animation_unreadable` wrote nothing. Send that op again on
  its own a few seconds later, with no other write to the deck in between; a resumable re-send under
  the same key counts, a fresh key re-commits the earlier ops and starts the wait over.
- A typewriter: `fade` with `SetAnimationOption {option:"animateText", value:"letter:10000"}` plays
  letter by letter, or `wipe` from left at 250–450 ms. **Today (#24908):** `appear` By Letter draws
  the whole line at once.
- `SetAnimationTrigger` regroups the click sequence (a leader turned `withPrev` makes the next
  effect a click). Change one effect per call and re-read the refs.
- Redo a slide's motion: `ClearAnimations {slide}`, then add again.

### 3.9 Charts and diagrams

- A chart: `dock_slides_upsert_chart` (`dock-slides/charts`), then `EditChart {patch:"{\"legend\":\"none\",\"chartTitle\":\"\",\"gridlines\":false,\"valAxis\":false,\"catAxis\":false,\"dataLabels\":\"none\"}"}`
  and `SetChartPointColor` for the one highlighted bar. Chart text on a dark slide: the same patch's
  `elementFont`, e.g. `"catAxis/color=FFFFFF|valAxis/color=FFFFFF|legend/color=FFFFFF"` (also
  `size`, `bold`, `family`; the element must be shown).
- Chart build: a `wipe` on the chart, `SetAnimationDirection 4`, then
  `SetAnimationChartBuild {build:"category", animBg:0}`. It needs the chart alone in its click group.
- Many small blocks (pixel art, LED bars, progress cells, a dotted rule) are ONE custGeom with many
  `M…Z` subpaths. A smooth curve is custGeom with `C` segments, `SetShapeFill "none"` and a
  `SetShapeLine`. Arrows: `AddLine {head:"none", tail:"triangle"}`, `SetLineDash "dash"`.

### 3.10 When native cannot draw it

- **A face the render lacks:** `EmbedFont` (named `font`: the plain base64 of a subset file you are
  licensed to embed, with every glyph the deck uses, and `subsetted: true`), then set the runs to the
  family name registered at embed time. Send it in a `resumable` call: an `atomic` one refuses
  EmbedFont. The server render, thumbnails and lint draw the embedded face. A glyph missing from the
  subset falls back silently.
- **A picture inside the glyphs:** `SetTextRangePictureFill` (`fit=stretch`) on short, large text.
- **Live motion or shaders:** an HTML block that stays live (section 3.11).
- **Draft in HTML, then convert:** a slide can be faster to write as one HTML block and convert to
  native objects. Needs a shell on a machine with Chrome, Chromium or Edge (`DOCK_CHROME` names one).
  Insert the block from a file with
  `dock slides html-block insert <deck-id> --slide <sl> --box 0,0,960,540 --html slide.html`: it renders
  the block in that browser, so `dock_slides_render` shows it instead of the placeholder, and gives a
  `<figure data-dock-chart>` holding only its JSON the script that draws it. To change the block, edit
  the file and send it with `dock slides html-block set-source <deck-id> --slide <sl> --shape <id> --html slide.html`,
  which renders it again. When it is final:
  `dock slides html-block convert <deck-id> --slide <sl> --shape <id> --json`. It measures the block
  there and replaces it, in place, with text boxes, shapes and pictures that look the same (torn
  edges become pictures, not custGeom); a chart component (`<figure data-dock-chart>`, what a native
  chart becomes in an HTML block) comes back as a native chart with its data. Before the write it
  prints one `note:` line per thing the native objects give up: content the block clips, links that
  are not web or mail, embedded fonts, weights other than 400 and 700, charts left as pictures.
  `--json` carries them under `plan.notes`, with the counts under `plan.counts`. The answer's `shape`
  is the new group; check it with `dock_slides_lint` and `dock_slides_verify`. It refuses a grouped,
  hidden or mirrored block. The editor's undo does not bring it back;
  「Revert this run」 takes it back, but only until the deck is checkpointed past the convert, so
  convert only what is final, and keep the source if you may want it back. Without a shell, leave
  the block and say so in the handover.

### 3.11 Live HTML blocks

An HTML block runs a web page live in the editor, Play and the reading view. The server render,
thumbnails, the filmstrip, print, image and PDF exports, the .pptx and .key exports and PowerPoint
show its Fallback picture instead. Use one for live 3-D, a simulation, data that moves or a shader;
anything a person must edit, or read in PowerPoint, stays native. The frame takes no pointer or
keyboard input, so the page runs on its own clock.

**What goes in.** A directory holding `index.html`, inserted with
`dock slides html-block insert <deck-id> --slide <sl> --box 0,0,960,540 --html <dir> --render fallback.png`.
The insert bundles into the deck every file the page loads: a relative path inside the directory,
and a `cdn.jsdelivr.net` or `unpkg.com` URL pinned to an exact version (`three@0.160.0`), import-map
entries and the modules they import included. It refuses any other host, an unpinned version, a bare
specifier the import map does not name, a file outside the directory, a file over 10 MiB, and more
than 50 MiB of files in all, each refusal naming the reference and the fix. The page itself stays
under 256 KiB, so data goes in a file beside it. The frame has no network when it plays. On the
local (stdio) MCP server, `dock_slides_edit_html_block` with `html_path` and `html: "-"` bundles the
same way and draws the Fallback in this machine's Chrome. Over remote MCP, send each file as
`AddHtmlBlockAsset` before the block that names it (`dock_slides_verb_describe` gives its form); the
block keeps a 64×64 placeholder until `SetHtmlBlockSource` writes a `png` (pass that call a fresh
top-level `asOfSeq` or it is refused `stale_ordinal`). `set-source --html <dir>` replaces a block's
page the same way.

**The Fallback.** Photograph the page yourself and pass it as `--render`: the CLI's own browser
gives up on heavy animated WebGL and leaves the grey placeholder (#27038). Shoot the frame
the live page starts on, at the block's size in CSS px (4/3 px per point: 1280×720 for a full slide)
and device scale 2, as a PNG under 3 MiB. A `#still` hash the page reads to hold its clock at 0 makes
that frame the same every time (the example below).

**The hand-off from Fallback to live.** The editor, Play and the reading view keep the Fallback on
screen until the page says it has drawn, then show the live page in its place in one frame. Once the
first real frame is on screen (the first `render` of the scene, a model or data file loaded and
drawn), post:

```js
parent.postMessage({ type: 'dock:html-block-ready' }, '*');
```

A page that never posts it is shown two animation frames after its `load` event, which is too early
for a page that loads or decodes anything after `load`; every page is shown after 10 s, posted or
not. Keep the page opaque: no fade-in. So the swap from the Fallback does not show:

- render the Fallback at t = 0, start every animation clock when you post, and seed every random
  number, so the live page opens on the Fallback's picture;
- size points and strokes from the frame height (`innerHeight`), so they hold at every zoom and in
  Play.

**Cost.** **Today (#27102)** each bundled text file (scripts, JSON) stalls the editor 150–200 ms on
entering the slide. Bundle what the slide uses: `three.module.js` and the addons it imports, not a
whole package.

**Placement.** The editor, Play and the reading view run a block that is not flipped and whose box
no object drawn above it overlaps; a covered block shows only its Fallback. So give the block a box
of its own, clear of native objects, or `MoveHtmlBlock` it `front` with a transparent page and an
alpha PNG Fallback that holds only the static part (the Fallback sits under the live frame, so
anything moving painted into it shows twice). On top, it covers native text in PowerPoint and
exports as a picture. Name the live slides in the handover, and say they are pictures everywhere
else.

**Worked example**, one full-slide three.js block (`orbit/index.html`):

<!-- prettier-ignore -->
```html
<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;height:100vh;overflow:hidden;background:#05060c}
canvas{position:absolute;inset:0;width:100%;height:100%}
h1{position:absolute;left:6%;bottom:10%;margin:0;color:#fff;font:800 4.6vw/1.1 sans-serif}
</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"}}</script>
</head><body><h1>兩萬顆星，一張投影片</h1><script type="module">
import * as THREE from 'three';
let s = 7; // seeded: the Fallback and the live page draw the same stars
const rnd = () => ((s = Math.imul(s ^ (s >>> 15), s | 1) + 0x6d2b79f5) >>> 0) / 2 ** 32;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(innerWidth, innerHeight, false);
document.body.prepend(r.domElement);
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 50);
cam.position.set(0, 2, 7); cam.lookAt(0, 0, 0);
const pos = new Float32Array(20000 * 3);
for (let i = 0; i < pos.length; i += 3) {
  const a = rnd() * Math.PI * 2, d = 1 + 3 * Math.sqrt(rnd());
  pos.set([Math.cos(a) * d, (rnd() - 0.5) * 0.3, Math.sin(a) * d], i);
}
const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
// Point size follows the frame height, so the stars look the same at every zoom and on the projector.
const m = new THREE.PointsMaterial({ color: 0x9db4ff, size: (1.5 * r.getPixelRatio() * innerHeight) / 720, sizeAttenuation: false });
const stars = new THREE.Points(g, m); scene.add(stars);
addEventListener('resize', () => { r.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); m.size = (1.5 * r.getPixelRatio() * innerHeight) / 720; });
const still = location.hash === '#still'; // the Fallback: the clock stays at t = 0
let t0 = null, told = false;
r.setAnimationLoop(ms => {
  stars.rotation.y = t0 === null ? 0 : (ms - t0) / 8000;
  r.render(scene, cam);
  // First frame drawn: start the clock and tell Dock to swap the Fallback for the live page.
  if (!still && !told) { told = true; requestAnimationFrame(now => { t0 = now; parent.postMessage({ type: 'dock:html-block-ready' }, '*'); }); }
});
</script></body></html>
```

```sh
chrome --headless=new --hide-scrollbars --window-size=1280,720 --force-device-scale-factor=2 \
  --virtual-time-budget=8000 --screenshot=fallback.png "file://$(realpath orbit)/index.html#still"
dock slides html-block insert <deck-id> --slide sl1 --box 0,0,960,540 --html orbit --render fallback.png
```

Headless Chrome on a machine without a GPU draws WebGL with
`--use-angle=swiftshader --enable-unsafe-swiftshader`. The insert prints each bundled file
(`three.module.js`, 1243 KiB here) and that the Fallback carries your render; check the Fallback
with `dock_slides_render`.

## 4. Style packs

When the user names a style, pick its pack, write it into the art direction (`dock-slides/plan`),
and keep every slide to it. A pack's motion line fills in the motion score (section 0): its transition and entrance verb are the
grammar, and its signature move is the exception that grammar allows. The budget still picks
which slides build: an entrance a pack names plays on those slides only. In a presented deck body
text stays at 16 pt or more and labels at 12 pt or more on every card and footer: when text does not
fit, make the card larger or say less, keeping the size.

**Collage / torn paper.** Paper `#F3EFE6`, shade `#E7E1D4`, ink `#111111`, blue `#0360F0`, hot
`#FF4A1C`, body `#2A2A2A`, kraft `#CBAB7E`, rim `#FFFDF7`. Chiron Hei HK H for heads (cover 112,
heads 38–60), Noto Sans TC body 16–20 (line spacing 1.15–1.3), IBM Plex Mono 12 bold, spc 2, for
kickers (`01 / SECTION` top-left) and folios (`01 / 09`). Torn cards tilted ±1–3.5°, torn blue strips
with white type at −2.5°, tape, stamps, halftone and coffee-ring pictures on multiply. Motion: paper
placed on a desk. Transition fade; cards floatIn 500–700 ms with smoothEnd; tape wipes from left
300 ms; the signature move is Morph cover → agenda on `!!` names.

**Kinetic typography.** Three colours: ink `#0D0D0D`, paper `#F1EEE6`, lime `#C8FF1A`; greys
`#8C8A84` / `#3A3A38` for 12 pt chrome. Chiron Hei HK H for everything large. Giant words
300–620 pt bleeding off the edge, numerals 150–180, quote 48, titles 28–30, a 12-column grid with
48 pt margins, 1.5 pt rules. Motion: the lime rule is the motif, carried by Morph 900 ms on a `!!` name across
every slide where it keeps its orientation, fade 900 where it turns; presented in Dock, an act
opens by `flow` `l` and the next by `rack` (3.7). Words floatIn 500 ms with
smoothEnd, on click; the rule draws with a wipe from left. Three signature moments: a hard cut to a
one-word slide whose line floats in on click, a 1200 ms Morph that pushes into one giant letter, and
the rule drawing itself across the closing diagram. Colour inside glyphs via a multiply band is editor/render only (3.2); in a presented deck
make the band solid and let layout do the masking.

**Retro CRT (amber phosphor).** One hue in four values: `#FFB000`, hot `#FFD36B`, dim `#B07A12`, faint
`#5C3F0A` on ink `#140C02`; glow colour `FF9A00`. Theme fonts IBM Plex Mono + Noto Sans TC (3.4).
Cover 76 bold, focal number 200, head 34, prompt 15, chrome 12. Scanlines, vignette and noise live
in a full-slide background picture (path A or B), with glow on every large text and solid shape.
`> command` prompt lines, a `C:\ISLAND\2027>` status bar, inverse-video selection bars, a trailing
`▌` written as a character. Motion: transition fade `thruBlk` 300–400; chrome splitIn 450 ms;
the signature move is a prompt line typed by a wipe from left. Use `>` for bullets.

**Board explainer.** Background `#0E1217`, panel `#161C24`, hairline `#2B3440`, data `#3A4452`, text
`#E8ECF1`, muted `#8C96A5`, dim `#76808F` (the darkest grey that passes contrast), and ONE amber
`#F5A524` for the single focal item per slide. Noto Sans TC (captions bold), IBM Plex Mono for
numbers: head 30 bold, focal number 72, caption 16 bold centred near the bottom, chrome 12–13. A
step chip, a nine-segment progress bar (current amber, past dim, future hairline), arrows, a glowing
amber dot, native diagrams. Motion: fade 600 for transitions and entrances; the diagram builds a
step per click, one step per line; the signature move is the click that reveals the amber item,
then `pulse`. Presented in Dock, the one chart whose numbers change between two slides can be a
signature moment by `morphChart`.

**Pixel.** A 320×180 logical grid, so 1 px = 3 pt: snap every coordinate. Palette `#1A1C2C`,
`#29366F`, `#3B5DC9`, `#41A6F6`, `#73EFF7`, `#F4F4F4`, `#94B0C2`, `#566C86`, `#333C57`, `#38B764`,
`#A7F070`, `#FFCD75`, `#EF7D57`, `#B13E53`. IBM Plex Mono (latin) + Noto Sans TC (`eafont`): title 34
bold, label 13 spc 2, HUD 12. Stepped-corner dialog boxes as three custGeom layers (hard shadow +6 pt,
border, fill), HP bars, a dotted HUD rule as one custGeom, `▶` / `▼` cursors; illustrations as
nearest-neighbour upscaled PNGs (path A or B). Motion: transition checker 600–700; dialog boxes enter by checkerboard
400–500; the signature move is a dialog whose lines `appear` with 100–250 ms delays.

**Your own art direction.** With no named style, write one from the brand and the argument to the
same detail as a pack above. Where nothing better comes to mind, start from this kit; a better idea
replaces any line of it once the plan says why.

- Background: a gradient (3.5) on most slides, `type=radial` on an inversion slide.
- Cards and bands: `DrawShape` with a two-stop gradient and the soft shadow of 3.1.
- An overlay on a picture or colour field: alpha 70–85.
- Display type and big numbers: a text gradient (`SetTextRangeFill`) or the hard shadow of 3.3.
- Pictures from `dock_image_generate`, each placed by one `DrawImage` (crop, an ellipse or
  rounded frame, shadow) and tied to the palette with `SetImageEffect` (duotone or tint).
- A table inside the deck's material (a dark ground or a card with depth), header cells filled from
  the palette (`SetCellFill`), the total row set apart by fill and weight, cell text at the deck's
  body size (16 pt or more when presented). A built-in table style on its own reads as a default.
- Motion: fade 500 ms between slides, a Dock Original (3.7) on an act break when the deck is
  presented in Dock (push when it leaves as a .pptx), the motif on Morph 900 ms, numbers
  floatIn with smoothEnd, steps wiped from left, a chart built by category (3.6–3.9).

Keep to effects every surface draws (section 5). Blend, HTML blocks, pageCurl and 3-D bevel fall
outside that set, and glow leaves lint an `overflow` it cannot accept (section 6).

## 5. What shows where

| Effect                                              | Editor | Server render | Play                | PPTX export  |
| --------------------------------------------------- | ------ | ------------- | ------------------- | ------------ |
| custGeom, picture/tile fill, shadow, glow, rotation | ✔      | ✔             | ✔                   | ✔            |
| Theme fonts; the faces in 3.4                       | ✔      | ✔             | ✔                   | ✔            |
| Chiron Hei HK H (heavy CJK)                         | 900    | 900           | 900                 | embedded     |
| Blend                                               | ✔      | ✔             | normal (#23049)     | normal       |
| Morph `!!`                                          | —      | —             | ✔                   | `p159:morph` |
| Dock Original transitions (3.7)                     | —      | —             | ✔                   | fallback     |
| Slide 1 transition                                  | —      | —             | ✔                   | written      |
| Appear By Letter                                    | —      | —             | whole line (#24908) | written      |
| `▸` / `★` glyphs                                    | ✔      | ✔             | missing             | —            |
| HTML block (3.11)                                   | live   | Fallback      | live                | Fallback     |

## 6. Verify

1. After each write batch, read back: `dock_slides_get {geometry:true}` for ids, `rot`, `fillFmt`,
   `effect`, `blend`, `morphName`; then `dock_slides_get {animations:true}` in a SEPARATE call and
   compare each effect's preset, trigger, `durMs`, `delayMs`, `presetSubtype` and `options`
   (smoothEnd, By Letter). Asking for both in one call is refused, and `slides` narrows only a
   `geometry` or `animations` read. Text styles read back in `runProps`, a text glow as its `glow`
   and a highlight as `hl`; an outline's weight is `line.widthPt`, to 0.1 pt (`0.75` reads `0.8`). **Today
   (#24978):** strike-through set with `StyleShape attr "strike"` does not appear there, so check it
   in the render.
2. `dock_slides_render` the slides you built, up to 8 in one call, and look at each against
   dock-slides's rubric plus one question: does it look like the style asked for?
3. Lint, as `dock-slides/check` runs it (each write's own answer, then one whole-deck lint before
   handover): fix every finding about text you wrote (overflow of a text box, wrap-risk,
   tiny-text, contrast) and every object that leaves the slide by mistake. The errors this style
   makes on purpose are accepted by the objects they name, once you have looked at them in the
   render: a giant word that bleeds off the edge reports `off-slide` and takes
   `accept: ["sl1:off-slide:4"]`; intended layering (shadow under card, tape on card, band on
   glyph) reports `ink-overlap` and takes `"sl3:ink-overlap:4+7"`, every `{#n}` the finding lists.
   Such a key absorbs only a finding with exactly those objects, so a second word that slipped off
   the same slide still stands. A styled deck is done with lint when the whole-deck lint, given
   those keys, is `clean`, except for glow that reports `overflow`, which cannot be accepted: list
   each such slide in the handover.
4. `dock_slides_verify` for slide count, titles and Morph pairs.
5. `dock_slides_export {format:"pptx"}` and check each slide part for `<p:transition>`, `<p:timing>`,
   `p159:morph` and the `!!` names.
6. Motion is accepted from the filmstrip: `dock_slides_render {slides:[…], motion:{}}` answers one
   sheet per slide, its transition and builds as frames, each cell labelled with its time from the
   slide's entry, its click and the effects running, and the answer states the slide's transition
   (kind, Morph option, direction, duration) and build list. Check each slide against the motion
   score: the transition's direction and option, every build on the click the score gives it, no
   object visible before its own entrance, a wipe opening from the side it should, a By Letter build
   arriving letter by letter, no fat block mid-Morph (3.6). Small text a Morph moves word by word
   reads better zoomed: `motion:{region:[x,y,w,h]}` in slide fractions. An event the sheet had no
   room for is listed under `omitted` with the `from_ms`/`to_ms` that samples it; ask for it.
   The sheet is the video export's rendering under the stated timing, so it does not cover what the
   export does not play: name in the handover every slide with a `fidelity` line or a
   `drawnWithout` cell, and those are the slides a person watches in Play.
   Where motion mode answers `motion_unavailable`, motion is accepted by readback: step 1's
   `animations` read matches the motion score item by item, step 4 holds for every Morph pair, and
   the handover names the slides a person should watch in Play. With a shell and Chrome, record
   Play instead: open the deck's Play view in headless Chrome launched with
   `--window-size=1280,720`, record through CDP `Page.startScreencast` (about 35–40 fps), advance
   through every click with a 1–2 s dwell, and allow 0.3–0.5 s from key to first motion; Play goes
   fullscreen and resets the viewport, so Playwright's `recordVideo` captures only the top-left
   800×600. Play runs HTML blocks live, while the filmstrip shows their Fallback (section 5).
