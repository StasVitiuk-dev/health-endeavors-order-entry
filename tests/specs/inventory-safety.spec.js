// Inventory safety: recalls, manual stock adjustments, returns, product delete.
//
// All of these change stock by reading the number into the browser, doing
// the arithmetic there, and writing the new total back, as separate
// requests. The tests below show, with synthetic data, what happens when:
//   - someone else changes the same stock in between (lost update),
//   - the connection drops halfway (half-saved),
//   - the button is pressed again after an error (double-counting).
//
// "current behaviour" tests pin down today's unsafe results (they pass now).
// "wanted" tests are marked test.fail() until the database-side fix lands.
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
      id: RETURN, order_id: 'order-syn-1', order_item_id: 'oi-syn-1', reason: 'damaged', status: 'approved', product_condition: 'unopened',
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
    await expect.poll(() => backend.tables.recalls[0].status).toBe('quarantined');
    expect(inv(backend)).toMatchObject({ available: 60, recalled: 40 });
    expect(adjustments(backend)).toEqual(['available:-40', 'recalled:40']);
  });

  test('current behaviour: a stock change by someone else in between is silently overwritten', async ({ page, backend }) => {
    // While the page is working out the new numbers, 25 units are sold.
    backend.beforeNext('inventory', 'PATCH', t => { t.inventory[0].available -= 25; });
    await page.click('.recallQuarantineBtn');
    await expect.poll(() => backend.tables.recalls[0].status).toBe('quarantined');
    // Correct would be 100 - 25 - 40 = 35. The sale is lost.
    expect(inv(backend).available).toBe(60);
  });

  test('current behaviour: drop after the stock moved leaves the recall "initiated" with no history', async ({ page, backend }) => {
    backend.dropNext('inventory_adjustments', 'POST');
    await page.click('.recallQuarantineBtn');
    await expectError(page, 'Could not quarantine that stock');
    expect(inv(backend)).toMatchObject({ available: 60, recalled: 40 });
    expect(adjustments(backend)).toEqual([]);
    expect(backend.tables.recalls[0].status).toBe('initiated');
  });

  test('current behaviour: pressing Quarantine again after that error quarantines a second time', async ({ page, backend }) => {
    backend.dropNext('recalls', 'PATCH');
    await page.click('.recallQuarantineBtn');
    await expectError(page, 'Could not quarantine that stock');
    await page.click('.recallQuarantineBtn');
    await expect.poll(() => backend.tables.recalls[0].status).toBe('quarantined');
    // 40 units were in the lot; 80 were moved.
    expect(inv(backend)).toMatchObject({ available: 20, recalled: 80 });
    expect(adjustments(backend)).toHaveLength(4);
  });

  test('current behaviour: the lot\'s own remaining count is not reduced', async ({ page, backend }) => {
    await page.click('.recallQuarantineBtn');
    await expect.poll(() => backend.tables.recalls[0].status).toBe('quarantined');
    expect(backend.tables.inventory_lots[0].quantity_remaining).toBe(40);
  });

  test('wanted: a retry after a dropped connection never moves more than the lot holds', async ({ page, backend }) => {
    test.fail(true, 'Quarantine is not atomic yet');
    backend.dropNext('recalls', 'PATCH');
    await page.click('.recallQuarantineBtn');
    await expectError(page, 'Could not quarantine that stock');
    await page.click('.recallQuarantineBtn');
    await expect.poll(() => backend.tables.recalls[0].status).toBe('quarantined');
    expect(inv(backend)).toMatchObject({ available: 60, recalled: 40 });
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

  test('current behaviour: a concurrent change is overwritten (lost update)', async ({ page, backend }) => {
    backend.beforeNext('inventory', 'POST', t => { t.inventory[0].available += 50; }); // another delivery lands
    await adjust(page, -10);
    await expect.poll(() => adjustments(backend).length).toBe(1);
    // Correct would be 100 + 50 - 10 = 140.
    expect(inv(backend).available).toBe(90);
  });

  test('current behaviour: the "can\'t go below zero" check can be beaten by a concurrent removal', async ({ page, backend }) => {
    backend.beforeNext('inventory', 'POST', t => { t.inventory[0].available = 5; }); // 95 sold meanwhile
    await adjust(page, -60);
    await expect.poll(() => adjustments(backend).length).toBe(1);
    // Real stock was 5; removing 60 should have been refused. Instead the
    // total is written as 40 and the 95 sold units vanish from the count.
    expect(inv(backend).available).toBe(40);
  });

  test('current behaviour: drop after stock saved, then Save again adds it twice', async ({ page, backend }) => {
    backend.dropNext('inventory_adjustments', 'POST');
    await adjust(page, 7);
    await expectError(page, 'Could not save that adjustment');
    expect(inv(backend).available).toBe(107);
    expect(adjustments(backend)).toEqual([]);
    // The form keeps its values after an error, so one more click...
    await page.click('#adjustInventoryForm button[type=submit]');
    await expect.poll(() => adjustments(backend).length).toBe(1);
    expect(inv(backend).available).toBe(114);
  });

  test('wanted: stock and its history are saved together or not at all', async ({ page, backend }) => {
    test.fail(true, 'Manual adjustment is not atomic yet');
    backend.dropNext('inventory_adjustments', 'POST');
    await adjust(page, 7);
    await expectError(page, 'Could not save that adjustment');
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
    await expect.poll(() => backend.tables.returns[0].status).toBe('received');
    expect(inv(backend).available).toBe(103);
    expect(adjustments(backend)).toEqual(['available:3']);
  });

  test('current behaviour: drop on the status update, then Mark Received again restocks twice', async ({ page, backend }) => {
    backend.dropNext('returns', 'PATCH');
    await markReceived(page);
    await expectError(page, 'Could not mark that return Received');
    expect(inv(backend).available).toBe(103);
    expect(backend.tables.returns[0].status).toBe('approved');
    await page.click('.markReceivedBtn');
    await expect.poll(() => backend.tables.returns[0].status).toBe('received');
    expect(inv(backend).available).toBe(106);
    expect(adjustments(backend)).toEqual(['available:3', 'available:3']);
  });

  test('current behaviour: a concurrent change is overwritten (lost update)', async ({ page, backend }) => {
    backend.beforeNext('inventory', 'POST', t => { t.inventory[0].available -= 30; });
    await markReceived(page);
    await expect.poll(() => backend.tables.returns[0].status).toBe('received');
    expect(inv(backend).available).toBe(103); // correct: 73
  });

  test('current behaviour: a second open tab can restock the same return again', async ({ page, backend }) => {
    // The first tab finished; this tab still shows the return as "approved".
    backend.tables.returns[0].status = 'received';
    await markReceived(page);
    const findPatch = () => backend.requests.find(r => r.method === 'PATCH' && r.table === 'returns');
    await expect.poll(() => !!findPatch()).toBe(true);
    expect(inv(backend).available).toBe(103);
    const patch = findPatch();
    // The update is not conditional on the return still being "approved".
    expect(patch.params.map(([k]) => k)).not.toContain('status');
  });

  test('wanted: retrying after a dropped connection restocks exactly once', async ({ page, backend }) => {
    test.fail(true, 'Return restock is not atomic yet');
    backend.dropNext('returns', 'PATCH');
    await markReceived(page);
    await expectError(page, 'Could not mark that return Received');
    await page.click('.markReceivedBtn');
    await expect.poll(() => backend.tables.returns[0].status).toBe('received');
    expect(inv(backend).available).toBe(103);
  });
});

// ------------------------------------------------------------ product delete
test.describe('product delete', () => {
  test('current behaviour: deleting a product that is in use wipes its stock row anyway', async ({ page, backend }) => {
    await openPanel(page, 'inventoryPanel', '.editProductBtn');
    await closeInspectorIfOpen(page);
    // The database refuses to delete a product that has history (foreign key).
    backend.failNext('products', 'DELETE', { status: 409, body: { code: '23503', message: 'violates foreign key constraint' } });
    await page.click('.editProductBtn');
    await page.click('.deleteProductBtn');
    await page.click('.deleteProductBtn'); // "Really delete?"
    await expectError(page, "can't be deleted because it's already used");
    // The product stays, but its stock numbers were deleted first.
    expect(backend.tables.products).toHaveLength(1);
    expect(backend.tables.inventory).toHaveLength(0);
  });
});
