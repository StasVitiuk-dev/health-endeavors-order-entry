// Fixes from the second-pass audit (docs/ops/SECOND_PASS_AUDIT_2026-10-06.md).
// Each test fails on the code before the fix.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'data logic; run once'); });

const writes = (backend, table) => backend.requests.filter(r => r.table === table && ['POST', 'PATCH', 'DELETE'].includes(r.method));

// X3-03 ---------------------------------------------------------------------
test('Expenses: count and money total include every expense, not just the 200 listed', async ({ page, backend }) => {
  seedBusiness(backend);
  backend.tables.expenses = Array.from({ length: 250 }, (_, i) => ({
    id: 'ex-' + String(i).padStart(3, '0'), category: 'packaging', amount: 2, expense_date: '2026-05-01',
    vendor: null, note: null, receipt_path: null, deleted_at: null,
  })).concat([{ id: 'ex-del', category: 'packaging', amount: 999, expense_date: '2026-05-01', vendor: null, note: null, receipt_path: null, deleted_at: '2026-05-02T00:00:00Z' }]);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'expensesPanel');
  await expect(page.locator('#expenseStats .stat').nth(0).locator('.num')).toHaveText('250');
  await expect(page.locator('#expenseStats .stat').nth(1).locator('.num')).toHaveText('$500.00'); // deleted 999 excluded
  await expect(page.locator('#expenseStats .expensesCutNote')).toContainText('newest 200 of 250');
  await expect(page.locator('#expensesWrap .approvalRow')).toHaveCount(200);
});

test('Expenses: with fewer than 200 there is no "newest of" note', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'expensesPanel');
  await expect(page.locator('#expenseStats .stat').first()).toBeVisible();
  await expect(page.locator('#expenseStats .expensesCutNote')).toHaveCount(0);
});

// X3-04 ---------------------------------------------------------------------
test('Returns: an old open return is still listed and counted behind 210 newer closed ones', async ({ page, backend }) => {
  seedBusiness(backend);
  const base = { order_id: 'o1', order_item_id: 'oi1', reason: 'damaged', product_condition: 'resalable', refund_amount: null, approved_at: null,
    received_at: null, notes: null, orders: { order_number: 'SYN-1001', customer_name: 'SYNTHETIC Customer One' },
    order_items: { product_name: 'SYNTHETIC product A', sku: 'SYN-A', quantity: 1 } };
  backend.tables.returns = [
    { ...base, id: 'ret-old-open', status: 'requested', disposition: null, refunded_at: null, created_at: '2026-01-01T00:00:00Z' },
    ...Array.from({ length: 210 }, (_, i) => ({ ...base, id: 'ret-c' + i, status: 'closed', disposition: 'discard',
      refunded_at: i < 5 ? '2026-06-01T00:00:00Z' : null, created_at: new Date(Date.UTC(2026, 5, 1) + i * 60000).toISOString() })),
  ];
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'returnsPanel');
  await expect(page.locator('#returnsWrap [data-return-id="ret-old-open"]')).toBeVisible();
  const nums = page.locator('#returnsStats .stat .num');
  await expect(nums.nth(0)).toHaveText('211'); // total
  await expect(nums.nth(1)).toHaveText('1');   // open
  await expect(nums.nth(2)).toHaveText('5');   // refunded (exact count)
  await expect(page.locator('#returnsWrap .returnsCutNote')).toContainText('newest 200 of 210');
});

// X3-05 ---------------------------------------------------------------------
test('Business Rules: a blank value is refused, not saved as 0', async ({ page, backend }) => {
  backend.tables.business_rules = [{ id: 'br-1', rule_key: 'refund_review_threshold_usd', label: 'SYNTHETIC Refund review', description: 'SYNTHETIC', config: { amount: 100 }, is_active: true }];
  await login(page);
  await gotoPage(page, 'businessRulesPanel');
  const row = page.locator('#businessRulesWrap .flagRow[data-id="br-1"]');
  await row.locator('.ruleValueInput').fill('');
  await row.locator('.ruleSaveBtn').click();
  await expect(page.locator('#dashError')).toContainText('is empty');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
  expect(writes(backend, 'business_rules')).toEqual([]);
});

// X3-06 ---------------------------------------------------------------------
// The browser's own form check (step="1") already blocks 2.7 on this form;
// the page's check is a second line of defence. Either way nothing is sent.
test('Inventory: an adjustment of 2.7 units is never applied (not cut to 2)', async ({ page, backend }) => {
  seedBusiness(backend);
  enableWrites(backend, ['inventory', 'inventory_adjustments']);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  await page.selectOption('#invProduct', 'prod-b');
  await page.selectOption('#invBucket', 'available');
  await page.fill('#invAmount', '2.7');
  await page.click('#adjustInventoryForm button[type=submit]');
  expect(await page.locator('#invAmount').evaluate(el => el.validity.stepMismatch)).toBe(true);
  // and the page's own check, if the browser check were bypassed (e.g. novalidate)
  await page.locator('#adjustInventoryForm').evaluate(f => { f.noValidate = true; });
  await page.click('#adjustInventoryForm button[type=submit]');
  await expect(page.locator('#dashError')).toContainText('whole number');
  expect(writes(backend, 'inventory')).toEqual([]);
  expect(writes(backend, 'inventory_adjustments')).toEqual([]);
});

test('Purchase orders: negative shipping is refused before anything is sent', async ({ page, backend }) => {
  const items = [];
  Object.assign(backend.tables, {
    suppliers: [{ id: 'sup-1', name: 'SYNTHETIC Supplier', supplier_type: 'manufacturer', contact_name: null, email: null, phone: null, notes: null, is_active: true }],
    products: [], purchase_order_items: items, inventory_lots: [],
    purchase_orders: [{ id: 'po-d', po_number: 'PO-D', supplier_id: 'sup-1', status: 'draft', currency: 'USD', shipping_cost: 0, tax: 0, expense_category: 'packaging',
      ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z', deleted_at: null,
      suppliers: { name: 'SYNTHETIC Supplier' }, purchase_order_items: items }],
  });
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.locator('.poItem[data-id="po-d"] .poRow').click();
  if (await page.locator('#inspectorOverlay').evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  const box = page.locator('#poDetail_po-d');
  await box.locator('.poShipping').fill('-15');
  await box.locator('.poSaveTotals').click();
  await expect(page.locator('#dashError')).toContainText('Shipping cannot be less than 0');
  expect(writes(backend, 'purchase_orders')).toEqual([]);
});

test('Product edit: a negative price is refused before anything is sent', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  const row = page.locator('#inventoryWrap [data-product-id="prod-b"]');
  await row.locator('.editProductBtn').click();
  await row.locator('.peRetail').fill('-1');
  await row.locator('.saveProductBtn').click();
  await expect(page.locator('#dashError')).toContainText('Retail price cannot be less than 0');
  expect(writes(backend, 'products')).toEqual([]);
});
