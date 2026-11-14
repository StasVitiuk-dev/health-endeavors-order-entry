// #08 Reconciliation engine. Pure, Node-only, synthetic, advisory. Expected
// amounts (invoices) vs recorded amounts (payments): every difference gets an
// explicit outcome and a review state; nothing is ever adjusted, and an unknown
// amount is never treated as 0 or counted as matched.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const R = require('../../assets/reports/he-reconcile.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const byRef = (res, ref, outcome) => res.items.find(i => i.ref === ref && (!outcome || i.outcome === outcome));

test('each kind of difference is named: matched, short, over, missing, unexpected, duplicate', () => {
  const f = R.fixtures();
  const res = R.reconcile(f.expected, f.recorded);
  expect(byRef(res, 'HE-2026-0001')).toMatchObject({ outcome: 'MATCHED', expected: 272.53, recorded: 272.53, difference: 0, reviewState: 'NOT_NEEDED' });
  expect(byRef(res, 'HE-2026-0002')).toMatchObject({ outcome: 'UNDERPAID', difference: -30, reviewState: 'OPEN' });
  expect(byRef(res, 'HE-2026-0003')).toMatchObject({ outcome: 'MISSING', recorded: 0, difference: -96.4 });
  // 0004: two distinct payments of 55 -> over by 55; the third listing repeats an id and is not counted.
  expect(byRef(res, 'HE-2026-0004', 'OVERPAID')).toMatchObject({ expected: 55, recorded: 110, difference: 55 });
  expect(byRef(res, 'HE-2026-0004', 'DUPLICATE')).toMatchObject({ entryIds: ['SYN-P5'], reviewState: 'OPEN' });
  expect(byRef(res, 'HE-2026-0099')).toMatchObject({ outcome: 'UNEXPECTED', expected: null, recorded: 20 });
  expect(res.counts).toMatchObject({ MATCHED: 1, UNDERPAID: 1, OVERPAID: 1, MISSING: 1, UNEXPECTED: 1, DUPLICATE: 1 });
  expect(res.balanced).toBe(false);
  expect(res.open).toBe(5);
  expect(res.label).toBe('SIMULATED');
  expect(res.guard).toMatch(/no money is moved/);
});

test('totals are in whole cents, leave the duplicate out, and add up line by line', () => {
  const f = R.fixtures();
  const res = R.reconcile(f.expected, f.recorded);
  expect(res.totals.expected).toBe(603.93);            // 272.53 + 180 + 96.40 + 55
  expect(res.totals.recorded).toBe(552.53);            // 272.53 + 150 + 0 + 110 + 20 (repeat of SYN-P5 excluded)
  expect(res.totals.difference).toBe(-51.4);
  expect(res.totals.complete).toBe(true);
  const lineSum = res.items.filter(i => i.difference != null).reduce((s, i) => s + Math.round(i.difference * 100), 0);
  expect(lineSum).toBe(Math.round(res.totals.difference * 100));
  // classic float trap: 0.1 + 0.2 against 0.3 is an exact match
  expect(R.reconcile([{ ref: 'A', amount: 0.3 }], [{ id: '1', ref: 'A', amount: 0.1 }, { id: '2', ref: 'A', amount: 0.2 }]).items[0].outcome).toBe('MATCHED');
});

test('an unknown amount is never treated as 0 and never counts as matched', () => {
  const res = R.reconcile(
    [{ ref: 'A', amount: null }, { ref: 'B', amount: 50 }, { ref: 'C', amount: 0 }],
    [{ id: '1', ref: 'A', amount: 10 }, { id: '2', ref: 'B', amount: null }, { id: '3', ref: 'C', amount: 0 }]);
  expect(byRef(res, 'A')).toMatchObject({ outcome: 'UNKNOWN_AMOUNT', expected: null, reviewState: 'OPEN' });
  expect(byRef(res, 'B')).toMatchObject({ outcome: 'UNKNOWN_AMOUNT', recorded: null });
  expect(byRef(res, 'C').outcome).toBe('MATCHED');     // a real, known zero is a match
  expect(res.totals.complete).toBe(false);
  expect(res.totals.note).toMatch(/not complete/);
  expect(res.balanced).toBe(false);
});

test('a payment in another currency is flagged, not converted', () => {
  const res = R.reconcile([{ ref: 'A', amount: 100, currency: 'USD' }], [{ id: '1', ref: 'A', amount: 100, currency: 'CAD' }]);
  expect(res.items[0]).toMatchObject({ outcome: 'CURRENCY_MISMATCH', recorded: null, difference: null });
  expect(res.totals.complete).toBe(false);
});

test('exact by default; a tolerance is an explicit choice', () => {
  const exp = [{ ref: 'A', amount: 100 }]; const rec = [{ id: '1', ref: 'A', amount: 99.99 }];
  expect(R.reconcile(exp, rec).items[0].outcome).toBe('UNDERPAID');
  expect(R.reconcile(exp, rec).toleranceCents).toBe(0);
  const loose = R.reconcile(exp, rec, { toleranceCents: 1 });
  expect(loose.items[0]).toMatchObject({ outcome: 'MATCHED', difference: -0.01, detail: 'within the allowed tolerance' });
  expect(R.reconcile(exp, rec, { toleranceCents: -5 }).toleranceCents).toBe(0);
});

test('closing a difference needs an owner or administrator and a written note; figures never change', () => {
  const f = R.fixtures();
  const res = R.reconcile(f.expected, f.recorded);
  const short = byRef(res, 'HE-2026-0002');
  expect(R.markReviewed(res, short.line, { role: 'staff', note: 'customer will pay Friday' }).reason).toMatch(/owner or administrator/);
  expect(R.markReviewed(res, short.line, { role: 'owner', note: 'ok' }).reason).toMatch(/note is required/);
  expect(R.markReviewed(res, byRef(res, 'HE-2026-0001').line, { role: 'owner', note: 'looks right' }).reason).toMatch(/needs no review/);
  expect(R.markReviewed(res, 999, { role: 'owner', note: 'looks right' }).reason).toMatch(/no such line/);
  const done = R.markReviewed(res, short.line, { role: 'administrator', by: 'admin-1', at: '2026-11-14T12:00:00Z', note: 'Customer confirmed the balance arrives Friday.' });
  expect(done.ok).toBe(true);
  const after = done.result.items.find(i => i.line === short.line);
  expect(after).toMatchObject({ reviewState: 'REVIEWED', outcome: 'UNDERPAID', expected: 180, recorded: 150, difference: -30 });
  expect(after.review).toMatchObject({ by: 'admin-1', role: 'administrator' });
  expect(done.result.totals).toEqual(res.totals);                      // the money figures are untouched
  expect(done.result.open).toBe(res.open - 1);
  expect(done.result.audit).toEqual([{ action: 'REVIEWED', line: short.line, ref: 'HE-2026-0002', outcome: 'UNDERPAID', by: 'admin-1', at: '2026-11-14T12:00:00Z' }]);
  expect(short.reviewState).toBe('OPEN');                              // the original was not mutated
  expect(R.markReviewed(done.result, short.line, { role: 'owner', note: 'second look' }).reason).toMatch(/already reviewed/);
});

test('closed is not the same as balanced', () => {
  const f = R.fixtures();
  let res = R.reconcile(f.expected, f.recorded);
  expect(R.status(res)).toMatchObject({ state: 'NEEDS_REVIEW', balanced: false, closed: false, open: 5 });
  res.items.filter(i => i.reviewState === 'OPEN').forEach(i => {
    res = R.markReviewed(res, i.line, { role: 'owner', at: '2026-11-14T12:00:00Z', note: 'Reviewed with the bank statement.' }).result;
  });
  expect(R.status(res)).toMatchObject({ state: 'CLOSED_WITH_DIFFERENCES', balanced: false, closed: true, open: 0, reviewed: 5 });
  expect(res.totals.difference).toBe(-51.4);                           // still short — reviewing does not make money appear
  const clean = R.reconcile([{ ref: 'A', amount: 10 }], [{ id: '1', ref: 'A', amount: 10 }]);
  expect(R.status(clean)).toMatchObject({ state: 'BALANCED', balanced: true, closed: true });
});

test('deterministic, tolerant of empty or odd input, and never throws', () => {
  const f = R.fixtures();
  expect(JSON.stringify(R.reconcile(f.expected, f.recorded))).toBe(JSON.stringify(R.reconcile(f.expected, f.recorded.slice().reverse())));
  expect(R.reconcile(null, null)).toMatchObject({ items: [], balanced: true, open: 0 });
  expect(R.reconcile([], [{ amount: 5 }]).items[0]).toMatchObject({ outcome: 'UNEXPECTED', detail: 'recorded with no reference' });
  expect(R.status(null)).toMatchObject({ state: 'BALANCED' });
});
