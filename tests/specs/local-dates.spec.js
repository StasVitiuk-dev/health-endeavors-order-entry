// Dates shown or pre-filled on the dashboard must use the viewer's own
// calendar day, not the UTC day. The browser clock is frozen at 9pm Central on
// June 15, 2026, which is already June 16 in UTC. Display and form defaults
// only; nothing here changes what the page saves. Synthetic data only.

const fs = require('fs');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

const EVENING = new Date('2026-06-16T02:00:00Z'); // 9:00pm, June 15, Chicago

test.beforeEach(async ({ page, backend }) => {
  Object.assign(backend.tables, {
    orders: [],
    expenses: [{ id: 'e1', category: 'ingredients', amount: 100, expense_date: '2026-06-01', vendor: 'SYNTHETIC vendor', receipt_path: null, deleted_at: null }],
    products: [{
      id: 'prod-a', name: 'SYNTHETIC product A', sku: 'SYN-A', is_active: true, status: 'active', cost: 2, retail_price: 10, wholesale_price: 6, packaging_info: null,
      inventory: { product_id: 'prod-a', available: 10 },
      inventory_lots: [{ lot_number: 'SYN-LOT-TOMORROW', quantity_remaining: 5, received_at: '2026-06-01T00:00:00Z', expires_at: '2026-06-16' }],
    }],
  });
  await page.clock.setFixedTime(EVENING);
  await login(page);
});

test('the new-expense date is pre-filled with today (June 15), not tomorrow', async ({ page }) => {
  await gotoPage(page, 'expensesPanel');
  await expect(page.locator('#expDate')).toHaveValue('2026-06-15');
});

test('the new adverse-event date is pre-filled with today (June 15), not tomorrow', async ({ page }) => {
  await gotoPage(page, 'adverseEventsPanel');
  await expect(page.locator('#aeDateReceived')).toHaveValue('2026-06-15');
});

test('a batch that expires tomorrow is not yet shown as expired', async ({ page }) => {
  await gotoPage(page, 'inventoryPanel');
  const badge = page.locator('#inventoryWrap .badge', { hasText: 'SYN-LOT-TOMORROW' });
  await expect(badge).toContainText('exp 2026-06-16');
  await expect(badge).not.toContainText('expired');
});

test('Tax Records: a missing-receipt expense dated June 1 shows as June 1, on screen and in the CSV', async ({ page }) => {
  await gotoPage(page, 'taxRecordsPanel');
  const row = page.locator('#taxReceiptWrap tbody tr', { hasText: 'Ingredients' });
  await expect(row).toContainText('Jun 1, 2026');
  await expect(row).not.toContainText('May 31');
  const [file] = await Promise.all([page.waitForEvent('download'), page.click('#taxExportBtn')]);
  expect(file.suggestedFilename()).toBe('tax-records-2026-06-15.csv');
  const csv = fs.readFileSync(await file.path(), 'utf8');
  expect(csv).toContain('"Jun 1, 2026","Ingredients","SYNTHETIC vendor"');
});
