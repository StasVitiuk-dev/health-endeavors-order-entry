// Search, command palette and Record Inspector edge cases (2026-10-06, EXT3
// workstream 17). Enter-opens-the-page is covered in general/ui-chrome.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'keyboard; desktop only'); });

const task = (id, title) => ({ id, title, priority: 'normal', status: 'open', due_at: '2026-12-01T00:00:00Z' });

async function loadTasksThenLeave(page) {
  await gotoPage(page, 'tasksPanel');
  await page.waitForLoadState('networkidle');
  await gotoPage(page, 'ordersPanel');
}

test('two records with the same name both appear in the palette', async ({ page, backend }) => {
  backend.tables.tasks = [task('t-1', 'SYNTHETIC restock lotion'), task('t-2', 'SYNTHETIC restock lotion')];
  await login(page);
  await loadTasksThenLeave(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('restock lotion');
  await expect(page.locator('#paletteResults .pResult', { hasText: 'SYNTHETIC restock lotion' })).toHaveCount(2);
});

test('a very large result set is capped (30 records) and stays responsive; arrow keys move the selection', async ({ page, backend }) => {
  backend.tables.tasks = Array.from({ length: 100 }, (_, i) => task('t-' + i, 'SYNTHETIC bulk task ' + i));
  await login(page);
  await loadTasksThenLeave(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('bulk task');
  await expect(page.locator('#paletteResults .pResult')).toHaveCount(30); // searchEverything keeps the first 30 records
  const first = await page.locator('#paletteResults .pResult.sel').textContent();
  await page.keyboard.press('ArrowDown');
  const second = await page.locator('#paletteResults .pResult.sel').textContent();
  expect(second).not.toBe(first);
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#paletteResults .pResult.sel')).toHaveText(first);
});

test('nothing matching says so, and Enter does nothing', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('zzqqxx');
  await expect(page.locator('#paletteResults')).toContainText('Nothing matches that.');
  await page.keyboard.press('Enter');
  await expect(page.locator('section#ordersPanel')).toHaveClass(/activePage/);
});

test('Record Inspector: a permission refusal on the history is shown in plain words', async ({ page, backend }) => {
  seedBusiness(backend);
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await page.waitForLoadState('networkidle');
  await page.route(/\/rest\/v1\/rpc\/employee_activity$/, route => route.fulfill({
    status: 403, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ code: '42501', message: 'permission denied for function employee_activity' }),
  }));
  // Quick Look: hover a row and press Space
  await page.locator('#ordersTableWrap tbody tr').first().hover();
  await page.keyboard.press(' ');
  await expect(page.locator('#inspectorOverlay.open')).toBeVisible();
  await expect(page.locator('#inspectorOverlay')).toContainText('only the Owner or an Administrator can do it');
  await expect(page.locator('#inspectorOverlay')).not.toContainText('permission denied for function');
});

// EXT4 (workstream U): priority and scale.
test('order of results: pages first, then records, then Guide articles', async ({ page, backend }) => {
  backend.tables.tasks = [task('t-1', 'SYNTHETIC check returns shelf')];
  await login(page);
  await loadTasksThenLeave(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('returns');
  await expect(page.locator('#paletteResults .pResult').first()).toBeVisible();
  const kinds = await page.locator('#paletteResults .pResult .pKind').allTextContents();
  const firstRecord = kinds.indexOf('Task');
  const firstGuide = kinds.indexOf('Guide');
  expect(firstRecord, 'a record is listed').toBeGreaterThan(0); // after the Returns page
  expect(firstGuide, 'a Guide article is listed').toBeGreaterThan(firstRecord);
  expect(kinds.slice(0, firstRecord).every(k => k !== 'Guide' && k !== 'Task'), 'only pages before the first record').toBe(true);
  await expect(page.locator('#paletteResults .pResult.sel .pMain')).toHaveText('Returns'); // Enter opens the page
});

test('10,000 records: each keystroke updates the palette quickly, and the cap holds', async ({ page, backend }) => {
  test.setTimeout(180000);
  // The product list is read whole (the server would cap it at 1,000 and the
  // page would then say so; the mock here has no cap), so 10,000 products put
  // 10,000 records into the search index.
  backend.tables.products = Array.from({ length: 10000 }, (_, i) => ({ id: 'p-' + i, name: 'SYNTHETIC scale product ' + i, sku: 'SC-' + i, is_active: true, status: 'active', cost: null, retail_price: null, wholesale_price: null, packaging_info: null }));
  backend.tables.inventory = backend.tables.products.map(p => ({ product_id: p.id, available: 1, reserved: 0, damaged: 0, sample: 0, wholesale: 0, promotional: 0, returned: 0, recalled: 0, low_stock_threshold: null }));
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  await expect(page.locator('#inventoryWrap [data-product-id="p-9999"]')).toHaveCount(1, { timeout: 90000 });
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#paletteInput')).toBeFocused();
  const ms = await page.evaluate(() => {
    const input = document.getElementById('paletteInput');
    const times = [];
    for (const q of ['s', 'sc', 'sca', 'scale', 'scale product 99']) {
      const t0 = performance.now();
      input.value = q; input.dispatchEvent(new Event('input', { bubbles: true }));
      times.push(performance.now() - t0);
    }
    return Math.max(...times);
  });
  expect(ms, 'slowest keystroke (ms)').toBeLessThan(250);
  const kinds = await page.locator('#paletteResults .pResult .pKind').allTextContents();
  expect(kinds.length).toBeLessThanOrEqual(40);
  expect(kinds.filter(k => k !== 'Guide').length).toBeGreaterThan(0);
});

// EXT5 (workstream 13): odd input and reopening.
test('a 5,000-character query and Unicode / right-to-left text do not break the palette', async ({ page, backend }) => {
  backend.tables.tasks = [task('t-u', 'SYNTHETIC Café 日本 עברית task')];
  await login(page);
  await loadTasksThenLeave(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('#paletteInput').fill('x'.repeat(5000));
  await expect(page.locator('#paletteResults')).toContainText('Nothing matches that.');
  await page.locator('#paletteInput').fill('עברית');
  await expect(page.locator('#paletteResults .pResult', { hasText: 'SYNTHETIC Café 日本 עברית task' })).toHaveCount(1);
  await page.locator('#paletteInput').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#paletteResults img')).toHaveCount(0);
});

test('reopening the palette starts empty, with fresh results (no stale list from last time)', async ({ page, backend }) => {
  backend.tables.tasks = [task('t-1', 'SYNTHETIC alpha task')];
  await login(page);
  await loadTasksThenLeave(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('alpha');
  await expect(page.locator('#paletteResults .pResult', { hasText: 'SYNTHETIC alpha task' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#paletteOverlay.open')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#paletteInput')).toHaveValue('');
  await expect(page.locator('#paletteResults .pResult', { hasText: 'SYNTHETIC alpha task' })).toHaveCount(0);
});
