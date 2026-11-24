// Close an incident with a note (owner, Nov 24: an incident could be seen on the
// Incidents page but not commented on or closed). The owner and administrators
// get "Record what was done" on each open incident: write what was done, then
// keep it open or close it. Nothing is deleted. Behind he_incident_close (a
// switch that saves real records, OFF). assets/views/he-incident-close.js and
// assets/app/he-incidents.js. Every value is made up.
const IC = require('../../assets/views/he-incident-close.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const T0 = '2026-09-17T15:00:00.123456+00:00';
const incidents = () => [
  { id: 'inc-1', incident_number: 'INC-SYN-0001', title: 'SYNTHETIC emergency account was used', description: 'SYNTHETIC: the spare account signed in once.', category: 'security', severity: 'high', status: 'open', due_at: null, actions_taken: null, resolution: null, closed_at: null, created_at: T0, updated_at: T0 },
  { id: 'inc-2', incident_number: 'INC-SYN-0002', title: 'SYNTHETIC late parcel', description: null, category: 'shipping', severity: 'low', status: 'investigating', due_at: null, actions_taken: 'SYNTHETIC asked the carrier', resolution: null, closed_at: null, created_at: T0, updated_at: T0 },
  { id: 'inc-old', incident_number: 'INC-SYN-0000', title: 'SYNTHETIC older incident', description: null, category: 'other', severity: 'low', status: 'resolved', due_at: null, actions_taken: 'SYNTHETIC old note', resolution: 'SYNTHETIC fixed', closed_at: '2026-08-01T10:00:00+00:00', created_at: T0, updated_at: '2026-08-01T10:00:00+00:00' },
];
const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_incident_close', 'on'); } catch (e) {} });
const patches = (backend) => backend.requests.filter(r => r.method === 'PATCH' && r.table === 'incidents');
const param = (r, k) => (r.params.find(([n]) => n === k) || [])[1];

test.describe('the rules (no browser)', () => {
  test('who may, what a note must be, and exactly which columns change', ({}, ti) => {
    node(ti);
    expect(['owner', 'administrator', 'employee', 'staff', '', null, undefined, {}].map(IC.canClose)).toEqual([true, true, false, false, false, false, false, false]);
    expect(IC.check({ done: '  ' })).toMatchObject({ ok: false, reason: expect.stringContaining('Write what was done') });
    expect(IC.check({ done: 'ok' }).ok).toBe(false);
    expect(IC.check({ done: 'x'.repeat(IC.MAX_CHARS + 1) })).toMatchObject({ ok: false, reason: expect.stringContaining('too long') });
    expect(IC.check({ done: 'Fine', ended: 'y'.repeat(IC.MAX_CHARS + 1) }).ok).toBe(false);
    expect(IC.check({ done: '  We tested the spare account.\r\nPassword changed after.  ', ended: ' Done ' })).toEqual({ ok: true, reason: '', done: 'We tested the spare account.\nPassword changed after.', ended: 'Done' });
    for (const junk of [null, undefined, 7, 'text', [], { done: {} }, { done: null, ended: [] }]) expect(IC.check(junk).ok).toBe(false);

    const c = IC.check({ done: 'We tested it.', ended: '' });
    expect(IC.patch('note', c, '2026-11-24T10:00:00.000Z')).toEqual({ actions_taken: 'We tested it.', updated_at: '2026-11-24T10:00:00.000Z' });     // no status, and an empty ending erases nothing
    expect(IC.patch('close', IC.check({ done: 'We tested it.', ended: 'All fine.' }), '2026-11-24T10:00:00.000Z'))
      .toEqual({ actions_taken: 'We tested it.', resolution: 'All fine.', status: 'closed', closed_at: '2026-11-24T10:00:00.000Z', updated_at: '2026-11-24T10:00:00.000Z' });
    expect(IC.patch('anything else', c, 'x').status).toBeUndefined();
    expect(Object.keys(IC.patch('close', null, null)).sort()).toEqual(['actions_taken', 'closed_at', 'status', 'updated_at']);
    expect(IC.CLOSED_WORDS).toEqual(['resolved', 'closed']);   // both are allowed by the production rule
  });

  test('a refusal is said in plain words', ({}, ti) => {
    node(ti);
    expect(IC.friendlyError({ code: '42501', message: 'new row violates row-level security policy for table "incidents"' })).toBe('You do not have permission to change this incident. Nothing was changed.');
    expect(IC.friendlyError({ code: '23514', message: 'violates check constraint' })).toContain('a value is not allowed');
    expect(IC.friendlyError(new TypeError('Failed to fetch'))).toContain('Could not reach the database');
    expect(IC.friendlyError(null)).toContain('no reason given');
    expect(IC.friendlyError({ message: 'x'.repeat(5000) }).length).toBeLessThan(400);
  });
});

test.describe('on the Incidents page', () => {
  test('switch off (as shipped): the page is as before, with no button and no extra question to the database', async ({ page, backend }) => {
    backend.tables.incidents = incidents();
    await login(page);
    await gotoPage(page, 'incidentsPanel');
    const wrap = page.locator('#incidentsTableWrap');
    await expect(wrap.locator('tbody tr')).toHaveCount(2);
    await expect(wrap.locator('button')).toHaveCount(0);
    await expect(wrap.locator('thead th')).toHaveCount(5);
    await expect(wrap.locator('[data-incclosed]')).toHaveCount(0);
    const reads = backend.requests.filter(r => r.method === 'GET' && r.table === 'incidents' && /actions_taken/.test(param(r, 'select') || ''));
    expect(reads).toEqual([]);
  });

  test('the owner writes what was done and closes: saved once, guarded, and kept under "Closed incidents"', async ({ page, backend }) => {
    backend.tables.incidents = incidents();
    await on(page);
    await login(page);
    await gotoPage(page, 'incidentsPanel');
    const wrap = page.locator('#incidentsTableWrap');
    await expect(wrap.locator('button[data-increcord]')).toHaveCount(2);
    await expect(wrap.locator('[data-incclosed]')).toHaveAttribute('data-incclosed', '1');

    await wrap.locator('tr[data-id="inc-1"] button[data-increcord]').click();
    const form = wrap.locator('form[data-incform="inc-1"]');
    await expect(form.locator('h3')).toHaveText('INC-SYN-0001 — SYNTHETIC emergency account was used');
    await expect(form).toContainText('the spare account signed in once');
    await expect(form.locator('textarea[name="done"]')).toBeFocused();

    // spaces only: refused before anything is sent
    await form.locator('textarea[name="done"]').fill('   ');
    await form.locator('button[data-incsave="close"]').click();
    await expect(form.locator('[data-incmessage]')).toContainText('Write what was done');
    expect(patches(backend)).toEqual([]);

    await form.locator('textarea[name="done"]').fill('SYNTHETIC: we created the spare account and tried it once ourselves.');
    await form.locator('textarea[name="ended"]').fill('SYNTHETIC: expected, nothing wrong.');
    await form.locator('button[data-incsave="close"]').click();
    await expect(wrap.locator('[data-incresult]')).toContainText('INC-SYN-0001 — SYNTHETIC emergency account was used is closed');
    await expect(wrap.locator('[data-incresult]')).toBeFocused();

    const sent = patches(backend);
    expect(sent).toHaveLength(1);
    expect(Object.keys(sent[0].body).sort()).toEqual(['actions_taken', 'closed_at', 'resolution', 'status', 'updated_at']);
    expect(sent[0].body).toMatchObject({ status: 'closed', actions_taken: 'SYNTHETIC: we created the spare account and tried it once ourselves.', resolution: 'SYNTHETIC: expected, nothing wrong.' });
    expect(sent[0].body.closed_at).toBe(sent[0].body.updated_at);
    expect(param(sent[0], 'id')).toBe('eq.inc-1');
    expect(param(sent[0], 'status')).toBe('eq.open');            // only while it is still as the list showed it
    expect(param(sent[0], 'updated_at')).toBe('eq.' + T0);
    expect(backend.requests.filter(r => r.method === 'DELETE')).toEqual([]);

    await expect(wrap.locator('tr[data-id="inc-1"] button[data-increcord]')).toHaveCount(0);   // gone from the open list
    await expect(wrap.locator('form')).toHaveCount(0);
    const closed = wrap.locator('details[data-incclosed]');
    await expect(closed).toHaveAttribute('data-incclosed', '2');
    await closed.locator('summary').click();
    await expect(closed.locator('tr[data-id="inc-1"]')).toContainText('we created the spare account and tried it once ourselves');
    await expect(closed.locator('tr[data-id="inc-1"]')).toContainText('expected, nothing wrong');
  });

  test('a note can be saved without closing; the incident stays open and shows the note next time', async ({ page, backend }) => {
    backend.tables.incidents = incidents();
    await on(page);
    await login(page);
    await gotoPage(page, 'incidentsPanel');
    const wrap = page.locator('#incidentsTableWrap');
    await wrap.locator('tr[data-id="inc-2"] button[data-increcord]').click();
    const form = wrap.locator('form[data-incform="inc-2"]');
    await expect(form.locator('textarea[name="done"]')).toHaveValue('SYNTHETIC asked the carrier');
    await form.locator('textarea[name="done"]').fill('SYNTHETIC asked the carrier; they answered it is on its way.');
    await form.locator('button[data-incsave="note"]').click();
    await expect(wrap.locator('[data-incresult]')).toContainText('It stays open');
    const sent = patches(backend);
    expect(sent).toHaveLength(1);
    expect(Object.keys(sent[0].body).sort()).toEqual(['actions_taken', 'updated_at']);
    expect(param(sent[0], 'status')).toBe('eq.investigating');
    await expect(wrap.locator('tr[data-id="inc-2"] button[data-increcord]')).toHaveCount(1);
    await wrap.locator('tr[data-id="inc-2"] button[data-increcord]').click();
    await expect(wrap.locator('form textarea[name="done"]')).toHaveValue('SYNTHETIC asked the carrier; they answered it is on its way.');
    // Cancel closes the form and puts the keyboard back on the row's button
    await wrap.locator('button[data-inccancel]').click();
    await expect(wrap.locator('form')).toHaveCount(0);
    await expect(wrap.locator('tr[data-id="inc-2"] button[data-increcord]')).toBeFocused();
    expect(patches(backend)).toHaveLength(1);
  });

  test('an administrator gets the button too', async ({ page, backend }) => {
    backend.tables.incidents = incidents();
    backend.tables.profiles[0].role = 'administrator';
    await on(page);
    await login(page);
    await gotoPage(page, 'incidentsPanel');
    await expect(page.locator('#incidentsTableWrap button[data-increcord]')).toHaveCount(2);
    await expect(page.locator('#incidentsTableWrap [data-incclosed]')).toHaveCount(1);
  });

  test('an employee gets no button and no closed list, even with the switch on', async ({ page, backend }) => {
    backend.tables.incidents = incidents();
    backend.tables.profiles[0].role = 'employee';
    await on(page);
    await login(page);
    await gotoPage(page, 'incidentsPanel');
    await expect(page.locator('#incidentsTableWrap tbody tr')).toHaveCount(2);
    await expect(page.locator('#incidentsTableWrap button')).toHaveCount(0);
    await expect(page.locator('#incidentsTableWrap [data-incclosed]')).toHaveCount(0);
    expect(backend.requests.filter(r => r.method === 'GET' && r.table === 'incidents' && /actions_taken/.test(param(r, 'select') || ''))).toEqual([]);
  });

  test('someone else changed the incident meanwhile: nothing is overwritten, and the page says so', async ({ page, backend }) => {
    backend.tables.incidents = incidents();
    await on(page);
    await login(page);
    await gotoPage(page, 'incidentsPanel');
    const wrap = page.locator('#incidentsTableWrap');
    await wrap.locator('tr[data-id="inc-1"] button[data-increcord]').click();
    // another device saves a note first
    Object.assign(backend.tables.incidents[0], { actions_taken: 'SYNTHETIC note from the other device', updated_at: '2026-11-24T09:00:00+00:00' });
    await wrap.locator('form textarea[name="done"]').fill('SYNTHETIC my own note');
    await wrap.locator('form button[data-incsave="close"]').click();
    await expect(wrap.locator('[data-incresult]')).toContainText('was already changed');
    expect(backend.tables.incidents[0]).toMatchObject({ status: 'open', actions_taken: 'SYNTHETIC note from the other device' });
    await wrap.locator('tr[data-id="inc-1"] button[data-increcord]').click();
    await expect(wrap.locator('form textarea[name="done"]')).toHaveValue('SYNTHETIC note from the other device');   // the fresh note is shown
  });

  test('the database refuses: plain words, the typed note stays, and the buttons work again', async ({ page, backend }) => {
    backend.tables.incidents = incidents();
    await on(page);
    await login(page);
    await gotoPage(page, 'incidentsPanel');
    await page.route('**/rest/v1/incidents?*', (route) => route.request().method() === 'PATCH'
      ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'new row violates row-level security policy for table "incidents"' }) })
      : route.fallback());
    const wrap = page.locator('#incidentsTableWrap');
    await wrap.locator('tr[data-id="inc-1"] button[data-increcord]').click();
    await wrap.locator('form textarea[name="done"]').fill('SYNTHETIC my note');
    await wrap.locator('form button[data-incsave="close"]').click();
    await expect(wrap.locator('form [data-incmessage]')).toHaveText('You do not have permission to change this incident. Nothing was changed.');
    await expect(wrap.locator('form textarea[name="done"]')).toHaveValue('SYNTHETIC my note');
    await expect(wrap.locator('form button[data-incsave="close"]')).toBeEnabled();
    await expect(page.locator('body')).not.toContainText('row-level security');
  });

  test('the form and the closed list fit the screen (no sideways scrolling)', async ({ page, backend }) => {
    const rows = incidents();
    rows[0].description = 'SYNTHETIC ' + 'long-word-without-spaces'.repeat(40);
    rows[2].actions_taken = 'SYNTHETIC ' + 'another-long-word'.repeat(60);
    backend.tables.incidents = rows;
    await on(page);
    await login(page);
    await gotoPage(page, 'incidentsPanel');
    const wrap = page.locator('#incidentsTableWrap');
    await wrap.locator('tr[data-id="inc-1"] button[data-increcord]').click();
    await wrap.locator('details[data-incclosed] summary').click();
    await expect(wrap.locator('details[data-incclosed] tr[data-id="inc-old"]')).toBeVisible();
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth, out = [];
      document.querySelectorAll('#incidentsTableWrap form, #incidentsTableWrap form *, #incidentsTableWrap details, #incidentsTableWrap details td').forEach(el => {
        const r = el.getBoundingClientRect(); if (r.width && r.right > w + 1) out.push(el.tagName + ' ' + Math.round(r.right) + '>' + w);
      });
      return out.concat(document.documentElement.scrollWidth > w + 1 ? ['page scrolls sideways'] : []);
    });
    expect(over).toEqual([]);
  });
});
