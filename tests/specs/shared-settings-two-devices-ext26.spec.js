// Two devices signed in at the same time (Nov 27 night): two real browser windows, each with its own
// browser storage, talking to ONE made-up database. Shows what "for every device" means in practice:
// a change reaches the other device when that device reads again (sign-in or reload), not by itself.
// The database half (who may save, a conflict between two connections, the history log) is in
// docs/ops/sql/local-test/shared_settings_test.sh. Every value is made up.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { installMocks } = require('../helpers/mock-supabase');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'two windows at desktop size; run once'); });

// a second window with its own storage, served by its own stand-in that shares the first one's settings table
async function secondDevice(browser, backend, profile) {
  const ctx = await browser.newContext({ baseURL: 'http://dashboard.test', viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { if (localStorage.getItem('he_menu_layout') === null) localStorage.setItem('he_menu_layout', 'today'); } catch (e) {} });
  const b2 = await installMocks(page);
  if (!Array.isArray(backend.tables.shared_settings)) backend.tables.shared_settings = [];
  b2.tables.shared_settings = backend.tables.shared_settings;                    // ONE settings table for both
  if (profile) Object.assign(b2.tables.profiles[0], profile);
  return { ctx, page, b2 };
}
const row = (page, key) => page.locator(`#previewSwitchesHost tr[data-preview-key="${key}"]`);
const switchesRow = (backend) => backend.tables.shared_settings.find(r => r.key === 'feature_switches');

test('one owner, computer and phone: a switch turned on at the computer reaches the phone when the phone reads again', async ({ page, backend, browser }) => {
  await login(page);
  const phone = await secondDevice(browser, backend);
  try {
    await login(phone.page);
    await gotoPage(page, 'flagsPanel'); await gotoPage(phone.page, 'flagsPanel');
    await row(page, 'he_reconcile').getByRole('button', { name: 'Turn on Payment reconciliation' }).click();
    await expect(row(page, 'he_reconcile').locator('[data-preview-rownote="ok"]')).toHaveText('On for every device. Reload to finish.');
    expect(switchesRow(backend).value.on.he_reconcile).toBe(true);
    // the phone has the page open: nothing is pushed to it
    await expect(row(phone.page, 'he_reconcile')).toHaveAttribute('data-preview-on', 'no');
    // after a reload it reads again and has the switch
    await phone.page.reload(); await expect(phone.page.locator('#dash')).toBeVisible({ timeout: 15000 });
    await expect.poll(() => phone.page.evaluate(() => localStorage.getItem('he_reconcile')).catch(() => null)).toBe('on');
    expect(phone.b2.blocked).toEqual([]);
  } finally { await phone.ctx.close(); }
});

test('both devices change a different switch at the same moment: both changes are kept', async ({ page, backend, browser }) => {
  await login(page);
  const phone = await secondDevice(browser, backend);
  try {
    await login(phone.page);
    await gotoPage(page, 'flagsPanel'); await gotoPage(phone.page, 'flagsPanel');
    await Promise.all([
      row(page, 'he_reconcile').getByRole('button', { name: 'Turn on Payment reconciliation' }).click(),
      row(phone.page, 'he_order_slips').getByRole('button', { name: 'Turn on Packing slips' }).click(),
    ]);
    await expect(row(page, 'he_reconcile').locator('[data-preview-rownote="ok"]')).toBeVisible();
    await expect(row(phone.page, 'he_order_slips').locator('[data-preview-rownote="ok"]')).toBeVisible();
    const on = switchesRow(backend).value.on;
    expect([!!on.he_reconcile, !!on.he_order_slips]).toEqual([true, true]);        // neither erased the other
    // the second save carried the version it read, so a lost update would have been a conflict, not an erase
    const versions = backend.requests.concat(phone.b2.requests).filter(r => r.rpc === 'set_shared_setting').map(r => r.body.p_expected_updated_at ? 'version' : r.body.p_expect_new ? 'new' : 'none');
    expect(versions.every(v => v !== 'none')).toBe(true);
  } finally { await phone.ctx.close(); }
});

test('an employee\'s device gets the work switches the owner turned on, never the owner-only ones, and cannot change them', async ({ page, backend, browser }) => {
  await login(page);
  await gotoPage(page, 'flagsPanel');
  await row(page, 'he_order_slips').getByRole('button', { name: 'Turn on Packing slips' }).click();
  await expect(row(page, 'he_order_slips').locator('[data-preview-rownote="ok"]')).toBeVisible();
  await row(page, 'he_real_profit').getByRole('button', { name: 'Turn on Real profit' }).click();
  await expect(row(page, 'he_real_profit').locator('[data-preview-rownote="ok"]')).toBeVisible();
  const staff = await secondDevice(browser, backend, { role: 'employee' });
  try {
    // this employee's browser had Real profit on from before: it must not stay on
    await staff.page.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('he_real_profit', 'on'); sessionStorage.setItem('seeded', '1'); } } catch (e) {} });
    await login(staff.page);
    await expect.poll(() => staff.page.evaluate(() => localStorage.getItem('he_order_slips')).catch(() => null)).toBe('on');
    expect(await staff.page.evaluate(() => localStorage.getItem('he_real_profit'))).toBeNull();
    // the switches list is not offered to an employee, and nothing was saved from that device.
    // (That the DATABASE refuses an employee's save is proven on a real throwaway database:
    // docs/ops/sql/local-test/shared_settings_test.sh, "staff cannot", "a manager cannot".)
    await gotoPage(staff.page, 'flagsPanel');
    await expect(staff.page.locator('#previewSwitchesHost [data-previewswitch]')).toHaveCount(0);
    expect(staff.b2.requests.filter(r => r.rpc === 'set_shared_setting')).toEqual([]);
  } finally { await staff.ctx.close(); }
});
