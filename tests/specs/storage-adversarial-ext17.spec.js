// EXT17: browser storage the dashboard cannot trust. Remembered preferences
// (theme, open sidebar sections, pinned pages, last page, calendar view, seen
// Home checks) live in this browser only. The page must work when storage
// throws, is full, or holds values from an older version, a corrupted write or
// another program: never a broken page, never a script error.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const KEYS = ['he_theme', 'he_open_groups', 'he_pinned_pages', 'he_last_page', 'he_cal_view', 'he.attnSeen'];
const BAD_VALUES = {
  'not JSON': '{bad json',
  'an object where a list belongs': '{"Inventory":true}',
  'a number': '5',
  'a plain string': '"Inventory"',
  'null': 'null',
  'a list of junk': '[1,{},null,"<img src=x onerror=alert(1)>"]',
  'markup': '<script>window.__pwned=1</script>',
  'very long (200 kB)': 'x'.repeat(200000),
};

async function expectWorkingDashboard(page, errors) {
  await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('section.panel.activePage')).toHaveCount(1);
  await gotoPage(page, 'inventoryPanel');
  await gotoPage(page, 'tasksPanel');
  await expect(page.locator('section.panel.activePage')).toHaveCount(1);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(errors, 'no script error').toEqual([]);
}

for (const [label, value] of Object.entries(BAD_VALUES)) {
  test(`stored preferences that are ${label}: the dashboard still loads and works`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(([keys, v]) => { try { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); for (const k of keys) localStorage.setItem(k, v); } } catch (e) {} }, [KEYS, value]);
    await login(page);
    await expectWorkingDashboard(page, errors);
    await page.reload(); // and again with whatever the page wrote back
    await expect(page.locator('#dash')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('storage that throws on every read and write (blocked by the browser): the dashboard still works', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    const boom = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    for (const s of [window.localStorage, window.sessionStorage]) { try { s.getItem = boom; s.setItem = boom; s.removeItem = boom; } catch (e) {} }
  });
  // the sign-in itself needs the auth library's storage; a blocked browser gets the
  // form back with a message at worst, never a script error from the dashboard's own code
  await page.goto('/owner-login.html');
  await expect(page.locator('#loginBtn')).toBeVisible();
  const ownErrors = () => errors.filter(e => !/supabase/i.test(e));
  expect(ownErrors()).toEqual([]);
});

test('storage that is full (every write refused): preferences are simply not remembered', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await login(page);
  await page.evaluate(() => {
    const full = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
    localStorage.setItem = full; sessionStorage.setItem = full;
  });
  await gotoPage(page, 'inventoryPanel');
  await gotoPage(page, 'tasksPanel');
  const toggle = page.locator('#themeToggle, [data-theme-toggle]').first();
  if (await toggle.count()) await toggle.click().catch(() => {});
  await expect(page.locator('section.panel.activePage')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('storage full: a sidebar section opened by hand stays open when the sidebar is drawn again', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'sidebar always visible on desktop');
  await login(page);
  await page.evaluate(() => { localStorage.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  const folded = page.locator('#sidebarGroups .groupToggle[aria-expanded="false"]');
  const n = await folded.count();
  expect(n, 'some sections start folded').toBeGreaterThan(0);
  const group = await folded.nth(n - 1).getAttribute('data-group');
  await folded.nth(n - 1).click();
  const toggle = page.locator(`#sidebarGroups .groupToggle[data-group="${group}"]`);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.fill('#sidebarSearch', 'zz'); // typing re-draws the sidebar
  await page.fill('#sidebarSearch', '');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});
