# Filling template slides

Load when the deck comes from a template, or you fill designed pages.

A designed template page (from `dock_slides_create` with `template`, or `dock_slides_insert_from_asset`)
keeps its text in named shapes, not layout placeholders, so `dock_slides_compose` cannot reach
it. The path is four calls, not one per run:

1. Bring the pages in: `dock_slides_create` with `template`, or `dock_slides_insert_from_asset` (an
   uploaded .pptx, or `template` for a template's pages in a deck you already have).
2. `dock_slides_get` — each shape line is `{#id name} text` (`name` printed when the shape has its own;
   a name two shapes share prints on both and fills by `#id`). A paragraph whose runs look different — a big number and a small unit —
   prints as a JSON array of display segments: `- {#8} [["NT$ 12.40","M"],"較計畫 +1.6%"]`. With a
   scene manifest, also read `dock_slides_scenes` twice: once with no `scenes` (what each scene is
   for, its `needs` and slot names), then with `scenes` set to the ones you keep, for their slots.
3. `dock_slides_fill` with `asOfSeq` from that read and every slide in one call:
   `slides: [{slide, slots: {headline: "…", "#8": [["NT$ 13.10","M"],"較計畫 +2.0%"], hero: {image: "https://…"}, scorecard: {table: [[…],…]}}, delete: ["#15"]}]`.
   `null` keeps a segment (a slide number). A picture may be an
   `asset_…` or an https URL (imported for you). Another copy of a
   page is `{dup: "sl3", after?: …, slots}` — no separate duplicate call; a call with a `dup` names
   every slide by address, not by number (a retry would count against the grown deck). Charts go through
   `dock_slides_upsert_chart`.
4. Read the answer: fill or `delete` what `untouched` lists (template example text such as 勾選短句3). A slide another editor changed since your read comes back `refused`; the other slides
   landed — re-read and re-send the SAME call with the same key and the new `asOfSeq`. The re-send
   answers a slide that key already landed `held` without looking for its slots again (so a shape it
   deleted is not a typo), sends only the pictures of a slide whose text landed, fills the `dup` copy
   the first call made rather than copying again, and writes the rest. Then `dock_slides_render`.

**Choosing with a manifest.** `selection` says what the template fits and must not carry, its mood,
and its photo policy (`no-photos`: add none for looks, though a picture of what the request names is
content, and lands on free space where Dock's instructions say so; `search-or-drop`: a
`dock_image_search` result or delete the frame, never a generated picture). A scene's `needs` is the data it cannot be honest without:
no such data, delete that page rather than invent it. `fixedEncodings` are shapes that draw the
sample data (an axis range, a dot on a matrix, a highlighted column, a status colour): when your data
differs, redraw them as `whenChanged` says or delete them.
