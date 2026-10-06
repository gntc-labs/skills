---
name: vibehost-pumpkin-patch
description: Use when someone wants their own Halloween pumpkin patch online — a playful page where friends grow a random pumpkin (with rarity), carve it into a jack-o'-lantern, light it and send it on as a link. Every patch is rolled with dice, so no two are alike. Runs in a CLI agent (Claude Code, Codex) and publishes on VibeHost (MCP or CLI).
---

# Pumpkin Patch

You roll a one-of-a-kind pumpkin patch for the creator, let them name it, write its little bits of story, build it from the template, check it, and publish it on VibeHost. Visitors to the patch grow a pumpkin, carve it, light it and send it to a friend, who can carve one back.

**Core principle: dice decide, you write the story.** Scene, weather, quirk, signature pumpkin and the patch's secret pumpkin come only from `roll.mjs`. Never pick or change them yourself, and never re-roll without the creator asking. Your only creative part is the tagline and the pumpkin blurbs (Step 3).

Read before starting:
- `interview.md`: how to talk to the creator, the project folder, showing screenshots, tone
- `deploy.md`: VibeHost only, MCP first, a one-line heads-up at the start, sign-up only at the publish step, preview image, the dashboard hand-off

## Step 0 — set up (before the first question)

1. Check the VibeHost connection (`deploy.md` §1). Not signed in: say the one heads-up line with your first question. Don't open any sign-up page yet. Signed in with more than one workspace: ask which one together with the Step 2 questions.
2. Pick where the patch lives: the current directory, unless it is inside a git work tree (`git rev-parse --is-inside-work-tree` succeeds) or holds a `package.json`; then use `~/pumpkin-patches/` (create it) and tell the creator in one line: "I'll keep your patch in ~/pumpkin-patches/." Make the working folder `pumpkin-patch-new/` there. Inside it, start `npm i playwright-core` **in the background** (about 5 MB; it drives the Google Chrome already on the computer, so no browser download) and copy in `<skill-dir>/check.mjs`. Go on with Step 1 while it installs.
   Only if `brand.mjs` or `check.mjs` later says no browser could start (no Google Chrome on this computer): run `npx playwright-core install --only-shell chromium` in the folder (headless shell only, about 100 MB) and run the script again. Never install full Chromium.
3. If the current directory or `~/pumpkin-patches/` already holds a `pumpkin-patch*/` folder with `vibehost.json` and `patch.json`, this is a **return visit** (more than one: ask which, as a numbered list with each patch's name): ask what to change (name, owner, welcome note, tagline, blurbs, showcase pumpkin), edit `patch.json`, and go to Step 4 (the app already exists: use the URL in `vibehost.json`). Never re-roll an existing patch.

## Step 1 — roll the patch (waits for the creator)

Run `node <skill-dir>/roll.mjs --out patch.json` in the working folder. Show the result in one short message in the creator's language, as text (no image yet), for example:

> 🎲 Your patch rolled: **Moonlit Graveyard** · weather: **Full Moon** (Legendary pumpkins twice as likely!) · quirk: **Waving Vines** · signature pumpkin: **Jarrahdale** (1.5× as likely here) · and a **secret pumpkin** only this patch can grow (1%). Seed `7f3a9c01`.
>
> I'm keeping the secret pumpkin's name hidden. It's a surprise for whoever grows it first.
> Keep it, or use your one free re-roll?

- Keep → the roll is final from here on.
- Re-roll → run `roll.mjs --out patch.json` once more, show it the same way, and continue with it. That was the only re-roll.
- Anything else (a second re-roll, "make it a graveyard", "can I have the giant?") → see the table in `interview.md`.
- Never edit `seed`, `scene`, `event`, `quirk`, `signature` or `secret` in `patch.json`.

## Step 2 — three questions (one turn), then the deed

1. "What should your patch be called?" Offer the rolled default `name` from `patch.json` as option 1.
2. "Whose patch is it? It shows as '<name>'s patch', and every pumpkin shared from it says 'Grown in <name>'s patch'. Leave it blank to stay anonymous."
3. "Want to leave a short welcome note for visitors (up to 120 characters)? It shows on the front page, signed with your name. Skip it if you like."

Write the answers into `patch.json` (`name`, `owner`, `welcome`), exactly as typed. If the name already contains the owner's name (e.g. owner "899", name "899 的南瓜田"), say in one line how it will read: shared pumpkins say "Grown in 899 的南瓜田" (no "899's" in front, and no "899's pumpkin patch" line over the title). Don't rewrite their answer. A welcome note over 120 characters: ask them to shorten it, don't cut it yourself. Work out the slug and the folder name with `node <skill-dir>/slug.mjs --patch patch.json` (`deploy.md` §2b) and rename the working folder to the `folder` it prints (`pumpkin-patch-<slug>`, or the slug itself when it already starts with `pumpkin-patch`; moving it with `node_modules` inside is fine).

Now make the creator's **land deed**, once (a few seconds): `node <skill-dir>/brand.mjs --patch patch.json --out brand/ --only deed`, then `open brand/deed.png` and show it in one line ("Here's your patch's deed."). It shows the name, the owner, the scene, weather, quirk, signature pumpkin, a locked secret and the seed: the moment the patch becomes theirs. Don't render it again later unless they change the name or owner.

## Step 3 — write the story (your only creative part)

Fill into `patch.json`, in English, following the tone rules in `interview.md`:
- `tagline`: one line, ≤ 80 characters, about this patch's scene + weather + quirk.
- `blurbs`: one line per pumpkin variety listed in `patch.json`, ≤ 60 characters each, funny and specific to that pumpkin. The signature pumpkin's line says it loves this patch. Also write one for this patch's own `secret` (the key is the `secret` id in `patch.json`); make it feel like a rare find.

## Step 4 — build and check (GATE, waits for the creator)

1. **The live URL first**, so the page is built once with its real link-preview address. Signed in: create the app now, private (`deploy.md` §2c, "Create the app"), and read its URL; write `vibehost.json`. Not signed in: skip this; the page is built without `--url` now and rebuilt with it in Step 5 (build.mjs only, under a second).
2. `node <skill-dir>/brand.mjs --patch patch.json --out brand/ --only og,icons` (link-preview image and icons; the deed is already made), then `node <skill-dir>/build.mjs --patch patch.json --out site/ --brand brand/ --url <live url>`.
3. `node check.mjs --site site/ --shots preview/`. Tell the creator in one line it takes about half a minute. It prints each check as it finishes (`[n/N] PASS …`) and must exit 0. If it fails on text length, shorten the text in `patch.json` and go back to 2. Any other failure: stop and report it; don't patch `site/`.
4. Run `open` on `preview/phone-landing.png`, `preview/phone-grow-reveal.png`, `preview/phone-carve-lit.png` and `preview/desktop-landing.png`, look at them yourself, then ask: "Happy with this? Say yes and I'll put it online." Changes they ask for go into `patch.json` (name, owner, welcome, tagline, blurbs only), then back to 2 (a new name or owner: also re-render the deed).

## Step 5 — publish (one deploy)

Follow `deploy.md` §2: sign-up if needed. If the app wasn't created in Step 4 (they weren't signed in), create it now, read its URL, rerun `build.mjs ... --url <live url>` and `check.mjs` (no need to show the screenshots again). Then:
1. Deploy `site/` to the app `<slug>` and set it `public` (visitors have no VibeHost account).
2. Set the platform preview: `vibehost app og set <slug> --title "<patch name>" --description "Grow a pumpkin and carve it for a friend." --image brand/og.png`. This replaces the share cards in `deploy.md` §2d for this skill.
3. Live check: `curl -I` the page, `og.png`, `favicon.ico`, `apple-touch-icon.png` and `site.webmanifest`, all 200. A 302 means the app isn't public; a private app gets no link previews in chat apps.
4. Hand off with §3, also `open brand/` and point to `brand/og-square.jpg` for posting. One line: "Chat apps cache link previews, so a new preview can take up to a day to show."

## Step 6 — the owner's showcase pumpkin (optional, after publishing)

In the hand-off message, add:
> "Want to carve the first pumpkin in your patch? Send me its link once it's lit and I'll put it on your front page. Your carving also becomes a stencil visitors can use."

If they send a link: `node <skill-dir>/build.mjs --patch patch.json --out site/ --brand brand/ --url <live url> --showcase '<the link>'`. A showcase carved with the owner's own stencil is refused: ask them to carve it freehand or with a built-in stencil. Changing the showcase later makes old links that used the owner stencil open to a polite fallback. If it's rejected, tell them what the error says in one friendly line (usually the link was cut short, or it was carved in a different patch) and ask for the link again. If it's accepted: run `node check.mjs --site site/ --shots preview/ --showcase` (landing, showcase and file checks only, about 10 seconds), `open` `preview/phone-landing.png`, then redeploy to the app in `vibehost.json`. If they don't send one, don't ask again.

## What you cannot promise

- Pumpkins are **not stored anywhere**. Each pumpkin lives entirely inside its link.
- There's no leaderboard or visitor counter inside the patch.

## Red flags

| You're about to… | Instead |
|---|---|
| Pick a scene or pumpkin because it "fits the creator better" | Dice only. One re-roll, then it's final. |
| Re-roll silently before showing the result | Show every roll. |
| Write the tagline in the creator's language when it isn't English | Page text is English; chat in their language. |
| Hand-edit anything in `site/` or `brand/` | Change `patch.json` and rerun brand.mjs / build.mjs. |
| Host it anywhere but VibeHost | Never. See `deploy.md`. |
