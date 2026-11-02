// EXT13: the owner documents must never point at a missing file or a command
// that fails, and the current documents must carry an authority header.
// Node-only; nothing connects to any database or service.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const D = require('../tools/doc-check');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
const ROOT = path.join(__dirname, '..', '..');
const run = (args) => { try { return { code: 0, out: execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };

test('every file and npm command named in the current owner documents exists', () => {
  expect(D.CURRENT.length).toBeGreaterThan(15);
  expect(D.CURRENT.flatMap(D.check)).toEqual([]);
});

test('the checker catches a missing file, an unknown npm script and a missing tool (negative control)', () => {
  const tmp = path.join(ROOT, 'docs', 'ops', '_doccheck_tmp_' + process.pid + '.md');
  fs.writeFileSync(tmp, 'See `docs/ops/NO_SUCH_FILE_EXT99.md` and `drafts/99`.\nRun `npm run no:such:script` or `node tests/tools/missing-tool.js`.\nGood: `OWNER_CHECKS_EXT11.md`, `drafts/10`, `npm run evidence:status`.\n');
  try {
    const p = D.check(path.relative(ROOT, tmp));
    expect([...new Set(p.map(x => x.ref))].sort()).toEqual(['docs/ops/NO_SUCH_FILE_EXT99.md', 'drafts/99', 'no:such:script', 'tests/tools/missing-tool.js'].sort());
  } finally { fs.unlinkSync(tmp); }
});

test('the EXT13 entry documents carry an authority header (authoritative as of, commit, supersedes)', () => {
  for (const f of ['START_HERE_EXT13.md', 'CURRENT_PLATFORM_STATE_EXT13.md', 'OWNER_ATTENTION_SESSION_EXT13.md', 'SOURCE_OF_TRUTH_MAP_EXT13.md']) {
    const head = fs.readFileSync(path.join(ROOT, 'docs', 'ops', f), 'utf8').split('\n').slice(0, 8).join('\n');
    expect(head, f).toMatch(/AUTHORITATIVE AS OF/);
    expect(head, f).toMatch(/32c05e2/);
    expect(head, f).toMatch(/SUPERSEDES/i);
  }
});

test('superseded entry documents say so on their status line and point forward', () => {
  for (const f of ['START_HERE_EXT12.md', 'CURRENT_PLATFORM_STATE_EXT12.md', 'OWNER_UNBLOCK_CENTER_EXT12.md', 'UNFINISHED_WORK_EXT12.md', 'CURRENT_PLATFORM_STATE_EXT11.md', 'CURRENT_PLATFORM_STATE_EXT10.md', 'CURRENT_PLATFORM_STATE_EXT9.md']) {
    const head = fs.readFileSync(path.join(ROOT, 'docs', 'ops', f), 'utf8').split('\n').slice(0, 5).join('\n');
    expect(head, f).toMatch(/SUPERSEDED/);
    expect(head, f).toMatch(/EXT13/);
  }
});

test('the commands the owner documents give actually run (local, synthetic input)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'he-cmd-'));
  try {
    const S = require('../fixtures/evidence-samples');
    fs.writeFileSync(path.join(tmp, 'h.csv'), S.H.allExpected);
    let r = run(['tests/tools/evidence.js', 'interpret', 'QUERY_H', path.join(tmp, 'h.csv'), '--env', 'production', '--run-date', '2026-10-20']);
    expect(r.code).toBe(0); expect(r.out).toMatch(/^QUERY_H: PASS/m); expect(r.out).toMatch(/NEXT:/);
    r = run(['tests/tools/evidence.js', 'status', '--today', '2026-10-20']);
    expect(r.code).toBe(0); expect(r.out).toMatch(/Open decisions:/);
    r = run(['tests/tools/deploy-sim.js', 'tests/fixtures/deploy-plan-wrong-order.json', '--env', 'local']);
    expect(r.code).toBe(1); expect(r.out).toMatch(/REFUSED 10\. Switch R1 receive refused/);
    r = run(['tests/tools/incidents.js', 'lookup', 'Receipt status unknown']);
    expect(r.code).toBe(0); expect(r.out).toMatch(/po-receive-unknown/);
    r = run(['tests/tools/doc-check.js', '--current']);
    expect(r.code).toBe(0); expect(r.out).toMatch(/^OK:/m);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('every decision name in the owner attention session is accepted by the evidence intake, and vice versa', () => {
  const E = require('../tools/evidence');
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'ops', 'OWNER_ATTENTION_SESSION_EXT13.md'), 'utf8');
  const section = doc.split('## 6. Decision inventory')[1].split('\n## ')[0];
  const names = [...section.matchAll(/^\| \d+ \| `([a-z0-9_]+)` \|/gm)].map(m => m[1]);
  expect(names.length).toBe(24);
  expect(names.filter(n => !E.DECISIONS[n])).toEqual([]);
  expect(Object.keys(E.DECISIONS).filter(n => !names.includes(n))).toEqual([]);
  // the party in the document matches the party the tool requires
  for (const m of section.matchAll(/^\| \d+ \| `([a-z0-9_]+)` \| ([A-Z-]+)/gm)) {
    const party = E.DECISIONS[m[1]].party;
    if (m[2] === 'ACCOUNTANT' && m[1] !== 'orders_without_items') expect(party, m[1]).toBe('ACCOUNTANT_DECISION');
    if (m[2] === 'LAWYER') expect(party, m[1]).toBe('LAWYER_DECISION');
    if (m[2] === 'PROVIDER') expect(party, m[1]).toBe('PROVIDER_DECISION');
  }
});
