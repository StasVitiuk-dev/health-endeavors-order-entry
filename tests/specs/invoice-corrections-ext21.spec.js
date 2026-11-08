// Invoice corrections — one multi-line wholesale order end to end (wave-1 item
// 2). Pure, Node-only, synthetic money, simulated issuance only. Covers
// quantity, per-line + order discount, shipping, tax rounding, partial payment
// and running balance; draft edits preserve a history trail; and retries
// (duplicate number, duplicate payment key) cannot create a duplicate record.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// A multi-line wholesale order: two SKUs, a per-line discount, an order-level
// discount, shipping and 8.25% tax chosen to exercise rounding.
function wholesaleDraft() {
  return INV.draftInvoice({
    accountId: 'SYN-acct-bright', orderId: 'SYN-o-whl-1', currency: 'USD',
    lines: [
      { sku: 'HE-HONEY-8OZ', description: 'Honey Milk 8 oz', quantity: 24, unitPrice: 15.00, discount: 12, lotNumber: 'LOT-A' },
      { sku: 'HE-VEGAN-8OZ', description: 'Vegan 8 oz', quantity: 12, unitPrice: 15.00, lotNumber: 'LOT-B' },
    ],
    orderDiscount: 20, shipping: 18.75, taxRate: 0.0825,
  });
}

test('totals: quantity, per-line + order discount, shipping and tax round without drift', () => {
  const d = wholesaleDraft();
  // line 1 = 24*15 - 12 = 348; line 2 = 12*15 = 180; subtotal = 528
  expect(d.subtotal).toBe(528);
  // taxable = 528 - 20 = 508; tax = 508 * 0.0825 = 41.91; total = 508 + 41.91 + 18.75 = 568.66
  expect(d.tax).toBe(41.91);
  expect(d.total).toBe(568.66);
  expect(d.balance).toBe(568.66);
});

test('draft edits preserve a history trail (prior totals kept on each revision)', () => {
  const d0 = wholesaleDraft();
  // the buyer increases HONEY from 24 to 36 jars and drops the order discount
  const r1 = INV.reviseDraft(d0, {
    lines: [
      { sku: 'HE-HONEY-8OZ', quantity: 36, unitPrice: 15.00, discount: 12, lotNumber: 'LOT-A' },
      { sku: 'HE-VEGAN-8OZ', quantity: 12, unitPrice: 15.00, lotNumber: 'LOT-B' },
    ], orderDiscount: 0,
  }, { reason: 'buyer increased honey qty', actor: 'owner', now: '2026-11-08' });
  expect(r1.ok).toBe(true);
  const d1 = r1.invoice;
  // new subtotal = (36*15-12) + 180 = 528 - ... recompute: 540-12=528? no: 36*15=540-12=528; +180=708
  expect(d1.subtotal).toBe(708);
  // history preserved: revision 1 kept the ORIGINAL totals
  expect(d1.revisions.length).toBe(1);
  expect(d1.revisions[0].was.total).toBe(568.66);
  expect(d1.revisions[0].reason).toBe('buyer increased honey qty');
  // a second edit stacks history, never loses the first
  const r2 = INV.reviseDraft(d1, { shipping: 0 }, { reason: 'free freight promo' });
  expect(r2.invoice.revisions.length).toBe(2);
  expect(r2.invoice.revisions[0].was.total).toBe(568.66); // original still there
});

test('issued invoice: partial payment moves the balance; retries cannot duplicate', () => {
  const seen = new Set();
  const issued = INV.issue(wholesaleDraft(), { role: 'owner', number: 'WHL-5001', existingNumbers: seen });
  expect(issued.ok).toBe(true);
  seen.add('WHL-5001');
  let invoice = issued.invoice;
  expect(invoice.total).toBe(568.66);
  // re-issuing the same number is refused (no duplicate record)
  expect(INV.issue(wholesaleDraft(), { role: 'owner', number: 'WHL-5001', existingNumbers: seen }).ok).toBe(false);

  // partial payment of 300 -> partially_paid, balance 268.66
  let r = INV.applyPayment(invoice, { amount: 300, key: 'wire-1' });
  expect(r.ok).toBe(true); invoice = r.invoice;
  expect(invoice.status).toBe('partially_paid');
  expect(invoice.balance).toBe(268.66);
  // a retried wire with the SAME key is ignored (no double-credit)
  const dup = INV.applyPayment(invoice, { amount: 300, key: 'wire-1' });
  expect(dup.duplicate).toBe(true);
  expect(invoice.balance).toBe(268.66); // unchanged
  // paying the exact remaining balance closes it
  r = INV.applyPayment(invoice, { amount: 268.66, key: 'wire-2' }); invoice = r.invoice;
  expect(invoice.status).toBe('paid');
  expect(invoice.balance).toBe(0);
  // overpayment after paid is refused
  expect(INV.applyPayment(invoice, { amount: 0.01, key: 'wire-3' }).ok).toBe(false);
});

test('a revision cannot be applied to an issued invoice (correct via void + reissue)', () => {
  const issued = INV.issue(wholesaleDraft(), { role: 'owner', number: 'WHL-5002' }).invoice;
  const bad = INV.reviseDraft(issued, { shipping: 0 });
  expect(bad.ok).toBe(false);
  expect(bad.reason).toMatch(/only a draft can be edited/);
});
