// Query D2 reader (tests/tools/query-d2-interpret.js): the owner's pasted Query D2 answer ->
// per function "OK / REVIEW / FAIL", and never a pass for an incomplete answer.
// Node-only. Query D2 itself is held privately (QUERY_D_FUNCTION_SECURITY_REVIEW.md), so the
// answers below are MADE UP in the format the reader accepts; they prove the reader's rules,
// not that the private query prints exactly this. The "4/4" matrix cited in
// EXT20D_REVALIDATION_REPORT.md was never saved; this replaces it. Nov 27, 2026.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const TOOL = path.join(__dirname, '..', 'tools', 'query-d2-interpret.js');
// the reader's own list of functions (read from the tool, not repeated here)
const NAMES = JSON.parse(fs.readFileSync(TOOL, 'utf8').match(/const EXPECTED = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
const SAFE = '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}';
const rights = (over = {}) => NAMES.map(n => 'D2 rights | public.' + n + '() | ' + (over[n] || SAFE));
const SUMMARY = 'D2 summary | (all) | 10 functions read';

function run(lines, sep) {
  const text = (sep ? lines.map(l => l.split(' | ').join(sep)) : lines).join('\n') + '\n';
  const f = path.join(os.tmpdir(), 'd2-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.txt');
  fs.writeFileSync(f, text);
  try {
    const out = execFileSync(process.execPath, [TOOL, f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; }
  finally { fs.unlinkSync(f); }
}
const line = (out, name) => out.split('\n').find(l => new RegExp('\\s' + name + '(\\s|$)').test(l)) || '';

test('the reader knows ten functions, and a healthy answer says all are safe', () => {
  expect(NAMES.length).toBe(10);
  const r = run(rights().concat(SUMMARY));
  expect(r.code).toBe(0);
  for (const n of NAMES) expect(line(r.out, n)).toMatch(/^\s+OK /);
  expect(r.out).toMatch(/Overall: all expected functions already safe/);
});

test('callable by visitors with no check on the caller is a FAIL, however the right is written', () => {
  const [a, b, c, d] = NAMES;
  const r = run(rights({
    [a]: '{anon=X/postgres,authenticated=X/postgres}',
    [b]: 'default: everyone',
    [c]: '{=X/postgres,postgres=X/postgres}',                 // PUBLIC first
    [d]: '{postgres=X/postgres,=X/postgres}',                 // PUBLIC last: what Postgres prints after a revoke and a re-grant
  }).concat(SUMMARY));
  expect(r.code).toBe(0);                                     // interpretable: it prints the FAILs
  for (const n of [a, b, c, d]) expect(line(r.out, n), n).toMatch(/FAIL \(visitor-callable, no caller gate/);
  expect(r.out).toMatch(/Overall: FIX 3 targets confirmed/);
});

test('a signed-in role alone is not mistaken for "everyone"', () => {
  const [a] = NAMES;
  const r = run(rights({ [a]: '{authenticated=X/postgres,postgres=X*/postgres}' }).concat(SUMMARY));
  expect(line(r.out, a)).toMatch(/^\s+OK /);
});

test('visitor-callable but the code checks the caller is REVIEW, never OK; a scheduled job is noted', () => {
  const [a, b] = NAMES;
  const r = run(rights({ [a]: '{anon=X/postgres}', [b]: '{anon=X/postgres}' })
    .concat(['D2 code | public.' + a + '() | if auth.uid() is null then raise exception; set search_path = public',
      'D2 scheduled job | public.' + b + '() | nightly', SUMMARY]));
  expect(line(r.out, a)).toMatch(/REVIEW \(visitor-callable but gates on caller/);
  expect(line(r.out, a)).not.toMatch(/search_path: confirm pinned/);
  expect(line(r.out, b)).toMatch(/FAIL .*\[used by a scheduled job -> keep privileged role\]/);
  expect(line(r.out, b)).toMatch(/search_path: confirm pinned/);
});

test('an incomplete answer is never a pass (exit 2)', () => {
  const missing = run(rights().slice(1).concat(SUMMARY));                       // one function left out
  expect(missing.code).toBe(2);
  expect(missing.out).toMatch(/MISSING\s+\S+\s+-> cannot confirm/);
  expect(missing.out).toMatch(/FALSE-GREEN GUARD: 1 expected function/);
  expect(run(rights()).code).toBe(2);                                           // cut off before the summary
  expect(run([SUMMARY]).code).toBe(2);                                          // no rights rows
  expect(run(['section | check | result', '1 | x | 0']).code).toBe(2);           // another query's answer
  expect(run(['']).code).toBe(2);                                               // nothing pasted
});

test('tab-separated and " | " answers read the same; the file is only read', () => {
  const lines = rights({ [NAMES[0]]: '{postgres=X/postgres,=X/postgres}' }).concat(SUMMARY);
  const a = run(lines), b = run(lines, '\t');
  expect(b.code).toBe(a.code);
  expect(b.out).toBe(a.out);
  const f = path.join(os.tmpdir(), 'd2-ro-' + process.pid + '.txt');
  fs.writeFileSync(f, lines.join('\n'));
  const before = fs.readFileSync(f, 'utf8');
  try { execFileSync(process.execPath, [TOOL, f], { encoding: 'utf8' }); } finally {
    expect(fs.readFileSync(f, 'utf8')).toBe(before);
    fs.unlinkSync(f);
  }
});
