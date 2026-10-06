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

// EXT3: dates on the order form are the viewer's own calendar (Central).
test('an order dated June 1 is stored inside June 1 Central (not May 31 at 7 pm)', async ({ page, backend }) => {
  setup(backend);
  await page.clock.setFixedTime(new Date('2026-06-15T15:00:00Z'));
  await signIn(page);
  await fillOrder(page);
  await page.fill('#orderDate', '2026-06-01');
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders[0].placed_at).toBe('2026-06-01T17:00:00.000Z'); // noon CDT
});

test('at 9 pm Central the date field shows today, not tomorrow; a today order keeps the current time', async ({ page, backend }) => {
  setup(backend);
  await page.clock.setFixedTime(new Date('2026-06-16T02:00:00Z')); // 21:00 CDT on June 15
  await signIn(page);
  await expect(page.locator('#orderDate')).toHaveValue('2026-06-15');
  await fillOrder(page);
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders[0].placed_at).toBe('2026-06-16T02:00:00.000Z');
});

// ---- EXT4 (workstream D): deeper manual-order hardening ----

test('Enter pressed again while saving: one order, not two', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.delayNext('orders', 'POST', 800);
  await page.locator('#customerName').press('Enter');
  await page.locator('#orderForm').evaluate(f => { f.requestSubmit(); f.requestSubmit(); });
  await expect(page.locator('#successMsg')).toContainText('Saved — order M-');
  await page.waitForLoadState('networkidle');
  expect(inserts(backend, 'orders')).toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(1);
});

test('same total but different lines after a lost reply: stops once, never adds the new lines to the old order', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page, { qty: '2', price: '10' }); // $20
  backend.dropNext('orders', 'POST', { applied: true });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('may or may not');
  await page.fill('.item-row .item-qty', '1');
  await page.fill('.item-row .item-price', '20'); // still $20, different line
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('may already be saved');
  expect(backend.tables.order_items, 'nothing attached to the first order').toHaveLength(0);
  // Pressing again after checking saves it as a separate order with its own number.
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved — order M-');
  expect(backend.tables.orders).toHaveLength(2);
  expect(new Set(backend.tables.orders.map(o => o.order_number)).size).toBe(2);
  expect(backend.tables.order_items).toHaveLength(1);
  expect(backend.tables.order_items[0].order_id).toBe(backend.tables.orders[1].id);
  expect(backend.tables.order_items[0].quantity).toBe(1);
});

test('reloaded after a lost reply: the page warns, and entering the same order again creates no second copy', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.dropNext('orders', 'POST', { applied: true });
  await save(page);
  await expect(page.locator('#formMsg')).toBeVisible();
  const date = await page.inputValue('#orderDate');
  await page.reload();
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#formMsg')).toContainText('may not have finished before this page was reloaded');
  await expect(page.locator('#formMsg')).toContainText(backend.tables.orders[0].order_number);
  await fillOrder(page);
  await page.fill('#orderDate', date);
  await save(page);
  await expect(page.locator('#successMsg')).toContainText(backend.tables.orders[0].order_number);
  expect(backend.tables.orders).toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(1);
  // Done: a further reload shows no warning.
  await page.reload();
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#formMsg')).toBeHidden();
});

test('another tab saved an order in the same second: this order gets its own number and is not merged into it', async ({ page, backend }) => {
  setup(backend);
  await page.clock.setFixedTime(new Date('2026-06-15T17:00:05Z')); // 12:00:05 CDT
  backend.tables.orders.push({ id: 'other-tab', order_number: 'M-20260615-120005', entered_by: OWNER_USER.id, total: 99, source: 'manual' });
  await signIn(page);
  await fillOrder(page);
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('M-20260615-120005-2');
  expect(backend.tables.orders).toHaveLength(2);
  expect(backend.tables.order_items).toHaveLength(1);
  expect(backend.tables.order_items[0].order_id, 'not added to the other tab\'s order').not.toBe('other-tab');
});

test('order number taken a moment ago (unique refusal): plain words, nothing saved, the next press uses a new number', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.failNext('orders', 'POST', { status: 409, body: { code: '23505', message: 'duplicate key value violates unique constraint "orders_order_number_key"' } });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('taken by another order');
  await expect(page.locator('#formMsg')).not.toContainText('orders_order_number_key');
  expect(backend.tables.orders).toHaveLength(0);
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders).toHaveLength(1);
});

test('a gateway error page after the order was saved: plain words; the retry creates no second order', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.replyNext('orders', 'POST', { status: 502, contentType: 'text/html', body: '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>', applied: true });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('may or may not have been saved');
  await expect(page.locator('#formMsg')).not.toContainText('<');
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders).toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(1);
});

test('one bad line refuses all items (one statement), and the retry adds every line once', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  await page.click('#addItemBtn');
  await page.locator('.item-row').nth(1).locator('.item-name').fill('SYNTHETIC Soap');
  await page.locator('.item-row').nth(1).locator('.item-qty').fill('3');
  await page.locator('.item-row').nth(1).locator('.item-price').fill('4');
  backend.failNext('order_items', 'POST', { status: 400, body: { code: '23514', message: 'new row for relation "order_items" violates check constraint "order_items_synthetic_check"' } });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('The order was saved, but one of its items');
  expect(backend.tables.orders).toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(0);
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders).toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(2);
});
