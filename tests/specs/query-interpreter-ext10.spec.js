// EXT10b (missions 90-92): the offline interpreter for downloaded read-only
// query results. Node-only; synthetic CSVs shaped like each query's output.
const { test, expect } = require('@playwright/test');
const { parseCsv, interpret } = require('../tools/interpret-query-results');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('CSV parsing handles quotes, commas and line breaks inside cells', () => {
  const rows = parseCsv('a,b\n"x, y","line1\nline2"\n"say ""hi""",2\n');
  expect(rows).toEqual([{ a: 'x, y', b: 'line1\nline2' }, { a: 'say "hi"', b: '2' }]);
});
test('Query H: overall is the worst status; NOT INSTALLED counts as normal', () => {
  const ok = interpret('H', 'id,item,expected,observed,status,action\nH01,R1-R5,x,0 present,NOT INSTALLED,Normal\nH10,guard,x,present,PASS,Nothing\n');
  expect(ok.overall).toBe('PASS');
  const bad = interpret('H', 'id,item,expected,observed,status,action\nH03,switch,x,ON,FAIL,STOP\nH04,switch,x,OFF,PASS,Nothing\n');
  expect(bad.overall).toBe('FAIL');
  expect(bad.rows[0].note).toBe('STOP');
});
test('Query F: wrong references / impossible values FAIL, stuck work WARN, unreadable UNKNOWN', () => {
  const r = interpret('F', 'section,check_name,findings,examples\nF01 stuck work,tasks,2,a\nF12 impossible value,totals,0,\nF10 points at the wrong thing,returns,1,b\nF07 probable duplicate,sup,,\n');
  expect(r.rows.map(x => x.status)).toEqual(['WARN', 'PASS', 'FAIL', 'UNKNOWN']);
  expect(r.overall).toBe('FAIL');
});
test('Query G uses its level column; Query D maps classification letters', () => {
  expect(interpret('G', 'check_id,level,object,detail\nG01,PASS,tasks,\nG03,WARN,tasks,x\n').overall).toBe('WARN');
  const d = interpret('D', 'function_name,classification\npublic.a(),A trigger only\npublic.b(),B not callable by anon\npublic.c(),E anon + no gate WRITES\n');
  expect(d.rows.map(x => x.status)).toEqual(['PASS', 'PASS', 'FAIL']);
});
test('Query E: 0 and none pass, information rows are INFO, orders without items are a WARN (owner decision)', () => {
  const e = interpret('E', 'section,check_name,result\n1 stock,buckets differ,0\n3 deliveries,no expense,none\n4 lots,lots hold more (information),2\n5 orders,orders with no items,3\n3 deliveries,duplicate expense,PO-1 (2)\n');
  expect(e.rows.map(x => x.status)).toEqual(['PASS', 'PASS', 'INFO', 'WARN', 'FAIL']);
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
  const H = 'id,item,expected,observed,status,action\nH01,R1-R5,5,0,NOT INSTALLED,none\nH02,anon,0,0,PASS,none\n';
  const ok = T.sessionSummary({ env: 'production', runDate: '2026-10-15', results: { H }, backup: { nightly: 'green:2026-10-14', restore: 'green:2026-10-01', minutes: 'ok' } });
  expect(ok.overall).toBe('PASS');
  expect(ok.lines.join('\n')).toContain('Query G: NOT RUN');
  const bad = T.sessionSummary({ env: 'production', runDate: '2026-10-15', results: { H: H + 'H05,switch,OFF,ON without function,FAIL,turn it off\n' } });
  expect(bad.overall).toBe('FAIL');
  const noBackup = T.sessionSummary({ env: 'production', runDate: '2026-10-15', results: { H } });
  expect(noBackup.overall).toBe('UNKNOWN'); // backups not checked is never PASS
  expect(T.sessionSummary({ env: 'staging', runDate: '2026-10-15', results: { H } }).lines.join('\n')).toContain('does not verify production');
});
