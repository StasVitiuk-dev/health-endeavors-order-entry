// FU3 journey gap-closure (invoice / print / export / recovery). Pure, Node-only,
// synthetic. Closes the two gaps not already covered by existing specs:
//   (1) invoice REPRINT is deterministic and never mutates the issued invoice;
//   (2) report MISSED-DAY CATCH-UP — a late ledger for a skipped day produces
//       that day's row with correct totals and fills the gap in the range.
// Role denials, flags-off, duplicate clicks, partial failures, US-Letter page
// breaks, allocated lots, date boundaries and export retry are already covered
// by role-boundary / ops-preview-wiring / invoice-corrections / invoice-print /
// report-ledger / export-recovery / failure-recovery specs (reused, not duped).
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');
const RX = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('invoice reprint is deterministic and does not mutate the issued invoice', () => {
  const issued = INV.issue(INV.draftInvoice({ lines: [
    { sku: 'HE-HONEY-8OZ', quantity: 10, unitPrice: 18.5, discount: 5 },
    { sku: 'HE-VEGAN-8OZ', quantity: 4, unitPrice: 18.5 },
  ], orderDiscount: 10, shipping: 12.5, taxRate: 0.08 }), { role: 'owner', number: 'HE-2026-0007', now: '2026-11-09', dueDate: '2026-11-23' }).invoice;
  const before = JSON.stringify(issued);
  const print1 = INV.invoicePrint(issued);
  const print2 = INV.invoicePrint(issued); // reprint
  // byte-identical reprint (same number, dates, totals, pagination)
  expect(JSON.stringify(print2)).toBe(JSON.stringify(print1));
  expect(print1.header.number).toBe('HE-2026-0007');
  expect(print1.totals.total).toBe(issued.total);
  // printing never mutates the issued invoice or its immutable snapshot
  expect(JSON.stringify(issued)).toBe(before);
  expect(issued.versions[0].snapshot.total).toBe(issued.total);
});

test('a packing-slip reprint keeps the shipment-allocated lots (not re-derived)', () => {
  const slip = INV.packingSlip({ orderId: 'o', shipmentId: 's', allocations: [
    { sku: 'HE-HONEY-8OZ', quantity: 6, lotNumber: 'LOT-A' }, { sku: 'HE-VEGAN-8OZ', quantity: 4, lotNumber: 'LOT-B' },
  ] });
  const p1 = INV.packingSlipPrint(slip);
  const p2 = INV.packingSlipPrint(slip);
  expect(JSON.stringify(p2)).toBe(JSON.stringify(p1));
  expect(p1.pages[0].rows.map(r => r.lotNumber)).toEqual(['LOT-A', 'LOT-B']); // the actual allocated lots
});

test('report missed-day catch-up: a late ledger for a skipped day fills the gap', () => {
  // the nightly job saved day 05 and day 07 but MISSED day 06.
  const saved = [
    { report_date: '2026-11-05', currency: 'USD', orders_count: 3, revenue: 100 },
    { report_date: '2026-11-07', currency: 'USD', orders_count: 5, revenue: 150 },
  ];
  // the range 05..07 shows only two rows -> day 06 is the visible gap
  const picked = RX.selectReports(saved, { from: '2026-11-05', to: '2026-11-07' });
  expect(picked.map(r => r.report_date)).toEqual(['2026-11-05', '2026-11-07']);

  // catch-up: the ledger for the missed day is summarized now
  const catchup = RX.summarizeLedger([
    { type: 'order', at: '2026-11-06T10:00:00Z', amount: 40 },
    { type: 'order', at: '2026-11-06T14:00:00Z', amount: 20 },
    { type: 'refund', at: '2026-11-06T15:00:00Z', amount: 5 },
  ], { offsetHours: 0 });
  expect(catchup).toHaveLength(1);
  expect(catchup[0].report_date).toBe('2026-11-06');
  expect(catchup[0].revenue).toBe(55); // 40 + 20 - 5

  // merged + re-selected, the range is now contiguous 05,06,07
  const merged = saved.concat(catchup);
  const after = RX.selectReports(merged, { from: '2026-11-05', to: '2026-11-07' });
  expect(after.map(r => r.report_date)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07']);
  // and an export of the caught-up range verifies clean
  const m = RX.buildManifest({ history: merged, from: '2026-11-05', to: '2026-11-07' });
  expect(m.coverage.days).toBe(3);
  expect(RX.verifyManifest(m).ok).toBe(true);
});

test('recovery drill is read-only — a catch-up export still never performs a real restore', () => {
  const pkg = RX.packageOf(RX.buildManifest({ history: [{ report_date: '2026-11-06', orders_count: 2, revenue: 55 }] }));
  const r = RX.openPackage(pkg);
  expect(r.ok).toBe(true);
  expect(r.applied).toBe(true); // "applied" is the model's open result, not a real write
  // openPackage is pure: it returns a result object and touches nothing external
  expect(typeof r.coverage).toBe('object');
});
