// General dashboard checks: loading, layout, navigation. Runs at desktop
// (1100px) and iPhone (390px) sizes; see playwright.config.js.
const { test, expect, login, gotoPage, unfoldSidebar, openMenuIfMobile, openTasks, OWNER_USER } = require('../helpers/dashboard');

async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

async function allPageIds(page) {
  await openMenuIfMobile(page);
  await unfoldSidebar(page);
  return page.locator('#sidebarGroups .sidebarLink[data-page]').evaluateAll(
    links => [...new Set(links.filter(l => !l.classList.contains('searchResultLink')).map(l => l.getAttribute('data-page')))]
  );
}

test('login page loads without JavaScript errors', async ({ page, pageErrors }) => {
  await page.goto('/owner-login.html');
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(page.locator('#scriptError')).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test('wrong password is rejected with a message', async ({ page }) => {
  await page.goto('/owner-login.html');
  await page.fill('#email', OWNER_USER.email);
  await page.fill('#password', 'wrong-password');
  await page.click('#loginBtn');
  await expect(page.locator('#loginMsg')).toContainText(/invalid/i);
  await expect(page.locator('#dash')).toBeHidden();
});

test('dashboard loads every panel without JavaScript errors', async ({ page, pageErrors, backend }) => {
  await login(page);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#scriptError')).toBeHidden();
  await expect(page.locator('#dashError')).toBeHidden();
  expect(pageErrors).toEqual([]);
  // Just looking at the dashboard never changes any data.
  expect(backend.tableWrites()).toEqual([]);
});

test('no important horizontal overflow on the home page and Tasks page', async ({ page }) => {
  await login(page);
  await page.waitForLoadState('networkidle');
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  await openTasks(page);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test('every sidebar page opens without errors', async ({ page, pageErrors, backend }) => {
  await login(page);
  const ids = await allPageIds(page);
  expect(ids.length).toBeGreaterThanOrEqual(20);
  for (const id of ids) {
    await gotoPage(page, id);
    await expect(page.locator('main.contentArea > section.panel.activePage')).toHaveCount(1);
  }
  await page.waitForLoadState('networkidle');
  expect(pageErrors).toEqual([]);
  expect(backend.tableWrites()).toEqual([]);
});

test('the last page you were on is remembered after a reload', async ({ page }) => {
  await login(page);
  await openTasks(page);
  await page.reload();
  await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('section#tasksPanel')).toHaveClass(/activePage/);
});

test('sidebar search finds a task; clicking the result opens the Tasks page', async ({ page }) => {
  await login(page);
  await openMenuIfMobile(page);
  await page.fill('#sidebarSearch', 'SYNTHETIC in-progress');
  const result = page.locator('#sidebarGroups .searchResultLink', { hasText: 'SYNTHETIC in-progress task' });
  await expect(result).toContainText('Task');
  await result.click();
  await expect(page.locator('section#tasksPanel')).toHaveClass(/activePage/);
});

// Was a known issue (Enter opened the first Guide result, so "incidents"
// opened Quality Control). Fixed 2026-10-06 (EXT3): a page name wins.
test('typing a page name in search and pressing Enter opens that page', async ({ page }) => {
  await login(page);
  await openMenuIfMobile(page);
  await page.fill('#sidebarSearch', 'incidents');
  await page.press('#sidebarSearch', 'Enter');
  await expect(page.locator('section#incidentsPanel')).toHaveClass(/activePage/);
});

test('sign out returns to the login screen', async ({ page }) => {
  await login(page);
  await page.click('#signout');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('#dash')).toBeHidden();
});

test.describe('desktop layout (about 1100px)', () => {
  test.skip(({ viewport }) => viewport.width < 1000, 'desktop only');

  test('sidebar is always visible and the menu button is hidden', async ({ page }) => {
    await login(page);
    await expect(page.locator('#sidebarNav')).toBeVisible();
    await expect(page.locator('#menuToggleBtn')).toBeHidden();
    const nav = await page.locator('#sidebarNav').boundingBox();
    const main = await page.locator('main.contentArea').boundingBox();
    expect(main.x).toBeGreaterThanOrEqual(nav.x + nav.width - 1);
  });
});

test.describe('iPhone layout (about 390px)', () => {
  test.skip(({ viewport }) => viewport.width > 500, 'phone only');

  test('menu button opens and closes the sidebar', async ({ page }) => {
    await login(page);
    const nav = page.locator('#sidebarNav');
    await expect(page.locator('#menuToggleBtn')).toBeVisible();
    await expect(nav).not.toHaveClass(/mobileOpen/);
    await page.click('#menuToggleBtn');
    await expect(nav).toHaveClass(/mobileOpen/);
    await page.locator('#sidebarOverlay').click({ position: { x: 370, y: 400 } });
    await expect(nav).not.toHaveClass(/mobileOpen/);
  });

  test('picking a page closes the menu', async ({ page }) => {
    await login(page);
    await openTasks(page);
    await expect(page.locator('#sidebarNav')).not.toHaveClass(/mobileOpen/);
  });

  test('header fits on screen', async ({ page }) => {
    await login(page);
    for (const sel of ['#menuToggleBtn', '#refreshBtn', '#signout']) {
      const box = await page.locator(sel).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  });
});
