# Make a deck from sources

Load when the deck is made from a document.

**Source inventory.** When the user hands you a document (a PDF, a deck, a page), the deck is made
FROM it, so read all of it before you plan. A Dock link (`…/w/<workspace>/k/<id>`) is passed as is wherever a tool takes a node id (`presentation_id`, `id`, …). A PDF: `dock_file_attach` for the pages as pictures and
`dock_pdf_read_text` for the text. A Dock page: `dock_page_get`. A Dock deck: `dock_slides_get`. A
.pptx or .key link: `dock_asset_upload` it, then read the deck it makes. Write down, in your reply or a note you keep:

- the facts and numbers, each with where you read it;
- the **pictures**. They are content, not decoration: a portrait in a roster IS the slide. List
  each one with what it shows and which item it belongs to;
- the brand: colours (hex), fonts, logo, and the source's own wording for names and taglines.

**A PDF's pictures.** `dock_pdf_extract_images` with `{id}` lists them; with `images: [{page, index}]`
it stores each as an asset: `DrawImage`'s `image` is
`dock-asset://<asset.id>`. A file attached to the conversation (`ed://uploads/<fileId>`) is first
`dock_asset_upload`ed; pass the `asset_…` id it returns. A diagram drawn as vectors is not listed:
crop it from a page render and hand it over as `dock-slides-visual` path A says.
`inForms` counts, per page, pictures inside form XObjects, which the tool cannot store: crop the ones
that matter, and name in your reply the pages whose pictures you left behind. `shadow: true` is
a guess: see it (extract it or the render); keep it if it shows artwork or text or you
can't tell.
