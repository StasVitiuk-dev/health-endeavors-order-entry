// Common scale matrix (2026-10-06, EXT3 workstream 5).
//
// One list of sizes, used for every reader where size matters. Supabase
// returns at most 1,000 rows per request without saying so; the mock is set
// to the same cap (maxRows = 1000), so a reader that does not page shows a
// wrong number at 1,001+. Each check is an EXACT total, so a missing row, a
// duplicated row at a page edge, or a short read shows up. Deleted rows are
// mixed in and must never count.
//
// Sizes: 0 1 2 10 99 100 499 500 501 999 1000 1001 2500 5000 10000 20000.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'scale; run once'); });

const SIZES = [0, 1, 2, 10, 99, 100, 499, 500, 501, 999, 1000, 1001, 2500, 5000, 10000, 20000];
const pad = i => String(i).padStart(6, '0');
const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function orders(n) {
  const rows = Array.from({ length: n }, (_, i) => ({
    id: 'ord-' + pad(i), order_number: 'SYN-' + i, total: 1.25, tax_total: 0.1, currency: 'USD', status: 'paid',
    placed_at: '2026-03-01T12:00:00Z', deleted_at: null, source: 'manual', raw_data: null, customer_name: 'SYNTHETIC',
    channel: 'manual', created_at: '2026-03-01T12:00:00Z',
  }));
  // deleted rows interleaved by id: never revenue
  for (let i = 0; i < Math.min(5, n); i++) rows.push({ ...rows[0], id: 'ord-' + pad(i) + 'd', deleted_at: '2026-03-02T00:00:00Z', total: 999 });
  return rows;
}
function expenses(n) {
  const rows = Array.from({ length: n }, (_, i) => ({
    id: 'exp-' + pad(i), category: 'packaging', amount: 0.75, expense_date: '2026-03-02', vendor: null, note: null,
    receipt_path: null, deleted_at: null,
  }));
  for (let i = 0; i < Math.min(5, n); i++) rows.push({ ...rows[0], id: 'exp-' + pad(i) + 'd', deleted_at: '2026-03-03T00:00:00Z', amount: 999 });
  return rows;
}

for (const n of SIZES) {
  test(`Accounting "All Time" revenue is exact with ${n} orders`, async ({ page, backend }) => {
    test.setTimeout(120000);
    Object.assign(backend.tables, { orders: orders(n), expenses: [], returns: [], order_items: [] });
    backend.maxRows = 1000;
    await login(page);
    await gotoPage(page, 'accountingPanel');
    await page.click('#acctToggle button[data-range="all"]');
    await expect(page.locator('#acctStats .stat').first().locator('.num')).toHaveText(money(n * 1.25), { timeout: 60000 });
  });
}

for (const n of [0, 1, 199, 200, 201, 999, 1000, 1001, 2500, 10000]) {
  test(`Expenses page count and total are exact with ${n} expenses`, async ({ page, backend }) => {
    test.setTimeout(120000);
    Object.assign(backend.tables, { expenses: expenses(n) });
    backend.maxRows = 1000;
    await login(page);
    await gotoPage(page, 'expensesPanel');
    const stats = page.locator('#expenseStats .stat .num');
    await expect(stats.nth(0)).toHaveText(n.toLocaleString('en-US'), { timeout: 60000 });
    await expect(stats.nth(1)).toHaveText(money(n * 0.75));
    await expect(page.locator('#expensesWrap .approvalRow')).toHaveCount(Math.min(n, 200));
  });
}

for (const n of [0, 1, 999, 1000, 1001]) {
  test(`Returns: ${n} open returns are counted exactly; a cut list says so`, async ({ page, backend }) => {
    test.setTimeout(120000);
    const base = { order_id: 'o1', order_item_id: 'oi1', reason: 'damaged', product_condition: 'resalable', refund_amount: null, approved_at: null,
      received_at: null, notes: null, disposition: null, refunded_at: null, orders: { order_number: 'SYN-1', customer_name: 'SYNTHETIC' },
      order_items: { product_name: 'SYNTHETIC', sku: 'SYN-A', quantity: 1 } };
    backend.tables.returns = Array.from({ length: n }, (_, i) => ({ ...base, id: 'ret-' + pad(i), status: 'requested', created_at: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString() }));
    backend.maxRows = 1000;
    await login(page);
    await gotoPage(page, 'returnsPanel');
    await expect(page.locator('#returnsStats .stat .num').nth(1)).toHaveText(n.toLocaleString('en-US'), { timeout: 60000 });
    if (n > 1000) await expect(page.locator('#returnsWrap .returnsCutNote')).toContainText(`newest 1000 of ${n} open returns`);
    else await expect(page.locator('#returnsWrap .returnsCutNote')).toHaveCount(0);
  });
}
