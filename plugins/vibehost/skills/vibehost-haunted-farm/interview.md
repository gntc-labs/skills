# Interview and quality rules (vibehost-haunted-farm)

## Talking to the creator

- Chat in the creator's language. The page stays English; the village name is kept exactly as typed.
- **Questions:** in Claude Code, AskUserQuestion when there are options; free text (a name) in plain text. Elsewhere, a short **numbered** list.
- One turn for the Step 2 questions (plus the workspace question when it applies), one for the Step F farm questions.
- **Farm questions:** farm name (≤ 30 characters), link name (the derived one as option 1), avatar 1–6 (`open <skill-dir>/art/avatars/` first), scarecrow colour (classic · plum · moss · bone · blood · spirit). Then, only if the village allows them, "your own face?" and "your own look for a pumpkin variety?", both default no.
- **A joiner with a village link** (at most 4 questions):
  1. *Only if not a member yet:* "Shall I join *<workspace>* for you?" (joinable) or "Tell me when you've accepted the invite" (not-member).
  2. **Farm name** — "<first name>'s Pumpkin Patch" as option 1; say the link name it makes.
  3. **Avatar 1–6**, or "your own face?" when allowed.
  4. **Scarecrow colour**, plus "your own look for a pumpkin variety?" when allowed.
- **Keep moving.** Only two moments wait for the creator: the roll and the preview GATE.

| The creator says | You do |
|---|---|
| "you choose" | Name → rolled default; visibility → `workspace`; roll → keep. For a farm: "<first name>'s Pumpkin Patch" (or "My Pumpkin Patch"), the derived link name, avatar 1, classic. Say what you took in one line. |
| A different theme / weather | The dice decide; offer the re-roll if unused. Otherwise final. |
| `private` | One line: only its admins could open it, so nobody could join. Offer `workspace`. |
| Add a password | One line: every teammate would have to type it first, and Free has no app passwords. Run no password command. |
| A link name with capitals, spaces or accents | Offer the cleaned one (`setup-link.mjs` without `--slug` prints it). |
| "My link name is taken" | Pick another in the page's form, or give you one for a new link. |
| "Make me a face / pumpkin like …" (rule on) | `pixelate.mjs` or `pixel-grid.mjs`, show it, then `setup-link.mjs --avatar-png / --skins`. Chunky: 24×24 faces, 32×32 crops, 16 colours. |
| "Turn off crop skins" / "bigger field" / "expansion costs 50" | Deployers only: `village-rules.mjs --set …`, rebuild, redeploy. Fields top out at 4×4. |
| "Can more friends play?" | Players are workspace members. Free fits 3; Business the whole team. Invite in the dashboard (`deploy.md` §3). |

## The project folder

Lives in the current directory, or in `~/haunted-farms/` (say so in one line) when the current directory is in a git work tree or holds a `package.json`. It starts as `haunted-farm-new/` and becomes `haunted-farm-<slug>/` once the app exists (Step 4).
- `village.json` — the roll, the creator's answers, your tagline (the only file you edit)
- `site/` — built by `build.mjs`; exactly what gets published. Never edit by hand.
- `preview/` — `check.mjs` screenshots
- `vibehost.json` — written when the app is created
- `node_modules/` — `playwright-core` only, for check.mjs

`<skill-dir>` is the folder holding SKILL.md; `roll.mjs`, `build.mjs`, `check.mjs` and the other scripts run from there, called from the project folder (check.mjs finds its `playwright-core` there).

## Showing things

- Before publishing the creator sees **PNG screenshots only**; never open an HTML file for them.
- Actually `open` (macOS) / `xdg-open` (Linux) what you show, and paste the paths too.

## Tone (tagline)

- English, playful, family-friendly, specific to the theme and weather. ≤ 80 characters.
- No real people, brands or places; no gore; nothing about real deaths, illness, disability, ethnicity or religion. Don't mention VibeHost.
