---
name: vibehost-haunted-farm
description: Use when someone wants a Halloween "haunted farm" for their team — a pixel-art village map where every teammate has a house and a 3×3 farm on its own link, growing pumpkins in real time and neighbours can steal unharvested ones (Trick or Treat!). The first teammate's run creates the village; everyone else's run just sets up their farm in it — also when they paste a village link ("join my village https://…"). Every village is rolled with dice. Runs in a CLI agent (Claude Code, Codex) and publishes on VibeHost, using the platform's App Data so the whole team shares one village.
---

# Haunted Farm

A workspace has **exactly one** haunted village (one VibeHost app). Its front page is the **village map**: each farmer has a house there and a plot on its own link (`/farm/<slug>`). The map holds 8 houses per **district**; a newcomer takes the first free lot from district 1 up, farmer 9 opens district 2, and settled farmers never move. Stealing works across the whole village. The first run in a workspace rolls and publishes the village; every later run only sets up a farm. There is no season and no end — only the daily caps reset, at midnight Taipei. The page states the timings itself (from the engine); quote it, don't restate it.

**Dice decide, you write the flavour.** Theme, weather of the week and the secret pumpkin come only from `roll.mjs`. Never pick or change them, never re-roll unless the creator asks. Your only creative part is the tagline.

**Who can play** is the platform's call: members of the app's VibeHost workspace. Free fits 3 farmers; Business lets the whole team in. Anyone else who can open the village watches read-only and is sent to `how-to-play.html` when they tap Play.

Read first: `interview.md` (talking, the project folder, screenshots), `deploy.md` (VibeHost, finding the village, publishing, hand-off).

## Step 0 — find the village (before the first question)

**Given a village link** ("join my village https://…", a forwarded invite) — a join, no workspace question:
1. Check the connection and sign-in (`deploy.md` §1), then `node <skill-dir>/find-village.mjs --url <link>`. It is read-only and prints one JSON line:
   - `member` → **Step F** right away, with `url` as the village.
   - `joinable` → "You can join *<workspace>* yourself — shall I?" On yes, run its `join` command, rerun `find-village.mjs`, then Step F.
   - `not-member` → "Accept the VibeHost invite in your email (on a company email, signing in may be enough). No invite? Ask whoever sent the link, or their admin. Tell me when you've accepted." Then rerun.
   - `not-a-village` → that app isn't a haunted village; ask for the right link.
2. Never create, roll or deploy anything on this path.

**Without a link:**
1. Check the connection and pick the workspace (`deploy.md` §1). Only its members can farm.
2. Find the village (`deploy.md` §1c): the app whose description contains **`[haunted-farm:village]`**.
   - **Found** → a **join**: Step F only. Don't roll, build or deploy. Several → join the oldest and say so.
   - **Not found** → a **create**: Steps 1–5, then Step F.
3. For a create, make the project folder (`interview.md`): `haunted-farm-new/`, and start `npm i playwright-core` there **in the background**.
4. A `haunted-farm-<slug>/` folder holding `vibehost.json` for the village you found = the creator's **return visit**. They may change the name or tagline (edit `village.json`, then Step 4 and redeploy, only if they ask; `"linkPreview": "yes"` in `vibehost.json` → update the preview too, `deploy.md` §2f). Never re-roll.

## Step 1 — roll (create; waits for the creator)

`node <skill-dir>/roll.mjs --out village.json`, then one short message in the creator's language:

> 🎲 Your village rolled: **Old Bell Schoolyard** · theme: **Haunted School** · weather of the week: **Fog Week** · and a **secret pumpkin** that grows from 1% of Legendary seeds. Seed `7f3a9c01`.
> Keep it, or use your one free re-roll?

Never name the secret pumpkin. Keep → final. Re-roll → once, shown the same way, then final. Never edit `seed`, `theme`, `weather` or `secret`.

## Step 2 — two questions (create; one turn)

1. "What should your village be called?" — the rolled `name` as option 1.
2. **Visibility** — `workspace` or `public`, worded as in `deploy.md` §2b. Never `private`.

Then once: **"Don't add a password — every teammate would have to type it before playing."** Never run a password command. Write `name` and `visibility` into `village.json`.

## Step 3 — tagline (create)

`tagline` in `village.json`: English, one line, ≤ 80 characters, about this theme and weather (tone in `interview.md`).

## Step 4 — build and check (create; GATE)

1. Signed in → create the app now (`deploy.md` §2c, **with the `[haunted-farm:village]` marker**), write `vibehost.json`, and rename the folder to `haunted-farm-<slug>/`.
2. From the project folder, once `npm i playwright-core` has finished: `node <skill-dir>/build.mjs --village village.json --out site/ --url <live url> --workspace <workspace-slug>` (the slug points the invite button at the members page; Playwright renders the village's own link-preview card, `site/og.png`).
3. From the project folder: `node <skill-dir>/check.mjs --site site/ --shots preview/` (the quick gate, about a minute; App Data is faked). It must exit 0 (a "generic card" failure: build again, now that Playwright is there). A text-length failure: shorten `village.json`, rebuild. Anything else: stop and report; never patch `site/`.
4. `open` `preview/phone-map.png`, `preview/desktop-map.png`, `preview/phone-bob-farm.png` and `site/og.png` (the link-preview card), look at them, then ask: "Happy with this? Say yes and I'll put it online."

## Step 5 — publish (create)

`deploy.md` §2: deploy `site/`, set the chosen visibility, check it's live, then the link-preview question for a `workspace` village (§2f). Then Step F for the creator, then the hand-off (§3).

## Step F — the farmer's own farm (create and join)

One turn (wording in `interview.md`):
1. **Farm name** (≤ 30 characters), e.g. "Maya's Pumpkin Patch".
2. **Link name** for `/farm/<link-name>`: 2–31 lowercase letters, digits or dashes. Offer the one `setup-link.mjs` makes from the farm name.
3. **Avatar 1–6** — `open <skill-dir>/art/avatars/` first.
4. **Scarecrow colour** — classic, plum, moss, bone, blood or spirit.

**Only if the village allows it** — `node <skill-dir>/village-rules.mjs --village village.json` (create) or `--url <village url>` (join; a `workspace` village may send it to the login page: then ask anyway, the page ignores what it doesn't allow). Same turn, both default no:

5. **Your own face?** (custom avatars) — a 24×24 face; avatar 1–6 stays the fallback.
6. **Your own look for a pumpkin variety?** (crop skins) — Common, Rare and/or Legendary; sprout, growing, ripe; 32×32. Cosmetic only.

Making them (`make-your-own/`; only the village's 16 palette colours survive, and the page checks every pixel):
- **With an image tool:** a chunky drawing on flat `#00ff00`, then `node <skill-dir>/make-your-own/pixelate.mjs --in drawing.png --size 24 --out face.png` (skins: `--size 32 --no-crop --out skins/<kind>-<stage>.png`).
- **Without one:** a grid of palette letters (legend in `pixel-grid.mjs`), then `node <skill-dir>/make-your-own/pixel-grid.mjs --in face.txt --size 24 --out face.png`.
- `open` the result first. Each ≤ 2048 data-URL characters, skins ≤ 12 KB in all; the scripts say when to simplify.

Then:
```bash
node <skill-dir>/setup-link.mjs --url <village url> --name "<farm name>" --slug <link-name> --avatar <1-6> --scarecrow <colour> [--avatar-png face.png] [--skins skins/]
```
It prints `<village>/setup#…`; the custom art rides in it. **Open it** and paste it: "Sign in to VibeHost if it asks — this link sets up your farm and your house pops up on the village map. Your farm's own link is `<village>/farm/<link-name>`." A taken link name → the page says so and shows its form. If they already have a farm, the page asks before replacing it.

A **join** ends here (plus §3's invite line if they're the only farmer). Never redeploy on a join.

## Changing the village rules (deployers only)

The rules — custom avatars, farm expansion (3×3 → 3×4 for 150 candy → 4×4 for 400) and crop skins, all on by default — are baked into the page from `village.json`. Only someone who can redeploy the app can change them:
1. `node <skill-dir>/village-rules.mjs --village village.json` shows them; `--set cropSkins=off`, `--set expansion=off`, `--set expansion.costs=100,300`, `--set expansion.maxCols=3` change them.
2. Rebuild with the same flags and redeploy (`deploy.md` §2). A rule turned off hides its button, setup questions and How to play card; stored art stays but isn't shown; a bought field shows as 3×3.
3. Can't deploy the app? Say so: a deployer has to do it.

## Try-out build (only when asked)

Where App Data isn't on yet ("The village is resting"), a **single-player try-out**: `build.mjs … --mock` (real time by default, like the village: a Common ripens in a minute; `--speed N` or `?speed=` runs the clock N times faster). Everything stays in that browser; the neighbours (Bob, Cleo, Dan, Eve) are pretend and a banner says so, with Reset. `?farmers=20` tries three districts. Never ship `--mock` as the real village, and say teammates can't play together on it.

## What you cannot promise

- The rules run in each player's browser (the server stamps time, versions, rate-limits and logs writes). Someone with devtools could cheat — it's a friends-only game.
- App Data is rolling out workspace by workspace. "The village is resting" means this workspace doesn't have it yet; say so, don't work around it.
- A farmer alone has no one to steal from (the tour lends a practice patch for its steal step, nothing more). Invite teammates.

## Red flags

| You're about to… | Instead |
|---|---|
| Create a second village in a workspace that has one | Find it by `[haunted-farm:village]`; Step F only. |
| Redeploy for a join, a custom face or a crop skin | Never — the setup link carries it. |
| Change rules for someone who can't deploy | Only a deployer can; rules aren't a player setting. |
| Ask for a face / skin the village turned off | Don't; `village-rules.mjs` says what's on. |
| Offer `private`, or add / suggest a password | `workspace` or `public`; the no-password line once. |
| Pick a theme or weather that "fits better" | Dice only; one re-roll. |
| Hand-edit `site/` | Edit `village.json`, rerun `build.mjs`. |
| Promise more than 3 farmers on Free | Free fits 3; Business lets the whole team in. |
| Host it anywhere but VibeHost | Never. App Data only exists there. |
