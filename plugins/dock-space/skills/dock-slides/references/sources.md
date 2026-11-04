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
