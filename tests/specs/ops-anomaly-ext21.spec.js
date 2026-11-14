// #26 Operations watch (daily figures, stock, orders). Pure, Node-only,
// synthetic, ADVISORY: it raises flags and changes nothing. An unknown figure is
// never treated as 0; thresholds are uncalibrated starting values; acknowledging
// a flag never resolves it.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const A = require('../../assets/reports/he-ops-anomaly.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const kinds = r => r.flags.map(f => f.key);
const DAYS = (revs) => revs.map((rev, i) => ({ report_date: '2026-11-0' + (i + 1), orders_count: rev == null ? 3 : 5, revenue: rev }));

test('the worked example raises one flag of each kind, most serious first', () => {
  const r = A.scan(A.fixtures());
  expect(kinds(r)).toEqual([
    'negative-stock|SYN-VEGAN-8OZ',
    'missing-day|2026-11-11',
    'order-total-not-positive|SYN-1004',
    'possible-duplicate-order|SYN-1003',
    'reserved-over-stock|SYN-SHEA-4OZ',
    'revenue-drop|2026-11-13',
    'revenue-not-measured|2026-11-12',
    'unusually-large-order|SYN-1006',
  ]);
  expect(r.bySeverity).toEqual({ CRITICAL: 1, WARNING: 6, INFO: 1 });
  expect(r.advisory).toBe(true);
  expect(r.calibrated).toBe(false);
  expect(r.guard).toMatch(/nothing is paused, changed or corrected/);
  r.flags.forEach(f => expect(f.nextAction.length).toBeGreaterThan(10));
});

test('a healthy business raises nothing', () => {
  const r = A.scan({
    daily: DAYS([300, 310, 290, 305, 315]),
    stock: [{ sku: 'SYN-A', onHand: 10, reserved: 10 }, { sku: 'SYN-B', onHand: 0, reserved: 0 }],
    orders: [1, 2, 3, 4, 5, 6].map(n => ({ id: 'O' + n, customer: 'C' + n, total: 40 + n, itemsCount: 2, at: '2026-11-05T1' + n + ':00:00Z' })),
  });
  expect(r.flags).toEqual([]);
  expect(A.scan(null).flags).toEqual([]);
  expect(A.scan({ daily: [], stock: [], orders: [] }).total).toBe(0);
});

test('an unknown revenue is a reported gap, never a zero and never a "drop"', () => {
  // The latest day is unknown: no revenue-drop may be claimed from it.
  const latestUnknown = A.scan({ daily: DAYS([300, 310, 290, null]) });
  expect(kinds(latestUnknown)).toEqual(['revenue-not-measured|2026-11-04']);
  // Unknown days in the history are left out of the average, not counted as 0.
  const r = A.scan({ daily: DAYS([300, null, 300, 300, 290]) });
  expect(kinds(r)).toEqual(['revenue-not-measured|2026-11-02']);   // 290 vs average 300 -> no drop
  // "UNKNOWN" (how exports write it) is treated the same way.
  expect(kinds(A.scan({ daily: [{ report_date: '2026-11-01', orders_count: 2, revenue: 'UNKNOWN' }] }))).toEqual(['revenue-not-measured|2026-11-01']);
  // A day with no orders and no revenue figure is not a gap.
  expect(A.scan({ daily: [{ report_date: '2026-11-01', orders_count: 0, revenue: null }] }).flags).toEqual([]);
});

test('comparisons wait for enough history; a real zero day is judged against what is normal', () => {
  expect(A.scan({ daily: DAYS([300, 310, 20]) }).flags).toEqual([]);                 // only 2 prior days
  expect(kinds(A.scan({ daily: DAYS([300, 310, 290, 20]) }))).toEqual(['revenue-drop|2026-11-04']);
  expect(kinds(A.scan({ daily: DAYS([100, 100, 100, 301]) }))).toEqual(['revenue-spike|2026-11-04']);
  const stopped = [1, 2, 3].map(d => ({ report_date: '2026-11-0' + d, orders_count: 4, revenue: 200 })).concat([{ report_date: '2026-11-04', orders_count: 0, revenue: 0 }]);
  expect(kinds(A.scan({ daily: stopped }))).toEqual(['orders-stopped|2026-11-04', 'revenue-drop|2026-11-04']);
  // A shop that normally sells about one a day is not alarmed by a zero day.
  const quiet = [1, 2, 3].map(d => ({ report_date: '2026-11-0' + d, orders_count: 1, revenue: 0 })).concat([{ report_date: '2026-11-04', orders_count: 0, revenue: 0 }]);
  expect(A.scan({ daily: quiet }).flags).toEqual([]);
});

test('missing days are named one by one, across a month end, whatever order the rows arrive in', () => {
  const rows = [{ report_date: '2026-12-02', orders_count: 1, revenue: 10 }, { report_date: '2026-11-29', orders_count: 1, revenue: 10 }];
  expect(kinds(A.scan({ daily: rows }))).toEqual(['missing-day|2026-11-30', 'missing-day|2026-12-01']);
});

test('stock: below zero is critical; promised-over-shelf is a warning; equal is fine; unknown is skipped', () => {
  const r = A.scan({ stock: [
    { sku: 'NEG', onHand: -1 }, { sku: 'OVER', onHand: 2, reserved: 3 }, { sku: 'EQUAL', onHand: 3, reserved: 3 },
    { sku: 'UNK', onHand: null, reserved: 5 }, { onHand: -9 },
  ] });
  expect(r.flags.map(f => [f.key, f.severity])).toEqual([['negative-stock|NEG', 'CRITICAL'], ['reserved-over-stock|OVER', 'WARNING']]);
});

test('orders: duplicates need the same customer, the same total and a short gap; cancelled orders are ignored', () => {
  const o = (id, customer, total, at, extra) => Object.assign({ id, customer, total, itemsCount: 1, at }, extra || {});
  const r = A.scan({ orders: [
    o('A', 'C1', 50, '2026-11-13T10:00:00Z'),
    o('B', 'C1', 50, '2026-11-13T10:09:00Z'),                       // 9 min -> flagged
    o('C', 'C1', 50, '2026-11-13T10:30:00Z'),                       // 21 min after B -> not flagged
    o('D', 'C2', 50, '2026-11-13T10:31:00Z'),                       // different customer
    o('E', 'C2', 51, '2026-11-13T10:32:00Z'),                       // different total
    o('F', 'C3', 0, '2026-11-13T11:00:00Z', { status: 'cancelled' }), // cancelled: ignored entirely
  ] });
  expect(kinds(r)).toEqual(['possible-duplicate-order|B']);
  expect(A.scan({ orders: [o('A', 'C1', 50, '2026-11-13T10:00:00Z'), o('B', 'C1', 50, '2026-11-13T10:09:00Z')] }, { duplicateWindowMinutes: 5 }).flags).toEqual([]);
});

test('a large order is only "unusual" against enough other orders, and is information, not a warning', () => {
  const few = [40, 45, 400].map((t, i) => ({ id: 'O' + i, customer: 'C' + i, total: t, itemsCount: 1, at: '2026-11-13T1' + i + ':00:00Z' }));
  expect(A.scan({ orders: few }).flags).toEqual([]);
  const enough = [40, 45, 42, 48, 400].map((t, i) => ({ id: 'O' + i, customer: 'C' + i, total: t, itemsCount: 1, at: '2026-11-13T1' + i + ':00:00Z' }));
  const r = A.scan({ orders: enough });
  expect(r.flags.map(f => [f.key, f.severity])).toEqual([['unusually-large-order|O4', 'INFO']]);
});

test('acknowledging a flag does not resolve it; it resolves only when a later check no longer finds it', () => {
  const first = A.scan(A.fixtures());
  let items = A.review([], first.flags);
  expect(A.summary(items)).toEqual({ open: 8, acknowledged: 0, resolved: 0, stillPresent: 8 });
  const ack = A.acknowledge(items, 'negative-stock|SYN-VEGAN-8OZ', { by: 'owner', at: '2026-11-14T09:00:00Z' });
  expect(ack.ok).toBe(true);
  items = ack.items;
  expect(A.summary(items)).toMatchObject({ open: 7, acknowledged: 1, resolved: 0, stillPresent: 8 });
  expect(A.acknowledge(items, 'negative-stock|SYN-VEGAN-8OZ', { by: 'owner' }).reason).toMatch(/already acknowledged/);
  expect(A.acknowledge(items, 'nope', { by: 'owner' }).reason).toMatch(/no such flag/);
  // Same data again: the acknowledgement is kept and nothing is resolved.
  items = A.review(items, A.scan(A.fixtures()).flags);
  expect(items.find(i => i.key === 'negative-stock|SYN-VEGAN-8OZ')).toMatchObject({ state: 'ACKNOWLEDGED', acknowledged: { by: 'owner' } });
  expect(A.summary(items).resolved).toBe(0);
  // The stock is counted and corrected (by a person, elsewhere): the next check clears it.
  const fx = A.fixtures(); fx.stock[1].onHand = 12;
  items = A.review(items, A.scan(fx).flags);
  const cleared = items.find(i => i.key === 'negative-stock|SYN-VEGAN-8OZ');
  expect(cleared).toMatchObject({ state: 'RESOLVED', resolvedBecause: 'no longer found on the latest check' });
  expect(A.summary(items)).toMatchObject({ resolved: 1, stillPresent: 7 });
  expect(A.acknowledge(items, cleared.key, { by: 'owner' }).reason).toMatch(/already resolved/);
});

test('deterministic and input is never mutated', () => {
  const fx = A.fixtures(); const before = JSON.stringify(fx);
  const a = JSON.stringify(A.scan(fx));
  fx.daily.reverse(); fx.stock.reverse(); fx.orders.reverse();
  expect(JSON.stringify(A.scan(fx))).toBe(a);
  fx.daily.reverse(); fx.stock.reverse(); fx.orders.reverse();
  expect(JSON.stringify(fx)).toBe(before);
});
