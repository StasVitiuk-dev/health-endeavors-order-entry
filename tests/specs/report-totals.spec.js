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
    // It read the orders a page at a time, in id order, each page continuing
    // after the last id read (EXT5: keyset, not position).
    const reads = ordersReads(backend, since);
    expect(reads.every(r => Object.fromEntries(r.params).order === 'id.asc')).toBe(true);
    const afters = reads.map(r => (Object.fromEntries(r.params).id || '').replace(/^gt\./, ''));
    expect(afters[0]).toBe(''); // first page from the start
    expect(afters.slice(1, 3).every(Boolean)).toBe(true);
    expect([...afters.slice(1)].sort()).toEqual(afters.slice(1)); // always moving forward
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

// RP-02 (2026-10-06): exact totals at the page edges. With a 1,000-row cap,
// 999 / 1,000 / 1,001 are where an off-by-one in the paging would show; 0 and
// 1 are the small ends; 10,000 is the large end.
const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
for (const n of [0, 1, 999, 1000, 1001, 10000]) {
  test(`Accounting and Tax "All Time" are exact with ${n.toLocaleString('en-US')} orders and expenses (1,000-row cap)`, async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'arithmetic; run once');
    test.setTimeout(120000);
    seedMany(backend, n, n);
    backend.maxRows = 1000;
    await login(page);
    await openAllTime(page, 'accountingPanel');
    const stats = page.locator('#acctStats');
    await expect(stats).toContainText(money(n * 10)); // revenue
    await expect(stats).toContainText(money(n * 9));  // net profit = 10n − 1n
    await openAllTime(page, 'taxRecordsPanel');
    await expect(page.locator('#taxStats')).toContainText(money(n * 0.5)); // sales tax
    await expect(page.locator('#dashError')).toBeHidden();
  });
}

// RP-05 (2026-10-06): deleted (recycle-bin) orders and expenses never count,
// also when the deleted ones are spread across several pages.
test('Accounting and Tax leave out soft-deleted orders and expenses across pages', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'arithmetic; run once');
  seedMany(backend, 2500, 1500);
  backend.tables.orders.forEach((o, i) => { if (i % 5 === 0) o.deleted_at = '2026-03-05T00:00:00Z'; }); // 500 deleted
  backend.tables.expenses.forEach((e, i) => { if (i % 3 === 0) e.deleted_at = '2026-03-05T00:00:00Z'; }); // 500 deleted
  backend.maxRows = 1000;
  await login(page);
  await openAllTime(page, 'accountingPanel');
  await expect(page.locator('#acctStats')).toContainText('$20,000.00'); // 2,000 kept × $10
  await expect(page.locator('#acctStats')).toContainText('$1,000.00');  // 1,000 kept × $1
  await expect(page.locator('#acctStats')).toContainText('$19,000.00');
  await openAllTime(page, 'taxRecordsPanel');
  await expect(page.locator('#taxStats')).toContainText('$1,000.00'); // sales tax 2,000 × $0.50
});

// RP-07 (2026-10-06): the Tax CSV export carries the same complete figures
// as the screen at scale, and every receipt-less expense (1,200 of them).
test('Tax CSV export at 2,500 orders / 1,200 expenses matches the screen and lists every missing receipt', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'download; run once');
  const fs = require('fs');
  seedMany(backend, 2500, 1200);
  backend.maxRows = 1000;
  await login(page);
  await openAllTime(page, 'taxRecordsPanel');
  await expect(page.locator('#taxStats')).toContainText('$25,000.00');
  const [file] = await Promise.all([page.waitForEvent('download'), page.click('#taxExportBtn')]);
  const csv = fs.readFileSync(await file.path(), 'utf8');
  expect(csv).toContain('"Revenue","$25,000.00"');
  expect(csv).toContain('"Sales tax collected","$1,250.00"');
  const missingSection = csv.split('"Expenses missing a receipt"')[1];
  expect(missingSection.trim().split('\r\n').length - 1).toBe(1200); // header row + 1,200
});


// EXT5: an order created (or deleted) between two page reads used to shift the
// pages by one, so one order was counted twice and another missed, silently.
test('an order created while Accounting reads its pages is not double-counted', async ({ page, backend }) => {
  seedMany(backend, 2500, 0);
  backend.tables.orders[999].total = 500; // the last order of page 1: a repeat would show
  backend.maxRows = 1000;
  await login(page);
  await gotoPage(page, 'accountingPanel');
  await page.waitForLoadState('networkidle');
  const original = backend.handleRest.bind(backend);
  let served = 0;
  backend.handleRest = (route, entry) => {
    if (entry.method === 'GET' && entry.table === 'orders' && entry.params.some(([k]) => k === 'offset')) {
      served++;
      // before the 2nd page: a new order whose id sorts at the very start
      if (served === 2) backend.tables.orders.unshift({ ...backend.tables.orders[0], id: '0000-new', order_number: 'SYN-NEW', total: 10 });
    }
    return original(route, entry);
  };
  await page.click('#accountingPanel button[data-range="all"]');
  // The 2,500 orders that existed when the read began, each exactly once:
  // 2,499 x $10 + $500. (By position, order #1000 was counted twice and the last
  // one missed: $25,980.)
  await expect(page.locator('#acctStats .stat').first().locator('.num')).toHaveText('$25,490.00');
});
