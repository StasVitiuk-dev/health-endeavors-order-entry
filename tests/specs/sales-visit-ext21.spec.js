// In-person sample visit log (FU5 wholesale advance). Pure, Node-only, synthetic.
// A hand-delivered sample visit consumes stock on the spot and carries an
// outcome; the log is idempotent (interrupted retry never double-counts), never
// fabricates a missing cost, maps outcomes onto the sample lifecycle, and names
// the missing production write contract. Advisory only — never sends or writes stock.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const V = require('../../assets/sales/he-sales-visit.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('a visit records stock, cost and outcome; outcome maps onto the sample lifecycle', () => {
  const log = V.createVisitLog();
  const r = log.record({ store: 'SYN-Bright', date: '2026-11-09', kitId: 'A', jars: 6, unitCost: 0.29, outcome: 'ORDERED', by: 'owner' });
  expect(r.ok).toBe(true);
  expect(r.visit.jars).toBe(6);
  expect(r.visit.sampleCost).toBe(1.74);              // 6 * 0.29
  expect(r.visit.costBasis).toBe('ACTUAL');
  expect(r.visit.suggestedSampleState).toBe('CONVERTED'); // ORDERED -> CONVERTED
  expect(log.stockConsumed()).toBe(6);
});

test('an interrupted retry of the same visit never double-counts', () => {
  const log = V.createVisitLog();
  const key = 'SYN-Bright|2026-11-09|A';
  expect(log.record({ key: key, store: 'SYN-Bright', jars: 4, unitCost: 0.29, outcome: 'FOLLOW_UP' }).ok).toBe(true);
  const dup = log.record({ key: key, store: 'SYN-Bright', jars: 4, unitCost: 0.29, outcome: 'FOLLOW_UP' });
  expect(dup.ok).toBe(false);
  expect(dup.duplicate).toBe(true);
  expect(log.stockConsumed()).toBe(4);                // unchanged
  expect(log.all()).toHaveLength(1);
});

test('an unknown unit cost never becomes a fake $0', () => {
  const log = V.createVisitLog();
  const r = log.record({ store: 'SYN-Coast', date: '2026-11-09', kitId: 'B', jars: 3, outcome: 'DECLINED' }); // no unitCost
  expect(r.visit.sampleCost).toBe(null);
  expect(r.visit.costBasis).toBe('UNKNOWN');
  expect(r.visit.suggestedSampleState).toBe('NO_ORDER');
  const tc = log.totalCost();
  expect(tc.unknownCount).toBe(1);
  expect(tc.costBasis).toBe('PARTIAL/UNKNOWN');
});

test('multiple visits reconcile stock, cost and outcomes; the write contract is named', () => {
  const log = V.createVisitLog();
  log.record({ store: 'A', date: 'd1', kitId: 'k', jars: 2, unitCost: 0.30, outcome: 'ORDERED' });
  log.record({ store: 'B', date: 'd1', kitId: 'k', jars: 5, unitCost: 0.30, outcome: 'FOLLOW_UP' });
  log.record({ store: 'C', date: 'd1', kitId: 'k', jars: 1, outcome: 'DECLINED' }); // unknown cost
  expect(log.stockConsumed()).toBe(8);                // 2 + 5 + 1
  expect(log.totalCost().known).toBe(2.10);           // (2+5)*0.30
  expect(log.totalCost().unknownCount).toBe(1);
  expect(log.outcomes()).toMatchObject({ ORDERED: 1, FOLLOW_UP: 1, DECLINED: 1, PENDING: 0 });
  expect(V.MISSING_WRITE_CONTRACT).toMatch(/adjust_inventory|R4/);
  expect(V.MISSING_WRITE_CONTRACT).toMatch(/advisory|read-only/i);
});
