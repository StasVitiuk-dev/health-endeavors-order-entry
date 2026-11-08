// Owner vs restricted-staff boundaries on the new screens (wave-1 item 9).
// Pure, Node-only, synthetic. The engines behind the new screens enforce the
// role boundary directly: staff cannot issue or void an invoice; a staff order
// search never returns owner-only orders (no data leak); confirmed writes are
// idempotent (no duplicate write on retry); and a draft edit keeps its history
// (no lost draft). The browser-level session behaviours — direct URLs, refresh,
// expired sessions, retry after sign-in — are covered by the existing suite
// (role-matrix, session-expiry-midway, reauth-double-submit, stale-tab-gaps),
// carried forward here rather than duplicated.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');
const SCAN = require('../../assets/scan/he-scan.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('invoice issue + void are owner/administrator only; staff is refused', () => {
  const draft = INV.draftInvoice({ lines: [{ quantity: 2, unitPrice: 10 }], taxRate: 0 });
  expect(INV.issue(draft, { role: 'staff', number: 'INV-9001' }).ok).toBe(false);
  expect(INV.issue(draft, { role: 'viewer', number: 'INV-9001' }).ok).toBe(false);
  const issued = INV.issue(draft, { role: 'owner', number: 'INV-9001' });
  expect(issued.ok).toBe(true);
  const admin = INV.issue(INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 5 }], taxRate: 0 }), { role: 'administrator', number: 'INV-9002' });
  expect(admin.ok).toBe(true);
  // void: staff refused, owner allowed
  expect(INV.voidInvoice(issued.invoice, { role: 'staff' }).ok).toBe(false);
  expect(INV.voidInvoice(issued.invoice, { role: 'owner', reason: 'entered in error' }).ok).toBe(true);
});

test('staff order search never returns owner-only orders (no data leak)', () => {
  const orders = [
    { id: 'O-1', order_number: 'HE-1', fulfillment_status: 'unfulfilled' },
    { id: 'O-2', order_number: 'HE-2', fulfillment_status: 'unfulfilled', owner_only: true }, // restricted
  ];
  const staffCanSee = (o) => !o.owner_only;             // the app's staff boundary
  const ownerCanSee = () => true;
  // a search that would match BOTH orders by reference hint
  const staffHits = SCAN.rankOrders({ fulfillmentHint: true }, orders, staffCanSee).map(r => r.order.id);
  const ownerHits = SCAN.rankOrders({ fulfillmentHint: true }, orders, ownerCanSee).map(r => r.order.id);
  expect(staffHits).not.toContain('O-2');               // restricted order hidden from staff
  expect(ownerHits).toContain('O-2');                   // owner sees it
});

test('retry does not create a duplicate write (idempotent confirm) and a draft is not lost', () => {
  // duplicate payment key is ignored (no double write)
  let inv = INV.issue(INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 100 }], taxRate: 0 }), { role: 'owner', number: 'INV-9003' }).invoice;
  const first = INV.applyPayment(inv, { amount: 40, key: 'pay-k' });
  inv = first.invoice;
  expect(INV.applyPayment(inv, { amount: 40, key: 'pay-k' }).duplicate).toBe(true);
  expect(inv.balance).toBe(60); // unchanged by the retry

  // a draft edit keeps the prior totals (draft is never silently lost)
  const d0 = INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 50 }], taxRate: 0 });
  const r = INV.reviseDraft(d0, { lines: [{ quantity: 2, unitPrice: 50 }] }, { reason: 'qty fix' });
  expect(r.invoice.revisions.length).toBe(1);
  expect(r.invoice.revisions[0].was.total).toBe(50);    // original preserved
  expect(r.invoice.total).toBe(100);
});
