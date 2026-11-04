# Check and hand over a deck

Load before hand-over on any deck that is not 快速 / Quick.

1. Read the layout from each write's own answer. `dock_slides_compose`, `dock_slides_compose_rows`,
   `dock_slides_fill`, `dock_slides_arrange`, `dock_slides_upsert_table`, `dock_slides_upsert_chart`,
   `dock_slides_replace_text` and `dock_slides_edit_batch` lint what they wrote once their read-back
   holds (`dock-slides/edit`, Answers). Fix every layout error an answer names, sized from its `detail`.
   Call `dock_slides_lint` on those slides (`slides: [...]`) only when the answer could not say:
   `verified` is `false` (fix the write first), a `notObservable` entry starts `layout:`, a
   compose_rows row reads `partial`, or the write went through a tool not listed here, such as
   `dock_slides_edit`, `dock_slides_add_flowchart` or `dock_slides_manage`.
2. `dock_slides_render` and look at the pictures against the rubric on the core page. Render the built
   deck eight slides per call.
   Then name the **weakest three** slides, each with its reason, and either make each better or
   state why its current form beats the alternatives you tried; render the ones you changed again
   in one call. Never paste an image link a tool returned (such as `ed://assets/…`) into your reply:
   it shows as a broken picture.
3. Before handover, ONE `dock_slides_lint` with no `slides`, over the whole deck. Above 20 slides it
   lints in pages: when the answer has `next`, call again with the same arguments and
   `cursor: next` until it has none. Fix every `error`. Warnings come only from this call (a write's
   answer carries errors, plus `top-heavy` from compose): a `warning` is a judgement, so look at the
   slide in a render, and pass `accept` only for one you looked at.
4. `dock_slides_verify` — claims about the finished deck: slide count and order, the titles, a
   chart's categories and values, a table's cells, whether two objects will Morph-pair.
   You are done when the whole-deck lint reports no error, you have looked at the rendered slides,
   verify holds, and the motion reads back as its score (`dock-slides-visual` section 6).
   A deck whose style makes errors on purpose accepts
   them by the objects they name (`sl1:off-slide:4`); `dock-slides-visual` section 6 sets that bar.
5. Hand over. The first line is the deck's `webUrl` (in the `dock_slides_create` and
   `dock_slides_export` answers): the link the user opens, never a `downloadUrl`, a bare id or a
   URL you built. When an answer has no `webUrl`, give the id and path and say there is no link.
   It opens for whoever may read the deck, so a deck in the private section opens for the user
   alone; when they asked for a link to give others, say they turn on sharing with the Share
   button in Dock, because you cannot. Then the deck's id and where it lives, which numbers are
   unsourced (their notes say so), and any limitation that affects how the deck can be used, then these four, each
   under its own heading: **Weakest three** (slide, reason, what you changed or why you kept it), **Pictures** (each
   generated picture and where it sits, or the plan's reason for none), **Watch in Play** (the
   slides whose motion a person should see), and **Not seen** (every slide whose final state you
   never saw rendered, or "none"). Leave out a recap of your edits, a list of the checks
   that passed, and any rating of your own work. When the user wants the file itself,
   `dock_slides_export` with `format` `pptx` or `pdf` returns it in the result as an attached file
   when it is small enough; otherwise it gives a `downloadUrl` that needs the same Dock credential.
