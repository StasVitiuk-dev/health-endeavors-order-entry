// "Confirm it's you" password prompt: pressing Enter again (or clicking
// Confirm again) while the first check is still running must not start a
// second check. Synthetic data only; the mock answers every request.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const passwordChecks = backend => backend.requests.filter(r =>
  r.path === '/auth/v1/token' && r.body && r.body.password !== undefined);

test.beforeEach(async ({ page, backend }) => {
  backend.tables.orders = [{ id: 'o-1', order_number: 'SYN-3001', customer_name: 'SYNTHETIC', customer_email: 'x@example.test', status: 'paid', currency: 'USD', total: 1, placed_at: '2026-09-01T00:00:00Z', deleted_at: null }];
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await page.waitForLoadState('networkidle');
  const overlay = page.locator('#inspectorOverlay');
  if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
});

test('pressing Enter twice during the check sends one password check', async ({ page, backend }) => {
  const before = passwordChecks(backend).length; // the login itself
  // Hold the password check for a moment, as a slow connection would.
  await page.route('**/auth/v1/token**', async route => { await new Promise(r => setTimeout(r, 800)); await route.fallback(); });
  await page.locator('.deleteOrderBtn').first().click();
  await page.fill('#reauthPassword', OWNER_USER.password);
  await page.press('#reauthPassword', 'Enter');
  await page.press('#reauthPassword', 'Enter');
  await page.press('#reauthPassword', 'Enter');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
  await expect.poll(() => backend.tableWrites().filter(r => r.table === 'orders').length).toBe(1);
  // Any extra checks would also be held for 800ms; wait long enough to see them.
  await page.waitForTimeout(1500);
  expect(passwordChecks(backend).length - before).toBe(1);
});

test('a wrong password can still be corrected and retried', async ({ page, backend }) => {
  await page.locator('.deleteOrderBtn').first().click();
  await page.fill('#reauthPassword', 'not-the-password');
  await page.press('#reauthPassword', 'Enter');
  await expect(page.locator('#reauthMsg')).toContainText("didn't work");
  await page.fill('#reauthPassword', OWNER_USER.password);
  await page.press('#reauthPassword', 'Enter');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
  await expect.poll(() => backend.tableWrites().filter(r => r.table === 'orders').length).toBe(1);
});
