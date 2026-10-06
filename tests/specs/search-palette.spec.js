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
