# Dock plugin (`dock-space`)

Dock's MCP server plus two skills for [Dock](https://dock.space), GNTC's workspace where people and AI agents make docs and slide decks together:

| Skill | What it does |
| --- | --- |
| `dock-slides` | Make, draft, redo or improve a deck in Dock. The skill's main page covers every deck. Its modules in `references/` cover the plan, building from a document, web research, layouts, charts, templates, pictures, HTML drafts, editing and the check before hand-over, and the agent reads one only when the deck needs it. |
| `dock-slides-visual` | The look of a deck built from native objects: custom shapes, texture fills, shadow and glow, theme fonts, Morph and entrance builds, and style packs for torn-paper collage, kinetic typography, retro CRT, board explainer and pixel art. |

The MCP server is `https://app.dock.space/v1/mcp` (remote, OAuth 2.1 with dynamic client registration, so the plugin carries no token). It signs in the first time it's used: in Claude Code run `/mcp`, in Codex run `codex mcp login dock`. Using the skills needs a Dock account.

The plugin is named `dock-space` because "dock" is another company's listing in the Claude plugin directory. The product is Dock, and the MCP server (`dock`, shown as `plugin:dock-space:dock`) and the skills keep Dock's names.

Docs: <https://dock.space/agents> (it sets up the same server with a personal access token; the plugin signs in with OAuth instead) · Privacy: <https://dock.space/privacy> · Terms: <https://dock.space/terms>

## Install

In Claude Code 2.1.275 or later:

```
/plugin install dock-space --marketplace gntc-labs/skills
```

In an older Claude Code, run `/plugin marketplace add gntc-labs/skills`, then `/plugin install dock-space@gntc-labs`. In Codex: `codex plugin marketplace add gntc-labs/skills`, then `codex plugin add dock-space@gntc-labs`; Codex lists the skills as `dock-space:dock-slides` and `dock-space:dock-slides-visual`.

## Where the skills come from

The skills are Dock's own pages, the same text the server's `dock_skill` tool returns and app.dock.space publishes at `/.well-known/agent-skills/`. They are copied from `packages/dock-mcp-core/skills/` at Dcard/Dock commit `e357fc0626a52cccc579e8e3ebcceaea71b0f6d0` by [`scripts/sync-dock-skills.mjs`](../../scripts/sync-dock-skills.mjs). The script changes these lines and leaves every other byte as Dock wrote it:

- In `dock-slides/SKILL.md` it points the module links at the files (`plan/SKILL.md` becomes `references/plan.md`) and says where a `dock-slides/<module>` name lives on disk, so an agent without `dock_skill` can open them.
- In `dock-slides-visual/SKILL.md`, three lines that the Claude plugin directory reads as a skill handing a credential to a remote host:
  - The headless Chrome example opens `file://$(realpath orbit)/index.html` instead of building the path from the shell's working-directory variable, which the directory takes for a password.
  - The sentence after "ONE `DrawImage` op" says what `dock_slides_verb_describe` gives, because the directory takes the word "op" right before "Read" for the 1Password CLI.
  - "(text glow and shadow too)" is written with "and" instead of a slash, because the directory takes a slash right before "shadow" for the Unix password file.

  The script stops if a copied page still holds a shell variable or either of those word pairs.

To update them, change the skills in Dock, then copy the commit that app.dock.space serves:

```bash
node scripts/sync-dock-skills.mjs <path to a Dcard/Dock clone> <commit>
```

The script prints any page that differs from what app.dock.space serves now. Bump the plugin's version afterwards, as for any other skill change.

## Data handling

### What the plugin reads and stores

- **Your Dock account.** Signing in with OAuth lets the MCP tools read and write the workspaces your account can open, within the scopes you approve. The skills never ask for or type a password.
- **Decks and sources.** The skills read the decks, pages and PDFs you point them at, and write the decks they build into your Dock workspace, where every member who can open a deck sees it.
- **Speaker notes.** Each number on a slide gets the URL or document name it came from in that slide's speaker notes.
- **Pictures and files.** `dock_asset_upload` stores the pictures and files you give it as Dock assets. Given a URL, Dock's server downloads it. `dock_image_search` imports photos and logos it finds, and `dock_image_generate` draws pictures on Dock's side.
- **Local files.** Only when the agent has a shell and drafts a slide in HTML: it writes the page (`slide.html`, or a folder with `index.html`) and a `fallback.png` screenshot in your current directory. Nothing else is written to disk.

### Services the plugin talks to

Besides the declared MCP server, the skills reach these services:

| Service | When | What is sent |
| --- | --- | --- |
| Dock (`app.dock.space`) via the `dock` CLI | When the agent has a shell and drafts a slide in HTML (`dock slides html-block insert`, `set-source`, `convert`) | The HTML page, the files it loads and its fallback picture, to the deck. The CLI uses its own sign-in (`dock login`). The skills don't install the CLI. |
| Chrome, Chromium or Edge on your machine | Same HTML path | The CLI opens the page in a local headless browser to render it. |
| `cdn.jsdelivr.net`, `unpkg.com` | A live HTML block (3-D, a simulation) that loads a pinned library, as the three.js example does | Requests for the library files. The CLI bundles them into the deck, so the block plays with no network afterwards. |
| The agent's own web search | A deck that needs facts from the web | Search queries about the deck's topic, and requests for the pages read. The skills name Dock's in-app agent's tools (`web__search`, `web__scrape_url`, `subagent__spawn`); another agent uses its own search tool. |

### Retention

Dock keeps what a workspace holds for as long as it is in the workspace. Deleted pages and decks go to the trash, which Dock does not empty automatically; a deleted upload is deleted permanently. Database backups are kept for 14 days and sign-in sessions until 30 days after their last use. See the [privacy policy](https://dock.space/privacy), section 9, for the details.

## License

MIT, see [LICENSE](../../LICENSE).
