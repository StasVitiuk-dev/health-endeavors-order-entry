// Invoice lifecycle — end-to-end integration (composes the Nov 7 invoice pieces).
// Pure, Node-only, synthetic money, simulated issuance only. One order runs the
// whole chain: reserve a collision-safe number -> draft -> correct the draft
// (history kept) -> issue with the reserved number (commit the sequence) ->
// partial then full payment -> credit note on the paid invoice -> print model.
// Every number reconciles across the steps. Nothing is sent or charged.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('reserve -> draft -> revise -> issue -> pay -> credit note -> print, all reconciling', () => {
  const seq = INV.createNumberSequence({ used: ['HE-2026-0001'] }); // one prior invoice this year

  // 1) reserve a collision-safe number for this order
  const reservation = seq.reserve({ year: 2026 });
  expect(reservation.number).toBe('HE-2026-0002');

  // 2) draft a 2-line wholesale order
  let draft = INV.draftInvoice({ lines: [
    { sku: 'HE-HONEY-8OZ', quantity: 10, unitPrice: 18.50, discount: 5 },
    { sku: 'HE-VEGAN-8OZ', quantity: 4, unitPrice: 18.50 },
  ], orderDiscount: 10, shipping: 12.5, taxRate: 0.08 });
  expect(draft.total).toBe(276.02); // (180 + 74) - 10 = 244; tax 19.52; +12.5

  // 3) correction before issue: honey 10 -> 12 (history preserved)
  const revised = INV.reviseDraft(draft, { lines: [
    { sku: 'HE-HONEY-8OZ', quantity: 12, unitPrice: 18.50, discount: 5 },
    { sku: 'HE-VEGAN-8OZ', quantity: 4, unitPrice: 18.50 },
  ], orderDiscount: 10, shipping: 12.5, taxRate: 0.08 }, { reason: 'buyer added 2 honey' });
  draft = revised.invoice;
  // subtotal = (12*18.50-5) + 74 = 217 + 74 = 291; taxable 281; tax 22.48; +12.5 = 315.98
  expect(draft.subtotal).toBe(291);
  expect(draft.total).toBe(315.98);
  expect(draft.revisions[0].was.total).toBe(276.02); // the pre-correction total is kept

  // 4) issue with the reserved number, then commit the sequence
  const issuedRes = INV.issue(draft, { role: 'owner', number: reservation.number, now: '2026-11-09', dueDate: '2026-11-23' });
  expect(issuedRes.ok).toBe(true);
  let invoice = issuedRes.invoice;
  expect(invoice.status).toBe('issued');
  expect(invoice.number).toBe('HE-2026-0002');
  expect(seq.commit(reservation.token).ok).toBe(true);
  // the next reservation moves on, never reusing this number
  expect(seq.reserve({ year: 2026 }).number).toBe('HE-2026-0003');

  // 5) partial then full payment
  invoice = INV.applyPayment(invoice, { amount: 100, key: 'w1' }).invoice;
  expect(invoice.status).toBe('partially_paid');
  expect(invoice.balance).toBe(215.98);
  invoice = INV.applyPayment(invoice, { amount: 215.98, key: 'w2' }).invoice;
  expect(invoice.status).toBe('paid');
  expect(invoice.balance).toBe(0);

  // 6) a paid invoice can't be voided, but a credit note reverses it
  expect(INV.voidInvoice(invoice, { role: 'owner' }).ok).toBe(false);
  const cn = INV.creditNote(invoice, { role: 'owner', number: 'CN-2026-0001', reason: 'partial return', amount: 37, now: '2026-11-20' });
  expect(cn.ok).toBe(true);
  expect(cn.creditNote.invoiceNumber).toBe('HE-2026-0002');
  expect(cn.creditNote.amount).toBe(37);
  expect(cn.creditNote.full).toBe(false);

  // 7) the print model carries the issued number + dates and the correct total
  const doc = INV.invoicePrint(invoice);
  expect(doc.header.number).toBe('HE-2026-0002');
  expect(doc.header.issueDate).toBe('2026-11-09');
  expect(doc.header.dueDate).toBe('2026-11-23');
  expect(doc.totals.total).toBe(315.98);

  // 8) the issued snapshot is immutable and matches what was issued
  expect(invoice.versions.length).toBe(1);
  expect(invoice.versions[0].snapshot.total).toBe(315.98);
});
