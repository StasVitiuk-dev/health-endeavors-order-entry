// Captures the EXT7 screens into design-review/dashboard-extension-7-2026-10-07/.
// Synthetic data only. See screenshots.config.js.
const path = require('path');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const OUT = path.join(__dirname, '..', '..', 'design-review', 'dashboard-extension-7-2026-10-07');
const shot = (page, name, testInfo) => page.screenshot({ path: path.join(OUT, `${name}-${testInfo.project.name.slice(1)}.png`), fullPage: false });

async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  await page.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'start' }), id);
  await page.waitForTimeout(300);
}

test('home: Business Health tiles', async ({ page }, testInfo) => {
  await login(page);
  await page.waitForLoadState('networkidle');
  await page.locator('#businessHealthStats').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await shot(page, '01-home-business-health', testInfo);
});

test('home: one figure could not be read ("?")', async ({ page }, testInfo) => {
  await page.context().route(/\/rest\/v1\/tasks\?.*select=id%2Cstatus%2Cdue_at|\/rest\/v1\/tasks\?.*select=id,status,due_at/, r =>
    r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"synthetic failure"}' }));
  await login(page);
  await page.waitForLoadState('networkidle');
  await page.locator('#businessHealthStats').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await shot(page, '02-home-unknown-tile', testInfo);
});

test('tasks with Recently finished open', async ({ page, backend }, testInfo) => {
  backend.tables.tasks.find(t => t.id === 'task-done-1').updated_at = '2026-10-06T15:30:00Z';
  await login(page);
  await open(page, 'tasksPanel');
  await page.click('#recentDoneTasks summary');
  await page.locator('#recentDoneTasks').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, '03-tasks-recently-finished', testInfo);
});

test('business continuity with an unknown status', async ({ page, backend }, testInfo) => {
  backend.tables.service_status = [
    { id: 'svc-1', service_name: 'SYNTHETIC Email', category: 'comms', status: 'operational', notes: null, updated_at: '2026-10-01T10:00:00Z' },
    { id: 'svc-2', service_name: 'SYNTHETIC Printer', category: 'office', status: 'maintenance', notes: null, updated_at: '2026-10-01T10:00:00Z' },
    { id: 'svc-3', service_name: 'SYNTHETIC Phone', category: 'comms', status: null, notes: null, updated_at: '2026-10-01T10:00:00Z' },
  ];
  await login(page);
  await open(page, 'continuityPanel');
  await shot(page, '04-continuity-unknown', testInfo);
});

test('approval queue', async ({ page }, testInfo) => {
  await login(page);
  await open(page, 'approvalsPanel');
  await shot(page, '05-approvals', testInfo);
});

test('tax records by state', async ({ page, backend }, testInfo) => {
  const when = '2026-03-01T12:00:00Z';
  backend.tables.orders = [
    ['CA', { province: 'California', province_code: 'CA', country_code: 'US' }, 120, 9.9], ['CA2', { province: ' california ' }, 80, 6.6],
    ['NY', { province: 'new  york' }, 50, 4.43], ['ON', { province: 'Ontario', province_code: 'ON', country_code: 'CA' }, 40, 5.2],
  ].map(([id, addr, total, tax]) => ({ id: 'ord-shot-' + id, order_number: 'SHOT-' + id, total, tax_total: tax, currency: 'USD', status: 'paid', placed_at: when, deleted_at: null,
    source: 'shopify', raw_data: { shipping_address: addr }, customer_name: 'SYNTHETIC', created_at: when }));
  await login(page);
  await open(page, 'taxRecordsPanel');
  await page.click('#taxRecordsPanel button[data-range="all"]');
  await page.waitForLoadState('networkidle');
  await page.locator('#taxStateWrap').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await shot(page, '06-tax-by-state', testInfo);
});

test('suppliers: same-name question', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'w1100', 'dialog shown once');
  await login(page);
  await open(page, 'suppliersPanel');
  await expect(page.locator('#addSupplierForm')).toBeVisible();
  await page.locator('#addSupplierForm').scrollIntoViewIfNeeded();
  await shot(page, '07-suppliers-form', testInfo);
});
