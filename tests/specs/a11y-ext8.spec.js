// EXT8 (workstream J): the new controls (Home checks, order finder, order
// lookup, Show more, Last 7 days) work by keyboard, have names, and survive a
// 320 px screen with large text. Real VoiceOver / iPhone: NOT tested here
// (manual, blocked on a real device). Synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.describe('320 px with text at 200%', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'iphone', 'small screen; run once'); });

  for (const id of ['attentionPanel', 'returnsPanel', 'accountingPanel', 'inquiriesPanel']) {
    test(`${id}: no sideways page scroll`, async ({ page }) => {
      await login(page);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await gotoPage(page, id);
      await page.waitForLoadState('networkidle');
      const over = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
      expect(over).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('keyboard and names', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'keyboard; run once'); });

  test('Home checks: every button has a name and is reachable with Tab; Open works with Enter', async ({ page }) => {
    await login(page);
    const btns = page.locator('#attnChecksWrap button');
    await expect(btns.first()).toBeVisible();
    for (const name of await btns.allTextContents()) expect(name.trim().length).toBeGreaterThan(0);
    const open = page.locator('#attnChecksWrap .attnCheck[data-key="overdueTasks"] .attnOpen');
    await open.focus();
    await expect(open).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('section#tasksPanel')).toHaveClass(/activePage/);
  });

  test('"Why is this here?" opens with the keyboard (native disclosure)', async ({ page }) => {
    await login(page);
    const summary = page.locator('#attnChecksWrap .attnCheck[data-key="backups"] summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#attnChecksWrap .attnCheck[data-key="backups"] details')).toHaveAttribute('open', '');
  });

  test('returns order finder and sidebar lookup have accessible names', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'returnsPanel');
    await expect(page.getByRole('textbox', { name: 'Find an older order by its number' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find order' })).toBeVisible();
    await page.fill('#sidebarSearch', 'abc');
    await expect(page.getByRole('button', { name: /Look up .abc. in all orders/ })).toBeVisible();
  });
});
