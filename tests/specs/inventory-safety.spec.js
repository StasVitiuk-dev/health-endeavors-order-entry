// Inventory safety: recalls, manual stock adjustments, returns, product delete.
//
// All of these change stock by reading the number into the browser, doing
// the arithmetic there, and writing the new total back, as separate
// requests. The tests below show, with synthetic data, what happens when:
//   - someone else changes the same stock in between (lost update),
//   - the connection drops halfway (half-saved),
//   - the button is pressed again after an error (double-counting).
//
// Since 2026-10-05 the dashboard (1) writes stock with compare-and-set, so a
// concurrent change is never overwritten and the below-zero check uses fresh
// numbers, and (2) claims the recall/return first (a conditional status
// change), so a retry, double click or stale tab never moves stock twice.
// What is still missing is all-or-nothing: stock and its history are two
// writes. Those "wanted" tests stay test.fail() until the R2/R3/R4 database
// functions are installed (drafts ready and tested; waiting for Query C and owner approval).
// Purchase-order receiving is covered in po-receive.spec.js.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

const A = 'prod-syn-a';
const LOT = 'lot-syn-1';
const RECALL = 'recall-syn-1';
const RETURN = 'return-syn-1';

function seed(backend) {
  const invA = { product_id: A, available: 100, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null };
  const lot = { id: LOT, product_id: A, lot_number: 'SYN-LOT-1', purchase_order_id: null, quantity_received: 40, quantity_remaining: 40, received_at: '2026-09-01T00:00:00Z', expires_at: null, products: { name: 'SYNTHETIC product A', sku: 'SYN-A' } };
  Object.assign(backend.tables, {
    products: [{ id: A, name: 'SYNTHETIC product A', sku: 'SYN-A', is_active: true, status: 'active', cost: 2, retail_price: 10, wholesale_price: 6, packaging_info: null, inventory: invA, inventory_lots: [lot] }],
    inventory: [invA],
    inventory_lots: [lot],
    inventory_adjustments: [],
    quality_checks: [],
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
    orders: [],
  });
  enableWrites(backend, ['inventory', 'inventory_adjustments', 'inventory_lots', 'products']);
}

const inv = backend => backend.tables.inventory.find(r => r.product_id === A);
const adjustments = backend => backend.tables.inventory_adjustments.map(a => `${a.bucket}:${a.change_amount}`);

async function closeInspectorIfOpen(page) {
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}

async function openPanel(page, id, readySelector) {
  await gotoPage(page, id);
  await expect(page.locator(readySelector).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function expectError(page, text) {
  await expect(page.locator('#dashError')).toContainText(text);
}

test.beforeEach(async ({ page, backend }) => {
  seed(backend);
  await login(page);
});

// ---------------------------------------------------------------- recalls
test.describe('recall quarantine', () => {
  test.beforeEach(async ({ page }) => { await openPanel(page, 'recallsPanel', '.recallQuarantineBtn'); });

  test('baseline: moves the lot quantity from Available to Recalled, once', async ({ page, backend }) => {
    await page.click('.recallQuarantineBtn');
    await expect.poll(() => adjustments(backend)).toEqual(['available:-40', 'recalled:40']);
    expect(inv(backend)).toMatchObject({ available: 60, recalled: 40 });
    expect(backend.tables.recalls[0].status).toBe('quarantined');
  });

  test('a stock change by someone else in between is kept (compare-and-set)', async ({ page, backend }) => {
    // While the page is working out the new numbers, 25 units are sold.
    backend.beforeNext('inventory', 'PATCH', t => { t.inventory[0].available -= 25; });
    await page.click('.recallQuarantineBtn');
    await expect.poll(() => adjustments(backend).length).toBe(2);
    expect(inv(backend)).toMatchObject({ available: 35, recalled: 40 }); // 100 - 25 - 40
  });

  test('the recall is claimed first: a dropped claim changes nothing, and a retry quarantines once', async ({ page, backend }) => {
    backend.dropNext('recalls', 'PATCH');
    await page.click('.recallQuarantineBtn');
    await expectError(page, 'nothing was changed');
    expect(inv(backend)).toMatchObject({ available: 100, recalled: 0 });
    expect(backend.tables.recalls[0].status).toBe('initiated');
    await page.click('.recallQuarantineBtn');
    await expect.poll(() => adjustments(backend)).toEqual(['available:-40', 'recalled:40']);
    expect(inv(backend)).toMatchObject({ available: 60, recalled: 40 });
  });

  test('a second tab cannot quarantine the same recall again', async ({ page, backend }) => {
    backend.tables.recalls[0].status = 'quarantined'; // done in another tab
    await page.click('.recallQuarantineBtn');
    await expectError(page, 'already changed');
    expect(inv(backend)).toMatchObject({ available: 100, recalled: 0 });
    expect(adjustments(backend)).toEqual([]);
  });

  test('current behaviour: a drop on the history write leaves stock moved without history, and says so', async ({ page, backend }) => {
    backend.dropNext('inventory_adjustments', 'POST');
    await page.click('.recallQuarantineBtn');
    await expectError(page, 'marked Quarantined, but moving the stock did not finish');
    expect(inv(backend)).toMatchObject({ available: 60, recalled: 40 });
    expect(adjustments(backend)).toEqual([]);
    expect(backend.tables.recalls[0].status).toBe('quarantined');
  });

  test('current behaviour: the lot\'s own remaining count is not reduced', async ({ page, backend }) => {
    await page.click('.recallQuarantineBtn');
    await expect.poll(() => adjustments(backend).length).toBe(2);
    expect(backend.tables.inventory_lots[0].quantity_remaining).toBe(40);
  });

  test('wanted: stock, history and recall status are saved together or not at all', async ({ page, backend }) => {
    test.fail(true, 'Quarantine is not atomic yet: needs quarantine_recall (R2), drafted and tested; waits for Query C, owner approval and install (docs/ops/R1-R5-INSTALL-RUNBOOK.md)');
    backend.dropNext('inventory_adjustments', 'POST');
    await page.click('.recallQuarantineBtn');
    await expectError(page, 'did not finish');
    expect(inv(backend)).toMatchObject({ available: 100, recalled: 0 });
  });
});

// ------------------------------------------------------ manual adjustments
test.describe('manual stock adjustment', () => {
  test.beforeEach(async ({ page }) => { await openPanel(page, 'inventoryPanel', '#adjustInventoryForm'); });

  async function adjust(page, amount) {
    await page.selectOption('#invProduct', A);
    await page.selectOption('#invBucket', 'available');
    await page.fill('#invAmount', String(amount));
    await page.click('#adjustInventoryForm button[type=submit]');
  }

  test('baseline: adds the amount and logs one adjustment', async ({ page, backend }) => {
    await adjust(page, 7);
    await expect.poll(() => adjustments(backend)).toEqual(['available:7']);
    expect(inv(backend).available).toBe(107);
  });

  test('a concurrent change is kept, not overwritten (compare-and-set)', async ({ page, backend }) => {
    backend.beforeNext('inventory', 'PATCH', t => { t.inventory[0].available += 50; }); // another delivery lands
    await adjust(page, -10);
    await expect.poll(() => adjustments(backend).length).toBe(1);
    expect(inv(backend).available).toBe(140); // 100 + 50 - 10
  });

  test('the "can\'t go below zero" check uses fresh numbers and refuses', async ({ page, backend }) => {
    backend.beforeNext('inventory', 'PATCH', t => { t.inventory[0].available = 5; }); // 95 sold meanwhile
    await adjust(page, -60);
    await expectError(page, 'only 5 available in that bucket right now');
    expect(inv(backend).available).toBe(5);
    expect(adjustments(backend)).toEqual([]);
  });

  test('a drop after the stock saved says it may or may not have been saved (no blind "try again")', async ({ page, backend }) => {
    backend.dropNext('inventory_adjustments', 'POST');
    await adjust(page, 7);
    await expectError(page, 'may or may not have been saved');
    expect(inv(backend).available).toBe(107);
    expect(adjustments(backend)).toEqual([]);
  });

  test('wanted: stock and its history are saved together or not at all', async ({ page, backend }) => {
    test.fail(true, 'Manual adjustment is not atomic yet: needs adjust_inventory (R4), drafted and tested; waits for Query C, owner approval and install (docs/ops/R1-R5-INSTALL-RUNBOOK.md)');
    backend.dropNext('inventory_adjustments', 'POST');
    await adjust(page, 7);
    await expectError(page, 'may or may not have been saved');
    expect(inv(backend).available).toBe(100);
  });
});

// --------------------------------------------------------------- returns
test.describe('return restock', () => {
  test.beforeEach(async ({ page }) => {
    await openPanel(page, 'returnsPanel', '.markReceivedBtn');
    await closeInspectorIfOpen(page);
  });

  async function markReceived(page) {
    await page.selectOption('.dispositionSelect', 'restock_available');
    await page.click('.markReceivedBtn');
  }

  test('baseline: restocks the returned quantity once', async ({ page, backend }) => {
    await markReceived(page);
    await expect.poll(() => adjustments(backend)).toEqual(['available:3']);
    expect(inv(backend).available).toBe(103);
    expect(backend.tables.returns[0].status).toBe('received');
  });

  test('the return is claimed first: a dropped claim changes nothing, and a retry restocks once', async ({ page, backend }) => {
    backend.dropNext('returns', 'PATCH');
    await markReceived(page);
    await expectError(page, 'nothing was changed');
    expect(inv(backend).available).toBe(100);
    expect(backend.tables.returns[0].status).toBe('approved');
    await page.click('.markReceivedBtn');
    await expect.poll(() => adjustments(backend)).toEqual(['available:3']);
    expect(inv(backend).available).toBe(103);
  });

  test('a concurrent change is kept (compare-and-set)', async ({ page, backend }) => {
    backend.beforeNext('inventory', 'PATCH', t => { t.inventory[0].available -= 30; });
    await markReceived(page);
    await expect.poll(() => adjustments(backend).length).toBe(1);
    expect(inv(backend).available).toBe(73);
  });

  test('a second open tab cannot restock the same return again', async ({ page, backend }) => {
    // The first tab finished; this tab still shows the return as "approved".
    backend.tables.returns[0].status = 'received';
    await markReceived(page);
    await expectError(page, 'already changed');
    expect(inv(backend).available).toBe(100);
    const patch = backend.requests.find(r => r.method === 'PATCH' && r.table === 'returns');
    expect(Object.fromEntries(patch.params)).toMatchObject({ status: 'eq.approved' });
  });

  test('wanted: return status, stock and history are saved together or not at all', async ({ page, backend }) => {
    test.fail(true, 'Return restock is not atomic yet: needs receive_return (R3), drafted and tested; waits for Query C, owner approval and install (docs/ops/R1-R5-INSTALL-RUNBOOK.md)');
    backend.dropNext('inventory_adjustments', 'POST');
    await markReceived(page);
    await expectError(page, 'restock did not finish');
    expect(inv(backend).available).toBe(100);
  });
});

// ------------------------------------------------------------ product delete
test.describe('product delete', () => {
  // The shared seed gives product A a lot and a recall, i.e. a product in
  // use, which the real database (and now the page) never deletes. These
  // tests start from a product with no history; the in-use case adds some.
  test.beforeEach(({ backend }) => { backend.tables.inventory_lots = []; backend.tables.recalls = []; });

  async function pressDeleteTwice(page) {
    await openPanel(page, 'inventoryPanel', '.editProductBtn');
    await closeInspectorIfOpen(page);
    await page.click('.editProductBtn');
    await page.click('.deleteProductBtn');
    await page.click('.deleteProductBtn'); // "Really delete?"
  }

  test('a product that still has stock is refused before anything is deleted', async ({ page, backend }) => {
    await pressDeleteTwice(page);
    await expectError(page, 'still has stock (Available: 100)');
    expect(backend.tables.products).toHaveLength(1);
    expect(backend.tables.inventory).toHaveLength(1);
    expect(backend.requests.filter(r => r.method === 'DELETE')).toEqual([]);
  });

  test('if the product delete is refused anyway, its stock row is put back exactly as it was (2026-10-06)', async ({ page, backend }) => {
    Object.assign(inv(backend), { available: 0, low_stock_threshold: 7 });
    backend.failNext('products', 'DELETE', { status: 409, body: { code: '23503', message: 'violates foreign key constraint' } });
    await pressDeleteTwice(page);
    await expectError(page, "can't be deleted because it's already used");
    expect(backend.tables.products).toHaveLength(1);
    // Used to be lost (with its low-stock threshold); now restored.
    expect(backend.tables.inventory).toHaveLength(1);
    expect(inv(backend)).toMatchObject({ available: 0, low_stock_threshold: 7 });
  });

  test('a product that is already used (stock history) is refused before anything is deleted', async ({ page, backend }) => {
    Object.assign(inv(backend), { available: 0 });
    backend.tables.inventory_adjustments.push({ id: 'adj-old', product_id: A, bucket: 'available', change_amount: 5, reason: 'old', created_at: '2026-09-01T00:00:00Z' });
    await pressDeleteTwice(page);
    await expectError(page, "can't be deleted because it's already used");
    expect(backend.requests.filter(r => r.method === 'DELETE')).toEqual([]);
    expect(backend.tables.products).toHaveLength(1);
    expect(backend.tables.inventory).toHaveLength(1);
  });

  test('stock that arrives between the check and the delete is never thrown away', async ({ page, backend }) => {
    Object.assign(inv(backend), { available: 0 });
    backend.beforeNext('inventory', 'DELETE', tables => { tables.inventory.find(r => r.product_id === A).available = 3; });
    await pressDeleteTwice(page);
    await expectError(page, 'changed');
    expect(inv(backend).available).toBe(3);
    expect(backend.tables.products).toHaveLength(1);
    expect(backend.requests.filter(r => r.method === 'DELETE' && r.table === 'products')).toEqual([]);
  });

  test('an employee is told plainly that only the Owner or an Administrator can delete; nothing is sent', async ({ page, backend }) => {
    Object.assign(inv(backend), { available: 0 });
    backend.tables.profiles[0].role = 'employee';
    await page.reload(); // the page reads the signed-in person's role when it loads
    await expect(page.locator('#dash')).toBeVisible();
    // After a reload the background loads restart, so "network idle" (used by
    // openPanel) sometimes never came within the time limit (1 in 30 runs).
    // Wait for the buttons this test needs instead.
    await gotoPage(page, 'inventoryPanel');
    await expect(page.locator('.editProductBtn').first()).toBeVisible();
    await closeInspectorIfOpen(page);
    await page.click('.editProductBtn');
    await page.click('.deleteProductBtn');
    await page.click('.deleteProductBtn'); // "Really delete?"
    await expectError(page, 'Only the Owner or an Administrator can delete a product');
    expect(backend.requests.filter(r => r.method === 'DELETE')).toEqual([]);
  });

  test('an unused zero-stock product is deleted, stock row first, product second', async ({ page, backend }) => {
    Object.assign(inv(backend), { available: 0 });
    await pressDeleteTwice(page);
    await expect.poll(() => backend.tables.products.length).toBe(0);
    expect(backend.tables.inventory).toHaveLength(0);
    const dels = backend.requests.filter(r => r.method === 'DELETE').map(r => r.table);
    expect(dels).toEqual(['inventory', 'products']);
  });
});
