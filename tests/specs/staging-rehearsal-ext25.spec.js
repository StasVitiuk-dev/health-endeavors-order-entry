// End-to-end staging rehearsal (owner queue of Nov 25, task 8). One wholesale
// order entered by hand and one Shopify order, taken through the real engines of
// the dashboard: stock (he-receiving), invoice (he-invoice), scan and shipment
// (he-scan), and the failure cases the owner listed. Pure, Node-only, made-up
// records. Nothing is sent, no real stock moves, no money moves.
//
// What this does NOT prove (mocks cannot): the real database functions (their own
// tests: drafts 32 and 40), the real carriers, the real email provider, Shopify's
// own shipping email, and a real iPhone or printer.
const { test, expect } = require('@playwright/test');
const R = require('../../assets/inventory/he-receiving.js');
const INV = require('../../assets/invoice/he-invoice.js');
const SCAN = require('../../assets/scan/he-scan.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const SKU = 'SYN-LOTION-8OZ';
const K = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const owner = { by: 'owner', role: 'owner' }, admin = { by: 'ari', role: 'administrator' }, staff = { by: 'sam', role: 'employee' };
const UPS_1 = '1Z999AA10123456784';   // public sample numbers with a valid check digit
const UPS_2 = '1Z999AA10123456793';

function setup() {
  // 1. a store and its order (wholesale, entered by hand), and a Shopify order
  const store = { id: 'syn-store-1', name: 'SYNTHETIC Boutique', terms: 'Net 14' };
  const wholesale = { id: 'syn-o-1', order_number: 'HE-2001', status: 'confirmed', source: 'manual', channel: 'wholesale', store: store.id };
  const shopify = { id: 'syn-o-2', order_number: 'HE-2002', status: 'paid', source: 'shopify', channel: 'retail' };
  // stock: a purchase order of 20 jars; the two orders sell 12 and 2
  const L = R.createLedger({
    products: [{ sku: SKU, available: 0, damaged: 0 }],
    purchaseOrders: [{ id: 'po', number: 'SYN-PO-501', lines: [{ sku: SKU, ordered: 20 }] }],
    sales: [{ id: 'so-1', number: 'HE-2001', lines: [{ sku: SKU, sold: 12 }] }, { id: 'so-2', number: 'HE-2002', lines: [{ sku: SKU, sold: 2 }] }],
  });
  return { store, wholesale, shopify, L };
}

test('the whole journey reconciles: stock, invoice balance, shipment, one notice per order, partial return', () => {
  const { wholesale, shopify, L } = setup();

  // stock arrives: staff record, an administrator approves (owner decision of Nov 24)
  const rec = R.submitReceiving(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 20 }], ...staff });
  expect(rec.ok).toBe(true);
  expect(R.stock(L, SKU).available).toBe(0);                                   // nothing moves before approval
  expect(R.approveReceiving(L, { recordId: rec.id, ...admin }).ok).toBe(true);
  expect(R.stock(L, SKU).available).toBe(20);

  // 3. the invoice: prepared, issued by an administrator under the current rules
  const seq = INV.createNumberSequence({ used: [] });
  const r = seq.reserve({ year: 2026 });
  const draft = INV.draftInvoice({ lines: [{ sku: SKU, quantity: 12, unitPrice: 18.5 }], shipping: 12, taxRate: 0.0825 });
  expect(INV.issue(draft, { role: 'employee', number: r.number }).ok).toBe(false);   // unauthorized operator
  const issued = INV.issue(draft, { role: 'administrator', number: r.number, now: '2026-11-25', dueDate: '2026-12-09' });
  expect(issued.ok).toBe(true);
  expect(seq.commit(r.token).ok).toBe(true);
  let invoice = issued.invoice;
  const total = invoice.total;
  expect(total).toBe(252.32);                                                  // 222 + 18.32 tax + 12 shipping

  // 4. payment status recorded (no real payment): part now; the same bank line twice counts once
  invoice = INV.applyPayment(invoice, { amount: 100, key: 'bank-line-1' }).invoice;
  const again = INV.applyPayment(invoice, { amount: 100, key: 'bank-line-1' });  // duplicate external event
  expect(again.invoice.balance).toBe(152.32);
  invoice = again.invoice;
  expect(invoice.status).toBe('partially_paid');

  // 6–8. shipment: the wholesale order goes in two boxes (split shipment)
  const keys = new Set(), assigned = {};
  const attach = (shipmentId, order, tracking) => {
    const p = SCAN.planAttach({ shipmentId, orderId: order.id, tracking, channel: order.channel, orderSource: order.source, actor: 'owner', existingKeys: keys, assignedTo: assigned });
    if (p.ok) { keys.add(p.attach.dedup_key); assigned[p.attach.tracking_number] = shipmentId; p.queued.forEach(q => { if (q.kind === 'notification') keys.add(q.dedup_key); }); }
    return p;
  };
  // the right order is found from the receipt's order number
  const ranked = SCAN.rankOrders({ orderRef: 'HE-2001' }, [wholesale, shopify], () => true);
  expect(SCAN.rankingOutcome(ranked).kind).toBe('single_match');
  expect(SCAN.rankingOutcome(ranked).matches[0].order.id).toBe(wholesale.id);
  const box1 = attach('syn-ship-1a', wholesale, UPS_1);
  expect(box1.ok).toBe(true);
  expect(box1.noticeBy).toBe('dashboard');
  expect(box1.queued.filter(q => q.kind === 'notification')).toHaveLength(1);   // one notice for the hand-entered order
  // the same label scanned again: nothing added, nothing queued again
  const rescan = attach('syn-ship-1a', wholesale, UPS_1);
  expect(rescan.duplicateAttach).toBe(true);
  expect(rescan.queued).toEqual([]);
  // the second box has its own label; the first box's label cannot be put on it
  expect(attach('syn-ship-1b', wholesale, UPS_1).crossAssigned).toBe(true);
  const box2 = attach('syn-ship-1b', wholesale, UPS_2);
  expect(box2.ok).toBe(true);
  expect(box2.queued.filter(q => q.kind === 'notification')).toHaveLength(1);   // each box tells the customer its own tracking number

  // 9. the Shopify order: Shopify sends its own shipping email; the dashboard queues none
  const shop = attach('syn-ship-2', shopify, '1Z999AA10123456800');
  expect(shop.ok).toBe(true);
  expect(shop.noticeBy).toBe('shopify');
  expect(shop.queued.filter(q => q.kind === 'notification')).toEqual([]);
  expect(shop.queued.filter(q => q.kind === 'tracking_check')).toHaveLength(1);

  // a failed send (provider down) may be retried safely; a sent notice is final
  expect(SCAN.canNotifTransition('queued', 'failed')).toBe(true);
  expect(SCAN.canNotifTransition('failed', 'queued')).toBe(true);
  expect(SCAN.canNotifTransition('sent', 'queued')).toBe(false);

  // 10. a partial return: 3 jars come back; inspected by an administrator
  const ret = R.recordCustomerReturn(L, { requestKey: K(2), saleId: 'so-1', sku: SKU, quantity: 3, reason: 'Two leaking, one changed mind', ...staff });
  expect(ret.ok).toBe(true);
  expect(R.recordCustomerReturn(L, { requestKey: K(2), saleId: 'so-1', sku: SKU, quantity: 3, reason: 'Two leaking, one changed mind', ...staff }).duplicate).toBe(true);   // retry after a timeout
  expect(R.decideCustomerReturn(L, { inspectionId: ret.id, restock: 1, damaged: 2, unsuitable: 0, opened: false, used: false, ...staff }).ok).toBe(false);  // staff cannot decide
  const insp = R.decideCustomerReturn(L, { inspectionId: ret.id, restock: 1, damaged: 2, unsuitable: 0, opened: false, used: false, ...admin });
  expect(insp.ok).toBe(true);
  // the refund side: a credit note for the 3 jars (no real refund is made)
  const cn = INV.creditNote(invoice, { role: 'administrator', number: 'CN-2026-0001', reason: 'partial return: 3 jars', amount: 55.5, now: '2026-11-28' });
  expect(cn.ok).toBe(true);
  expect(cn.creditNote.full).toBe(false);
  expect(INV.creditNote(invoice, { role: 'employee', amount: 1 }).ok).toBe(false);

  // 11. everything ties out
  expect(R.stock(L, SKU)).toEqual({ sku: SKU, available: 21, damaged: 2 });  // 20 received + 1 restocked; 2 damaged
  expect(R.saleStatus(L, 'so-1').lines[0]).toMatchObject({ restocked: 1, damaged: 2, stillReturnable: 9 });
  expect(invoice.balance).toBe(152.32);                                        // the credit note is a separate record
  expect(total - 55.5).toBeCloseTo(196.82, 2);
  expect(L.history.length).toBeGreaterThanOrEqual(4);                          // every step is written down
  expect(L.history.every(h => h.by)).toBe(true);                               // and names who did it
});

test('the failure cases refuse cleanly and change nothing', () => {
  const { wholesale, shopify, L } = setup();
  // a receipt that matches no order: nothing is attached automatically
  const none = SCAN.rankingOutcome(SCAN.rankOrders({ orderRef: 'HE-9999' }, [wholesale, shopify], () => true));
  expect(none.kind).not.toBe('single_match');
  // a cancelled order cannot be invoiced
  expect(INV.draftFromOrder({ id: 'x', status: 'cancelled' }, [{ sku: SKU, quantity: 1, unit_price: 18.5 }]).ok).toBe(false);
  // over-receiving and over-returning are refused
  const rec = R.submitReceiving(L, { requestKey: K(3), poId: 'po', lines: [{ sku: SKU, good: 25 }], ...staff });
  expect(rec.ok).toBe(false);
  expect(R.recordCustomerReturn(L, { requestKey: K(4), saleId: 'so-2', sku: SKU, quantity: 3, reason: 'Too many', ...staff }).ok).toBe(false);
  // nothing moved
  expect(R.stock(L, SKU)).toEqual({ sku: SKU, available: 0, damaged: 0 });
  // an unknown order source keeps the dashboard's one notice (never zero, never two)
  expect(SCAN.noticePath(null)).toBe('dashboard');
  expect(SCAN.noticePath('Shopify')).toBe('shopify');
  expect(SCAN.noticePath('etsy')).toBe('etsy');
});
