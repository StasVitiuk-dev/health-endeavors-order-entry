// The New Employee page, "People" under Admin (owner, Nov 24). Behind the real-records
// switch he_people_page (OFF as shipped). The database functions are drafts/62 and 64
// (review item 16); the sign-ins go through the helper program (review item 17), which
// these tests answer in its place. Every account and value is made up.
const RS = require('../../assets/views/he-record-switches.js');
const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const ADMIN = '00000000-0000-4000-8000-0000000000a1', LEAD = '00000000-0000-4000-8000-0000000000a2';
const STAFF = '00000000-0000-4000-8000-0000000000a3', GONE = '00000000-0000-4000-8000-0000000000a4';
const people = () => [
  { id: OWNER_USER.id, role: 'owner', is_active: true, display_name: 'Synthetic Owner', full_name: 'Synthetic Owner', email: OWNER_USER.email, account_number: '900000001', deleted_at: null, department: null, is_break_glass: false, created_at: '2026-01-01T00:00:00Z' },
  { id: ADMIN, role: 'administrator', is_active: true, display_name: 'SYNTHETIC Admin', email: 'admin@example.test', account_number: '900000002', deleted_at: null, department: null, is_break_glass: false, created_at: '2026-02-01T00:00:00Z' },
  { id: LEAD, role: 'manager', is_active: true, display_name: 'SYNTHETIC Lead', email: 'lead@example.test', account_number: '900000003', deleted_at: null, department: 'Packing', is_break_glass: false, created_at: '2026-03-01T00:00:00Z' },
  { id: STAFF, role: 'employee', is_active: true, display_name: 'SYNTHETIC Staff', email: 'staff@example.test', account_number: '900000004', deleted_at: null, department: 'Packing', is_break_glass: false, created_at: '2026-04-01T00:00:00Z' },
  { id: GONE, role: 'employee', is_active: false, display_name: 'SYNTHETIC Gone', email: 'gone@example.test', account_number: '900000005', deleted_at: '2026-05-01T00:00:00Z', department: null, is_break_glass: false, created_at: '2026-04-02T00:00:00Z' },
];
const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_people_page', 'on'); } catch (e) {} });
const installed = (backend) => { backend.rpc.people_actor_role = 'owner'; };
const rpcs = (backend, name) => backend.requests.filter(r => r.rpc === name);
// the helper program, answered here in its place; `answer(body)` -> { status, body }
async function helper(page, answer) {
  const calls = [];
  await page.route('**/functions/v1/people-accounts', async (route) => {
    const req = route.request();
    let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch (e) { body = null; }
    calls.push({ body, auth: req.headers()['authorization'] || '' });
    const a = answer(body) || { status: 200, body: { ok: true, message: 'Done.' } };
    await route.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) });
  });
  return calls;
}
const row = (page, id) => page.locator('#peoplePanel tr[data-pp-row="' + id + '"]');

test.describe('the switch (no browser)', () => {
  test('People is a switch that saves real records, checked by asking a function that changes nothing', async ({}, ti) => {
    node(ti);
    const sw = RS.RECORD_SWITCHES.find(x => x.key === 'he_people_page');
    expect(sw).toMatchObject({ name: 'People (New Employee page)', where: 'Admin → People', rpc: 'people_actor_role' });
    const client = (answer) => ({ rpc: async () => answer, from: () => { throw new Error('a table was read'); } });
    expect(await RS.probe(client({ data: 'owner', error: null }), sw)).toBe('installed');
    expect(await RS.probe(client({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.people_actor_role' } }), sw)).toBe('not_installed');
    expect(await RS.probe(client({ data: null, error: { code: '42883', message: 'function does not exist' } }), sw)).toBe('not_installed');
    expect(await RS.probe(client({ data: null, error: { code: '500', message: 'boom' } }), sw)).toBe('unknown');
    expect(await RS.probe({ from: () => ({}) }, sw)).toBe('unknown');                       // a client without rpc
    // the table probes are unchanged
    const tax = RS.RECORD_SWITCHES.find(x => x.key === 'he_tax_rates');
    expect(await RS.probe({ from: () => ({ select: () => ({ limit: async () => ({ error: { code: 'PGRST205', message: 'x' } }) }) }) }, tax)).toBe('not_installed');
  });
});

test.describe('the People page', () => {
  test('switch off (as shipped): no People in the menu, no question to the database or the helper', async ({ page, backend }) => {
    const calls = await helper(page, () => null);
    await login(page);
    await expect(page.locator('#sidebarGroups [data-page="peoplePanel"]')).toHaveCount(0);
    await expect(page.locator('#peoplePanel')).toBeEmpty();
    expect(rpcs(backend, 'people_actor_role')).toEqual([]);
    expect(calls).toEqual([]);
  });

  test('database step not installed: the list shows, it says so, and nothing can be changed', async ({ page, backend }) => {
    backend.tables.profiles = people();
    backend.rpc.people_actor_role = { __error: { status: 404, code: 'PGRST202', message: 'Could not find the function public.people_actor_role without parameters' } };
    await on(page);
    await login(page);
    await gotoPage(page, 'peoplePanel');
    const host = page.locator('#peoplePanel');
    await expect(host.locator('[data-pp-notinstalled]')).toContainText('not installed yet (review item 16)');
    await expect(host.locator('tr[data-pp-row]')).toHaveCount(5);
    await expect(host.locator('[data-pp="open-add"]')).toHaveCount(0);
    await expect(host.locator('tbody button, tbody select')).toHaveCount(0);
    await expect(row(page, STAFF)).toContainText('Waits for the database step.');
  });

  test('installed: each account says what you may do, the owner\'s own row and nothing above your level is changeable', async ({ page, backend }) => {
    backend.tables.profiles = people();
    installed(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'peoplePanel');
    await expect(row(page, OWNER_USER.id)).toContainText('Your own account is not changed from this page.');
    await expect(row(page, STAFF).locator('td').nth(1)).toHaveText('Employee');
    await expect(row(page, LEAD).locator('td').nth(1)).toHaveText('Manager');
    await expect(row(page, GONE)).toHaveAttribute('data-pp-state', 'Removed');
    await expect(row(page, GONE).locator('[data-pp="back"]')).toBeVisible();
    await expect(row(page, GONE).locator('[data-pp="ask-remove"]')).toHaveCount(0);
    await expect(row(page, STAFF).locator('[data-pp="suspend"]')).toBeVisible();
    // levels offered for a manager: below the owner, other than their own
    await expect(row(page, LEAD).locator('select[data-pp-level] option')).toHaveText(['Change level…', 'Administrator', 'Employee']);
  });

  test('add a person: the form checks first, then asks the helper once with the person\'s own password, then the list is read again', async ({ page, backend }) => {
    backend.tables.profiles = people();
    installed(backend);
    const calls = await helper(page, (b) => ({ status: 200, body: { ok: true, id: '00000000-0000-4000-8000-0000000000b1', message: b.name + ' can now sign in with ' + b.email + '.' } }));
    await on(page);
    await login(page);
    await gotoPage(page, 'peoplePanel');
    const host = page.locator('#peoplePanel');
    await host.locator('[data-pp="open-add"]').click();
    await expect(page.locator('#ppName')).toBeFocused();
    await expect(page.locator('#ppRole option')).toHaveText(['Administrator', 'Manager', 'Employee']);
    // problems are listed, nothing is sent, the passwords are emptied
    await page.fill('#ppName', 'New Person');
    await page.fill('#ppEmail', 'not-an-email');
    await page.fill('#ppPw', 'Long-Enough-Pass-1');
    await page.fill('#ppPw2', 'Different-Pass-22');
    await host.locator('form[data-pp-form="add"] button[type=submit]').click();
    await expect(host.locator('[data-pp-problems]')).toContainText('That is not an email address.');
    await expect(host.locator('[data-pp-problems]')).toContainText('The two passwords are not the same.');
    await expect(host.locator('[data-pp-problems]')).toBeFocused();
    expect(calls).toEqual([]);
    await expect(page.locator('#ppName')).toHaveValue('New Person');
    // now right
    await page.fill('#ppEmail', 'new.person@example.test');
    await page.selectOption('#ppRole', 'employee');
    await page.fill('#ppDept', 'Packing');
    await page.fill('#ppPw', 'Long-Enough-Pass-1');
    await page.fill('#ppPw2', 'Long-Enough-Pass-1');
    const reads = backend.requests.filter(r => r.table === 'profiles').length;
    await host.locator('form[data-pp-form="add"] button[type=submit]').click();
    await expect(host.locator('[data-pp-msg]')).toHaveText('New Person can now sign in with new.person@example.test.');
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ action: 'create', name: 'New Person', email: 'new.person@example.test', role: 'employee', department: 'Packing', password: 'Long-Enough-Pass-1' });
    expect(calls[0].auth).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);    // the person's own sign-in, not a key
    await expect(host.locator('form[data-pp-form="add"]')).toHaveCount(0);
    expect(backend.requests.filter(r => r.table === 'profiles').length).toBeGreaterThan(reads);
    // the password never went to the database
    expect(JSON.stringify(backend.requests)).not.toContain('Long-Enough-Pass-1');
  });

  test('the helper not set up yet: a plain answer, the typed details stay, the passwords do not', async ({ page, backend }) => {
    backend.tables.profiles = people();
    installed(backend);
    await page.route('**/functions/v1/people-accounts', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Function not found' }));
    await on(page);
    await login(page);
    await gotoPage(page, 'peoplePanel');
    const host = page.locator('#peoplePanel');
    await host.locator('[data-pp="open-add"]').click();
    await page.fill('#ppName', 'New Person');
    await page.fill('#ppEmail', 'new.person@example.test');
    await page.fill('#ppPw', 'Long-Enough-Pass-1');
    await page.fill('#ppPw2', 'Long-Enough-Pass-1');
    await host.locator('form[data-pp-form="add"] button[type=submit]').click();
    await expect(host.locator('[data-pp-problems]')).toHaveText('The helper program that creates sign-ins is not set up yet (review item 17). Nothing was changed.');
    await expect(page.locator('#ppEmail')).toHaveValue('new.person@example.test');
    await expect(page.locator('#ppPw')).toHaveValue('');
    await expect(page.locator('#ppPw2')).toHaveValue('');
  });

  test('suspend, bring back and remove: the database first, then the sign-in is blocked or unblocked', async ({ page, backend }) => {
    backend.tables.profiles = people();
    installed(backend);
    backend.rpc.people_set_status = (b) => ({ ok: true, id: b.p_person, status: b.p_status });
    const calls = await helper(page, () => ({ status: 200, body: { ok: true, message: 'Done.' } }));
    await on(page);
    await login(page);
    await gotoPage(page, 'peoplePanel');
    const host = page.locator('#peoplePanel');
    await row(page, STAFF).locator('[data-pp="suspend"]').click();
    await expect(host.locator('[data-pp-msg]')).toHaveText('SYNTHETIC Staff is suspended.');
    await expect(host.locator('[data-pp-msg]')).toBeFocused();
    expect(rpcs(backend, 'people_set_status').map(r => r.body)).toEqual([{ p_person: STAFF, p_status: 'suspended' }]);
    expect(calls.map(c => c.body)).toEqual([{ action: 'block', person: STAFF }]);

    await row(page, GONE).locator('[data-pp="back"]').click();
    await expect(host.locator('[data-pp-msg]')).toHaveText('SYNTHETIC Gone is back and can sign in again.');
    expect(calls.map(c => c.body)[1]).toEqual({ action: 'unblock', person: GONE });

    // remove asks first; Cancel changes nothing
    await row(page, LEAD).locator('[data-pp="ask-remove"]').click();
    await expect(host.locator('[data-pp="remove"]')).toBeFocused();
    await expect(row(page, LEAD)).toContainText('Their history stays, and the account can be brought back.');
    await row(page, LEAD).locator('[data-pp="close"]').click();
    expect(rpcs(backend, 'people_set_status')).toHaveLength(2);
    await row(page, LEAD).locator('[data-pp="ask-remove"]').click();
    await host.locator('[data-pp="remove"]').click();
    await expect(host.locator('[data-pp-msg]')).toHaveText('SYNTHETIC Lead is removed. Their history stays.');
    expect(rpcs(backend, 'people_set_status').map(r => r.body)[2]).toEqual({ p_person: LEAD, p_status: 'removed' });
    expect(calls.map(c => c.body)[2]).toEqual({ action: 'block', person: LEAD });
    // nothing was ever deleted
    expect(backend.requests.filter(r => r.method === 'DELETE')).toEqual([]);
  });

  test('a refusal by the database is said plainly, and the helper is then not asked', async ({ page, backend }) => {
    backend.tables.profiles = people();
    installed(backend);
    backend.rpc.people_set_status = { __error: { status: 403, code: '42501', message: 'That account was not found, or it is not yours to change. Nothing was changed.' } };
    const calls = await helper(page, () => null);
    await on(page);
    await login(page);
    await gotoPage(page, 'peoplePanel');
    await row(page, STAFF).locator('[data-pp="suspend"]').click();
    await expect(page.locator('#peoplePanel [data-pp-msg]')).toHaveText('You do not have permission to do that. Nothing was changed.');
    expect(calls).toEqual([]);
  });

  test('the database says yes but the sign-in block fails: both are said', async ({ page, backend }) => {
    backend.tables.profiles = people();
    installed(backend);
    backend.rpc.people_set_status = (b) => ({ ok: true, id: b.p_person, status: b.p_status });
    await helper(page, () => ({ status: 502, body: { ok: false, message: 'The sign-in provider did not block the sign-in (500). Nothing was changed.' } }));
    await on(page);
    await login(page);
    await gotoPage(page, 'peoplePanel');
    await row(page, STAFF).locator('[data-pp="suspend"]').click();
    await expect(page.locator('#peoplePanel [data-pp-msg]')).toHaveText('SYNTHETIC Staff is suspended. But the sign-in itself could not be blocked: The sign-in provider did not block the sign-in (500). Nothing was changed.');
  });

  test('change a level and set a new password', async ({ page, backend }) => {
    backend.tables.profiles = people();
    installed(backend);
    backend.rpc.people_set_role = (b) => ({ ok: true, id: b.p_person, role: b.p_role });
    const calls = await helper(page, () => ({ status: 200, body: { ok: true, message: 'The new password is set. Give it to the person in person; it is not shown again.' } }));
    await on(page);
    await login(page);
    await gotoPage(page, 'peoplePanel');
    const host = page.locator('#peoplePanel');
    await row(page, STAFF).locator('select[data-pp-level]').selectOption('manager');
    await expect(host.locator('[data-pp-msg]')).toHaveText('SYNTHETIC Staff is now Manager.');
    expect(rpcs(backend, 'people_set_role').map(r => r.body)).toEqual([{ p_person: STAFF, p_role: 'manager' }]);

    await row(page, STAFF).locator('[data-pp="open-password"]').click();
    await expect(page.locator('#ppNew_' + STAFF)).toBeFocused();
    await page.fill('#ppNew_' + STAFF, 'short');
    await page.fill('#ppNew2_' + STAFF, 'short');
    await host.locator('form[data-pp-form="password"] button[type=submit]').click();
    await expect(host.locator('[data-pp-problems]')).toContainText('at least 10 characters');
    expect(calls).toEqual([]);
    await page.fill('#ppNew_' + STAFF, 'A-Better-Pass-77');
    await page.fill('#ppNew2_' + STAFF, 'A-Better-Pass-77');
    await host.locator('form[data-pp-form="password"] button[type=submit]').click();
    await expect(host.locator('[data-pp-msg]')).toHaveText('The new password is set. Give it to the person in person; it is not shown again.');
    expect(calls.map(c => c.body)).toEqual([{ action: 'password', person: STAFF, email: 'staff@example.test', password: 'A-Better-Pass-77' }]);
    await expect(host.locator('form[data-pp-form="password"]')).toHaveCount(0);
  });

  test('an employee who turns the switch on sees only that the page is not for them', async ({ page, backend }) => {
    const rows = people(); rows[0].role = 'employee';
    backend.tables.profiles = rows;
    installed(backend);
    await on(page);
    await login(page);
    await page.evaluate(() => { const b = document.querySelector('[data-page="peoplePanel"]'); if (b) b.click(); });
    await expect(page.locator('#peoplePanel')).toContainText('This page is for the owner, administrators and managers.');
    await expect(page.locator('#peoplePanel tr')).toHaveCount(0);
  });

  test('fits the screen: no sideways scrolling, with the add form open', async ({ page, backend }) => {
    backend.tables.profiles = people();
    installed(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'peoplePanel');
    await page.locator('#peoplePanel [data-pp="open-add"]').click();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
  });
});
