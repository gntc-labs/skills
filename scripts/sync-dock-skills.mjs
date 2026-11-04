#!/usr/bin/env node
// Copy Dock's agent skills (Dcard/Dock packages/dock-mcp-core/skills/) into plugins/dock/skills/.
//
//   node scripts/sync-dock-skills.mjs <path to a Dcard/Dock clone> <commit or ref>
//
// Dock's MCP server serves the same pages through its `dock_skill` tool and at
// https://app.dock.space/.well-known/agent-skills/. The server answers `dock-slides/plan` from
// `dock-slides/references/plan.md`, so dock-slides/SKILL.md links its modules as `plan/SKILL.md`.
// On disk those links have to name the file, so this rewrites them to `references/plan.md`.
// The commit is written into plugins/dock/README.md, and each page is compared with what
// app.dock.space serves now, so a copy taken ahead of production shows up before it ships.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';

const [dock, ref] = process.argv.slice(2);
if (!dock || !ref) {
  console.error('usage: node scripts/sync-dock-skills.mjs <Dcard/Dock clone> <commit or ref>');
  process.exit(2);
}

const ORIGIN = 'https://app.dock.space';
const SOURCE = 'packages/dock-mcp-core/skills/';
const CORE = 'dock-slides/SKILL.md';
const root = resolve(import.meta.dirname, '..');
const out = join(root, 'plugins/dock/skills');
const readme = join(root, 'plugins/dock/README.md');

const git = (args, encoding = 'utf8') =>
  execFileSync('git', ['-C', dock, ...args], { encoding, maxBuffer: 64 << 20 });

const NO_TOOL =
  "With no `dock_skill`, fetch each link relative to this page's URL; `dock-slides/<module>` on any page is the same address.";
const NO_TOOL_ON_DISK =
  'With no `dock_skill`, read each linked file; a `<skill>/<module>` name on any page is the file `<skill>/references/<module>.md` in this skills folder.';
const MODULE_LINK = /\]\(([a-z-]+)\/SKILL\.md\)/gu;

function onDisk(markdown) {
  if (!markdown.includes(NO_TOOL) || !markdown.match(MODULE_LINK))
    throw new Error(`${CORE} changed how it points at its modules: update NO_TOOL and MODULE_LINK`);
  return markdown.replace(NO_TOOL, NO_TOOL_ON_DISK).replace(MODULE_LINK, '](references/$1.md)');
}

const sha = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
const source = new Map(
  git(['ls-tree', '-r', '--name-only', sha, SOURCE])
    .split('\n')
    .filter(Boolean)
    .map(path => [path.slice(SOURCE.length), git(['show', `${sha}:${path}`], 'buffer')]),
);
if (!source.has(CORE)) throw new Error(`${sha} has no ${SOURCE}${CORE}`);
const copy = new Map(source);
copy.set(CORE, Buffer.from(onDisk(source.get(CORE).toString('utf8'))));

// Fenced code is skipped: the examples hold `](` that are not links.
const broken = [...copy]
  .filter(([file]) => file.endsWith('.md'))
  .flatMap(([file, bytes]) =>
    [...bytes.toString('utf8').replace(/^```[\s\S]*?^```/gmu, '').matchAll(/\]\(([^)\s]+)\)/gu)]
      .map(([, target]) => target)
      .filter(target => !/^(?:[a-z]+:|#)/u.test(target))
      .filter(target => !copy.has(posix.normalize(posix.join(posix.dirname(file), target.split('#')[0]))))
      .map(target => `${file} -> ${target}`),
  );
if (broken.length) throw new Error(`links that reach no copied file:\n  ${broken.join('\n  ')}`);

const marker = /(Dcard\/Dock commit `)[0-9a-f]{40}(`)/u;
const text = readFileSync(readme, 'utf8');
if (!marker.test(text)) throw new Error('plugins/dock/README.md has no "Dcard/Dock commit `<40-hex sha>`" line');

rmSync(out, { recursive: true, force: true });
for (const [file, bytes] of copy) {
  mkdirSync(dirname(join(out, file)), { recursive: true });
  writeFileSync(join(out, file), bytes);
}
writeFileSync(readme, text.replace(marker, `$1${sha}$2`));
console.log(`copied ${copy.size} files from Dcard/Dock ${sha}`);

// app.dock.space serves `<skill>/references/<m>.md` as `<skill>/<m>/SKILL.md`.
const drift = await Promise.all(
  [...source].map(async ([file, bytes]) => {
    const url = `${ORIGIN}/.well-known/agent-skills/${file.replace(/\/references\/([^/]+)\.md$/u, '/$1/SKILL.md')}`;
    try {
      const served = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!served.ok) return `${file}: app.dock.space answers ${served.status}`;
      if (!Buffer.from(await served.arrayBuffer()).equals(bytes)) return `${file}: differs from what app.dock.space serves`;
    } catch (error) {
      return `${file}: could not read ${url} (${error.message})`;
    }
  }),
);
const notServed = drift.filter(Boolean);
if (notServed.length) console.log(`not what production serves today:\n  ${notServed.join('\n  ')}`);
else console.log(`every page matches ${ORIGIN}/.well-known/agent-skills/`);
