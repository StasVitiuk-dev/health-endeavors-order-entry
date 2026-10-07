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

// EXT6 (workstream 10): a shared computer. Signing out used to only HIDE the
// dashboard: every customer name, inquiry and figure already loaded stayed
// in the page (and in memory: search, export), visible to the next person
// who opens the browser's tools or signs in on the same tab.
test.describe('shared computer: nothing from the last session stays after sign-out', () => {
  const PRIVATE = 'SYNTHETIC Private Customer Q';
  function seedPrivate(backend) {
    backend.tables.orders = [{ id: 'ord-priv', order_number: 'PRIV-1', customer_name: PRIVATE, customer_email: 'private.q@example.test',
      status: 'paid', currency: 'USD', total: '123.45', tax_total: '0', placed_at: new Date().toISOString(), deleted_at: null,
      source: 'manual', raw_data: null, created_at: new Date().toISOString() }];
  }
  const pageHolds = (page, text) => page.evaluate(t => document.documentElement.innerHTML.includes(t), text);

  test("after this tab's Sign out button, the page holds none of the previous data", async ({ page, backend }) => {
    seedPrivate(backend);
    await login(page);
    await expect.poll(() => pageHolds(page, PRIVATE)).toBe(true); // loaded somewhere on the dashboard
    await page.click('#signout');
    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect.poll(() => pageHolds(page, PRIVATE)).toBe(false);
    expect(await pageHolds(page, 'private.q@example.test')).toBe(false);
    expect(await pageHolds(page, '$123.45')).toBe(false);
  });

  test('after a sign-out in another tab, this tab holds none of the previous data, and says why', async ({ page, backend }) => {
    seedPrivate(backend);
    await login(page);
    await expect.poll(() => pageHolds(page, PRIVATE)).toBe(true);
    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(other.locator('#dash')).toBeVisible();
    await other.click('#signout');
    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect(page.locator('#loginMsg')).toContainText('You were signed out');
    await expect.poll(() => pageHolds(page, PRIVATE)).toBe(false);
  });

  test('the next person signing in on the same tab (an employee) never sees the previous data', async ({ page, backend }) => {
    seedPrivate(backend);
    await login(page);
    await expect.poll(() => pageHolds(page, PRIVATE)).toBe(true);
    await page.click('#signout');
    await expect(page.locator('#loginScreen')).toBeVisible();
    backend.tables.orders = []; // the employee's account cannot read these orders
    backend.tables.profiles[0].role = 'employee';
    await login(page);
    await page.waitForLoadState('networkidle');
    expect(await pageHolds(page, PRIVATE)).toBe(false);
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('Private Customer');
    await expect(page.locator('#paletteResults')).not.toContainText(PRIVATE);
  });
});
