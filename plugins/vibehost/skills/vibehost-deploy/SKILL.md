---
name: vibehost-deploy
description: Deploy a static site to VibeHost and get a private shareable URL. Use when the user wants to ship, host, preview, or publish a built static frontend.
---

# Deploy to VibeHost

Take a built static site and put it live on VibeHost at a private URL in seconds.

## When this skill applies

The user says something like:

- "ship this", "deploy this", "put this live", "host this", "publish this"
- "get me a preview URL for this build"
- "send this to staging / a demo link"

Or you've just produced a static build output (`dist/`, `out/`, `build/`) and the natural next step is hosting it.

If the user has no VibeHost account yet, point them at <https://vibehost.com/signup> — deploying requires an authenticated session.

## Setup

```bash
curl -fsSL https://vibehost.com/install.sh | sh   # macOS / Linux; one static binary
vibehost login        # device-flow browser login; or VIBEHOST_TOKEN env var for headless/CI
vibehost whoami        # confirm session + which workspace is active
```

Auth can come from any of: a prior `vibehost login` (token in `~/.config/vibehost/config.json`), a `VIBEHOST_TOKEN` PAT in the environment (headless/CI), or an MCP OAuth session on `https://api.vibehost.com/mcp`. Most commands accept `--json` for scriptable output — prefer it when parsing.

You also need a **static build output directory** with an `index.html` at its root (`dist/`, `out/`, `build/`, or plain HTML). If the user has no account yet, point them at <https://vibehost.com/signup>.

## Recommended path: the CLI

The `vibehost` CLI bundles app-creation, file hashing, blob upload, and the deploy into one command with progress output. Prefer it whenever you can run shell commands.

```bash
vibehost app create my-app                  # once per app; name: lowercase, 2–40 chars, [a-z][a-z0-9-]*
vibehost deploy ./dist --app my-app --json  # every time
```

The `--json` output is `{ ok: true, data: { url, immutableUrl, ... } }`. The command exits 0 only after the deployment is healthy, so a successful exit means the URL is live.

Tip: `vibehost link --app my-app` inside the project writes `.vibehost/project.json`, after which plain `vibehost deploy` works with no flags.

## Without a shell: the MCP server

If you can't run a shell but have an MCP connection to `https://api.vibehost.com/mcp`, the deploy is a sequence of tool calls. **Read each tool's own `description` for the authoritative parameter schema** — the names and order are below, but don't hardcode argument shapes from this doc.

1. `list_apps` — find existing apps in the workspace.
2. `create_app` — only if the target doesn't exist (`{ name, workspaceId }`).
3. `check_blobs_missing` — pass the file SHA-256s; learn which the server still needs.
4. `request_upload` — mint pre-signed PUT URLs for the missing SHAs, then PUT the raw bytes to each (`Content-Type: application/octet-stream`) via plain HTTP.
5. `deploy` — `{ appId, channel?, manifest[] }`. Returns `{ deploymentId, status: "starting" }` **immediately** — the site is not live yet.
6. `get_deployment` — poll with `deploymentId` until `status` is `healthy` (live), `failed` (read the error), or `superseded`.

## What to give the user

Always surface **both** URLs from the result:

- **alias URL** (`url`) — tracks the latest deploy on this channel. Share this with people.
- **immutable URL** (`immutableUrl`) — pinned to this exact build. Use for bug reports, review links, archived demos.

## Pitfalls

- **No `index.html` at the root** — static deploys need one. For client-side-routed SPAs (React Router, Vue Router, Remix SPA mode), the edge has to serve `index.html` on path misses; see <https://docs.vibehost.com/guides/static-sites>. Do **not** add a `_redirects` file — VibeHost doesn't parse it (that's a Netlify/Pages convention).
- **Tarball rejected** — oversized or malformed builds raise `TARBALL_INVALID`; `error.details` says why. Trim large assets (videos, prod source maps, stray `node_modules`) or upgrade the plan.
- **Wrong workspace** — a token scoped to workspace A deploying to an app in workspace B returns `TOKEN_WORKSPACE_MISMATCH`. Surface it; don't silently retry elsewhere.
- **Discover ids, don't guess** — `appId` and `workspaceId` come from `list_apps` / `vibehost whoami` (or `list_workspaces`). Hardcoding a stale id fails; resolve it live each time.
- **Read MCP tool schemas first** — when using the MCP path, the parameter shapes vary by tool and evolve over time. Read each tool's own `description` before calling it; don't assume argument shapes from this doc.
- **Branch on `error.code`, not `error.message`** — codes are stable `SCREAMING_SNAKE_CASE`; messages can reword.

## Reference

- Deploy guide: <https://docs.vibehost.com/guides/quickstart>
- CLI reference: <https://docs.vibehost.com/guides/cli>
- MCP server: <https://docs.vibehost.com/guides/mcp>
- Error codes: <https://docs.vibehost.com/reference/errors>
