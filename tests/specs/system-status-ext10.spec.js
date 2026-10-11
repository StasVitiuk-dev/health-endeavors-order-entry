// EXT10b (missions 63-68): read-only System status on the Continuity page and
// a diagnostic summary that is safe to paste (no names, e-mails, record
// contents, keys or tokens). Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop' && !ti.title.startsWith('X10-24'), 'page logic; run once'); });
const row = (page, name) => page.locator('#systemStatusWrap tr', { has: page.locator('th', { hasText: name }) }).locator('td');

test('shows environment, database, role, nightly check, backups UNKNOWN, agents and version', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'continuityPanel');
  await expect(row(page, 'Environment')).toHaveText('NOT PRODUCTION (dashboard.test)');
  await expect(row(page, 'Database')).toContainText('Reading works');
  await expect(row(page, 'Signed-in role')).toHaveText('owner');
  await expect(row(page, 'Nightly integrity check')).toHaveText('NOT VERIFIED');
  await expect(row(page, 'Backups')).toContainText('UNKNOWN');
  await expect(row(page, 'Page version')).toContainText('helpers API 9');
});

test('database unreadable: says so and UNKNOWN, never "works"', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'continuityPanel');
  await page.context().route(/\/rest\/v1\/feature_flags\?select=flag_key&limit=1/, r => r.abort('connectionreset'));
  await page.click('#sysStatusRefresh');
  await expect(row(page, 'Database')).toContainText('Could not read', { timeout: 30000 });
  await expect(row(page, 'Database')).toContainText('UNKNOWN whether data is current');
});

test('the diagnostic summary holds the error KIND, never names, e-mails, keys or the project address', async ({ page, backend }) => {
  backend.tables.orders = [{ id: 'o-secret', order_number: 'SYN-SECRET-1', customer_name: 'SYNTHETIC Private Person', customer_email: 'private.person@example.test',
    total: '10.00', tax_total: '0.00', currency: 'USD', status: 'paid', placed_at: '2026-10-01T00:00:00Z', deleted_at: null, source: 'manual', raw_data: null, created_at: '2026-10-01T00:00:00Z' }];
  await login(page);
  // a real error on screen: a reminder whose save loses its connection
  await page.context().route(/\/rest\/v1\/manual_attention_items/, r => r.request().method() === 'POST' ? r.abort('connectionreset') : r.fallback());
  await page.fill('#reminderTitle', 'SYNTHETIC call Private Person back');
  await page.click('#addReminderForm button[type=submit]');
  await expect(page.locator('#dashError')).toBeVisible();
  await gotoPage(page, 'continuityPanel');
  await page.click('#copyDiagBtn');
  const text = await page.locator('#diagText').textContent();
  expect(text).toContain('Health Endeavors dashboard — diagnostic summary');
  expect(text).toContain('Environment: NOT PRODUCTION');
  expect(text).toContain('Last error on screen: connection / outcome unknown');
  for (const bad of ['@', 'Private Person', 'SYN-SECRET', 'sb_publishable', 'eyJ', 'supabase.co', 'synthetic.owner']) expect(text, bad).not.toContain(bad);
  // plain-http test page: no clipboard API, so the page says to copy the text shown
  await expect(page.locator('.toast', { hasText: 'select the text below' })).toBeVisible();
});

test.describe('phone', () => {
  test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'iphone', 'phone only'); });
  test('X10-24: System status values wrap inside the screen instead of running off the right edge', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'continuityPanel');
    const t = page.locator('#systemStatusWrap table.sysStatus');
    await expect(t).toBeVisible();
    const r = await t.evaluate(el => ({ over: el.scrollWidth - el.clientWidth, cut: [...el.querySelectorAll('td')].filter(td => td.getBoundingClientRect().right > innerWidth + 1).length }));
    expect(r).toEqual({ over: 0, cut: 0 });
  });
});
