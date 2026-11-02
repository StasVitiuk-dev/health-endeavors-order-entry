// EXT10b (missions 63-68): read-only System status on the Continuity page and
// a diagnostic summary that is safe to paste (no names, e-mails, record
// contents, keys or tokens). Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop' && !ti.title.startsWith('X10-24'), 'page logic; run once'); });
const row = (page, name) => page.locator('#systemStatusWrap tr', { has: page.locator('th', { hasText: new RegExp('^' + name.replace(/[()]/g, '\\$&') + '$') }) }).locator('td');

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
  await expect(page.locator('#diagText')).toContainText('diagnostic summary', { timeout: 30000 });
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

// EXT11: which database steps the page can see, and whether any switch is ON
// without its step (read-only; the same harmless probes the switches use).
test.describe('database steps and switch safety (EXT11)', () => {
  const { installStockFunctions, functionMissing } = require('../helpers/stock-functions-mock');
  const { preSqlProduction } = require('../helpers/pre-sql');
  const switchOn = (backend, ...keys) => {
    backend.tables.feature_flags = (backend.tables.feature_flags || []).filter(f => !keys.includes(f.flag_key))
      .concat(keys.map((k, i) => ({ id: 'ff-x' + i, flag_key: k, label: k, description: 'SYNTHETIC', enabled: true })));
  };
  test('code merged, no SQL installed: every step "not installed", all switches OFF is OK', async ({ page, backend }) => {
    await preSqlProduction(page, backend);
    await login(page);
    await gotoPage(page, 'continuityPanel');
    await expect(row(page, 'Database steps (read-only check)')).toHaveText('R1 receive: not installed · R2 recall: not installed · R3 return: not installed · R4 adjust: not installed · R5 delete: not installed · request keys: not installed · nightly check: not installed');
    await expect(row(page, 'Switch safety')).toHaveText('OK: all of these switches are OFF');
  });
  test('R1–R5 installed and the adjust switch ON: shown as installed and OK', async ({ page, backend }) => {
    await preSqlProduction(page, backend);
    installStockFunctions(backend);
    switchOn(backend, 'stock_fn_adjust');
    await login(page);
    await gotoPage(page, 'continuityPanel');
    await expect(row(page, 'Database steps (read-only check)')).toContainText('R1 receive: installed · R2 recall: installed · R3 return: installed · R4 adjust: installed · R5 delete: installed · request keys: not installed');
    await expect(row(page, 'Switch safety')).toHaveText('OK: every switch that is ON has its database step (1 on)');
    expect(backend.tables.inventory_adjustments || []).toEqual([]); // the probes changed nothing
  });
  test('partial install: R1 installed, R2 missing, R2 switch ON: PROBLEM names R2', async ({ page, backend }) => {
    await preSqlProduction(page, backend);
    installStockFunctions(backend);
    backend.rpc.quarantine_recall = functionMissing();
    switchOn(backend, 'stock_fn_recall', 'stock_fn_receive_po');
    await login(page);
    await gotoPage(page, 'continuityPanel');
    await expect(row(page, 'Database steps (read-only check)')).toContainText('R1 receive: installed · R2 recall: not installed');
    await expect(row(page, 'Switch safety')).toHaveText('PROBLEM: switched ON but its database step is missing: R2 recall. Turn that switch OFF on Feature Switches and tell the owner.');
  });
  test('switches unreadable: switch safety says UNKNOWN, never OK', async ({ page }) => {
    await login(page);
    await gotoPage(page, 'continuityPanel');
    await page.context().route(/\/rest\/v1\/feature_flags\?select=flag_key%2Cenabled/, r => r.abort('connectionreset'));
    await page.click('#sysStatusRefresh');
    await expect(row(page, 'Switch safety')).toHaveText('UNKNOWN — the switches could not be read', { timeout: 30000 });
  });
});
