// Large synthetic lists + documents (wave-2 item 7). Pure, Node-only, synthetic.
// A long invoice paginates with every line kept and the total intact; an empty
// result is one empty page (no crash, no spurious break); a long report selects
// a sub-range deterministically and reopening the same filter yields identical
// rows; and pagination stays linear at 1000 rows (correctness check, not a
// micro-benchmark). Keyboard reachability of these views is covered by
// a11y-basics (carried forward).
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');
const RX = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('a long invoice paginates with every line kept and totals intact', () => {
  const lines = [];
  for (let i = 1; i <= 100; i++) lines.push({ sku: 'SKU-' + i, quantity: 1, unitPrice: 2.00 });
  const issued = INV.issue(INV.draftInvoice({ lines, taxRate: 0 }), { role: 'owner', number: 'BIG-1' }).invoice;
  const doc = INV.invoicePrint(issued, { rowsPerPage: 22 });
  expect(doc.pageCount).toBe(5);                               // ceil(100/22)
  // no line lost across pages
  const total = doc.pages.reduce((n, p) => n + p.rows.length, 0);
  expect(total).toBe(100);
  // totals appear once, on the last page, and match the computed total
  expect(doc.pages.filter(p => p.showTotals)).toHaveLength(1);
  expect(doc.pages[doc.pageCount - 1].showTotals).toBe(true);
  expect(doc.totals.total).toBe(200);                         // 100 * 2.00
});

test('an empty result is a single empty page with totals (no crash, no spurious break)', () => {
  const issued = INV.issue(INV.draftInvoice({ lines: [], taxRate: 0 }), { role: 'owner', number: 'BIG-0' }).invoice;
  const doc = INV.invoicePrint(issued);
  expect(doc.pageCount).toBe(1);
  expect(doc.pages[0].rows).toHaveLength(0);
  expect(doc.pages[0].showTotals).toBe(true);
  expect(doc.totals.total).toBe(0);
});

test('a long report selects a sub-range deterministically; reopening the same filter is identical', () => {
  const history = [];
  for (let d = 1; d <= 90; d++) history.push({ report_date: '2026-09-' + String(((d - 1) % 30) + 1).padStart(2, '0'), currency: 'USD', orders_count: d, revenue: d * 1.5 });
  // a filter over a sub-range
  const range = { from: '2026-09-10', to: '2026-09-20' };
  const first = RX.selectReports(history, range);
  const again = RX.selectReports(history, range);
  expect(first.length).toBeGreaterThan(0);
  expect(JSON.stringify(first)).toBe(JSON.stringify(again));  // reopening the same filter -> identical
  // every selected row is within the range (filtering is correct)
  expect(first.every(r => r.report_date >= '2026-09-10' && r.report_date <= '2026-09-20')).toBe(true);
  // the export of a filtered view is deterministic too
  expect(RX.buildManifest({ history, from: range.from, to: range.to }).checksum)
    .toBe(RX.buildManifest({ history, from: range.from, to: range.to }).checksum);
});

test('pagination stays correct (linear) at 1000 rows', () => {
  const items = [];
  for (let i = 0; i < 1000; i++) items.push(i);
  const pages = INV.paginate(items, 22);
  expect(pages.length).toBe(Math.ceil(1000 / 22));            // 46
  expect(pages.reduce((n, p) => n + p.length, 0)).toBe(1000); // nothing dropped
  expect(pages[pages.length - 1].length).toBe(1000 % 22 || 22);
});
