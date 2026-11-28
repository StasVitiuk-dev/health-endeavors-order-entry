// Query C reader (tests/tools/query-c-reader.js): the owner's Query C file -> one plain
// answer to "does anything else already change stock, so R1-R5 must wait?".
// Node-only. The base file is the REAL output of Query C (docs/ops/sql/02_READONLY_C_agents.sql)
// run on the local throwaway database with docs/ops/sql/local-test/query_c_mock_test.sql
// (made-up agents, a timer job, a stock writer, a disabled restock trigger). No production data.
// Nov 27, 2026.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { read, format, fields } = require('../tools/query-c-reader');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const FILE = path.join(__dirname, '..', 'fixtures', 'query-c', 'local-mock-output.csv');
const REAL = fs.readFileSync(FILE, 'utf8');
const lines = REAL.trim().split('\n');
const HEAD = lines[0];
const body = lines.slice(1);
const csv = (rows) => [HEAD].concat(rows).join('\n') + '\n';
const without = (...pats) => body.filter(l => !pats.some(p => p.test(l)));
// replace one row of the CLEAN answer (defined below)
const replace = (pat, line) => CLEAN.map(l => (pat.test(l) ? line : l));
const levels = (res, level) => res.findings.filter(f => f.level === level).map(f => f.item);

// The planted dangers removed: what a clean production answer looks like.
const CLEAN = without(/^5 scheduled jobs,agent4-retail-wholesale,/, /^5 scheduled jobs,agent6-notify,/, /^6 stock writers,public\.agent4_run,/,
  /^6 stock writers,public\.legacy_restock,/, /^7 triggers,returns\.legacy_restock_trg,/)
  .map(l => (/^6 stock writers,\(functions that call a stock writer\)/.test(l) ? l.replace(/public\.agent_wrapper -> agent4_run, /, '').replace(/, public\.agent_wrapper -> agent4_run/, '') : l));

test('the real local output: STOP for exactly the two planted paths into stock; the reviewed functions are not counted', () => {
  expect(HEAD).toBe('section,item,result');
  const r = read(REAL);
  expect(r.verdict).toBe('STOP');
  expect(levels(r, 'STOP').sort()).toEqual(['agent4-retail-wholesale', 'public.agent4_run']);
  expect(levels(r, 'REVIEW')).toEqual(expect.arrayContaining(['agent6-notify', 'public.legacy_restock', 'returns.legacy_restock_trg']));
  // draft 10's own functions are the intended path: never STOP, never REVIEW
  const flagged = r.findings.filter(f => f.level !== 'NOTE').map(f => f.item + ' ' + f.what).join('\n');
  expect(flagged).not.toMatch(/receive_purchase_order|quarantine_recall|delete_unused_product|_he_apply_stock_change/);
  expect(r.findings.find(f => f.level === 'NOTE' && /reviewed stock functions/.test(f.what))).toBeTruthy();
  expect(r.privacy).toEqual([]);                     // the query masked the agent's e-mail
  expect(format(r)).toMatch(/^Query C — STOP:/);
});

test('with the planted dangers removed the answer is CLEAR, and says what comes next', () => {
  const r = read(csv(CLEAN));
  expect(levels(r, 'STOP')).toEqual([]);
  expect(levels(r, 'UNKNOWN')).toEqual([]);
  expect(levels(r, 'REVIEW')).toEqual([]);
  expect(r.verdict).toBe('CLEAR');
  expect(r.headline).toMatch(/your approval, then draft 10/);
});

test('a missing or cut-short file is UNKNOWN, never clear', () => {
  for (const s of ['5 scheduled jobs', '6 stock writers', '7 triggers', '8 direct writes']) {
    const r = read(csv(CLEAN.filter(l => !l.startsWith(s + ','))));
    expect(r.verdict, 'without ' + s).toBe('UNKNOWN');
  }
  expect(read(csv(CLEAN.slice(0, 40))).verdict).toBe('UNKNOWN');                       // only the first rows
  expect(read(csv(CLEAN.filter(l => !/\(pg_cron installed\)|\(total\)/.test(l)))).verdict).toBe('UNKNOWN');
  expect(read(csv(CLEAN.filter(l => !/^8 direct writes,anon on inventory,/.test(l)))).verdict).toBe('UNKNOWN');
  expect(read('').verdict).toBe('UNKNOWN');
  expect(read('section,check_name,result\n1,x,0\n').verdict).toBe('UNKNOWN');           // another query's file
  expect(read(csv(CLEAN.concat(['11 extra,x,y']))).verdict).toBe('UNKNOWN');              // an edited file
  expect(read(csv(replace(/^7 triggers,orders\.orders_audit,/, '7 triggers,orders.orders_audit,garbled')))).toMatchObject({ verdict: 'UNKNOWN' });
});

test('each kind of second path into stock is a STOP', () => {
  const job = 'agent9,schedule=* * * * *; active=true; last_run=never; last_status=none; runs_7d=0; not_succeeded_7d=0; calls=public.agent9; edge_function=none; uses_http=false; reaches stock=true';
  expect(read(csv(CLEAN.concat(['5 scheduled jobs,' + job]))).verdict).toBe('STOP');
  expect(read(csv(CLEAN.concat(['5 scheduled jobs,' + job.replace('active=true', 'active=false')]))).verdict).toBe('REVIEW');   // paused
  const trig = '7 triggers,orders.auto_reserve,state=enabled; function=public.reserve; writes stock=true';
  expect(read(csv(CLEAN.concat([trig]))).verdict).toBe('STOP');
  const fn = (anon, fired, kind) => '6 stock writers,public.x,kind=' + kind + '; security_definer=true; anon_can_execute=' + anon + '; authenticated_can_execute=true; fired_by_triggers=' + fired + '; called_by_jobs=none; called_via_wrapper_by_jobs=none; checks_caller=false';
  expect(read(csv(CLEAN.concat([fn(true, 'none', 'callable')]))).verdict).toBe('STOP');
  expect(read(csv(CLEAN.concat([fn(false, 'orders.t (enabled)', 'trigger function')]))).verdict).toBe('STOP');
  // a trigger function cannot be called on its own: "anon may execute" does not make it a STOP
  expect(read(csv(CLEAN.concat([fn(true, 'none', 'trigger function')]))).verdict).toBe('REVIEW');
  const r = read(csv(CLEAN.concat([fn(false, 'none', 'callable')])));
  expect(r.verdict).toBe('REVIEW');
  expect(r.findings.find(f => f.item === 'public.x').what).toMatch(/does NOT check who is calling/);
  const noRls = read(csv(replace(/^8 direct writes,authenticated on inventory,/, '8 direct writes,authenticated on inventory,insert=true; update=true; delete=true; row_security=OFF')));
  expect(noRls.verdict).toBe('STOP');
  const anon = read(csv(replace(/^8 direct writes,anon on inventory,/, '8 direct writes,anon on inventory,insert=true; update=false; delete=false; row_security=on')));
  expect(anon.verdict).toBe('REVIEW');
});

test('Shopify order sync ON is flagged; the plain context is noted, never made green or red', () => {
  const on = read(csv(replace(/^4 shopify sync,flag shopify_order_sync,/, '4 shopify sync,flag shopify_order_sync,ON')));
  expect(on.verdict).toBe('REVIEW');
  const r = read(csv(CLEAN));
  expect(levels(r, 'NOTE')).toEqual(expect.arrayContaining(['system mode', 'products', 'feature_flags']));
});

test('personal data in the file is pointed out before it is shared', () => {
  const leak = read(csv(replace(/^1 agents,agent #06,/, '1 agents,agent #06,switch=off; last_run_at=never recorded; last_run_status=error; switch_changed_at=unknown; last_error=failed for jane.doe@example.com')));
  expect(leak.privacy.length).toBe(1);
  expect(format(leak)).toMatch(/PRIVATE DATA/);
});

test('result cells: "; " splits fields, but the masked agent error stays whole', () => {
  expect(fields('a=1; calls=x, y; reaches stock=true')).toEqual({ a: '1', calls: 'x, y', 'reaches stock': 'true' });
  expect(fields('switch=off; last_error=failed; retried; gave up').last_error).toBe('failed; retried; gave up');
  expect(fields(null)).toEqual({});
});

test('from the command line: exit 1 for STOP or UNKNOWN, 0 otherwise; the file is only read', () => {
  const tool = path.join(__dirname, '..', 'tools', 'query-c-reader.js');
  const before = fs.statSync(FILE).mtimeMs;
  let code = 0, out = '';
  try { out = execFileSync(process.execPath, [tool, FILE], { encoding: 'utf8' }); } catch (e) { code = e.status; out = e.stdout; }
  expect(code).toBe(1);
  expect(out).toMatch(/Query C — STOP/);
  expect(fs.statSync(FILE).mtimeMs).toBe(before);
  const tmp = path.join(require('os').tmpdir(), 'qc-clean-' + process.pid + '.csv');
  fs.writeFileSync(tmp, csv(CLEAN));
  try { expect(execFileSync(process.execPath, [tool, tmp, '--json'], { encoding: 'utf8' })).toMatch(/"verdict": "CLEAR"/); } finally { fs.unlinkSync(tmp); }
});
