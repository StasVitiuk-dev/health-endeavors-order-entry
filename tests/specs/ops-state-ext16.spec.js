// EXT16: the high-risk operation state machine (assets/app/he-ops.js), Node only.
//   * the rules a person relies on: no second send in flight, none after a
//     confirmed receipt, none after an unknown result (unless the database step
//     refuses duplicates), an unknown result leaves only through a read-back;
//   * every transition not in the table throws (never a silent success);
//   * randomized event sequences (seeded) against an independent reference model.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('@playwright/test');
const ROOT = path.join(__dirname, '..', '..');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

function load() {
  let factory = null;
  const window = { HE: { modules: { define: (name, meta, f) => { factory = f; } } } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets', 'app', 'he-ops.js'), 'utf8'), { window });
  return factory({});
}
const { createOpTracker, OP_STATES } = load();

test('the operator rules', () => {
  const t = createOpTracker('PO receive');
  expect(t.state('po1')).toBe('READY');
  expect(t.begin('po1')).toBe(true);
  expect(t.begin('po1')).toBe(false);            // double click while sending
  t.confirmed('po1');
  expect(t.begin('po1')).toBe(false);            // no second receipt
  expect(() => t.unknown('po1')).toThrow(/refused transition CONFIRMED -> RESULT_UNKNOWN/);

  expect(t.begin('po2')).toBe(true);
  t.unknown('po2', 'reply lost');
  expect(t.isUnknown('po2')).toBe(true);
  expect(t.begin('po2')).toBe(false);            // never resent after an unknown result
  expect(t.begin('po2', { idempotent: true })).toBe(false); // the attempt itself was not idempotent
  expect(() => t.resolved('po2')).toThrow();     // only through a read-back
  expect(t.startReadback('po2')).toBe('READBACK_CHECKING');
  t.stillUnknown('po2');                         // read-back failed
  expect(t.begin('po2')).toBe(false);
  t.startReadback('po2'); t.resolved('po2', 'not received'); t.reset('po2');
  expect(t.begin('po2')).toBe(true);             // safe again only after the check said so

  // idempotent database step: a person may press again after an unknown result
  expect(t.begin('po3', { idempotent: true })).toBe(true);
  t.unknown('po3', 'reply lost');
  expect(t.isUnknown('po3')).toBe(false);
  expect(t.begin('po3')).toBe(false);            // but only as the same idempotent step
  expect(t.begin('po3', { idempotent: true })).toBe(true);

  // failed before any effect: a retry is allowed
  t.failedBeforeEffect('po3'); expect(t.begin('po3', { idempotent: true })).toBe(true);
  // conflict / expiry / refusal: the screen re-reads, then READY
  t.conflict('po3'); expect(t.begin('po3')).toBe(false); t.reset('po3'); expect(t.begin('po3')).toBe(true);
  t.sessionExpired('po3'); expect(() => t.confirmed('po3')).toThrow(); t.reset('po3');
  expect(t.begin('po3')).toBe(true); t.permissionDenied('po3'); expect(() => t.confirmed('po3')).toThrow();
  expect(t.history('po3').length).toBeGreaterThan(5);
});

// Independent reference model: written from the rules above, not from the table.
function model() {
  const st = new Map(); const get = k => st.get(k) || { s: 'READY', idem: false };
  return {
    begin(k, idem) {
      const r = get(k);
      const ok = ['READY', 'VALIDATING', 'FAILED_BEFORE_EFFECT'].includes(r.s) || (r.s === 'RESULT_UNKNOWN' && r.idem && idem);
      if (ok) st.set(k, { s: 'SENDING', idem });
      return ok;
    },
    outcome(k, to) { // after SENDING; a read-back may also end as unknown again or as a conflict
      const r = get(k);
      const ok = r.s === 'SENDING' || (r.s === 'READBACK_CHECKING' && ['RESULT_UNKNOWN', 'CONFLICT'].includes(to));
      if (!ok) return false; st.set(k, { s: to, idem: r.idem }); return true;
    },
    readback(k) { const r = get(k); if (r.s !== 'RESULT_UNKNOWN') return false; st.set(k, { s: 'READBACK_CHECKING', idem: r.idem }); return true; },
    afterReadback(k, to) { const r = get(k); if (r.s !== 'READBACK_CHECKING') return false; st.set(k, { s: to, idem: r.idem }); return true; },
    reset(k) { const r = get(k); if (['CONFLICT', 'SESSION_EXPIRED', 'PERMISSION_DENIED', 'RESOLVED', 'FAILED_BEFORE_EFFECT', 'VALIDATING'].includes(r.s)) st.set(k, { s: 'READY', idem: r.idem }); },
    state: k => get(k).s,
  };
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

for (const seed of [1601, 1602, 1603, 1604, 1605]) {
  test(`random event sequences (seed ${seed}, 5,000 events over 4 records) match the reference model`, () => {
    const r = rng(seed), t = createOpTracker('x'), m = model(), keys = ['a', 'b', 'c', 'd'];
    const OUT = ['CONFIRMED', 'FAILED_BEFORE_EFFECT', 'RESULT_UNKNOWN', 'CONFLICT', 'SESSION_EXPIRED', 'PERMISSION_DENIED'];
    const call = { CONFIRMED: 'confirmed', FAILED_BEFORE_EFFECT: 'failedBeforeEffect', RESULT_UNKNOWN: 'unknown', CONFLICT: 'conflict', SESSION_EXPIRED: 'sessionExpired', PERMISSION_DENIED: 'permissionDenied' };
    const fail = (where, msg) => { throw new Error(where + ': ' + msg); };
    const throws = f => { try { f(); return false; } catch (e) { return true; } };
    for (let i = 0; i < 5000; i++) {
      const k = keys[Math.floor(r() * keys.length)], op = Math.floor(r() * 5), where = `seed ${seed} event ${i} on ${k} (state ${t.state(k)})`;
      if (op === 0) { const idem = r() < 0.3; const a = t.begin(k, { idempotent: idem }), b = m.begin(k, idem); if (a !== b) fail(where, `begin(idempotent=${idem}) gave ${a}, model ${b}`); }
      else if (op === 1) { const to = OUT[Math.floor(r() * OUT.length)]; const ok = m.outcome(k, to); if (ok) t[call[to]](k); else if (!throws(() => t[call[to]](k))) fail(where, `outcome ${to} accepted, model refuses`); }
      else if (op === 2) { const ok = m.readback(k); if ((t.startReadback(k) !== null) !== ok) fail(where, 'read-back start disagrees'); }
      else if (op === 3) { const to = r() < 0.5 ? 'RESOLVED' : 'RESULT_UNKNOWN'; const ok = m.afterReadback(k, to); const fn = to === 'RESOLVED' ? 'resolved' : 'stillUnknown'; if (ok) t[fn](k); else if (!throws(() => t[fn](k))) fail(where, `${fn} accepted, model refuses`); }
      else { m.reset(k); t.reset(k); }
      if (t.state(k) !== m.state(k)) fail(where, `state ${t.state(k)}, model ${m.state(k)}`);
      if (!OP_STATES.includes(t.state(k))) fail(where, 'unknown state');
      if (t.state(k) === 'CONFIRMED' && t.begin(k, { idempotent: true })) fail(where, 'confirmed is final');
    }
  });
}
