// SYED-CONCEPT · "Index Observatory" pulse builder.
// Counts REAL commits per day for the last 90 days across every repo the
// portfolio cards reference, and writes data/pulse.json for the page to render.
// Runs with a token server-side only (GITHUB_TOKEN in the Action, or
// `gh auth token` locally) — the public page never carries a credential.
//
// Private repos the token can't read are skipped and listed in the output, so
// the strip can label exactly what it counts (no-fab).
//
// Usage:  GITHUB_TOKEN=<token> node scripts/build-pulse.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAYS = 90;

let token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
if (!token) {
  try { token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim(); } catch { /* none */ }
}
if (!token) {
  console.error('No token — set GITHUB_TOKEN or log in with gh. Refusing to run unauthenticated (rate limits).');
  process.exit(1);
}

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const repos = [...new Set([...html.matchAll(/data-repo="([^"]+)"/g)].map(m => m[1]))]
  .filter(r => !/wordmap|paper-dissection/.test(r)); // retired redirect stubs — archived, no commits expected

const since = new Date(Date.now() - DAYS * 86400000);
const sinceISO = since.toISOString();
const dayKey = iso => iso.slice(0, 10);

const days = {};
for (let i = 0; i < DAYS; i++) days[dayKey(new Date(since.getTime() + i * 86400000).toISOString())] = 0;

const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'nexus-pulse' };
const counted = [], skipped = [];

for (const repo of repos) {
  let page = 1, ok = true, n = 0;
  while (page <= 5) { // 500 commits/90d per repo is plenty; cap defensively
    const res = await fetch(`https://api.github.com/repos/${repo}/commits?since=${sinceISO}&per_page=100&page=${page}`, { headers });
    if (res.status === 404 || res.status === 403 || res.status === 451) { ok = false; break; }
    if (res.status === 409) break; // empty repo
    if (!res.ok) { ok = false; break; }
    const commits = await res.json();
    for (const c of commits) {
      const d = dayKey(c.commit?.author?.date || c.commit?.committer?.date || '');
      if (d in days) { days[d]++; n++; }
    }
    if (commits.length < 100) break;
    page++;
  }
  (ok ? counted : skipped).push(repo.split('/')[1]);
  if (ok) console.log(`  ${repo}: ${n} commits`);
  else console.log(`  ${repo}: skipped (not readable with this token)`);
}

const out = {
  generatedAt: new Date().toISOString(),
  windowDays: DAYS,
  totalCommits: Object.values(days).reduce((a, b) => a + b, 0),
  reposCounted: counted.length,
  reposSkipped: skipped,
  days: Object.entries(days).map(([date, n]) => ({ date, n })),
};

mkdirSync(path.join(ROOT, 'data'), { recursive: true });
writeFileSync(path.join(ROOT, 'data', 'pulse.json'), JSON.stringify(out));
console.log(`\npulse.json written — ${out.totalCommits} commits across ${out.reposCounted} repos, ${DAYS} days${skipped.length ? ` (skipped: ${skipped.join(', ')})` : ''}`);
