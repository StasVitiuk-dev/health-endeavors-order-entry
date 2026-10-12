// EXT12: deployment simulator (tests/tools/deploy-sim.js). Node-only; it
// connects to nothing. The rules under test: wrong orders are refused, a
// failed check stops everything, rollback cannot undo business effects, and a
// simulated run never produces production evidence.
const { test, expect } = require('@playwright/test');
const sim = require('../tools/deploy-sim');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const D1 = '2026-10-20', D2 = '2026-10-21', D3 = '2026-10-22';
const FP = sim.INSTALLS.r15.fingerprint;
const ev = (type, date, status = 'PASS', env) => ({ do: 'evidence', type, status, date, env });
let n = 0;
const sit = () => ++n;
// Install one database step on `date` with a fresh same-day backup.
const installStep = (unit, date, extra = {}) => [
  ev('BACKUP', date),
  { do: 'precheck', unit, result: 'PASS' },
  { do: 'install', unit, date, sitting: sit(), version: extra.version },
  { do: 'postcheck', unit, result: 'PASS', fingerprint: extra.fingerprint },
];
const mergeSteps = () => [{ do: 'precheck', unit: 'merge', result: 'PASS' }, { do: 'install', unit: 'merge', date: D1, sitting: sit() }, { do: 'postcheck', unit: 'merge', result: 'PASS' }];
const stockReady = () => [
  ...mergeSteps(), ev('QUERY_C', D1),
  ...installStep('r15', D1, { fingerprint: FP }),
  ...installStep('switch_rows', D1),
];
const onAndVerify = (sw, on, next) => [
  ev('QUERY_H', on), { do: 'switch_on', switch: sw, date: on, sitting: sit() },
  ev('QUERY_H', next), ev('QUERY_E', next), { do: 'verify', switch: sw, date: next, canary: 'expected' },
];
const all = r => { const last = r.results[r.results.length - 1]; return { ok: r.results.every(x => x.ok), last, state: r.state }; };

test('environment must be stated; a non-production run is always marked SIMULATED', () => {
  for (const env of [undefined, '', 'prod', 'live']) expect(() => sim.start({ env })).toThrow(/Environment must be stated/);
  const r = all(sim.run('local', [...stockReady(), ...onAndVerify('stock_fn_receive_po', D1, D2)]));
  expect(r.ok).toBe(true);
  expect(r.state.simulated).toBe(true);
  expect(r.last.message).toMatch(/^SIMULATED: .*simulation only: not production evidence/);
  expect(sim.board(r.state).every(row => row.startsWith('SIMULATED '))).toBe(true);
});

test('production mode refuses local or unstated evidence ("deployed from local evidence")', () => {
  const s = sim.start({ env: 'production' });
  expect(sim.apply(s, ev('BACKUP', D1, 'PASS', 'local')).message).toMatch(/not production verification/);
  expect(sim.apply(s, ev('BACKUP', D1)).ok).toBe(false);
  expect(sim.apply(s, ev('BACKUP', D1, 'PASS', 'production')).ok).toBe(true);
});

test('invalid transitions: switch before SQL, skipped precheck, verify before postcheck', () => {
  let r = sim.run('local', [ev('QUERY_H', D1), { do: 'switch_on', switch: 'stock_fn_receive_po', date: D1, sitting: 1 }]);
  expect(r.results.at(-1).ok).toBe(false);
  expect(r.results.at(-1).message).toMatch(/not installed and checked/);
  r = sim.run('local', [ev('BACKUP', D1), { do: 'install', unit: 'merge', date: D1, sitting: 1 }]);
  expect(r.results.at(-1).message).toMatch(/Skipped precheck/);
  r = sim.run('local', [...mergeSteps(), ev('QUERY_C', D1), ev('BACKUP', D1), { do: 'precheck', unit: 'r15', result: 'PASS' }, { do: 'install', unit: 'r15', date: D1, sitting: 99 }, ev('QUERY_H', D1), { do: 'switch_on', switch: 'stock_fn_receive_po', date: D1, sitting: 100 }]);
  expect(r.results.at(-1).ok).toBe(false); // r15 INSTALLED but not postchecked
  expect(sim.apply(r.state, { do: 'verify', switch: 'stock_fn_receive_po', date: D2, canary: 'expected' }).message).toMatch(/Only a switch under observation/);
});

test('wrong order: a step before its prerequisite, or one needing evidence/decision it lacks', () => {
  let r = sim.run('local', [{ do: 'precheck', unit: 'r15', result: 'PASS' }]);
  expect(r.results[0].message).toMatch(/Wrong order: "Merge the code/);
  r = sim.run('local', [...mergeSteps(), { do: 'precheck', unit: 'r15', result: 'PASS' }]);
  expect(r.results.at(-1).message).toMatch(/needs QUERY_C evidence/);
  r = sim.run('local', [...mergeSteps(), { do: 'precheck', unit: 'switch_rows', result: 'PASS' }]);
  expect(r.results.at(-1).message).toMatch(/Wrong order: "Install R1–R5/);
  r = sim.run('local', [...mergeSteps(), { do: 'precheck', unit: 'nightly', result: 'PASS' }]);
  expect(r.results.at(-1).message).toMatch(/"thresholds" decision/);
  r = sim.run('local', [...mergeSteps(), ev('QUERY_E', D1), { do: 'precheck', unit: 'integrity_rules', result: 'PASS' }]);
  expect(r.results.at(-1).message).toMatch(/needs QUERY_F/);
});

test('database steps need a green backup look on the same day', () => {
  const r = sim.run('local', [...mergeSteps(), ev('QUERY_C', D1), ev('BACKUP', '2026-10-19'), { do: 'precheck', unit: 'r15', result: 'PASS' }, { do: 'install', unit: 'r15', date: D1, sitting: 50 }]);
  expect(r.results.at(-1).message).toMatch(/No green backup look on 2026-10-20/);
  const failed = sim.run('local', [ev('BACKUP', D1, 'FAIL'), { do: 'precheck', unit: 'merge', result: 'PASS' }]);
  expect(failed.results.at(-1).message).toMatch(/STOPPED: Backup FAILED/);
});

test('install twice is harmless; one change per sitting', () => {
  const base = sim.run('local', [...mergeSteps(), ev('QUERY_C', D1), ...installStep('r15', D1, { fingerprint: FP })]);
  expect(base.results.every(x => x.ok)).toBe(true);
  const again = sim.apply(base.state, { do: 'install', unit: 'r15', date: D1, sitting: 500 });
  expect(again.ok).toBe(true);
  expect(again.message).toMatch(/already installed; running it again changes nothing/);
  const s = sim.run('local', [ev('BACKUP', D1), { do: 'precheck', unit: 'merge', result: 'PASS' }, { do: 'install', unit: 'merge', date: D1, sitting: 7 }, { do: 'postcheck', unit: 'merge', result: 'PASS' }, { do: 'precheck', unit: 'line_guard', result: 'PASS' }, { do: 'install', unit: 'line_guard', date: D1, sitting: 7 }]);
  expect(s.results.at(-1).message).toMatch(/One change per sitting: sitting 7/);
  expect(sim.apply(s.state, { do: 'install', unit: 'line_guard', date: D1 }).message).toMatch(/needs a sitting number/);
});

test('failed precheck or postcheck (incl. wrong fingerprint) halts; rollback clears it', () => {
  let r = sim.run('local', [...mergeSteps(), ev('QUERY_C', D1), ...installStep('r15', D1, { fingerprint: 'deadbeef' })]);
  expect(r.results.at(-1).message).toMatch(/postcheck FAILED: stop and roll back/);
  expect(r.state.halted).toMatch(/fingerprint deadbeef is not the reviewed version.*drafts\/11/);
  expect(sim.apply(r.state, { do: 'precheck', unit: 'line_guard', result: 'PASS' }).message).toMatch(/^STOPPED/);
  const rb = sim.apply(r.state, { do: 'rollback', unit: 'r15' });
  expect(rb.ok).toBe(true);
  expect(rb.message).toMatch(/cannot undo business effects/);
  expect(rb.state.halted).toBeNull();
  r = sim.run('local', [ev('BACKUP', D1), { do: 'precheck', unit: 'merge', result: 'FAIL' }]);
  expect(r.state.halted).toMatch(/precheck did not pass/);
});

test('R1 → R4 → R2 → R3 → R5: full order passes, skipping ahead is refused', () => {
  const order = ['stock_fn_receive_po', 'stock_fn_adjust', 'stock_fn_recall', 'stock_fn_return', 'stock_fn_delete_product'];
  const days = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'];
  const acts = [...stockReady()];
  order.forEach((sw, i) => acts.push(...onAndVerify(sw, days[i], days[i + 1])));
  const r = all(sim.run('local', acts));
  expect(r.ok).toBe(true);
  for (const sw of order) expect(r.state.units[sw].status).toBe('VERIFIED');
  const skip = sim.run('local', [...stockReady(), ev('QUERY_H', D2), { do: 'switch_on', switch: 'stock_fn_recall', date: D2, sitting: 900 }]);
  expect(skip.results.at(-1).message).toMatch(/Order: R1 receive, R4 adjust must be ON and VERIFIED before R2 recall/);
});

test('one switch at a time; Query H same day; verify needs a day, the canary and Query E', () => {
  const r = sim.run('local', [...stockReady(), ev('QUERY_H', D1), { do: 'switch_on', switch: 'stock_fn_receive_po', date: D1, sitting: 1000 }]);
  expect(r.results.every(x => x.ok)).toBe(true);
  let s = r.state;
  expect(sim.apply(s, { do: 'switch_on', switch: 'stock_fn_receive_po', date: D1, sitting: 1001 }).message).toMatch(/already ON/);
  // another switch while R1 is observed
  const rk = sim.run('local', [...mergeSteps(), { do: 'decision', id: 'thresholds', choice: 'defaults' }, ...installStep('request_keys', D1), ...installStep('nightly', D1), ev('QUERY_H', D1), { do: 'switch_on', switch: 'request_keys', date: D1, sitting: 1100 }, { do: 'switch_on', switch: 'integrity_results_home', date: D1, sitting: 1101 }]);
  expect(rk.results.at(-2).ok).toBe(true);
  expect(rk.results.at(-1).message).toMatch(/One switch at a time: request_keys_switch is still being observed/);
  expect(sim.apply(s, { do: 'verify', switch: 'stock_fn_receive_po', date: D1, canary: 'expected' }).message).toMatch(/Too early/);
  expect(sim.apply(s, { do: 'verify', switch: 'stock_fn_receive_po', date: D2, canary: 'wrong' }).message).toMatch(/canary action did not give the expected number/);
  expect(sim.apply(s, { do: 'verify', switch: 'stock_fn_receive_po', date: D2, canary: 'expected' }).message).toMatch(/Query H on 2026-10-21/);
  s = sim.apply(s, ev('QUERY_H', D2)).state;
  expect(sim.apply(s, { do: 'verify', switch: 'stock_fn_receive_po', date: D2, canary: 'expected' }).message).toMatch(/Query E must show 0 mismatches/);
  const stale = sim.run('local', [...stockReady(), ev('QUERY_H', '2026-10-19'), { do: 'switch_on', switch: 'stock_fn_receive_po', date: D1, sitting: 1200 }]);
  expect(stale.results.at(-1).message).toMatch(/Run Query H on 2026-10-20 first/);
});

test('request keys and nightly have their own switch rows, separate from their install steps', () => {
  const s0 = sim.start({ env: 'local' });
  expect(s0.units.request_keys.status).toBe('NOT STARTED');
  expect(s0.units.request_keys_switch.status).toBe('ABSENT');
  const rk = all(sim.run('local', [...mergeSteps(), ...installStep('request_keys', D1), ev('QUERY_H', D1), { do: 'switch_on', switch: 'request_keys', date: D1, sitting: 1300 }, ev('QUERY_H', D2), { do: 'verify', switch: 'request_keys', date: D2, canary: 'expected' }]));
  expect(rk.ok).toBe(true);
  expect(rk.state.units.request_keys.status).toBe('POSTCHECK PASS');
  expect(rk.state.units.request_keys_switch.status).toBe('VERIFIED');
  const ni = sim.run('local', [...mergeSteps(), { do: 'decision', id: 'thresholds', choice: 'defaults' }, ...installStep('nightly', D1), ev('QUERY_H', D1), { do: 'switch_on', switch: 'integrity_results_home', date: D1, sitting: 1400 }]);
  expect(ni.results.every(x => x.ok)).toBe(true);
  expect(ni.state.units.integrity_results_home.status).toBe('OBSERVING');
});

test('switch OFF is always allowed, even while stopped, and says business effects stay', () => {
  const r = sim.run('local', [...stockReady(), ev('QUERY_H', D1), { do: 'switch_on', switch: 'stock_fn_receive_po', date: D1, sitting: 1500 }, ev('QUERY_H', D2, 'FAIL')]);
  expect(r.state.halted).toMatch(/Query H shows FAIL/);
  expect(sim.apply(r.state, { do: 'switch_on', switch: 'stock_fn_adjust', date: D2, sitting: 1501 }).message).toMatch(/^STOPPED/);
  const off = sim.apply(r.state, { do: 'switch_off', switch: 'stock_fn_receive_po' });
  expect(off.ok).toBe(true);
  expect(off.message).toMatch(/Real-world effects made while it was ON .* stay/);
  expect(sim.apply(off.state, { do: 'switch_off', switch: 'stock_fn_receive_po' }).message).toMatch(/already OFF/);
});

test('drift: a function disappears while its switch is ON → stop and turn it OFF', () => {
  const r = sim.run('local', [...stockReady(), ...onAndVerify('stock_fn_receive_po', D1, D2), { do: 'drift', switch: 'stock_fn_receive_po', what: 'missing (function disappeared)' }]);
  expect(r.state.halted).toMatch(/PROBLEM: switch R1 receive is ON .* Turn it OFF now/);
  const perm = sim.run('local', [{ do: 'drift', what: 'permission changed on stock_movements' }]);
  expect(perm.state.halted).toMatch(/Drift found: permission changed/);
  expect(sim.apply(perm.state, { do: 'owner_resolves', note: 'checked' }).state.halted).toBeNull();
});

test('rollback: refused while a switch is ON, wrong file, or dependents installed; reinstall after', () => {
  const on = sim.run('local', [...stockReady(), ev('QUERY_H', D1), { do: 'switch_on', switch: 'stock_fn_receive_po', date: D1, sitting: 1600 }]);
  expect(sim.apply(on.state, { do: 'rollback', unit: 'switch_rows' }).message).toMatch(/Rollback refused while stock_fn_receive_po is ON/);
  expect(sim.apply(on.state, { do: 'rollback', unit: 'r15' }).message).toMatch(/Rollback refused/);
  let s = sim.apply(on.state, { do: 'switch_off', switch: 'stock_fn_receive_po' }).state;
  expect(sim.apply(s, { do: 'rollback', unit: 'r15' }).message).toMatch(/Rollback order: roll back switch_rows first/);
  expect(sim.apply(s, { do: 'rollback', unit: 'line_guard' }).message).toMatch(/Nothing to roll back.*wrong rollback file/);
  s = sim.apply(s, { do: 'rollback', unit: 'switch_rows' }).state;
  expect(s.units.stock_fn_receive_po.status).toBe('ABSENT');
  s = sim.apply(s, { do: 'rollback', unit: 'r15' }).state;
  expect(s.units.r15.status).toBe('ROLLED BACK');
  // reinstall after rollback goes through precheck again
  expect(sim.apply(s, { do: 'install', unit: 'r15', date: D3, sitting: 1700 }).message).toMatch(/Skipped precheck/);
  const re = [ev('BACKUP', D3), { do: 'precheck', unit: 'r15', result: 'PASS' }, { do: 'install', unit: 'r15', date: D3, sitting: 1701 }, { do: 'postcheck', unit: 'r15', result: 'PASS', fingerprint: FP }];
  for (const a of re) { const x = sim.apply(s, a); expect(x.ok).toBe(true); s = x.state; }
  expect(s.units.r15.status).toBe('POSTCHECK PASS');
});

test('partial install / mid-migration failure: installed but not checked blocks dependents', () => {
  const r = sim.run('local', [...mergeSteps(), ev('QUERY_C', D1), ev('BACKUP', D1), { do: 'precheck', unit: 'r15', result: 'PASS' }, { do: 'install', unit: 'r15', date: D1, sitting: 1800 }, { do: 'postcheck', unit: 'r15', result: 'FAIL' }]);
  expect(r.state.units.r15.status).toBe('FAILED');
  expect(sim.apply(r.state, { do: 'evidence', type: 'QUERY_H', status: 'PASS', date: D1 }).ok).toBe(true);
  expect(sim.apply(r.state, { do: 'precheck', unit: 'switch_rows', result: 'PASS' }).message).toMatch(/^STOPPED/);
  expect(sim.apply(r.state, { do: 'postcheck', unit: 'r15', result: 'PASS', fingerprint: FP }).message).toMatch(/^STOPPED/);
});

test('version drift: a new draft version makes old install evidence UNKNOWN', () => {
  const r = sim.run('local', [...mergeSteps(), ...installStep('line_guard', D1, { version: 'v1' }), { do: 'version_changed', unit: 'line_guard', version: 'v2' }]);
  expect(r.state.units.line_guard.status).toBe('UNKNOWN');
  const same = sim.run('local', [...mergeSteps(), ...installStep('line_guard', D1, { version: 'v1' }), { do: 'version_changed', unit: 'line_guard', version: 'v1' }]);
  expect(same.state.units.line_guard.status).toBe('POSTCHECK PASS');
});

test('unknown steps, switches and actions are refused, never guessed', () => {
  const s = sim.start({ env: 'staging' });
  for (const a of [{ do: 'precheck', unit: 'r6' }, { do: 'switch_on', switch: 'stock_fn_magic', date: D1, sitting: 1 }, { do: 'verify', switch: 'nope' }, { do: 'switch_off', switch: 'nope' }, { do: 'rollback', unit: 'nope' }, { do: 'deploy_everything' }])
    expect(sim.apply(s, a).ok).toBe(false);
});
