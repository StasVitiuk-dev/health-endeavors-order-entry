// EXT7 (workstream J): typed-but-unsaved work is not lost by accident.
// Closing or reloading the tab asks first, and so does Sign out. Saving
// clears it, and a forced sign-out (another tab) never waits on it.
// Synthetic data only.

const { test, expect, login, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'page logic; run once'); });
test.afterEach(({ backend }) => { backend.blocked = backend.blocked.filter(u => !u.startsWith('https://fonts.googleapis.com/')); });

// Tries to close the tab the way a person would; returns the dialog types
// shown. Every question is answered "stay", so the tab is still open after.
async function tryToClose(page) {
  const seen = [];
  const onDialog = d => { seen.push(d.type()); d.dismiss().catch(() => {}); };
  page.on('dialog', onDialog);
  await page.close({ runBeforeUnload: true });
  await new Promise(r => setTimeout(r, 500));
  page.off('dialog', onDialog);
  return { seen, closed: page.isClosed() };
}

test.describe('dashboard', () => {
  test('nothing typed: the tab closes without a question', async ({ page }) => {
    await login(page);
    expect(await tryToClose(page)).toEqual({ seen: [], closed: true });
  });

  test('typed a reminder and did not save: closing asks first', async ({ page }) => {
    await login(page);
    await page.locator('#reminderTitle').pressSequentially('SYNTHETIC call the supplier');
    expect(await tryToClose(page)).toEqual({ seen: ['beforeunload'], closed: false });
  });

  test('after saving the reminder, closing does not ask', async ({ page, backend }) => {
    enableWrites(backend, ['manual_attention_items']);
    await login(page);
    await page.locator('#reminderTitle').pressSequentially('SYNTHETIC call the supplier');
    await page.click('#addReminderForm button[type=submit]');
    await expect(page.locator('#reminderTitle')).toHaveValue('');
    expect(await tryToClose(page)).toEqual({ seen: [], closed: true });
  });

  test('Sign out with unsaved typing asks; "Cancel" keeps you signed in with the text', async ({ page, backend }) => {
    await login(page);
    await page.locator('#reminderTitle').pressSequentially('SYNTHETIC unsaved');
    const messages = [];
    page.once('dialog', d => { messages.push(d.message()); d.dismiss(); });
    await page.click('#signout');
    await expect.poll(() => messages.length).toBe(1);
    expect(messages[0]).toContain('not saved yet');
    await expect(page.locator('#dash')).toBeVisible();
    await expect(page.locator('#reminderTitle')).toHaveValue('SYNTHETIC unsaved');
    expect(backend.requests.filter(r => r.path && r.path.includes('/auth/v1/logout'))).toHaveLength(0);
  });

  test('signed out in another tab: the page is wiped at once even with unsaved typing', async ({ page }) => {
    await login(page);
    await page.locator('#reminderTitle').pressSequentially('SYNTHETIC unsaved');
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.type()); d.dismiss(); });
    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(other.locator('#dash')).toBeVisible();
    await other.click('#signout');
    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect(page.locator('#loginMsg')).toContainText('You were signed out');
    await expect(page.locator('#reminderTitle')).toHaveValue('');
    expect(dialogs).toEqual([]);
  });
});

test.describe('manual order entry', () => {
  async function signIn(page) {
    await page.goto('/manual-order-entry.html');
    await page.fill('#loginEmail', OWNER_USER.email);
    await page.fill('#loginPassword', OWNER_USER.password);
    await page.click('#loginBtn');
    await expect(page.locator('#appView')).toBeVisible();
  }
  async function typeOrder(page) {
    await page.selectOption('#channel', { index: 1 });
    await page.locator('#customerName').pressSequentially('SYNTHETIC Walk-in');
    await page.locator('.item-row .item-name').pressSequentially('SYNTHETIC Lotion');
    await page.fill('.item-row .item-qty', '2');
    await page.fill('.item-row .item-price', '10');
  }

  test('an unsaved order asks before the tab closes', async ({ page }) => {
    await signIn(page);
    await typeOrder(page);
    expect(await tryToClose(page)).toEqual({ seen: ['beforeunload'], closed: false });
  });

  test('a FAILED save keeps the protection; a successful one clears it', async ({ page, backend }) => {
    backend.tables.orders = [];
    backend.tables.order_items = [];
    enableWrites(backend, ['orders', 'order_items']);
    await signIn(page);
    await typeOrder(page);
    backend.failNext('orders', 'POST', { status: 503, body: { message: 'synthetic outage' } });
    await page.click('#orderForm button[type=submit]');
    await expect(page.locator('#formMsg')).toBeVisible();
    const probe = await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
    expect(probe).toBe(true);
    await page.click('#orderForm button[type=submit]');
    await expect(page.locator('#successMsg')).toContainText('Saved');
    expect(await tryToClose(page)).toEqual({ seen: [], closed: true });
  });

  test('Sign out with an unsaved order asks; "Cancel" keeps the order', async ({ page }) => {
    await signIn(page);
    await typeOrder(page);
    const messages = [];
    page.once('dialog', d => { messages.push(d.message()); d.dismiss(); });
    await page.click('#signOutBtn');
    await expect.poll(() => messages.length).toBe(1);
    expect(messages[0]).toContain('not saved yet');
    await expect(page.locator('#customerName')).toHaveValue('SYNTHETIC Walk-in');
  });
});
