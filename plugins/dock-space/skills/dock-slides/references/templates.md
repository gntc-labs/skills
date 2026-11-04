# Filling template slides

Load when the deck comes from a template, or you fill designed pages.

A designed template page (from `dock_slides_create` with `template`, or `dock_slides_insert_from_asset`)
keeps its text in named shapes, not layout placeholders, so `dock_slides_compose` cannot reach
it. The path is four calls, not one per run:

1. Bring the pages in: `dock_slides_create` with `template`, or `dock_slides_insert_from_asset`.
2. `dock_slides_get` — each shape line is `{#id name} text` (`name` printed when the shape's own name
   is unique on the slide). A paragraph whose runs look different — a big number and a small unit —
   prints as a JSON array of display segments: `- {#8} [["NT$ 12.40","M"],"較計畫 +1.6%"]`. With a
   scene manifest, `dock_slides_scenes` adds what each slot is for and how much it holds.
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
