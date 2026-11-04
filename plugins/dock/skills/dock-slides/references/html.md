# Draft a slide in HTML, then convert it

Load when you draft a slide in HTML, with a shell.

A slide can be faster to write as one HTML block and
convert to native objects. This needs a shell on a machine with Chrome, Chromium or Edge, and
`dock-slides-visual` section 3.10 covers what the convert keeps and what it gives up:

1. `dock slides html-block insert <deck-id> --slide <sl> --box 0,0,960,540 --html slide.html` inserts
   the block and renders it in that browser, so `dock_slides_render` shows the block instead of a grey
   box. A chart is a `<figure data-dock-chart>` holding its data as JSON; the insert adds the script
   that draws it.
2. Render the slide and check it. To change it, edit the file and send it with
   `dock slides html-block set-source <deck-id> --slide <sl> --shape <id> --html slide.html`.
3. `dock slides html-block convert <deck-id> --slide <sl> --shape <id> --json` replaces the block with
   native objects. 「Revert this run」 takes it back only until the deck is checkpointed past it, so
   keep the file.

Without a shell, as over remote MCP, build the slide from native objects: no Dock server renders a
block, so its Fallback stays a grey box and `dock_slides_render` cannot show what you wrote.

A block that stays live in the deck (3-D, a simulation, data that moves) is a different job, with its
own Fallback and hand-off rules: `dock-slides-visual` section 3.11.
