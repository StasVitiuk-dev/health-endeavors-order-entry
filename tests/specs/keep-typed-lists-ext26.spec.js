// What is being typed in a list survives the list being drawn again (Nov 26 sweep).
// Returns, Recalls, Quality Checks and Inventory are redrawn on Refresh, pull to refresh and
// the quiet refresh every 5 minutes (which only waits while the cursor is in a box); a refund
// amount, a chosen outcome, a resolution note, a low-stock number or an open "Edit product"
// form used to go back to what was saved. Now they are kept, but only while that row and
// that field are exactly as they were (assets/app/he-ui.js keepTyped), so a later save is
// checked against the same thing as before. Every value is made up; the database is the mock.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
const writes = (backend, table) => backend.tableWrites().filter(r => r.table === table);

async function open(page, panelId) {
  await gotoPage(page, panelId);
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
}
// press Refresh and wait until the list was really drawn again
async function refreshList(page, wrap, rowSel) {
  await page.locator(wrap).evaluate((el, sel) => el.querySelectorAll(sel).forEach(r => r.setAttribute('data-test-old', '1')), rowSel);
  await page.locator('#refreshBtn').click();
  await expect(page.locator(`${wrap} ${rowSel}:not([data-test-old])`).first()).toBeVisible();
}

test.describe('Inventory and Returns', () => {
  test.beforeEach(async ({ page, backend }) => {
    seedBusiness(backend);
    enableWrites(backend, ['inventory']);
    await page.clock.setFixedTime(NOW);
    await login(page);
  });

  test('Inventory: a low-stock number and an open "Edit product" form survive Refresh; saving still writes once', async ({ page, backend }) => {
    await open(page, 'inventoryPanel');
    const a = page.locator('#inventoryWrap [data-product-id="prod-a"]'), b = page.locator('#inventoryWrap [data-product-id="prod-b"]');
    await b.locator('.invThresholdInput').fill('10');
    await a.locator('.editProductBtn').click();
    await a.locator('.peRetail').fill('21.5');
    await refreshList(page, '#inventoryWrap', '[data-product-id]');
    await expect(b.locator('.invThresholdInput')).toHaveValue('10');
    await expect(a.locator('.prodEdit')).toBeVisible();
    await expect(a.locator('.editProductBtn')).toHaveText('Close');
    await expect(a.locator('.peRetail')).toHaveValue('21.5');
    await b.locator('.saveThresholdBtn').click();
    await expect.poll(() => writes(backend, 'inventory').length).toBe(1);
    expect(writes(backend, 'inventory')[0].body.low_stock_threshold).toBe(10);
  });

  test('Inventory: a product changed elsewhere meanwhile shows its newest values, not the half-typed ones', async ({ page, backend }) => {
    await open(page, 'inventoryPanel');
    const a = page.locator('#inventoryWrap [data-product-id="prod-a"]');
    await a.locator('.editProductBtn').click();
    await a.locator('.peRetail').fill('21.5');
    const prod = backend.tables.products.find(p => p.id === 'prod-a');
    Object.assign(prod, { retail_price: 30, updated_at: '2026-11-26T18:00:00Z' });                 // another tab saved
    await refreshList(page, '#inventoryWrap', '[data-product-id]');
    await expect(a.locator('.peRetail')).toHaveValue('30');
    await expect(a.locator('.prodEdit')).toBeHidden();                                              // as before: closed, showing the newest
  });

  test('Returns: a refund amount and a chosen outcome survive Refresh', async ({ page }) => {
    await open(page, 'returnsPanel');
    const rec = page.locator('#returnsWrap [data-return-id="ret-received"]'), appr = page.locator('#returnsWrap [data-return-id="ret-approved"]');
    await rec.locator('.refundAmountInput').fill('12.5');
    await appr.locator('.dispositionSelect').selectOption('discard');
    await refreshList(page, '#returnsWrap', '[data-return-id]');
    await expect(rec.locator('.refundAmountInput')).toHaveValue('12.5');
    await expect(appr.locator('.dispositionSelect')).toHaveValue('discard');
  });

  test('nothing typed: Refresh shows the lists as they are now', async ({ page, backend }) => {
    await open(page, 'inventoryPanel');
    const b = page.locator('#inventoryWrap [data-product-id="prod-b"]');
    backend.tables.inventory.find(r => r.product_id === 'prod-b').low_stock_threshold = 9;
    await refreshList(page, '#inventoryWrap', '[data-product-id]');
    await expect(b.locator('.invThresholdInput')).toHaveValue('9');
  });
});

test.describe('Quality Checks and Recalls', () => {
  const PRODUCT = { name: 'SYNTHETIC product A', sku: 'SYN-A' };
  test.beforeEach(async ({ page, backend }) => {
    Object.assign(backend.tables, {
      products: [{ id: 'prod-a', name: PRODUCT.name, sku: PRODUCT.sku }],
      inventory_lots: [{ id: 'lot-1', lot_number: 'L-1', product_id: 'prod-a', quantity_remaining: 5, received_at: '2026-09-01T00:00:00Z', products: PRODUCT }],
      quality_checks: [{ id: 'qc-1', check_type: 'packaging_defect', result: 'fail', severity: 'high', description: 'SYNTHETIC cracked caps', resolution: null,
        incident_id: null, created_at: '2026-09-20T00:00:00Z', product_id: 'prod-a', lot_id: 'lot-1', products: PRODUCT, inventory_lots: { lot_number: 'L-1' } }],
      recalls: [{ id: 'rc-1', reason: 'SYNTHETIC contamination report', severity: 'high', status: 'initiated', quantity_quarantined: null, resolution: null,
        resolved_at: null, incident_id: null, created_at: '2026-09-20T00:00:00Z', lot_id: 'lot-1', product_id: 'prod-a', products: PRODUCT, inventory_lots: { lot_number: 'L-1' }, incidents: null }],
    });
    await login(page);
  });

  test('Quality Checks: a resolution note being typed survives Refresh', async ({ page }) => {
    await open(page, 'qualityControlPanel');
    const row = page.locator('#qcWrap [data-id="qc-1"]');
    await row.locator('.qcResolutionInput').fill('SYNTHETIC caps replaced by the supplier');
    await refreshList(page, '#qcWrap', '[data-id]');
    await expect(row.locator('.qcResolutionInput')).toHaveValue('SYNTHETIC caps replaced by the supplier');
  });

  test('Quality Checks: resolved elsewhere meanwhile, the note box is gone and the page keeps working', async ({ page, backend }) => {
    await open(page, 'qualityControlPanel');
    const row = page.locator('#qcWrap [data-id="qc-1"]');
    await row.locator('.qcResolutionInput').fill('SYNTHETIC my note');
    backend.tables.quality_checks[0].resolution = 'SYNTHETIC resolved on the phone';
    await refreshList(page, '#qcWrap', '[data-id]');
    await expect(row).toContainText('SYNTHETIC resolved on the phone');
    await expect(row.locator('.qcResolutionInput')).toHaveCount(0);
  });

  test('Recalls: a resolution note being typed survives Refresh', async ({ page }) => {
    await open(page, 'recallsPanel');
    const row = page.locator('#recallsWrap [data-id="rc-1"]');
    await row.locator('.recallResolutionInput').fill('SYNTHETIC supplier confirmed a false alarm');
    await refreshList(page, '#recallsWrap', '[data-id]');
    await expect(row.locator('.recallResolutionInput')).toHaveValue('SYNTHETIC supplier confirmed a false alarm');
  });
});
