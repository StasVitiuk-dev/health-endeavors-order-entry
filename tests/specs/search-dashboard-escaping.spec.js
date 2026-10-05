// search.html and dashboard.html must show database text as plain text.
// Customer names, order details, task titles and AI summaries can contain
// characters like < > & and quotes; they must appear exactly as written and
// must never turn into page elements. The synthetic values below include a
// harmless marker tag (data-test="injected") that must never become a real
// element. Synthetic data only; the mock answers every request.

const { test, expect, login } = require('../helpers/dashboard');

const MARKER = '<img data-test="injected" src="data:,">';
const NAME = `SYNTHETIC <b>Bold</b> & "Quoted" Customer ${MARKER}`;

// These two pages load Google Fonts. The shared mock blocks every outside
// address, so answer the font requests with empty responses here (page routes
// run before the mock's). Nothing is fetched from the internet.
test.beforeEach(async ({ page }) => {
  for (const host of ['https://fonts.googleapis.com/**', 'https://fonts.gstatic.com/**']) {
    await page.route(host, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  }
});

async function expectNoInjectedElement(page) {
  await expect(page.locator('[data-test="injected"]')).toHaveCount(0);
  await expect(page.locator('b', { hasText: 'Bold' })).toHaveCount(0);
}

test('search.html shows result text literally, including the search term', async ({ page, backend }) => {
  backend.rpc.global_search = [
    { result_type: 'customer', label: NAME, subtitle: `SYNTHETIC subtitle ${MARKER}` },
    { result_type: `<i>odd type</i>`, label: 'SYNTHETIC plain', subtitle: null },
  ];
  await login(page); // creates the synthetic session the other pages reuse
  await page.goto('/search.html');
  await expect(page.locator('#app')).toBeVisible();
  await page.fill('#search-input', 'SYNTHETIC');
  const results = page.locator('#results');
  await expect(results).toContainText(NAME);
  await expect(results).toContainText(`SYNTHETIC subtitle ${MARKER}`);
  await expect(results).toContainText('<i>odd type</i>');
  await expect(page.locator('#results i')).toHaveCount(0);
  await expectNoInjectedElement(page);
});

test('search.html shows a no-match search term literally', async ({ page, backend }) => {
  backend.rpc.global_search = [];
  await login(page);
  await page.goto('/search.html');
  await page.fill('#search-input', MARKER);
  await expect(page.locator('#results')).toContainText(`No matches for "${MARKER}".`);
  await expectNoInjectedElement(page);
});

test('dashboard.html shows activity, AI summaries and stats literally', async ({ page, backend }) => {
  const now = new Date().toISOString();
  Object.assign(backend.tables, {
    owner_dashboard_summary: [{ system_mode: `NORMAL ${MARKER}`, open_incidents: 0, critical_incidents: 0, open_tasks: 1, overdue_tasks: 0, open_alerts: 0, security_changes_last_24h: 0, profile_changes_last_7d: 0 }],
    owner_dashboard_recent_activity: [{ item_type: 'task', label: NAME, status: `open ${MARKER}`, created_at: now }],
    ai_decision_log: [{ agent_key: `customer_service_agent ${MARKER}`, output_summary: `SYNTHETIC draft for ${NAME}`, cost_usd: 0.01, created_at: now }],
    business_rules: [],
  });
  await login(page);
  await page.goto('/dashboard.html');
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#activity-list')).toContainText(NAME);
  await expect(page.locator('#activity-list')).toContainText(`open ${MARKER}`);
  await expect(page.locator('#stat-grid')).toContainText(`NORMAL ${MARKER}`);
  await expect(page.locator('#ai-spend-list')).toContainText(`SYNTHETIC draft for ${NAME}`);
  await expectNoInjectedElement(page);
});

test('dashboard.html shows database error messages literally', async ({ page, backend }) => {
  backend.tables.owner_dashboard_recent_activity = [];
  await login(page);
  // The summary view is empty, so .single() gets the "no rows" error from the
  // mock; its message is shown on the page and must stay plain text.
  await page.goto('/dashboard.html');
  await expect(page.locator('#stat-grid')).toContainText("Couldn't load summary");
  await expectNoInjectedElement(page);
});
