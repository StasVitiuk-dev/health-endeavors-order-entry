// Fixes for bugs confirmed by the owner's read-only Query A (2026-10-05):
//   1. Approval Deny wrote 'denied'; the database only allows pending /
//      approved / rejected, so Deny always failed. It now writes 'rejected'.
//   2. 'rejected' requests are closed everywhere (queue and home tile).
//   3. Documents offered Incident / Purchase Order links the database refuses
//      (only supplier or none). Now only suppliers; a refused save removes the
//      file it had just uploaded, and an unsupported link is refused before
//      anything is uploaded.
//   4. Stock can only be changed by the Owner or an Administrator (database
//      rules). Employees are stopped before anything is saved, and a refusal
//      by the database is reported as a permission problem, not as "stock kept
//      changing".
// Synthetic data only.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { load } = require('../helpers/extract-source');
const base = require('@playwright/test');

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);
const filtersOf = r => Object.fromEntries(r.params.filter(([k]) => k !== 'select'));
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
const asEmployee = backend => { backend.tables.profiles[0].role = 'employee'; };

// ------------------------------------------------------------- 1 + 2 approvals
test.describe('Approvals: Deny and rejected requests', () => {
  test.beforeEach(async ({ backend }) => {
    backend.tables.approval_requests = [
      { id: 'ap-1', action_type: 'synthetic', summary: 'SYNTHETIC pending request', status: 'pending', created_at: '2026-09-20T00:00:00Z' },
      { id: 'ap-2', action_type: 'synthetic', summary: 'SYNTHETIC rejected request', status: 'rejected', created_at: '2026-09-19T00:00:00Z' },
    ];
  });

  test('Deny writes the valid status "rejected" (with the password), only while still pending', async ({ page, backend }) => {
    await login(page);
    await open(page, 'approvalsPanel');
    await page.locator('.approvalRow[data-id="ap-1"] .denyBtn').click();
    await confirmPassword(page);
    await expect.poll(() => backend.tables.approval_requests[0].status).toBe('rejected');
    const [w] = writes(backend, 'approval_requests');
    expect(w.body.status).toBe('rejected');
    expect(filtersOf(w)).toEqual({ id: 'eq.ap-1', status: 'eq.pending' });
  });

  test('a rejected request is not in the queue', async ({ page }) => {
    await login(page);
    await open(page, 'approvalsPanel');
    await expect(page.locator('#approvalsWrap .approvalRow')).toHaveCount(1);
    await expect(page.locator('#approvalsWrap')).not.toContainText('SYNTHETIC rejected request');
  });

  test('a rejected request is not counted on the home "Pending approvals" tile', async ({ page }) => {
    await login(page);
    await expect(page.locator('#businessHealthStats .stat', { hasText: 'Pending approvals' })).toContainText('1');
    await expect(page.locator('#businessHealthStats .stat', { hasText: 'Pending approvals' }).locator('.num')).toHaveText('1');
  });
});

base.test('isClosedStatus treats "rejected" as closed (unit)', ({}, testInfo) => {
  base.test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once');
  const H = load(['CLOSED_WORDS', 'isClosedStatus']);
  base.expect(H.isClosedStatus('rejected')).toBe(true);
  base.expect(H.isClosedStatus('REJECTED')).toBe(true);
  base.expect(H.isClosedStatus('pending')).toBe(false);
});

// ------------------------------------------------------------------ 3 documents
test.describe('Documents: link types and uploads', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.documents = [];
    backend.tables.suppliers = [{ id: 'sup-1', name: 'SYNTHETIC Supplier', supplier_type: 'manufacturer', is_active: true }];
    backend.tables.incidents = [{ id: 'inc-1', incident_number: 'INC-1', title: 'SYNTHETIC incident' }];
    backend.tables.purchase_orders = [{ id: 'po-1', po_number: 'PO-1', status: 'draft', deleted_at: null }];
    await login(page);
    await open(page, 'documentsPanel');
  });

  test('the link list offers suppliers only — no Incident or Purchase Order', async ({ page }) => {
    const values = await page.locator('#docRelated option').evaluateAll(os => os.map(o => o.value));
    expect(values).toEqual(['', 'supplier:sup-1']);
    expect(await page.locator('#docRelated optgroup').evaluateAll(gs => gs.map(g => g.label))).toEqual(['Suppliers']);
  });

  test('saving with a supplier link sends related_type "supplier"', async ({ page, backend }) => {
    await page.fill('#docTitle', 'SYNTHETIC certificate');
    await page.selectOption('#docCategory', 'certification');
    await page.selectOption('#docRelated', 'supplier:sup-1');
    await page.click('#addDocumentForm button[type="submit"]');
    await expect.poll(() => writes(backend, 'documents').length).toBe(1);
    expect(writes(backend, 'documents')[0].body).toMatchObject({ related_type: 'supplier', related_id: 'sup-1' });
  });

  test('an unsupported link type is refused before any upload or save', async ({ page, backend }) => {
    await page.fill('#docTitle', 'SYNTHETIC doc');
    await page.selectOption('#docCategory', 'other');
    await page.setInputFiles('#docFile', { name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic') });
    // A stale page (or old cached script) could still hold an incident option.
    await page.locator('#docRelated').evaluate(sel => { const o = document.createElement('option'); o.value = 'incident:inc-1'; o.textContent = 'old'; sel.appendChild(o); sel.value = 'incident:inc-1'; });
    await page.click('#addDocumentForm button[type="submit"]');
    await expect(page.locator('#dashError')).toContainText('can only be linked to a supplier');
    expect(backend.requests.filter(r => r.path.startsWith('/storage/'))).toEqual([]);
    expect(writes(backend, 'documents')).toEqual([]);
  });

  test('if the document record is refused after the upload, the uploaded file is removed again', async ({ page, backend }) => {
    replyOnce(backend, 'documents', 'POST', 400, { code: '23514', message: 'new row violates check constraint "documents_category_check"' });
    await page.fill('#docTitle', 'SYNTHETIC doc');
    await page.selectOption('#docCategory', 'other');
    await page.setInputFiles('#docFile', { name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic') });
    await page.click('#addDocumentForm button[type="submit"]');
    await expect(page.locator('#dashError')).toContainText('Could not add that document');
    const storage = backend.requests.filter(r => r.path.startsWith('/storage/'));
    const upload = storage.find(r => r.method === 'POST' && r.path.includes('/object/document-files/'));
    expect(upload).toBeTruthy();
    const uploadedPath = decodeURIComponent(upload.path.split('/object/document-files/')[1]);
    const removal = storage.find(r => r.method === 'DELETE' && r.path.includes('/object/document-files'));
    expect(removal).toBeTruthy();
    expect(removal.body.prefixes).toEqual([uploadedPath]);
  });
});

// --------------------------------------------------------- 4 stock permissions
function seedReturn(backend, disposition) {
  backend.tables.returns = [{
    id: 'ret-1', order_id: 'ord-1', order_item_id: 'item-1', reason: 'damaged', status: 'approved', product_condition: null,
    disposition: null, refund_amount: null, approved_at: null, received_at: null, refunded_at: null, notes: null, created_at: '2026-09-20T00:00:00Z',
    orders: { order_number: 'SYN-1001', customer_name: 'SYNTHETIC' }, order_items: { product_name: 'SYNTHETIC A', sku: 'SYN-A', quantity: 3, unit_price: 10, line_total: 30 },
  }];
  backend.tables.products = [{ id: 'prod-a', name: 'SYNTHETIC A', sku: 'SYN-A' }];
  backend.tables.inventory = [{ product_id: 'prod-a', available: 10, damaged: 0 }];
  backend.tables.inventory_adjustments = [];
  enableWrites(backend, ['inventory', 'inventory_adjustments']);
}

test.describe('Returns: an employee and stock', () => {
  test('an employee cannot restock: refused before the return is touched', async ({ page, backend }) => {
    seedReturn(backend); asEmployee(backend);
    await login(page);
    await open(page, 'returnsPanel');
    await page.selectOption('.dispositionSelect', 'restock_available');
    await page.click('.markReceivedBtn');
    await expect(page.locator('#dashError')).toContainText('Only the Owner or an Administrator can restock a return. Nothing was changed.');
    expect(writes(backend, 'returns')).toEqual([]);
    expect(writes(backend, 'inventory')).toEqual([]);
    expect(backend.tables.returns[0].status).toBe('approved');
  });

  test('an employee can still mark a return Received when nothing goes back into stock (Discard)', async ({ page, backend }) => {
    seedReturn(backend); asEmployee(backend);
    await login(page);
    await open(page, 'returnsPanel');
    await page.selectOption('.dispositionSelect', 'discard');
    await page.click('.markReceivedBtn');
    await expect.poll(() => backend.tables.returns[0].status).toBe('received');
    expect(writes(backend, 'inventory')).toEqual([]);
  });

  test('if the database refuses the stock change anyway, the page says "permission", once, not "kept changing"', async ({ page, backend }) => {
    seedReturn(backend);
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await page.waitForLoadState('networkidle');
    replyOnce(backend, 'inventory', 'PATCH', 200, []); // row-level security answers "0 rows"
    await page.selectOption('#invProduct', 'prod-a');
    await page.selectOption('#invBucket', 'available');
    await page.fill('#invAmount', '2');
    await page.click('#adjustInventoryForm button[type=submit]');
    await expect(page.locator('#dashError')).toContainText('You do not have permission to change stock');
    await expect(page.locator('#dashError')).not.toContainText('kept changing');
    expect(backend.requests.filter(r => r.table === 'inventory' && r.method === 'PATCH')).toHaveLength(1);
    expect(backend.tables.inventory[0].available).toBe(10);
  });
});

test.describe('Other stock actions: an employee is stopped before anything is saved', () => {
  test('manual stock adjustment', async ({ page, backend }) => {
    seedReturn(backend); asEmployee(backend);
    await login(page);
    await gotoPage(page, 'inventoryPanel');
    await page.waitForLoadState('networkidle');
    await page.selectOption('#invProduct', 'prod-a');
    await page.selectOption('#invBucket', 'available');
    await page.fill('#invAmount', '2');
    await page.click('#adjustInventoryForm button[type=submit]');
    await expect(page.locator('#dashError')).toContainText('Only the Owner or an Administrator can change stock');
    expect(backend.tableWrites()).toEqual([]);
  });

  test('receive delivery', async ({ page, backend }) => {
    const items = [{ id: 'line-a', purchase_order_id: 'po-1', product_id: 'prod-a', description: 'SYNTHETIC A', sku: 'SYN-A', quantity: 10, unit_cost: 2, quantity_received: 0, landed_unit_cost: null }];
    Object.assign(backend.tables, {
      products: [{ id: 'prod-a', name: 'SYNTHETIC A', sku: 'SYN-A' }],
      purchase_order_items: items,
      purchase_orders: [{ id: 'po-1', po_number: 'PO-1', status: 'shipped', currency: 'USD', shipping_cost: 0, tax: 0, expense_category: 'packaging', ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z', deleted_at: null, suppliers: { name: 'SYNTHETIC' }, purchase_order_items: items }],
    });
    asEmployee(backend);
    await login(page);
    await open(page, 'purchaseOrdersPanel');
    await page.locator('.poItem[data-id="po-1"] .poRow').click();
    const overlay = page.locator('#inspectorOverlay');
    if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
    await page.locator('.poReceiveBtn').click();
    await expect(page.locator('#dashError')).toContainText('Only the Owner or an Administrator can change stock');
    expect(backend.tableWrites()).toEqual([]);
  });
});
