// Owner decision #3: "generate drafts automatically; the owner reviews and
// issues them by hand". Pure, Node-only, synthetic. A draft is built from an
// order and its lines; nothing is issued or numbered; anything that does not
// add up is listed for the reviewer instead of being silently corrected; and
// running the generator twice never creates a second draft for the same order.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const I = require('../../assets/invoice/he-invoice.js');
const T = require('../../assets/invoice/he-tax.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const ITEMS = [
  { sku: 'SYN-A', product_name: 'Synthetic item A', quantity: 10, unit_price: 18.5, line_total: 180 },  // 5.00 line discount
  { sku: 'SYN-B', product_name: 'Synthetic item B', quantity: 4, unit_price: 18.5, line_total: 74 },
];
const ORDER = { id: 'SYN-O1', order_number: 'SYN-1001', currency: 'USD', subtotal: 254, shipping_total: 12.5, status: 'paid' };
const PENDING = T.invoiceTaxFields({ shipping: { mandatory: true } });
const CONFIRMED = T.invoiceTaxFields({ shipping: { mandatory: true }, localRate: 0.0275 });

test('a draft is built from the order: lines, discount, shipping, account, terms — and it is only a draft', () => {
  const r = I.draftFromOrder(ORDER, ITEMS, { account: { id: 'SYN-ACCT-1' }, taxFields: CONFIRMED });
  expect(r.ok).toBe(true);
  const d = r.draft;
  expect(d).toMatchObject({ status: 'draft', number: null, issueDate: null, orderId: 'SYN-O1', orderNumber: 'SYN-1001', accountId: 'SYN-ACCT-1', terms: 'DUE_ON_RECEIPT', currency: 'USD' });
  expect(d.lines.map(l => [l.sku, l.quantity, l.unitPrice, l.discount, l.lineTotal])).toEqual([['SYN-A', 10, 18.5, 5, 180], ['SYN-B', 4, 18.5, 0, 74]]);
  expect(d.subtotal).toBe(254);
  expect(d.shipping).toBe(12.5);
  expect(d.tax).toBe(23.99);                // (254 + 12.50) * 9%
  expect(d.total).toBe(290.49);
  expect(r.checks).toEqual([]);
  expect(r.needsReview).toBe(false);
  // An approved-credit account gets Net 14 suggested on the draft.
  expect(I.draftFromOrder(ORDER, ITEMS, { account: { id: 'SYN-ACCT-2', creditApproved: true }, taxFields: CONFIRMED }).draft.terms).toBe('NET_14');
  // The order object was not changed.
  expect(ORDER).toEqual({ id: 'SYN-O1', order_number: 'SYN-1001', currency: 'USD', subtotal: 254, shipping_total: 12.5, status: 'paid' });
});

test('a draft made with the pending tax rate says so and cannot be issued until the rate is confirmed', () => {
  const r = I.draftFromOrder(ORDER, ITEMS, { account: { id: 'SYN-ACCT-1' }, taxFields: PENDING });
  expect(r.needsReview).toBe(true);
  expect(r.checks.join(' | ')).toMatch(/tax rate is still pending/);
  const tried = I.issue(r.draft, { role: 'owner', number: 'HE-2026-0001', now: '2026-11-14T10:00:00Z', account: { id: 'SYN-ACCT-1' } });
  expect(tried.ok).toBe(false);
  expect(tried.pendingTax).toBe(true);
  // Confirming the rate (a recorded revision) keeps the order link, then issuing works.
  const rev = I.reviseDraft(r.draft, { taxRate: CONFIRMED.taxRate, taxRateStatus: 'CONFIRMED' }, { actor: 'owner', reason: 'local rate confirmed (synthetic)' });
  expect(rev.invoice).toMatchObject({ orderId: 'SYN-O1', orderNumber: 'SYN-1001', accountId: 'SYN-ACCT-1', terms: 'DUE_ON_RECEIPT' });
  const issued = I.issue(rev.invoice, { role: 'owner', number: 'HE-2026-0001', now: '2026-11-14T10:00:00Z', account: { id: 'SYN-ACCT-1' } });
  expect(issued.ok).toBe(true);
  expect(issued.invoice).toMatchObject({ status: 'issued', number: 'HE-2026-0001', dueDate: '2026-11-14', total: 290.49 });
});

test('things that do not add up are listed for the reviewer, never silently corrected', () => {
  const noPrice = I.draftFromOrder(ORDER, [{ sku: 'SYN-A', quantity: 2, unit_price: null }], { taxFields: CONFIRMED });
  expect(noPrice.ok).toBe(true);
  expect(noPrice.checks.join(' | ')).toMatch(/SYN-A: no unit price/);
  const over = I.draftFromOrder(Object.assign({}, ORDER, { subtotal: 300 }), [{ sku: 'SYN-A', quantity: 2, unit_price: 10, line_total: 25 }], { taxFields: CONFIRMED });
  expect(over.checks.join(' | ')).toMatch(/more than quantity x price/);
  expect(over.checks.join(' | ')).toMatch(/order subtotal \(300\.00\) differs from the lines \(20\.00\)/);
  expect(over.draft.subtotal).toBe(20);                         // built from the lines as given, not bent to match
  const noTax = I.draftFromOrder(ORDER, ITEMS, {});
  expect(noTax.draft.tax).toBe(0);
  expect(noTax.checks.join(' | ')).toMatch(/no tax rule was supplied/);
  const resale = I.draftFromOrder(ORDER, ITEMS, { taxFields: T.invoiceTaxFields({ resale: true, localRate: 0.02, shipping: { mandatory: true } }) });
  expect(resale.draft.tax).toBeGreaterThan(0);
  expect(resale.checks.join(' | ')).toMatch(/no valid resale certificate/);
});

test('orders that should not be invoiced are refused with a reason', () => {
  expect(I.draftFromOrder(Object.assign({}, ORDER, { status: 'cancelled' }), ITEMS).reason).toMatch(/cancelled/);
  expect(I.draftFromOrder(Object.assign({}, ORDER, { status: 'refunded' }), ITEMS).reason).toMatch(/fully refunded/);
  expect(I.draftFromOrder(Object.assign({}, ORDER, { deleted_at: '2026-11-01T00:00:00Z' }), ITEMS).reason).toMatch(/deleted/);
  expect(I.draftFromOrder(ORDER, []).reason).toMatch(/no lines/);
  expect(I.draftFromOrder(ORDER, [{ sku: 'SYN-A', quantity: 0, unit_price: 5 }]).reason).toMatch(/no lines/);
  expect(I.draftFromOrder({}, ITEMS).reason).toMatch(/no id/);
  expect(I.draftFromOrder(null, null).reason).toMatch(/no id/);
  // A partially refunded order is still invoiced (the refund is handled by a credit note).
  expect(I.draftFromOrder(Object.assign({}, ORDER, { status: 'partially_refunded' }), ITEMS, { taxFields: CONFIRMED }).ok).toBe(true);
});

test('the generator makes one draft per order, skips what already has one, and issues nothing', () => {
  const orders = [
    Object.assign({ items: ITEMS }, ORDER),
    { id: 'SYN-O2', status: 'paid', items: ITEMS },
    { id: 'SYN-O3', status: 'cancelled', items: ITEMS },
    { id: 'SYN-O4', status: 'paid', items: ITEMS },                     // already invoiced
    { id: 'SYN-O5', status: 'paid', items: ITEMS },                     // its earlier invoice was voided
    Object.assign({ items: ITEMS }, ORDER),                              // the same order listed twice
  ];
  const existing = [{ orderId: 'SYN-O4', status: 'issued' }, { orderId: 'SYN-O5', status: 'void' }];
  const out = I.draftsForOrders(orders, existing, { taxFields: CONFIRMED, accountFor: ord => ({ id: 'ACCT-' + ord.id, creditApproved: ord.id === 'SYN-O2' }) });
  expect(out.drafts.map(d => d.draft.orderId)).toEqual(['SYN-O1', 'SYN-O2', 'SYN-O5']);
  expect(out.drafts.map(d => d.draft.terms)).toEqual(['DUE_ON_RECEIPT', 'NET_14', 'DUE_ON_RECEIPT']);
  expect(out.skipped).toEqual([
    { orderId: 'SYN-O3', reason: 'the order was cancelled' },
    { orderId: 'SYN-O4', reason: 'already has an invoice or a draft' },
    { orderId: 'SYN-O1', reason: 'already has an invoice or a draft' },
  ]);
  expect(out).toMatchObject({ created: 3, needReview: 0, issued: 0 });
  out.drafts.forEach(d => expect(d.draft).toMatchObject({ status: 'draft', number: null }));
  // Running it again with the drafts it just made creates nothing new.
  const again = I.draftsForOrders(orders, existing.concat(out.drafts.map(d => d.draft)), { taxFields: CONFIRMED });
  expect(again.created).toBe(0);
  expect(I.draftsForOrders(null, null)).toMatchObject({ created: 0, issued: 0, drafts: [], skipped: [] });
});
