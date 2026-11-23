// Responsive check at widths the two main projects don't cover (2026-10-06):
// a narrow desktop window (800px) and a tablet (768px). Each page must open
// without sideways scrolling, and the key workflow buttons must be visible
// and clickable. Desktop project only (it sets its own viewport sizes).

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

for (const width of [800, 768]) {
  test.describe(`${width}px wide`, () => {
    test.beforeEach(async ({ page, backend }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'sets its own viewport');
      await page.setViewportSize({ width, height: 900 });
      seedBusiness(backend);
      await page.clock.setFixedTime(NOW);
      await login(page);
      await page.waitForLoadState('networkidle');
    });

    test('no page scrolls sideways', async ({ page }) => {
      test.setTimeout(180000);
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

    test('key workflow buttons are visible and clickable', async ({ page }) => {
      const checks = [
        ['tasksPanel', '.taskStatusBtn'],
        ['returnsPanel', '.decideReturnBtn, .markReceivedBtn, .advanceReturnBtn'],
        ['inventoryPanel', '#adjustInventoryForm button[type=submit]'],
        ['purchaseOrdersPanel', '#addPoForm button[type=submit]'],
        ['documentsPanel', '#addDocumentForm button[type=submit]'],
        ['expensesPanel', '#addExpenseForm button[type=submit]'],
      ];
      const problems = [];
      for (const [id, sel] of checks) {
        await gotoPage(page, id);
        await page.waitForLoadState('networkidle');
        const btn = page.locator(`section#${id} ${sel.split(', ').join(`, section#${id} `)}`).first();
        if (!(await btn.count())) { problems.push(`${id}: no ${sel}`); continue; }
        await btn.scrollIntoViewIfNeeded();
        if (!(await btn.isVisible())) { problems.push(`${id}: ${sel} hidden`); continue; }
        await btn.click({ trial: true }).catch(e => problems.push(`${id}: ${sel} not clickable (${e.message.split('\n')[0]})`));
      }
      expect(problems).toEqual([]);
    });
  });
}
