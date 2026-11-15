// Owner decisions #1 (tax) and #2 (payment terms) applied INSIDE the invoice
// engine, not as a side calculation (OWNER_DECISIONS_2026-11-14.md). Pure,
// Node-only, synthetic, DRAFT ONLY — nothing is issued for real or charged.
//   * mandatory shipping joins the tax base; a valid resale certificate exempts;
//   * a draft whose rate is still PENDING cannot be issued;
//   * the due date follows the terms: due on receipt, or Net 14 for an account
//     the owner approved for credit;
//   * invoices built the earlier way behave exactly as before.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const I = require('../../assets/invoice/he-invoice.js');
const T = require('../../assets/invoice/he-tax.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const ORDER = {
  lines: [
    { sku: 'SYN-A', description: 'Synthetic item A', quantity: 10, unitPrice: 18.5, discount: 5 },
    { sku: 'SYN-B', description: 'Synthetic item B', quantity: 4, unitPrice: 18.5 },
  ],
  orderDiscount: 10, shipping: 12.5, currency: 'USD',
};
const NOW = '2026-11-14T10:00:00Z';

test('an invoice built the earlier way is unchanged: goods-only tax, no status field, no terms', () => {
  const d = I.draftInvoice(Object.assign({ taxRate: 0.08 }, ORDER));
  expect(d.subtotal).toBe(254); // 180 + 74
  expect(d.tax).toBe(19.52);    // (254 - 10) * 0.08
  expect(d.total).toBe(276.02);
  expect('taxRateStatus' in d).toBe(false);
  expect(Object.keys(I.computeTotals(Object.assign({ taxRate: 0.08 }, ORDER))).sort())
    .toEqual(['_totalC', 'currency', 'lines', 'orderDiscount', 'shipping', 'subtotal', 'tax', 'taxRate', 'total']);
  const issued = I.issue(d, { role: 'owner', number: 'HE-2026-0001', now: NOW });
  expect(issued.ok).toBe(true);
  expect(issued.invoice.dueDate).toBe(null);
  expect(issued.invoice.terms).toBe(null);
  expect(I.issue(d, { role: 'owner', number: 'HE-2026-0001', now: NOW, dueDate: '2026-12-01' }).invoice.dueDate).toBe('2026-12-01');
});

test('mandatory shipping joins the tax base and the invoice total agrees with the tax engine', () => {
  const f = T.invoiceTaxFields({ shipping: { mandatory: true } });
  expect(f).toMatchObject({ taxRate: 0.0625, taxRateStatus: 'PENDING', taxShipping: true, taxExempt: false });
  const d = I.draftInvoice(Object.assign({}, ORDER, f));
  expect(d.taxBase).toBe(256.5);           // 244 goods after discount + 12.50 shipping
  expect(d.tax).toBe(16.03);               // 256.50 * 6.25%
  expect(d.total).toBe(272.53);            // 244 + 16.03 + 12.50
  const engine = T.computeTax({ subtotal: d.subtotal, orderDiscount: d.orderDiscount, shipping: { amount: d.shipping, mandatory: true } });
  expect(engine.taxableBase).toBe(d.taxBase);
  expect(engine.tax).toBe(d.tax);
});

test('separately stated, avoidable shipping stays out of the tax base', () => {
  const f = T.invoiceTaxFields({ shipping: { separatelyStated: true, avoidable: true }, localRate: 0 });
  expect(f.taxShipping).toBe(false);
  const d = I.draftInvoice(Object.assign({}, ORDER, f));
  expect(d.taxBase).toBe(244);
  expect(d.tax).toBe(15.25);               // 244 * 6.25%
  expect(d.total).toBe(271.75);
});

test('a resale order is exempt only with a valid certificate', () => {
  const noCert = T.invoiceTaxFields({ resale: true, localRate: 0.02, shipping: { mandatory: true } });
  expect(noCert.taxExempt).toBe(false);
  expect(noCert.needsCertificate).toBe(true);
  expect(I.draftInvoice(Object.assign({}, ORDER, noCert)).tax).toBeGreaterThan(0);
  const cert = T.invoiceTaxFields({ resale: true, resaleCertificate: { valid: true }, localRate: 0.02, shipping: { mandatory: true } });
  const d = I.draftInvoice(Object.assign({}, ORDER, cert));
  expect(d.taxExempt).toBe(true);
  expect(d.tax).toBe(0);
  expect(d.total).toBe(256.5);
});

test('a draft with a PENDING tax rate cannot be issued, by the owner or an administrator', () => {
  const d = I.draftInvoice(Object.assign({}, ORDER, T.invoiceTaxFields({ shipping: { mandatory: true } })));
  ['owner', 'administrator'].forEach(role => {
    const r = I.issue(d, { role, number: 'HE-2026-0001', now: NOW, account: {} });
    expect(r.ok).toBe(false);
    expect(r.pendingTax).toBe(true);
    expect(r.reason).toMatch(/pending/);
    expect(r.invoice.status).toBe('draft');
    expect(r.invoice.number).toBe(null);
  });
});

test('confirming the local rate is a recorded revision; the draft can then be issued', () => {
  const d = I.draftInvoice(Object.assign({ accountId: 'SYN-ACCT-1', orderId: 'SYN-ORDER-1' }, ORDER, T.invoiceTaxFields({ shipping: { mandatory: true } })));
  const confirmed = T.invoiceTaxFields({ shipping: { mandatory: true }, localRate: 0.0275 });
  const r = I.reviseDraft(d, { taxRate: confirmed.taxRate, taxRateStatus: confirmed.taxRateStatus }, { now: NOW, actor: 'owner', reason: 'local rate confirmed (synthetic)' });
  expect(r.ok).toBe(true);
  expect(r.invoice.taxRateStatus).toBe('CONFIRMED');
  expect(r.invoice.taxShipping).toBe(true);          // carried through the revision
  expect(r.invoice.accountId).toBe('SYN-ACCT-1');    // links survive a revision
  expect(r.invoice.orderId).toBe('SYN-ORDER-1');
  expect(r.invoice.tax).toBe(23.09);                 // 256.50 * 9%
  expect(r.invoice.revisions).toHaveLength(1);
  expect(r.invoice.revisions[0].was.tax).toBe(16.03);
  const issued = I.issue(r.invoice, { role: 'owner', number: 'HE-2026-0001', now: NOW, account: {} });
  expect(issued.ok).toBe(true);
  expect(issued.invoice.total).toBe(279.59);
});

test('due date follows the terms: due on receipt by default, Net 14 only for an approved account', () => {
  const d = I.draftInvoice(Object.assign({}, ORDER, T.invoiceTaxFields({ shipping: { mandatory: true }, localRate: 0.0275 })));
  const newBuyer = I.issue(d, { role: 'owner', number: 'HE-2026-0001', now: NOW, account: {} });
  expect(newBuyer.invoice.terms).toBe('DUE_ON_RECEIPT');
  expect(newBuyer.invoice.dueDate).toBe('2026-11-14');
  const approved = I.issue(d, { role: 'owner', number: 'HE-2026-0002', now: NOW, account: { creditApproved: true } });
  expect(approved.invoice.terms).toBe('NET_14');
  expect(approved.invoice.dueDate).toBe('2026-11-28');
  // Asking for Net 14 on an account that is not approved is refused, not downgraded silently.
  const refused = I.issue(d, { role: 'owner', number: 'HE-2026-0003', now: NOW, terms: 'NET_14', account: {} });
  expect(refused.ok).toBe(false);
  expect(refused.reason).toMatch(/approved for credit/);
  expect(I.issue(d, { role: 'owner', number: 'HE-2026-0003', now: NOW, terms: 'NET_90' }).reason).toMatch(/unknown payment terms/);
  // Asking for Net 14 without naming an approved account is refused too.
  expect(I.issue(d, { role: 'owner', number: 'HE-2026-0003', now: NOW, terms: 'NET_14' }).reason).toMatch(/approved for credit/);
  // Net 14 across a month end.
  expect(I.issue(d, { role: 'owner', number: 'HE-2026-0004', now: '2026-12-24T23:30:00Z', account: { creditApproved: true } }).invoice.dueDate).toBe('2027-01-07');
});

test('an overdue check uses the due date that the terms produced', () => {
  const d = I.draftInvoice(Object.assign({}, ORDER, T.invoiceTaxFields({ shipping: { mandatory: true }, localRate: 0 })));
  const inv = I.issue(d, { role: 'owner', number: 'HE-2026-0001', now: NOW, account: { creditApproved: true } }).invoice;
  expect(I.withOverdue(inv, '2026-11-27T12:00:00Z').status).toBe('issued');
  expect(I.withOverdue(inv, '2026-11-29T12:00:00Z').status).toBe('overdue');
});

test('the due date counts from the business day of issue (Central), not the UTC date', () => {
  const d = I.draftInvoice(Object.assign({}, ORDER, T.invoiceTaxFields({ shipping: { mandatory: true }, localRate: 0 })));
  // 10:30 pm Central on Nov 14 is already Nov 15 in UTC.
  const late = '2026-11-15T04:30:00Z';
  expect(I.businessDay(late)).toBe('2026-11-14');
  expect(I.issue(d, { role: 'owner', number: 'HE-2026-0001', now: late, account: {} }).invoice.dueDate).toBe('2026-11-14');
  expect(I.issue(d, { role: 'owner', number: 'HE-2026-0002', now: late, account: { creditApproved: true } }).invoice.dueDate).toBe('2026-11-28');
  // Summer (daylight time): 11:30 pm Central on Jul 1 is 04:30 UTC on Jul 2.
  expect(I.issue(d, { role: 'owner', number: 'HE-2026-0003', now: '2026-07-02T04:30:00Z', account: {} }).invoice.dueDate).toBe('2026-07-01');
  // The caller can state the issue day outright; a missing or bad time gives no date rather than a guess.
  expect(I.issue(d, { role: 'owner', number: 'HE-2026-0004', now: late, issueDay: '2026-11-20', account: {} }).invoice.dueDate).toBe('2026-11-20');
  expect(I.businessDay(null)).toBeNull();
  expect(I.businessDay('not-a-date')).toBeNull();
  expect(I.issue(d, { role: 'owner', number: 'HE-2026-0005', account: {} }).invoice.dueDate).toBeNull();
});
