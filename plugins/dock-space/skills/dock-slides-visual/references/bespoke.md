# A bespoke Polished deck

Load when Dock's instructions name `dock-slides-visual/bespoke` for a 精緻 / Polished deck. It replaces
the art direction of `dock-slides/plan` and the kit at the end of `dock-slides-visual` section 4 for
this deck; the rest of `dock-slides` (numbers, writing, rubric, traps) still holds. No template: the
deck is designed from its subject. Test every slide against three questions: cover the text, is the subject still recognisable?
Is every title a conclusion? Swap the subject, how many slides must be redrawn? (The more, the better.)

## The plan turn: write the brief

Write the brief into the plan block, in the fields Dock's plan format names. It is short so the card
can hold it: every text one sentence, at most 300 characters.

**Deck (`art`).**

- `world`: the subject's own story and material, in one sentence ("a 1,800 m cloud forest: fog, moss,
  wet stone, cypress"; "a camera body and its viewfinder"; "a monolith sawn along its seams"). Take
  it from the subject, never from a genre.
- `signature`: 1–2 elements that carry information on every slide that has them: a specimen label that
  records each slide's sample or condition; an LCD readout that gives each slide's own settings; a
  seam that marks what gets cut. Decoration that only looks like the trade (a ruler, a colour bar)
  is not one.
- `accents`: 2–3 colours used only on objects and data; text stays ink or muted. `palette` holds ink
  and paper, `backgrounds` the grounds, held to 4.5:1 as the format says.
- `faces`: display and body from the faces the server render draws: Noto Sans TC, Noto Serif TC,
  Chiron Hei HK H, IBM Plex Mono, Courier New. Cormorant Garamond, EB Garamond, DM Serif Display,
  Playfair Display, Inter, Space Grotesk and IBM Plex Sans fall back to a substitute.
- `motherImage`: `shows` (the subject, geometric and simple), `material` (colour, finish, edges),
  `parts` (the parts list every later picture must match), `light` (one hard window light, its
  side), `background` (stone, plaster, wood). No text, logo or real brand in it.

**Each slide.** First its data's `shape`, then the `diagram` that draws that shape:

- `proves`: the one claim the slide makes; the title says it as a conclusion.
- `shape`: comparison, composition, trend, distribution, relationship, process, geography,
  hierarchy, timeline, before-after or quote. A cover or close leaves it out.
- `diagram`: a catalogue number and name from the list below (`#76 stacked arrow`), its variant
  in a few words, or `chart <kind>` for a native chart (bar, line, area, doughnut, scatter, radar).
  A comparison, trend or composition with sourced numbers is a native chart.
- `picture`: `none`, `generated` (derived from the mother image) or `searched` (a real, named thing).
- `motion`: what it re-enacts ("bars grow from the axis", "the layers appear in the order the
  serum sinks in"), or `none`. A slide whose motion you cannot say that way has none.

**Variety.** At least min(6, slides − 2) distinct diagrams; concentric circles, a 2×2, three big
numbers and a plain timeline once each at most; motion on 60% of the slides at most (and builds within
the Build's own limit). At least 5 slides that make no sense for another subject. One set of photos as
evidence: the same subject, one variable changed, 2–3 side by side (one picture cropped into three
works).

**Diagram catalogue.** Process: #03 chevrons, #04 node line, #23 five chevrons, #33 six icons,
#38 chevrons with %, #42 ten-step rings, #72 four stages on an arrow, #87 layered arrows. Timeline:
#08 five-year line, #18 vertical stages, #21 winding path, #30 vertical line, #44 wave, #53 alternating
list, #57 icon timeline, #62 S-curve years, #63 U-turn, #69 roadmap, #74 five points, #75 S-curve,
#90 linked rings. Schedule: #09 quarter Gantt, #16 year Gantt, #41 project Gantt, #61 Gantt with
cards, #70 ring Gantt, #71 swimlane. Dashboard: #10, #17, #40 three small charts, #45, #50 bars with a
line, #59, #65, #79, #81, #86 paired bars. Share: #25 four-part dial, #49 gauge, #64 concentric target,
#67 doughnut. Hierarchy and funnel: #01 funnel, #06 descending bars, #12 and #29 pyramids, #52
descending bars with values, #54 inverted pyramid, #58 five-layer pyramid, #76 stacked arrow.
Contrast: #02 hourglass, #14 halves, #15 problem → solution, #26 challenge vs answer, #27 two circles,
#34 symmetric, #73 two columns, #88 before → after circles. Matrix: #32 four quadrants, #37 four
cards, #39 RACI, #77 SWOT. Relation: #20 three-circle Venn, #60 bubbles, #78 fan-in, #80 two-way loop,
#83 wheel, #85 core with four corners. Cards: #07, #13, #22, #31, #46, #47, #48, #82, #84, #89. People:
#19, #35, each with a portrait. Close: #68. Draw them in the deck's colours with native shapes.

## The Build, in this order

**Mother image, then the cover alone.** Generate the mother image first with `dock_image_generate`,
the prompt written from `motherImage` part by part. Build the cover alone in one `dock_slides_script`,
render it, and judge it by the first question: with its text covered, is the subject still
recognisable? If not, redo the cover once. **Today (#30492):** `dock_image_generate` makes squares
only: crop it to its frame (`DrawImage` crop), never stretch it. If `dock_image_generate` is
unavailable or refused, take the cover picture from `dock_image_search` or draw the subject natively.

**A master and named layouts of the deck's own.** In one `dock_slides_script` before the slides:
`SetThemeColorScheme` with the brief's colours, `SetMasterThemeFonts` with its faces (the CJK slots
too), the master's background and text styles with no bullet on body text, and the master chrome: a
kicker, the page number (`SetHeaderFooter` and `SetSlideNumberTotal` for `n / N`) and a mark. Then
4–8 layouts by `InsertLayout`, each named for its job and carrying the signature element, their
slots made with `InsertPlaceholderOfKind`. Slides then go on those layouts (`AddSlideWithLayout`,
pictures and charts bound with `SetPlaceholderIdx`); only a custom diagram is drawn on the slide
itself, natively. Ask `dock_slides_verb_describe` for each verb's arguments once.

- **Today (#14595):** a layout made in this session refuses `AddLayoutShape` and
  `InsertPlaceholderOfKind` until one `AddLayoutImage` lands on any new layout: send that first, as a
  bare op in `dock_slides_apply` with `execution: "resumable"`, as every op carrying a picture goes.
- **Today (#30489):** `AddMasterText` takes no size: draw the mark as a picture (`AddMasterImage`),
  or put it on each layout.
- **Today (#30490):** the page number cannot be zero-padded: `1 / 8`, not `01 / 08`.
- **Today (#30491):** `dock_slides_fill` cannot put a picture into an empty picture slot: `DrawImage`
  in the slot's frame, delete the slot, bind the picture with `SetPlaceholderIdx`, then send it back
  behind the title.

**Pictures.** Up to 3 more `dock_image_generate` pictures, each prompt the mother image's
description with one change, so every picture shows the same parts; one `dock_image_search` for
real, named things. Each picture's source goes in its slide's notes.

**Content fact check, before hand-over.** Recompute every derived number on the slides (percentages,
ratios, sums, growth) from the slide's own inputs, and check every concept term against its
definition. Fix or remove what does not hold: a blind review found `71%` where the inputs gave `~78%`,
and ISO added into "total light", which ISO is not.

**Weakest three.** Render every slide (at most 8 per call), name the three weakest, fix them, and
render what the fix touched again. Then one `dock_slides_lint` of the whole deck, and hand over.
