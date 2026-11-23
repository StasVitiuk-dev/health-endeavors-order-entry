// Invoice header block (local item #4). Pure, Node-only, synthetic. The print
// model and preview carry a header: business name (the known store name),
// address + remit-to as PLACEHOLDERS the owner confirms (never invented), plus
// the number / dates from the invoice. `placeholder` stays true until every
// field is supplied.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('default header uses the store name and marks address/remit as placeholders', () => {
  const h = INV.invoiceHeader({});
  expect(h.businessName).toBe('Health Endeavors');
  expect(h.addressLines.join(' ')).toMatch(/owner to confirm/);
  expect(h.remitTo).toMatch(/owner to confirm/);
  expect(h.placeholder).toBe(true);   // nothing real supplied yet
});

test('supplying every field clears the placeholder flag', () => {
  const h = INV.invoiceHeader({ businessName: 'Health Endeavors LLC', addressLines: ['123 Real St', 'Portland OR'], remitTo: 'ACH to ...' });
  expect(h.placeholder).toBe(false);
  expect(h.addressLines).toEqual(['123 Real St', 'Portland OR']);
});

test('invoicePrint carries the header with the invoice number and dates', () => {
  const issued = INV.issue(INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 10 }], taxRate: 0 }), { role: 'owner', number: 'HE-2026-0009', now: '2026-11-09', dueDate: '2026-11-23' }).invoice;
  const doc = INV.invoicePrint(issued);
  expect(doc.header.businessName).toBe('Health Endeavors');
  expect(doc.header.number).toBe('HE-2026-0009');
  expect(doc.header.issueDate).toBe('2026-11-09');
  expect(doc.header.dueDate).toBe('2026-11-23');
  expect(doc.header.placeholder).toBe(true); // address/remit still owner-pending
});
