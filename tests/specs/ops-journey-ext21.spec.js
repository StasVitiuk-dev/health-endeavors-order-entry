// Operations journey — scan → packing slip → report, one synthetic order with
// a PARTIAL shipment and REPEATED actions (Phase 2, ties items 1/9/10). Pure,
// Node-only, synthetic. Proves the three operations engines compose on a single
// order without any real send, write, money movement or carrier call, and that
// repeating a step (re-scanning a label, re-running an export) is idempotent.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const SCAN = require('../../assets/scan/he-scan.js');
const INV = require('../../assets/invoice/he-invoice.js');
const RX = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// One synthetic order for 10 jars, shipped in two boxes (6 now, 4 later).
const ORDER = { id: 'SYN-o42', order_number: 'HE-1042', recipient_name: 'SYNTHETIC Bright Market', dest_zip: '97201', fulfillment_status: 'awaiting' };
const SHIP_1 = { id: 'SYN-s42a', order_id: 'SYN-o42' }; // first (partial) box
const UPS = '1Z999AA10123456784'; // valid UPS check digit (public sample)

test('scan attaches once to the partial shipment even when the label is scanned twice', () => {
  const ranked = SCAN.rankOrders({ orderRef: 'HE-1042', destZip: '97201' }, [ORDER], () => true);
  expect(SCAN.rankingOutcome(ranked).kind).toBe('single_match');

  const seen = new Set();
  const first = SCAN.planAttach({ shipmentId: SHIP_1.id, orderId: ORDER.id, tracking: UPS, channel: 'email', actor: 'owner', now: '2026-11-08' });
  expect(first.ok).toBe(true);
  expect(first.validation.valid).toBe(true);
  expect(first.attach.carrier).toBe('ups');
  // record the dedup keys as if the attach + notification were accepted
  seen.add(first.attach.dedup_key);
  first.queued.forEach(q => seen.add(q.dedup_key));

  // re-scanning the SAME label on the SAME shipment must attach once, queue nothing
  const again = SCAN.planAttach({ shipmentId: SHIP_1.id, orderId: ORDER.id, tracking: UPS, channel: 'email', existingKeys: seen });
  expect(again.duplicateAttach).toBe(true);
  expect(again.ok).toBe(false);
  expect(again.queued).toEqual([]);
});

test('the partial shipment prints a packing slip with lot numbers and no prices', () => {
  const slip = INV.packingSlip({
    orderId: ORDER.id, shipmentId: SHIP_1.id,
    allocations: [{ sku: 'HE-HONEY-8OZ', description: 'Honey Milk 8 oz', quantity: 6, lotNumber: 'LOT-A', unitPrice: 18.5 }],
  });
  expect(slip.kind).toBe('packing_slip');
  expect(slip.shipmentId).toBe('SYN-s42a');
  expect(slip.lines[0].quantity).toBe(6);            // only the 6 in this box, not all 10
  expect(slip.lines[0].lotNumber).toBe('LOT-A');
  expect(slip.lines[0].unitPrice).toBeUndefined();   // prices hidden by default
  expect(slip.note).toMatch(/not an invoice and not a carrier label/);
});

test("the day's export manifest is deterministic and survives a failed-then-retried export", () => {
  // the shipment contributes to that day's report row (orders fulfilled etc.)
  const history = [
    { report_date: '2026-11-08', currency: 'USD', orders_count: 1, revenue: null /* not invoiced yet -> UNKNOWN, not 0 */, new_inquiries_count: 0, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 2, ai_cost: 0.05 },
  ];
  const day = RX.selectReports(history, { from: '2026-11-08', to: '2026-11-08' });
  expect(day[0].orders_count).toBe(1);
  expect(day[0].revenue).toBe('UNKNOWN'); // partial shipment isn't revenue yet — never shown as $0

  const manifest = RX.buildManifest({ history, now: '2026-11-08' });
  expect(RX.verifyManifest(manifest).ok).toBe(true);

  const failed = RX.exportAttempt(manifest, { key: 'day-2026-11-08', fail: true });
  expect(failed.canRetry).toBe(true);
  const done = RX.retryExport(failed, { fail: false });
  expect(done.status).toBe('exported');
  // re-running the completed export does not produce a second export
  expect(RX.retryExport(done, {}).duplicate).toBe(true);
});
