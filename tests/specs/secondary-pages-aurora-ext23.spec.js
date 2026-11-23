// The five secondary pages in Aurora (owner decision, Nov 23: "switch everything to
// Aurora"): change-password.html, search.html, dashboard.html, manual-order-entry.html
// and index.html now match the dashboard. Checks, light and dark: the page ground is
// Aurora's (#f3f5fb / #05070f), primary buttons carry the indigo-to-cyan gradient, and
// every visible text meets the 4.5:1 readability minimum (3:1 for large text), on the
// signed-out screen and, where there is one, the signed-in page with made-up data.
const { test, expect, login, OWNER_USER } = require('../helpers/dashboard');
const { contrastFailures } = require('../helpers/a11y-audit');

const GROUND = { light: 'rgb(243, 245, 251)', dark: 'rgb(5, 7, 15)' };
const check = (page) => page.evaluate((src) => (new Function('return ' + src)())(document.body), contrastFailures.toString());

test.beforeEach(async ({ page }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'colours are the same at phone size');
  for (const host of ['https://fonts.googleapis.com/**', 'https://fonts.gstatic.com/**']) {
    await page.route(host, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  }
});

for (const scheme of ['light', 'dark']) {
  test(`change-password and manual order entry, signed out, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/change-password.html');
    await expect(page.locator('#loginStep')).toBeVisible();
    expect(await page.locator('#screen').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(GROUND[scheme]);
    expect(await page.locator('#loginStep button').first().evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
    expect(await check(page)).toEqual([]);
    for (const f of ['/manual-order-entry.html', '/index.html']) {
      await page.goto(f);
      await expect(page.locator('#loginBtn')).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), f).toBe(GROUND[scheme]);
      expect(await page.locator('#loginBtn').evaluate(el => getComputedStyle(el).backgroundImage), f).toContain('linear-gradient');
      expect(await check(page), f).toEqual([]);
    }
  });

  test(`search, dashboard.html and manual order entry, signed in, ${scheme}`, async ({ page, backend }) => {
    test.setTimeout(90000);
    const now = new Date().toISOString();
    backend.rpc.global_search = [{ result_type: 'customer', label: 'SYNTHETIC Customer One', subtitle: 'SYNTHETIC subtitle' }];
    Object.assign(backend.tables, {
      owner_dashboard_summary: [{ system_mode: 'NORMAL', open_incidents: 0, critical_incidents: 0, open_tasks: 1, overdue_tasks: 0, open_alerts: 0, security_changes_last_24h: 0 }],
      owner_dashboard_recent_activity: [{ item_type: 'task', label: 'SYNTHETIC task', status: 'open', created_at: now }],
      ai_decision_log: [{ agent_key: 'customer_service_agent', output_summary: 'SYNTHETIC draft', cost_usd: 0.01, created_at: now }],
      business_rules: [],
    });
    await page.emulateMedia({ colorScheme: scheme });
    await login(page);
    await page.goto('/search.html');
    await expect(page.locator('#app')).toBeVisible();
    await page.fill('#search-input', 'SYNTHETIC');
    await expect(page.locator('#results')).toContainText('SYNTHETIC Customer One');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(GROUND[scheme]);
    expect(await check(page), 'search').toEqual([]);
    await page.goto('/dashboard.html');
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#activity-list')).toContainText('SYNTHETIC task');
    expect(await check(page), 'dashboard.html').toEqual([]);
    await page.goto('/manual-order-entry.html');
    // the dashboard sign-in above is usually reused; sign in here only if asked
    await expect.poll(async () => (await page.locator('#appView').isVisible()) || (await page.locator('#loginBtn').isVisible()), { timeout: 15000 }).toBe(true);
    if (await page.locator('#loginBtn').isVisible()) {
      await page.fill('#loginEmail', OWNER_USER.email);
      await page.fill('#loginPassword', OWNER_USER.password);
      await page.click('#loginBtn');
    }
    await expect(page.locator('#appView')).toBeVisible();
    expect(await check(page), 'manual order entry').toEqual([]);
  });
}
