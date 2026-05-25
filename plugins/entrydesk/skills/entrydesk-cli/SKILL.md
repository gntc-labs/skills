---
name: entrydesk-cli
description: Drive EntryDesk from the terminal — run AI tasks with models and agents, schedule agents, and call SaaS tools (Slack, GitHub, Google Drive, Gmail, Grafana, …) through one CLI. Use when the user wants to run a task on EntryDesk, automate an agent, open a shared task (entrydesk share URL), or reach a connected SaaS service.
---

# EntryDesk CLI

EntryDesk is a workspace for AI agents — run tasks against models, build and schedule agents, and reach connected SaaS tools. The `entrydesk` CLI exposes all of it from the terminal, so an agent can drive EntryDesk on the user's behalf. (A "task" is one AI conversation/run; the CLI verbs are `task` and `tasks`.)

## When this skill applies

- "Ask EntryDesk …", "run this on <model> on EntryDesk", "run my EntryDesk agent"
- The user pastes an EntryDesk **share URL** (`https://<host>/share/<id>`) and wants its contents
- "Search Slack / GitHub / Drive via EntryDesk", "what tools does my workspace have"
- "Schedule an agent to run daily"

## Setup

```bash
npm install -g @entrydesk/cli
entrydesk login            # OAuth device flow: prints a URL + code to enter
entrydesk status           # confirm you're signed in
entrydesk workspaces       # list workspaces; switch with `workspaces switch <id>`
```

`entrydesk login` uses the OAuth device flow — it shows a verification URL and a user code; open the URL (the CLI tries to launch a browser, but you can also paste it anywhere) and enter the code. Most commands accept `--json` for scriptable output — prefer it when parsing.

## Core actions

### Run a task with a model or agent

```bash
entrydesk models --json                       # discover model ids
entrydesk task -m "Summarize this" --model <model-id>
entrydesk agents --json                        # discover agent ids
entrydesk task -m "Draft a reply" -a <agent-id>
entrydesk task -c <n> -m "follow up"           # continue task #n
entrydesk task -i                              # interactive mode
echo "explain this code" | entrydesk task --model <model-id>   # pipe stdin
```

Output: `--plain` for text only, `--output stream-json` for streaming structured events. List or view past tasks with `entrydesk tasks` / `entrydesk tasks <n|uuid>`.

### Opening a shared task

When the user gives a URL like `https://app.entrydesk.com/share/<id>` (or any `…/share/<id>`, including custom domains):

```bash
# Extract the id after /share/ and pass it to --share (or -s):
entrydesk tasks --share <id>
```

**Do NOT `WebFetch` / `curl` a share URL** — those endpoints require auth and return 401. Always go through `entrydesk tasks --share`.

### SaaS tools

EntryDesk fronts many SaaS services as callable tools. Discover, then call:

```bash
entrydesk tool list                       # all tools
entrydesk tool list --prefix slack        # filter by service
entrydesk tool get <name>                 # see a tool's input schema
entrydesk tool call <name> --input '{"key": "value"}'
```

Common service prefixes: `slack`, `github`, `google_drive`, `google_gmail`, `google_calendar`, `ms365`, `grafana`, `redash`. Run `tool list --prefix <svc>` to see the exact tool names — **read each tool's schema via `tool get` before calling**; don't assume parameter shapes.

Example — search Slack and read a message thread:

```bash
entrydesk tool call slack__search_all --input '{"query": "release notes"}'
entrydesk tool call slack__get_channel_info --input '{"channel": "C123"}'
```

### Schedule an agent

```bash
entrydesk schedules create \
  --name "Daily Report" --agent-id <agent-id> \
  --prompt "Generate today's summary" \
  --starts-at "2026-06-01T09:00:00Z" \
  --repeat-type days --every 1 --time 09:00 --utc-offset "+08:00"
entrydesk schedules            # list
entrydesk schedules delete <id>
```

## Pitfalls

- **Login is device-flow only** — `entrydesk login` prints a URL + code; there's no `--password` flag. It works headless (copy the URL/code to a browser elsewhere), but it does need a human to approve the code. Check `entrydesk status` before relying on auth.
- **Wrong workspace** — agents, models, and tools are workspace-scoped. If something "isn't there", confirm `entrydesk workspaces` shows the active one you expect; switch with `workspaces switch <id>`.
- **Tool input schemas vary** — always `entrydesk tool get <name>` first; the `--input` JSON must match that tool's schema or the call rejects.
- **Discover ids, don't guess** — model ids and agent ids come from `entrydesk models --json` / `entrydesk agents --json`. Hardcoding a stale id fails.
- **Self-document via the CLI** — `entrydesk <command> --help` is authoritative for flags; prefer it over assumptions when a command's options aren't obvious.
