// EXT8 (workstream G): the browser's Back / Forward move between dashboard
// pages; a link to a page (#page=<id>) opens it after sign-in; the address
// bar only ever holds a page name, never record data. Synthetic data only.

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'navigation logic; run once'); });
async function signInAt(page, url) {
  await page.goto(url);
  await page.fill('#email', OWNER_USER.email);
  await page.fill('#password', OWNER_USER.password);
  await page.click('#loginBtn');
  await expect(page.locator('#dash')).toBeVisible();
}
const active = page => page.locator('main.contentArea > section.panel.activePage');

test('Back and Forward move between dashboard pages, not out of the dashboard', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await gotoPage(page, 'ordersPanel');
  await expect(page).toHaveURL(/#page=ordersPanel$/);
  await page.goBack();
  await expect(active(page)).toHaveAttribute('id', 'tasksPanel');
  await expect(page.locator('#dash')).toBeVisible();
  await page.goForward();
  await expect(active(page)).toHaveAttribute('id', 'ordersPanel');
});

test('a link to a page opens that page after signing in', async ({ page }) => {
  await signInAt(page, '/owner-login.html#page=approvalsPanel');
  await expect(active(page)).toHaveAttribute('id', 'approvalsPanel');
});

test('an unknown page name in the link is ignored (no error, normal start page)', async ({ page }) => {
  await signInAt(page, '/owner-login.html#page=notAPage');
  await expect(active(page)).toHaveCount(1);
  await expect(page.locator('#scriptError')).toBeHidden();
});

test('the address bar never holds record data (only #page=<name>)', async ({ page }) => {
  await login(page);
  for (const id of ['ordersPanel', 'inquiriesPanel', 'tasksPanel']) {
    await gotoPage(page, id);
    expect(new URL(page.url()).hash).toBe('#page=' + id);
    expect(new URL(page.url()).search).toBe('');
  }
});
