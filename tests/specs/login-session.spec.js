// Login and session behaviour: inactive accounts, "Forgot your password?",
// and what a non-owner account sees on the Calendar page. Verifies existing
// behaviour; synthetic data only (the mock answers every request).

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const authCalls = (backend, path) => backend.requests.filter(r => r.path === path);

test('an inactive account is refused, signed out, and never sees the dashboard', async ({ page, backend }) => {
  backend.tables.profiles[0].is_active = false;
  await page.goto('/owner-login.html');
  await page.fill('#email', OWNER_USER.email);
  await page.fill('#password', OWNER_USER.password);
  await page.click('#loginBtn');
  await expect(page.locator('#loginMsg')).toContainText("isn't an active account");
  await expect(page.locator('#dash')).toBeHidden();
  await expect.poll(() => authCalls(backend, '/auth/v1/logout').length).toBeGreaterThan(0);
  expect(backend.tableWrites()).toEqual([]);
});

test.describe('Forgot your password?', () => {
  async function requestReset(page, email) {
    await page.goto('/owner-login.html');
    await page.click('#forgotPasswordLink');
    await expect(page.locator('#forgotForm')).toBeVisible();
    await page.fill('#forgotEmail', email);
    await page.click('#forgotBtn');
    await expect(page.locator('#forgotMsg')).toContainText('If that email has an account, a reset link has been sent');
  }

  test('sends one reset request that returns to the change-password page', async ({ page, backend }) => {
    await requestReset(page, 'synthetic.owner@example.test');
    const calls = authCalls(backend, '/auth/v1/recover');
    expect(calls).toHaveLength(1);
    expect(calls[0].body.email).toBe('synthetic.owner@example.test');
    const redirect = new URLSearchParams(calls[0].query).get('redirect_to');
    expect(redirect).toBe('https://stasvitiuk-dev.github.io/health-endeavors-order-entry/change-password.html');
  });

  test('shows the same message even when the request fails (never reveals who has an account)', async ({ page }) => {
    await page.route('**/auth/v1/recover**', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ msg: 'SYNTHETIC user not found' }) }));
    await requestReset(page, 'nobody@example.test');
    await expect(page.locator('#forgotMsg')).not.toContainText('not found');
  });

  test('"Back to log in" returns to the normal login form', async ({ page }) => {
    await page.goto('/owner-login.html');
    await page.click('#forgotPasswordLink');
    await page.click('#backToLoginLink');
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#forgotForm')).toBeHidden();
  });
});

test.describe('non-owner account (e.g. an administrator)', () => {
  test.beforeEach(async ({ page, backend }) => {
    backend.tables.profiles[0].role = 'administrator';
    backend.tables.personal_calendar_events = [];
    await page.goto('/owner-login.html');
    await page.fill('#email', OWNER_USER.email);
    await page.fill('#password', OWNER_USER.password);
    await page.click('#loginBtn');
    await expect(page.locator('#whoAmI')).toContainText('role: administrator');
    await gotoPage(page, 'calendarPanel');
    await page.waitForLoadState('networkidle');
  });

  test('gets their own private calendar, not the owner\'s synced one', async ({ page, backend }) => {
    await expect(page.locator('#addPersonalEventForm')).toBeVisible();
    await expect(page.locator('#calHintText')).toContainText('only you can see these events');
    const personal = backend.requests.filter(r => r.table === 'personal_calendar_events' && r.method === 'GET');
    expect(personal.length).toBeGreaterThan(0);
    expect(Object.fromEntries(personal[0].params)).toMatchObject({ owner_id: `eq.${OWNER_USER.id}` });
    // The Calendar page's event list must not read the owner's Apple events.
    const appleEventLists = backend.requests.filter(r => r.table === 'calendar_events' && r.params.some(([k]) => k === 'starts_at'));
    expect(appleEventLists).toEqual([]);
  });

  test('adding an event saves only its own fields, owned by this account', async ({ page, backend }) => {
    await page.fill('#personalEventTitle', 'SYNTHETIC dentist');
    await page.fill('#personalEventStart', '2026-10-02T09:30');
    await page.click('#addPersonalEventBtn');
    await expect.poll(() => backend.tableWrites().filter(r => r.table === 'personal_calendar_events').length).toBe(1);
    const [w] = backend.tableWrites().filter(r => r.table === 'personal_calendar_events');
    expect(Object.keys(w.body).sort()).toEqual(['all_day', 'ends_at', 'owner_id', 'starts_at', 'title']);
    expect(w.body).toMatchObject({ owner_id: OWNER_USER.id, title: 'SYNTHETIC dentist', all_day: false, ends_at: null });
  });

  test('an end time before the start time is refused', async ({ page, backend }) => {
    await page.fill('#personalEventTitle', 'SYNTHETIC backwards');
    await page.fill('#personalEventStart', '2026-10-02T09:30');
    await page.fill('#personalEventEnd', '2026-10-02T08:00');
    await page.click('#addPersonalEventBtn');
    await page.waitForTimeout(300);
    expect(backend.tableWrites()).toEqual([]);
  });
});

test('the owner sees the synced calendar view (no personal add form)', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'calendarPanel');
  await expect(page.locator('#addPersonalEventForm')).toBeHidden();
  await expect(page.locator('#calHintText')).toContainText('Your synced Apple Calendar');
});
