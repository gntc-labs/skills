# Build on layouts

Load when you build on layouts or a roster instead of one script: create, layouts, scenes, compose.

1. `dock_slides_create` — a title, and optionally `theme`, `template` or `size`. Without
   `parent_id` the deck lands in the caller's private section; say so when you hand it over.
   To start from a deck the user hands you as an https link to a .pptx or .key file,
   `dock_asset_upload` it with `url`, then pass the returned asset id as `from_asset` here.
   Starting from an EXISTING Dock deck? Pass `from_presentation` with its id
   instead: the new deck is an independent copy of it as it is now, and the source is never changed.
2. `dock_slides_layouts` — read each row's `guide` (`family`, `use`, `useWhen`, `avoidWhen`,
   `density`) and shortlist two to four layouts. The listing leaves out `slots`; call it again with
   `refs` set to the shortlist's `stableRef`s to read their `slots` and `capacity`. A text slot's
   `capacity` is measured from this deck: Chinese is about half the Latin count.
   Before shortlisting layouts, check whether a TEMPLATE deck already fits the genre: pass its id to
   `dock_slides_create` as `template` and read `dock_slides_scenes` for it (what each designed page is
   for, its slots and capacity). `g7-team-intro` has a team page for a roster. Scenes first, layouts
   second; a template that answers `no_scene_manifest` is read with `dock_slides_layouts` as usual.
3. **One exemplar, then the rest.** For a repeated pattern (ten members, twelve products, a page per
   region), build ONE slide first, render it, and check it against the rubric on the core page. Only
   when it passes fill the remaining slides from the same pattern, on the same layout. Pages from a TEMPLATE (designed slides, not placeholders) are filled
   with `dock_slides_fill` (`dock-slides/templates`). Otherwise write the rest with
   `dock_slides_compose_rows`, or in batches of up to 16 slides per
   `dock_slides_compose` call. This sameness is right for a roster or catalog, where the items
   are the content. Every other deck keeps its art direction and varies its composition: its first
   slide fixes the palette, type and motif, and every later slide is built to its own storyboard
   frame (`dock-slides-visual` section 0). Slide 1 is the one slide rendered alone, to fix the art
   direction; build all the others, then look at them together (`dock-slides/check`).
4. `dock_slides_compose` (a multi-slide Build: the core page's script) — write what the slides SAY, all of them in one call (up to 16; new
   slides are made on a named layout). `title`, `subtitle` and `body` go into placeholders; when a
   slide's point is a set of figures, a timeline, steps, a chart, a table or a quote, use `numbers`,
   `timeline`, `steps`, `chart`, `table` or `quote` on a layout whose `guide.family` matches,
   instead of bullets. ONE pattern repeated per row of data (a roster) is
   `dock_slides_compose_rows`. A picture goes in as `dock-slides/pictures` says.
   A blank deck is born with one slide on a layout that has no placeholders. Write the cover INTO
   it — `{slide: "sl1", layout: "Title Slide", title, subtitle}` puts it on that layout first.

Fix a failing exemplar rather than rewriting every slide: its siblings follow.

Build each slide's composition, material and motion with `dock_slides_apply`
(`dock-slides-visual` section 1): that is the build, not a retouch. Send each slide as ONE atomic batch, write its shapes as ONE `DrawStyled` op (each look
named once, each shape one row) or one `DrawShape` / `DrawImage` op each, and style what a batch
creates in the same batch through `@<index>` instead of reading geometry in between.
