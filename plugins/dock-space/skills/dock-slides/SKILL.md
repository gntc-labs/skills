---
name: dock-slides
description: Use whenever the user asks to make, draft, redo or improve a deck, presentation, slides, 簡報 or 投影片 in Dock, even when they name no tool.
---

# Making a deck in Dock

Answer in the user's language. Every tool named here is a Dock MCP tool (`dock_slides_*`); read a tool's
own description for its arguments. This page is what every deck turn needs; the modules hold the rest.

## Modules

Load what the turn needs with `dock_skill`, name `dock-slides/<module>`, all in ONE response, before the
call it is for. With no `dock_skill`, read each linked file; a `<skill>/<module>` name on any page is the file `<skill>/references/<module>.md` in this skills folder. If your host defers tool schemas, load the tools a page names in ONE search.

- [`plan`](references/plan.md): no plan is agreed yet, on a deck that is not 快速 / Quick.
- [`sources`](references/sources.md): the deck is made from a document.
- [`research`](references/research.md): web research, on a deck that is not 快速 / Quick.
- [`compose`](references/compose.md): you build on layouts or a roster instead of one script.
- [`charts`](references/charts.md): a slide carries a chart, a table or a process.
- [`templates`](references/templates.md): the deck comes from a template, or you fill designed pages.
- [`pictures`](references/pictures.md): before you generate or place any picture.
- [`html`](references/html.md): drafting a slide in HTML, with a shell.
- [`edit`](references/edit.md): changing slides that already exist, or reading a write's answer beyond its `outcome`.
- [`check`](references/check.md): before hand-over, on any deck that is not 快速 / Quick.
- [`writing`](references/writing.md): before-and-after examples of the writing rules.

The look is a skill of its own: `dock_skill` with name `"dock-slides-visual"`. Load it for every deck that is
not 快速 / Quick; on 快速 / Quick, only when the user names a style or mood.

## The turn

**快速 / Quick** keeps layouts and colour, pictures as set, and skips the weakest-three round: no `dock_slides_lint`, no `verify`. Any research comes first, each number's url in its note, written with `SetNotes` in the script. One `dock_slides_script`; one `dock_slides_render` pass (`slides: [1,…]`, at most 8 per call); fix only the defects you saw, without rendering again; then hand over in at most 5 lines: the deck's name (it is open), every number left unsourced, and at most two weak slides, one line each. No headings, no title list, no question.

**Any other deck:** load `plan` unless a plan is agreed, build with the script below, render eight slides per call, then load `check`, which also holds the full hand-over.

**Web research on 快速 / Quick.** No sub-agent: one response of at most 4 `web__search` calls, using the snippets; `web__scrape_url` on at most 2 pages, only for a number going on a slide.

**Art direction.** Before you write, decide a concept in one line, the palette in hex (the source brand's when there is one), a title, body and caption size with at most two font families, and the margins and columns. Hold them as constants in the script, so every slide keeps to them.

**Every slide.**

- one point per slide, and a title that fits the slide's role: a noun phrase for a setup, process,
  overview or definition slide ("Onboarding steps", "什麼是單一登入"); a claim ("Churn fell 12%
  after onboarding v2") only when the slide carries a finding backed by a sourced number or a source
  you read, and the Numbers rules decide which numbers you may use. No imperative titles ("Improve
  onboarding"), no "From X to Y" frames, no trailing period on a short title;
- each source number drawn as a picture in its own proportion (two circles 1.6 times apart, a bar
  58% filled, a timeline cut at the real dates) rather than written as a bullet;
- the count: an N-slide request means N slides in total, including any cover. Do not add a cover
  to a one-slide deck.

A self-read deck may carry full sentences; a presented one carries one idea and little text.

## Numbers

A number is sourced only if you READ it in the user's words, or in a document, page or search result
you can name, or if a research sub-agent's report gives it with a url and a word-for-word quote. Put that exact name or url in the slide's speaker notes (`SetNotes`).
Every other number, including one copied from a deck that cites nothing, stays off the slide. Never
put placeholder text on a slide (PLACEHOLDER, TBD, 待確認, 待填, XX, 【請填入…】): state the point in
words, and record the missing figure in the speaker notes. Never name a source nobody read.

## Writing what the slides say

**Roster, catalog, portfolio, media kit:** the source's words are the content. Keep its names,
taglines and voice exactly as written and only shorten what does not fit, by cutting, never by
rephrasing. Do not rewrite a member's tagline into something smoother: a different sentence is a
different person. The rules below do not apply to text you copy from the source.

**Argument, report, pitch (and any text you write yourself):** these are hard rules for every title,
subtitle and body line, because each banned form reads as machine written. Body text says what
happens, to whom, by how much.

- Join two thoughts as two short sentences. No em dash and no semicolon.
- Separate items with the layout's list, steps or timeline shape, or write the verb. No `•`, `|` or
  `→` between items or as a connector.
- Write active voice with a named actor. A passive line hides who did it.
- Say Y and drop the denial of X. No "it is not X, it is Y" frame (不是……而是……).
- List the items that exist. No trio built for rhythm, and no slogan or third item invented to
  complete one.
- Name the thing. No needless hyphenated compound or stacked adjective ("data-driven,
  customer-centric").
- Say what happens in plain words. No flowery or vague filler (賦能, 全方位, leverage, robust): it
  fills space and claims nothing.
- Keep only what the slide needs. Cut a line that repeats its title.

## Check the rendered slides against this rubric

Look at each rendered slide, and fix the one that fails before you hand over.

- Hierarchy: one thing reads first, then second. Title, figure and caption differ in size by role.
- Alignment: every object sits on the grid from your art direction. Same-role objects on sibling slides
  share one position.
- Whitespace: margins are even, nothing touches the edge, no slide is packed while another is empty,
  and every slide uses its canvas: a text box under half full takes bigger type, a middle anchor, a
  smaller box beside a shape or picture, or another layout.
- Numbers: every source number reads as its picture, drawn in its own proportion.
- Pictures: none stretched, no face cropped, each the same treatment as its siblings.
- Brand: only the art direction's colours and fonts appear. A colour you did not choose is a defect.
- Readability: the smallest text is legible at the reading mode's distance, and contrast holds on
  its background.
- Source fidelity (when there was a source): every item and picture from the inventory is on a
  slide, and its wording is the source's.
- Rhythm (every genre but a roster or catalog): from one slide you cannot guess the next one's
  composition, and each slide has one moment a viewer would screenshot. Every check above can pass
  on a deck that fails this one.
- Motion (any deck with builds or Morph): it follows the motion score (`dock-slides-visual` sections 0 and 6).

## The script

**Several slides of native objects: one script.** A multi-slide Build uses this one script, not `dock_slides_compose` on default layouts. `dock_slides_script` runs JS whose one effect is
`emit(op)`, `op` a `dock_slides_apply` op: helpers and loops write a fifth of the output. Neighbouring ops go as ONE atomic apply (up to 100); one bad op fails its whole apply. `"@<n>"` is the
op emitted at index n (`AddSlideOnLayout`, then `slide: "@0"`); a slide number works if no slide is added. `emit` answers nothing and there is no `emitted()`: count your own ops, as here.

```js
let n = 0;
const op = o => (emit(o), n++);
const box = (slide, x, y, w, h, text, size) =>
  op({
    method: 'DrawShape',
    slide,
    x,
    y,
    w,
    h,
    fill: { color: 'EFF6FF' },
    text: { paragraphs: [{ text, size, color: '1F2937' }], autofit: 'shrink' },
  });
let slide = 'sl1';
PAGES.forEach((p, at) => {
  if (at > 0) slide = `@${op({ method: 'AddSlideOnLayout', slide })}`;
  box(slide, 48, 32, 864, 64, p.title, 32);
  p.cards.forEach((c, i) => box(slide, 48 + i * 296, 140, 272, 340, c, 16));
});
```

A throw comes back as `scriptError`, verbatim with its line, and nothing is written. A stop gives `reason` and `fix`
first; follow `fix`. Any order: edits go after their shapes (`reorderedFrom`).

**A text box inside a card, or any box whose text may change later, is drawn with `text.autofit: "shrink"`**,
as `box` does above (PowerPoint's Shrink text on overflow, the same as `SetBodyPr` `attr: "autofit"`, `val: "norm"`
on a box that exists). PowerPoint then shrinks the text to fit when it grows, so a longer text later stays inside
its box.

**If the tool's description lists `fit`, size text before you emit it:** `const f = fit(text, {w, h}, {size})`, then `size: f.fits ? size : f.maxSize`; no lint round. `outline()` reads slides, shape ids and boxes before you edit existing slides. Fix a refused script with `edits: [{old, new}]` under the same key, not the whole script.

## Traps

- A retry reuses its `idempotency_key`; a new piece of work takes a new one. A call that reports
  `replayed` applied nothing new.
- The intent tools (manage, compose, compose_rows, fill, arrange, replace_text, upsert_table,
  upsert_chart, add_flowchart) each require `summary`, one sentence for the person approving the
  call. A call without it is refused.
- `committed` is the room's word for "accepted", and several verbs commit and then skip an address
  they cannot resolve, so a committed write is not proof it did anything. The answer's `verified`,
  a render and `dock_slides_verify` are how you know.
- A refused or failed WRITE (`deck room closed`, an `outcome` of `refused`) means that edit did NOT
  land. Report it as failed, read the deck again, and continue from what is really there; never
  describe the unwritten slides as done. A refused lint or render only means that measurement was
  not taken; it says nothing about the writes before it, so narrow the call and ask again.
- Every text write is ONE paragraph unless the verb takes a paragraph list: `SetText`,
  `SetRunText`, `AddText`, `SetTableCell` and `dock_slides_replace_text` refuse a `\n` or `\r`
  (and `\v`, which no deck can hold). Several paragraphs go through `dock_slides_compose`, or
  `SetParagraphs` with one entry per paragraph and `{"br":true}` for a line break inside one.
- A render that answers `busy`, `timeout` or `render_unavailable`: wait `retry_after` and send the same call once more before you split it.
- The deck is a live room: someone may have it open. Delete only slides you created.
