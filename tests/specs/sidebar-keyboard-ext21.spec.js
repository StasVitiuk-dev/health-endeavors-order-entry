// The left menu works from the keyboard (Nov 15). Found by a sweep of every
// page for things that react to a mouse click but cannot be reached with Tab:
// the menu's page links were the only ones — and that is the main way around
// the dashboard. Tab stopped only on the small pin stars inside them; a screen
// reader was not told they were links, nor which page is the current one.
// Search results and the "all orders" lookup results were built the same way.
// Computer size (keyboard). Not a real screen-reader check.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { seedBusiness } = require('../fixtures/business-data');
const { seedEveryPage } = require('../fixtures/every-page-rows');

test.beforeEach(async ({}, ti) => { test.skip(ti.project.name !== 'desktop', 'keyboard; run once'); });

test('every page link in the menu takes Tab focus, says it is a link, and marks the current page', async ({ page }) => {
  await login(page);
  const r = await page.evaluate(() => [...document.querySelectorAll('#sidebarGroups .sidebarLink')].filter(a => a.getClientRects().length).map(a => ({
    page: a.getAttribute('data-page'), tab: a.tabIndex, role: a.getAttribute('role') || (a.hasAttribute('href') ? 'link' : ''), current: a.getAttribute('aria-current'), active: a.classList.contains('active'),
  })));
  expect(r.length).toBeGreaterThanOrEqual(20);
  expect(r.filter(x => x.tab !== 0).map(x => x.page)).toEqual([]);
  expect(r.filter(x => x.role !== 'link').map(x => x.page)).toEqual([]);
  expect(r.filter(x => x.active).length).toBe(1);
  expect(r.filter(x => (x.current === 'page') !== x.active).map(x => x.page)).toEqual([]);
});

test('Enter on a menu link opens that page, keeps focus on the link and tells a screen reader', async ({ page }) => {
  await login(page);
  const link = () => page.locator('#sidebarGroups .sidebarLink[data-page="expensesPanel"]:not(.searchResultLink)').first();
  await link().focus();
  await expect(link()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('section#expensesPanel')).toHaveClass(/activePage/);
  await expect(link()).toBeFocused();                       // the menu is redrawn; focus is put back
  await expect(link()).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#srAnnounce')).toContainText('Expenses');
});

test('a mouse click on a menu link leaves no focus on it, so "hover a row and press Space" still opens the record history', async ({ page, backend }) => {
  seedBusiness(backend);
  await login(page);
  await page.locator('#sidebarGroups .sidebarLink[data-page="ordersPanel"]:not(.searchResultLink)').first().click();
  await expect(page.locator('section#ordersPanel')).toHaveClass(/activePage/);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.waitForLoadState('networkidle');
  await page.locator('#ordersTableWrap tbody tr').first().hover();
  await page.keyboard.press(' ');
  await expect(page.locator('#inspectorOverlay.open')).toBeVisible();
  await page.keyboard.press('Escape');
  // From the keyboard, Space on a focused menu link does not open a page (Enter does).
  const tasks = page.locator('#sidebarGroups .sidebarLink[data-page="tasksPanel"]:not(.searchResultLink)').first();
  await tasks.focus();
  await page.mouse.move(5, 5);
  await page.keyboard.press(' ');
  await expect(page.locator('section#ordersPanel')).toHaveClass(/activePage/);
});

test('Tab alone walks from one page link to the next; the pin star still works and does not change page', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'ordersPanel');
  const first = page.locator('#sidebarGroups .sidebarLink').first();
  await first.focus();
  const stops = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => { const a = document.activeElement; return a.classList.contains('sidebarLink') ? 'link' : a.classList.contains('pinBtn') ? 'pin' : a.tagName; }));
  }
  expect(stops.filter(s => s === 'link').length).toBeGreaterThanOrEqual(3);
  // Enter on a pin star pins the page; it does not open it.
  const pin = page.locator('#sidebarGroups .pinBtn[data-pin-page="returnsPanel"]').first();
  await pin.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('section#ordersPanel')).toHaveClass(/activePage/);
  await expect(page.locator('#sidebarGroups .pinBtn.pinned[data-pin-page="returnsPanel"]').first()).toBeVisible();
});

test('search results in the menu can be reached and opened with the keyboard', async ({ page, backend }) => {
  seedBusiness(backend); seedEveryPage(backend);
  await login(page);
  await page.waitForLoadState('networkidle');
  await page.locator('#sidebarSearch').fill('SYN-1001');
  const result = page.locator('#sidebarGroups .searchResultLink', { hasText: 'SYNTHETIC Customer One' }).first();
  await expect(result).toBeVisible();
  expect(await result.evaluate(a => ({ tab: a.tabIndex, role: a.getAttribute('role') }))).toEqual({ tab: 0, role: 'link' });
  await result.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('section#ordersPanel')).toHaveClass(/activePage/);
});

test('nothing on any page reacts to a mouse click without being reachable from the keyboard', async ({ page, backend }) => {
  test.setTimeout(240000);
  seedBusiness(backend); seedEveryPage(backend);
  await login(page);
  const ids = await page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-page')))]);
  const mouseOnly = [];
  for (const p of ids) {
    await gotoPage(page, p);
    await page.waitForLoadState('networkidle');
    const found = await page.evaluate(() => {
      // Shown as clickable (pointer cursor) but neither a real control nor
      // inside one, and with no tab stop of its own.
      const REAL = 'a[href], button, input, select, textarea, summary, label, [tabindex], [contenteditable]';
      const res = new Set();
      document.querySelectorAll('#dash *').forEach(el => {
        if (!el.getClientRects().length || getComputedStyle(el).cursor !== 'pointer' || el.closest(REAL)) return;
        const up = el.parentElement;
        if (up && getComputedStyle(up).cursor === 'pointer' && !up.closest(REAL)) return;   // name the outermost one only
        res.add(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''));
      });
      return [...res];
    });
    found.forEach(f => mouseOnly.push(p + ': ' + f));
  }
  expect(mouseOnly).toEqual([]);
});

test('the menu keeps keyboard focus when it is redrawn (numbers refresh, a group is folded, a page is pinned)', async ({ page, backend }) => {
  seedBusiness(backend);
  await login(page);
  // Focus a link while the page is still loading: the menu is redrawn as the numbers arrive.
  const link = () => page.locator('#sidebarGroups .sidebarLink[data-page="tasksPanel"]:not(.searchResultLink)').first();
  await link().focus();
  await page.waitForLoadState('networkidle');
  await page.locator('#refreshBtn').click();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
  await link().focus();
  await page.evaluate(() => document.getElementById('sidebarSearch').dispatchEvent(new Event('input')));   // forces a redraw
  await expect(link()).toBeFocused();
  // Folding a group with the keyboard keeps focus on its heading button.
  const toggle = page.locator('#sidebarGroups .groupToggle').first();
  const name = await toggle.getAttribute('data-group');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`#sidebarGroups .groupToggle[data-group="${name}"]`)).toBeFocused();
  await page.keyboard.press('Enter');
  // Pinning with the keyboard keeps focus on a pin star for the same page.
  const pin = page.locator('#sidebarGroups .pinBtn[data-pin-page="returnsPanel"]').first();
  await pin.focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => { const a = document.activeElement; return a.classList.contains('pinBtn') && a.getAttribute('data-pin-page'); })).toBe('returnsPanel');
});
