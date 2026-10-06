// Manual order entry (manual-order-entry.html; index.html is an identical
// copy). Saving is two writes: the order, then its items. Before 2026-10-06
// (EXT3) a failure between them, or a lost reply, invited a second press that
// created a SECOND order (duplicate revenue) and left the first without items.
// Now the same order number is kept until the order is fully saved, a retry
// finds the first order and only adds missing items, and errors are in plain
// words. Synthetic data only; everything is mocked.

const { test, expect, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'order entry logic; run once'); });
// This page loads its fonts from Google Fonts (blocked by the mock, harmless):
// the only outside request allowed here.
test.afterEach(({ backend }) => { backend.blocked = backend.blocked.filter(u => !u.startsWith('https://fonts.googleapis.com/')); });

async function signIn(page, file = 'manual-order-entry.html') {
  await page.goto('/' + file);
  await page.fill('#loginEmail', OWNER_USER.email);
  await page.fill('#loginPassword', OWNER_USER.password);
  await page.click('#loginBtn');
  await expect(page.locator('#appView')).toBeVisible();
}
async function fillOrder(page, { qty = '2', price = '10' } = {}) {
  await page.selectOption('#channel', { index: 1 });
  await page.fill('#customerName', 'SYNTHETIC Walk-in');
  await page.fill('.item-row .item-name', 'SYNTHETIC Lotion');
  await page.fill('.item-row .item-qty', qty);
  await page.fill('.item-row .item-price', price);
}
const save = page => page.click('#orderForm button[type=submit]');
const inserts = (backend, table) => backend.requests.filter(r => r.table === table && r.method === 'POST' && !r.failed && !r.dropped);

function setup(backend) {
  backend.tables.orders = [];
  backend.tables.order_items = [];
  enableWrites(backend, ['orders', 'order_items']);
}

for (const file of ['manual-order-entry.html', 'index.html']) {
  test(`${file}: a normal save writes one order and its items`, async ({ page, backend }) => {
    setup(backend);
    await signIn(page, file);
    await fillOrder(page);
    await save(page);
    await expect(page.locator('#successMsg')).toContainText('Saved — order M-');
    expect(backend.tables.orders).toHaveLength(1);
    expect(backend.tables.order_items).toHaveLength(1);
    expect(backend.tables.order_items[0].order_id).toBe(backend.tables.orders[0].id);
  });
}

test('items refused after the order was saved: a second press adds the items to the SAME order', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.failNext('order_items', 'POST', { status: 500, body: { message: 'Synthetic server error' } });
  await save(page);
  await expect(page.locator('#formMsg')).toBeVisible();
  expect(backend.tables.orders).toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(0);
  await save(page); // retry, form unchanged
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders, 'no second order').toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(1);
  expect(inserts(backend, 'orders')).toHaveLength(1);
});

test('reply lost after the order was saved: says it may or may not be saved; the retry creates no second order', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.dropNext('orders', 'POST', { applied: true });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('may or may not have been saved');
  await expect(page.locator('#formMsg')).not.toContainText('Failed to fetch');
  expect(backend.tables.orders).toHaveLength(1);
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders, 'no second order').toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(1);
});

test('reply lost after the items were saved: the retry does not add the items twice', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.dropNext('order_items', 'POST', { applied: true });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('may or may not have been saved');
  expect(backend.tables.order_items).toHaveLength(1);
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders).toHaveLength(1);
  expect(backend.tables.order_items, 'items not doubled').toHaveLength(1);
});

test('amounts changed after a failed save: stops and explains instead of creating a second order', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.dropNext('orders', 'POST', { applied: true });
  await save(page);
  await expect(page.locator('#formMsg')).toBeVisible();
  await page.fill('.item-row .item-qty', '5'); // different total now
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('may already be saved');
  expect(backend.tables.orders).toHaveLength(1);
  expect(inserts(backend, 'orders'), 'only the first (dropped but saved) insert').toHaveLength(1);
});

test('permission refused on the order: plain words, nothing saved, no internal names', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.failNext('orders', 'POST', { status: 403, body: { code: '42501', message: 'new row violates row-level security policy for table "orders"' } });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('not allowed to add orders. Nothing was saved.');
  await expect(page.locator('#formMsg')).not.toContainText('row-level security');
  expect(backend.tables.orders).toHaveLength(0);
});
