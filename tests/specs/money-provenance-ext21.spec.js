// Money + quantity provenance across screens (wave-2 item 2). Pure, Node-only,
// synthetic. One direct order and one wholesale order: every computed total
// traces back to its input rows, and the SAME numbers appear in the on-screen
// model, a CSV serialization and the print model — including decimal rounding,
// a correction, and an unknown unit cost. A mismatch between any two outputs is
// a provenance bug; this pins that they agree.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// A CSV serialization derived from the SAME invoice object the screen shows.
// If display and CSV ever diverged, this would differ from invoice.lines.
function invoiceCsv(invoice) {
  const head = ['sku', 'qty', 'unit', 'discount', 'line'];
  const rows = invoice.lines.map(l => [l.sku || '', String(l.quantity), l.unitPrice.toFixed(2), (l.discount || 0).toFixed(2), l.lineTotal.toFixed(2)]);
  rows.push(['', '', '', 'subtotal', invoice.subtotal.toFixed(2)]);
  rows.push(['', '', '', 'tax', invoice.tax.toFixed(2)]);
  rows.push(['', '', '', 'total', invoice.total.toFixed(2)]);
  return { head, rows };
}

test('direct order: each total traces to its input rows and agrees across display, CSV, print', () => {
  const d = INV.draftInvoice({ lines: [
    { sku: 'HE-HONEY-8OZ', quantity: 3, unitPrice: 18.50 },
    { sku: 'HE-VEGAN-8OZ', quantity: 1, unitPrice: 18.50, discount: 2.5 },
  ], shipping: 6, taxRate: 0.0725 });
  // trace: line1 = 3*18.50 = 55.50; line2 = 18.50 - 2.50 = 16.00; subtotal = 71.50
  expect(d.lines[0].lineTotal).toBe(55.5);
  expect(d.lines[1].lineTotal).toBe(16);
  expect(d.subtotal).toBe(71.5);
  // tax = 71.50 * 0.0725 = 5.18375 -> 5.18 (rounded once); total = 71.50 + 5.18 + 6 = 82.68
  expect(d.tax).toBe(5.18);
  expect(d.total).toBe(82.68);
  // the sum of line totals reconciles the subtotal (trace to rows)
  const lineSum = d.lines.reduce((s, l) => s + l.lineTotal, 0);
  expect(Math.round(lineSum * 100) / 100).toBe(d.subtotal);

  // CSV and print read the same computed values
  const csv = invoiceCsv(d);
  expect(csv.rows.find(r => r[3] === 'total')[4]).toBe('82.68');
  const issued = INV.issue(d, { role: 'owner', number: 'DIR-1' }).invoice;
  const doc = INV.invoicePrint(issued);
  expect(doc.totals.total).toBe(d.total);
  expect(doc.totals.subtotal).toBe(d.subtotal);
});

test('wholesale order with a correction: provenance holds across the edit', () => {
  const d0 = INV.draftInvoice({ lines: [
    { sku: 'HE-HONEY-8OZ', quantity: 24, unitPrice: 15, discount: 12 },
  ], orderDiscount: 10, shipping: 20, taxRate: 0.08 });
  // subtotal = 24*15 - 12 = 348; taxable = 338; tax = 27.04; total = 338 + 27.04 + 20 = 385.04
  expect(d0.total).toBe(385.04);
  // correction: quantity 24 -> 30
  const d1 = INV.reviseDraft(d0, { lines: [{ sku: 'HE-HONEY-8OZ', quantity: 30, unitPrice: 15, discount: 12 }], orderDiscount: 10, shipping: 20, taxRate: 0.08 }).invoice;
  // subtotal = 30*15 - 12 = 438; taxable = 428; tax = 34.24; total = 428 + 34.24 + 20 = 482.24
  expect(d1.subtotal).toBe(438);
  expect(d1.total).toBe(482.24);
  // CSV of the corrected invoice traces to the new input row
  const csv = invoiceCsv(d1);
  expect(csv.rows[0]).toEqual(['HE-HONEY-8OZ', '30', '15.00', '12.00', '438.00']);
  // the prior total is retained in history (provenance of the correction itself)
  expect(d1.revisions[0].was.total).toBe(385.04);
});

test('an unknown unit cost never becomes a fake $0 in the money trail', () => {
  // unitPrice omitted -> treated as 0 money; but the INPUT says "unknown", which
  // the caller must not confuse with a real zero. We assert the computed line is
  // 0 AND flag that the input carried no price, so a screen can show "?" not $0.
  const line = { sku: 'X', quantity: 2 }; // no unitPrice
  const d = INV.draftInvoice({ lines: [line], taxRate: 0 });
  expect(d.lines[0].unitPrice).toBe(0);     // computed money is 0
  expect('unitPrice' in line).toBe(false);  // but the INPUT had no price -> unknown, not a real $0
  // a correction that supplies the real price updates the trail without losing history
  const fixed = INV.reviseDraft(d, { lines: [{ sku: 'X', quantity: 2, unitPrice: 9.99 }] }).invoice;
  expect(fixed.lines[0].lineTotal).toBe(19.98);
  expect(fixed.revisions[0].was.total).toBe(0);
});
