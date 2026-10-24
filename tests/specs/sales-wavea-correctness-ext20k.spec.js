// Reserve IV — WAVE A: decision-engine correctness. Locks in the fixes for
// date defects, duplicate inputs, missing-account collapse, and the no-silent-
// zero / no-mutation / reference-cross-check guarantees across the five
// decision-intelligence engines. Pure Node, no DOM. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const P = require('../../assets/sales/he-sales-priority.js');
const PR = require('../../assets/sales/he-sales-progression.js');
const C = require('../../assets/sales/he-sales-concentration.js');
const N = require('../../assets/sales/he-sales-nextaction.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const ASOF = '2026-10-20T00:00:00Z';

// A1 — a date AFTER asOf is UNKNOWN, not clamped to 0/FRESH.
test('A1: a future createdAt/enteredStateAt reads UNKNOWN, never a fake age', () => {
  const a = PR.analyze([{ id: 'f', state: 'NEW', createdAt: '2026-12-01T00:00:00Z', enteredStateAt: '2026-12-01T00:00:00Z' }], { asOf: ASOF });
  const r = a.rows[0];
  expect(r.ageDays).toBe(null);
  expect(r.currentStageDays).toBe(null);
  expect(r.agingBucket).toBe('UNKNOWN');
  expect(r.futureDated).toBe(true);
  expect(r.dataComplete).toBe(false);
  expect(r.stalled).toBe(false); // can't be stalled on an unknown dwell
});

// A1 — enteredStateAt before createdAt is contradictory and flagged.
test('A1: enteredStateAt before createdAt is flagged inconsistent, not trusted', () => {
  const a = PR.analyze([{ id: 'c', state: 'CONTACTED', createdAt: '2026-10-10T00:00:00Z', enteredStateAt: '2026-09-01T00:00:00Z' }], { asOf: ASOF });
  const r = a.rows[0];
  expect(r.inconsistentDates).toBe(true);
  expect(r.dataComplete).toBe(false);
});

// A1 — malformed dates do not crash and are not invented.
test('A1: malformed dates yield UNKNOWN, no crash', () => {
  const a = PR.analyze([{ id: 'm', state: 'NEW', createdAt: 'not-a-date', enteredStateAt: 'also-bad' }], { asOf: ASOF });
  expect(a.rows[0].agingBucket).toBe('UNKNOWN');
  expect(a.rows[0].ageDays).toBe(null);
});

// A2 — all time math uses injected asOf, not the wall clock: omitting asOf uses
// the documented default, and two different asOf values give different ages.
test('A2: results are driven by injected asOf, not Date.now()', () => {
  const lead = { id: 'x', state: 'CONTACTED', createdAt: '2026-01-01T00:00:00Z', enteredStateAt: '2026-01-01T00:00:00Z' };
  const early = PR.analyze([lead], { asOf: '2026-02-01T00:00:00Z' }).rows[0].ageDays;
  const late = PR.analyze([lead], { asOf: '2026-03-01T00:00:00Z' }).rows[0].ageDays;
  expect(late).toBeGreaterThan(early);
  expect(early).toBeCloseTo(31, 0);
});

// A3 — equal-score / equal-overBy ordering is stable regardless of input order.
test('A3: priority ranking and stalled ordering are order-independent', () => {
  const leads = [
    { id: 'b', factors: { value: 0.5, fit: 0.5 } },
    { id: 'a', factors: { value: 0.5, fit: 0.5 } }, // identical score to b
    { id: 'c', factors: { value: 0.9, fit: 0.9 } },
  ];
  const f = P.rank(leads, P.DEFAULT_WEIGHTS).ranked.map(x => x.leadId);
  const rrev = P.rank(leads.slice().reverse(), P.DEFAULT_WEIGHTS).ranked.map(x => x.leadId);
  expect(f).toEqual(rrev);
  // ties broken by id ascending among the equal pair
  expect(f.indexOf('a')).toBeLessThan(f.indexOf('b'));
});

// A4 — a repeated id is counted once, and the drop is reported.
test('A4: duplicate ids do not inflate ranking count or concentration', () => {
  const pr = P.rank([{ id: 'a', factors: { value: 0.9 } }, { id: 'a', factors: { value: 0.9 } }, { id: 'b', factors: { value: 0.1 } }], P.DEFAULT_WEIGHTS);
  expect(pr.count).toBe(2);
  expect(pr.duplicatesDropped).toBe(1);
  const c = C.analyze([{ id: 'x', account: 'A', weightedValue: 50 }, { id: 'x', account: 'A', weightedValue: 50 }, { id: 'y', account: 'B', weightedValue: 10 }]);
  expect(c.dealCount).toBe(2);
  expect(c.duplicateIdsDropped).toBe(1);
  expect(c.total).toBe(60); // not 110
});

// A5 — account-less deals are not merged into one fictitious customer, and a
// deal id is never shown as an account name.
test('A5: missing accounts stay distinct unknowns; no deal-id-as-customer', () => {
  const c = C.analyze([{ id: 'd1', weightedValue: 40 }, { id: 'd2', weightedValue: 40 }, { id: 'd3', account: 'Real', weightedValue: 20 }]);
  expect(c.knownAccountCount).toBe(1);
  expect(c.unknownAccountDeals).toBe(2);           // not collapsed into one
  expect(c.topAccount.account).toBe('Real');       // the only known account
  expect(c.topAccountShare).toBeCloseTo(0.2, 10);  // 20/100, not 40/100
  expect(c.flags.map(f => f.code)).not.toContain('SINGLE_ACCOUNT_DEPENDENCY');
  expect(c.topDeal.account).toBe(null);            // top deal has no real customer
});

// A6 — non-positive / unknown values are dropped (reported), never silent zeros.
test('A6: non-positive weighted values are dropped and reported, not zeroed in', () => {
  const c = C.analyze([{ id: 'a', account: 'A', weightedValue: 10 }, { id: 'b', account: 'B', weightedValue: 0 }, { id: 'c', account: 'C', weightedValue: -5 }]);
  expect(c.dealCount).toBe(1);
  expect(c.droppedNonPositive).toBe(2);
  // average age ignores unknown-age actives rather than counting them as 0
  const a = PR.analyze([
    { id: 'k', state: 'CONTACTED', createdAt: '2026-10-10T00:00:00Z', enteredStateAt: '2026-10-10T00:00:00Z' }, // age 10
    { id: 'u', state: 'NEW' }, // no dates -> unknown age
  ], { asOf: ASOF });
  expect(a.avgActiveAgeDays).toBeCloseTo(10, 5); // not (10+0)/2 = 5
});

// A7/A8 — the explanation follows from the inputs and is a priority score, not a
// claimed sales probability.
test('A7/A8: ranking explanation is traceable and not a sales-probability claim', () => {
  const s = P.score({ id: 'a', factors: { value: 1, fit: 0, urgency: 0, momentum: 0, effort: 1, risk: 1 } }, { value: 1 });
  // only the value factor is weighted -> explanation names Account value and
  // the total equals the value contribution.
  expect(s.explain).toMatch(/Account value/);
  expect(s.total).toBeCloseTo(1, 10);
  const r = P.rank([{ id: 'a', factors: { value: 1 } }], P.DEFAULT_WEIGHTS);
  expect(r.guard).not.toMatch(/probability|forecast|guarantee/i);
});

// A9 — a malformed record cannot mutate the caller's input fixtures.
test('A9: engines never mutate their inputs', () => {
  const lead = Object.freeze({ id: 'a', state: 'CONTACTED', factors: Object.freeze({ value: 0.5 }), createdAt: '2026-10-01T00:00:00Z', enteredStateAt: '2026-10-01T00:00:00Z', account: 'A', weightedValue: 5 });
  const batch = Object.freeze([lead]);
  expect(() => P.rank(batch, P.DEFAULT_WEIGHTS)).not.toThrow();
  expect(() => PR.analyze(batch, { asOf: ASOF })).not.toThrow();
  expect(() => C.analyze(batch)).not.toThrow();
  expect(() => N.recommendAll(batch)).not.toThrow();
  expect(lead.state).toBe('CONTACTED'); // unchanged
});

// A10 — large-input results match a smaller trusted reference calculation.
test('A10: concentration totals/HHI match an independent reference', () => {
  const deals = [];
  for (let i = 0; i < 200; i++) deals.push({ id: 'd' + i, account: 'ACC' + (i % 20), weightedValue: (i % 7) + 1 });
  const c = C.analyze(deals);
  // reference: plain sum, and HHI over per-deal shares
  const refTotal = deals.reduce((s, d) => s + d.weightedValue, 0);
  expect(c.total).toBe(refTotal);
  const refDealHHI = deals.reduce((s, d) => { const sh = d.weightedValue / refTotal; return s + sh * sh; }, 0);
  expect(c.dealHHI).toBeCloseTo(refDealHHI, 10);
  expect(c.dealCount).toBe(200); // all unique ids kept
});
