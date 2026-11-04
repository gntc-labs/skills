# Plan a deck

Load before the first tool call when no plan is agreed yet.

**Genre and reading mode.** Decide both, and say them in one line of your reply.

- Genre: **argument** (persuade toward a decision), **report** (findings and numbers),
  **roster or catalog** (people, products, a portfolio, a media kit: the items ARE the content),
  **pitch** (a story told to win a yes), or **visual explainer** (a deck whose look is the point: big
  display type, layered material, motion).
- Reading mode: **self-read** (sent as a file, read alone, so a slide may carry full sentences and
  detail) or **presented** (spoken over, so a slide carries one idea and little text).

Genre decides how you write and what you build (a roster is one repeated pattern, not
an argument). Unsure which? Pick the one the user's words and any source document point to, and say
which you picked.

**Art direction.** Before composing, write it down and keep every slide to it, as concrete as a
`dock-slides-visual` section 4 pack: a concept in one line, the palette in hex (from the source brand
when there is one, else the template's), the type scale (title, body, caption sizes) with at most
two font families, the grid (margins and columns), one material family, how a picture is treated
(fit without stretching, a face is never cropped), a motion grammar and one signature move. A named
style takes its pack; with none, write your own to the same detail, because a spec that names only
colours leaves every slide to the layout. Lock it into the deck's theme
once, rather than recolouring slide by slide: colours through `dock_slides_edit_layout`
`SetThemeColorScheme`, fonts through `dock_slides_edit_master_theme_fonts` `SetMasterThemeFonts`.
Every slide then inherits it and siblings cannot drift.

## Show the plan

Show the plan in your reply before you create anything:

- one line: by the end, `<audience>` should `<do what>` because `<core argument>` (an argument or pitch deck;
  a roster says instead who and what it presents);
- a narrative arc (for example context → stakes → evidence → implications → action);
- how each slide is built, its `composition` in the plan block: what reads first, at what scale,
  where ("one 300 pt word cropped off the right edge, the claim small under it"). Only then pick
  the layout that carries it. Every deck but a roster or catalog is planned as a storyboard:
  `dock-slides-visual` section 0;
- which slides' texts will change after the build (cards the user will keep editing): their text
  boxes are drawn with `text.autofit: "shrink"` (the core page's script), so a longer text later
  shrinks to fit its box;
- for each number, its source in that slide's `note` in the plan block: the url when research found
  it, else the name;
- each source number drawn as a picture in its own proportion (two circles 1.6 times apart, a bar
  58% filled, a timeline cut at the real dates) rather than written as a bullet;
- the pictures: which slides carry one and what each shows, judged by what this audience expects to
  see (a beauty or product deck shows texture and product). A plan with none names the reason and
  what carries the material instead; the effort of making them is not a reason;
- the count, and each title, by the rules on the core page.

The plan is done when every slide has its composition, every source number its picture, and the
pictures and the motion score are decided.

Missing the topic, audience or purpose? Ask ONCE, your recommended answer first. If nobody can
answer (an unattended run, no reply), decide yourself and say what you decided.
