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

// ---- EXT5 (workstream 2): deeper manual-order failure testing ----

test('with no other order, the first save uses the plain number for that second', async ({ page, backend }) => {
  setup(backend);
  await page.clock.setFixedTime(new Date('2026-06-15T17:00:05Z'));
  await signIn(page);
  await fillOrder(page);
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders[0].order_number).toBe('M-20260615-120005');
});

test('retry after a lost reply: another person\'s order with the same number is never adopted', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.dropNext('orders', 'POST', { applied: false }); // first attempt not saved at all
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('may or may not');
  const num = await page.evaluate(() => JSON.parse(sessionStorage.getItem('he.manualOrder.pending')).orderNumber);
  // meanwhile an order with the same number, same person, different customer appears (another tab)
  backend.tables.orders.push({ id: 'other', order_number: num, entered_by: OWNER_USER.id, total: 77, customer_name: 'SYNTHETIC Someone else', source: 'manual', deleted_at: null });
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.order_items).toHaveLength(1);
  expect(backend.tables.order_items[0].order_id).not.toBe('other');
  expect(backend.tables.orders).toHaveLength(2);
});

test('retry when two identical orders carry the number: stops and explains, adds nothing', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page); // 2 x $10 = $20
  backend.dropNext('orders', 'POST', { applied: false });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('may or may not');
  const num = await page.evaluate(() => JSON.parse(sessionStorage.getItem('he.manualOrder.pending')).orderNumber);
  const twin = { order_number: num, entered_by: OWNER_USER.id, total: 20, customer_name: 'SYNTHETIC Walk-in', source: 'manual', deleted_at: null };
  backend.tables.orders.push({ id: 'twin-1', ...twin }, { id: 'twin-2', ...twin });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('cannot tell which is this one');
  expect(backend.tables.order_items).toHaveLength(0);
});

test('an order saved without its items is listed on sign-in, even after the tab was closed', async ({ page, backend, context }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.failNext('order_items', 'POST', { status: 500, body: { message: 'Synthetic server error' } });
  await save(page);
  await expect(page.locator('#formMsg')).toBeVisible();
  backend.tables.orders[0].created_at = new Date().toISOString(); // the database default
  const num = backend.tables.orders[0].order_number;
  await page.close(); // tab closed: its session storage is gone
  const page2 = await context.newPage();
  await page2.goto('/manual-order-entry.html');
  await expect(page2.locator('#appView')).toBeVisible();
  await expect(page2.locator('#unfinishedMsg')).toContainText('Saved without any items: order ' + num);
});

// EXT6: the listing used to say "re-enter exactly the same order on this
// device". Once the tab is closed that made a SECOND order (the attempt in
// progress lives only in that tab) and left the empty one counting in the
// totals. Each listed order now has "Finish this order".
async function orderSavedWithoutItemsThenTabClosed(page, backend, context) {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.failNext('order_items', 'POST', { status: 500, body: { message: 'Synthetic server error' } });
  await save(page);
  await expect(page.locator('#formMsg')).toBeVisible();
  backend.tables.orders[0].created_at = new Date().toISOString();
  const first = backend.tables.orders[0];
  await page.close();
  const page2 = await context.newPage();
  await page2.goto('/manual-order-entry.html');
  await expect(page2.locator('#appView')).toBeVisible();
  await expect(page2.locator('#unfinishedMsg')).toContainText('Saved without any items: order ' + first.order_number);
  return { page2, first };
}

test('an order saved without items can be finished in a new tab: the items join that order, no second order', async ({ page, backend, context }) => {
  const { page2, first } = await orderSavedWithoutItemsThenTabClosed(page, backend, context);
  await expect(page2.locator('#unfinishedMsg')).not.toContainText('Re-enter');
  await page2.locator('#unfinishedMsg .finishOrderBtn').click();
  await expect(page2.locator('#unfinishedMsg')).toContainText('Finishing order ' + first.order_number);
  await fillOrder(page2);
  await save(page2);
  await expect(page2.locator('#successMsg')).toContainText('Saved — order ' + first.order_number);
  expect(backend.tables.orders).toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(1);
  expect(backend.tables.order_items[0].order_id).toBe(first.id);
  await expect(page2.locator('#unfinishedMsg')).toBeHidden();
});

test('finishing refuses a form that does not match the listed order, and saves nothing', async ({ page, backend, context }) => {
  const { page2 } = await orderSavedWithoutItemsThenTabClosed(page, backend, context);
  await page2.locator('#unfinishedMsg .finishOrderBtn').click();
  await fillOrder(page2, { qty: '3' }); // $30, not the $20 that was saved
  await save(page2);
  await expect(page2.locator('#formMsg')).toContainText('does not match order');
  await expect(page2.locator('#formMsg')).toContainText('Nothing was saved');
  expect(backend.tables.orders).toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(0);
});

test('finishing also refuses the same total for a different customer', async ({ page, backend, context }) => {
  const { page2 } = await orderSavedWithoutItemsThenTabClosed(page, backend, context);
  await page2.locator('#unfinishedMsg .finishOrderBtn').click();
  await fillOrder(page2);
  await page2.fill('#customerName', 'SYNTHETIC Someone Else');
  await save(page2);
  await expect(page2.locator('#formMsg')).toContainText('does not match order');
  expect(backend.tables.order_items).toHaveLength(0);
});

test('"Stop finishing" goes back to the list, and the next save is a separate new order', async ({ page, backend, context }) => {
  const { page2, first } = await orderSavedWithoutItemsThenTabClosed(page, backend, context);
  await page2.locator('#unfinishedMsg .finishOrderBtn').click();
  await page2.locator('#unfinishedMsg .stopFinishingBtn').click();
  await expect(page2.locator('#unfinishedMsg')).toContainText('Saved without any items: order ' + first.order_number);
  await fillOrder(page2, { qty: '3' });
  await save(page2);
  await expect(page2.locator('#successMsg')).toContainText('Saved — order M-');
  expect(backend.tables.orders).toHaveLength(2);
  expect(backend.tables.order_items.every(i => i.order_id !== first.id)).toBe(true);
});

test('no warning when every recent order has its items', async ({ page, backend }) => {
  setup(backend);
  backend.tables.orders.push({ id: 'done-1', order_number: 'M-1', entered_by: OWNER_USER.id, total: 5, source: 'manual', deleted_at: null, created_at: new Date().toISOString() });
  backend.tables.order_items.push({ id: 'i-1', order_id: 'done-1', product_name: 'SYNTHETIC', quantity: 1, unit_price: 5, line_total: 5 });
  await signIn(page);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#unfinishedMsg')).toBeHidden();
});

test('three tabs saving in the same second create three separate orders', async ({ page, backend, context }) => {
  setup(backend);
  await page.clock.setFixedTime(new Date('2026-06-15T17:00:05Z'));
  await signIn(page);
  const pages = [page];
  for (let i = 0; i < 2; i++) {
    const p = await context.newPage();
    await p.clock.setFixedTime(new Date('2026-06-15T17:00:05Z'));
    await p.goto('/manual-order-entry.html');
    await expect(p.locator('#appView')).toBeVisible();
    pages.push(p);
  }
  for (const [i, p] of pages.entries()) await fillOrder(p, { qty: String(i + 1), price: '10' });
  for (const p of pages) { await save(p); await expect(p.locator('#successMsg')).toContainText('Saved'); }
  expect(backend.tables.orders).toHaveLength(3);
  expect(new Set(backend.tables.orders.map(o => o.order_number)).size).toBe(3);
  expect(backend.tables.order_items.map(i => i.quantity).sort()).toEqual([1, 2, 3]);
});

for (const [field, value] of [['qty', '2.5'], ['qty', '0'], ['qty', '-1'], ['qty', '100001'], ['price', '-3'], ['price', '1.005'], ['price', '2000000']]) {
  test(`the form refuses ${field} = ${value} before anything is sent`, async ({ page, backend }) => {
    setup(backend);
    await signIn(page);
    await fillOrder(page);
    await page.fill(field === 'qty' ? '.item-row .item-qty' : '.item-row .item-price', value);
    await save(page);
    await page.waitForTimeout(300);
    expect(inserts(backend, 'orders')).toHaveLength(0);
    await expect(page.locator('#successMsg')).toBeHidden();
  });
}

test('sign-in expired while saving the items: says so; the identical retry adds the items once', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  backend.failNext('order_items', 'POST', { status: 401, body: { code: 'PGRST301', message: 'JWT expired' } });
  await save(page);
  await expect(page.locator('#formMsg')).toContainText('sign-in has expired');
  await save(page);
  await expect(page.locator('#successMsg')).toContainText('Saved');
  expect(backend.tables.orders).toHaveLength(1);
  expect(backend.tables.order_items).toHaveLength(1);
});

test('the unfinished-attempt record in the browser holds no customer name or e-mail', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  await page.fill('#customerEmail', 'synthetic.buyer@example.test');
  backend.dropNext('orders', 'POST', { applied: false });
  await save(page);
  await expect(page.locator('#formMsg')).toBeVisible();
  const stored = await page.evaluate(() => sessionStorage.getItem('he.manualOrder.pending'));
  expect(stored).toBeTruthy();
  expect(stored).not.toContain('SYNTHETIC Walk-in');
  expect(stored).not.toContain('synthetic.buyer@example.test');
});

// EXT6 (workstream 10): a shared computer. Signing out left the customer's
// name and e-mail typed into the (hidden) form.
test('signing out clears the form: no customer name or e-mail is left in the page', async ({ page, backend }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  await page.fill('#customerEmail', 'walk-in.private@example.test');
  await page.click('#signOutBtn');
  await expect(page.locator('#loginView')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.innerHTML.includes('walk-in.private@example.test')
    || [...document.querySelectorAll('input')].some(i => i.value === 'SYNTHETIC Walk-in' || i.value === 'walk-in.private@example.test'))).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem('he.manualOrder.pending'))).toBe(null);
});

test('a sign-out in another tab clears this tab too: no customer details left in the page', async ({ page, backend, context }) => {
  setup(backend);
  await signIn(page);
  await fillOrder(page);
  await page.fill('#customerEmail', 'walk-in.private@example.test');
  const other = await context.newPage();
  await other.goto('/manual-order-entry.html');
  await expect(other.locator('#appView')).toBeVisible();
  await other.click('#signOutBtn');
  await expect(page.locator('#loginView')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('input')].some(i => i.value === 'SYNTHETIC Walk-in' || i.value === 'walk-in.private@example.test')).catch(() => true)).toBe(false);
});
