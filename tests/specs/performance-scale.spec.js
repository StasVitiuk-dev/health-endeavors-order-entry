// Performance on realistic and large data (2026-10-06, extension 4,
// workstream AG). Times are from opening a page to its list being drawn, on
// the mocked backend (no network delay), so they measure the page's own work.
// Limits are generous (a slow CI machine must pass); the measured values are
// attached to each test so a slowdown is visible in the report.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'timing; run once'); });

const product = i => ({ id: 'p-' + i, name: 'SYNTHETIC product ' + i, sku: 'SY-' + i, is_active: true, status: 'active', cost: 1, retail_price: 2, wholesale_price: null, packaging_info: null });
const stock = p => ({ product_id: p.id, available: 5, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null });
const order = i => ({ id: 'o-' + String(i).padStart(6, '0'), order_number: 'SYN-' + i, total: 1.25, tax_total: 0, currency: 'USD', status: 'paid', placed_at: '2026-03-01T12:00:00Z', deleted_at: null, source: 'manual', raw_data: null, customer_name: 'SYNTHETIC', channel: 'manual', created_at: '2026-03-01T12:00:00Z' });

for (const [n, limitMs] of [[100, 5000], [1000, 15000]]) {
  test(`Inventory with ${n} products draws within ${limitMs / 1000} s`, async ({ page, backend }, testInfo) => {
    test.setTimeout(120000);
    backend.tables.products = Array.from({ length: n }, (_, i) => product(i));
    backend.tables.inventory = backend.tables.products.map(stock);
    await login(page);
    const t0 = Date.now();
    await gotoPage(page, 'inventoryPanel');
    await expect(page.locator(`#inventoryWrap [data-product-id="p-${n - 1}"]`)).toHaveCount(1, { timeout: limitMs });
    testInfo.annotations.push({ type: 'ms', description: String(Date.now() - t0) });
  });
}

for (const [n, limitMs] of [[1000, 15000], [20000, 60000]]) {
  test(`Accounting "All Time" over ${n} orders (paged reads) within ${limitMs / 1000} s`, async ({ page, backend }, testInfo) => {
    test.setTimeout(150000);
    Object.assign(backend.tables, { orders: Array.from({ length: n }, (_, i) => order(i)), expenses: [], returns: [], order_items: [] });
    backend.maxRows = 1000;
    await login(page);
    await gotoPage(page, 'accountingPanel');
    const t0 = Date.now();
    await page.click('#acctToggle button[data-range="all"]');
    const money = '$' + (n * 1.25).toLocaleString('en-US', { minimumFractionDigits: 2 });
    await expect(page.locator('#acctStats .stat').first().locator('.num')).toHaveText(money, { timeout: limitMs });
    testInfo.annotations.push({ type: 'ms', description: String(Date.now() - t0) });
  });
}
