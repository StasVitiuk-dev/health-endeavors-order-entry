// Sign-in expiring part-way through a multi-step action (2026-10-06,
// extension 4, workstream R). Once a session expires, EVERY later request is
// refused, including the page's own clean-up or undo step. These tests make
// the session expire at a chosen request and refuse everything after it,
// then check the page never claims success, says to sign in again, and
// describes any half-done state truthfully. A lost reply on the last step of
// a product delete is covered too (the page must look before "undoing").

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'session logic; run once'); });

const EXPIRED = { code: 'PGRST301', message: 'JWT expired' };

// From the first request matching (table, method) onwards, every database
// and storage request is refused as "JWT expired".
async function expireAt(page, backend, table, method) {
  let expired = false;
  backend.expiredRequests = [];
  await page.route(/\/(rest|storage)\/v1\//, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const t = url.pathname.startsWith('/rest/v1/') ? url.pathname.slice('/rest/v1/'.length) : 'storage';
    if (!expired && t === table && req.method() === method) expired = true;
    if (!expired) return route.fallback();
    backend.expiredRequests.push(`${req.method()} ${t}`);
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(EXPIRED) });
  });
}

function seedProduct(backend) {
  Object.assign(backend.tables, {
    products: [{ id: 'prod-x', name: 'SYNTHETIC unused product', sku: 'SYN-X', is_active: true, status: 'draft', cost: null, retail_price: null, wholesale_price: null, packaging_info: null }],
    inventory: [{ product_id: 'prod-x', available: 0, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null }],
    purchase_order_items: [], inventory_lots: [], inventory_adjustments: [], recalls: [], quality_checks: [], order_items: [],
  });
  enableWrites(backend, ['products', 'inventory']);
}
async function pressDelete(page) {
  await gotoPage(page, 'inventoryPanel');
  await page.waitForLoadState('networkidle');
  const row = page.locator('#inventoryWrap [data-product-id="prod-x"]');
  await row.locator('.editProductBtn').click();
  await row.locator('.deleteProductBtn').click();
  await row.locator('.deleteProductBtn').click();
}

test('product delete: sign-in expires between removing the stock row and the product; the page says so and how to repair', async ({ page, backend }) => {
  seedProduct(backend);
  await login(page);
  await expireAt(page, backend, 'products', 'DELETE');
  await pressDelete(page);
  const err = page.locator('#dashError');
  await expect(err).toContainText('was not deleted');
  await expect(err).toContainText('could not be put back');
  await expect(err).toContainText('Sign in again');
  await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);
  expect(backend.tables.products).toHaveLength(1);
  expect(backend.expiredRequests).toEqual(['DELETE products', 'POST inventory']);
});

test('product delete: reply lost after the product WAS deleted: no stray stock row, reported as deleted', async ({ page, backend }) => {
  seedProduct(backend);
  await login(page);
  backend.dropNext('products', 'DELETE', { applied: true });
  await pressDelete(page);
  await expect(page.locator('#toastHost .toast.ok')).toContainText('Product deleted');
  expect(backend.tables.products).toHaveLength(0);
  expect(backend.tables.inventory, 'no stock row recreated for a deleted product').toHaveLength(0);
});

test('product delete: reply lost and the product is still there: its stock row is put back', async ({ page, backend }) => {
  seedProduct(backend);
  await login(page);
  backend.dropNext('products', 'DELETE', { applied: false });
  await pressDelete(page);
  await expect(page.locator('#dashError')).toBeVisible();
  expect(backend.tables.products).toHaveLength(1);
  expect(backend.tables.inventory).toHaveLength(1);
  expect(backend.tables.inventory[0].product_id).toBe('prod-x');
});

test('product delete: reply lost and the connection stays down: says it cannot tell, and how to repair', async ({ page, backend }) => {
  seedProduct(backend);
  await login(page);
  // The delete's reply is lost, and so is the look-up that follows it.
  let deleteSeen = false;
  await page.route(/\/rest\/v1\/products/, route => {
    const m = route.request().method();
    if (m === 'DELETE') { deleteSeen = true; return route.abort('connectionreset'); }
    if (m === 'GET' && deleteSeen) return route.abort('connectionreset');
    return route.fallback();
  });
  await pressDelete(page);
  // The client retries a failed read three times (1 + 2 + 4 s) before giving up.
  await expect(page.locator('#dashError')).toContainText('cannot tell whether', { timeout: 20000 });
  await expect(page.locator('#dashError')).toContainText('recreate the stock row');
  await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);
});

test('task update with an expired sign-in, then signing in again: the retry works and applies once', async ({ page, backend }) => {
  backend.tables.tasks = [{ id: 't1', title: 'SYNTHETIC task', priority: 'normal', status: 'open', due_at: '2026-12-01T00:00:00Z' }];
  enableWrites(backend, ['tasks']);
  await login(page);
  await gotoPage(page, 'tasksPanel');
  backend.failNext('tasks', 'PATCH', { status: 401, body: EXPIRED });
  await page.locator('#tasksTableWrap .taskStatusBtn', { hasText: 'Mark in progress' }).click();
  await expect(page.locator('#dashError')).toContainText('Sign in again');
  expect(backend.tables.tasks[0].status).toBe('open');
  await page.locator('#tasksTableWrap .taskStatusBtn', { hasText: 'Mark in progress' }).click();
  await expect.poll(() => backend.tables.tasks[0].status).toBe('in_progress');
  expect(backend.requests.filter(r => r.table === 'tasks' && r.method === 'PATCH' && !r.failed)).toHaveLength(1);
});

test('the sign-in refresh fails after the computer wakes from sleep: the page leaves the dashboard and says why', async ({ page, backend }) => {
  backend.tables.tasks = [];
  await page.clock.install();
  await login(page);
  await page.route(/\/auth\/v1\/token\?grant_type=refresh_token/, route =>
    route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' }) }));
  // Two hours later (the access token lasts one): the client tries to refresh.
  await page.clock.fastForward('02:00:00');
  // EXT6: leaving the dashboard now reloads the page (nothing from the
  // session stays behind), so this nudge may be cut off by that reload.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(e => {
    if (!/Execution context was destroyed|navigation/i.test(String(e))) throw e;
  });
  await expect(page.locator('#loginScreen')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#dash')).toBeHidden();
  await expect(page.locator('#loginMsg')).toContainText('You were signed out');
});
