// Two-page US-Letter invoice + packing slip print model (wave-1 item 3). Pure,
// Node-only, synthetic. A long wholesale order spans two pages: headings repeat
// on every page, line items break across pages, totals appear on the LAST page
// only, the packing slip carries shipment-allocated lot labels with prices
// optional, and a packing slip is explicitly neither an invoice nor a carrier
// label. This is a print MODEL — it renders no PDF and writes nothing.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// 30 distinct line items -> more than one US-Letter page at 22 rows/page.
function longOrderLines(n) {
  const lines = [];
  for (let i = 1; i <= n; i++) lines.push({ sku: 'HE-SKU-' + String(i).padStart(2, '0'), description: 'Item ' + i, quantity: i, unitPrice: 12.00, lotNumber: 'LOT-' + i });
  return lines;
}

test('invoice print model: two pages, repeating headings, totals on the last page only', () => {
  const draft = INV.draftInvoice({ lines: longOrderLines(30), shipping: 25, taxRate: 0.08, currency: 'USD' });
  const issued = INV.issue(draft, { role: 'owner', number: 'WHL-7001' }).invoice;
  const doc = INV.invoicePrint(issued, { rowsPerPage: 22 });
  expect(doc.renderedPdf).toBe(false);
  expect(doc.page.page).toBe('us-letter');
  expect(doc.pageCount).toBe(2);               // 30 rows / 22 per page
  // every page repeats the column headings
  expect(doc.pages.every(p => p.repeatHeadings && p.headings[0] === 'Item' && p.headings.length === 5)).toBe(true);
  // rows break across the pages and none are lost
  expect(doc.pages[0].rows.length).toBe(22);
  expect(doc.pages[1].rows.length).toBe(8);
  expect(doc.pages[0].rows.length + doc.pages[1].rows.length).toBe(30);
  // totals appear on the last page only
  expect(doc.pages[0].showTotals).toBe(false);
  expect(doc.pages[1].showTotals).toBe(true);
  expect(doc.totals.total).toBe(issued.total);
  expect(doc.note).toMatch(/not a rendered PDF/);
});

test('packing slip print: lot labels on every page, prices optional, not a carrier label', () => {
  const slip = INV.packingSlip({ orderId: 'SYN-o', shipmentId: 'SYN-s', allocations: longOrderLines(30).map(l => ({ sku: l.sku, quantity: l.quantity, lotNumber: l.lotNumber, unitPrice: l.unitPrice })) });
  const doc = INV.packingSlipPrint(slip);
  expect(doc.pageCount).toBe(2);               // 30 rows / 26 per page
  // lot labels present and headings (no price column by default) repeat
  expect(doc.pages[0].headings).toEqual(['Item', 'Qty', 'Lot']);
  expect(doc.pages[0].rows[0].lotNumber).toBe('LOT-1');
  expect(doc.pages[0].rows[0].unitPrice).toBeUndefined();  // prices hidden by default
  expect(doc.note).toMatch(/not an invoice and not a carrier label/);

  // with prices shown, the heading gains a Unit column and prices appear
  const priced = INV.packingSlip({ allocations: [{ sku: 'X', quantity: 2, lotNumber: 'L1', unitPrice: 9.5 }], showPrices: true });
  const pdoc = INV.packingSlipPrint(priced);
  expect(pdoc.showPrices).toBe(true);
  expect(pdoc.pages[0].headings).toContain('Unit');
  expect(pdoc.pages[0].rows[0].unitPrice).toBe(9.5);
});

test('a single-page order is one page with totals (no spurious page break)', () => {
  const issued = INV.issue(INV.draftInvoice({ lines: longOrderLines(5), taxRate: 0 }), { role: 'owner', number: 'WHL-7002' }).invoice;
  const doc = INV.invoicePrint(issued);
  expect(doc.pageCount).toBe(1);
  expect(doc.pages[0].showTotals).toBe(true);
});
