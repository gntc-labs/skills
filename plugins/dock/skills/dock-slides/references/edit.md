# Change an existing deck

Load when you change slides that already exist, or read a write's answer beyond its `outcome`.

Write a deck's words with the tools that write many things in one call: `dock_slides_compose`,
`dock_slides_fill`, `dock_slides_replace_text`,
`dock_slides_manage`, `dock_slides_arrange` to move (a group too), align, distribute, group, ungroup or restack objects
(front, back, one step forward or backward), and `dock_slides_add_flowchart`. `dock_slides_edit` and `dock_slides_edit_batch` change ONE existing thing afterwards: a
font size, a position, a colour, a single word, a picture (`dock-slides/pictures`). Typing a slide's words shape
by shape (`SetText` per box) is the one thing not to do.

A longer text in a card's box: when the box has no `autofit` `norm` (a deck someone else built, an
imported file), send `SetBodyPr` `attr: "autofit"`, `val: "norm"` on it in the same write as the text.
The box keeps its size and the grown text is drawn smaller than its siblings', which
`dock_slides_lint` does not flag. Render the slide after the edit, and fix by hand what the render
shows: a run visibly smaller than its neighbours', or a number broken across two lines (shorten the
text, or widen the box and its siblings together).

`dock_slides_read` reads a deck by facet (text runs, links, and more; its description lists them) when you need more than `dock_slides_get` prints. An edit a person should adopt or reject goes through `dock_slides_propose` instead, and `dock_slides_render_proposal` pictures it.

Addresses and epochs: a slide's address is what `dock_slides_get` lists for it: `sl3` for a slide
the file came with, `sid_…` for one added in the live room. `sl3` is an address, not a place: a
slide added in the room has no `sl<n>`, so a deck listed as `sl1, sid_…` has no `sl2`. To name a
slide by its place, pass its 1-based number (`3`, `"3"`; get also takes `2-4`, render and lint
`"1,2"`). An `accept` key takes an address only; one on a slide the deck lacks absorbs nothing and
is listed under `unmatchedAccept` with why. Any other address the deck lacks is refused, and the
refusal names the slide at that place. Pass the read's `sinceSeq` as `base` (lint) or `base_seq`
(render), so a stale address is refused instead of resolving to another slide. After a write, pass
its answer's `nextBase` there (the `dock_slides_edit` tools answer none: re-read); a write's `seq` and
an `asOfSeq` are never a base.

Answers: a write answers with a receipt — `outcome`, `committed`/`of`, `snapshot`/`seq`, `nextBase`,
`key`, the ids it `minted`, and only what went wrong or needs you (`warnings`, failing `checks`,
`notObservable`, `failed`, `notSent`, `fix`, `resume`). `dock_slides_compose`, `dock_slides_compose_rows`, `dock_slides_fill`, `dock_slides_arrange`, `dock_slides_upsert_table`, `dock_slides_upsert_chart`, `dock_slides_replace_text` and `dock_slides_edit_batch` also answer
`verified`; `dock_slides_apply` reads nothing back unless you pass `verify: "lint"`. `verified` is the read-back plus the
layout: `true` means what you sent reads back and lint found no error on the objects the call
wrote; `"partial"` means a layout error is listed in `warnings` (in `lint.findings` for
`dock_slides_edit_batch`) or `notObservable` names what could not be measured; `false` means a
`checks` entry failed and the layout was not measured. It does not echo what you sent; pass
`verbose: true` only to debug a write.
