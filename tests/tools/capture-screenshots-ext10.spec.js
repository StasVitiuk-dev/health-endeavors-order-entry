// Captures the EXT10 screens into design-review/dashboard-extension-10-2026-10-11/.
// Synthetic data only (the test mock); nothing is fetched from the live site.
//   SHOT_SPEC=capture-screenshots-ext10 npx playwright test -c tests/tools/screenshots.config.js
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { keysOn, uniqueKeys } = require('../helpers/request-keys');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'design-review', 'dashboard-extension-10-2026-10-11');
const shot = (page, name, ti, full = false) => page.screenshot({ path: path.join(OUT, `2026-10-11_ext10_${name}_${ti.project.name.slice(1)}.png`), fullPage: full });
const phoneOnly = ti => test.skip(ti.project.name === 'w1100', 'phone screens');
const deskAnd390 = ti => test.skip(ti.project.name === 'w320', 'two sizes are enough');
async function toTop(page, sel) {
  await page.evaluate(s => { const el = document.querySelector(s); if (el) { el.scrollIntoView({ block: 'start' }); (el.closest('main') || window).scrollBy(0, -90); } }, sel);
  await page.waitForTimeout(300);
}
const H = 3600000;
const iso = ms => new Date(Date.now() - ms).toISOString();
const SECTIONS = ['F01 stuck work', 'F02 stuck work', 'F03 stuck work', 'F04 stuck work', 'F05 stuck work', 'F06 probable duplicate', 'F07 probable duplicate',
  'F08 probable duplicate', 'F09 probable duplicate', 'F10 points at the wrong thing', 'F11 points at the wrong thing', 'F12 impossible value',
  'F13 impossible value', 'F14 impossible value', 'F15 impossible value'];
const NAMES = ['tasks in progress unchanged 14+ days', 'open tasks 7+ days past due', 'approvals pending 7+ days', 'recalls still initiated after 14+ days',
  'purchase orders not received 7+ days after expected', 'order numbers used twice', 'suppliers with the same name', 'products with the same name',
  'expenses that look the same', 'returns on another order\'s line', 'order lines whose SKU matches no product', 'order totals missing or below zero',
  'order totals that do not add up', 'stock buckets below zero', 'refund dates that do not match'];
function nightly(backend, runs, found = {}) {
  backend.tables.feature_flags = (backend.tables.feature_flags || []).filter(f => f.flag_key !== 'integrity_results_home')
    .concat([{ id: 'ff-ih', flag_key: 'integrity_results_home', label: 'Nightly integrity check on Home', description: 'SYNTHETIC', enabled: true }]);
  backend.tables.integrity_check_runs = runs.map((r, i) => ({ id: 100 + i, started_at: iso(r.ago), finished_at: iso(r.ago - 60000), status: r.status, checks: r.status === 'ok' ? 15 : null, error: r.error || null }));
  backend.tables.integrity_check_results = runs.flatMap((r, i) => r.status !== 'ok' ? [] : SECTIONS.map((section, k) => ({
    id: (100 + i) * 100 + k, run_id: 100 + i, run_at: iso(r.ago), section, check_name: NAMES[k], found: (found[section.slice(0, 3)] || [0])[0], examples: (found[section.slice(0, 3)] || [0, null])[1] })));
}
function orders(backend) {
  backend.tables.orders = [0, 1, 2].map(i => ({ id: 'ord-s' + i, order_number: 'SYN-200' + i, total: (64.5 * (i + 1)).toFixed(2), tax_total: '0.00', currency: 'USD',
    status: ['paid', 'paid', 'cancelled'][i], placed_at: iso(i * 26 * H), deleted_at: null, source: 'manual', raw_data: null, customer_name: 'SYNTHETIC Customer ' + (i + 1), created_at: iso(i * 26 * H) }));
}

test('phone: tasks as cards', async ({ page }, ti) => {
  phoneOnly(ti);
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await toTop(page, '#tasksTableWrap');
  await shot(page, '01-phone-tasks-cards', ti);
});

test('phone: orders as cards', async ({ page, backend }, ti) => {
  phoneOnly(ti);
  orders(backend);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await toTop(page, '#ordersTableWrap');
  await shot(page, '02-phone-orders-cards', ti);
});

test('phone: purchase order lines with the lot box inside the card', async ({ page, backend }, ti) => {
  phoneOnly(ti);
  const items = [{ id: 'poi-s', purchase_order_id: 'po-s', product_id: 'prod-s', description: 'SYNTHETIC lavender oil, 500 ml', sku: 'SYN-LAV-500', quantity: 40, unit_cost: 3, quantity_received: 0, landed_unit_cost: null }];
  backend.tables.products = [{ id: 'prod-s', name: 'SYNTHETIC Lavender', sku: 'SYN-LAV-500', is_active: true, status: 'active', cost: 3, retail_price: 20, wholesale_price: 12, packaging_info: null, updated_at: '2026-09-01T00:00:00Z',
    inventory: { available: 1, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: 5 }, inventory_lots: [] }];
  backend.tables.purchase_order_items = items;
  backend.tables.purchase_orders = [{ id: 'po-s', po_number: 'PO-SYN-7', supplier_id: null, status: 'shipped', currency: 'USD', shipping_cost: 10, tax: 2, expense_category: 'ingredients',
    ordered_at: '2026-09-20T00:00:00Z', expected_at: '2026-10-01', received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-20T00:00:00Z', deleted_at: null,
    suppliers: { name: 'SYNTHETIC Botanicals' }, purchase_order_items: items }];
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.locator('.poItem[data-id="po-s"] .poRow').click();
  const o = page.locator('#inspectorOverlay');
  if (await o.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  await toTop(page, '#poDetail_po-s table');
  await shot(page, '03-phone-po-lines-cards', ti);
});

test('home: nightly check not set up (today, before install)', async ({ page }, ti) => {
  deskAnd390(ti);
  await login(page);
  await expect(page.locator('#nightlyCheckWrap .nightlyCard')).toBeVisible();
  await toTop(page, '#nightlyCheckWrap');
  await shot(page, '04-home-nightly-not-set-up', ti);
});

test('home: nightly check passed', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  nightly(backend, [{ ago: 5 * H, status: 'ok' }]);
  await login(page);
  await expect(page.locator('#nightlyCheckWrap .nightlyCard[data-state="PASS"]')).toBeVisible();
  await toTop(page, '#nightlyCheckWrap');
  await shot(page, '05-home-nightly-pass', ti);
});

test('home: nightly check found something (drill-down open)', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  nightly(backend, [{ ago: 5 * H, status: 'ok' }], { F02: [3, '4f1c2a9e, 7b20d1c3, 9e8a6f01'], F07: [1, 'synthetic botanicals'] });
  await login(page);
  await expect(page.locator('#nightlyCheckWrap .nightlyCard[data-state="WARN"]')).toBeVisible();
  await toTop(page, '#nightlyCheckWrap');
  await shot(page, '06-home-nightly-warn-drilldown', ti);
});

test('home: last night\'s run failed', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  nightly(backend, [{ ago: 4 * H, status: 'failed', error: 'canceling statement due to statement timeout' }, { ago: 28 * H, status: 'ok' }], { F14: [1, 'SYN-LAV-500'] });
  await login(page);
  await expect(page.locator('#nightlyCheckWrap .nightlyCard[data-state="FAIL"]')).toBeVisible();
  await toTop(page, '#nightlyCheckWrap');
  await shot(page, '07-home-nightly-run-failed', ti);
});

test('home: nightly check out of date', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  nightly(backend, [{ ago: 40 * H, status: 'ok' }]);
  await login(page);
  await expect(page.locator('#nightlyCheckWrap .nightlyCard[data-state="STALE"]')).toBeVisible();
  await toTop(page, '#nightlyCheckWrap');
  await shot(page, '08-home-nightly-stale', ti);
});

test('request keys on: lost reply says pressing again is safe', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  enableWrites(backend, ['manual_attention_items']);
  keysOn(backend);
  await uniqueKeys(page.context(), ['manual_attention_items'], undefined, backend);
  await login(page);
  backend.dropNext('manual_attention_items', 'POST', { applied: true });
  await page.fill('#reminderTitle', 'SYNTHETIC call the label printer');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#dashError')).toContainText('Pressing the button again is safe');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '09-request-key-safe-to-retry', ti);
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('.toast', { hasText: 'already saved' })).toBeVisible();
  await shot(page, '10-request-key-already-saved', ti);
});

test('feature switches: nightly Home switch refused before install', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  backend.tables.feature_flags = (backend.tables.feature_flags || []).concat([{ id: 'ff-ih', flag_key: 'integrity_results_home', label: 'Nightly integrity check on Home', description: 'SYNTHETIC: shows the nightly check on Home', enabled: false }]);
  await page.context().route(/\/rest\/v1\/integrity_check_runs/, r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.integrity_check_runs'" }) }));
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await page.locator('.flagRow[data-key="integrity_results_home"] .slider').click();
  await expect(page.locator('#dashError')).toContainText('not installed yet');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '11-switch-nightly-refused', ti);
});

test('change-password page under the strict policy', async ({ page }, ti) => {
  deskAnd390(ti);
  await page.goto('/change-password.html');
  await expect(page.locator('#loginStep')).toBeVisible();
  await shot(page, '12-change-password', ti);
});

// ---- second EXT10 mission ----
const { seedBusiness } = require('../fixtures/business-data');

test('home: checks with "Next step" and the new checks', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  seedBusiness(backend);
  await login(page);
  await expect(page.locator('#attnChecksWrap .attnAction').first()).toBeVisible();
  await toTop(page, '#attnChecksWrap');
  await shot(page, '13-home-checks-next-step', ti);
});

test('purchase order: receipt status unknown after a lost reply, with the read-only check', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  test.setTimeout(90000);
  const items = [{ id: 'poi-u', purchase_order_id: 'po-u', product_id: 'prod-u', description: 'SYNTHETIC lavender oil, 500 ml', sku: 'SYN-LAV-500', quantity: 40, unit_cost: 3, quantity_received: 0, landed_unit_cost: null }];
  Object.assign(backend.tables, {
    products: [{ id: 'prod-u', name: 'SYNTHETIC Lavender', sku: 'SYN-LAV-500' }], inventory: [{ product_id: 'prod-u', available: 1 }],
    inventory_adjustments: [], inventory_lots: [], expenses: [], purchase_order_items: items,
    purchase_orders: [{ id: 'po-u', po_number: 'PO-SYN-8', status: 'shipped', currency: 'USD', shipping_cost: 10, tax: 2, expense_category: 'ingredients',
      ordered_at: '2026-09-20T00:00:00Z', expected_at: '2026-10-01', received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-20T00:00:00Z',
      suppliers: { name: 'SYNTHETIC Botanicals' }, purchase_order_items: items }],
  });
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.locator('.poItem[data-id="po-u"] .poRow').click();
  const o = page.locator('#inspectorOverlay');
  if (await o.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  await page.locator('.poLineLot').first().fill('SYN-LOT-1');
  // the claim's reply is lost, and so is every read-back
  await page.route(/\/rest\/v1\/purchase_orders/, r => (r.request().method() === 'PATCH' || /select=status(%2C|,)received_at/.test(r.request().url())) ? r.abort('connectionreset') : r.fallback());
  await page.locator('.poReceiveBtn').click();
  await page.locator('.poReceiveBtn').click();
  await expect(page.locator('.poReceiptUnknown')).toBeVisible({ timeout: 60000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '14-po-receipt-unknown', ti);
});

test('continuity: System status card', async ({ page }, ti) => {
  deskAnd390(ti);
  await login(page);
  await gotoPage(page, 'continuityPanel');
  await expect(page.locator('#systemStatusWrap tr').first()).toBeVisible();
  await toTop(page, '#systemStatusWrap');
  await shot(page, '15-system-status', ti);
});

test('feature switches: ON/OFF and what each needs first', async ({ page, backend }, ti) => {
  deskAnd390(ti);
  backend.tables.feature_flags = (backend.tables.feature_flags || []).concat([
    { id: 'ff-ih', flag_key: 'integrity_results_home', label: 'Nightly integrity check on Home', description: 'SYNTHETIC: shows the nightly check on Home', enabled: false },
    { id: 'ff-rk', flag_key: 'request_keys', label: 'Request keys', description: 'SYNTHETIC: duplicate-proof creates', enabled: false }]);
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await expect(page.locator('.flagDepends').first()).toBeVisible();
  await toTop(page, '.flagRow[data-key="request_keys"]');
  await shot(page, '16-switch-dependencies', ti);
});
