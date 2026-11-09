// Credit note for a paid invoice (local item #6). Pure, Node-only, synthetic.
// A paid invoice cannot be voided; a credit note is the proper reversal. It is
// owner/administrator only, references the invoice without mutating it, defaults
// to the full total, allows a partial credit up to the total, and moves no money.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

function paidInvoice() {
  let inv = INV.issue(INV.draftInvoice({ lines: [{ quantity: 2, unitPrice: 50 }], taxRate: 0 }), { role: 'owner', number: 'HE-2026-0100' }).invoice;
  inv = INV.applyPayment(inv, { amount: 100, key: 'p1' }).invoice;
  return inv;
}

test('a paid invoice cannot be voided but CAN take a credit note (owner)', () => {
  const inv = paidInvoice();
  expect(inv.status).toBe('paid');
  expect(INV.voidInvoice(inv, { role: 'owner' }).ok).toBe(false); // paid can't be voided
  const cn = INV.creditNote(inv, { role: 'owner', number: 'CN-2026-0001', reason: 'returned goods', now: '2026-11-09' });
  expect(cn.ok).toBe(true);
  expect(cn.creditNote.amount).toBe(100);           // full total by default
  expect(cn.creditNote.full).toBe(true);
  expect(cn.creditNote.invoiceNumber).toBe('HE-2026-0100');
  expect(cn.creditNote.label).toBe('SIMULATED');
});

test('credit note is role-gated and never mutates the invoice', () => {
  const inv = paidInvoice();
  const before = JSON.stringify(inv);
  expect(INV.creditNote(inv, { role: 'staff' }).ok).toBe(false); // staff refused
  INV.creditNote(inv, { role: 'owner' });
  expect(JSON.stringify(inv)).toBe(before);         // invoice untouched (it references, not modifies)
});

test('partial credit allowed up to the total; over/zero refused', () => {
  const inv = paidInvoice(); // total 100
  const partial = INV.creditNote(inv, { role: 'owner', amount: 30 });
  expect(partial.ok).toBe(true);
  expect(partial.creditNote.amount).toBe(30);
  expect(partial.creditNote.full).toBe(false);
  expect(INV.creditNote(inv, { role: 'owner', amount: 0 }).ok).toBe(false);     // zero refused
  expect(INV.creditNote(inv, { role: 'owner', amount: 100.01 }).ok).toBe(false); // over total refused
});

test('a draft has nothing to credit', () => {
  const draft = INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 10 }], taxRate: 0 });
  const cn = INV.creditNote(draft, { role: 'owner' });
  expect(cn.ok).toBe(false);
  expect(cn.reason).toMatch(/applies to an issued invoice/);
});
