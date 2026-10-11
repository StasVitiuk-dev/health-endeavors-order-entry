// EXT10 (U38): on a phone the wide tables become one card per row, so nothing
// has to be scrolled sideways inside a table and every value carries its
// column name. Desktop keeps the normal table. Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const LONG = 'SYNTHETIC customer with a deliberately long name for wrapping';
function seed(backend) {
  const now = new Date();
  const iso = d => new Date(now.getTime() - d * 86400000).toISOString();
  backend.tables.orders = [0, 1, 2].map(i => ({ id: 'ord-c' + i, order_number: 'HE-CARD-100' + i, total: (123.45 * (i + 1)).toFixed(2), tax_total: '0.00', currency: 'USD',
    status: 'paid', placed_at: iso(i), deleted_at: null, source: 'manual', raw_data: null, customer_name: LONG, created_at: iso(i) }));
  backend.tables.incidents = [0, 1].map(i => ({ id: 'inc-c' + i, incident_number: 'INC-CARD-' + i, title: 'SYNTHETIC incident title that is fairly long ' + i, severity: 'high', status: 'open', due_at: iso(-2) }));
  backend.tables.ai_decision_log = [0, 1].map(i => ({ id: 'ai-c' + i, agent_key: 'customer_service_agent', output_summary: 'SYNTHETIC summary of a drafted reply that runs on for a while ' + i, confidence: 0.82, escalated_to_human: i === 1, cost_usd: 0.01, created_at: iso(i) }));
  backend.tables.daily_reports = [0, 1].map(i => ({ id: 'dr-c' + i, report_date: iso(i).slice(0, 10), orders_count: 12, revenue: '456.70', currency: 'USD', new_inquiries_count: 3, tasks_opened_count: 2, incidents_opened_count: 1, ai_calls_count: 40, ai_cost: '1.20', emailed_at: null }));
}
const PAGES = [['tasksPanel', '#tasksTableWrap'], ['ordersPanel', '#ordersTableWrap'], ['incidentsPanel', '#incidentsTableWrap'], ['aiPanel', '#aiTableWrap'], ['reportHistoryPanel', '#reportHistoryPanel']];

for (const w of [320, 360, 375, 390, 414, 430]) {
  test(`${w} px: wide tables are cards, nothing scrolls sideways, every value is labelled`, async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'sets its own phone width; run once');
    seed(backend);
    await page.setViewportSize({ width: w, height: 800 });
    await login(page);
    for (const [id, sel] of PAGES) {
      await gotoPage(page, id);
      const t = page.locator(sel + ' table.phoneCards').first();
      await expect(t, id).toBeVisible();
      const r = await t.evaluate(el => ({
        over: el.scrollWidth - el.clientWidth,
        rowDisplay: getComputedStyle(el.querySelector('tbody tr')).display,
        unlabelled: [...el.querySelectorAll('tbody td')].filter(td => !td.dataset.label && !td.classList.contains('cardActions')).length,
        offscreen: [...el.querySelectorAll('button, input')].filter(b => { const x = b.getBoundingClientRect(); return x.width && (x.left < 0 || x.right > innerWidth); }).length,
        roles: el.getAttribute('role') + '/' + el.querySelector('tbody tr').getAttribute('role') + '/' + el.querySelector('tbody td').getAttribute('role'),
      }));
      expect(r, id).toEqual({ over: 0, rowDisplay: 'block', unlabelled: 0, offscreen: 0, roles: 'table/row/cell' });
    }
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('the column name is shown next to each value on a phone', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  seed(backend);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const cell = page.locator('#ordersTableWrap tr[data-id="ord-c0"] td').nth(1);
  await expect(cell).toHaveAttribute('data-label', 'Customer');
  expect(await cell.evaluate(td => getComputedStyle(td, '::before').content)).toBe('"Customer"');
  await expect(page.locator('#ordersTableWrap tr[data-id="ord-c0"] td.cardActions .deleteOrderBtn')).toBeVisible();
});

test('desktop keeps the normal table (no cards, header row drawn)', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'desktop only');
  seed(backend);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const t = page.locator('#ordersTableWrap table.phoneCards');
  expect(await t.evaluate(el => [getComputedStyle(el.querySelector('tbody tr')).display, getComputedStyle(el.querySelector('thead')).position])).toEqual(['table-row', 'static']);
});

test('768 px tablet keeps the table and it fits', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'sets its own width; run once');
  seed(backend);
  await page.setViewportSize({ width: 768, height: 900 });
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const r = await page.locator('#ordersTableWrap table').evaluate(el => getComputedStyle(el.querySelector('tbody tr')).display);
  expect(r).toBe('table-row');
});

test('purchase order lines are cards on a phone, lot field inside the screen', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  const items = [{ id: 'poi-c', purchase_order_id: 'po-c', product_id: 'prod-c', description: 'SYNTHETIC lavender oil, 500 ml amber bottle', sku: 'SYN-LAV-500', quantity: 40, unit_cost: 3, quantity_received: 0, landed_unit_cost: null }];
  backend.tables.products = [{ id: 'prod-c', name: 'SYNTHETIC Lavender', sku: 'SYN-LAV-500', is_active: true, status: 'active', cost: 3, retail_price: 20, wholesale_price: 12, packaging_info: null, updated_at: '2026-09-01T00:00:00Z',
    inventory: { available: 1, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: 5 }, inventory_lots: [] }];
  backend.tables.purchase_order_items = items;
  backend.tables.purchase_orders = [{ id: 'po-c', po_number: 'PO-CARD-1', supplier_id: null, status: 'shipped', currency: 'USD', shipping_cost: 10, tax: 2, expense_category: 'ingredients',
    ordered_at: '2026-09-20T00:00:00Z', expected_at: '2026-10-01', received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-20T00:00:00Z', deleted_at: null,
    suppliers: { name: 'SYNTHETIC Botanicals' }, purchase_order_items: items }];
  await page.setViewportSize({ width: 320, height: 800 });
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.locator('.poItem[data-id="po-c"] .poRow').click();
  const o = page.locator('#inspectorOverlay');
  if (await o.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  const t = page.locator('#poDetail_po-c table.phoneCards');
  await expect(t).toBeVisible();
  const r = await t.evaluate(el => ({ over: el.scrollWidth - el.clientWidth, lot: (() => { const x = el.querySelector('.poLineLot').getBoundingClientRect(); return x.left >= 0 && x.right <= innerWidth; })() }));
  expect(r).toEqual({ over: 0, lot: true });
  await expect(page.locator('#poDetail_po-c td[data-label="Lot #"] .poLineLot')).toBeVisible();
});
