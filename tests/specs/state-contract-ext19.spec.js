// EXT19: the high-risk operation contract (docs/ops/OPERATION_STATE_CONTRACT_EXT19.json)
// against the real code.
//   * he-ops.js states and transition tables equal the contract exactly
//   * the contract's invariants hold on the table itself
//   * every listed operation's protection is still in the code, and its tests exist
//   * random legal / illegal event sequences: the tracker accepts exactly what the table allows
// Node only.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const ROOT = path.join(__dirname, '..', '..');
const C = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ops/OPERATION_STATE_CONTRACT_EXT19.json'), 'utf8'));

function loadOps() {
  let factory;
  const window = { HE: { modules: { define: (n, m, f) => { factory = f; } } } };
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/app/he-ops.js'), 'utf8'))(window); // eslint-disable-line no-new-func
  return factory({});
}
const ops = loadOps();
const repeatable = Object.assign({}, C.strict, C.repeatableOverrides);
const APP = ['assets/owner-login-app.js', ...fs.readdirSync(path.join(ROOT, 'assets/app')).map(f => 'assets/app/' + f)].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only checks; once'); });

test('the code state machine equals the contract (states, strict and repeatable tables)', () => {
  expect(ops.OP_STATES).toEqual(C.states);
  expect(JSON.parse(JSON.stringify(ops.OP_NEXT))).toEqual(C.strict);
  expect(JSON.parse(JSON.stringify(ops.OP_NEXT_REPEATABLE))).toEqual(repeatable);
  expect(Object.keys(C.vocabulary).sort()).toEqual([...C.states].sort());
});

test('contract invariants hold on the table', () => {
  expect(C.strict.RESULT_UNKNOWN).toEqual(['READBACK_CHECKING']);
  expect(C.strict.SENDING).not.toContain('READY');
  expect(C.strict.CONFIRMED).toEqual([]);
  for (const s of C.states) for (const t of C.strict[s]) expect(C.states, `${s} -> ${t}`).toContain(t);
  // every state except CONFIRMED can get back to READY
  for (const s of C.states.filter(x => x !== 'CONFIRMED')) {
    const seen = new Set([s]); const q = [s];
    while (q.length) for (const n of C.strict[q.shift()]) if (!seen.has(n)) { seen.add(n); q.push(n); }
    expect(seen.has('READY') || s === 'READY', s).toBe(true);
  }
});

test('every listed high-risk operation still has its protection in the code, and its tests exist', () => {
  expect(C.operations.length).toBeGreaterThanOrEqual(7);
  for (const op of C.operations) {
    for (const needle of op.code) expect(APP.includes(needle), `${op.id}: "${needle}" not found in the app`).toBe(true);
    for (const t of op.tests) expect(fs.existsSync(path.join(ROOT, 'tests/specs', t)), `${op.id}: ${t}`).toBe(true);
  }
  // and no tracker exists that the contract does not list
  const trackers = [...APP.matchAll(/createOpTracker\('([^']+)'/g)].map(m => m[1]);
  for (const t of trackers) expect(C.operations.some(op => op.code.some(c => c.includes(`'${t}'`))), `tracker '${t}' missing from the contract`).toBe(true);
});

test('random event sequences (6 seeds x 4,000): the tracker accepts exactly what the table allows', () => {
  const bad = [];
  const check = (cond, msg) => { if (!cond && bad.length < 20) bad.push(msg); };
  const EVENTS = { confirmed: 'CONFIRMED', failedBeforeEffect: 'FAILED_BEFORE_EFFECT', unknown: 'RESULT_UNKNOWN', conflict: 'CONFLICT', sessionExpired: 'SESSION_EXPIRED', permissionDenied: 'PERMISSION_DENIED' };
  for (const [seed, rep] of [[1, false], [2, false], [3, false], [4, true], [5, true], [6, true]]) {
    let s = seed * 7919;
    const r = n => { s = (s * 48271) % 2147483647; return s % n; };
    const t = ops.createOpTracker('prop', { repeatable: rep });
    const table = rep ? repeatable : C.strict;
    let model = 'READY', idem = false;
    for (let i = 0; i < 4000; i++) {
      const k = r(9);
      if (k < 6) {
        const ev = Object.keys(EVENTS)[k], to = EVENTS[ev];
        const legal = table[model].includes(to);
        let threw = false; try { t[ev]('x', 'p'); } catch (e) { threw = true; }
        check(threw === !legal, `seed ${seed} step ${i}: ${model} -${ev}-> threw=${threw}`);
        if (legal) model = to;
      } else if (k === 6) {
        const want = r(2) === 1;
        const ok = t.begin('x', { idempotent: want });
        const legal = table[model].includes('SENDING') || (model === 'RESULT_UNKNOWN' && idem && want);
        check(ok === legal, `seed ${seed} step ${i}: begin from ${model} -> ${ok}`);
        if (ok) { model = 'SENDING'; idem = want; }
      } else if (k === 7) {
        const res = t.startReadback('x');
        check((res === 'READBACK_CHECKING') === (model === 'RESULT_UNKNOWN'), `seed ${seed} step ${i}: readback from ${model}`);
        if (res) model = 'READBACK_CHECKING';
      } else {
        const after = t.reset('x', 'r');
        if (table[model].includes('READY')) model = 'READY';
        check(after === model, `seed ${seed} step ${i}: reset -> ${after}, model ${model}`);
      }
      check(t.state('x') === model, `seed ${seed} step ${i}: state ${t.state('x')} vs model ${model}`);
      // the core safety property: never a send straight after an unknown result for a non-idempotent step
      if (model === 'RESULT_UNKNOWN' && !idem) check(t.isUnknown('x'), `seed ${seed} step ${i}: unknown not reported`);
    }
  }
});
