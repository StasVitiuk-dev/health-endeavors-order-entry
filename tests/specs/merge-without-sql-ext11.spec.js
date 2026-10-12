// EXT11 (missions 64–72): the dashboard code merged into production BEFORE
// any prepared SQL is installed (R1–R5, request keys, nightly check). That is
// the planned first deployment step, so it must be safe on its own: every
// page opens without a script error, nothing claims a feature that is not
// there, every switch refuses to turn on, and the stock buttons keep using
// today's path. Synthetic data only.
const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { preSqlProduction } = require('../helpers/pre-sql');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'page logic; run once'); });

const PANELS = ['attentionPanel', 'dailySummaryPanel', 'reportHistoryPanel', 'calendarPanel', 'ordersPanel', 'inventoryPanel', 'returnsPanel',
  'suppliersPanel', 'purchaseOrdersPanel', 'qualityControlPanel', 'expensesPanel', 'accountingPanel', 'taxRecordsPanel', 'tasksPanel',
  'incidentsPanel', 'evidenceLockerPanel', 'approvalsPanel', 'inquiriesPanel', 'recallsPanel', 'adverseEventsPanel', 'legalHoldsPanel',
  'documentsPanel', 'sopsPanel', 'aiPanel', 'flagsPanel', 'businessRulesPanel', 'continuityPanel', 'sessionsPanel', 'featureRequestsPanel', 'activityPanel'];

const SWITCHES = [
  ['stock_fn_adjust', 'is not installed yet'], ['stock_fn_receive_po', 'is not installed yet'], ['stock_fn_recall', 'is not installed yet'],
  ['stock_fn_return', 'is not installed yet'], ['stock_fn_delete_product', 'is not installed yet'],
  ['request_keys', 'request-key columns (drafts/19) are not installed yet'], ['integrity_results_home', 'nightly check (drafts/25 and drafts/29) is not installed yet'],
];
function addSwitches(backend) {
  backend.tables.feature_flags = (backend.tables.feature_flags || []).filter(f => !SWITCHES.some(([k]) => k === f.flag_key))
    .concat(SWITCHES.map(([k], i) => ({ id: 'ff-pre-' + i, flag_key: k, label: 'SYNTHETIC ' + k, description: 'SYNTHETIC', enabled: false })));
}

test('every page opens without a script error, and nothing claims an uninstalled feature', async ({ page, backend }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await preSqlProduction(page, backend);
  addSwitches(backend);
  await login(page);
  await expect(page.locator('#nightlyCheckWrap .nightlyCard')).toContainText('Not set up yet');
  for (const id of PANELS) {
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
  // System status agrees: nothing installed, and no switch is on without its step.
  await gotoPage(page, 'continuityPanel');
  await expect(page.locator('#systemStatusWrap')).toContainText('R1 receive: not installed');
  await expect(page.locator('#systemStatusWrap')).toContainText('OK: all of these switches are OFF');
});

for (const [key, words] of SWITCHES) {
  test(`switch ${key} refuses to turn on before its SQL, and no password is asked`, async ({ page, backend }) => {
    await preSqlProduction(page, backend);
    addSwitches(backend);
    await login(page);
    await gotoPage(page, 'flagsPanel');
    await page.locator(`.flagRow[data-key="${key}"] .slider`).click();
    await expect(page.locator('#dashError')).toContainText(words);
    await expect(page.locator('#reauthOverlay')).toBeHidden();
    await expect(page.locator(`.flagRow[data-key="${key}"] .flagToggle`)).not.toBeChecked();
    expect(backend.tables.feature_flags.find(f => f.flag_key === key).enabled).toBe(false);
  });
}

test('stock adjustment keeps using today\'s path (no function call) and still works', async ({ page, backend }) => {
  await preSqlProduction(page, backend);
  addSwitches(backend);
  backend.tables.products = [{ id: 'prod-pre', name: 'SYNTHETIC pre-SQL', sku: 'SYN-PRE', is_active: true, status: 'active', cost: 1, retail_price: 2, wholesale_price: 1, packaging_info: null, updated_at: '2026-09-01T00:00:00Z',
    inventory: { product_id: 'prod-pre', available: 5, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null }, inventory_lots: [] }];
  backend.tables.inventory = [backend.tables.products[0].inventory];
  backend.tables.inventory_adjustments = [];
  enableWrites(backend, ['inventory', 'inventory_adjustments']);
  const rpcCalls = [];
  page.on('request', r => { if (r.url().includes('/rest/v1/rpc/') && !/log_customer_data_access/.test(r.url())) rpcCalls.push(r.url()); });
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  await page.selectOption('#invProduct', 'prod-pre');
  await page.selectOption('#invBucket', 'available');
  await page.fill('#invAmount', '3');
  await page.fill('#invReason', 'SYNTHETIC count');
  await page.click('#adjustInventoryForm button[type="submit"]');
  await expect.poll(() => backend.tables.inventory[0].available).toBe(8);
  // the history row is a second request, saved just after the stock number
  await expect.poll(() => backend.tables.inventory_adjustments.map(a => a.change_amount)).toEqual([3]);
  expect(rpcCalls.filter(u => /receive_purchase_order|quarantine_recall|receive_return|adjust_inventory|delete_unused_product/.test(u))).toEqual([]);
});

test('a switch turned ON by mistake while its function is missing: the button refuses and says to turn it off; System status says PROBLEM', async ({ page, backend }) => {
  await preSqlProduction(page, backend);
  addSwitches(backend);
  backend.tables.feature_flags.find(f => f.flag_key === 'stock_fn_adjust').enabled = true; // e.g. switched on directly in the database
  backend.tables.products = [{ id: 'prod-pre', name: 'SYNTHETIC pre-SQL', sku: 'SYN-PRE', is_active: true, status: 'active', cost: 1, retail_price: 2, wholesale_price: 1, packaging_info: null, updated_at: '2026-09-01T00:00:00Z',
    inventory: { product_id: 'prod-pre', available: 5, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null }, inventory_lots: [] }];
  backend.tables.inventory = [backend.tables.products[0].inventory];
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  await page.selectOption('#invProduct', 'prod-pre');
  await page.selectOption('#invBucket', 'available');
  await page.fill('#invAmount', '3');
  await page.click('#adjustInventoryForm button[type="submit"]');
  await expect(page.locator('#dashError')).toContainText(/switch|not installed/i);
  expect(backend.tables.inventory[0].available).toBe(5);
  await gotoPage(page, 'continuityPanel');
  await expect(page.locator('#systemStatusWrap')).toContainText('PROBLEM: switched ON but its database step is missing: R4 adjust');
});

test('the sign-in screen reads no business data before anyone signs in (no reliance on anonymous access)', async ({ page }) => {
  const rest = [];
  page.on('request', r => { if (/\/rest\/v1\//.test(r.url())) rest.push(r.method() + ' ' + new URL(r.url()).pathname); });
  await page.goto('/owner-login.html');
  await expect(page.locator('#loginForm')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  expect(rest).toEqual([]);
});
