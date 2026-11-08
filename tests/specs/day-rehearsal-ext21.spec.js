// Day rehearsal — two synthetic orders through one operating day, with a
// correction and a failed step that is retried, reconciled across the
// inventory / invoice / report engines (Phase 2 closeout). Pure, Node-only,
// synthetic. Nothing is sent, written to production, or charged. Proves the
// numbers tie out end to end: stock consumed matches what shipped, and the
// day's report revenue matches the sum of the day's (final) invoices.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');
const RX = require('../../assets/reports/he-report-export.js');
const REO = require('../../assets/inventory/he-reorder.js');
const SCAN = require('../../assets/scan/he-scan.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const PRICE = 18.50;
const UPS_A = '1Z999AA10123456784';   // valid UPS check digit (public sample)
const UPS_B = '1Z999AA10123456785';   // deliberately WRONG check digit

test('a full operating day reconciles stock, invoices and the daily report', () => {
  // --- start of day: one SKU, 40 jars on hand, nothing reserved ----------
  let honey = { sku: 'HE-HONEY-8OZ', onHand: 40, reserved: 0, damaged: 0, sampleReserved: 0, inTransit: 0, unitCost: 7.25 };
  expect(REO.availability(honey).available).toBe(40);

  // ======================================================================
  // Order A (HE-1050): 10 jars, shipped whole, invoiced, paid.
  // ======================================================================
  // reserve 10 -> availability reflects the hold (not yet consumed)
  honey.reserved = 10;
  expect(REO.availability(honey).available).toBe(30);

  // scan the label, attach once
  const rankedA = SCAN.rankOrders({ orderRef: 'HE-1050' }, [{ id: 'SYN-A', order_number: 'HE-1050', fulfillment_status: 'awaiting' }], () => true);
  expect(SCAN.rankingOutcome(rankedA).kind).toBe('single_match');
  const attachA = SCAN.planAttach({ shipmentId: 'SYN-As', orderId: 'SYN-A', tracking: UPS_A, channel: 'email', actor: 'owner' });
  expect(attachA.ok).toBe(true);

  // packing slip for the box (lot numbers, no prices)
  const slipA = INV.packingSlip({ orderId: 'SYN-A', shipmentId: 'SYN-As', allocations: [{ sku: 'HE-HONEY-8OZ', quantity: 10, lotNumber: 'LOT-A' }] });
  expect(slipA.lines[0].quantity).toBe(10);

  // ship -> consume stock, release the reservation
  honey = REO.projectConsumption(honey, 10); honey.reserved = 0;
  expect(honey.onHand).toBe(30);

  // invoice A: 10 @ 18.50 = 185, issued + paid in full
  let invA = INV.issue(INV.draftInvoice({ lines: [{ sku: 'HE-HONEY-8OZ', quantity: 10, unitPrice: PRICE }], taxRate: 0 }), { role: 'owner', number: 'INV-1050' }).invoice;
  expect(invA.total).toBe(185);
  invA = INV.applyPayment(invA, { amount: 185, key: 'payA' }).invoice;
  expect(invA.status).toBe('paid');

  // ======================================================================
  // Order B (HE-1051): a CORRECTION mid-day. First invoiced at 6 jars, then
  // the customer increases to 8 before paying: void the first, reissue.
  // ======================================================================
  // a mistyped label fails validation and is NOT attached (caught, not shipped blind)
  const attachBbad = SCAN.planAttach({ shipmentId: 'SYN-Bs', orderId: 'SYN-B', tracking: UPS_B, carrier: 'ups' });
  expect(attachBbad.validation.valid).toBe(false);
  expect(attachBbad.ok).toBe(false);

  // first invoice at 6 jars
  let invB1 = INV.issue(INV.draftInvoice({ lines: [{ sku: 'HE-HONEY-8OZ', quantity: 6, unitPrice: PRICE }], taxRate: 0 }), { role: 'owner', number: 'INV-1051' }).invoice;
  expect(invB1.total).toBe(111);
  // correction: void the first (unpaid), owner-gated
  const voided = INV.voidInvoice(invB1, { role: 'owner', reason: 'customer increased quantity before payment' });
  expect(voided.ok).toBe(true);
  expect(voided.invoice.status).toBe('void');
  // reissue at 8 jars under a NEW number (the old number stays used)
  const seen = new Set(['INV-1050', 'INV-1051']);
  const reissue = INV.issue(INV.draftInvoice({ lines: [{ sku: 'HE-HONEY-8OZ', quantity: 8, unitPrice: PRICE }], taxRate: 0 }), { role: 'owner', number: 'INV-1051R', existingNumbers: seen });
  expect(reissue.ok).toBe(true);
  let invB2 = reissue.invoice;
  expect(invB2.total).toBe(148);
  // reusing the voided number is still blocked
  expect(INV.issue(INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 1 }], taxRate: 0 }), { role: 'owner', number: 'INV-1051', existingNumbers: seen }).ok).toBe(false);

  // ship order B (8 jars) and consume
  honey = REO.projectConsumption(honey, 8);
  expect(honey.onHand).toBe(22);          // 40 - 10 - 8

  // ======================================================================
  // End of day: build the report, reconcile, export with a failed retry.
  // ======================================================================
  const dayRevenue = invA.total + invB2.total;   // 185 + 148 = 333 (the voided 111 is NOT counted)
  expect(dayRevenue).toBe(333);

  const history = [{ report_date: '2026-11-08', currency: 'USD', orders_count: 2, revenue: dayRevenue, new_inquiries_count: 0, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 3, ai_cost: 0.08 }];
  const summary = RX.dailySummary(RX.selectReports(history, {}));
  // report revenue reconciles with the day's FINAL invoices (void excluded)
  expect(summary.revenue).toBe(dayRevenue);
  expect(summary.orders_count).toBe(2);

  // inventory reconciles: starting 40, shipped 18, no damage/sample -> 22 left
  expect(REO.availability(honey).available).toBe(22);

  // export the day's report: it fails once, then a retry succeeds, never twice
  const manifest = RX.buildManifest({ history, now: '2026-11-08' });
  expect(RX.verifyManifest(manifest).ok).toBe(true);
  const failed = RX.exportAttempt(manifest, { key: 'eod-2026-11-08', fail: true });
  expect(failed.status).toBe('failed');
  const done = RX.retryExport(failed, { fail: false });
  expect(done.status).toBe('exported');
  expect(done.attempt).toBe(2);
  expect(RX.retryExport(done, {}).duplicate).toBe(true);
});
