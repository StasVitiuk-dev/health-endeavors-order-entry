// The production change log (docs/ops/PRODUCTION_CHANGE_LOG.md) and its checker
// (tests/tools/change-log-check.js). Until Nov 27, 2026 the checker was only run by hand (npm run
// changelog:check) and the log held only the Oct 18 round, although five more changes had been
// installed (steps 18, 19, 0, A, A2). Now GitHub runs the checker on every pull request, and the
// drafts the log says were run must still be, byte for byte, the files in this repository.
// Node-only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const ROOT = path.join(__dirname, '..', '..');
const TOOL = path.join(ROOT, 'tests', 'tools', 'change-log-check.js');
const LOG = path.join(ROOT, 'docs', 'ops', 'PRODUCTION_CHANGE_LOG.md');
const text = fs.readFileSync(LOG, 'utf8');
const check = (cwd) => {
  try { return { code: 0, out: execFileSync(process.execPath, [TOOL], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; }
};
const inTemp = (body) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chlog-'));
  fs.mkdirSync(path.join(dir, 'docs', 'ops'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'ops', 'PRODUCTION_CHANGE_LOG.md'), body);
  try { return check(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

test('every production entry carries its evidence (approval, SQL, rollback, result, downtime, dashboard)', () => {
  const r = check(ROOT);
  expect(r.code, r.out).toBe(0);
  expect(r.out).toMatch(/change-log-check: \d+ entries, all carry required evidence/);
});

test('the log has an entry for every step the records say was installed', () => {
  for (const step of ['FIX 1A', 'FIX 1B', 'FIX 2', 'Step 18 (drafts/68)', 'Step 19 (drafts/70)', 'Step 0 (drafts/72)', 'Step A (drafts/50)', 'Step A2 (drafts/74)']) {
    expect(text, step).toContain(' · ' + step);
  }
  const dates = [...text.matchAll(/^## (\d{4}-\d{2}-\d{2}) · /gm)].map(m => m[1]);
  expect(dates).toEqual([...dates].sort().reverse());                  // newest first
});

test('each draft the log says was run is still that exact file (fingerprint and line count)', () => {
  const cited = [...text.matchAll(/(docs\/ops\/sql\/drafts\/[\w.-]+\.sql)\s+\((\d+) lines, fingerprint ([0-9a-f]{16})\)/g)];
  expect(cited.length).toBe(5);
  for (const [, file, lines, fp] of cited) {
    const body = fs.readFileSync(path.join(ROOT, file));
    expect(crypto.createHash('sha256').update(body).digest('hex').slice(0, 16), file).toBe(fp);
    expect(body.toString('utf8').split('\n').length - 1, file).toBe(Number(lines));
    const undo = file.replace(/\/(\d+)_DRAFT_/, (m, n) => '/' + (Number(n) + 1) + '_DRAFT_rollback_');
    expect(fs.existsSync(path.join(ROOT, undo)), 'undo file for ' + file).toBe(true);
  }
});

test('the checker refuses an entry without its rollback or its result', () => {
  const first = text.indexOf('\n## 20');
  const second = text.indexOf('\n## 20', first + 1);
  const entry = text.slice(first, second);
  expect(inTemp(text.slice(0, first) + entry.replace(/rollback/gi, 'undo') + text.slice(second)).code).toBe(1);
  expect(inTemp(text.slice(0, first) + entry.replace(/Result: \*\*checked\*\*[^\n]*/i, '| Outcome | fine |') + text.slice(second)).code).toBe(1);
  expect(inTemp('# Production change log\n\nnothing yet\n').code).toBe(1);   // no entries at all
});
