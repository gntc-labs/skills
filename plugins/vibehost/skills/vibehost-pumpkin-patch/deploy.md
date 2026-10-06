# Publishing on VibeHost

(Adapted for pumpkin-patch from the shared halloween-invite / halloween-menu publishing rules.)

**Hosting is VibeHost only.** Never use Vercel, Netlify, GitHub Pages, Cloudflare Pages, Surge, a local server, or "just open the HTML file". If VibeHost can't be set up, say what failed and stop. There is no fallback host.

The page lives on the creator's own VibeHost account. They sign up **at the end**, when they've already seen their page and want it online. Signing up is how they get it, not a hurdle at the door.

## 1. Start of the session: check, don't sign up yet

**a. Pick the connection.** Never ask the creator to install an MCP server or restart the session mid-flow. A newly added MCP server only loads in a new session, in Claude Code and in Codex alike.

| Already available in this session | Use |
|---|---|
| VibeHost MCP tools (`list_workspaces`, `create_app`, `request_upload`, `deploy` …) | **MCP** |
| Otherwise | **CLI**. If `vibehost --version` fails, install it now, quietly: `curl -fsSL -o vibehost-install.sh https://vibehost.com/install.sh && sh vibehost-install.sh && rm vibehost-install.sh` |

**b. Signed in already?** MCP: `list_workspaces` works. CLI: `vibehost whoami` works.
- **Yes:** list their workspaces (`vibehost workspace list` / `list_workspaces`). If there's more than one, **ask which one to use** (a numbered list, the active one first), even when one is marked active (`*`): the active one is just whatever they used last, not a choice for this page. Pass it as `--workspace <slug>` (CLI) or `workspace` (MCP) every time.
- **No:** say this one line with your first question, and nothing more about accounts until the publish step:
  > "When it's ready, I'll put it online on a free VibeHost account. It takes about a minute, and I'll walk you through it then."

  Don't open any VibeHost page now.

## 2. Create the app, then publish once

The app is created **before the build** when the creator is already signed in (SKILL.md Step 4), so the page is built once with its real address; it stays private until the deploy. Otherwise it is created at the publish step, right after sign-up. Sign-up itself only ever happens at the publish step, once the creator has seen the preview screenshots and said yes.

**a. Not signed in yet (CLI).**
1. Start `vibehost login` **in the background, with its output going to a file** (some agents, Codex among them, don't show output until a command ends, and this one waits for approval). Read the file. It prints `Device code: XXXX-XXXX` and an approval URL with the code filled in (`https://app.vibehost.com/activate?code=…`).
2. **Open that approval URL yourself**, then say, in one message:
   > "Your page is ready to go online. I've opened VibeHost for you: **Sign in with Google**, then press **Approve**. That's all, I'll take it from there. (Prefer email? Tap **Sign up** on that page.)"

   Also paste the URL and the code, in case the browser didn't open.
3. **Don't ask them to come back and type anything.** Watch for it yourself: the login command ends once they press Approve. Poll `vibehost whoami` every few seconds. As soon as it works, say "Got it, publishing now" and go on to 2c.
4. **The code expires after 10 minutes.** If it expires (the login command exits without success), they probably went the email route and are still verifying. Run `vibehost login` again and open the new approval URL. They're signed in by then, so it's one **Approve** click. Tell them in one line: "One more click: press Approve on the page I just opened."
5. If they're signed in now but have more than one workspace, ask which one (§1b).

**MCP, not signed in:** the first VibeHost tool call opens its own sign-in. Tell them: "I've opened VibeHost: sign in with Google (or sign up), then approve." If a call fails as unauthenticated, ask them to approve the browser prompt (Codex: `codex mcp login vibehost`).

Never ask for or type their password, and never pass `--email`/`--password` or use `vibehost register`. If sign-in fails, say what failed and stop. There's no fallback host.

**b. Name the app, and remember it.** The server only accepts app names matching `^[a-z][a-z0-9-]*$`, at most 40 characters (lowercase letters, digits and hyphens, **starting with a letter**). Don't derive it by hand: run `node <skill-dir>/slug.mjs --patch patch.json`, which prints `{"slug": …, "folder": …}`. Its rule: accents and other non-ASCII letters become plain letters where they have one, everything else becomes a hyphen; nothing left → `pumpkin-patch-<seed>`; starts with a digit → `pumpkin-patch-` in front; cut to 40 without a trailing hyphen.

| Patch name | Slug |
|---|---|
| `La Calabaza de Lucía` | `la-calabaza-de-lucia` |
| `899 的南瓜田` | `pumpkin-patch-899` |
| `南瓜田` | `pumpkin-patch-<seed>` |
| `2026 Patch` | `pumpkin-patch-2026-patch` |

If `app create` fails with `VALIDATION_FAILED`, or says the name is taken in this workspace, run `slug.mjs --patch patch.json --taken <the slug that failed>` (it adds `-2`, `-3`, …) and retry with what it prints. Never invent another format. As soon as the app is created, write `vibehost.json` in the project folder:
`{"workspace": "<ws>", "slug": "<slug>", "appId": "<id>", "url": "<live url>"}`
Every later run **reads this file and redeploys to the same app**. Never create a second app for the same page.

**The live URL** is `https://<fqdn>`, with `fqdn` taken from the create result when it has one (CLI `--json`: `data.fqdn`; MCP `create_app`: the app's `fqdn` / `url`). If the result has none, it is always `https://<slug>-<workspace-slug>.vibehost.space`.

**c. Deploy.** Upload only `site/`. It holds exactly what guests should see. Drafts, previews, source photos and screenshots live elsewhere in the project folder.

With MCP:
1. Create the app (SKILL.md Step 4, or right after sign-up): `create_app {workspace, name: <slug>, displayName: "<patch name>", visibility: "private"}`. The workspace slug comes from `list_workspaces`. Read the URL from the result (see §2b) and write `vibehost.json`. Then build and check; the rest runs once the creator said yes.
2. For every file in `site/`, hash the **original bytes**: `shasum -a 256 <file>` and the size in bytes. Never re-encode images or photos.
3. `check_blobs_missing {shas}` returns only the files the server doesn't already have.
4. `request_upload {appId, shas: <missing>}` returns one signed URL per sha. PUT each file's raw bytes:
   `curl -fsS -X PUT -H "Content-Type: application/octet-stream" --data-binary @<file> "<url>"`
   The URLs expire in 5 minutes, so upload right away.
5. `deploy {appId, manifest: [{path, sha256, size}, …]}`. Every file must be in the manifest, including files that weren't missing. Expect `status: "healthy"`.
6. `set_app_visibility {appId, visibility: "public"}`. Guests have no VibeHost account. Keep it `private` or `workspace` only if the creator asks.

(Can't PUT, as in a tool-call-only client like ChatGPT? Then text files go through `create_file` + `deploy` with no manifest, and **images can't be uploaded at all**. Only the flows that need no images work there.)

With the CLI:
```bash
# create the app (SKILL.md Step 4, or right after sign-up), then build and check
vibehost workspace use <workspace-slug>      # needed once for a brand-new account: whoami shows the workspace, but nothing is "active" yet
vibehost --json app create <slug> --display-name "<patch name>" --description "Grow a pumpkin, carve it, send it."
                                             # private until the deploy; read data.fqdn (§2b) and write vibehost.json
# once the creator said yes: one deploy
vibehost deploy site --app <slug>            # don't use `vibehost link`: it needs a team, and new accounts have none
vibehost app visibility <slug> public
```
Every later deploy is `vibehost deploy site --app <slug>`, with the slug read from `vibehost.json`. On a return visit where the patch name changed, also run `vibehost app update <slug> --display-name "<new patch name>"` (the slug itself never changes).

**d. Link preview.** Handled by `brand.mjs` and `vibehost app og set` as described in SKILL.md Step 5. Whenever the preview changes, tell them in one line: "Chat apps cache link previews, so the new card can take up to a day to show in LINE, Facebook or WhatsApp."

**e. Check it's live.** `curl` the live URL and every image, and expect 200 (a 302 to a login page means the app isn't public yet).

## 3. Hand-off: always open their dashboard for them

Get the workspace slug from `vibehost.json`, `vibehost whoami --json` (`data.workspace.slug`) or `list_workspaces`. Then **run `open` on both pages yourself** (printing them isn't enough; if the sandbox blocks `open`, ask for approval for it), and **paste both URLs** as well, in case `open` didn't work:

1. **App page:** `https://app.vibehost.com/workspace/<workspace-slug>/apps/<slug>`. This is where the QR code is.
2. **App settings:** `https://app.vibehost.com/workspace/<workspace-slug>/apps/<slug>/settings`. The link-preview image, the VibeHost badge, and their own domain (a Business feature).

Also `open` the `brand/` folder. Then, in one message:
- the live link
- "I've opened your VibeHost dashboard. Your QR code is on the app page: tap the ▾ next to **Visit**." Call it "your QR code", nothing more specific.
- "The second tab is this page's settings: the link-preview image, the badge, and your own domain."
- "Your images are in the `brand` folder: `og.png` is what people see when you send the link, `og-square.jpg` is for posting, and `deed.png` is your patch's deed."
- "Bookmark it: this is where you'll come back to edit or update your page."

**Don't generate a QR code yourself.**

## 4. No logo step

Pumpkin patches don't take a logo. Never edit `site/` by hand; any change goes through `patch.json` and `build.mjs`.
