#!/usr/bin/env node
// Join by village link: which app is this, and can I farm there?
//   node find-village.mjs --url https://<village host>[/farm/<slug>]
// Runs (read-only) `vibehost --json workspace list`, `vibehost --json
// --workspace <slug> app list` for each workspace, and `vibehost --json
// workspace joinable`, then prints one JSON line:
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
    const cli = (...a) => data(execFileSync("vibehost", ["--json", ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 }));
    const workspaces = read ? read("workspace-list.json") : cli("workspace", "list");
    const appsByWorkspace = Object.fromEntries(workspaces.map((w) => [w.slug, read ? read(`app-list.${w.slug}.json`) : cli("--workspace", w.slug, "app", "list")]));
    const joinable = read ? read("joinable.json") : cli("workspace", "joinable");
    console.log(JSON.stringify(resolveVillage(url, { workspaces, appsByWorkspace, joinable })));
  } catch (e) {
    console.error(`find-village.mjs: ${e.message}`);
    process.exit(2);
  }
}
