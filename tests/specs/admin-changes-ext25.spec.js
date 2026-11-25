// What administrators changed, told to the owner on Home (owner, Nov 24). Behind the
// preview switch he_admin_changes (OFF as shipped); the owner only; reads the change
// history (employee_activity) and writes nothing. assets/views/he-admin-changes.js.
// Every value is made up.
const AC = require('../../assets/views/he-admin-changes.js');
const { test, expect, login } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const NOW = Date.parse('2026-11-25T12:00:00Z');
const ago = (h) => new Date(NOW - h * 3600000).toISOString();
const row = (i, extra) => Object.assign({ id: i, happened_at: ago(i), person_id: 'p-admin', person_name: 'SYNTHETIC Admin', person_account_number: '444555666',
  person_role: 'administrator', area: 'Orders', table_name: 'orders', action: 'UPDATE', action_label: 'changed', record_id: 'r' + i, values_stored: true, old_data: {}, new_data: {} }, extra || {});
const rows = () => [
  row(1), row(2), row(3, { area: 'Tasks', table_name: 'tasks' }),
  row(4, { area: 'Accounts', table_name: 'profiles' }),
  row(5, { area: 'Expenses', table_name: 'expenses', action: 'DELETE' }),
  row(6, { person_id: 'p-owner', person_name: 'SYNTHETIC Owner', person_account_number: '111222333', person_role: 'owner' }),
  row(7, { person_id: 'p-emp', person_name: 'SYNTHETIC Staff', person_account_number: '777888999', person_role: 'employee' }),
];
const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_admin_changes', 'on'); } catch (e) {} });

test.describe('the rules (no browser)', () => {
  test('only administrators\' changes after "seen" are counted, per person and per area', ({}, ti) => {
    node(ti);
    const s = AC.summarize(rows(), 0);
    expect(s.total).toBe(5);
    expect(s.deletes).toBe(1);
    expect(s.accounts).toBe(1);
    expect(s.newest).toBe(Date.parse(ago(1)));
    expect(s.people).toHaveLength(1);
    expect(AC.personLine(s.people[0])).toBe('SYNTHETIC Admin: Orders 2, Accounts 1, Expenses 1, Tasks 1 · 1 account change · 1 deletion');
    expect(AC.sentence(s)).toBe('5 changes by an administrator since you last looked.');
    expect(AC.sentence(s, true)).toBe('5 changes or more by an administrator since you last looked.');
    // seen up to 2.5 hours ago: only the two newer ones
    expect(AC.summarize(rows(), Date.parse(ago(2.5))).total).toBe(2);
    expect(AC.sentence(AC.summarize([], 0))).toBe('No changes by administrators since you last looked.');
    for (const junk of [null, undefined, 'x', 7, [null, 'x', { person_role: 'administrator' }, { person_role: 'administrator', happened_at: 'not a date' }]]) expect(AC.summarize(junk, 0).total).toBe(0);
  });
});

test.describe('on Home', () => {
  test('switch off (as shipped): nothing on Home and no extra question', async ({ page, backend }) => {
    backend.rpc.employee_activity = rows();
    await login(page);
    await expect(page.locator('#adminChangesHost')).toBeEmpty();
    // no question for the last 7 days of history (the note's own question)
    const weekBack = (r) => r.rpc === 'employee_activity' && r.body && Math.abs(Date.now() - 7 * 86400000 - Date.parse(r.body.p_from)) < 3600000;
    expect(backend.requests.filter(weekBack)).toEqual([]);
  });

  test('the owner sees who changed what, opens Employee Activity, and "Seen" clears it until something new', async ({ page, backend }) => {
    backend.rpc.employee_activity = rows();
    await page.clock.setFixedTime(NOW);
    await on(page);
    await login(page);
    const card = page.locator('#adminChangesHost [data-adminchanges]');
    await expect(card).toHaveAttribute('data-adminchanges', '5');
    await expect(card).toContainText('5 changes by an administrator since you last looked.');
    await expect(card.locator('li')).toHaveText(['SYNTHETIC Admin: Orders 2, Accounts 1, Expenses 1, Tasks 1 · 1 account change · 1 deletion']);
    await expect(card).not.toContainText('SYNTHETIC Owner');
    await expect(card).not.toContainText('SYNTHETIC Staff');
    // it asked for the last 7 days, and wrote nothing
    const ask = backend.requests.filter(r => r.rpc === 'employee_activity').find(r => r.body.p_from === new Date(NOW - 7 * 86400000).toISOString());
    expect(ask && ask.body).toEqual({ p_from: new Date(NOW - 7 * 86400000).toISOString(), p_limit: 500, p_offset: 0 });
    expect(backend.tableWrites()).toEqual([]);

    await card.getByRole('button', { name: 'Mark what administrators changed as seen' }).click();
    await expect(page.locator('#adminChangesHost')).toBeEmpty();
    expect(await page.evaluate(() => localStorage.getItem('he_admin_changes_seen'))).toBe(String(Date.parse(ago(1))));
    // after a reload, only what is newer than "seen" would show: nothing here
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await expect(page.locator('#businessHealthStats')).not.toBeEmpty();
    await expect(page.locator('#adminChangesHost [data-adminchanges]')).toHaveCount(0);
    // something new arrives
    backend.rpc.employee_activity = [row(0.5, { area: 'Products', table_name: 'products' })].concat(rows());
    await page.reload();
    await expect(page.locator('#adminChangesHost [data-adminchanges]')).toHaveAttribute('data-adminchanges', '1');
    await page.locator('#adminChangesHost [data-acgo]').click();
    await expect(page.locator('section#activityPanel')).toBeVisible();
  });

  test('when the history cannot be read, it says so instead of showing nothing', async ({ page, backend }) => {
    backend.rpc.employee_activity = { __error: { status: 500, code: 'XX000', message: 'SYNTHETIC failure' } };
    await on(page);
    await login(page);
    await expect(page.locator('#adminChangesHost [data-adminchanges="unknown"]')).toContainText('Could not read what administrators changed just now.');
  });

  test('not for anyone but the owner', async ({ page, backend }) => {
    backend.tables.profiles[0].role = 'administrator';
    backend.rpc.employee_activity = rows();
    await on(page);
    await login(page);
    await expect(page.locator('#businessHealthStats')).not.toBeEmpty();
    await expect(page.locator('#adminChangesHost')).toBeEmpty();
  });
});
