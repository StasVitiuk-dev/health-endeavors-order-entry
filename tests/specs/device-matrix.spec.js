// Device / zoom matrix (2026-10-06, EXT3 workstream 16). The two main test
// projects cover 1100 px (desktop) and 390 px (iPhone); responsive-widths
// covers 800 and 768. This adds the rest. 640 px is a 1280 px window at 200%
// zoom; 320 px is 400% zoom (WCAG 1.4.10 reflow). On every page: no sideways
// scrolling, the key workflow buttons are visible and clickable, and the
// password dialog fits on screen.

const { test, expect, login, gotoPage, openMenuIfMobile } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

const SIZES = [
  { name: '320 px (400% zoom)', width: 320, height: 640 },
  { name: '360 px phone', width: 360, height: 740 },
  { name: '430 px large phone', width: 430, height: 932 },
  { name: '640 px (200% zoom)', width: 640, height: 720 },
  { name: '1024 px tablet landscape', width: 1024, height: 768 },
  { name: '1280 px laptop', width: 1280, height: 800 },
  { name: '1440 px desktop', width: 1440, height: 900 },
  { name: 'very tall screen', width: 390, height: 1400 },
  { name: 'short laptop screen', width: 1280, height: 600 },
];

const KEY_BUTTONS = [
  ['tasksPanel', '.taskStatusBtn'],
  ['returnsPanel', '.decideReturnBtn'],
  ['inventoryPanel', '#adjustInventoryForm button[type=submit]'],
  ['purchaseOrdersPanel', '#addPoForm button[type=submit]'],
  ['expensesPanel', '#addExpenseForm button[type=submit]'],
  ['ordersPanel', '.deleteOrderBtn'],
];

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.beforeEach(async ({ page, backend }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'sets its own viewport');
      await page.setViewportSize({ width: size.width, height: size.height });
      seedBusiness(backend);
      await page.clock.setFixedTime(NOW);
      await login(page);
      await page.waitForLoadState('networkidle');
    });

    test('no page scrolls sideways', async ({ page }) => {
      test.setTimeout(240000);
      const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
      const wide = [];
      for (const id of ids) {
        await gotoPage(page, id);
        await page.waitForLoadState('networkidle');
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 1) wide.push(`${id}: ${over}px`);
      }
      expect(wide).toEqual([]);
    });

    test('key workflow buttons are visible and clickable; the password dialog fits on screen', async ({ page }) => {
      test.setTimeout(120000);
      const problems = [];
      for (const [id, sel] of KEY_BUTTONS) {
        await gotoPage(page, id);
        await page.waitForLoadState('networkidle');
        const btn = page.locator(`section#${id} ${sel}`).first();
        if (!(await btn.count())) { problems.push(`${id}: no ${sel}`); continue; }
        await btn.scrollIntoViewIfNeeded();
        if (!(await btn.isVisible())) { problems.push(`${id}: ${sel} hidden`); continue; }
        await btn.click({ trial: true }).catch(e => problems.push(`${id}: ${sel} not clickable (${e.message.split('\n')[0]})`));
      }
      // password dialog from Orders → Delete
      await gotoPage(page, 'ordersPanel');
      await page.locator('#ordersTableWrap .deleteOrderBtn').first().click();
      await expect(page.locator('#reauthOverlay')).toBeVisible();
      for (const s of ['#reauthPassword', '#reauthConfirmBtn', '#reauthCancelBtn']) {
        const box = await page.locator(s).boundingBox();
        if (!box || box.x < 0 || box.y < 0 || box.x + box.width > size.width + 1 || box.y + box.height > size.height + 1) problems.push(`password dialog: ${s} outside the screen ${JSON.stringify(box)}`);
      }
      await page.keyboard.press('Escape');
      expect(problems).toEqual([]);
    });
  });
}
