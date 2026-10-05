// N14: Accounting and Tax Records add rows up in the browser. Supabase returns
// at most its "Max rows" setting per request (1,000 by default) without saying
// it stopped short. These tests turn on the same cap in the mock and check the
// totals still include every row, and that a short read is reported instead of
// shown as a smaller total. Synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

function seedMany(backend, nOrders, nExpenses) {
  backend.tables.orders = Array.from({ length: nOrders }, (_, i) => ({
    id: 'ord-' + String(i).padStart(5, '0'), order_number: 'SYN-' + i, total: 10, tax_total: 0.5, currency: 'USD',
    status: 'paid', placed_at: '2026-03-01T12:00:00Z', deleted_at: null, source: 'manual', raw_data: null,
    customer_name: 'SYNTHETIC', created_at: '2026-03-01T12:00:00Z',
  }));
  backend.tables.expenses = Array.from({ length: nExpenses }, (_, i) => ({
    id: 'exp-' + String(i).padStart(5, '0'), category: 'packaging', amount: 1, expense_date: '2026-03-02',
    vendor: 'SYNTHETIC', receipt_path: null, deleted_at: null, note: null, created_at: '2026-03-02T00:00:00Z',
  }));
}

async function openAllTime(page, panel, backend) {
  await gotoPage(page, panel);
  await page.waitForLoadState('networkidle');
  const since = backend ? backend.requests.length : 0;
  await page.click(`#${panel} button[data-range="all"]`);
  return since;
}

const ordersReads = (backend, since) => backend.requests.slice(since).filter(r => r.method === 'GET' && r.table === 'orders' && r.params.some(([k]) => k === 'offset'));

for (const cap of [1000, 400]) {
  test(`Accounting "All Time" counts all 2,500 orders and 1,200 expenses with a ${cap}-row cap per reply`, async ({ page, backend }) => {
    seedMany(backend, 2500, 1200);
    backend.maxRows = cap;
    await login(page);
    const since = await openAllTime(page, 'accountingPanel', backend);
    const stats = page.locator('#acctStats');
    await expect(stats).toContainText('$25,000.00'); // revenue: 2,500 × $10
    await expect(stats).toContainText('$1,200.00');  // expenses: 1,200 × $1
    await expect(stats).toContainText('$23,800.00'); // net profit
    // It read the orders a page at a time, in a stable order.
    const offsets = ordersReads(backend, since).map(r => Number(Object.fromEntries(r.params).offset));
    expect(offsets.slice(0, 3)).toEqual([0, cap, 2 * cap]);
    expect(ordersReads(backend, since).every(r => Object.fromEntries(r.params).order === 'id.asc')).toBe(true);
  });
}

test('Tax Records "All Time" counts all 2,500 orders with the default 1,000-row cap', async ({ page, backend }) => {
  seedMany(backend, 2500, 1200);
  backend.maxRows = 1000;
  await login(page);
  await openAllTime(page, 'taxRecordsPanel');
  await expect(page.locator('#taxStats')).toContainText('$25,000.00');
  await expect(page.locator('#taxStats')).toContainText('$1,250.00'); // sales tax: 2,500 × $0.50
});

test('if rows go missing part-way, Accounting shows an error instead of a smaller total', async ({ page, backend }) => {
  seedMany(backend, 2500, 10);
  backend.maxRows = 1000;
  await login(page);
  await gotoPage(page, 'accountingPanel');
  await page.waitForLoadState('networkidle');
  // After the first page of the next read, most orders disappear (e.g. a
  // replica lagging, or rows deleted meanwhile): the count no longer adds up.
  const original = backend.handleRest.bind(backend);
  let served = 0;
  backend.handleRest = (route, entry) => {
    if (entry.method === 'GET' && entry.table === 'orders' && entry.params.some(([k]) => k === 'offset')) {
      served++;
      if (served === 2) backend.tables.orders = backend.tables.orders.slice(0, 1000);
    }
    return original(route, entry);
  };
  await page.click('#accountingPanel button[data-range="all"]');
  await expect(page.locator('#dashError')).toContainText('records could be read, so this total would be wrong');
});

test('Business Health tiles count every row: 1,500 pending approvals and 2,400 AI log entries with a 1,000-row cap', async ({ page, backend }) => {
  const nowIso = new Date().toISOString();
  backend.tables.approval_requests = Array.from({ length: 1500 }, (_, i) => ({
    id: 'ap-' + String(i).padStart(5, '0'), action_type: 'synthetic', summary: 'SYNTHETIC', status: 'pending', created_at: nowIso,
  }));
  backend.tables.ai_decision_log = Array.from({ length: 2400 }, (_, i) => ({
    id: 'ai-' + String(i).padStart(5, '0'), cost_usd: 0.01, model_used: 'rules-only', created_at: nowIso,
  }));
  backend.maxRows = 1000;
  await login(page);
  const tiles = page.locator('#businessHealthStats');
  await expect(tiles.locator('.stat', { hasText: 'Pending approvals' })).toContainText(/1,?500/);
  await expect(tiles.locator('.stat', { hasText: 'AI spend this month' })).toContainText('$24.00');
});

test('Tax Records cost-of-goods estimate: 2,500 orders with a 1,000-row cap and a 16 KB URL limit', async ({ page, backend }) => {
  seedMany(backend, 2500, 0);
  backend.tables.order_items = backend.tables.orders.map((o, i) => ({ id: 'oi-' + String(i).padStart(5, '0'), order_id: o.id, sku: i % 2 ? 'SYN-A' : 'SYN-B', product_name: 'SYNTHETIC', quantity: 2 }));
  backend.tables.products = [{ id: 'p-a', sku: 'SYN-A', cost: 1.5, name: 'SYNTHETIC A' }, { id: 'p-b', sku: 'SYN-B', cost: 2.5, name: 'SYNTHETIC B' }];
  backend.maxRows = 1000;
  backend.maxUrlLength = 16384;
  await login(page);
  await openAllTime(page, 'taxRecordsPanel');
  // 1,250 orders × 2 × $1.50 + 1,250 × 2 × $2.50 = $10,000
  await expect(page.locator('#taxCogsWrap')).toContainText('$10,000.00');
  expect(backend.requests.filter(r => r.table && r.method === 'GET' && r.path && (r.query || '').length > 16000)).toEqual([]);
});
