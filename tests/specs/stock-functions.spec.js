// EXT9: the stock buttons and the all-or-nothing database functions R1–R5.
// Each button uses its function only when its switch (feature_flags row
// stock_fn_*) is on; off, missing or unreadable = today's path. The functions
// are answered by tests/helpers/stock-functions-mock.js, a rule-by-rule copy
// of drafts/10 (the SQL itself is tested on PostgreSQL by local-test/*).
// Synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { installStockFunctions, functionMissing } = require('../helpers/stock-functions-mock');

const A = 'prod-syn-a', B = 'prod-syn-b';
const PO_ID = 'po-fn-1', LOT = 'lot-syn-1', RECALL = 'recall-syn-1', RETURN = 'return-syn-1';

function seed(backend) {
  const inv = (pid, available) => ({ id: 'inv-' + pid, product_id: pid, available, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null });
  const invA = inv(A, 100), invB = inv(B, 0);
  const lot = { id: LOT, product_id: A, lot_number: 'SYN-LOT-1', purchase_order_id: null, quantity_received: 40, quantity_remaining: 40, received_at: '2026-09-01T00:00:00Z', expires_at: null, products: { name: 'SYNTHETIC product A', sku: 'SYN-A' } };
  const items = [
    { id: 'poi-a', purchase_order_id: PO_ID, product_id: A, description: 'SYNTHETIC product A', sku: 'SYN-A', quantity: 50, unit_cost: 2, quantity_received: 0, landed_unit_cost: null },
    { id: 'poi-b', purchase_order_id: PO_ID, product_id: B, description: 'SYNTHETIC product B', sku: 'SYN-B', quantity: 20, unit_cost: 5, quantity_received: 0, landed_unit_cost: null },
  ];
  Object.assign(backend.tables, {
    products: [
      { id: A, name: 'SYNTHETIC product A', sku: 'SYN-A', is_active: true, status: 'active', cost: 2, retail_price: 10, wholesale_price: 6, packaging_info: null, updated_at: '2026-09-01T00:00:00Z', inventory: invA, inventory_lots: [lot] },
      { id: B, name: 'SYNTHETIC product B', sku: 'SYN-B', is_active: true, status: 'active', cost: 5, retail_price: 20, wholesale_price: 12, packaging_info: null, updated_at: '2026-09-01T00:00:00Z', inventory: invB, inventory_lots: [] },
    ],
    inventory: [invA, invB],
    inventory_lots: [lot],
    inventory_adjustments: [],
    quality_checks: [],
    expenses: [],
    suppliers: [{ id: 'sup-1', name: 'SYNTHETIC Supplier Co', is_active: true }],
    purchase_order_items: items,
    purchase_orders: [{
      id: PO_ID, po_number: 'PO-FN-0001', supplier_id: 'sup-1', status: 'shipped', currency: 'USD', shipping_cost: 15, tax: 5, expense_category: 'packaging',
      ordered_at: '2026-09-01T00:00:00Z', expected_at: '2026-09-20', received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z', deleted_at: null,
      suppliers: { name: 'SYNTHETIC Supplier Co' }, purchase_order_items: items,
    }],
    recalls: [{
      id: RECALL, lot_id: LOT, product_id: A, status: 'initiated', severity: 'high', reason: 'SYNTHETIC recall reason',
      quantity_quarantined: null, resolution: null, resolved_at: null, incident_id: null, created_at: '2026-09-20T00:00:00Z',
      products: { name: 'SYNTHETIC product A', sku: 'SYN-A' }, inventory_lots: { lot_number: 'SYN-LOT-1' }, incidents: null,
    }],
    returns: [{
      id: RETURN, order_id: 'order-syn-1', order_item_id: 'oi-syn-1', reason: 'damaged', status: 'approved', product_condition: 'resalable',
      disposition: null, refund_amount: null, approved_at: '2026-09-21T00:00:00Z', received_at: null, refunded_at: null, notes: null,
      created_at: '2026-09-20T00:00:00Z', orders: { order_number: 'SYN-1001', customer_name: 'SYNTHETIC Customer' },
      order_items: { product_name: 'SYNTHETIC product A', sku: 'SYN-A', quantity: 3 },
    }],
    orders: [{ id: 'order-syn-1', order_number: 'SYN-1001', customer_name: 'SYNTHETIC Customer', status: 'paid', total: 30, currency: 'USD', placed_at: '2026-09-19T00:00:00Z', deleted_at: null, created_at: '2026-09-19T00:00:00Z' }],
    order_items: [{ id: 'oi-syn-1', order_id: 'order-syn-1', sku: 'SYN-A', product_name: 'SYNTHETIC product A', quantity: 3, unit_price: 10, line_total: 30 }],
  });
  enableWrites(backend, ['inventory', 'inventory_adjustments', 'inventory_lots', 'products', 'expenses']);
}
const switchOn = (backend, ...keys) => {
  backend.tables.feature_flags = (backend.tables.feature_flags || []).filter(f => !keys.includes(f.flag_key))
    .concat(keys.map((k, i) => ({ id: 'ff-fn-' + i, flag_key: k, label: k, description: 'SYNTHETIC', enabled: true })));
};
const invOf = (backend, pid) => backend.tables.inventory.find(r => r.product_id === pid);
const adj = backend => backend.tables.inventory_adjustments.map(a => `${a.bucket}:${a.change_amount}`);
// Writes the page sent straight to the stock tables (must be none on the function path).
const directStockWrites = backend => backend.tableWrites().filter(r => ['inventory', 'inventory_adjustments', 'inventory_lots', 'expenses', 'purchase_order_items', 'recalls', 'returns'].includes(r.table)
  || (r.table === 'purchase_orders' && r.method !== 'GET') || (r.table === 'products' && r.method === 'DELETE'));

async function closeInspectorIfOpen(page) {
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}
async function openPo(page) {
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.locator(`.poItem[data-id="${PO_ID}"] .poRow`).click();
  await closeInspectorIfOpen(page);
  await expect(page.locator('.poReceiveBtn')).toBeVisible();
  await page.waitForLoadState('networkidle');
}
async function receive(page) {
  await page.locator('.poReceiveBtn').click();
  await page.locator('.poReceiveBtn').click(); // second, deliberate press
}

test.beforeEach(({ backend }) => { seed(backend); installStockFunctions(backend); backend.allowUnguardedState = true; });

test.describe('switch off (the default): today\'s path, no function is called', () => {
  test('receive with no switch row uses the browser path', async ({ page, backend }) => {
    await login(page);
    await openPo(page);
    await receive(page);
    await expect.poll(() => backend.tables.purchase_orders[0].status).toBe('received');
    await expect.poll(() => invOf(backend, A).available).toBe(150);
    expect(backend.stockFunctionCalls).toEqual([]);
    expect(backend.requests.filter(r => ['receive_purchase_order', 'adjust_inventory', 'quarantine_recall', 'receive_return', 'delete_unused_product'].includes(r.rpc))).toEqual([]);
  });

  test('a switch that cannot be read means today\'s path (never a half-switched button)', async ({ page, backend }) => {
    switchOn(backend, 'stock_fn_adjust');
    await page.context().route(/\/rest\/v1\/feature_flags\?.*flag_key=eq\.stock_fn_/, r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"synthetic"}' }));
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await page.selectOption('#invProduct', A);
    await page.selectOption('#invBucket', 'available');
    await page.fill('#invAmount', '7');
    await page.click('#adjustInventoryForm button[type=submit]');
    await expect.poll(() => invOf(backend, A).available).toBe(107);
    expect(backend.stockFunctionCalls).toEqual([]);
  });
});

test.describe('R1 receive_purchase_order (switch on)', () => {
  test.beforeEach(({ backend }) => switchOn(backend, 'stock_fn_receive_po'));

  test('one call does everything: stock, lots, history, one expense, status; nothing written from the browser', async ({ page, backend }) => {
    await login(page);
    await openPo(page);
    await page.fill('.poLineLot[data-line="poi-a"]', 'LOT-77');
    await receive(page);
    await expect(page.locator('.toast').last()).toContainText('Received — 2 items added to Inventory');
    expect(backend.stockFunctionCalls.map(c => c.name)).toEqual(['receive_purchase_order']);
    const call = backend.stockFunctionCalls[0].body;
    expect(call.p_po_id).toBe(PO_ID);
    expect(call.p_lots).toEqual([{ line_id: 'poi-a', lot_number: 'LOT-77' }]);
    expect(call.p_expense_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(invOf(backend, A).available).toBe(150);
    expect(invOf(backend, B).available).toBe(20);
    expect(backend.tables.expenses).toHaveLength(1);
    expect(backend.tables.expenses[0]).toMatchObject({ amount: 220, note: 'Purchase order PO-FN-0001', category: 'packaging' });
    expect(backend.tables.inventory_lots.find(l => l.lot_number === 'LOT-77')).toMatchObject({ quantity_received: 50, product_id: A });
    expect(backend.tables.purchase_orders[0].status).toBe('received');
    expect(directStockWrites(backend)).toEqual([]);
  });

  test('a failure part-way changes nothing, says so, and the order stays receivable', async ({ page, backend }) => {
    installStockFunctions(backend, { failAt: 'after_first_stock' });
    await login(page);
    await openPo(page);
    await receive(page);
    await expect(page.locator('#dashError')).toContainText('Could not receive purchase order PO-FN-0001');
    expect(invOf(backend, A).available).toBe(100);
    expect(invOf(backend, B).available).toBe(0);
    expect(backend.tables.expenses).toHaveLength(0);
    expect(adj(backend)).toEqual([]);
    expect(backend.tables.purchase_orders[0].status).toBe('shipped');
    await expect(page.locator('.poReceiveBtn')).toBeVisible();
  });

  test('a lost reply: the page says it cannot tell and that retrying is safe; the retry adds nothing', async ({ page, backend }) => {
    await login(page);
    await openPo(page);
    let first = true;
    await page.context().route(/\/rest\/v1\/rpc\/receive_purchase_order/, async route => {
      if (!first) return backend.handle(route);
      first = false;
      await backend.handle({ request: () => route.request(), fulfill: async () => {} }); // applied, reply lost
      return route.abort('connectionreset');
    });
    await receive(page);
    await expect(page.locator('#dashError')).toContainText('cannot tell whether the delivery happened');
    await expect(page.locator('#dashError')).toContainText('trying again is safe');
    expect(invOf(backend, A).available).toBe(150);
    // A second tab still showing the order presses Receive: "already received", nothing doubled.
    const r = await page.evaluate(async id => {
      const res = await window.fetch('https://uizrazyehilyzmwttsrn.supabase.co/rest/v1/rpc/receive_purchase_order', { method: 'POST', headers: { 'content-type': 'application/json', apikey: 'x' }, body: JSON.stringify({ p_po_id: id }) });
      return res.json();
    }, PO_ID);
    expect(r).toEqual({ already_received: true, po_number: 'PO-FN-0001' });
    expect(invOf(backend, A).available).toBe(150);
    expect(backend.tables.expenses).toHaveLength(1);
  });

  test('switched on but not installed: plain message, nothing changed, no fallback writes', async ({ page, backend }) => {
    backend.rpc.receive_purchase_order = functionMissing();
    await login(page);
    await openPo(page);
    await receive(page);
    await expect(page.locator('#dashError')).toContainText('is switched on but is not installed, so nothing was changed');
    expect(invOf(backend, A).available).toBe(100);
    expect(backend.tables.purchase_orders[0].status).toBe('shipped');
    expect(directStockWrites(backend)).toEqual([]);
  });

  test('a refusal from the database (cancelled meanwhile) is shown as "nothing was changed"', async ({ page, backend }) => {
    await login(page);
    await openPo(page);
    backend.tables.purchase_orders[0].status = 'cancelled'; // another tab
    await receive(page);
    await expect(page.locator('#dashError')).toContainText('Nothing was changed: Purchase order PO-FN-0001 is "cancelled"');
    expect(invOf(backend, A).available).toBe(100);
  });
});

test.describe('R4 adjust_inventory (switch on)', () => {
  test.beforeEach(async ({ page, backend }) => {
    switchOn(backend, 'stock_fn_adjust');
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await page.waitForLoadState('networkidle');
  });
  async function adjust(page, amount) {
    await page.selectOption('#invProduct', A);
    await page.selectOption('#invBucket', 'available');
    await page.fill('#invAmount', String(amount));
    await page.click('#adjustInventoryForm button[type=submit]');
  }

  test('stock and history in one call, with the number the page showed', async ({ page, backend }) => {
    await adjust(page, 7);
    await expect.poll(() => invOf(backend, A).available).toBe(107);
    expect(adj(backend)).toEqual(['available:7']);
    expect(backend.stockFunctionCalls[0].body).toMatchObject({ p_product_id: A, p_bucket: 'available', p_change: 7, p_expected: 100 });
    expect(directStockWrites(backend)).toEqual([]);
  });

  test('a change saved elsewhere since the page loaded is refused, not applied on top', async ({ page, backend }) => {
    invOf(backend, A).available = 130; // a delivery landed in another tab
    await adjust(page, -10);
    await expect(page.locator('#dashError')).toContainText('This stock changed since the page loaded, so nothing was changed');
    expect(invOf(backend, A).available).toBe(130);
    expect(adj(backend)).toEqual([]);
  });

  test('below zero is refused inside the database; nothing changes', async ({ page, backend }) => {
    await adjust(page, -101);
    await expect(page.locator('#dashError')).toContainText('That would leave Available at -1');
    expect(invOf(backend, A).available).toBe(100);
  });

  test('a lost reply never invites a blind retry (the adjustment is not repeat-safe)', async ({ page, backend }) => {
    await page.context().route(/\/rest\/v1\/rpc\/adjust_inventory/, async route => {
      await backend.handle({ request: () => route.request(), fulfill: async () => {} });
      return route.abort('connectionreset');
    });
    await adjust(page, 7);
    await expect(page.locator('#dashError')).toContainText('check the stock and its history before trying again');
    await expect(page.locator('#dashError')).not.toContainText('trying again is safe');
  });
});

test.describe('R2 quarantine_recall, R3 receive_return, R5 delete_unused_product (switch on)', () => {
  test('recall: both buckets and the status in one call; a second press moves nothing', async ({ page, backend }) => {
    switchOn(backend, 'stock_fn_recall');
    await login(page);
    await gotoPage(page, 'recallsPanel');
    await page.waitForLoadState('networkidle');
    await page.click('.recallQuarantineBtn');
    await expect.poll(() => backend.tables.recalls[0].status).toBe('quarantined');
    expect(invOf(backend, A)).toMatchObject({ available: 60, recalled: 40 });
    expect(adj(backend)).toEqual(['available:-40', 'recalled:40']);
    expect(directStockWrites(backend)).toEqual([]);
    const again = await page.evaluate(async id => (await window.fetch('https://uizrazyehilyzmwttsrn.supabase.co/rest/v1/rpc/quarantine_recall', { method: 'POST', headers: { 'content-type': 'application/json', apikey: 'x' }, body: JSON.stringify({ p_recall_id: id }) })).json(), RECALL);
    expect(again.already_done).toBe(true);
    expect(invOf(backend, A)).toMatchObject({ available: 60, recalled: 40 });
  });

  test('return: received and restocked in one call; the whole line (partial returns wait on D-ops-5)', async ({ page, backend }) => {
    switchOn(backend, 'stock_fn_return');
    await login(page);
    await gotoPage(page, 'returnsPanel');
    await closeInspectorIfOpen(page);
    await page.waitForLoadState('networkidle');
    await page.selectOption('.dispositionSelect', 'restock_available');
    await page.click('.markReceivedBtn');
    await expect.poll(() => backend.tables.returns[0].status).toBe('received');
    expect(invOf(backend, A).available).toBe(103);
    expect(backend.stockFunctionCalls[0].body).toEqual({ p_return_id: RETURN, p_disposition: 'restock_available', p_quantity: null });
    expect(directStockWrites(backend)).toEqual([]);
  });

  test('delete: a product with stock is refused by the function and keeps its stock row', async ({ page, backend }) => {
    switchOn(backend, 'stock_fn_delete_product');
    backend.tables.inventory_lots = []; backend.tables.recalls = [];
    backend.tables.purchase_order_items = []; backend.tables.purchase_orders[0].purchase_order_items = [];
    backend.tables.order_items = []; // never sold, never used: only the stock stands in the way
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await closeInspectorIfOpen(page);
    await page.locator('.editProductBtn').first().click();
    await page.locator('.deleteProductBtn').first().click();
    await page.locator('.deleteProductBtn').first().click();
    await expect(page.locator('#dashError')).toContainText('still has stock (100 units in total)');
    expect(backend.tables.products).toHaveLength(2);
    expect(backend.tables.inventory).toHaveLength(2);
  });

  test('delete: an unused, empty product is deleted in one call', async ({ page, backend }) => {
    switchOn(backend, 'stock_fn_delete_product');
    backend.tables.purchase_order_items = []; backend.tables.purchase_orders[0].purchase_order_items = [];
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await closeInspectorIfOpen(page);
    const rowB = page.locator('[data-product-id="' + B + '"]');
    await rowB.locator('.editProductBtn').click();
    await rowB.locator('.deleteProductBtn').click();
    await rowB.locator('.deleteProductBtn').click();
    await expect.poll(() => backend.tables.products.map(p => p.id)).toEqual([A]);
    expect(backend.stockFunctionCalls.map(c => c.name)).toEqual(['delete_unused_product']);
  });
});

test.describe('Feature Switches: a stock switch cannot be turned on before its function exists', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'page logic; run once'); });
  const addOff = backend => { backend.tables.feature_flags = [{ id: 'ff-fn-r1', flag_key: 'stock_fn_receive_po', label: 'Stock: all-or-nothing receive', description: 'SYNTHETIC', enabled: false }]; };

  test('not installed: left off, plain reason, no password asked, nothing written', async ({ page, backend }) => {
    addOff(backend);
    backend.rpc.receive_purchase_order = functionMissing();
    await login(page);
    await gotoPage(page, 'flagsPanel');
    await page.locator('.flagRow[data-key="stock_fn_receive_po"] .slider').click();
    await expect(page.locator('#dashError')).toContainText('its database function (receive_purchase_order) is not installed yet');
    await expect(page.locator('#reauthOverlay')).toBeHidden();
    await expect(page.locator('.flagRow[data-key="stock_fn_receive_po"] .flagToggle')).not.toBeChecked();
    expect(backend.tableWrites().filter(w => w.table === 'feature_flags')).toEqual([]);
  });

  test('installed: the harmless check changes nothing, then the password is asked as for any switch', async ({ page, backend }) => {
    addOff(backend);
    await login(page);
    await gotoPage(page, 'flagsPanel');
    const before = JSON.stringify([backend.tables.inventory, backend.tables.expenses, backend.tables.purchase_orders]);
    await page.locator('.flagRow[data-key="stock_fn_receive_po"] .slider').click();
    await expect(page.locator('#reauthOverlay')).toBeVisible();
    expect(backend.stockFunctionCalls.map(c => c.name)).toEqual(['receive_purchase_order']);
    expect(JSON.stringify([backend.tables.inventory, backend.tables.expenses, backend.tables.purchase_orders])).toBe(before);
  });

  test('every probe is refused by the real functions\' first check (never reaches a write)', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'owner-login.html'), 'utf8');
    expect(src).toContain("p_lots: 'not-a-list'");          // R1: "Lot details must be a list" (first statement)
    expect(src).toContain("p_disposition: '' }");            // R3: "Pick what happens…" (first statement)
    expect(src).toContain("p_bucket: 'available', p_change: 0 }"); // R4: product check, then non-zero check; zero id = no product
    const sql = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'docs', 'ops', 'sql', 'drafts', '10_DRAFT_stock_functions.sql'), 'utf8');
    const r1 = sql.slice(sql.indexOf('function public.receive_purchase_order('));
    expect(r1.indexOf("Lot details must be a list.")).toBeLessThan(r1.indexOf('for update'));
    const r3 = sql.slice(sql.indexOf('function public.receive_return('));
    expect(r3.indexOf('Pick what happens to the stock')).toBeLessThan(r3.indexOf('for update'));
  });
});
