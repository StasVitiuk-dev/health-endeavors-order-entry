// Captures the EXT11 screens into design-review/dashboard-extension-11-2026-10-11/.
// Synthetic data only (the test mock); nothing is fetched from the live site.
//   SHOT_SPEC=capture-screenshots-ext11 npx playwright test -c tests/tools/screenshots.config.js
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { preSqlProduction } = require('../helpers/pre-sql');
const { installStockFunctions, functionMissing } = require('../helpers/stock-functions-mock');

const OUT = path.join(__dirname, '..', '..', 'design-review', 'dashboard-extension-11-2026-10-11');
const shot = (page, name, ti) => page.screenshot({ path: path.join(OUT, `2026-10-11_ext11_${name}_${ti.project.name.slice(1)}.png` ) });
const deskAnd390 = ti => test.skip(ti.project.name === 'w320', 'two sizes are enough');
async function toTop(page, sel) {
  await page.evaluate(s => { const el = document.querySelector(s); if (el) { el.scrollIntoView({ block: 'start' }); (el.closest('main') || window).scrollBy(0, -90); } }, sel);
  await page.waitForTimeout(300);
}
const order = (id, total, placedAt) => ({ id, order_number: id.toUpperCase(), total, tax_total: '0.00', currency: 'USD', status: 'paid',
  placed_at: placedAt, deleted_at: null, source: 'manual', raw_data: null, customer_name: 'SYNTHETIC', created_at: placedAt });

test('system status: code merged, nothing installed yet', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  await preSqlProduction(page, backend);
  await login(page);
  await gotoPage(page, 'continuityPanel');
  await expect(page.locator('#systemStatusWrap')).toContainText('OK: all of these switches are OFF');
  await toTop(page, '#systemStatusWrap');
  await shot(page, '01-system-status-nothing-installed', ti);
});

test('system status: a switch ON without its database step', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  await preSqlProduction(page, backend);
  installStockFunctions(backend);
  backend.rpc.quarantine_recall = functionMissing();
  backend.tables.feature_flags = (backend.tables.feature_flags || []).concat([{ id: 'ff-s', flag_key: 'stock_fn_recall', label: 'stock_fn_recall', description: 'SYNTHETIC', enabled: true }]);
  await login(page);
  await gotoPage(page, 'continuityPanel');
  await expect(page.locator('#systemStatusWrap')).toContainText('PROBLEM');
  await toTop(page, '#systemStatusWrap');
  await shot(page, '02-system-status-switch-problem', ti);
});

test('home: today\'s revenue with an order that has no total', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  const now = new Date().toISOString();
  backend.tables.orders = [order('syn-3001', '25.00', now), order('syn-3002', null, now)];
  await login(page);
  await expect(page.locator('#attentionPanel .stat', { hasText: "Today's revenue" })).toContainText('without a total');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '03-home-revenue-missing-total', ti);
});

test('returns: lost connection after the return was marked Received', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  backend.tables.returns = [{ id: 'ret-s', order_id: 'ord-s', order_item_id: 'item-s', reason: 'damaged', status: 'approved', product_condition: null,
    disposition: null, refund_amount: null, approved_at: null, received_at: null, refunded_at: null, notes: null, created_at: '2026-09-20T00:00:00Z',
    orders: { order_number: 'SYN-4001', customer_name: 'SYNTHETIC' }, order_items: { product_name: 'SYNTHETIC lavender oil', sku: 'SYN-LAV-500', quantity: 2, unit_price: 20, line_total: 40 } }];
  backend.tables.products = [{ id: 'prod-s', name: 'SYNTHETIC lavender oil', sku: 'SYN-LAV-500' }];
  backend.tables.inventory = [{ product_id: 'prod-s', available: 10 }];
  backend.tables.inventory_adjustments = [];
  enableWrites(backend, ['inventory', 'inventory_adjustments']);
  backend.dropNext('returns', 'PATCH', { applied: true });
  await login(page);
  await gotoPage(page, 'returnsPanel');
  await page.selectOption('.dispositionSelect', 'restock_available');
  await page.click('.markReceivedBtn');
  await expect(page.locator('#dashError')).toContainText('restock did NOT run', { timeout: 30000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '04-return-lost-connection-saved', ti);
});
