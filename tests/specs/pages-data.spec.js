// Page-level tests with realistic synthetic data: Orders, Expenses,
// Accounting, Tax, Inventory, Returns. They check what is shown, and that the
// buttons send exactly the expected request (table, fields, filters).
//
// The browser clock is frozen (fixtures/business-data.js) and the time zone
// is fixed to America/Chicago, so every total below is deterministic.

const fs = require('fs');
const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

test.beforeEach(async ({ page, backend }) => {
  seedBusiness(backend);
  enableWrites(backend, ['expenses', 'inventory', 'manual_attention_items']);
  await page.clock.setFixedTime(NOW);
  await login(page);
});

async function open(page, panelId) {
  await gotoPage(page, panelId);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);
const filtersOf = r => Object.fromEntries(r.params.filter(([k]) => k !== 'select'));

async function confirmPassword(page, password) {
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await page.fill('#reauthPassword', password);
  await page.click('#reauthConfirmBtn');
}

// ------------------------------------------------------------------ Orders
test.describe('Orders', () => {
  test.beforeEach(async ({ page }) => { await open(page, 'ordersPanel'); });

  test('shows the order count, revenue, recent orders and the recycle bin', async ({ page }) => {
    await expect(page.locator('#orderStats')).toContainText('5');
    await expect(page.locator('#orderStats')).toContainText('$470.00'); // all non-deleted orders, any status
    const numbers = await page.locator('#ordersTableWrap tbody tr td:first-child').allInnerTexts();
    expect(numbers).toEqual(['SYN-1001', 'SYN-1002', 'SYN-1003', 'SYN-1004', 'SYN-1005']);
    await expect(page.locator('#deletedOrdersWrap')).toContainText('SYN-0999');
  });

  test('logs customer-data access once per customer email shown', async ({ backend }) => {
    const logged = backend.requests.filter(r => r.rpc === 'log_customer_data_access').map(r => r.body.p_customer_email);
    expect(new Set(logged)).toEqual(new Set(['one@example.test', 'two@example.test', 'three@example.test', 'four@example.test', 'deleted@example.test']));
  });

  test('Delete asks for your password; Cancel changes nothing', async ({ page, backend }) => {
    await page.locator('#ordersTableWrap tr[data-id="o1"] .deleteOrderBtn').click();
    await expect(page.locator('#reauthOverlay')).toBeVisible();
    await page.click('#reauthCancelBtn');
    await expect(page.locator('#reauthOverlay')).toBeHidden();
    expect(writes(backend, 'orders')).toEqual([]);
  });

  test('Delete with a wrong password is refused and changes nothing', async ({ page, backend }) => {
    await page.locator('#ordersTableWrap tr[data-id="o1"] .deleteOrderBtn').click();
    await confirmPassword(page, 'not-the-password');
    await expect(page.locator('#reauthMsg')).toContainText("didn't work");
    await expect(page.locator('#reauthOverlay')).toBeVisible();
    expect(writes(backend, 'orders')).toEqual([]);
  });

  test('Delete with the right password soft-deletes only that order (deleted_at only)', async ({ page, backend }) => {
    await page.locator('#ordersTableWrap tr[data-id="o1"] .deleteOrderBtn').click();
    await confirmPassword(page, OWNER_USER.password);
    await expect.poll(() => writes(backend, 'orders').length).toBe(1);
    const [w] = writes(backend, 'orders');
    expect(w.method).toBe('PATCH');
    expect(Object.keys(w.body)).toEqual(['deleted_at']);
    expect(filtersOf(w)).toEqual({ id: 'eq.o1', deleted_at: 'is.null' }); // only if not already deleted
  });

  test('Escape closes the password prompt without deleting', async ({ page, backend }) => {
    await page.locator('#ordersTableWrap tr[data-id="o1"] .deleteOrderBtn').click();
    await expect(page.locator('#reauthOverlay')).toBeVisible();
    await page.press('#reauthPassword', 'Escape');
    await expect(page.locator('#reauthOverlay')).toBeHidden();
    expect(writes(backend, 'orders')).toEqual([]);
  });

  test('the password prompt fits on screen and its buttons can be reached', async ({ page }) => {
    await page.locator('#ordersTableWrap tr[data-id="o1"] .deleteOrderBtn').click();
    await expect(page.locator('#reauthOverlay')).toBeVisible();
    for (const id of ['#reauthPassword', '#reauthConfirmBtn', '#reauthCancelBtn']) {
      await expect(page.locator(id)).toBeInViewport({ ratio: 1 });
    }
    const vw = page.viewportSize().width;
    const box = await page.locator('#reauthConfirmBtn').boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(vw);
    expect(box.height).toBeGreaterThanOrEqual(28);
  });

  test('Restore asks for your password and clears deleted_at only', async ({ page, backend }) => {
    await page.locator('#deletedOrdersWrap .restoreOrderBtn').click();
    await confirmPassword(page, OWNER_USER.password);
    await expect.poll(() => writes(backend, 'orders').length).toBe(1);
    const [w] = writes(backend, 'orders');
    expect(w.body).toEqual({ deleted_at: null });
    expect(filtersOf(w)).toEqual({ id: 'eq.o6' });
  });
});

// ---------------------------------------------------------------- Expenses
test.describe('Expenses', () => {
  test.beforeEach(async ({ page }) => { await open(page, 'expensesPanel'); });

  test('lists non-deleted expenses with their total', async ({ page }) => {
    await expect(page.locator('#expenseStats')).toContainText('4');
    await expect(page.locator('#expenseStats')).toContainText('$187.50');
    await expect(page.locator('#expensesWrap .approvalRow')).toHaveCount(4);
    await expect(page.locator('#expensesWrap')).not.toContainText('SYNTHETIC deleted');
  });

  test('Add expense sends exactly the expected fields', async ({ page, backend }) => {
    await page.selectOption('#expCategory', 'software');
    await page.fill('#expAmount', '19.99');
    await page.fill('#expDate', '2026-06-14');
    await page.fill('#expVendor', '  SYNTHETIC Vendor  ');
    await page.click('#addExpenseForm button[type=submit]');
    await expect.poll(() => writes(backend, 'expenses').length).toBe(1);
    expect(writes(backend, 'expenses')[0].body).toEqual({
      category: 'software', amount: 19.99, expense_date: '2026-06-14',
      vendor: 'SYNTHETIC Vendor', note: null, receipt_path: null,
    });
    await expect(page.locator('#expCategory')).toHaveValue('');
  });

  test('without a category nothing is sent', async ({ page, backend }) => {
    await page.fill('#expAmount', '5');
    await page.fill('#expDate', '2026-06-14');
    // The browser's own "required" check stops the form before the page's code runs.
    await page.click('#addExpenseForm button[type=submit]');
    await page.waitForTimeout(300);
    expect(writes(backend, 'expenses')).toEqual([]);
  });

  test('a double-click on Add sends one expense', async ({ page, backend }) => {
    await page.selectOption('#expCategory', 'other');
    await page.fill('#expAmount', '7');
    await page.fill('#expDate', '2026-06-14');
    backend.delayMs.expenses = 400;
    await page.dblclick('#addExpenseForm button[type=submit]');
    await page.waitForTimeout(900);
    expect(writes(backend, 'expenses')).toHaveLength(1);
  });

  test('a failed save shows an error and keeps what you typed', async ({ page, backend }) => {
    backend.failNext('expenses', 'POST');
    await page.selectOption('#expCategory', 'other');
    await page.fill('#expAmount', '7');
    await page.fill('#expDate', '2026-06-14');
    await page.click('#addExpenseForm button[type=submit]');
    await expect(page.locator('#dashError')).toContainText('Could not save that expense');
    await expect(page.locator('#expAmount')).toHaveValue('7');
    await expect(page.locator('#addExpenseForm button[type=submit]')).toBeEnabled();
  });

  test('Delete soft-deletes (deleted_at only) and asks for no password', async ({ page, backend }) => {
    await page.locator('#expensesWrap .approvalRow[data-id="e3"] .expDeleteBtn').click();
    await expect.poll(() => writes(backend, 'expenses').length).toBe(1);
    const [w] = writes(backend, 'expenses');
    expect(Object.keys(w.body)).toEqual(['deleted_at']);
    expect(filtersOf(w)).toEqual({ id: 'eq.e3', deleted_at: 'is.null' });
    await expect(page.locator('#reauthOverlay')).toBeHidden();
  });
});

// -------------------------------------------------------------- Accounting
test.describe('Accounting', () => {
  test.beforeEach(async ({ page }) => { await open(page, 'accountingPanel'); });

  const stat = (page, label) => page.locator('#acctStats .stat', { hasText: label }).locator('.num');

  test('Today: revenue, expenses and net profit for today only', async ({ page }) => {
    await expect(stat(page, 'Revenue')).toHaveText('$100.00');
    await expect(stat(page, 'Expenses')).toHaveText('$30.00');
    await expect(stat(page, 'Net profit')).toHaveText('$70.00');
  });

  test('All Time: cancelled and fully refunded orders are excluded; partial refunds need review', async ({ page }) => {
    await page.click('#acctToggle button[data-range="all"]');
    await expect(stat(page, 'Revenue')).toHaveText('$380.00');
    await expect(stat(page, 'Expenses')).toHaveText('$187.50');
    await expect(stat(page, 'Net profit')).toHaveText('$192.50');
    await expect(stat(page, 'excluded')).toHaveText('$90.00');
    await expect(page.locator('#acctReviewWrap')).toContainText('SYN-1003');
  });

  test('This Month counts orders and expenses since the 1st', async ({ page }) => {
    await page.click('#acctToggle button[data-range="month"]');
    await expect(stat(page, 'Revenue')).toHaveText('$180.00');
    await expect(stat(page, 'Expenses')).toHaveText('$75.50');
  });
});

// --------------------------------------------------------------------- Tax
test.describe('Tax records', () => {
  test.beforeEach(async ({ page }) => { await open(page, 'taxRecordsPanel'); });

  const stat = (page, label) => page.locator('#taxStats .stat', { hasText: label }).locator('.num');

  test('This Year: revenue, cost of goods, operating costs, profit and sales tax', async ({ page }) => {
    await expect(stat(page, 'Revenue')).toHaveText('$180.00');
    await expect(stat(page, 'Cost of Goods Sold')).toHaveText('$130.00');
    await expect(stat(page, 'Operating')).toHaveText('$45.50');
    await expect(stat(page, 'Net profit')).toHaveText('$4.50');
    await expect(stat(page, 'Sales tax')).toHaveText('$14.00');
  });

  test('sales tax by state, estimated cost of units sold and unmatched SKUs', async ({ page }) => {
    await expect(page.locator('#taxStateWrap')).toContainText('TX');
    await expect(page.locator('#taxStateWrap')).toContainText('$8.00');
    await expect(page.locator('#taxStateWrap')).toContainText('CA');
    await expect(page.locator('#taxCogsWrap')).toContainText('$9.00');
    await expect(page.locator('#taxCogsWrap')).toContainText('SYN-X');
  });

  test('expenses missing a receipt are listed', async ({ page }) => {
    const rows = page.locator('#taxReceiptWrap tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('#taxReceiptWrap')).toContainText('Advertising');
    await expect(page.locator('#taxReceiptWrap')).toContainText('Ingredients');
  });

  test('Last Year shows only last year\'s records', async ({ page }) => {
    await page.click('#taxToggle button[data-range="lastyear"]');
    await expect(stat(page, 'Revenue')).toHaveText('$200.00');
    await expect(stat(page, 'Operating')).toHaveText('$12.00');
  });

  test('Export CSV downloads the report with the figures on screen', async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#taxExportBtn')]);
    expect(download.suggestedFilename()).toBe('tax-records-2026-06-15.csv');
    const csv = fs.readFileSync(await download.path(), 'utf8');
    expect(csv).toContain('"Period","This Year"');
    expect(csv).toContain('"Revenue","$180.00"');
    expect(csv).toContain('"Sales tax by state"');
    expect(csv).toContain('"TX","$8.00"');
  });

});

// --------------------------------------------------------------- Inventory
test.describe('Inventory', () => {
  test.beforeEach(async ({ page }) => { await open(page, 'inventoryPanel'); });

  test('shows stock per bucket and flags low stock', async ({ page }) => {
    const a = page.locator('#inventoryWrap [data-product-id="prod-a"]');
    await expect(a).toContainText('Low stock');
    await expect(page.locator('#inventoryWrap [data-product-id="prod-b"]')).not.toContainText('Low stock');
    await expect(page.locator('#inventoryStats')).toContainText('2');
    const lowStat = page.locator('#inventoryStats .stat', { hasText: 'Low-stock' }).locator('.num');
    await expect(lowStat).toHaveText('1');
  });

  test('saving a low-stock threshold sends only that setting', async ({ page, backend }) => {
    const row = page.locator('#inventoryWrap [data-product-id="prod-b"]');
    await row.locator('.invThresholdInput').fill('10');
    await row.locator('.saveThresholdBtn').click();
    await expect.poll(() => writes(backend, 'inventory').length).toBe(1);
    const [w] = writes(backend, 'inventory');
    expect(Object.keys(w.body).sort()).toEqual(['low_stock_threshold', 'product_id', 'updated_at', 'updated_by']);
    expect(w.body.low_stock_threshold).toBe(10);
  });

  test('saving a product sends only the product fields', async ({ page, backend }) => {
    const row = page.locator('#inventoryWrap [data-product-id="prod-b"]');
    await row.locator('.editProductBtn').click();
    await row.locator('.peRetail').fill('21.5');
    await row.locator('.saveProductBtn').click();
    await expect.poll(() => writes(backend, 'products').length).toBe(1);
    const [w] = writes(backend, 'products');
    expect(Object.keys(w.body).sort()).toEqual(['cost', 'name', 'packaging_info', 'retail_price', 'sku', 'status', 'updated_at', 'wholesale_price']);
    expect(w.body.retail_price).toBe(21.5);
    expect(filtersOf(w)).toEqual({ id: 'eq.prod-b' });
  });

  test('an adjustment that would go below zero is refused before anything is sent', async ({ page, backend }) => {
    await page.selectOption('#invProduct', 'prod-a');
    await page.selectOption('#invBucket', 'available');
    await page.fill('#invAmount', '-4');
    await page.click('#adjustInventoryForm button[type=submit]');
    await expect(page.locator('#dashError')).toContainText("isn't allowed");
    expect(writes(backend, 'inventory')).toEqual([]);
  });
});

// ----------------------------------------------------------------- Returns
test.describe('Returns', () => {
  test.beforeEach(async ({ page }) => { await open(page, 'returnsPanel'); });

  test('each status shows only its next steps', async ({ page }) => {
    const row = s => page.locator(`#returnsWrap [data-return-id="ret-${s}"]`);
    await expect(row('requested').locator('button')).toHaveText(['Approve', 'Reject']);
    await expect(row('approved').locator('.markReceivedBtn')).toBeVisible();
    await expect(row('rejected').locator('button')).toHaveText(['Close']);
    await expect(row('received').locator('.markRefundedBtn')).toBeVisible();
  });

  test('Mark Received without choosing what happens to the stock is refused', async ({ page, backend }) => {
    await page.locator('#returnsWrap [data-return-id="ret-approved"] .markReceivedBtn').click();
    await expect(page.locator('#dashError')).toContainText('Pick what happens to the stock');
    expect(backend.tableWrites()).toEqual([]);
  });

  test('a negative refund amount is refused', async ({ page, backend }) => {
    const row = page.locator('#returnsWrap [data-return-id="ret-received"]');
    await row.locator('.refundAmountInput').fill('-3');
    await row.locator('.markRefundedBtn').click();
    await expect(page.locator('#dashError')).toContainText("doesn't look like a valid number");
    expect(backend.tableWrites()).toEqual([]);
  });
});

// ----------------------------------------------------- failed page loads
test('a page whose data fails to load shows an error message', async ({ page, backend }) => {
  await open(page, 'expensesPanel');
  // After the reload the Expenses page loads first (it was the last page
  // open), so its request is the one that fails.
  backend.failNext('expenses', 'GET');
  await page.reload();
  await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('#dashError')).toContainText(/Could not load/);
  await expect(page.locator('#dashError')).toContainText('Synthetic server error');
});

// ----------------------------------------- refusals that change nothing (2026-10-06)
// Row-level security doesn't raise an error for an update/delete it refuses;
// it just changes no rows. The page used to say "done" anyway. Each test
// answers the write with "0 rows changed" and expects an honest message.
test.describe('a write the database quietly refuses is never reported as done', () => {
  const zeroRows = (page, table, method) => page.route(url => new URL(url).pathname.endsWith('/rest/v1/' + table), route =>
    route.request().method() === method
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      : route.fallback());

  test('product edit', async ({ page }) => {
    await open(page, 'inventoryPanel');
    await zeroRows(page, 'products', 'PATCH');
    const row = page.locator('#inventoryWrap [data-product-id="prod-b"]');
    await row.locator('.editProductBtn').click();
    await row.locator('.peRetail').fill('21.5');
    await row.locator('.saveProductBtn').click();
    await expect(page.locator('#dashError')).toContainText("don't have permission");
    await expect(page.locator('.toast', { hasText: 'Product updated' })).toHaveCount(0);
  });

  test('order delete (after the password)', async ({ page }) => {
    await open(page, 'ordersPanel');
    await zeroRows(page, 'orders', 'PATCH');
    await page.locator('#ordersTableWrap tr[data-id="o1"] .deleteOrderBtn').click();
    await confirmPassword(page, OWNER_USER.password);
    await expect(page.locator('#dashError')).toContainText("don't have permission");
    await expect(page.locator('.toast', { hasText: 'recycle bin' })).toHaveCount(0);
  });

  test('expense delete', async ({ page }) => {
    await open(page, 'expensesPanel');
    await zeroRows(page, 'expenses', 'PATCH');
    await page.locator('#expensesWrap .approvalRow[data-id="e3"] .expDeleteBtn').click();
    await expect(page.locator('#dashError')).toContainText("don't have permission");
  });
});
