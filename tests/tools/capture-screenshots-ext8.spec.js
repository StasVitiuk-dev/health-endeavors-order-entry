// Captures the EXT8 screens into design-review/dashboard-extension-8-2026-10-10/.
// Synthetic data only (the test mock); nothing is fetched from the live site.
//   SHOT_SPEC=capture-screenshots-ext8 npx playwright test -c tests/tools/screenshots.config.js
// File names carry date, round, page and width, so older evidence is never
// overwritten.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect, login, gotoPage, openMenuIfMobile } = require('../helpers/dashboard');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'design-review', 'dashboard-extension-8-2026-10-10');
const shot = (page, name, ti) => page.screenshot({ path: path.join(OUT, `2026-10-10_ext8_${name}_${ti.project.name.slice(1)}.png`), fullPage: false });
const AT = i => new Date(Date.UTC(2025, 0, 1) + i * 3600e3).toISOString();

async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  await page.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'start' }), id);
  await page.waitForTimeout(300);
}
async function checks(page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#attnChecksWrap .attnCheck').first()).toBeVisible();
  await page.evaluate(() => { const el = document.getElementById('attnChecksWrap'); el.scrollIntoView({ block: 'start' }); const sc = el.closest('main, .content, #mainContent') || window; sc.scrollBy(0, -130); });
  await page.waitForTimeout(400);
}

test('home: Checks card', async ({ page }, ti) => {
  await login(page);
  await checks(page);
  await shot(page, '01-home-checks', ti);
});

test('home: one check could not read, its reason open', async ({ page }, ti) => {
  await page.context().route(/\/rest\/v1\/approval_requests\?.*status=not\.in/, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"synthetic"}' }));
  await login(page);
  await checks(page);
  const row = page.locator('#attnChecksWrap .attnCheck[data-key="pendingApprovals"]');
  await expect(row).toContainText('Could not check');
  await row.locator('summary').click();
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, '02-home-check-unknown', ti);
});

test('home: a data problem (red, cannot be hidden)', async ({ page, backend }, ti) => {
  backend.tables.purchase_orders = [{ id: 'po-r', po_number: 'PO-R', status: 'received', supplier_id: null, currency: 'USD', shipping_cost: 0, tax: 0, payment_status: 'unpaid',
    created_at: '2026-09-01T00:00:00Z', deleted_at: null, purchase_order_items: [{ id: 'l1', product_id: 'p1', quantity: 5, quantity_received: 2 }] }];
  await login(page);
  await checks(page);
  await expect(page.locator('#attnChecksWrap .attnCheck[data-key="receivedNotStocked"]')).toContainText('Data problem');
  await shot(page, '03-home-check-data-problem', ti);
});

test('search: look up an older order in all orders', async ({ page, backend }, ti) => {
  backend.tables.orders = [
    { id: 'ord-old', order_number: 'HE-OLD-7', customer_name: 'SYNTHETIC Willow Shop', status: 'paid', total: 42.5, currency: 'USD', placed_at: AT(0), deleted_at: null, created_at: AT(0) },
    ...Array.from({ length: 320 }, (_, i) => ({ id: 'ord-n' + i, order_number: 'HE-N' + i, customer_name: 'SYNTHETIC', status: 'paid', total: 1, currency: 'USD', placed_at: AT(1000 + i), deleted_at: null, created_at: AT(1000 + i) })),
  ];
  await login(page);
  await openMenuIfMobile(page);
  await page.fill('#sidebarSearch', 'willow');
  await page.click('#orderLookupBtn');
  await expect(page.locator('#orderLookupResults')).toContainText('HE-OLD-7');
  await page.waitForTimeout(300);
  await shot(page, '04-search-all-orders', ti);
});

test('returns: find an older order by number', async ({ page, backend }, ti) => {
  backend.tables.orders = [
    { id: 'ord-old', order_number: 'HE-OLD-7', customer_name: 'SYNTHETIC Willow Shop', status: 'paid', total: 42.5, currency: 'USD', placed_at: AT(0), deleted_at: null, created_at: AT(0) },
    ...Array.from({ length: 210 }, (_, i) => ({ id: 'ord-n' + i, order_number: 'HE-N' + i, customer_name: 'SYNTHETIC', status: 'paid', total: 1, currency: 'USD', placed_at: AT(1000 + i), deleted_at: null, created_at: AT(1000 + i) })),
  ];
  await login(page);
  await open(page, 'returnsPanel');
  await page.fill('#retOrderFind', 'old-7');
  await page.click('#retOrderFindBtn');
  await expect(page.locator('#retOrderHint')).not.toBeEmpty();
  await page.locator('#retOrderFind').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, '05-returns-older-order', ti);
});

test('orders: recycle bin says how many and offers Show more', async ({ page, backend }, ti) => {
  backend.tables.orders = Array.from({ length: 60 }, (_, i) => ({ id: 'ord-del-' + i, order_number: 'HE-D' + i, customer_name: 'SYNTHETIC', customer_email: null,
    status: 'paid', total: 1, currency: 'USD', placed_at: AT(i), deleted_at: AT(100 + i), created_at: AT(i) }));
  await login(page);
  await open(page, 'ordersPanel');
  const more = page.locator('#deletedOrdersWrap .listMore');
  await expect(more).toContainText('Showing the 50 most recent of 60');
  await more.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, '06-orders-bin-show-more', ti);
});

test('accounting: Last 7 days', async ({ page }, ti) => {
  await login(page);
  await open(page, 'accountingPanel');
  await page.click('#accountingPanel button[data-range="week"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot(page, '07-accounting-last-7-days', ti);
});

for (const [n, id, label] of [
  ['08', 'tasksPanel', 'tasks'], ['09', 'approvalsPanel', 'approvals'], ['10', 'incidentsPanel', 'incidents'], ['11', 'inventoryPanel', 'inventory'],
  ['12', 'purchaseOrdersPanel', 'purchase-orders'], ['13', 'taxRecordsPanel', 'tax-records'], ['14', 'aiPanel', 'agents'], ['15', 'flagsPanel', 'settings-flags'],
  ['16', 'inquiriesPanel', 'customer-questions'],
]) {
  test(`page: ${label}`, async ({ page }, ti) => {
    await login(page);
    await open(page, id);
    await page.waitForTimeout(600);
    await shot(page, `${n}-${label}`, ti);
  });
}

test('empty database: Home checks stay honest', async ({ page, backend }, ti) => {
  for (const t of Object.keys(backend.tables)) if (Array.isArray(backend.tables[t]) && !['profiles', 'user_roles'].includes(t)) backend.tables[t] = [];
  await login(page);
  await checks(page);
  await shot(page, '17-home-empty-database', ti);
});

test('staging review copy: banner, read-only sign-in, Home', async ({ page }, ti) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'he-stg-shot-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tests', 'tools', 'staging', 'build-staging.js'), dir]);
    const umd = path.join(ROOT, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
    await page.context().unrouteAll({ behavior: 'ignoreErrors' });
    await page.context().route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.host === 'staging-review.test') {
        const f = path.join(dir, u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
        if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
        const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)];
        return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(f) });
      }
      if (u.host === 'cdn.jsdelivr.net') return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(umd) });
      return route.abort();
    });
    await page.goto('http://staging-review.test/');
    await expect(page.locator('#stagingBanner')).toBeVisible();
    await shot(page, '18-staging-sign-in', ti);
    await page.click('#stagingSignIn');
    await expect(page.locator('#attnChecksWrap .attnCheck').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await shot(page, '19-staging-home', ti);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
