// #65 Saved views — dashboard journey on Orders + Inventory, behind the
// default-OFF he_saved_views flag. Verifies persistence across reload, restore,
// reset, delete, and that the flag OFF leaves the screens unchanged.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

async function enableViews(page) {
  await page.addInitScript(() => { try { localStorage.setItem('he_saved_views', 'on'); } catch (e) {} });
}

test('flag OFF (default): no saved-views control on Orders or Inventory', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await expect(page.locator('#savedViewsOrders .savedViews')).toHaveCount(0);
  await gotoPage(page, 'inventoryPanel');
  await expect(page.locator('#savedViewsInventory .savedViews')).toHaveCount(0);
});

test('flag ON: a view saves, persists across reload, restores, and deletes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await enableViews(page);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const host = page.locator('#savedViewsOrders');
  await expect(host.locator('.savedViews')).toHaveCount(1);
  await expect(host).toContainText('No saved views yet.');

  // Fill the filter preset and save it.
  await host.locator('#ordersPanelViewName').fill('Unfulfilled wholesale');
  await host.locator('#ordersPanelViewSearch').fill('cedar');
  await host.locator('#ordersPanelViewStatus').selectOption('unfulfilled');
  await host.locator('[data-savedview="save"][data-panel="ordersPanel"]').click();
  await expect(host.locator('[data-savedview="restore"]')).toContainText('Unfulfilled wholesale');

  // Reload the whole page: the saved view persists (localStorage).
  await page.reload();
  await gotoPage(page, 'ordersPanel');
  const host2 = page.locator('#savedViewsOrders');
  await expect(host2.locator('[data-savedview="restore"]')).toContainText('Unfulfilled wholesale');

  // Reset clears the fields; restore fills them back from the saved view.
  await host2.locator('[data-savedview="reset"][data-panel="ordersPanel"]').click();
  await expect(host2.locator('#ordersPanelViewSearch')).toHaveValue('');
  await host2.locator('[data-savedview="restore"][data-name="Unfulfilled wholesale"]').click();
  await expect(host2.locator('#ordersPanelViewSearch')).toHaveValue('cedar');
  await expect(host2.locator('#ordersPanelViewStatus')).toHaveValue('unfulfilled');

  // Delete removes it.
  await host2.locator('[data-savedview="delete"][data-name="Unfulfilled wholesale"]').click();
  await expect(host2).toContainText('No saved views yet.');

  expect(errors.join('\n')).not.toMatch(/Trusted Type|Refused to|savedview/i);
});

test('flag ON: Orders and Inventory keep separate saved views', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  await enableViews(page);
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  const inv = page.locator('#savedViewsInventory');
  await inv.locator('#inventoryPanelViewName').fill('Low stock');
  await inv.locator('#inventoryPanelViewStatus').selectOption('low');
  await inv.locator('[data-savedview="save"][data-panel="inventoryPanel"]').click();
  await expect(inv.locator('[data-savedview="restore"]')).toContainText('Low stock');
  // Orders does not show the Inventory view.
  await gotoPage(page, 'ordersPanel');
  await expect(page.locator('#savedViewsOrders')).toContainText('No saved views yet.');
});

test('flag ON: the save/filter controls are real, labelled, keyboard-focusable form fields', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  await enableViews(page);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const host = page.locator('#savedViewsOrders');
  // The name input is focusable and carries an accessible label.
  await host.locator('#ordersPanelViewName').focus();
  await expect(host.locator('#ordersPanelViewName')).toBeFocused();
  await expect(host.locator('#ordersPanelViewName')).toHaveAttribute('aria-label', /name this view/i);
  await expect(host.locator('#ordersPanelViewStatus')).toHaveAttribute('aria-label', /status/i);
  await expect(host.locator('[data-savedview="save"]')).toBeVisible();
});
