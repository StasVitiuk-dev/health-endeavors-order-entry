// EXT10b (missions 115-118, 237-238): a larger catalogue and history. Pick-
// lists must offer every product / supplier even past the database's per-
// reply row cap (imitated at 100 rows here), and big lists that show only the
// newest rows must say so. Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'scale; run once'); });

function seed(backend) {
  backend.maxRows = 100;
  backend.tables.products = Array.from({ length: 300 }, (_, i) => ({ id: 'p-' + String(i).padStart(4, '0'), name: 'SYNTHETIC Product ' + String(i).padStart(3, '0'), sku: 'SYN-' + i,
    is_active: true, status: 'active', cost: 1, retail_price: 2, wholesale_price: 1.5, packaging_info: null, updated_at: '2026-09-01T00:00:00Z' }));
  backend.tables.suppliers = Array.from({ length: 150 }, (_, i) => ({ id: 's-' + String(i).padStart(4, '0'), name: 'SYNTHETIC Supplier ' + String(i).padStart(3, '0') }));
  backend.tables.purchase_orders = Array.from({ length: 250 }, (_, i) => ({ id: 'po-' + String(i).padStart(4, '0'), po_number: 'PO-SCALE-' + i, supplier_id: null, status: 'draft', currency: 'USD',
    shipping_cost: 0, tax: 0, expense_category: 'ingredients', ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null,
    created_at: new Date(Date.parse('2026-01-01T00:00:00Z') + i * 3600000).toISOString(), deleted_at: null, suppliers: null, purchase_order_items: [] }));
}

test('PO line product list offers all 300 products despite a 100-row reply cap', async ({ page, backend }) => {
  seed(backend);
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  const first = page.locator('.poItem .poRow').first();
  await first.click();
  const o = page.locator('#inspectorOverlay');
  if (await o.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  const opts = page.locator('.poLineProduct option[value^="p-"]');
  await expect(opts).toHaveCount(300);
  // sorted by name
  expect(await opts.first().textContent()).toContain('SYNTHETIC Product 000');
});

test('the purchase-order list says it shows only the newest when more exist', async ({ page, backend }) => {
  seed(backend);
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  await expect(page.locator('#dashError')).toContainText('of 250 purchase orders');
});

test('quality-check product picker and document supplier picker are complete', async ({ page, backend }) => {
  seed(backend);
  await login(page);
  await gotoPage(page, 'qualityControlPanel');
  await expect(page.locator('#qcTarget option[value^="product:"]')).toHaveCount(300);
  await gotoPage(page, 'documentsPanel');
  await expect(page.locator('#docRelated option', { hasText: 'SYNTHETIC Supplier' })).toHaveCount(150);
});
