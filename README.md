# GNTC Labs — Agent Skills

Agent skills for [GNTC](https://gntc.com)'s products, packaged as plugins for Claude Code and Codex **and** installable via the open `npx skills` tool — same `SKILL.md` files, multiple distribution channels.

## Install

A plugin installs all of its skills in one step: `vibehost` brings `vibehost-deploy`, `vibehost-pumpkin-patch` and `vibehost-haunted-farm`, plus VibeHost's MCP server (`https://api.vibehost.com/mcp`). The server signs in with OAuth the first time it's used: in Claude Code run `/mcp` (or let Claude call its `authenticate` tool), in Codex run `codex mcp login vibehost`. `dock` brings `dock-slides` and `dock-slides-visual` plus Dock's MCP server (`https://app.dock.space/v1/mcp`), which signs in the same way (`codex mcp login dock` in Codex). The `npx skills` install below brings the skills only.

### Claude Code

Inside Claude Code:

```
/plugin marketplace add gntc-labs/skills
/plugin install vibehost@gntc-labs
/plugin install entrydesk@gntc-labs
/plugin install dock@gntc-labs
```

Or from a shell:

```bash
claude plugin marketplace add gntc-labs/skills
claude plugin install vibehost@gntc-labs
claude plugin install entrydesk@gntc-labs
claude plugin install dock@gntc-labs
```

### Codex

Codex reads the same `.claude-plugin/marketplace.json`, so this repo is a Codex marketplace too:

```bash
codex plugin marketplace add gntc-labs/skills
codex plugin add vibehost@gntc-labs
codex plugin add entrydesk@gntc-labs
codex plugin add dock@gntc-labs
```

In Codex the skills are prefixed with the plugin name, e.g. `vibehost:vibehost-deploy`.

### Via npx skills (Cursor, Codex, Claude Code, …)

```bash
npx skills add gntc-labs/skills              # list + install
npx skills add gntc-labs/skills --list       # list only
npx skills add gntc-labs/skills --skill vibehost-deploy
npx skills add gntc-labs/skills --skill vibehost-pumpkin-patch
npx skills add gntc-labs/skills --skill vibehost-haunted-farm
npx skills add gntc-labs/skills --skill dock-slides
npx skills add gntc-labs/skills --skill dock-slides-visual
```

The Dock skills work through Dock's MCP tools, so add the server yourself when you install them this way, e.g. `claude mcp add --transport http dock https://app.dock.space/v1/mcp`.

## Update

Claude Code — fetch the marketplace first, then install the newer version and restart Claude Code (`plugin update` on its own can check a stale copy of the marketplace and report "already at the latest version"):

```bash
claude plugin marketplace update gntc-labs
claude plugin update vibehost@gntc-labs
```

Codex — refreshes the marketplace and the installed plugins with it:

```bash
codex plugin marketplace upgrade gntc-labs
```

## Plugins & skills

### `vibehost` — [VibeHost](https://vibehost.com) hosting

| Skill | What it does |
| --- | --- |
| `vibehost-deploy` | Deploy a static site to VibeHost and get a private shareable URL. |
| `vibehost-pumpkin-patch` | Roll a one-of-a-kind Halloween pumpkin patch and publish it on VibeHost. Friends who open the link grow a random pumpkin, carve it, light it and send one back. |
| `vibehost-haunted-farm` | Build a pixel-art Halloween village for your VibeHost workspace. Every teammate gets a house and a farm on its own link, grows pumpkins in real time and can steal a neighbour's ripe ones. Uses VibeHost App Data, which is rolling out workspace by workspace. |

Coming soon: `vibehost-share`, `vibehost-manage-releases`, `vibehost-custom-domains`, `vibehost-logs`.

### `entrydesk` — [EntryDesk](https://entrydesk.com) AI workspace

| Skill | What it does |
| --- | --- |
| `entrydesk-cli` | Chat with AI models/agents, schedule agents, and call connected SaaS tools (Slack, GitHub, Google Drive, …) from the terminal. |

### `dock` — [Dock](https://dock.space) docs and slide decks

| Skill | What it does |
| --- | --- |
| `dock-slides` | Make, draft, redo or improve a deck in Dock, from the plan through the check of the rendered slides. Loads its modules (`references/`) only when a deck needs them. |
| `dock-slides-visual` | The look of a Dock deck built from native objects, with style packs (torn-paper collage, kinetic typography, retro CRT, board explainer, pixel art). |

These are Dock's own skills, copied from Dock by `scripts/sync-dock-skills.mjs`; change them in Dock, not here (see [`plugins/dock/README.md`](plugins/dock/README.md)).

## Layout

```
.claude-plugin/
  marketplace.json              # marketplace manifest (plugins: vibehost, entrydesk, dock)
plugins/
  vibehost/
    .claude-plugin/plugin.json
    .claude-plugin/icon.png                  # listing icon in the Claude plugin directory
    .mcp.json                                # VibeHost's MCP server (remote, OAuth)
    README.md                                # what the plugin reads, stores and sends where (the directory's data-handling answers)
    skills/vibehost-deploy/SKILL.md
    skills/vibehost-pumpkin-patch/SKILL.md   # + the template, art and build scripts it uses
    skills/vibehost-haunted-farm/SKILL.md    # + the template, art, build and check scripts it uses
  entrydesk/
    .claude-plugin/plugin.json
    .claude-plugin/icon.png
    skills/entrydesk-cli/SKILL.md
  dock/
    .claude-plugin/plugin.json
    .claude-plugin/icon.png
    .mcp.json                                # Dock's MCP server (remote, OAuth)
    README.md                                # data-handling answers, and where the skills come from
    skills/dock-slides/SKILL.md              # + references/*.md, the modules it loads
    skills/dock-slides-visual/SKILL.md
scripts/
  sync-dock-skills.mjs          # copies the Dock skills from a Dcard/Dock commit
LICENSE                         # MIT, for every plugin here
```

Each product is one plugin under `plugins/`; each capability is one `skills/<name>/SKILL.md`. Adding a product = a new folder + one entry in `marketplace.json`; users who already ran `/plugin marketplace add gntc-labs/skills` see it automatically. The `skills/<name>/SKILL.md` convention is shared between Claude Code plugins, Codex plugins and `npx skills`, so one repo serves all three.

**Bump `version` in the plugin's `.claude-plugin/plugin.json` with every change to its skills**, and keep its entry in `marketplace.json` in step. Claude Code reads the version from `plugin.json` and `claude plugin update` reports "already at the latest version" while it is unchanged, so a change shipped without a bump never reaches people who already installed the plugin. Codex picks up changes on `marketplace upgrade` either way.

### Claude plugin directory

Before submitting a plugin to the directory (<https://claude.ai/directory/manage>), run its checks locally; this runs a subset of what the portal's **Validate** does:

```bash
claude plugin validate --profile directory --strict plugins/vibehost
```

- The plugin needs a license: the `LICENSE` at the repository root counts for every plugin under `plugins/`, and each `plugin.json` also sets `"license": "MIT"`.
- `.claude-plugin/icon.png` (a square PNG, 512 to 2048 px, under 2 MB) becomes the listing icon only the first time the plugin is saved or submitted in the portal. Changing it later doesn't change the listing.
- A plugin that ships a remote MCP server (`plugins/vibehost/.mcp.json`, `plugins/dock/.mcp.json`) needs `privacyPolicyUrl` in its `plugin.json`. The directory also asks for the server itself to be submitted as an MCP connector at the same URL, so people who have both see one set of tools.
- The directory's **Data handling** step asks whether any skill sends data to a service other than the declared connectors; the answer "Yes" points reviewers at the plugin's README. `plugins/vibehost/README.md` and `plugins/dock/README.md` list every such service and what the skills store, so update them when a skill starts calling something new (for Dock, check after each sync).
- The directory reads every file that isn't an image or font only up to 256 KiB, and holds any other binary (`.ico`, `.zip`, …) for review. Keep scripts and templates under that size and generate other binaries at build time.

## License

MIT, see [LICENSE](LICENSE).
