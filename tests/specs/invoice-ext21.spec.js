// Invoices & packing slips model — unit tests (Phase 2 item 10). Pure, Node-only,
// synthetic. Totals/rounding, draft->issue with role + duplicate-number guard and
// version snapshot, partial payments, over-payment + duplicate-payment guards,
// void rules, overdue derivation, packing slip with lot numbers + optional prices.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const sampleLines = [
  { sku: 'HE-HONEY-8OZ', description: 'Honey Milk 8 oz', quantity: 10, unitPrice: 18.50, discount: 5, lotNumber: 'LOT-A' },
  { sku: 'HE-VEGAN-8OZ', description: 'Vegan 8 oz', quantity: 4, unitPrice: 18.50 },
];

test('totals compute with discount, tax and shipping, rounded without float drift', () => {
  const d = INV.draftInvoice({ lines: sampleLines, orderDiscount: 10, shipping: 12.5, taxRate: 0.08, currency: 'USD' });
  // subtotal = (10*18.50 - 5) + (4*18.50) = 180 + 74 = 254
  expect(d.subtotal).toBe(254);
  // taxable = 254 - 10 = 244; tax = 244 * 0.08 = 19.52; total = 244 + 19.52 + 12.5 = 276.02
  expect(d.tax).toBe(19.52);
  expect(d.total).toBe(276.02);
  expect(d.balance).toBe(276.02);
  expect(d.status).toBe('draft');
});

test('issue: role-gated, unique number, duplicate blocked, immutable version snapshot', () => {
  const d = INV.draftInvoice({ lines: sampleLines, taxRate: 0 });
  // staff cannot issue
  expect(INV.issue(d, { role: 'staff', number: 'INV-1001' }).ok).toBe(false);
  const seen = new Set();
  const r = INV.issue(d, { role: 'owner', number: 'INV-1001', now: '2026-11-08', dueDate: '2026-12-08', existingNumbers: seen });
  expect(r.ok).toBe(true);
  expect(r.invoice.status).toBe('issued');
  expect(r.invoice.versions.length).toBe(1);
  expect(r.invoice.versions[0].snapshot.total).toBe(d.total);
  seen.add('INV-1001');
  // duplicate number blocked
  expect(INV.issue(d, { role: 'owner', number: 'INV-1001', existingNumbers: seen }).ok).toBe(false);
});

test('partial payments move issued -> partially_paid -> paid; over/duplicate payments refused', () => {
  let { invoice } = INV.issue(INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 100 }], taxRate: 0 }), { role: 'owner', number: 'INV-2001' });
  expect(invoice.total).toBe(100);
  let r = INV.applyPayment(invoice, { amount: 40, key: 'p1' });
  expect(r.ok).toBe(true); invoice = r.invoice;
  expect(invoice.status).toBe('partially_paid');
  expect(invoice.balance).toBe(60);
  // duplicate payment key ignored
  expect(INV.applyPayment(invoice, { amount: 40, key: 'p1' }).duplicate).toBe(true);
  // over-payment refused
  expect(INV.applyPayment(invoice, { amount: 999, key: 'p2' }).ok).toBe(false);
  r = INV.applyPayment(invoice, { amount: 60, key: 'p3' }); invoice = r.invoice;
  expect(invoice.status).toBe('paid');
  expect(invoice.balance).toBe(0);
});

test('void is role-gated and a paid invoice cannot be voided', () => {
  const { invoice } = INV.issue(INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 10 }], taxRate: 0 }), { role: 'owner', number: 'INV-3001' });
  expect(INV.voidInvoice(invoice, { role: 'staff' }).ok).toBe(false);
  const v = INV.voidInvoice(invoice, { role: 'owner', reason: 'entered in error' });
  expect(v.ok).toBe(true);
  expect(v.invoice.status).toBe('void');
  const paid = INV.applyPayment(invoice, { amount: 10, key: 'x' }).invoice;
  expect(INV.voidInvoice(paid, { role: 'owner' }).ok).toBe(false);
});

test('overdue is derived from due date + outstanding balance (read-only)', () => {
  const { invoice } = INV.issue(INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 50 }], taxRate: 0 }), { role: 'owner', number: 'INV-4001', dueDate: '2026-11-01' });
  expect(INV.withOverdue(invoice, '2026-11-08').status).toBe('overdue');
  expect(INV.withOverdue(invoice, '2026-10-20').status).toBe('issued'); // not yet due
});

test('packing slip carries lot numbers, hides prices by default, and is not an invoice', () => {
  const noPrice = INV.packingSlip({ orderId: 'SYN-o1', shipmentId: 'SYN-s1', allocations: [{ sku: 'HE-HONEY-8OZ', quantity: 6, lotNumber: 'LOT-A', unitPrice: 18.5 }] });
  expect(noPrice.kind).toBe('packing_slip');
  expect(noPrice.lines[0].lotNumber).toBe('LOT-A');
  expect(noPrice.lines[0].unitPrice).toBeUndefined(); // prices hidden by default
  expect(noPrice.note).toMatch(/not an invoice and not a carrier label/);
  const withPrice = INV.packingSlip({ allocations: [{ sku: 'X', quantity: 1, lotNumber: 'L', unitPrice: 18.5 }], showPrices: true });
  expect(withPrice.lines[0].unitPrice).toBe(18.5);
});
