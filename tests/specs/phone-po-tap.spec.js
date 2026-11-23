// Phone: tapping a purchase order opens its details only; it must not also
// open the change-history window on top (which hid "Receive delivery").
// Tapping other rows (e.g. a task) still opens the history, as before.
// Phone size only; synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'tap to inspect: phone only');
});

test('tapping a purchase order shows its details without the history window', async ({ page, backend }) => {
  const items = [{ id: 'poi-1', purchase_order_id: 'po-1', product_id: null, description: 'SYNTHETIC bottles', sku: null, quantity: 10, unit_cost: 1, quantity_received: 0, landed_unit_cost: null }];
  Object.assign(backend.tables, {
    purchase_orders: [{ id: 'po-1', po_number: 'PO-SYN-1', status: 'shipped', currency: 'USD', shipping_cost: 0, tax: 0, expense_category: 'packaging', ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z', suppliers: { name: 'SYNTHETIC Supplier' }, purchase_order_items: items }],
    purchase_order_items: items,
  });
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.waitForLoadState('networkidle');
  await page.locator('.poItem[data-id="po-1"] .poRow').click();
  await expect(page.locator('.poReceiveBtn')).toBeVisible();
  await expect(page.locator('#inspectorOverlay')).not.toHaveClass(/open/);
  await page.locator('.poReceiveBtn').click({ trial: true }); // reachable, not covered
});

test('tapping a task row still opens its change history (unchanged)', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await page.waitForLoadState('networkidle');
  await page.locator('#tasksTableWrap tr[data-id="task-open-1"] td').first().click();
  await expect(page.locator('#inspectorOverlay')).toHaveClass(/open/);
});
