// EXT12: owner-evidence intake (tests/tools/evidence.js) against the synthetic
// sample library. Node-only; nothing connects to any database or service.
// The rule under test: malformed, partial, unknown, wrong-environment or
// secret-bearing evidence can never come out as PASS.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('../tools/evidence');
const S = require('../fixtures/evidence-samples');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const P = { env: 'production', runDate: '2026-10-15' };
const st = (type, text, opts = P) => E.interpret(type, text, opts).status;

test('environment is required and checked; non-production evidence never verifies production', () => {
  for (const env of [undefined, '', 'prod', 'Production ', 'live', 'stagng']) expect(st('QUERY_H', S.H.allExpected, { env, runDate: '2026-10-15' })).toBe('UNKNOWN');
  expect(E.interpret('QUERY_H', S.H.allExpected, { env: 'staging', runDate: '2026-10-15' }).note).toMatch(/NOT PRODUCTION/);
  const { board } = E.statusBoard([E.makeRecord('QUERY_H', S.H.allExpected, { env: 'local', runDate: '2026-10-15' }).record], '2026-10-15');
  expect(board.QUERY_H.status).toBe('UNKNOWN');
});

test('secrets are refused and not stored; e-mails are replaced before storing', () => {
  const r = E.makeRecord('AGENT_SOURCE', S.AGENT_SOURCE.withSecret, P);
  expect(r.record).toBeNull();
  expect(r.result.status).toBe('MALFORMED');
  expect(r.result.note).toMatch(/REFUSED/);
  for (const secret of ['token=abcdef123456', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdef', 'ghp_' + 'a'.repeat(30), '-----BEGIN PRIVATE KEY-----'])
    expect(E.interpret('QUERY_G', S.G.expected + 'G02 policy,INFO,x,' + secret + '\n', P).status).toBe('MALFORMED');
  const rec = E.makeRecord('QUERY_C', S.C.agentFailed.replace('[email]', 'jane.synthetic@example.test'), P).record;
  expect(JSON.stringify(rec)).not.toContain('jane.synthetic@example.test');
});

test('Query C library: complete / audit gap / unknown agent / failed agent / off agent ON / extra stock writer / missing section / partial / permission denied / timeout', () => {
  expect(st('QUERY_C', S.C.allPass)).toBe('PASS');
  const gap = E.interpret('QUERY_C', S.C.auditMissing, P);
  expect(gap.status).toBe('WARN');
  expect(gap.rows.filter(r => r.status === 'WARN').map(r => r.name)).toEqual(['audit inventory', 'audit feature_flags']);
  expect(E.nextSteps('QUERY_C', gap).join('\n')).toMatch(/audit trigger/);
  expect(st('QUERY_C', S.C.agentUnknown)).toBe('UNKNOWN');
  expect(st('QUERY_C', S.C.agentFailed)).toBe('WARN');
  const offOn = E.makeRecord('QUERY_C', S.C.offAgentOn, P).record;
  expect(E.conflicts(offOn).join()).toMatch(/off on purpose/);
  expect(st('QUERY_C', S.C.unexpectedWriter)).toBe('WARN');
  expect(st('QUERY_C', S.C.missingSection)).toBe('INCOMPLETE');
  expect(st('QUERY_C', S.C.partialOutput)).toBe('INCOMPLETE');
  expect(st('QUERY_C', S.C.permissionDenied)).toBe('UNKNOWN');
  expect(st('QUERY_C', S.C.timeout)).toBe('UNKNOWN');
});

test('Query C on the real local output (query_c_mock_test.sql run on the local database) is read correctly', () => {
  const real = 'section,item,result\n1 agents,agent #01,switch=ON; last_run_at=never recorded; last_run_status=none; switch_changed_at=2026-10-11T20:45:00Z; last_error=none\n'
    + '1 agents,agent #06,switch=off; last_run_at=2026-10-09T20:45:00Z; last_run_status=error; switch_changed_at=2026-10-11T20:45:00Z; last_error=failed for [email] while sending [token]\n'
    + '10 audit coverage,approval_requests,"audit_trigger=approval_requests_audit; who_when_columns=created_at, requested_by, reviewed_at, reviewed_by"\n';
  const r = E.interpretC(real);
  expect(r.status).toBe('INCOMPLETE'); // only 2 of 11 sections in this excerpt
  expect(r.rows.find(x => x.name === 'agent #06').status).toBe('WARN');
  expect(r.rows.find(x => x.name === 'audit approval_requests').status).toBe('PASS');
});

test('Query D / E / F / G / H libraries', () => {
  expect([st('QUERY_D', S.D.allPass), st('QUERY_D', S.D.readNext), st('QUERY_D', S.D.misusable), st('QUERY_D', S.D.unknownRow), st('QUERY_D', S.D.malformed)]).toEqual(['PASS', 'WARN', 'FAIL', 'UNKNOWN', 'MALFORMED']);
  expect([st('QUERY_E', S.E.match), st('QUERY_E', S.E.stockMismatch), st('QUERY_E', S.E.deliveryMismatch), st('QUERY_E', S.E.missingData), st('QUERY_E', S.E.unknown)]).toEqual(['PASS', 'FAIL', 'FAIL', 'UNKNOWN', 'UNKNOWN']);
  expect([st('QUERY_F', S.F.allPass), st('QUERY_F', S.F.oneFail), st('QUERY_F', S.F.multiple), st('QUERY_F', S.F.unknown), st('QUERY_F', S.F.malformed)]).toEqual(['PASS', 'FAIL', 'FAIL', 'UNKNOWN', 'MALFORMED']);
  expect([st('QUERY_G', S.G.expected), st('QUERY_G', S.G.anonWrite), st('QUERY_G', S.G.duplicatePolicy), st('QUERY_G', S.G.taskUpdateBroad), st('QUERY_G', S.G.noRls), st('QUERY_G', S.G.malformed)]).toEqual(['WARN', 'FAIL', 'WARN', 'FAIL', 'FAIL', 'MALFORMED']);
  expect([st('QUERY_H', S.H.allExpected), st('QUERY_H', S.H.installedOk), st('QUERY_H', S.H.missingFunction), st('QUERY_H', S.H.wrongFingerprint), st('QUERY_H', S.H.switchWithoutDependency), st('QUERY_H', S.H.warning), st('QUERY_H', S.H.unknown), st('QUERY_H', S.H.partial)])
    .toEqual(['PASS', 'PASS', 'FAIL', 'FAIL', 'FAIL', 'WARN', 'UNKNOWN', 'UNKNOWN']);
});

test('re-entry: each finding routes to a prepared next step, never a production action', () => {
  const steps = (t, x) => E.nextSteps(t, E.interpret(t, x, P)).join('\n');
  expect(steps('QUERY_G', S.G.taskUpdateBroad)).toMatch(/task-update fix draft.*rollback.*local roles/);
  expect(steps('QUERY_G', S.G.anonWrite)).toMatch(/revoke draft/);
  expect(steps('QUERY_G', S.G.duplicatePolicy)).toMatch(/Duplicate read policies/);
  expect(steps('QUERY_H', S.H.switchWithoutDependency)).toMatch(/^STOP/m);
  expect(steps('QUERY_E', S.E.stockMismatch)).toMatch(/no automatic repair/);
  expect(steps('QUERY_H', S.H.allExpected)).toBe('Nothing to do.');
  expect(steps('QUERY_C', S.C.unexpectedWriter)).toMatch(/before installing R1–R5/);
  expect(steps('QUERY_D', S.D.malformed)).toMatch(/send it again/);
  for (const t of ['QUERY_G', 'QUERY_H', 'QUERY_E', 'QUERY_C', 'BACKUP']) for (const x of Object.values(S[t === 'BACKUP' ? 'BACKUP' : t.slice(-1)]))
    expect(steps(t, x)).not.toMatch(/\b(run it on production|install now|turn (it|the switch) on)\b/i);
});

test('backup evidence: healthy / stale / failed / minutes out / vague / incomplete / wrong environment', () => {
  expect(st('BACKUP', S.BACKUP.healthy)).toBe('PASS');
  expect(st('BACKUP', S.BACKUP.stale)).toBe('WARN');
  expect(st('BACKUP', S.BACKUP.failed)).toBe('FAIL');
  expect(E.nextSteps('BACKUP', E.interpret('BACKUP', S.BACKUP.failed, P)).join()).toMatch(/STOP every production change/);
  expect(st('BACKUP', S.BACKUP.minutesOut)).toBe('WARN');
  expect(st('BACKUP', S.BACKUP.vague)).toBe('UNKNOWN');
  expect(st('BACKUP', S.BACKUP.incomplete)).toBe('INCOMPLETE');
  expect(E.statusBoard([E.makeRecord('BACKUP', S.BACKUP.healthy, { env: 'staging', runDate: '2026-10-15' }).record], '2026-10-15').board.BACKUP.status).toBe('UNKNOWN');
});

test('staleness: backup after 7 days, queries after 30; a device result goes stale when the page changes', () => {
  const rec = E.makeRecord('BACKUP', S.BACKUP.healthy, P).record;
  expect(E.statusBoard([rec], '2026-10-22').board.BACKUP.status).toBe('PASS');
  expect(E.statusBoard([rec], '2026-10-23').board.BACKUP.status).toBe('STALE');
  const g = E.makeRecord('QUERY_G', S.G.expected, P).record;
  expect(E.statusBoard([g], '2026-11-15').board.QUERY_G.status).toBe('STALE');
  const dev = E.makeRecord('REAL_DEVICE', S.DEVICE.pass, Object.assign({ pageFingerprint: 'aaaa' }, P)).record;
  expect(E.statusBoard([dev], '2026-10-15', 'aaaa').board.REAL_DEVICE.status).toBe('PASS');
  expect(E.statusBoard([dev], '2026-10-15', 'bbbb').board.REAL_DEVICE.status).toBe('STALE');
});

test('conflicts: two different results for the same day, or evidence that contradicts the documents, are CONFLICT (never auto-fixed)', () => {
  const a = E.makeRecord('QUERY_G', S.G.expected, P).record, b = E.makeRecord('QUERY_G', S.G.taskUpdateBroad, P).record;
  expect(E.statusBoard([a, b], '2026-10-15').board.QUERY_G.status).toBe('CONFLICT');
  const anon = E.makeRecord('QUERY_G', S.G.anonWrite, P).record;
  const s = E.statusBoard([anon], '2026-10-15').board.QUERY_G;
  expect(s.status).toBe('CONFLICT');
  expect(s.conflicts.join()).toMatch(/no write rights for anon/);
});

test('diff of two runs: NEW FAILURE, RESOLVED, UNCHANGED, NEW UNKNOWN', () => {
  const r1 = E.makeRecord('QUERY_F', S.F.multiple, P).record;
  const r2 = E.makeRecord('QUERY_F', S.F.oneFail.replace('F09 probable duplicate,check 9,0', 'F09 probable duplicate,check 9,'), Object.assign({}, P, { runDate: '2026-10-20' })).record;
  const d = Object.fromEntries(E.diff(r1, r2).map(x => [x.name.slice(0, 3), x.change]));
  expect(d).toMatchObject({ F02: 'RESOLVED', F06: 'RESOLVED', F12: 'RESOLVED', F14: 'NEW FAILURE', F09: 'NEW UNKNOWN', F01: 'UNCHANGED' });
});

test('GitHub access (X6-17): closed only when account, role, backups visibility and bypass are all right', () => {
  const r = E.interpret('GITHUB_ACCESS', S.GITHUB.correct, P);
  expect(r.status).toBe('PASS');
  expect(E.nextSteps('GITHUB_ACCESS', r).join()).toMatch(/X6-17 CLOSED/);
  for (const k of ['stillAdmin', 'backupsVisible', 'bypassAnyone', 'wrongAccount']) expect(st('GITHUB_ACCESS', S.GITHUB[k])).toBe('FAIL');
  expect(st('GITHUB_ACCESS', S.GITHUB.ambiguous)).toBe('INCOMPLETE');
});

test('real devices: tied to a commit; a failure routes to the area and its tests', () => {
  expect(st('REAL_DEVICE', S.DEVICE.pass)).toBe('PASS');
  const f = E.interpret('REAL_DEVICE', S.DEVICE.voiceoverFail, P);
  expect(f.status).toBe('FAIL');
  expect(E.nextSteps('REAL_DEVICE', f).join()).toMatch(/approval_confirm_reachable.*voiceover.*a11y/);
  expect(st('REAL_DEVICE', S.DEVICE.noSha)).toBe('INCOMPLETE');
  expect(st('REAL_DEVICE', S.DEVICE.unknownDevice)).toBe('INCOMPLETE');
});

test('decisions: validated, versioned (latest wins), revocation reopens, and each party answers only its own', () => {
  expect(st('OWNER_DECISION', S.DECISION.partialWhole)).toBe('PASS');
  expect(st('OWNER_DECISION', S.DECISION.badChoice)).toBe('INCOMPLETE');
  expect(st('OWNER_DECISION', S.DECISION.noWho)).toBe('INCOMPLETE');
  expect(st('OWNER_DECISION', S.DECISION.n4ByOwner)).toBe('CONFLICT');
  expect(st('ACCOUNTANT_DECISION', S.DECISION.n4ByAccountant)).toBe('PASS');
  const recs = [S.DECISION.partialWhole, S.DECISION.partialQty].map(x => E.makeRecord('OWNER_DECISION', x, P).record);
  let b = E.statusBoard(recs, '2026-10-15');
  expect(b.decisions.partial_returns.choice).toBe('partial quantity');
  expect(b.openDecisions).not.toContain('partial_returns');
  b = E.statusBoard(recs.concat(E.makeRecord('OWNER_DECISION', S.DECISION.partialRevoked, P).record), '2026-10-15');
  expect(b.openDecisions).toContain('partial_returns');
  expect(Object.keys(E.DECISIONS)).toEqual(expect.arrayContaining(['thresholds', 'low_stock_levels', 'partial_returns', 'staging_location', 'rpo_rto', 'backup_row', 'week_definition', 'employee_approval', 'recall_per_lot', 'orders_without_items', 'document_categories', 'order_number_rule']));
});

test('agent source arrival: complete is mapped to the contract; duplicates FAIL; partial INCOMPLETE; secrets refused', () => {
  expect(st('AGENT_SOURCE', S.AGENT_SOURCE.complete)).toBe('PASS');
  expect(st('AGENT_SOURCE', S.AGENT_SOURCE.duplicates)).toBe('FAIL');
  expect(st('AGENT_SOURCE', S.AGENT_SOURCE.partial)).toBe('INCOMPLETE');
  expect(st('AGENT_SOURCE', S.AGENT_SOURCE.withSecret)).toBe('MALFORMED');
});

test('ledger: intake appends one sanitized line; status reads it; an unknown type or empty text never passes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-'));
  const file = path.join(dir, 'ledger.jsonl');
  E.appendLedger(E.makeRecord('QUERY_H', S.H.allExpected, Object.assign({ operator: 'Stas (SYNTHETIC)' }, P)).record, file);
  const recs = E.readLedger(file);
  expect(recs).toHaveLength(1);
  expect(recs[0]).toMatchObject({ type: 'QUERY_H', status: 'PASS', environment: 'production', operator: 'Stas (SYNTHETIC)' });
  expect(E.statusBoard(recs, '2026-10-15').board.QUERY_D.status).toBe('NOT RECEIVED');
  expect(st('QUERY_Z', 'x')).toBe('MALFORMED');
  expect(st('QUERY_H', '   ')).toBe('NOT RECEIVED');
});

test('CLI: wrong directory / missing file gives a clear message; interpret stores nothing', () => {
  const { spawnSync } = require('child_process');
  const tool = path.join(__dirname, '..', 'tools', 'evidence.js');
  const r = spawnSync('node', [tool, 'interpret', 'QUERY_H', 'no-such.csv', '--env', 'production', '--run-date', '2026-10-15'], { encoding: 'utf8' });
  expect(r.status).toBe(2);
  expect(r.stderr).toMatch(/No such file.*repository root/);
  const tmp = path.join(os.tmpdir(), 'h-' + Date.now() + '.csv');
  fs.writeFileSync(tmp, S.H.switchWithoutDependency);
  const before = fs.existsSync(path.join(__dirname, '..', '..', 'docs', 'ops', 'evidence', 'ledger.jsonl'));
  const out = spawnSync('node', [tool, 'interpret', 'QUERY_H', tmp, '--env', 'production', '--run-date', '2026-10-15'], { encoding: 'utf8' });
  expect(out.stdout).toMatch(/QUERY_H: FAIL/);
  expect(out.stdout).toMatch(/STOP/);
  expect(fs.existsSync(path.join(__dirname, '..', '..', 'docs', 'ops', 'evidence', 'ledger.jsonl'))).toBe(before);
});
