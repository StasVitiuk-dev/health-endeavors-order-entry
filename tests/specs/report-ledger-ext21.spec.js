// Daily report totals vs a synthetic ledger (wave-1 item 4). Pure, Node-only,
// synthetic. A ledger with a canceled order, a partial refund, an expense and
// an order near the business-day boundary is aggregated into daily rows; the
// visible totals must reconcile with the exported rows, a canceled order must
// not count, a refund must reduce net revenue, an expense must stay out of
// revenue, and an unknown amount must stay UNKNOWN (never shown as $0).
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RX = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// Business day runs in a UTC-8 zone. The last order is at 23:30 local on the
// 7th, which is 07:30 UTC on the 8th — it must land on the 7th, not the 8th.
const OFFSET = -8;
const ledger = [
  { type: 'order', at: '2026-11-07T09:00:00-08:00', amount: 100.00, orderId: 'A' },
  { type: 'order', at: '2026-11-07T10:00:00-08:00', amount: 50.00, orderId: 'B' },
  { type: 'cancel', at: '2026-11-07T11:00:00-08:00', amount: 50.00, orderId: 'B' }, // B canceled
  { type: 'refund', at: '2026-11-07T12:00:00-08:00', amount: 30.00, orderId: 'A' }, // partial refund on A
  { type: 'expense', at: '2026-11-07T13:00:00-08:00', amount: 25.00 },
  { type: 'order', at: '2026-11-07T23:30:00-08:00', amount: 40.00, orderId: 'C' },   // boundary order (07:30 UTC on 8th)
];

test('ledger reconciles: cancel excluded, refund nets down, expense separate, boundary correct', () => {
  const rows = RX.summarizeLedger(ledger, { offsetHours: OFFSET });
  // all events fall on the 7th (business day), including the boundary order
  expect(rows.length).toBe(1);
  const day = rows[0];
  expect(day.report_date).toBe('2026-11-07');
  // orders: A + B + C = 3, minus canceled B = 2
  expect(day.orders_count).toBe(2);
  expect(day.canceled_count).toBe(1);
  // revenue = (A 100 + B 50 + C 40) - B cancel 50 - refund 30 = 110
  expect(day.revenue).toBe(110);
  expect(day.refunds).toBe(30);
  // expense stays out of revenue
  expect(day.expenses).toBe(25);
});

test('visible totals equal the exported rows (one data path)', () => {
  const rows = RX.summarizeLedger(ledger, { offsetHours: OFFSET });
  const manifest = RX.buildManifest({ history: rows });
  // the manifest packages exactly the same rows the summary shows
  expect(manifest.payload.reports[0].report_date).toBe('2026-11-07');
  expect(manifest.payload.reports[0].orders_count).toBe(2);
  const summary = RX.dailySummary(RX.selectReports(rows, {}));
  expect(summary.orders_count).toBe(2); // visible roll-up matches the export basis
  expect(RX.verifyManifest(manifest).ok).toBe(true);
});

test('an order with an unknown amount makes revenue UNKNOWN, never $0', () => {
  const rows = RX.summarizeLedger([
    { type: 'order', at: '2026-11-07T09:00:00-08:00', amount: null, orderId: 'X' }, // amount not yet known
  ], { offsetHours: OFFSET });
  expect(rows[0].orders_count).toBe(1);
  expect(rows[0].revenue).toBe('UNKNOWN'); // distinguishable from a real 0
  expect(rows[0].revenue).not.toBe(0);
});

test('the boundary order would land on the next day under a UTC convention', () => {
  // Same ledger, but no offset (UTC): the 23:30-08:00 order is 07:30Z on the 8th.
  const rows = RX.summarizeLedger(ledger, { offsetHours: 0 });
  const days = rows.map(r => r.report_date);
  expect(days).toContain('2026-11-08');     // boundary order moved to the 8th
  const d8 = rows.find(r => r.report_date === '2026-11-08');
  expect(d8.orders_count).toBe(1);          // only the boundary order
});
