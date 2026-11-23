// EXT20 operator safety: Back / Forward after a saved high-risk change must never
// send it again. Forms are handled by the page (no browser form POST), so history
// navigation only switches pages; this proves it for a manual stock adjustment,
// the highest-risk form an operator uses daily. Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test('a saved stock adjustment is not sent again by Back, Forward or a reload', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'navigation logic; once');
  backend.tables.products = [{ id: 'p-op-1', name: 'SYNTHETIC operator product', sku: 'OP-1', is_active: true, status: 'active', cost: null, retail_price: null, wholesale_price: null, packaging_info: null }];
  backend.tables.inventory = [{ product_id: 'p-op-1', available: 10, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null }];
  backend.tables.inventory_adjustments = [];
  enableWrites(backend, ['inventory', 'inventory_adjustments']);
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  await page.waitForLoadState('networkidle');
  const productId = await page.locator('#invProduct option[value]:not([value=""])').first().getAttribute('value');
  const row = () => (backend.tables.inventory || []).find(x => x.product_id === productId);
  const writes = () => backend.tableWrites().filter(r => r.table === 'inventory' || r.table === 'inventory_adjustments' || /adjust_inventory/.test(r.path || '')).length;
  const before = Number(row().available || 0);
  await page.selectOption('#invProduct', productId);
  await page.selectOption('#invBucket', 'available');
  await page.fill('#invAmount', '3');
  await page.click('#adjustInventoryForm button[type=submit]');
  await expect.poll(() => Number(row().available || 0)).toBe(before + 3);
  await expect(page.locator('#adjustInventoryForm button[type=submit]')).toBeEnabled();
  await page.waitForLoadState('networkidle');
  const sent = writes();
  expect(sent).toBeGreaterThan(0);
  await gotoPage(page, 'tasksPanel');
  for (let i = 0; i < 2; i++) {
    await page.goBack(); await page.waitForLoadState('networkidle');
    await page.goForward(); await page.waitForLoadState('networkidle');
  }
  await page.goBack(); await page.waitForLoadState('networkidle');
  await page.reload(); await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  expect(writes(), 'no write after history navigation or reload').toBe(sent);
  expect(Number(row().available || 0)).toBe(before + 3);
});
