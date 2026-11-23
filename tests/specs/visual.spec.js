// Screenshot baselines of the main pages, at desktop and iPhone size, with
// synthetic data and a frozen clock. They catch layout and style changes, for
// example when the CSS is moved into its own file.
//
// Screenshots depend on the operating system's fonts, so the saved images are
// for Linux (the environment Claude runs tests in). If a change is meant to
// alter how a page looks, regenerate and review the images in the PR:
//   npx playwright test --config tests/playwright.config.js visual --update-snapshots

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { NOW, seedBusiness } = require('../fixtures/business-data');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

const PAGES = ['attentionPanel', 'ordersPanel', 'inventoryPanel', 'returnsPanel', 'expensesPanel', 'accountingPanel', 'taxRecordsPanel', 'tasksPanel'];

async function settle(page) {
  await page.waitForLoadState('networkidle');
  // Let number animations and toasts finish.
  await page.waitForTimeout(1500);
  await page.mouse.move(0, 0);
}

test('login screen', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto('/owner-login.html');
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(page).toHaveScreenshot('login.png', { animations: 'disabled' });
});

test.describe('pages', () => {
  test.beforeEach(async ({ page, backend }) => {
    seedBusiness(backend);
    // The shared task fixtures use dates relative to the real "now"; pin
    // them to the frozen clock so the Tasks screenshot never drifts.
    backend.tables.tasks.forEach((t, i) => {
      t.due_at = new Date(NOW.getTime() + (i - 2) * 86400000).toISOString();
      t.created_at = new Date(NOW.getTime() - 5 * 86400000).toISOString();
    });
    await page.clock.setFixedTime(NOW);
    await login(page);
    await settle(page);
  });

  for (const id of PAGES) {
    test(id, async ({ page }) => {
      await gotoPage(page, id);
      await settle(page);
      await expect(page.locator(`section#${id}`)).toHaveScreenshot(`${id}.png`, { animations: 'disabled', caret: 'hide' });
    });
  }

  test('dark theme: Orders', async ({ page }) => {
    await page.click('#themeBtn');
    await page.click('#themeBtn');
    await gotoPage(page, 'ordersPanel');
    await settle(page);
    await expect(page).toHaveScreenshot('orders-dark.png', { animations: 'disabled', caret: 'hide' });
  });
});
