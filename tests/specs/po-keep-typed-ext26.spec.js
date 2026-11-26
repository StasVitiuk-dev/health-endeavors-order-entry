// What is being typed on an open purchase order survives the list being drawn again (Nov 26
// sweep, after keep-typed-lists-ext26). Refresh, pull to refresh and the quiet refresh every
// 5 minutes redrew Purchase Orders: a new line, lot numbers, shipping, tax or the payment
// choice went back to what was saved. Kept only while that field's saved value is unchanged
// (assets/app/he-ui.js keepTyped). Every value is made up; the database is the mock.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);
function po(id, status, items) {
  return {
    id, po_number: 'PO-' + id.toUpperCase(), status, currency: 'USD', shipping_cost: 15, tax: 5, expense_category: 'packaging',
    ordered_at: null, expected_at: null, received_at: null, payment_status: 'unpaid', notes: null, created_at: '2026-09-01T00:00:00Z',
    suppliers: { name: 'SYNTHETIC Supplier' }, purchase_order_items: items,
  };
}

test.beforeEach(async ({ page, backend }) => {
  const draftItems = [{ id: 'line-1', purchase_order_id: 'syn-draft', product_id: null, description: 'SYNTHETIC bottles', sku: null, quantity: 100, unit_cost: 0.5, quantity_received: 0, landed_unit_cost: null }];
  const orderedItems = [
    { id: 'line-a', purchase_order_id: 'syn-ordered', product_id: 'prod-a', description: 'SYNTHETIC product A', sku: 'SYN-A', quantity: 10, unit_cost: 2, quantity_received: 0, landed_unit_cost: null },
    { id: 'line-b', purchase_order_id: 'syn-ordered', product_id: 'prod-b', description: 'SYNTHETIC product B', sku: 'SYN-B', quantity: 20, unit_cost: 3, quantity_received: 0, landed_unit_cost: null },
  ];
  Object.assign(backend.tables, {
    suppliers: [{ id: 'sup-1', name: 'SYNTHETIC Supplier', supplier_type: 'manufacturer', contact_name: null, email: null, phone: null, notes: null, is_active: true }],
    products: [{ id: 'prod-a', name: 'SYNTHETIC product A', sku: 'SYN-A' }, { id: 'prod-b', name: 'SYNTHETIC product B', sku: 'SYN-B' }],
    purchase_order_items: draftItems.concat(orderedItems),
    purchase_orders: [po('syn-draft', 'draft', draftItems), po('syn-ordered', 'ordered', orderedItems)],
    inventory_lots: [],
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
// press Refresh and wait until the list was really drawn again
async function refreshList(page) {
  await page.locator('#poWrap').evaluate(el => el.querySelectorAll('.poItem').forEach(r => r.setAttribute('data-test-old', '1')));
  await page.locator('#refreshBtn').click();
  await expect(page.locator('#poWrap .poItem:not([data-test-old])').first()).toBeVisible();
}

test('a new line, shipping and payment being typed on a draft survive Refresh; adding the line still sends it once', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-draft');
  await box.locator('.poLineDesc').fill('SYNTHETIC caps');
  await box.locator('.poLineQty').fill('250');
  await box.locator('.poLineCost').fill('0.12');
  await box.locator('.poShipping').fill('20');
  await box.locator('.poPayment').selectOption('partial');
  await refreshList(page);
  await expect(box).toBeVisible();                                                                   // still open
  await expect(box.locator('.poLineDesc')).toHaveValue('SYNTHETIC caps');
  await expect(box.locator('.poLineQty')).toHaveValue('250');
  await expect(box.locator('.poLineCost')).toHaveValue('0.12');
  await expect(box.locator('.poShipping')).toHaveValue('20');
  await expect(box.locator('.poPayment')).toHaveValue('partial');
  await box.locator('.poAddLine').click();
  await expect.poll(() => writes(backend, 'purchase_order_items').length).toBe(1);
  expect(writes(backend, 'purchase_order_items')[0].body).toMatchObject({ description: 'SYNTHETIC caps', quantity: 250, unit_cost: 0.12 });
});

test('lot numbers typed per line stay on their own line after Refresh', async ({ page }) => {
  const box = await openPo(page, 'syn-ordered');
  await box.locator('.poLineLot[data-line="line-a"]').fill('SYN-LOT-A');
  await box.locator('.poLineLot[data-line="line-b"]').fill('SYN-LOT-B');
  await refreshList(page);
  await expect(box.locator('.poLineLot[data-line="line-a"]')).toHaveValue('SYN-LOT-A');
  await expect(box.locator('.poLineLot[data-line="line-b"]')).toHaveValue('SYN-LOT-B');
});

test('shipping changed elsewhere meanwhile: the newest value is shown, not the half-typed one', async ({ page, backend }) => {
  const box = await openPo(page, 'syn-draft');
  await box.locator('.poShipping').fill('20');
  await box.locator('.poLineDesc').fill('SYNTHETIC caps');
  backend.tables.purchase_orders.find(p => p.id === 'syn-draft').shipping_cost = 30;                // another tab saved
  await refreshList(page);
  await expect(box.locator('.poShipping')).toHaveValue('30');
  await expect(box.locator('.poLineDesc')).toHaveValue('SYNTHETIC caps');                           // a field nobody else changed is kept
});
