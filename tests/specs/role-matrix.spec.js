// Role matrix (2026-10-06, EXT3 workstream 7).
//
// The stock tables are Owner/Administrator only in the real database (Query
// A). The dashboard mirrors that rule (canChangeStock) so an employee is told
// "only the Owner or an Administrator" BEFORE anything is sent, instead of
// getting a half-finished workflow or a confusing refusal. Unknown roles are
// treated like an employee (deny by default).
//
// Non-stock admin actions (flags, system mode, rules, approvals, documents)
// rely on the database's refusal; fault-injection.spec.js proves the page
// turns a refusal into plain words with no false success.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'role logic; run once'); });

const ROLES = { owner: true, administrator: true, employee: false, contractor: false /* unknown role */ };
const STOCK_TABLES = ['inventory', 'inventory_adjustments', 'inventory_lots', 'purchase_orders', 'purchase_order_items', 'recalls', 'expenses', 'products'];
const stockWrites = backend => backend.tableWrites().filter(r => STOCK_TABLES.includes(r.table));
const REFUSAL = 'Only the Owner or an Administrator';

async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}

function seed(backend, role) {
  const items = [{ id: 'line-a', purchase_order_id: 'po-1', product_id: 'prod-a', description: 'SYNTHETIC A', sku: 'SYN-A', quantity: 10, unit_cost: 2, quantity_received: 0, landed_unit_cost: null }];
  Object.assign(backend.tables, {
    products: [
      { id: 'prod-a', name: 'SYNTHETIC A', sku: 'SYN-A', is_active: true, status: 'active', cost: 1, retail_price: 2, wholesale_price: 1, packaging_info: null },
      { id: 'prod-new', name: 'SYNTHETIC typo product', sku: 'SYN-TYPO', is_active: true, status: 'draft', cost: null, retail_price: null, wholesale_price: null, packaging_info: null },
    ],
    inventory: [
      { product_id: 'prod-a', available: 5, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null },
      { product_id: 'prod-new', available: 0, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null },
    ],
    purchase_order_items: items,
    purchase_orders: [{ id: 'po-1', po_number: 'PO-1', supplier_id: 'sup-1', status: 'shipped', currency: 'USD', shipping_cost: 0, tax: 0, expense_category: 'packaging', ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z', deleted_at: null, suppliers: { name: 'SYNTHETIC' }, purchase_order_items: items }],
    suppliers: [{ id: 'sup-1', name: 'SYNTHETIC', supplier_type: 'manufacturer', contact_name: null, email: null, phone: null, notes: null, is_active: true }],
    inventory_adjustments: [], inventory_lots: [], expenses: [], order_items: [], quality_checks: [], recalls: [],
  });
  backend.tables.profiles[0].role = role;
  enableWrites(backend, ['inventory', 'inventory_adjustments', 'expenses', 'products']);
}

const ACTIONS = {
  'manual stock adjustment': async page => {
    await open(page, 'inventoryPanel');
    await page.selectOption('#invProduct', 'prod-a');
    await page.selectOption('#invBucket', 'available');
    await page.fill('#invAmount', '2');
    await page.click('#adjustInventoryForm button[type=submit]');
  },
  'low-stock threshold': async page => {
    await open(page, 'inventoryPanel');
    const row = page.locator('#inventoryWrap [data-product-id="prod-a"]');
    await row.locator('.invThresholdInput').fill('3');
    await row.locator('.saveThresholdBtn').click();
  },
  'receive delivery': async page => {
    await open(page, 'purchaseOrdersPanel');
    await page.locator('.poItem[data-id="po-1"] .poRow').click();
    if (await page.locator('#inspectorOverlay').evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
    const btn = page.locator('#poDetail_po-1 .poReceiveBtn');
    await btn.click();
    if (await btn.count() && /Really|Confirm/i.test(await btn.textContent())) await btn.click(); // second press
  },
  'delete an unused product': async page => {
    await open(page, 'inventoryPanel');
    const row = page.locator('#inventoryWrap [data-product-id="prod-new"]');
    await row.locator('.editProductBtn').click();
    await row.locator('.deleteProductBtn').click();
    await row.locator('.deleteProductBtn').click(); // second press
  },
};

for (const [role, allowed] of Object.entries(ROLES)) {
  for (const [name, act] of Object.entries(ACTIONS)) {
    test(`${role}: ${name} — ${allowed ? 'allowed' : 'refused before anything is sent'}`, async ({ page, backend }) => {
      seed(backend, role);
      page.on('dialog', d => d.accept());
      await login(page);
      await act(page);
      if (allowed) {
        await expect.poll(() => stockWrites(backend).length, { message: 'a stock write was sent' }).toBeGreaterThan(0);
        await expect(page.locator('#dashError')).not.toContainText(REFUSAL);
      } else {
        await expect(page.locator('#dashError')).toContainText(REFUSAL);
        await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);
        expect(stockWrites(backend), 'nothing sent').toEqual([]);
      }
    });
  }
}
