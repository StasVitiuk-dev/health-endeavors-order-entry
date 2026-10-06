// First-launch / empty-database UX (2026-10-06). Before launch, and for any
// brand-new install, the tables start empty. Every page
// must open cleanly on empty data: no error banner, no script error, and no
// "undefined", "NaN", "Infinity" or "[object Object]" where a number or text
// should be. Synthetic, empty mock data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const JUNK = /\bundefined\b|\bNaN\b|Infinity|\[object Object\]/;

async function visitEveryPage(page) {
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  expect(ids.length).toBeGreaterThan(20);
  const problems = [];
  for (const id of ids) {
    await gotoPage(page, id);
    await page.waitForLoadState('networkidle');
    const text = await page.locator(`section#${id}`).innerText();
    const m = text.match(JUNK);
    if (m) problems.push(`${id}: "${m[0]}" in …${text.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, ' ')}…`);
    if (await page.locator('#dashError').isVisible()) problems.push(`${id}: error banner: ${await page.locator('#dashError').innerText()}`);
  }
  return problems;
}

test.describe('empty database', () => {
  test('zero orders, purchase orders, returns, recalls, approvals, history and products: every page opens cleanly', async ({ page, backend, pageErrors }) => {
    test.setTimeout(180000);
    for (const t of Object.keys(backend.tables)) if (t !== 'profiles') backend.tables[t] = [];
    for (const r of Object.keys(backend.rpc)) backend.rpc[r] = [];
    await login(page);
    await page.waitForLoadState('networkidle');
    const problems = await visitEveryPage(page);
    expect(problems).toEqual([]);
    expect(pageErrors.filter(e => !/favicon/i.test(e))).toEqual([]);
  });

  test('products exist but no stock has ever moved: Inventory and reports stay truthful', async ({ page, backend, pageErrors }) => {
    test.setTimeout(180000);
    for (const t of Object.keys(backend.tables)) if (t !== 'profiles') backend.tables[t] = [];
    for (const r of Object.keys(backend.rpc)) backend.rpc[r] = [];
    const inv = { product_id: 'prod-1', available: 0, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null };
    backend.tables.products = [{ id: 'prod-1', name: 'SYNTHETIC first product', sku: 'SYN-1', is_active: true, status: 'draft', cost: null, retail_price: null, wholesale_price: null, packaging_info: null, inventory: inv, inventory_lots: [] }];
    backend.tables.inventory = [inv];
    await login(page);
    await page.waitForLoadState('networkidle');
    const problems = await visitEveryPage(page);
    expect(problems).toEqual([]);
    await gotoPage(page, 'inventoryPanel');
    await expect(page.locator('#inventoryPanel')).toContainText('SYNTHETIC first product');
    expect(pageErrors.filter(e => !/favicon/i.test(e))).toEqual([]);
  });
});

test('with no system-mode row saved, the page says Normal is only the default', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'wording; run once');
  backend.tables.system_mode = [];
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await expect(page.locator('#systemModeWrap')).toContainText('No mode has been saved in the database yet');
});

// EM-03 / EM-05 (2026-10-06): unknown must never read as zero or "off".
test('Business Health shows "?" for paused agents when the agent switches cannot be read', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'wording; run once');
  await page.route(url => new URL(url).pathname.endsWith('/rest/v1/agent_controls'), route =>
    route.request().method() === 'GET' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"SYNTHETIC outage"}' }) : route.fallback());
  await login(page);
  await gotoPage(page, 'attentionPanel');
  await expect(page.locator('#attentionPanel')).toContainText('Paused agents (switches could not be read)');
});

test('with no Shopify Order Sync switch row, the flags page says its state is unknown', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'wording; run once');
  backend.tables.feature_flags = [{ id: 'ff-x', flag_key: 'other_flag', label: 'SYNTHETIC other', description: null, enabled: false }];
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await expect(page.locator('.flagSyncMissing')).toContainText('not configured');
});
