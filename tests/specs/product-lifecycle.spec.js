// Product delete safety beyond the database's foreign keys (2026-10-06,
// EXT3 workstream 10; docs/ops/PRODUCT_LIFECYCLE_REVIEW.md).
//
// Order lines name the product by SKU text, not by a database link, so
// nothing in the database stops deleting a product that was sold. Quality
// checks also point at products. The page now refuses both, before touching
// anything, and the stock row is never removed.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'delete logic; run once'); });

const destructive = backend => backend.tableWrites().filter(r => ['DELETE', 'PATCH', 'POST'].includes(r.method) && ['products', 'inventory'].includes(r.table));

function seed(backend, extra = {}) {
  Object.assign(backend.tables, {
    products: [{ id: 'prod-x', name: 'SYNTHETIC unused-looking product', sku: 'SYN-X', is_active: true, status: 'draft', cost: null, retail_price: null, wholesale_price: null, packaging_info: null }],
    inventory: [{ product_id: 'prod-x', available: 0, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null }],
    purchase_order_items: [], inventory_lots: [], inventory_adjustments: [], recalls: [], quality_checks: [], order_items: [],
    ...extra,
  });
  enableWrites(backend, ['products', 'inventory']);
}
async function pressDelete(page) {
  await gotoPage(page, 'inventoryPanel');
  await page.waitForLoadState('networkidle');
  const row = page.locator('#inventoryWrap [data-product-id="prod-x"]');
  await row.locator('.editProductBtn').click();
  await row.locator('.deleteProductBtn').click();
  await row.locator('.deleteProductBtn').click(); // second press
}

test('a product that was sold (order lines use its SKU, any letter case) is not deleted', async ({ page, backend }) => {
  seed(backend, { order_items: [{ id: 'oi-1', order_id: 'o-1', sku: 'syn-x', product_name: 'SYNTHETIC', quantity: 1 }] });
  await login(page);
  await pressDelete(page);
  await expect(page.locator('#dashError')).toContainText('already been sold');
  expect(destructive(backend)).toEqual([]);
  expect(backend.tables.products).toHaveLength(1);
  expect(backend.tables.inventory).toHaveLength(1);
});

test('a product with a quality check is not deleted', async ({ page, backend }) => {
  seed(backend, { quality_checks: [{ id: 'qc-1', product_id: 'prod-x', lot_id: null, check_type: 'visual', result: 'pass' }] });
  await login(page);
  await pressDelete(page);
  await expect(page.locator('#dashError')).toContainText('a quality check');
  expect(destructive(backend)).toEqual([]);
});

test('an SKU with wildcard characters only matches itself (A_1 does not match AB1)', async ({ page, backend }) => {
  seed(backend, { order_items: [{ id: 'oi-1', order_id: 'o-1', sku: 'SYNAB1', product_name: 'SYNTHETIC other', quantity: 1 }] });
  backend.tables.products[0].sku = 'SYNA_1';
  await login(page);
  await pressDelete(page);
  await expect.poll(() => backend.tables.products.length).toBe(0); // never sold → deleted
});

test('a truly unused product is still deleted, with its all-zero stock row', async ({ page, backend }) => {
  seed(backend);
  await login(page);
  await pressDelete(page);
  await expect.poll(() => backend.tables.products.length).toBe(0);
  expect(backend.tables.inventory).toHaveLength(0);
});
