# Interview and quality rules (pumpkin-patch)

## Talking to the creator

- Chat in the creator's language. The page itself stays English (tagline, blurbs, UI); the patch name and owner name are kept exactly as the creator typed them, accents and all.
- **Asking questions:** in Claude Code, use the multiple-choice question tool (AskUserQuestion) when there are options to pick from; free-text answers (a name) go in plain text. In Codex, or anywhere without the tool, write a short **numbered** list.
- Batch questions into one turn where that's natural (the two Step 2 questions, plus the workspace question from `deploy.md` §1b when it applies).
- **Keep moving.** After each answer, go straight to the next step. Only two moments wait for the creator: the roll ("keep or re-roll?") and the preview GATE ("happy with this?").

| The creator says | You do |
|---|---|
| "you choose" / "whatever" / "go" | Patch name → the rolled default. Owner → leave blank. Roll → keep it. Say what you took, in one line. |
| Skips a question | Same as "you choose". |
| Asks for a different scene, weather, quirk or pumpkin | Explain kindly that the dice decide, which is what makes the patch theirs. If they haven't used their re-roll yet, offer it (a re-roll changes everything, not just that one thing). If they have, the patch is final. Never edit the roll. |
| Asks for a second re-roll | The patch is final. One friendly line, then continue. |
| Answers questions you haven't asked yet | Keep those answers and skip those questions. |

## The project folder

`pumpkin-patch-<slug>/` (the `folder` that `slug.mjs` prints) in the current directory, or in `~/pumpkin-patches/` when the current directory is inside a git work tree or holds a `package.json` (a patch never lands inside someone's project; say where it went in one line). Return visits look in both places.
- `patch.json` — the roll plus the creator's answers and your story text (the only file you edit)
- `site/` — built by `build.mjs`; this is exactly what gets published. Never edit it by hand.
- `preview/` — `check.mjs` screenshots
- `brand/` — deed, link-preview images and icons (made by `brand.mjs`); `deed.png` and `og-square.jpg` are the owner's and never go into `site/`
- `vibehost.json` — written as soon as the app is created
- `node_modules/` — `playwright-core` only (it drives the installed Google Chrome)

`<skill-dir>` is the folder this skill's SKILL.md is in. `roll.mjs`, `brand.mjs` and `build.mjs` run from there by path. `check.mjs` is **copied into the project folder** first, so it finds the project's `playwright-core`.

## Showing things

- **Never open an HTML file for the creator** (`site/index.html`, any `file://` page). Before publishing they see **PNG screenshots only**; the first page they open in a browser is the live VibeHost link.
- **Actually run `open`** on the screenshots you show (macOS `open`, Linux `xdg-open`). Printing a path doesn't count. If the sandbox blocks it, ask for approval for that one command, and still paste the path.
- Never hand over a `/tmp` or `/private/tmp` path; everything lives in the project folder.

## Tone of your writing (tagline and blurbs)

- English, playful, family-friendly. Specific to this patch: weave in its scene, weather and quirk.
- Never joke about death of real people, illness, disability, ethnicity or religion. No real people, brands or places. No gore. No promises about prizes.
- Don't mention VibeHost; the page already credits it.
