#!/usr/bin/env node
// Drift check: every numbered project in ../CLAUDE.md should have a card in
// nexus/index.html. Run: node scripts/check-index.mjs   (exit 1 on drift)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const claude = readFileSync(path.join(here, '..', '..', 'CLAUDE.md'), 'utf8');
const html = readFileSync(path.join(here, '..', 'index.html'), 'utf8');

// Private/unlisted by design — never expected on the public index.
const SKIP = new Set(['letters']);

// Card titles that differ from the CLAUDE.md directory name.
const ALIAS = {
  'task-manager': 'TaskFlow',
  scalebase: 'ScaleScope',
  paperpulse: 'PaperCards',
  'research-suite': 'Throughline — Research Suite',
  'syeds-research-book': "Syed's Research Book",
  'paper-dissection': 'Paper Dissection Workshop',
  wordmap: 'WordMap',
  karmamap: 'KarmaMap',
  ideabox: 'IdeaBox',
  journaltime: 'JournalTime',
  theoryscope: 'TheoryScope',
  toolsscope: 'ToolsScope',
  scholarscope: 'ScholarScope',
  fallacyscope: 'FallacyScope',
  bookscope: 'BookScope',
  mirrorscope: 'MirrorScope',
  researchflow: 'ResearchFlow',
  tracewise: 'Tracewise',
  cadence: 'Cadence',
  callback: 'Callback',
  greenroom: 'Greenroom',
  nexus: 'Nexus',
};

const projects = [];
for (const m of claude.matchAll(/^### (\d+)\. ([\w-]+)\/ /gm)) {
  const [, num, dir] = m;
  if (!SKIP.has(dir)) projects.push({ num: Number(num), dir });
}

const cardRepos = new Set(Array.from(html.matchAll(/data-repo="[\w-]+\/([\w.-]+)"/g), m => m[1].toLowerCase()));
const cardTitles = Array.from(html.matchAll(/<div class="c-title">([^<]+)<\/div>/g), m => m[1].trim());
const titleSet = new Set(cardTitles.map(t => t.toLowerCase()));

const spaced = dir => dir.replace(/-/g, ' ').toLowerCase();
let missing = 0;
for (const p of projects) {
  const alias = (ALIAS[p.dir] || '').toLowerCase();
  const ok = cardRepos.has(p.dir)
    || (alias && titleSet.has(alias))
    || titleSet.has(spaced(p.dir))
    || titleSet.has(p.dir.toLowerCase());
  if (!ok) { console.log(`MISSING card: #${p.num} ${p.dir}`); missing++; }
}
console.log(`${projects.length} CLAUDE.md projects checked · ${cardTitles.length} cards in nexus · ${missing} missing`);
process.exit(missing ? 1 : 0);
