// What the dashboard does when Supabase misbehaves in the middle of a
// dangerous action: an error reply, a refusal by row-level security (which
// looks like "no rows changed"), an expired session, a slow reply with an
// impatient double click, or malformed data. The rule: never duplicate work,
// never write garbage, and tell the person whether to retry, refresh or stop.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);

async function open(page, id) {
  await gotoPage(page, id);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}
async function confirmPassword(page) {
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await page.fill('#reauthPassword', OWNER_USER.password);
  await page.click('#reauthConfirmBtn');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
}
function replyOnce(backend, table, method, status, body) {
  const original = backend.handleRest.bind(backend);
  let used = false;
  backend.handleRest = (route, entry) => {
    if (!used && entry.table === table && entry.method === method) {
      used = true;
      return route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    }
    return original(route, entry);
  };
}

test.describe('Approval Queue', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.approval_requests = [{ id: 'ap-1', action_type: 'synthetic', summary: 'SYNTHETIC pending request', status: 'pending', created_at: '2026-09-20T00:00:00Z' }];
    await login(page);
    await open(page, 'approvalsPanel');
  });

  test('a server error changes nothing and leaves the buttons usable for a retry', async ({ page, backend }) => {
    replyOnce(backend, 'approval_requests', 'PATCH', 500, { message: 'SYNTHETIC server error' });
    await page.locator('.approvalRow[data-id="ap-1"] .approveBtn').click();
    await confirmPassword(page);
    await expect(page.locator('#dashError')).toContainText('SYNTHETIC server error');
    expect(backend.tables.approval_requests[0].status).toBe('pending');
    await expect(page.locator('.approvalRow[data-id="ap-1"] .approveBtn')).toBeEnabled();
  });

  test('an expired session (401) is reported and nothing changes', async ({ page, backend }) => {
    replyOnce(backend, 'approval_requests', 'PATCH', 401, { message: 'JWT expired', code: 'PGRST301' });
    await page.locator('.approvalRow[data-id="ap-1"] .denyBtn').click();
    await confirmPassword(page);
    await expect(page.locator('#dashError')).toContainText('JWT expired');
    expect(backend.tables.approval_requests[0].status).toBe('pending');
  });
});

test.describe('Returns', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.returns = [{
      id: 'ret-1', order_id: 'ord-1', order_item_id: 'item-1', reason: 'damaged', status: 'approved', product_condition: null,
      disposition: null, refund_amount: null, approved_at: null, received_at: null, refunded_at: null, notes: null, created_at: '2026-09-20T00:00:00Z',
      orders: { order_number: 'SYN-1001', customer_name: 'SYNTHETIC' }, order_items: { product_name: 'SYNTHETIC A', sku: 'SYN-A', quantity: 3, unit_price: 10, line_total: 30 },
    }];
    backend.tables.products = [{ id: 'prod-a', name: 'SYNTHETIC A', sku: 'SYN-A' }];
    backend.tables.inventory = [{ product_id: 'prod-a', available: 10 }];
    backend.tables.inventory_adjustments = [];
    enableWrites(backend, ['inventory', 'inventory_adjustments']);
    await login(page);
    await open(page, 'returnsPanel');
  });

  test('row-level security refusing the claim (no rows changed) restocks nothing and says why', async ({ page, backend }) => {
    replyOnce(backend, 'returns', 'PATCH', 200, []);
    await page.selectOption('.dispositionSelect', 'restock_available');
    await page.click('.markReceivedBtn');
    await expect(page.locator('#dashError')).toContainText("or you don't have permission to change it");
    await expect(page.locator('#dashError')).toContainText('No stock was added');
    expect(backend.tables.inventory[0].available).toBe(10);
    expect(writes(backend, 'inventory')).toEqual([]);
  });

  test('a refund above the order line value is refused before anything is sent', async ({ page, backend }) => {
    backend.tables.returns[0].status = 'received';
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await open(page, 'returnsPanel');
    await page.fill('.refundAmountInput', '45');
    await page.click('.markRefundedBtn');
    await expect(page.locator('#dashError')).toContainText('more than this order line was worth ($30.00)');
    expect(writes(backend, 'returns')).toEqual([]);
  });

  for (const [typed, says] of [['10.009', 'whole cents'], ['-1', 'cannot be less than 0'], ['abc', 'must be a number']]) {
    test(`a refund of "${typed}" is refused before anything is sent (EXT4)`, async ({ page, backend }) => {
      backend.tables.returns[0].status = 'received';
      await page.reload();
      await expect(page.locator('#dash')).toBeVisible();
      await open(page, 'returnsPanel');
      // type=number inputs drop text the browser cannot read; set the raw value
      await page.locator('.refundAmountInput').evaluate((el, v) => { el.type = 'text'; el.value = v; }, typed);
      await page.click('.markRefundedBtn');
      await expect(page.locator('#dashError')).toContainText(says);
      await expect(page.locator('#dashError')).toContainText('Nothing was saved');
      expect(writes(backend, 'returns')).toEqual([]);
    });
  }

  test('a refund within the line value is recorded once, only from Received', async ({ page, backend }) => {
    backend.tables.returns[0].status = 'received';
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await open(page, 'returnsPanel');
    await page.fill('.refundAmountInput', '30');
    await page.click('.markRefundedBtn');
    await expect(page.locator('.markRefundedBtn')).toContainText('Confirm refund of $30.00?');
    expect(writes(backend, 'returns')).toEqual([]); // the first press records nothing
    await page.click('.markRefundedBtn');
    await expect.poll(() => backend.tables.returns[0].status).toBe('refunded');
    const [w] = writes(backend, 'returns');
    expect(w.body.refund_amount).toBe(30);
    expect(Object.fromEntries(w.params)).toMatchObject({ status: 'eq.received' });
  });
});

test.describe('Purchase orders', () => {
  test.beforeEach(async ({ page, backend }) => {
    const items = [{ id: 'line-a', purchase_order_id: 'po-1', product_id: 'prod-a', description: 'SYNTHETIC A', sku: 'SYN-A', quantity: 10, unit_cost: 2, quantity_received: 0, landed_unit_cost: null }];
    Object.assign(backend.tables, {
      products: [{ id: 'prod-a', name: 'SYNTHETIC A', sku: 'SYN-A' }],
      purchase_order_items: items,
      purchase_orders: [{ id: 'po-1', po_number: 'PO-1', status: 'shipped', currency: 'USD', shipping_cost: 0, tax: 0, expense_category: 'packaging',
        ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z',
        suppliers: { name: 'SYNTHETIC Supplier' }, purchase_order_items: items }],
      inventory: [{ product_id: 'prod-a', available: 5 }],
      inventory_adjustments: [], inventory_lots: [], expenses: [],
    });
    enableWrites(backend, ['inventory', 'inventory_adjustments', 'expenses']);
    await login(page);
    await open(page, 'purchaseOrdersPanel');
    await page.locator('.poItem[data-id="po-1"] .poRow').click();
    const overlay = page.locator('#inspectorOverlay');
    if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  });

  test('a slow reply plus an impatient double click still receives exactly once', async ({ page, backend }) => {
    backend.delayMs.purchase_orders = 1200;
    const btn = page.locator('.poReceiveBtn');
    await btn.click();
    expect(backend.requests.filter(r => r.method === 'PATCH' && r.table === 'purchase_orders')).toHaveLength(0); // first press only asks
    await btn.click();
    await btn.click({ force: true }).catch(() => {}); // the button is disabled; a forced third click must not matter
    await expect.poll(() => backend.tables.expenses.length, { timeout: 15000 }).toBe(1);
    expect(backend.tables.inventory[0].available).toBe(15);
    expect(backend.requests.filter(r => r.method === 'PATCH' && r.table === 'purchase_orders')).toHaveLength(1);
  });

  test('an expired session (401) on Cancel is reported and the order stays as it was', async ({ page, backend }) => {
    replyOnce(backend, 'purchase_orders', 'PATCH', 401, { message: 'JWT expired', code: 'PGRST301' });
    const cancel = page.locator('#poDetail_po-1 .poStatusBtn[data-next="cancelled"]');
    await cancel.click();
    await cancel.click();
    await expect(page.locator('#dashError')).toContainText('Could not update that order');
    expect(backend.tables.purchase_orders[0].status).toBe('shipped');
  });
});

test.describe('Malformed data', () => {
  test('a stock number that is not a number is never overwritten; the adjustment is refused', async ({ page, backend }) => {
    backend.tables.products = [{ id: 'prod-a', name: 'SYNTHETIC A', sku: 'SYN-A', is_active: true, status: 'active', inventory: { available: 'abc' }, inventory_lots: [] }];
    backend.tables.inventory = [{ product_id: 'prod-a', available: 'abc' }];
    backend.tables.inventory_adjustments = [];
    enableWrites(backend, ['inventory', 'inventory_adjustments']);
    await login(page);
    await open(page, 'inventoryPanel');
    await page.selectOption('#invProduct', 'prod-a');
    await page.selectOption('#invBucket', 'available');
    await page.fill('#invAmount', '5');
    await page.click('#adjustInventoryForm button[type=submit]');
    await expect(page.locator('#dashError')).toContainText("isn't a valid number, so nothing was changed");
    expect(backend.tables.inventory[0].available).toBe('abc');
    expect(writes(backend, 'inventory')).toEqual([]);
    expect(writes(backend, 'inventory_adjustments')).toEqual([]);
  });
});

test.describe('Documents: permanent delete', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.documents = [{ id: 'doc-1', title: 'SYNTHETIC COA', category: 'other', related_type: null, related_id: null, document_url: null, file_path: null, issued_date: null, expiration_date: null, notes: null, created_at: '2026-09-20T00:00:00Z' }];
    await login(page);
    await open(page, 'documentsPanel');
  });

  test('after the confirm dialog it also asks for the password; Cancel deletes nothing', async ({ page, backend }) => {
    page.once('dialog', d => d.accept());
    await page.locator('#documentsPanel [data-id="doc-1"] .docDeleteBtn').click();
    await expect(page.locator('#reauthOverlay')).toBeVisible();
    await page.click('#reauthCancelBtn');
    await page.waitForTimeout(300);
    expect(writes(backend, 'documents')).toEqual([]);
  });

  test('with the password the document row is deleted (by id, while it still has the file shown)', async ({ page, backend }) => {
    page.once('dialog', d => d.accept());
    await page.locator('#documentsPanel [data-id="doc-1"] .docDeleteBtn').click();
    await confirmPassword(page);
    await expect.poll(() => writes(backend, 'documents').length).toBe(1);
    expect(writes(backend, 'documents')[0].method).toBe('DELETE');
    // by id, and only while it still has the file this page showed (EXT3);
    // select=id asks for the deleted row back, so a silent refusal is noticed
    const params = Object.fromEntries(writes(backend, 'documents')[0].params);
    expect(params.id).toBe('eq.doc-1');
    expect(params.select).toBe('id');
    expect(params.file_path).toMatch(/^(eq\.|is\.null)/);
  });
});

test('Returns page still loads (without the refund cap) if order_items has no price columns', async ({ page, backend }) => {
  backend.tables.returns = [{
    id: 'ret-1', order_id: 'ord-1', order_item_id: 'item-1', reason: 'damaged', status: 'received', product_condition: null,
    disposition: null, refund_amount: null, approved_at: null, received_at: null, refunded_at: null, notes: null, created_at: '2026-09-20T00:00:00Z',
    orders: { order_number: 'SYN-1001', customer_name: 'SYNTHETIC' }, order_items: { product_name: 'SYNTHETIC A', sku: 'SYN-A', quantity: 3 },
  }];
  const original = backend.handleRest.bind(backend);
  backend.handleRest = (route, entry) => {
    const select = (entry.params.find(([k]) => k === 'select') || [])[1] || '';
    if (entry.table === 'returns' && entry.method === 'GET' && /unit_price/.test(select)) {
      return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: '42703', message: 'column order_items_1.unit_price does not exist' }) });
    }
    return original(route, entry);
  };
  await login(page);
  await open(page, 'returnsPanel');
  await expect(page.locator('[data-return-id="ret-1"]')).toBeVisible();
  await expect(page.locator('[data-return-id="ret-1"]')).toHaveAttribute('data-line-value', '');
});
