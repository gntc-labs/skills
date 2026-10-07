# Publishing on VibeHost (vibehost-haunted-farm)

**Hosting is VibeHost only** — the game needs VibeHost App Data (`/__vh/data/*`), which no other host has. Never use another host, a local server or "just open the HTML file". If VibeHost can't be set up, say what failed and stop.

## 1. Start of the session

**a. Connection.** VibeHost MCP tools already in this session (`list_workspaces`, `create_app`, `request_upload`, `deploy` …) → use them. Otherwise the CLI; if `vibehost --version` fails, install it quietly: `curl -fsSL -o vibehost-install.sh https://vibehost.com/install.sh && sh vibehost-install.sh && rm vibehost-install.sh`. Never ask the creator to add an MCP server or restart mid-flow.

**b. Signed in?** (`vibehost whoami` / `list_workspaces` works)
- **Yes:** list the workspaces (`vibehost workspace list`). More than one → **ask which**, the active one first — **only that workspace's members can farm**. Pass `--workspace <slug>` (MCP: `workspace`) every time.
- **No:** say once, with your first question: "When it's ready, I'll put it online on a free VibeHost account — about a minute, I'll walk you through it then." Sign in at publish time (§2a). A joiner signs in now, the same way.

**c. Find this workspace's village.** (Given a village link? `find-village.mjs --url` does this — SKILL.md Step 0.)
```bash
vibehost workspace use <workspace-slug>
vibehost --json app list
```
The village is the app whose `description` contains **`[haunted-farm:village]`**. Its live URL is `https://<fqdn>` (no fqdn → `https://<name>-<workspace-slug>.vibehost.space`).
- **Found** → a join: SKILL.md Step F only. Don't roll, build, deploy or change visibility.
- **More than one** → join the **oldest** (earliest `createdAt`) and say so: "Found two villages; joining the older one, *Hollow Graves Village*."
- **None** → a create: SKILL.md Steps 1–5, then Step F.

## 2. Sign in, create, deploy

**a. Signing in (CLI).**
1. Run `vibehost login` **in the background with its output going to a file** (it waits for approval; some agents show nothing until a command ends). The file shows `Device code: XXXX-XXXX` and an approval URL (`https://app.vibehost.com/activate?code=…`).
2. **Open that URL yourself** and say: "I've opened VibeHost for you: **Sign in with Google**, then press **Approve**. (Prefer email? Tap **Sign up** on that page.)" Paste the URL and code too.
3. Don't ask them to come back: poll `vibehost whoami` every few seconds; when it works, say "Got it" and carry on.
4. The code expires after 10 minutes. If login exits without success, run it again and open the new URL ("One more click: press Approve").

MCP: the first tool call opens its own sign-in ("sign in with Google, then approve"; Codex: `codex mcp login vibehost`). Never ask for or type a password; never pass `--email`/`--password` or use `vibehost register`.

**b. The visibility question** — exactly two options, `workspace` first:
1. **Workspace (recommended)** — "Only your teammates see the village, and everyone who opens it can play."
2. **Public** — "Anyone with the link can watch; only your teammates can play. Everyone else sees the village and a page explaining how to get their own."

Never offer `private`. Say once: "Don't add a password — every teammate would have to type it before playing." **Never run `vibehost app password` or any password tool.**

**c. Create the app** (SKILL.md Step 4, before the build, so the page knows its address). Slug: `^[a-z][a-z0-9-]*$`, ≤ 40 characters — the village name lower-cased, accented letters to plain ones, anything else → `-`, no leading digit or trailing `-`; nothing usable → `haunted-farm-<seed>`; taken → `-2`, `-3`.
```bash
vibehost --json app create <slug> --runtime static --display-name "<village name>" --description "A haunted farm village for our team. [haunted-farm:village]"
```
Live URL: `https://<data.fqdn>` (fallback above). The description **must** keep the marker — it is how every teammate's run finds the village. If it's lost, restore it: `vibehost app update <slug> --description "… [haunted-farm:village]"`.

Write `vibehost.json`: `{"workspace": "<ws>", "slug": "<slug>", "appId": "<id>", "url": "<live url>"}`. Later runs redeploy to this app; never create a second.

**d. Deploy** (after the creator said yes). CLI:
```bash
vibehost deploy site --app <slug>            # not `vibehost link`
vibehost app visibility <slug> workspace     # or public, as chosen
```
MCP:
1. `create_app {workspace, name: <slug>, displayName, description: <with the marker>, visibility: "private"}`.
2. For every file in `site/`: `shasum -a 256 <file>` and its size in bytes (hash the original bytes; never re-encode).
3. `check_blobs_missing {shas}` → the files the server lacks.
4. `request_upload {appId, shas: <missing>}` → one signed URL each; within 5 minutes: `curl -fsS -X PUT -H "Content-Type: application/octet-stream" --data-binary @<file> "<url>"`.
5. `deploy {appId, manifest: [{path, sha256, size}, …]}` with **every** file. Expect `status: "healthy"`.
6. `set_app_visibility {appId, visibility: <their choice>}`.

**Rules changed** (SKILL.md "Changing the village rules"): rebuild, then the same deploy. Only a deployer or admin of the app can; if refused, say who has to do it.

**e. Check it's live.**
- `curl -s -o /dev/null -w '%{http_code}' <live url>/` → `200` (public) or `302` to the login page (workspace — curl isn't signed in).
- `curl -s -o /dev/null -w '%{http_code}' <live url>/__vh/data/sdk.js` (it answers without a session, for `workspace` and `public` villages alike):
  - `200` → App Data is on.
  - `404` → App Data isn't on for this workspace yet; the page says "The village is resting". Tell the creator in one line: it's rolling out, and the village wakes up by itself — no redeploy. Don't work around it.

**f. Link previews (a `workspace` village).** Its pages are private, so Slack, LINE or Facebook can't read them and show VibeHost's own card — unless the app's preview override is set. Ask once, in one line, default yes: "Link previews (Slack, LINE…) can show *<village name>* and its tagline to anyone who has the link, even outside your team. OK?"
- **Yes** → after the **last** deploy of this session: `vibehost app og set --app <slug> --title "<village name> · Haunted Farm" --description "<tagline>" --image site/og.png`. If it fails with `PLAN_LIMIT_EXCEEDED` (Free can't upload a picture; that's a Business feature), run it again without `--image`: the title and tagline still apply, and the picture stays VibeHost's. Then: "Chat apps cache link previews, so the new card can take up to a day to show. If the preview reverts after a later redeploy, re-run `og set`."
- **No** → skip it, and say they can set it later (`vibehost app og show <slug>`, then the same `og set`).
- Write the answer into `vibehost.json` as `"linkPreview": "yes"` or `"no"`. A `yes` means: re-run the same `og set` after any later redeploy if the preview reverts, and always after the name or tagline changed (the new `site/og.png` carries the new name); don't ask twice.
- A `public` village needs none of this: scrapers read its own page, whose tags `build.mjs` writes. MCP only, no CLI: skip it and mention the dashboard (app settings → link preview).

## 3. Hand-off

`open` both pages and paste them:
1. **Members:** `https://app.vibehost.com/workspace/<workspace-slug>/settings` — the invite form.
2. **App page:** `https://app.vibehost.com/workspace/<workspace-slug>/apps/<slug>` (QR code: the ▾ next to **Visit**).

Then one message:
- the live link;
- "Invite teammates in the dashboard. Free fits 3 farmers; Business lets the whole team in.";
- "Each teammate sets up their own farm: they run this skill with the village link, or just open the village and fill in the form. Empty lots on the map open an invite card with a message to send.";
- `site/vibehost.json` holds the rewrites that make `/farm/*` and `/setup` work. Never delete it.
