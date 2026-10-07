#!/usr/bin/env node
// Join by village link: which app is this, and can I farm there?
//   node find-village.mjs --url https://<village host>[/farm/<slug>]
// Runs (read-only) `vibehost --json workspace list`, then `vibehost --json
// --workspace <slug> app list` for the workspace a default address names
// (<app>-<workspace>.vibehost.space) — for every workspace only when that
// finds nothing, as for a custom domain — and `vibehost --json workspace
// joinable` when it's not one of mine. A workspace whose app list fails is
// skipped (named in "skipped"). Then it prints one JSON line:
//   { status: "member",       workspace, role, app, url }   → go to Step F
//   { status: "joinable",     workspace, kind, url, join }  → offer `vibehost workspace join <slug>`
//   { status: "not-member",   url }                          → accept the email invite first
//   { status: "not-a-village", workspace, app, url }         → that app isn't a haunted village
// `--fixtures <dir>` reads workspace-list.json, app-list.<slug>.json and
// joinable.json (the CLI's {ok, data} output) instead — a dry run that never
// touches VibeHost (dev/find-village.test.mjs uses it).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MARKER = "[haunted-farm:village]";

/** "https://Hollow-x.vibehost.space/farm/bob?y" → "hollow-x.vibehost.space"; throws on anything else. */
export function hostOf(url) {
  const raw = String(url ?? "").trim();
  let u;
  try {
    u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error(`"${raw}" isn't a link to a village`);
  }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw new Error(`"${raw}" isn't a link to a village`);
  return u.hostname.toLowerCase();
}

/** An app's address: its fqdn, or VibeHost's default <app>-<workspace>.vibehost.space. */
const appHost = (app, ws) => (app.fqdn || `${app.name}-${ws}.vibehost.space`).toLowerCase();

/**
 * The village a link points at, from what the CLI says about this farmer.
 * `workspaces`: workspace list rows; `appsByWorkspace`: slug → app list rows;
 * `joinable`: workspace joinable rows.
 */
export function resolveVillage(url, { workspaces = [], appsByWorkspace = {}, joinable = [] }) {
  const host = hostOf(url);
  const village = `https://${host}`;
  for (const w of workspaces) {
    const app = (appsByWorkspace[w.slug] || []).find((a) => appHost(a, w.slug) === host);
    if (!app) continue;
    return String(app.description || "").includes(MARKER)
      ? { status: "member", workspace: w.slug, role: w.role, app: app.name, url: village }
      : { status: "not-a-village", workspace: w.slug, app: app.name, url: village };
  }
  // Not in any of my workspaces. A default address ends in -<workspace>.vibehost.space:
  // if that workspace lets me in (my email's domain, or an invite to me), say how.
  const way = joinable
    .filter((j) => host.endsWith(`-${j.slug}.vibehost.space`))
    .sort((a, b) => b.slug.length - a.slug.length)[0];
  if (way) return { status: "joinable", workspace: way.slug, kind: way.kind, url: village, join: `vibehost workspace join ${way.slug}` };
  return { status: "not-member", url: village };
}

/**
 * The village a link points at, asking only what's needed. A default address
 * ends in -<workspace>.vibehost.space, so the workspace(s) whose slug fits
 * are asked first; only when none of them has the app (a custom domain, say)
 * is every workspace asked. A workspace whose app list fails is skipped and
 * named in `skipped`, never the end of the search.
 * `io`: { workspaces() → rows, apps(slug) → rows, joinable() → rows }.
 */
export function findVillage(url, io) {
  const host = hostOf(url);
  const workspaces = io.workspaces();
  const appsByWorkspace = {};
  const skipped = [];
  const ask = (slug) => {
    if (slug in appsByWorkspace) return;
    try {
      appsByWorkspace[slug] = io.apps(slug);
    } catch {
      appsByWorkspace[slug] = [];
      skipped.push(slug);
    }
  };
  const likely = workspaces.filter((w) => host.endsWith(`-${w.slug}.vibehost.space`)).sort((a, b) => b.slug.length - a.slug.length);
  for (const w of likely) ask(w.slug);
  let found = resolveVillage(url, { workspaces: likely, appsByWorkspace, joinable: [] });
  if (found.status !== "member" && found.status !== "not-a-village") {
    for (const w of workspaces) ask(w.slug);
    found = resolveVillage(url, { workspaces, appsByWorkspace, joinable: io.joinable() });
  }
  return skipped.length ? { ...found, skipped } : found;
}

const data = (out) => {
  const j = JSON.parse(out);
  if (!j.ok) throw new Error(j.error?.message || "vibehost said no");
  return j.data;
};

// Run as a command (also through a symlink or a path with spaces).
const runAsCommand = (() => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();
if (runAsCommand) {
  const args = process.argv.slice(2);
  const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  try {
    const url = flag("--url") ?? (() => { throw new Error("--url <village link> is required"); })();
    hostOf(url);
    const dir = flag("--fixtures");
    const read = dir
      ? (name) => (existsSync(join(dir, name)) ? data(readFileSync(join(dir, name), "utf8")) : [])
      : null;
    // A big workspace's app list runs to megabytes: room for it.
    const cli = (...a) => data(execFileSync("vibehost", ["--json", ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 }));
    const io = read
      ? { workspaces: () => read("workspace-list.json"), apps: (slug) => read(`app-list.${slug}.json`), joinable: () => read("joinable.json") }
      : { workspaces: () => cli("workspace", "list"), apps: (slug) => cli("--workspace", slug, "app", "list"), joinable: () => cli("workspace", "joinable") };
    console.log(JSON.stringify(findVillage(url, io)));
  } catch (e) {
    console.error(`find-village.mjs: ${e.message}`);
    process.exit(2);
  }
}
