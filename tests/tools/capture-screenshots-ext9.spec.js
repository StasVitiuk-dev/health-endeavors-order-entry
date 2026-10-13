// Captures the EXT9 screens into design-review/dashboard-extension-9-2026-10-10/.
// Synthetic data only (the test mock + the R1–R5 stand-in); nothing is
// fetched from the live site.
//   SHOT_SPEC=capture-screenshots-ext9 npx playwright test -c tests/tools/screenshots.config.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { installStockFunctions, functionMissing } = require('../helpers/stock-functions-mock');
const { enableWrites } = require('../helpers/stateful-backend');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'design-review', 'dashboard-extension-9-2026-10-10');
const shot = (page, name, ti) => page.screenshot({ path: path.join(OUT, `2026-10-10_ext9_${name}_${ti.project.name.slice(1)}.png`), fullPage: false });

async function closeInspector(page) {
  const o = page.locator('#inspectorOverlay');
  if (await o.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}
async function toTop(page, sel) {
  await page.evaluate(s => { const el = document.querySelector(s); if (el) { el.scrollIntoView({ block: 'start' }); (el.closest('main') || window).scrollBy(0, -110); } }, sel);
  await page.waitForTimeout(300);
}
const flags = (backend, rows) => { backend.tables.feature_flags = (backend.tables.feature_flags || []).filter(f => !rows.some(r => r.flag_key === f.flag_key)).concat(rows); };
const stockSwitches = on => ['stock_fn_receive_po', 'stock_fn_recall', 'stock_fn_return', 'stock_fn_adjust', 'stock_fn_delete_product'].map((k, i) => ({ id: 'ff-s' + i, flag_key: k, label: 'Stock: all-or-nothing ' + ['receive', 'recall', 'return', 'adjustment', 'delete'][i], description: 'SYNTHETIC: uses the database function when on', enabled: !!on[k] }));

function seedPo(backend) {
  const items = [{ id: 'poi-a', purchase_order_id: 'po-shot', product_id: 'prod-shot', description: 'SYNTHETIC lavender oil', sku: 'SYN-LAV', quantity: 40, unit_cost: 3, quantity_received: 0, landed_unit_cost: null }];
  backend.tables.products = [{ id: 'prod-shot', name: 'SYNTHETIC Lavender Lotion', sku: 'SYN-LAV', is_active: true, status: 'active', cost: 3, retail_price: 20, wholesale_price: 12, packaging_info: null, updated_at: '2026-09-01T00:00:00Z',
    inventory: { available: 12, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: 5 }, inventory_lots: [] }];
  backend.tables.inventory = [{ id: 'inv-shot', product_id: 'prod-shot', available: 12, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: 5 }];
  backend.tables.purchase_order_items = items;
  backend.tables.purchase_orders = [{ id: 'po-shot', po_number: 'PO-SHOT-1', supplier_id: null, status: 'shipped', currency: 'USD', shipping_cost: 10, tax: 2, expense_category: 'ingredients',
    ordered_at: '2026-09-20T00:00:00Z', expected_at: '2026-10-01', received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-20T00:00:00Z', deleted_at: null,
    suppliers: { name: 'SYNTHETIC Botanicals' }, purchase_order_items: items }];
  backend.tables.expenses = backend.tables.expenses || [];
  backend.tables.inventory_adjustments = []; backend.tables.inventory_lots = [];
}
async function openPo(page) {
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.locator('.poItem[data-id="po-shot"] .poRow').click();
  await closeInspector(page);
  await expect(page.locator('.poReceiveBtn')).toBeVisible();
}

test('home: checks with their time', async ({ page }, ti) => {
  await login(page);
  await expect(page.locator('#attnChecksWrap .attnFresh')).toBeVisible();
  await toTop(page, '#attnChecksWrap .attnFresh');
  await shot(page, '01-home-checks-checked-at', ti);
});

test('home: checks from a while ago say so', async ({ page }, ti) => {
  await page.clock.install();
  await login(page);
  await expect(page.locator('#attnChecksWrap .attnFresh')).toBeVisible();
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }));
  await page.clock.fastForward('25:00');
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }));
  await page.locator('#attnChecksWrap .attnCheck[data-key="overdueTasks"]').getByRole('button', { name: 'Hide until it changes' }).click();
  await expect(page.locator('#attnChecksWrap .attnStale')).toBeVisible();
  await toTop(page, '#attnChecksWrap .attnStale');
  await shot(page, '02-home-checks-stale', ti);
});

test('feature switches: the five stock switches, off', async ({ page, backend }, ti) => {
  flags(backend, stockSwitches({}));
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await toTop(page, '.flagRow[data-key="stock_fn_receive_po"]');
  await shot(page, '03-switches-stock-off', ti);
});

test('feature switches: refused while the function is not installed', async ({ page, backend }, ti) => {
  flags(backend, stockSwitches({}));
  installStockFunctions(backend);
  backend.rpc.receive_purchase_order = functionMissing();
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await page.locator('.flagRow[data-key="stock_fn_receive_po"] .slider').click();
  await expect(page.locator('#dashError')).toContainText('not installed yet');
  await shot(page, '04-switch-refused-not-installed', ti);
});

test('purchase order: received in one database step (switch on)', async ({ page, backend }, ti) => {
  seedPo(backend); installStockFunctions(backend); flags(backend, stockSwitches({ stock_fn_receive_po: true }));
  await login(page);
  await openPo(page);
  await page.locator('.poReceiveBtn').click(); await page.locator('.poReceiveBtn').click();
  await expect(page.locator('.toast', { hasText: 'Received —' })).toBeVisible();
  await shot(page, '05-po-received-all-or-nothing', ti);
});

test('purchase order: function switched on but not installed', async ({ page, backend }, ti) => {
  seedPo(backend); installStockFunctions(backend); backend.rpc.receive_purchase_order = functionMissing();
  flags(backend, stockSwitches({ stock_fn_receive_po: true }));
  await login(page);
  await openPo(page);
  await page.locator('.poReceiveBtn').click(); await page.locator('.poReceiveBtn').click();
  await expect(page.locator('#dashError')).toContainText('not installed');
  await shot(page, '06-po-function-missing', ti);
});

test('inventory: adjustment refused because the stock changed meanwhile', async ({ page, backend }, ti) => {
  seedPo(backend); installStockFunctions(backend); flags(backend, stockSwitches({ stock_fn_adjust: true }));
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  backend.tables.inventory[0].available = 30;
  await page.selectOption('#invProduct', 'prod-shot');
  await page.selectOption('#invBucket', 'available');
  await page.fill('#invAmount', '-5');
  await page.click('#adjustInventoryForm button[type=submit]');
  await expect(page.locator('#dashError')).toContainText('changed since the page loaded');
  await shot(page, '07-adjust-stale-refused', ti);
});

test('expenses: older ones reachable with Show more', async ({ page, backend }, ti) => {
  backend.tables.expenses = Array.from({ length: 230 }, (_, i) => ({ id: 'ex-' + i, category: 'packaging', amount: 2 + i % 7, expense_date: '2026-0' + (1 + i % 9) + '-15', vendor: 'SYNTHETIC Vendor ' + i, note: null, receipt_path: null, deleted_at: null, created_at: '2026-01-01T00:00:00Z' }));
  await login(page);
  await gotoPage(page, 'expensesPanel');
  await page.locator('#expensesWrap .listMore').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, '08-expenses-show-more', ti);
});

test('request keys: a repeated expense is reported as already saved', async ({ page, backend }, ti) => {
  enableWrites(backend, ['expenses']); backend.tables.expenses = [];
  flags(backend, [{ id: 'ff-rk', flag_key: 'request_keys', label: 'Request keys on new records', description: 'SYNTHETIC', enabled: true }]);
  const seen = new Set();
  await page.context().route(/\/rest\/v1\/expenses(\?|$)/, async r => {
    if (r.request().method() !== 'POST') return r.fallback();
    const k = JSON.parse(r.request().postData() || '{}').client_request_id;
    if (k && seen.has(k)) return r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "expenses_client_request_id_key"' }) });
    if (k) seen.add(k); return r.fallback();
  });
  await login(page);
  await gotoPage(page, 'expensesPanel');
  backend.dropNext('expenses', 'POST', { applied: true });
  await page.selectOption('#expCategory', 'packaging'); await page.fill('#expAmount', '12.50');
  await page.click('#addExpenseForm button[type=submit]');
  await expect(page.locator('#dashError')).toBeVisible();
  await page.click('#addExpenseForm button[type=submit]');
  await expect(page.locator('.toast', { hasText: 'already saved' })).toBeVisible();
  await shot(page, '09-request-key-already-saved', ti);
});

test('staging copy: Home with the banner (EXT9 build)', async ({ page }, ti) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'he-stg9-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tests', 'tools', 'staging', 'build-staging.js'), dir]);
    const umd = path.join(ROOT, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
    await page.context().unrouteAll({ behavior: 'ignoreErrors' });
    await page.context().route('**/*', r => {
      const u = new URL(r.request().url());
      if (u.host === 'staging-review.test') {
        const f = path.join(dir, u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
        if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
        return r.fulfill({ status: 200, contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)], body: fs.readFileSync(f) });
      }
      if (u.host === 'cdn.jsdelivr.net') return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(umd) });
      return r.abort();
    });
    await page.goto('http://staging-review.test/');
    await page.click('#stagingSignIn');
    await expect(page.locator('#attnChecksWrap .attnCheck').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    await shot(page, '10-staging-home', ti);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
