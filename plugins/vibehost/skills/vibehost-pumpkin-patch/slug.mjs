#!/usr/bin/env node
// The VibeHost app slug and the project folder name for a patch.
//   node slug.mjs --patch patch.json            (uses "name" and "seed")
//   node slug.mjs --name "<patch name>" --seed <8hex> [--taken <slug>[,<slug>…]]
// Prints {"slug": …, "folder": …} as JSON. The server's rule: ^[a-z][a-z0-9-]*$, at most 40 characters.
//   accents / non-ASCII letters -> plain letters where they have one, anything else -> "-", runs of "-" merged,
//   "-" trimmed at both ends; nothing left -> pumpkin-patch-<seed>; starts with a digit -> pumpkin-patch-<slug>;
//   cut to 40 without a trailing "-". --taken (a name collision from app create): add -2, -3, … within 40.
// Folder: pumpkin-patch-<slug>, or the slug itself when it already is / starts with "pumpkin-patch".
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const fail = (msg) => { console.error(`slug.mjs: ${msg}`); process.exit(2); };
let name = flag("--name"), seed = flag("--seed");
if (flag("--patch")) {
  let p; try { p = JSON.parse(readFileSync(flag("--patch"), "utf8")); } catch (e) { fail(`can't read ${flag("--patch")}: ${e.message}`); }
  name ??= p.name; seed ??= p.seed;
}
if (!/^[0-9a-f]{8}$/.test(String(seed))) fail("need the patch's 8-hex seed (--seed or --patch)");
const RULE = /^[a-z][a-z0-9-]*$/, MAX = 40;
const cut = (s, n = MAX) => s.slice(0, n).replace(/-+$/, "");
let slug = String(name ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/ß/g, "ss").replace(/[æÆ]/g, "ae").replace(/[øØ]/g, "o").replace(/[łŁ]/g, "l").replace(/[đĐ]/g, "d")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
if (!slug) slug = `pumpkin-patch-${seed}`;
else if (!/^[a-z]/.test(slug)) slug = `pumpkin-patch-${slug}`;
slug = cut(slug);
const taken = new Set((flag("--taken") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
for (let n = 2; taken.has(slug); n++) slug = `${cut(slug.replace(/-\d+$/, ""), MAX - String(n).length - 1)}-${n}`;
if (!RULE.test(slug) || slug.length > MAX) fail(`internal: "${slug}" breaks the rule`);
console.log(JSON.stringify({ slug, folder: /^pumpkin-patch(-|$)/.test(slug) ? slug : `pumpkin-patch-${slug}` }));
