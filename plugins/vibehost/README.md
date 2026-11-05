# VibeHost plugin

VibeHost's MCP server plus three skills for [VibeHost](https://vibehost.com), GNTC's static-site host:

| Skill | What it does |
| --- | --- |
| `vibehost-deploy` | Deploy a static site or Next.js app to VibeHost and get a private shareable URL. |
| `vibehost-pumpkin-patch` | Roll a one-of-a-kind Halloween pumpkin patch and publish it on VibeHost. Visitors grow a pumpkin, carve it, light it and send it on as a link. |
| `vibehost-haunted-farm` | Build a pixel-art Halloween village for a VibeHost workspace, where every teammate has a farm on its own link. Uses VibeHost App Data. |

The MCP server is `https://api.vibehost.com/mcp` (remote, OAuth). It signs in the first time it's used: in Claude Code run `/mcp` or let Claude call its `authenticate` tool. Using any skill needs a VibeHost account.

Docs: <https://docs.vibehost.com/guides/claude-code> · Privacy: <https://vibehost.com/privacy> · Terms: <https://vibehost.com/terms>

## Install

In Claude Code 2.1.275 or later:

```
/plugin install vibehost --marketplace gntc-labs/skills
```

In an older Claude Code, run `/plugin marketplace add gntc-labs/skills`, then `/plugin install vibehost@gntc-labs`. In Codex: `codex plugin marketplace add gntc-labs/skills`, then `codex plugin add vibehost@gntc-labs`.

## Data handling

### What the plugin reads and stores

- **Your VibeHost account.** Signing in (MCP OAuth, or `vibehost login` for the CLI) lets the skills read your workspaces and apps. The skills never ask for or type a password.
- **The files you deploy.** `vibehost-deploy` uploads the folder you point it at, and the two games upload the site they build. VibeHost hosts it at a URL in your workspace.
- **Pumpkin patch.** The patch name, the owner's name and the welcome note you give are written into the published page. Pumpkins that visitors grow and carve are not stored anywhere: each one lives inside its own link.
- **Haunted farm.** Each teammate's farm name, link name, avatar choice and scarecrow colour, and, only if they choose to make one, a 24×24 pixel face and crop skins, are stored in the village's VibeHost App Data. Every member of the workspace who can open the village sees them.
- **Local files.** The skills write their working files (`patch.json`, `village.json`, `vibehost.json`, the built `site/`) to a folder in your current directory, or `~/pumpkin-patches/` for the pumpkin patch. The VibeHost CLI keeps its sign-in in its own config; the skills don't read it.

### Services the plugin talks to

Besides the declared MCP server, the skills reach these services:

| Service | When | What is sent |
| --- | --- | --- |
| VibeHost (`api.vibehost.com`, `app.vibehost.com`) via the `vibehost` CLI | When the CLI is used instead of MCP | The same requests as the MCP tools: sign-in, app settings, deploys. |
| VibeHost upload URLs | During a deploy | Each file's bytes, to the pre-signed URLs that VibeHost's `request_upload` returns. |
| Published sites (`*.vibehost.space`, or the app's own domain) | After a deploy, and when joining a haunted village | Plain `GET` requests to check the site is live and to read the village's rules. |
| `vibehost.com/install.sh` | Only when the VibeHost CLI isn't installed and the MCP tools aren't available | Downloads the CLI installer. The installer sends an anonymous install beacon (platform, shell version, success or failure); set `VIBEHOST_NO_TELEMETRY=1` to turn it off. |
| Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) | When the games render their link-preview images, and in visitors' browsers when they open a published page | Font requests. For a pumpkin patch whose name, owner or welcome note is written in a non-Latin script (Chinese, Japanese, Thai, …), the request carries those characters (`?text=`) so Google Fonts returns only the glyphs used. |
| npm registry and Playwright's download host | When a game builds: `npm i playwright-core` (about 5 MB), which drives the Google Chrome already installed. Only if there is no Chrome: `npx playwright-core install --only-shell chromium` | Package downloads. Nothing from your project is sent. |

### Retention

VibeHost keeps what you deploy, App Data included, for as long as your workspace is active, subject to the retention rules the workspace sets: deployments stay until you delete them or close the workspace. Deleted deployments are kept in encrypted backups for as long as rollback needs them, then purged. See the [privacy policy](https://vibehost.com/privacy) for the details.

## License

MIT, see [LICENSE](../../LICENSE).
