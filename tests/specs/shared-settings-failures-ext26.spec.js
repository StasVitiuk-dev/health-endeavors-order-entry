// Shared settings when something goes wrong (Nov 27 night, after SHARED_SETTINGS_LIVE). The
// page must never say "for every device" unless the database confirmed the save, and must say
// plainly when a switch is this browser's only. The database half (who may save, who may read,
// a switched-off account, a visitor, conflicts, the history log) is proven on a throwaway
// database in docs/ops/sql/local-test/shared_settings_test.sh. All values are made up.
//
//   case                                      | where it is covered
//   ------------------------------------------|------------------------------------------------
//   table and function missing                | shared-switches-ext24 "on a database without…", launch-page, drafts, backups
//   function missing, table there             | here: "the save function is missing"
//   installed, empty                          | shared-switches-ext24 (first share), drafts-every-device "as shipped now"
//   installed, with values                    | shared-switches-ext24, real-profit, menu-layouts
//   no permission (refused 42501)             | shared-switches-ext24 "a refusal…", menu-layouts, real-profit
//   sign-in expired (401 JWT expired)         | here
//   network failure on reading / on saving    | here
//   conflict (two devices)                    | shared-settings-race-ext25 (and the database test 4b)
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const SWITCHES = (on) => [{ id: 'ss-1', key: 'feature_switches', value: { on }, audience: 'staff', updated_at: '2026-11-27T10:00:00Z', updated_by: '00000000-0000-4000-8000-000000000001' }];
const isSharedRead = (url) => /\/rest\/v1\/shared_settings\?/.test(url);
const isSharedSave = (url) => /\/rest\/v1\/rpc\/set_shared_setting/.test(url);
const failNet = (e) => /ERR_FAILED|net::|Failed to fetch|status of 401/.test(e);
const saves = (backend) => backend.requests.filter(r => r.rpc === 'set_shared_setting');
const once = (ti) => test.skip(ti.project.name !== 'desktop', 'run once');

async function flags(page) {
  await gotoPage(page, 'flagsPanel');
  return page.locator('#previewSwitchesHost');
}

test.describe('reading the shared settings fails', () => {
  test('no connection at sign-in: the page says the switches are this browser\'s only, and a switch turned on stays here', async ({ page, backend, pageErrors }, ti) => {
    once(ti);
    test.setTimeout(60000);                                   // the client's own retries take about 8 s
    backend.tables.shared_settings = SWITCHES({ he_real_profit: true });
    await page.route(u => isSharedRead(String(u)), route => route.abort('failed'));
    await login(page);
    const host = await flags(page);
    const note = host.locator('[data-preview-shared]');
    // The menu and the page open at once; the switches are drawn only once the read has given up
    // (the client tries again for about 8 s with no connection), never as "could not be read"
    // while it is still trying.
    await expect(note).toHaveAttribute('data-preview-shared', 'unknown', { timeout: 25000 });
    await expect(note).toContainText('could not be read just now');
    await expect(note).toContainText('this browser on this device only');
    await expect(host).not.toContainText('Switches are shared');
    // the shared value was never applied: this browser keeps its own (off)
    expect(await page.evaluate(() => localStorage.getItem('he_real_profit'))).toBeNull();
    await host.getByRole('button', { name: 'Turn on Payment reconciliation' }).click();
    await expect(host.locator('[data-preview-rownote="ok"]')).toHaveText('On in this browser. Reload to finish.');
    await expect(host.locator('[data-preview-msg]')).not.toContainText('every device');
    expect(await page.evaluate(() => localStorage.getItem('he_reconcile'))).toBe('on');
    expect(saves(backend)).toEqual([]);                       // nothing was sent as "for every device"
    expect(pageErrors.filter(e => !failNet(e))).toEqual([]);
  });

  test('sign-in expired (the database answers 401): the same, with the reason in words', async ({ page, backend, pageErrors }, ti) => {
    once(ti);
    backend.tables.shared_settings = SWITCHES({ he_real_profit: true });
    await page.route(u => isSharedRead(String(u)), route => route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }) }));
    await login(page);
    const host = await flags(page);
    const note = host.locator('[data-preview-shared]');
    await expect(note).toHaveAttribute('data-preview-shared', 'unknown');
    await expect(note).toContainText('JWT expired');
    await expect(note).toContainText('this browser on this device only');
    expect(await page.evaluate(() => localStorage.getItem('he_real_profit'))).toBeNull();
    // Real profit's estimates say the same: this browser's numbers, not shared ones
    await gotoPage(page, 'accountingPanel');
    expect(pageErrors.filter(e => !failNet(e))).toEqual([]);
  });
  // the Launch page's own case is in launch-page-ext25 (it needs that page's made-up records)
});

test.describe('saving fails', () => {
  test('no connection while saving: the switch does not change anywhere, and the row says so', async ({ page, backend, pageErrors }, ti) => {
    once(ti);
    await page.route(u => isSharedSave(String(u)), route => route.abort('failed'));
    await login(page);
    const host = await flags(page);
    await expect(host.locator('[data-preview-shared]')).toHaveAttribute('data-preview-shared', 'installed');
    await host.getByRole('button', { name: 'Turn on Payment reconciliation' }).click();
    const note = host.locator('tr[data-preview-key="he_reconcile"] [data-preview-rownote="refused"]');
    await expect(note).toContainText('Could not reach the database');
    await expect(host.locator('[data-preview-msg]')).toContainText('Nothing was changed');
    await expect(host.locator('[data-preview-msg]')).not.toContainText('for every device');
    await expect(host.locator('tr[data-preview-key="he_reconcile"]')).toHaveAttribute('data-preview-on', 'no');
    expect(await page.evaluate(() => localStorage.getItem('he_reconcile'))).toBeNull();
    expect(backend.tables.shared_settings || []).toEqual([]);      // nothing was saved
    expect(pageErrors.filter(e => !failNet(e))).toEqual([]);
  });

  test('sign-in expired while saving: refused, nothing changes, the reason is shown', async ({ page, backend }, ti) => {
    once(ti);
    backend.rpc.set_shared_setting = () => ({ __error: { status: 401, code: 'PGRST301', message: 'JWT expired' } });
    await login(page);
    const host = await flags(page);
    await host.getByRole('button', { name: 'Turn on Payment reconciliation' }).click();
    await expect(host.locator('tr[data-preview-key="he_reconcile"] [data-preview-rownote="refused"]')).toContainText('JWT expired');
    await expect(host.locator('tr[data-preview-key="he_reconcile"]')).toHaveAttribute('data-preview-on', 'no');
    expect(await page.evaluate(() => localStorage.getItem('he_reconcile'))).toBeNull();
  });

  test('the save function is missing (table there): said in words, nothing changes', async ({ page, backend }, ti) => {
    once(ti);
    backend.rpc.set_shared_setting = () => ({ __error: { status: 404, code: 'PGRST202', message: 'Could not find the function public.set_shared_setting in the schema cache' } });
    await login(page);
    const host = await flags(page);
    await host.getByRole('button', { name: 'Turn on Payment reconciliation' }).click();
    await expect(host.locator('tr[data-preview-key="he_reconcile"] [data-preview-rownote="refused"]')).toContainText('not installed');
    await expect(host.locator('tr[data-preview-key="he_reconcile"]')).toHaveAttribute('data-preview-on', 'no');
  });

  test('a double press saves once per press and ends in the state of the last press', async ({ page, backend }, ti) => {
    once(ti);
    await login(page);
    const host = await flags(page);
    const btn = () => host.locator('tr[data-preview-key="he_reconcile"] [data-previewswitch="toggle"]');
    await btn().click();
    await expect(host.locator('tr[data-preview-key="he_reconcile"]')).toHaveAttribute('data-preview-on', 'yes');
    await btn().click();
    await expect(host.locator('tr[data-preview-key="he_reconcile"]')).toHaveAttribute('data-preview-on', 'no');
    await expect.poll(() => saves(backend).length).toBe(2);
    const row = backend.tables.shared_settings.find(r => r.key === 'feature_switches');
    expect(row.value.on.he_reconcile).toBeFalsy();
  });
});
