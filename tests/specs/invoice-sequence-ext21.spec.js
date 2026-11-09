// Collision-safe invoice number sequence (local item #5, DRAFT model). Pure,
// Node-only, synthetic. reserve() hands out the next number counting committed
// AND in-flight reservations, so two near-simultaneous issues (two tabs) never
// grab the same number; commit() finalizes; a double-commit retry is a no-op;
// release() frees an abandoned reservation. The missing production write
// contract (an atomic DB sequence/RPC) is named.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('two concurrent reservations never collide', () => {
  const seq = INV.createNumberSequence({ used: [] });
  const a = seq.reserve({ year: 2026 });
  const b = seq.reserve({ year: 2026 }); // second tab, before the first commits
  expect(a.number).toBe('HE-2026-0001');
  expect(b.number).toBe('HE-2026-0002'); // distinct — counts the in-flight reservation
  expect(a.number).not.toBe(b.number);
  expect(seq.pending().sort()).toEqual(['HE-2026-0001', 'HE-2026-0002']);
});

test('commit finalizes; a double-commit (retry) is a no-op', () => {
  const seq = INV.createNumberSequence();
  const a = seq.reserve({ year: 2026 });
  const c1 = seq.commit(a.token);
  expect(c1.ok).toBe(true);
  expect(seq.used()).toContain('HE-2026-0001');
  // retry of the same commit does not advance or re-use
  const c2 = seq.commit(a.token);
  expect(c2.ok).toBe(false);
  expect(c2.duplicate).toBe(true);
  // the next reservation continues past the committed one
  expect(seq.reserve({ year: 2026 }).number).toBe('HE-2026-0002');
});

test('releasing the only reservation frees its number; a higher in-flight one leaves a gap', () => {
  const seq = INV.createNumberSequence();
  const a = seq.reserve({ year: 2026 });   // 0001 reserved, nothing else in flight
  expect(seq.release(a.token).ok).toBe(true);
  // nothing reserved or committed -> the next reserve reuses 0001
  expect(seq.reserve({ year: 2026 }).number).toBe('HE-2026-0001');

  // but with a HIGHER reservation still in flight, a released lower number is not
  // back-filled (safer: never risk reusing; a gap is acceptable for invoices)
  const seq2 = INV.createNumberSequence();
  const x = seq2.reserve({ year: 2026 }); // 0001
  seq2.reserve({ year: 2026 });           // 0002 in flight
  seq2.release(x.token);                   // release 0001
  expect(seq2.reserve({ year: 2026 }).number).toBe('HE-2026-0003'); // continues past the max
});

test('the sequence survives a restart from committed numbers and names the missing contract', () => {
  // a durable store would rehydrate from the last committed numbers
  const seq = INV.createNumberSequence({ used: ['HE-2026-0001', 'HE-2026-0002', 'HE-2026-0003'] });
  expect(seq.reserve({ year: 2026 }).number).toBe('HE-2026-0004');
  expect(INV.MISSING_SEQUENCE_CONTRACT).toMatch(/invoice_number_sequence|reserve\+commit/);
  expect(INV.MISSING_SEQUENCE_CONTRACT).toMatch(/in-memory only|not in the local build/);
});
