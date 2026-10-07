// EXT8 (workstream L): a slow, older reply must never overwrite a newer
// one. Switching Accounting / Tax Records periods quickly used to let the
// first (slower) period's figures land last, under the other period's
// button. Synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'timing logic; run once'); });

const ORDERS = [
  { id: 'o-old', order_number: 'O-OLD', total: '500.00', tax_total: '0', currency: 'USD', status: 'paid', placed_at: '2025-01-15T15:00:00Z', deleted_at: null, source: 'shopify', raw_data: null, customer_name: 'SYNTHETIC', created_at: '2025-01-15T15:00:00Z' },
  { id: 'o-now', order_number: 'O-NOW', total: '7.00', tax_total: '0', currency: 'USD', status: 'paid', placed_at: new Date().toISOString(), deleted_at: null, source: 'shopify', raw_data: null, customer_name: 'SYNTHETIC', created_at: new Date().toISOString() },
];

test('Accounting: the slow "Today" reply arriving after "All Time" does not replace the All Time figures', async ({ page, backend }) => {
  backend.tables.orders = ORDERS;
  backend.tables.expenses = [];
  await login(page);
  await page.waitForLoadState('networkidle');
  // From now on, any orders read limited to a date range answers slowly.
  await page.context().route(/\/rest\/v1\/orders\?.*placed_at=gte/, async route => { await new Promise(r => setTimeout(r, 1500)); await route.fallback(); });
  await gotoPage(page, 'accountingPanel');
  await page.click('#accountingPanel button[data-range="today"]');
  await page.click('#accountingPanel button[data-range="all"]');
  await page.waitForTimeout(2500); // the slow Today reply has arrived by now
  await expect(page.locator('#accountingPanel button[data-range="all"]')).toHaveClass(/^(?!.*secondary)/);
  await expect(page.locator('#acctStats .stat', { hasText: 'Revenue' }).locator('.num')).toHaveText('$507.00');
});

test('Tax Records: a slow "This Year" reply arriving after "All Time" does not replace the All Time figures', async ({ page, backend }) => {
  backend.tables.orders = ORDERS;
  backend.tables.expenses = [];
  backend.tables.order_items = [];
  await login(page);
  await page.waitForLoadState('networkidle');
  await page.context().route(/\/rest\/v1\/orders\?.*placed_at=gte/, async route => { await new Promise(r => setTimeout(r, 1500)); await route.fallback(); });
  await gotoPage(page, 'taxRecordsPanel');
  await page.click('#taxRecordsPanel button[data-range="year"]');
  await page.click('#taxRecordsPanel button[data-range="all"]');
  await page.waitForTimeout(2500);
  await expect(page.locator('#taxStats .stat').first().locator('.num')).toHaveText('$507.00');
});

test('Employee Activity: a slow reply to an older search does not mix into the newer search\'s results', async ({ page, backend }) => {
  const row = (id, title) => ({ id, happened_at: '2026-09-20T15:00:00Z', person_id: 'p1', person_name: 'SYNTHETIC Admin', person_email: 'a@example.test',
    person_account_number: '444555666', person_role: 'administrator', area: 'Tasks', table_name: 'tasks', action: 'UPDATE', action_label: 'changed',
    record_id: 'task-' + id, values_stored: true, old_data: { status: 'open' }, new_data: { status: 'done', title } });
  backend.rpc.employee_activity_people = [];
  backend.rpc.employee_activity_areas = [];
  backend.rpc.employee_activity = [];
  await login(page);
  await gotoPage(page, 'activityPanel');
  await page.waitForLoadState('networkidle');
  await page.context().route(/\/rest\/v1\/rpc\/employee_activity$/, async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.p_search === 'old') { await new Promise(r => setTimeout(r, 1500)); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row(1, 'SYNTHETIC OLD RESULT')]) }); }
    if (body.p_search === 'new') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row(2, 'SYNTHETIC NEW RESULT')]) });
    return route.fallback();
  });
  await page.fill('#activitySearch', 'old');
  await page.press('#activitySearch', 'Enter');
  await page.fill('#activitySearch', 'new');
  await page.press('#activitySearch', 'Enter');
  await page.waitForTimeout(2500);
  await expect(page.locator('#activityWrap')).toContainText('SYNTHETIC NEW RESULT');
  await expect(page.locator('#activityWrap')).not.toContainText('SYNTHETIC OLD RESULT');
});
