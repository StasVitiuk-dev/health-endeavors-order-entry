// EXT9: request keys on creates (drafts/19 + the dashboard side). With the
// 'request_keys' switch on, a create carries a key made for that attempt; a
// repeat after a lost reply is refused by the database's unique index and the
// page says it was already saved, instead of creating a second record. Off by
// default: nothing changes until drafts/19 is installed and the switch is on.
// The unique index is imitated here (409 / 23505 on a repeated key).

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'form logic; run once'); });

function keysOn(backend) {
  backend.tables.feature_flags = (backend.tables.feature_flags || []).concat([{ id: 'ff-rk', flag_key: 'request_keys', label: 'Request keys', description: 'SYNTHETIC', enabled: true }]);
}
// Imitates `create unique index … (client_request_id) where client_request_id is not null`.
async function uniqueKeys(page, backend, table) {
  const seen = new Set();
  backend.sentKeys = backend.sentKeys || [];
  await page.context().route(new RegExp('/rest/v1/' + table + '(\\?|$)'), async route => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fallback();
    const body = JSON.parse(req.postData() || '{}');
    const key = (Array.isArray(body) ? body[0] : body).client_request_id;
    backend.sentKeys.push(key);
    if (key && seen.has(key)) {
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "' + table + '_client_request_id_key"', details: 'Key (client_request_id)=(' + key + ') already exists.' }) });
    }
    if (key) seen.add(key);
    return route.fallback();
  });
}
const posts = (backend, table) => backend.requests.filter(r => r.table === table && r.method === 'POST');

async function fillExpense(page, amount) {
  await page.selectOption('#expCategory', 'packaging');
  await page.fill('#expAmount', String(amount));
  await page.fill('#expVendor', 'SYNTHETIC Vendor');
}

test('switch off (default): no key is sent', async ({ page, backend }) => {
  enableWrites(backend, ['expenses']);
  backend.tables.expenses = [];
  await login(page);
  await gotoPage(page, 'expensesPanel');
  await fillExpense(page, 12.5);
  await page.click('#addExpenseForm button[type=submit]');
  await expect.poll(() => posts(backend, 'expenses').length).toBe(1);
  expect(posts(backend, 'expenses')[0].body).not.toHaveProperty('client_request_id');
});

test('switch on: a lost reply then Save again → refused as a repeat, said plainly, one expense only', async ({ page, backend }) => {
  enableWrites(backend, ['expenses']);
  backend.tables.expenses = [];
  keysOn(backend);
  await uniqueKeys(page, backend, 'expenses');
  await login(page);
  await gotoPage(page, 'expensesPanel');
  backend.dropNext('expenses', 'POST', { applied: true }); // saved, but the reply never arrives
  await fillExpense(page, 12.5);
  await page.click('#addExpenseForm button[type=submit]');
  await expect(page.locator('#dashError')).toContainText('may or may not have been saved');
  await page.click('#addExpenseForm button[type=submit]'); // the natural second press
  await expect(page.locator('.toast', { hasText: 'was already saved by an earlier attempt' })).toHaveCount(1);
  expect(backend.tables.expenses).toHaveLength(1);
  const [a, b] = backend.sentKeys;
  expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(b).toBe(a); // same attempt, same key
  await expect(page.locator('#expAmount')).toHaveValue(''); // treated as done
});

test('switch on: after a success the next expense gets a new key', async ({ page, backend }) => {
  enableWrites(backend, ['expenses']);
  backend.tables.expenses = [];
  keysOn(backend);
  await uniqueKeys(page, backend, 'expenses');
  await login(page);
  await gotoPage(page, 'expensesPanel');
  await fillExpense(page, 10);
  await page.click('#addExpenseForm button[type=submit]');
  await expect.poll(() => backend.tables.expenses.length).toBe(1);
  await fillExpense(page, 11);
  await page.click('#addExpenseForm button[type=submit]');
  await expect.poll(() => backend.tables.expenses.length).toBe(2);
  const [a, b] = backend.sentKeys;
  expect(a).toBeTruthy();
  expect(a).not.toBe(b);
});

test('switch on: a repeated purchase order opens the one already created instead of a second', async ({ page, backend }) => {
  enableWrites(backend, ['purchase_orders']);
  backend.tables.suppliers = [{ id: 'sup-rk', name: 'SYNTHETIC Supplier', supplier_type: 'supplier', is_active: true, contact_name: null, email: null, phone: null, notes: null }];
  keysOn(backend);
  await uniqueKeys(page, backend, 'purchase_orders');
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  const before = backend.tables.purchase_orders.length;
  backend.dropNext('purchase_orders', 'POST', { applied: true });
  await page.selectOption('#poSupplier', { index: 1 });
  await page.click('#addPoForm button[type=submit]');
  await expect(page.locator('#dashError')).toBeVisible();
  await page.click('#addPoForm button[type=submit]');
  await expect(page.locator('.toast', { hasText: 'was already saved by an earlier attempt' })).toHaveCount(1);
  await expect(page.locator('.toast', { hasText: 'created — add what' })).toHaveCount(0);
  expect(backend.tables.purchase_orders.length).toBe(before + 1);
  const reread = backend.requests.filter(r => r.table === 'purchase_orders' && r.method === 'GET' && /client_request_id=eq\./.test(decodeURIComponent(r.query)));
  expect(reread.length).toBe(1);
});

test('Feature Switches: the request-key switch stays off until the columns exist', async ({ page, backend }) => {
  backend.tables.feature_flags = [{ id: 'ff-rk', flag_key: 'request_keys', label: 'Request keys', description: 'SYNTHETIC', enabled: false }];
  await page.context().route(/\/rest\/v1\/expenses\?select=client_request_id/, r => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '42703', message: 'column expenses.client_request_id does not exist' }) }));
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await page.locator('.flagRow[data-key="request_keys"] .slider').click();
  await expect(page.locator('#dashError')).toContainText('request-key columns (drafts/19) are not installed yet');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
  expect(backend.tableWrites().filter(w => w.table === 'feature_flags')).toEqual([]);
});

test('Feature Switches: with the columns installed, the usual password step follows', async ({ page, backend }) => {
  backend.tables.feature_flags = [{ id: 'ff-rk', flag_key: 'request_keys', label: 'Request keys', description: 'SYNTHETIC', enabled: false }];
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await page.locator('.flagRow[data-key="request_keys"] .slider').click();
  await expect(page.locator('#reauthOverlay')).toBeVisible();
});
