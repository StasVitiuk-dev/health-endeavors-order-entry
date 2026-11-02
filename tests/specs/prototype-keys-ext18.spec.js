// EXT18: values that happen to be the names of built-in JavaScript object
// properties ("__proto__", "constructor", "toString", "hasOwnProperty",
// "valueOf") must be treated as ordinary text wherever the page groups or looks
// things up by a value that came from the database or from a customer.
// Before EXT18, a shipping state typed as "constructor" showed a garbled tax
// figure ("function Object() { [native code] }12.50"), and "__proto__" made that
// order's tax vanish from the per-state table. The shipping address comes from
// the customer (Shopify), so this was customer-controlled.
// Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'arithmetic, run once'); });

const NASTY = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__', 'prototype'];
const when = '2026-03-01T12:00:00Z';

test('Tax Records: a shipping state named like a built-in property is an ordinary row with its own tax', async ({ page, backend }) => {
  const orders = [...NASTY, 'CA'].map((p, i) => ({ id: 'ord-pk-' + i, order_number: 'ORD-PK-' + i, total: '100.00', tax_total: (i + 1) + '.25', currency: 'USD',
    status: 'paid', placed_at: when, deleted_at: null, source: 'shopify', raw_data: { shipping_address: { province: p, country_code: 'US' } }, customer_name: 'SYNTHETIC', created_at: when }));
  backend.tables.orders = orders;
  backend.tables.order_items = []; backend.tables.products = [];
  backend.tables.expenses = [];
  await login(page);
  await gotoPage(page, 'taxRecordsPanel');
  await page.click('#taxRecordsPanel button[data-range="all"]');
  // pairs, not an object: the test must not fall into the same trap ("__proto__" as a key)
  const want = [...NASTY, 'CA'].map((p, i) => [p, '$' + (i + 1) + '.25']).sort((a, b) => a[0] < b[0] ? -1 : 1);
  await expect.poll(async () => {
    const out = [];
    for (const row of await page.locator('#taxStateWrap tbody tr').all()) out.push(await row.locator('td').allTextContents());
    return out.sort((a, b) => a[0] < b[0] ? -1 : 1);
  }, { timeout: 20000 }).toEqual(want);
  const total = (await page.locator('#taxStats .stat .num').allTextContents())[4];
  expect(total).toBe('$' + [...NASTY, 'CA'].reduce((s, _, i) => s + i + 1.25, 0).toFixed(2));
});

test('Tax Records: an expense category named like a built-in property stays in its own row', async ({ page, backend }) => {
  backend.tables.orders = []; backend.tables.order_items = []; backend.tables.products = [];
  // The real table only allows known categories; the mock is told this row is deliberately impossible.
  backend.allowImpossibleData = true; backend.expectViolations = true;
  backend.tables.expenses = NASTY.map((c, i) => ({ id: 'exp-pk-' + i, category: c, amount: (i + 1) + '.00', expense_date: '2026-03-02', vendor: 'SYNTHETIC', receipt_path: null, deleted_at: null, note: null, created_at: when }));
  await login(page);
  await gotoPage(page, 'taxRecordsPanel');
  await page.click('#taxRecordsPanel button[data-range="all"]');
  await expect.poll(async () => (await page.locator('#taxStats .stat .num').allTextContents())[2], { timeout: 20000 }).toBe('$' + NASTY.reduce((s, _, i) => s + i + 1, 0) + '.00');
  const txt = await page.locator('#taxCategoryWrap').innerText();
  expect(txt).not.toMatch(/function|native code|\[object/);
  for (const c of NASTY) expect(txt).toContain(c);
});

test('Accounting: an expense note "Purchase order constructor" / "__proto__" is checked like any other order (the page used to fail here)', async ({ page, backend, pageErrors }) => {
  backend.tables.orders = [];
  backend.tables.expenses = ['__proto__', '__proto__', 'constructor', 'PO-1', 'PO-1'].map((po, i) => ({ id: 'exp-po-' + i, category: 'ingredients', amount: '10.00',
    expense_date: '2026-03-0' + (i + 1), vendor: 'SYNTHETIC', receipt_path: null, deleted_at: null, note: 'Purchase order ' + po, created_at: when }));
  await login(page);
  await gotoPage(page, 'accountingPanel');
  await page.click('#accountingPanel button[data-range="all"]');
  await expect(page.locator('#acctDupWrap .acctDupRow')).toHaveCount(2, { timeout: 20000 });
  const txt = await page.locator('#acctDupWrap').innerText();
  expect(txt).toContain('Purchase order __proto__ — logged 2 times');
  expect(txt).toContain('Purchase order PO-1 — logged 2 times');
  expect(txt).not.toContain('constructor');
  expect(pageErrors.filter(e => /push|not a function/i.test(e))).toEqual([]);
});

test('Tax Records: an order line whose SKU is named like a built-in property is "unmatched", not a broken cost', async ({ page, backend }) => {
  backend.tables.orders = [{ id: 'ord-sku-1', order_number: 'ORD-SKU-1', total: '50.00', tax_total: '0', currency: 'USD', status: 'paid', placed_at: when, deleted_at: null,
    source: 'shopify', raw_data: null, customer_name: 'SYNTHETIC', created_at: when }];
  backend.tables.order_items = ['constructor', 'toString', '__proto__', 'SYN-A'].map((sku, i) => ({ id: 'li-sku-' + i, order_id: 'ord-sku-1', sku, quantity: 2, product_name: 'SYNTHETIC', unit_price: 1, line_total: 2 }));
  backend.tables.products = [{ id: 'prod-sku-a', name: 'SYNTHETIC A', sku: 'SYN-A', cost: '1.50', is_active: true }];
  backend.tables.expenses = [];
  await login(page);
  await gotoPage(page, 'taxRecordsPanel');
  await page.click('#taxRecordsPanel button[data-range="all"]');
  await expect.poll(async () => (await page.locator('#taxCogsWrap .stat .num').allTextContents()).slice(0, 2), { timeout: 20000 }).toEqual(['$3.00', '6']);
});

test('stored values carrying "__proto__" / "constructor" keys change nothing outside themselves', async ({ page, backend, pageErrors }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('he.attnSeen', '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}}}');
      localStorage.setItem('he_open_groups', '{"__proto__":["x"]}');
      localStorage.setItem('he_pinned_pages', '["__proto__","constructor","toString"]');
    } catch (e) {}
  });
  await login(page);
  await gotoPage(page, 'tasksPanel');
  const r = await page.evaluate(() => ({ a: ({}).polluted, b: ({}).polluted2, c: Object.prototype.hasOwnProperty('polluted'), d: typeof Object.prototype.toString }));
  expect(r).toEqual({ a: undefined, b: undefined, c: false, d: 'function' });
  expect(pageErrors).toEqual([]);
});
