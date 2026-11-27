// EXT10b (missions 90-92): the offline interpreter for downloaded read-only
// query results. Node-only; synthetic CSVs shaped like each query's output.
const { test, expect } = require('@playwright/test');
const { parseCsv, interpret } = require('../tools/interpret-query-results');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// Since Nov 27, 2026 a file without the rows its query always prints reads UNKNOWN (cut short).
// whole() completes a one-rule sample with those rows (all PASS), AFTER the sample's own rows,
// so each test below still checks its rule on a whole file; the short samples themselves are
// checked to read UNKNOWN in "a cut-short file ..." at the end.
const pad = (p, n) => Array.from({ length: n }, (_, i) => p + String(i + 1).padStart(2, '0'));
function whole(L, csv) {
  const rows = parseCsv(csv), add = [];
  if (L === 'H') { const have = new Set(rows.map(r => r.id)); for (const k of pad('H', 11)) if (!have.has(k)) add.push(k + ',filler,x,x,PASS,Nothing'); }
  if (L === 'F') { const have = new Set(rows.map(r => r.section.slice(0, 3))); for (const k of pad('F', 15)) if (!have.has(k)) add.push(k + ' filler,x,0,'); }
  if (L === 'G') { const have = new Set(rows.map(r => r.check_id.slice(0, 3))); for (const k of ['G01', 'G03', 'G08', 'G09']) if (!have.has(k)) add.push(k + ' filler,PASS,x,'); }
  if (L === 'E') { const want = { 1: 3, 2: 5, 3: 7, 4: 2, 5: 2 }; for (const k of Object.keys(want)) { const n = rows.filter(r => r.section.charAt(0) === k).length; for (let i = n; i < want[k]; i++) add.push(k + ' filler,filler ' + i + ',0'); } }
  return csv.replace(/\n?$/, '\n') + add.map(l => l + '\n').join('');
}

test('CSV parsing handles quotes, commas and line breaks inside cells', () => {
  const rows = parseCsv('a,b\n"x, y","line1\nline2"\n"say ""hi""",2\n');
  expect(rows).toEqual([{ a: 'x, y', b: 'line1\nline2' }, { a: 'say "hi"', b: '2' }]);
});
test('Query H: overall is the worst status; NOT INSTALLED counts as normal', () => {
  const ok = interpret('H', whole('H', 'id,item,expected,observed,status,action\nH01,R1-R5,x,0 present,NOT INSTALLED,Normal\nH10,guard,x,present,PASS,Nothing\n'));
  expect(ok.overall).toBe('PASS');
  const bad = interpret('H', whole('H', 'id,item,expected,observed,status,action\nH03,switch,x,ON,FAIL,STOP\nH04,switch,x,OFF,PASS,Nothing\n'));
  expect(bad.overall).toBe('FAIL');
  expect(bad.rows[0].note).toBe('STOP');
});
test('Query F: wrong references / impossible values FAIL, stuck work WARN, unreadable UNKNOWN', () => {
  const r = interpret('F', whole('F', 'section,check_name,findings,examples\nF01 stuck work,tasks,2,a\nF12 impossible value,totals,0,\nF10 points at the wrong thing,returns,1,b\nF07 probable duplicate,sup,,\n'));
  expect(r.rows.slice(0, 4).map(x => x.status)).toEqual(['WARN', 'PASS', 'FAIL', 'UNKNOWN']);
  expect(r.overall).toBe('FAIL');
});
test('Query G uses its level column; Query D maps classification letters', () => {
  expect(interpret('G', whole('G', 'check_id,level,object,detail\nG01,PASS,tasks,\nG03,WARN,tasks,x\n')).overall).toBe('WARN');
  const d = interpret('D', 'function_name,classification\npublic.a(),A trigger only\npublic.b(),B not callable by anon\npublic.c(),E anon + no gate WRITES\n');
  expect(d.rows.map(x => x.status)).toEqual(['PASS', 'PASS', 'FAIL']);
});
test('Query E: 0 and none pass, information rows are INFO, orders without items are a WARN (owner decision)', () => {
  const e = interpret('E', whole('E', 'section,check_name,result\n1 stock,buckets differ,0\n3 deliveries,no expense,none\n4 lots,lots hold more (information),2\n5 orders,orders with no items,3\n3 deliveries,duplicate expense,PO-1 (2)\n'));
  expect(e.rows.slice(0, 5).map(x => x.status)).toEqual(['PASS', 'PASS', 'INFO', 'WARN', 'FAIL']);
});
test('an empty result is UNKNOWN, never PASS; Query C is refused', () => {
  expect(interpret('H', 'id,item,expected,observed,status,action\n').overall).toBe('UNKNOWN');
  expect(() => interpret('C', 'a\n1\n')).toThrow(/inventory/);
});
test('privacy: a file with an e-mail address is flagged', () => {
  expect(interpret('G', 'check_id,level,object,detail\nG02,INFO,x,owner@example.test\n').privacy).toMatch(/WARNING/);
  expect(interpret('G', 'check_id,level,object,detail\nG02,INFO,x,none\n').privacy).toMatch(/No e-mail/);
});
test('Query H output from the local database parses (real column names)', () => {
  const sample = 'id,item,expected,observed,status,action\nH01,R1-R5 stock functions (drafts/10),"6 functions, fingerprint f6d9c2c8be690710eeb721041f6779d9","6 present, fingerprint f6d9c2c8be690710eeb721041f6779d9",PASS,Nothing to do.\n';
  expect(interpret('H', sample).rows[0]).toMatchObject({ status: 'PASS', name: 'H01 R1-R5 stock functions (drafts/10)' });
});

test('a file that is not the query output (e.g. an error message) is refused, never read as PASS', () => {
  expect(() => interpret('H', 'psql: ERROR:  relation "public.feature_flags" does not exist\n')).toThrow(/does not look like a Query H result/);
});

// ---- EXT11: backup intake, evidence expiry, one-session summary ----
const T = require('../tools/interpret-query-results');
test('backup intake: healthy within 2 / 35 days expires after 7 days; red is FAILED; old is STALE; incomplete is UNKNOWN', () => {
  expect(T.backupStatus({ nightly: 'green:2026-10-14', restore: 'green:2026-10-01', minutes: 'ok', checkedOn: '2026-10-15' })).toMatchObject({ status: 'VERIFIED HEALTHY', expires: '2026-10-22' });
  expect(T.backupStatus({ nightly: 'red:2026-10-14', restore: 'green:2026-10-01', minutes: 'ok', checkedOn: '2026-10-15' }).status).toBe('FAILED');
  expect(T.backupStatus({ nightly: 'green:2026-10-10', restore: 'green:2026-10-01', minutes: 'ok', checkedOn: '2026-10-15' }).status).toBe('STALE');
  expect(T.backupStatus({ nightly: 'green:2026-10-14', restore: 'green:2026-09-01', minutes: 'ok', checkedOn: '2026-10-15' }).status).toBe('STALE');
  expect(T.backupStatus({ nightly: 'green:2026-10-14', restore: 'green:2026-10-01', minutes: 'out', checkedOn: '2026-10-15' }).status).toBe('STALE');
  expect(T.backupStatus({ nightly: 'green', restore: 'green:2026-10-01', minutes: 'ok', checkedOn: '2026-10-15' }).status).toBe('UNKNOWN');
  expect(T.backupStatus({ nightly: 'green:2026-10-20', restore: 'green:2026-10-01', minutes: 'ok', checkedOn: '2026-10-15' }).status).toBe('UNKNOWN');
});
test('evidence expiry: backups after 7 days, queries after 30 days; unknown kinds or dates are UNKNOWN, never CURRENT', () => {
  expect(T.evidenceAge('backup', '2026-10-01', '2026-10-08')).toBe('CURRENT');
  expect(T.evidenceAge('backup', '2026-10-01', '2026-10-09')).toBe('STALE');
  expect(T.evidenceAge('G', '2026-10-01', '2026-10-31')).toBe('CURRENT');
  expect(T.evidenceAge('G', '2026-10-01', '2026-11-01')).toBe('STALE');
  expect(T.evidenceAge('fingerprint', '2026-10-01', '2026-10-01')).toBe('UNKNOWN');
  expect(T.evidenceAge('H', 'yesterday', '2026-10-01')).toBe('UNKNOWN');
});
test('session summary: environment must be stated (fails closed); worst result wins; not-production is labelled', () => {
  expect(T.sessionSummary({ env: undefined, runDate: '2026-10-15', results: {} }).overall).toBe('UNKNOWN');
  expect(T.sessionSummary({ env: 'prod', runDate: '2026-10-15', results: {} }).overall).toBe('UNKNOWN');
  const H = whole('H', 'id,item,expected,observed,status,action\nH01,R1-R5,5,0,NOT INSTALLED,none\nH02,anon,0,0,PASS,none\n');
  const ok = T.sessionSummary({ env: 'production', runDate: '2026-10-15', results: { H }, backup: { nightly: 'green:2026-10-14', restore: 'green:2026-10-01', minutes: 'ok' } });
  expect(ok.overall).toBe('PASS');
  expect(ok.lines.join('\n')).toContain('Query G: NOT RUN');
  const bad = T.sessionSummary({ env: 'production', runDate: '2026-10-15', results: { H: H + 'H05,switch,OFF,ON without function,FAIL,turn it off\n' } });
  expect(bad.overall).toBe('FAIL');
  const noBackup = T.sessionSummary({ env: 'production', runDate: '2026-10-15', results: { H } });
  expect(noBackup.overall).toBe('UNKNOWN'); // backups not checked is never PASS
  expect(T.sessionSummary({ env: 'staging', runDate: '2026-10-15', results: { H } }).lines.join('\n')).toContain('does not verify production');
});

// ---- Nov 27, 2026: a cut-short file is UNKNOWN, never PASS ----
const fs = require('fs');
const path = require('path');
const FIX = (L) => fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'query-results', L + '-local.csv'), 'utf8');
test('a cut-short file is UNKNOWN, never PASS (the short samples above, and the real output cut)', () => {
  // the earlier one-rule samples, as they were: every row PASS, but most checks missing
  expect(interpret('H', 'id,item,expected,observed,status,action\nH01,R1-R5,x,0 present,NOT INSTALLED,Normal\nH10,guard,x,present,PASS,Nothing\n').overall).toBe('UNKNOWN');
  expect(interpret('G', 'check_id,level,object,detail\nG01,PASS,tasks,\n').overall).toBe('UNKNOWN');
  // the REAL output of Queries E, F and G on the local database (tests/fixtures/query-results)
  expect(interpret('E', FIX('E')).overall).toBe('PASS');
  expect(interpret('F', FIX('F')).overall).toBe('PASS');
  expect(interpret('G', FIX('G')).overall).toBe('WARN');              // the local copy's known F1/F2 warnings
  for (const L of ['E', 'F', 'G']) {
    const lines = FIX(L).trim().split('\n');
    const cut = interpret(L, lines.slice(0, 6).join('\n') + '\n');  // only the first rows copied
    expect(cut.overall, L).toBe('UNKNOWN');
    expect(cut.rows.find(r => r.name === '(whole file)').note, L).toMatch(/cut short/);
  }
  // one always-printed row missing is enough, even when the rest shows a WARN (G08 stays): never WARN or PASS
  expect(interpret('F', FIX('F').split('\n').filter(l => !/^F15 /.test(l)).join('\n')).overall).toBe('UNKNOWN');
  expect(interpret('G', FIX('G').split('\n').filter(l => !/^G09 /.test(l)).join('\n')).overall).toBe('UNKNOWN');
  // a FAIL in a cut-short file still shows as FAIL (worse than UNKNOWN), never hidden
  expect(interpret('F', 'section,check_name,findings,examples\nF10 points at the wrong thing,returns,1,b\n').overall).toBe('FAIL');
});
test('the queries still print the rows the reader counts on', () => {
  const sql = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'ops', 'sql', f), 'utf8');
  const F = sql('05_READONLY_F_daily_integrity_check.sql'), H = sql('07_READONLY_H_drift_check.sql'), G = sql('06_READONLY_G_permissions_inventory.sql');
  for (const k of pad('F', 15)) expect(F, k).toContain("'" + k + ' ');
  for (const k of ['H01', 'H02', 'H08', 'H09', 'H10', 'H11']) expect(H, k).toContain("'" + k + "'");
  for (const k of ['G01', 'G03', 'G08', 'G09']) expect(G, k).toContain("'" + k + ' ');
  // Query D has no fixed rows; it lists the worst first, so cutting its end can only drop safer rows
  expect(sql('03_READONLY_D_definer_function_identity_check.sql')).toMatch(/order by classification desc, function_name;\s*$/);
  const e = parseCsv(FIX('E'));                                        // real output: rows per section
  const per = {}; for (const r of e) per[r.section.charAt(0)] = (per[r.section.charAt(0)] || 0) + 1;
  expect(per).toEqual({ 1: 3, 2: 5, 3: 7, 4: 2, 5: 2 });
});
