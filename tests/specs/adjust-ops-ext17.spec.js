// EXT17: manual stock adjustments run through an explicit operation state
// machine (he-ops, repeatable). The rule under test: after a lost reply the
// same adjustment is never sent again until a read-back of the stock says
// whether the first one was saved. Before EXT17 the form stayed filled and
// Save was enabled, so a second press could add the stock twice.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { installStockFunctions } = require('../helpers/stock-functions-mock');

const A = 'prod-adj-a';
function seed(backend) {
  const invA = { id: 'inv-a', product_id: A, available: 100, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null };
  Object.assign(backend.tables, {
    products: [{ id: A, name: 'SYNTHETIC product A', sku: 'SYN-ADJ-A', is_active: true, status: 'active', cost: 2, retail_price: 10, wholesale_price: 6, packaging_info: null, updated_at: '2026-09-01T00:00:00Z', inventory: invA, inventory_lots: [] }],
    inventory: [invA],
    inventory_lots: [],
    inventory_adjustments: [],
  });
  enableWrites(backend, ['inventory', 'inventory_adjustments']);
}
const stock = backend => backend.tables.inventory.find(r => r.product_id === A).available;
const history = backend => backend.tables.inventory_adjustments.map(a => a.change_amount);
const stockPatches = backend => backend.tableWrites().filter(r => r.table === 'inventory' && r.method === 'PATCH').length;

async function adjust(page, amount) {
  await page.selectOption('#invProduct', A);
  await page.selectOption('#invBucket', 'available');
  if (amount !== undefined) await page.fill('#invAmount', String(amount));
  await page.click('#adjustInventoryForm button[type=submit]');
}

test.describe('stock adjustment after a lost reply (direct table path)', () => {
  test.beforeEach(async ({ page, backend }) => {
    seed(backend);
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await page.waitForLoadState('networkidle');
  });

  test('saved, reply lost: the second press checks, finds it saved and sends NOTHING', async ({ page, backend }) => {
    backend.dropNext('inventory', 'PATCH', { applied: true });
    await adjust(page, 5);
    await expect(page.locator('#dashError')).toContainText('may or may not have been saved', { timeout: 30000 });
    expect(stock(backend)).toBe(105);
    const patches = stockPatches(backend);
    await adjust(page); // same form, second press
    await expect(page.locator('#dashError')).toContainText('WAS saved — the stock is now 105', { timeout: 30000 });
    await expect(page.locator('#dashError')).toContainText('history was NOT written');
    expect(stock(backend), 'never added twice').toBe(105);
    expect(stockPatches(backend), 'no second write').toBe(patches);
    await expect(page.locator('#invAmount')).toHaveValue('');
  });

  test('not saved (dropped before the database): the check says so, then a press saves it once', async ({ page, backend }) => {
    backend.dropNext('inventory', 'PATCH', { applied: false });
    await adjust(page, 5);
    await expect(page.locator('#dashError')).toContainText('may or may not have been saved', { timeout: 30000 });
    expect(stock(backend)).toBe(100);
    await adjust(page);
    await expect(page.locator('#dashError')).toContainText('was NOT saved — the stock is still 100', { timeout: 30000 });
    expect(stock(backend)).toBe(100);
    await adjust(page, 5);
    await expect.poll(() => stock(backend), { timeout: 15000 }).toBe(105);
    await expect.poll(() => history(backend)).toEqual([5]);
  });

  test('changed elsewhere as well: the dashboard says it cannot tell and keeps refusing to send', async ({ page, backend }) => {
    backend.dropNext('inventory', 'PATCH', { applied: true });
    await adjust(page, 5);
    await expect(page.locator('#dashError')).toContainText('may or may not have been saved', { timeout: 30000 });
    backend.tables.inventory[0].available = 97; // another tab took 8 out meanwhile
    const patches = stockPatches(backend);
    await adjust(page);
    await expect(page.locator('#dashError')).toContainText('cannot tell whether the earlier adjustment (+5) was saved', { timeout: 30000 });
    await adjust(page, 5);
    await expect(page.locator('#dashError')).toContainText('cannot tell whether the earlier adjustment (+5) was saved', { timeout: 30000 });
    expect(stockPatches(backend)).toBe(patches);
    expect(stock(backend)).toBe(97);
  });

  test('stock saved but its history line refused: says the stock WAS changed and clears the amount', async ({ page, backend }) => {
    backend.failNext('inventory_adjustments', 'POST', { status: 500, body: { message: 'Synthetic server error' } });
    await adjust(page, 5);
    await expect(page.locator('#dashError')).toContainText('The stock WAS changed (+5)', { timeout: 30000 });
    await expect(page.locator('#dashError')).toContainText('Do not save it again');
    await expect(page.locator('#dashError')).not.toContainText('Could not save that adjustment');
    expect(stock(backend)).toBe(105);
    await expect(page.locator('#invAmount')).toHaveValue('');
  });

  test('two normal adjustments in a row on the same product both apply (a confirmed adjustment is not final)', async ({ page, backend }) => {
    await adjust(page, 5);
    await expect.poll(() => stock(backend), { timeout: 15000 }).toBe(105);
    await page.waitForLoadState('networkidle');
    await adjust(page, 3);
    await expect.poll(() => stock(backend), { timeout: 15000 }).toBe(108);
    await expect.poll(() => history(backend)).toEqual([5, 3]);
  });

  test('a different product or bucket is not blocked by an unknown result elsewhere', async ({ page, backend }) => {
    backend.dropNext('inventory', 'PATCH', { applied: true });
    await adjust(page, 5);
    await expect(page.locator('#dashError')).toContainText('may or may not have been saved', { timeout: 30000 });
    await page.selectOption('#invProduct', A);
    await page.selectOption('#invBucket', 'damaged');
    await page.fill('#invAmount', '2');
    await page.click('#adjustInventoryForm button[type=submit]');
    await expect.poll(() => backend.tables.inventory[0].damaged, { timeout: 15000 }).toBe(2);
  });
});

test.describe('stock adjustment after a lost reply (R4 database function)', () => {
  test.beforeEach(async ({ page, backend }) => {
    seed(backend);
    installStockFunctions(backend);
    backend.allowUnguardedState = true;
    backend.tables.feature_flags = [{ id: 'ff-adj', flag_key: 'stock_fn_adjust', label: 'stock_fn_adjust', description: 'SYNTHETIC', enabled: true }];
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await page.waitForLoadState('networkidle');
  });

  test('saved, reply lost, page refreshed: the second press checks instead of sending again', async ({ page, backend }) => {
    let drop = true;
    await page.context().route(/\/rest\/v1\/rpc\/adjust_inventory/, async route => {
      if (!drop) return route.fallback();
      drop = false;
      await backend.handle({ request: () => route.request(), fulfill: async () => {} });
      return route.abort('connectionreset');
    });
    await adjust(page, 7);
    await expect(page.locator('#dashError')).toContainText('it never sends it twice', { timeout: 30000 });
    await expect.poll(() => stock(backend)).toBe(107);
    await page.waitForLoadState('networkidle'); // the page re-read the stock (107), so p_expected alone would accept a repeat
    const calls = backend.stockFunctionCalls.length;
    await adjust(page);
    await expect(page.locator('#dashError')).toContainText('WAS saved — the stock is now 107', { timeout: 30000 });
    await expect(page.locator('#dashError')).toContainText('Its line is in the Adjustment history');
    expect(backend.stockFunctionCalls.length, 'no second call').toBe(calls);
    expect(stock(backend)).toBe(107);
  });
});
