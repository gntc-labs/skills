# GNTC Labs — Agent Skills

Agent skills for [GNTC](https://gntc.com)'s products, packaged as Claude Code plugins **and** installable via the open `npx skills` tool — same `SKILL.md` files, multiple distribution channels.

## Install

### As Claude Code plugins

```
/plugin marketplace add gntc-labs/skills
/plugin install vibehost
/plugin install entrydesk
```

### Via npx skills (Cursor, Codex, Claude Code, …)

```bash
npx skills add gntc-labs/skills              # list + install
npx skills add gntc-labs/skills --list       # list only
npx skills add gntc-labs/skills --skill vibehost-deploy
```

## Plugins & skills

### `vibehost` — [VibeHost](https://vibehost.com) hosting

| Skill | What it does |
| --- | --- |
| `vibehost-deploy` | Deploy a static site to VibeHost and get a private shareable URL. |

Coming soon: `vibehost-share`, `vibehost-manage-releases`, `vibehost-custom-domains`, `vibehost-logs`.

### `entrydesk` — [EntryDesk](https://entrydesk.com) AI workspace

| Skill | What it does |
| --- | --- |
| `entrydesk-cli` | Chat with AI models/agents, schedule agents, and call connected SaaS tools (Slack, GitHub, Google Drive, …) from the terminal. |

## Layout

```
.claude-plugin/
  marketplace.json              # marketplace manifest (plugins: vibehost, entrydesk)
plugins/
  vibehost/
    .claude-plugin/plugin.json
    skills/vibehost-deploy/SKILL.md
  entrydesk/
    .claude-plugin/plugin.json
    skills/entrydesk-cli/SKILL.md
```

Each product is one plugin under `plugins/`; each capability is one `skills/<name>/SKILL.md`. Adding a product = a new folder + one entry in `marketplace.json`; users who already ran `/plugin marketplace add gntc-labs/skills` see it automatically. The `skills/<name>/SKILL.md` convention is shared between Claude Code plugins and `npx skills`, so one repo serves both ecosystems.

## License

MIT
