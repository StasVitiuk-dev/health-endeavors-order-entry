// EXT17: isolation checker for the opt-in signed-in session reuse
// (HE_FAST_LOGIN=1, tests/helpers/dashboard.js). Before it can ever be switched
// on by default it must be shown that reusing the synthetic session leaks
// nothing between tests. Runs in one worker, in order, with the option forced
// on for this file only:
//   1. a normal form sign-in saves the session and writes a marker row + a
//      browser-storage marker;
//   2. the next test is signed in by restoring the session, and sees a fresh
//      mock database, no marker in storage, and only the auth token restored;
//   3. signing out and reloading really signs out (the restore runs once per
//      page; without that guard the session would come back on reload).
const { test, expect, login } = require('../helpers/dashboard');

test.describe.configure({ mode: 'serial' });
test.describe('signed-in session reuse leaks nothing between tests', () => {
  let before;
  test.beforeAll(() => { before = process.env.HE_FAST_LOGIN; process.env.HE_FAST_LOGIN = '1'; });
  test.afterAll(() => { if (before === undefined) delete process.env.HE_FAST_LOGIN; else process.env.HE_FAST_LOGIN = before; });
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'one worker, in order'); });

  test('1: a form sign-in saves the session; this test leaves markers behind', async ({ page, backend }) => {
    await login(page);
    backend.tables.tasks = (backend.tables.tasks || []).concat([{ id: 'leak-marker', title: 'SYNTHETIC leak marker', status: 'open' }]);
    await page.evaluate(() => { localStorage.setItem('he-leak-marker', 'from test 1'); sessionStorage.setItem('he-leak-marker', 'from test 1'); });
    expect(await page.evaluate(() => Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k)))).toBe(true);
  });

  test('2: the restored test starts clean: fresh database, no storage markers, only the auth token restored', async ({ page, backend }) => {
    const restoredKeys = [];
    await page.exposeFunction('__heSeenKeys', keys => { restoredKeys.push(...keys); });
    await page.addInitScript(() => { window.addEventListener('DOMContentLoaded', () => { try { window.__heSeenKeys(Object.keys(localStorage)); } catch (e) {} }, { once: true }); });
    await login(page);
    expect((backend.tables.tasks || []).some(t => t.id === 'leak-marker'), 'mock database is per test').toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('he-leak-marker'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('he-leak-marker'))).toBeNull();
    expect(restoredKeys.length, 'something was restored').toBeGreaterThan(0);
    for (const k of restoredKeys) expect(k, 'only the synthetic auth token is restored').toMatch(/^sb-.*-auth-token$/);
  });

  test('3: after signing out, a reload stays signed out (the restore runs once per page)', async ({ page }) => {
    await login(page);
    await page.click('#signout');
    await expect(page.locator('#loginBtn')).toBeVisible({ timeout: 15000 });
    await page.reload();
    await expect(page.locator('#loginBtn')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#dash')).toBeHidden();
  });
});
