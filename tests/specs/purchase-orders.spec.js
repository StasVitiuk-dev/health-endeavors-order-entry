// Purchase Orders, everything except "Receive delivery" (covered by the
// inventory-safety tests): creating a draft, lines, shipping/tax, payment
// status, status buttons and totals. Verifies existing behaviour; synthetic
// data only (the mock answers every request).

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);
const filtersOf = r => Object.fromEntries(r.params.filter(([k]) => k !== 'select'));

function po(id, status, items) {
  return {
    id, po_number: 'PO-' + id.toUpperCase(), status, currency: 'USD', shipping_cost: 15, tax: 5, expense_category: 'packaging',
    ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z',
    suppliers: { name: 'SYNTHETIC Supplier' }, purchase_order_items: items,
  };
}

const poCreates = [];

test.beforeEach(async ({ page, backend }) => {
  const draftItems = [{ id: 'line-1', purchase_order_id: 'syn-draft', product_id: null, description: 'SYNTHETIC bottles', sku: null, quantity: 100, unit_cost: 0.5, quantity_received: 0, landed_unit_cost: null }];
  Object.assign(backend.tables, {
    suppliers: [{ id: 'sup-1', name: 'SYNTHETIC Supplier', supplier_type: 'manufacturer', contact_name: null, email: null, phone: null, notes: null, is_active: true }],
    products: [{ id: 'prod-a', name: 'SYNTHETIC product A', sku: 'SYN-A' }],
    purchase_order_items: draftItems,
    purchase_orders: [po('syn-draft', 'draft', draftItems), po('syn-ordered', 'ordered', []), po('syn-received', 'received', [])],
    inventory_lots: [],
  });
  // Creating a PO asks for the new id and number back; answer it here and
  // keep what was sent so the test can check it.
  poCreates.length = 0;
  await page.route('**/rest/v1/purchase_orders?select=id%2Cpo_number', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    poCreates.push(JSON.parse(route.request().postData()));
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'syn-new', po_number: 'PO-SYN-NEW' }) });
  });
  await login(page);
  await gotoPage(page, 'purchaseOrdersPanel');
  await page.waitForLoadState('networkidle');
});

async function openPo(page, id) {
  await page.locator(`.poItem[data-id="${id}"] .poRow`).click();
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
  const box = page.locator(`#poDetail_${id}`);
  await expect(box).toBeVisible();
  return box;
}

test('creating a draft sends exactly the purchase order fields', async ({ page, backend }) => {
  await page.selectOption('#poSupplier', 'sup-1');
  await page.selectOption('#poCategory', 'manufacturing');
  await page.fill('#poNotes', 'SYNTHETIC first order');
  await page.click('#addPoForm button[type=submit]');
  await expect(page.locator('body')).toContainText('PO-SYN-NEW created');
  expect(poCreates).toEqual([{
    supplier_id: 'sup-1', expected_at: null, expense_category: 'manufacturing', notes: 'SYNTHETIC first order', created_by: OWNER_USER.id,
  }]);
});

test('the grand total adds shipping and tax to the lines', async ({ page }) => {
  const box = await openPo(page, 'syn-draft');
  // 100 × $0.50 = $50.00 + $15 shipping + $5 tax = $70.00
  await expect(box.locator('.poTotalsRow').first()).toContainText('Total $70.00');
  await expect(page.locator('.poItem[data-id="syn-draft"] .poTotal')).toHaveText('$70.00');
});

test('adding a catalogue line sends exactly the line fields (description and SKU from the product)', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-draft');
  await box.locator('.poLineProduct').selectOption('prod-a');
  await expect(box.locator('.poLineDesc')).toHaveValue('SYNTHETIC product A');
  await box.locator('.poLineQty').fill('24');
  await box.locator('.poLineCost').fill('3.25');
  await box.locator('.poAddLine').click();
  await expect.poll(() => writes(backend, 'purchase_order_items').length).toBe(1);
  expect(writes(backend, 'purchase_order_items')[0].body).toEqual({
    purchase_order_id: 'syn-draft', product_id: 'prod-a', description: 'SYNTHETIC product A', sku: 'SYN-A', quantity: 24, unit_cost: 3.25,
  });
});

test('a line with quantity 0 is refused before anything is sent', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-draft');
  await box.locator('.poLineDesc').fill('SYNTHETIC labels');
  await box.locator('.poLineQty').fill('0');
  await box.locator('.poAddLine').click();
  await page.waitForTimeout(300);
  expect(writes(backend, 'purchase_order_items')).toEqual([]);
});

test('Remove deletes only that line', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-draft');
  await box.locator('.poDelLine[data-line="line-1"]').click();
  await expect.poll(() => writes(backend, 'purchase_order_items').length).toBe(1);
  const [w] = writes(backend, 'purchase_order_items');
  expect(w.method).toBe('DELETE');
  expect(filtersOf(w)).toEqual({ id: 'eq.line-1' });
});

test('saving shipping and tax sends only those two numbers', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-draft');
  await box.locator('.poShipping').fill('20');
  await box.locator('.poTax').fill('2.5');
  await box.locator('.poSaveTotals').click();
  await expect.poll(() => writes(backend, 'purchase_orders').length).toBe(1);
  const [w] = writes(backend, 'purchase_orders');
  expect(Object.keys(w.body).sort()).toEqual(['shipping_cost', 'tax', 'updated_at']);
  expect(w.body).toMatchObject({ shipping_cost: 20, tax: 2.5 });
  // Only while the order can still be edited, so a stale page can't change
  // the total of an order whose expense has already been logged.
  expect(filtersOf(w)).toEqual({ id: 'eq.syn-draft', status: 'in.(draft,ordered)', deleted_at: 'is.null' });
});

test('saving the payment status sends only that status', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-ordered');
  await box.locator('.poPayment').selectOption('partial');
  await box.locator('.poSavePayment').click();
  await expect.poll(() => writes(backend, 'purchase_orders').length).toBe(1);
  expect(Object.keys(writes(backend, 'purchase_orders')[0].body).sort()).toEqual(['payment_status', 'updated_at']);
  expect(writes(backend, 'purchase_orders')[0].body.payment_status).toBe('partial');
  // only over the payment status the page showed (stale-tab audit, 2026-10-06)
  expect(filtersOf(writes(backend, 'purchase_orders')[0])).toEqual({ id: 'eq.syn-ordered', payment_status: 'eq.unpaid', deleted_at: 'is.null' });
});

test('a stale page cannot turn a payment marked "Paid" elsewhere back into something else', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-ordered');
  backend.tables.purchase_orders.find(p => p.id === 'syn-ordered').payment_status = 'paid';
  await box.locator('.poPayment').selectOption('partial');
  await box.locator('.poSavePayment').click();
  await expect(page.locator('#dashError')).toContainText('already changed');
  expect(backend.tables.purchase_orders.find(p => p.id === 'syn-ordered').payment_status).toBe('paid');
});

test('each status offers only its next steps', async ({ page }) => {
  let box = await openPo(page, 'syn-draft');
  await expect(box.locator('.poActions button')).toHaveText(['Mark as ordered', 'Cancel']);
  box = await openPo(page, 'syn-ordered');
  await expect(box.locator('.poActions button')).toHaveText(['Mark as shipped', 'Receive delivery', 'Cancel']);
  box = await openPo(page, 'syn-received');
  await expect(box.locator('.poActions button')).toHaveCount(0);
  await expect(box).toContainText('stock added to Inventory and cost logged to Expenses');
});

test('"Mark as ordered" records the status and the order date', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-draft');
  await box.locator('.poStatusBtn[data-next="ordered"]').click();
  await expect.poll(() => writes(backend, 'purchase_orders').length).toBe(1);
  const [w] = writes(backend, 'purchase_orders');
  expect(Object.keys(w.body).sort()).toEqual(['ordered_at', 'status', 'updated_at']);
  expect(w.body.status).toBe('ordered');
  expect(filtersOf(w)).toEqual({ id: 'eq.syn-draft', status: 'in.(draft)', deleted_at: 'is.null' });
});

test('Cancel needs a second press within 4 seconds, and then only cancels a draft/ordered/shipped order', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-draft');
  let dialogShown = false;
  page.on('dialog', d => { dialogShown = true; d.dismiss(); });
  const cancel = box.locator('.poStatusBtn[data-next="cancelled"]');
  await cancel.click();
  await expect(cancel).toHaveText('Really cancel this order?');
  await page.waitForTimeout(300);
  expect(writes(backend, 'purchase_orders')).toEqual([]);
  await cancel.click();
  await expect.poll(() => writes(backend, 'purchase_orders').length).toBe(1);
  expect(dialogShown).toBe(false);
  const [w] = writes(backend, 'purchase_orders');
  expect(w.body.status).toBe('cancelled');
  expect(filtersOf(w)).toEqual({ id: 'eq.syn-draft', status: 'in.(draft,ordered,shipped)', deleted_at: 'is.null' });
});

test('Cancel un-arms itself after 4 seconds', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-draft');
  const cancel = box.locator('.poStatusBtn[data-next="cancelled"]');
  await cancel.click();
  await expect(cancel).toHaveText('Really cancel this order?');
  await expect(cancel).toHaveText('Cancel', { timeout: 6000 });
  expect(writes(backend, 'purchase_orders')).toEqual([]);
});
