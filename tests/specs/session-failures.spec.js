// Session / sign-in failures while the dashboard is open (2026-10-06, EXT3
// workstream 14). No false "saved", no page that looks empty-but-normal, no
// endless spinner, no destructive retry.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'session logic; run once'); });

const task = { id: 't1', title: 'SYNTHETIC task', priority: 'normal', status: 'open', due_at: '2026-12-01T00:00:00Z' };
const tableReads = backend => backend.requests.filter(r => r.table && r.method === 'GET');

test('signed out in another tab: this tab leaves the dashboard at once and says why', async ({ page, backend }) => {
  backend.tables.tasks = [task];
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await expect(page.locator('#tasksTableWrap .taskTitle')).toHaveText('SYNTHETIC task');
  // The second tab shares the same browser storage, like a real second tab.
  const other = await page.context().newPage();
  await other.goto(page.url());
  await expect(other.locator('#dash')).toBeVisible();
  await other.click('#signout');
  await expect(other.locator('#loginScreen')).toBeVisible();
  // First tab
  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('#dash')).toBeHidden();
  await expect(page.locator('#loginMsg')).toContainText('You were signed out');
});

test('signing out with this tab\'s own button shows the login screen without the "signed out elsewhere" note', async ({ page }) => {
  await login(page);
  await page.click('#signout');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('#loginMsg')).not.toContainText('You were signed out');
});

test('sign-in expired during a save: says so, nothing claimed as saved, nothing changed', async ({ page, backend }) => {
  backend.tables.tasks = [task];
  enableWrites(backend, ['tasks']);
  await login(page);
  await gotoPage(page, 'tasksPanel');
  backend.failNext('tasks', 'PATCH', { status: 401, body: { code: 'PGRST301', message: 'JWT expired' } });
  await page.locator('#tasksTableWrap .taskStatusBtn', { hasText: 'Mark in progress' }).click();
  await expect(page.locator('#dashError')).toContainText('Sign in again');
  await expect(page.locator('#toastHost .toast.ok')).toHaveCount(0);
  expect(backend.tables.tasks[0].status).toBe('open');
});

test('sign-in expired while a page loads: an error, never an empty "No open tasks" page', async ({ page, backend }) => {
  backend.tables.tasks = [task];
  enableWrites(backend, ['tasks']);
  await login(page);
  await page.waitForLoadState('networkidle'); // the first load has finished
  backend.failNext('tasks', 'GET', { status: 401, body: { code: 'PGRST301', message: 'JWT expired' } });
  await gotoPage(page, 'tasksPanel');
  await page.click('#refreshBtn');
  await expect(page.locator('#dashError')).toContainText('Sign in again');
  await expect(page.locator('#tasksTableWrap')).not.toContainText('No open tasks');
});

test('reloading after signing out shows the login screen and reads no business data', async ({ page, backend }) => {
  await login(page);
  await page.click('#signout');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await page.waitForLoadState('networkidle'); // reads started before signing out have finished
  const before = tableReads(backend).length;
  await page.reload();
  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('#dash')).toBeHidden();
  await page.waitForLoadState('networkidle');
  expect(tableReads(backend).length).toBe(before);
});

test('opening the page directly with no session reads no business data', async ({ page, backend }) => {
  await page.goto('/owner-login.html');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(tableReads(backend)).toEqual([]);
});
