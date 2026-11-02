// EXT7 (workstream G): sign-in/session chaos on a shared computer.
// Synthetic data only; the session in browser storage is changed the way a
// second tab would change it.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'session logic; run once'); });

const storedSessionKey = page => page.evaluate(() => Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k)));

test('the signed-in person changes in another tab: this tab wipes the previous person\'s data at once', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await expect(page.locator('#tasksTableWrap')).toContainText('SYNTHETIC open task one');
  await page.evaluate(() => { window.__beforeSwitch = true; });
  const key = await storedSessionKey(page);
  expect(key).toBeTruthy();
  const other = await page.context().newPage();
  await other.goto('about:blank');
  await other.goto(page.url().split('#')[0].replace(/[^/]*$/, '') + 'owner-login.html');
  await other.evaluate(k => {
    const s = JSON.parse(localStorage.getItem(k));
    s.user = { ...s.user, id: '00000000-0000-4000-8000-0000000000bb', email: 'second.person@example.test' };
    localStorage.setItem(k, JSON.stringify(s));
    // What the sign-in library in a second tab announces to the other tabs.
    new BroadcastChannel(k).postMessage({ event: 'SIGNED_IN', session: s });
  }, key);
  // This tab must not keep showing the first person's data to the second.
  await expect.poll(() => page.evaluate(() => window.__beforeSwitch === true).catch(() => false), { timeout: 10000 }).toBe(false);
});

test('a routine sign-in refresh for the SAME person changes nothing on the page', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await page.evaluate(() => { window.__beforeRefresh = true; });
  const key = await storedSessionKey(page);
  const other = await page.context().newPage();
  await other.goto(page.url().split('#')[0].replace(/[^/]*$/, '') + 'owner-login.html');
  await other.evaluate(k => {
    const s = JSON.parse(localStorage.getItem(k));
    new BroadcastChannel(k).postMessage({ event: 'TOKEN_REFRESHED', session: s });
    new BroadcastChannel(k).postMessage({ event: 'SIGNED_IN', session: s });
  }, key);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__beforeRefresh)).toBe(true);
  await expect(page.locator('#tasksTableWrap')).toContainText('SYNTHETIC open task one');
});

test('manual order page: a different person signing in elsewhere clears the typed order and the unfinished attempt', async ({ page, backend }) => {
  backend.blocked = [];
  await page.goto('/manual-order-entry.html');
  const { OWNER_USER } = require('../helpers/dashboard');
  await page.fill('#loginEmail', OWNER_USER.email);
  await page.fill('#loginPassword', OWNER_USER.password);
  await page.click('#loginBtn');
  await expect(page.locator('#appView')).toBeVisible();
  await page.fill('#customerName', 'SYNTHETIC first person customer');
  await page.evaluate(() => sessionStorage.setItem('he.manualOrder.pending', JSON.stringify({ orderNumber: 'MAN-SYN-1', total: 5 })));
  const key = await storedSessionKey(page);
  const other = await page.context().newPage();
  await other.goto('/manual-order-entry.html');
  await other.evaluate(k => {
    const s = JSON.parse(localStorage.getItem(k));
    s.user = { ...s.user, id: '00000000-0000-4000-8000-0000000000bb', email: 'second.person@example.test' };
    localStorage.setItem(k, JSON.stringify(s));
    new BroadcastChannel(k).postMessage({ event: 'SIGNED_IN', session: s });
  }, key);
  await expect.poll(() => page.evaluate(() => document.getElementById('customerName').value).catch(() => 'reloading'), { timeout: 10000 }).toBe('');
  expect(await page.evaluate(() => sessionStorage.getItem('he.manualOrder.pending'))).toBe(null);
});

test.afterEach(({ backend }) => { backend.blocked = backend.blocked.filter(u => !u.startsWith('https://fonts.googleapis.com/')); });

test('restored from the Back-button cache after a sign-out elsewhere: the page is wiped', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'tasksPanel');
  const key = await storedSessionKey(page);
  // The sign-out happened while the page was frozen: the session is gone.
  await page.evaluate(k => localStorage.removeItem(k), key);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('#loginMsg')).toContainText('signed out while this page was in the background');
});

test('restored from the Back-button cache, still signed in as the same person: nothing changes', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await page.evaluate(() => { window.__marker = 1; window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__marker)).toBe(1);
  await expect(page.locator('#tasksTableWrap')).toContainText('SYNTHETIC open task one');
});
