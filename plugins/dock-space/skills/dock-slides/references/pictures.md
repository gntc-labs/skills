# Pictures in a deck

Load before you generate or place any picture.

Every picture is a Dock asset first: `dock_asset_upload` for one you were given (several in one call
with `url: [...]`); `dock_image_search` for real photos of named places, products and things, brand logos, public
figures and named works, species and events, every slot of the deck in one call; `dock_image_generate` to draw the rest: still
lifes, textures, swatches and light, each abstract or of objects so it claims no fact, person or
brand. Generation is charged to a daily budget, so ask for what you need once. Pass the `asset_…` id (`dock_slides_fill` also
imports an https URL); never transcribe a source picture as base64. A few-KB texture tile you
generated yourself is the one exception (`dock-slides-visual` section 2).

Place a picture with the tool that writes its slide, which fits it without stretching:

- On a slide you compose, `dock_slides_compose`' `image` (`source` the `asset_…` id, `fit`
  `cover` or `contain`, `face` to keep a face inside a crop). It takes the layout's one empty
  `role: picture` slot (Picture with Caption, with `body` as the caption), else the body's place, so
  it places ONE picture per slide, and on a layout with no picture slot the slide takes no `body`.
- On a template page, `dock_slides_fill` with the picture's slot (`dock-slides/templates`).
- Only what neither reaches goes through `dock_slides_edit` after the slide exists: `ReplaceImage` to
  swap a picture already there, `AddImage` for a second picture on one slide. `ReplaceImage` keeps
  the frame and, by default, crops a picture of another shape centred to fill it (one of the same
  shape keeps the old crop); `fit: contain` shows all of it padded inside the frame, `fit: stretch`
  squeezes it. Give `AddImage` a box of the picture's own aspect ratio.

Generate at whatever aspect suits the picture; the fit is a crop PowerPoint can adjust. Place it,
then render and look: no stretch (keep the picture's own aspect ratio), a face never cropped, the
same size and position on every sibling slide. If a source picture cannot be had as an asset, say
in the handover which ones you left out; never drop one silently. Never hotlink or invent a picture
source.

`dock_image_search`: ask for photos only of concrete subjects (`Taipei 101`, `Gogoro scooter`), each
with the frame's `aspect`, and pass the slide `background` so a logo comes back in a variant that
shows on it. `purpose: person` is a public figure, `purpose: entity` anything with its own Wikipedia
article (a book, film, game, artwork, species, historical event, car model): `subject` is the name
as the request writes it, `context` who or what it is (`Taiwanese singer`, `TSMC founder`, `2010
film`), which is what tells a namesake apart. A person needs a `context` of at least two words, their
country or company and their role, that matches their article. A thing's `context` must match what
it is (`2010 film`, not who adapted it). Without one, a person stays `empty`, and so does a name with
several meanings; a thing with only one candidate comes back with `name_only`, unconfirmed; an entity comes back as its cover or poster where it has one. At most 8
slots a call; a logo wall of more, in further calls of 8.

A licence labels a picture and never rules one out: the person building the deck decides. Place each
result at its `aspect_ratio` (a frame of that shape, or `fit: cover` with its `suggested_crop`);
never stretch it, and a small one (a poster is often 220 px wide) stays small. Put its `source_url`,
`license` and `attribution` in that slide's notes, and `matched by name only` when it has `name_only`.
The handover names every picture whose `license_status` is not `free` or that has `name_only`, with its
slide. A slot that comes back `empty` gets no picture: draw a
diagram or icon for an abstract idea, and set a name in type when its logo or portrait is missing —
never another picture in its place.
