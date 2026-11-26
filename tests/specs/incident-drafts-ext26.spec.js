// A note being written on an incident survives the page drawing itself again (Nov 26).
// The Incidents list is redrawn on Refresh, pull to refresh, and when another page
// escalates something to Incidents: the open "Record what was done" form used to vanish
// with whatever was typed in it. Behind he_incident_close, as in incident-close-ext24.
// Every value is made up; the database is the mock.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const T0 = '2026-09-17T15:00:00.123456+00:00';
const ROWS = () => [
  { id: 'inc-1', incident_number: 'INC-SYN-0001', title: 'SYNTHETIC emergency account was used', description: null, category: 'security', severity: 'high', status: 'open', due_at: null, actions_taken: null, resolution: null, closed_at: null, created_at: T0, updated_at: T0 },
  { id: 'inc-2', incident_number: 'INC-SYN-0002', title: 'SYNTHETIC late parcel', description: null, category: 'shipping', severity: 'low', status: 'investigating', due_at: null, actions_taken: null, resolution: null, closed_at: null, created_at: T0, updated_at: T0 },
];
const patches = (backend) => backend.requests.filter(r => r.method === 'PATCH' && r.table === 'incidents');
const param = (r, k) => (r.params.find(([n]) => n === k) || [])[1];

async function openForm(page, backend) {
  backend.tables.incidents = ROWS();
  await page.addInitScript(() => { try { localStorage.setItem('he_incident_close', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'incidentsPanel');
  await page.waitForLoadState('networkidle');
  const wrap = page.locator('#incidentsTableWrap');
  await wrap.locator('tr[data-id="inc-1"] button[data-increcord]').click();
  const form = wrap.locator('form[data-incform="inc-1"]');
  await form.locator('textarea[name="done"]').fill('SYNTHETIC we tried the spare account ourselves');
  await form.locator('textarea[name="ended"]').fill('SYNTHETIC expected');
  await wrap.evaluate(el => el.querySelector('[data-inchost]').setAttribute('data-test-old', '1'));
  return { wrap, form };
}
// the list was drawn again: the form's holder is a new element
const redrawn = (wrap) => expect(wrap.locator('[data-inchost]:not([data-test-old])')).toHaveCount(1);

test('a note being typed survives Refresh, and saving it still writes once with the original guard', async ({ page, backend }) => {
  const { wrap, form } = await openForm(page, backend);
  await page.locator('#refreshBtn').click();
  await redrawn(wrap);
  await expect(form.locator('textarea[name="done"]')).toHaveValue('SYNTHETIC we tried the spare account ourselves');
  await expect(form.locator('textarea[name="ended"]')).toHaveValue('SYNTHETIC expected');
  await expect(wrap.locator('form')).toHaveCount(1);
  await form.locator('button[data-incsave="note"]').click();
  await expect(wrap.locator('[data-incresult]')).toContainText('It stays open');
  const sent = patches(backend);
  expect(sent).toHaveLength(1);
  expect(sent[0].body.actions_taken).toBe('SYNTHETIC we tried the spare account ourselves');
  expect(param(sent[0], 'updated_at')).toBe('eq.' + T0);
  await expect(wrap.locator('form')).toHaveCount(0);                                         // saved: the form closes, it does not come back
});

test('the cursor stays where it was when the list is redrawn while typing', async ({ page, backend }) => {
  const { wrap, form } = await openForm(page, backend);
  const box = form.locator('textarea[name="ended"]');
  await box.click();
  await box.evaluate(el => el.setSelectionRange(4, 4));
  await page.evaluate(() => document.getElementById('refreshBtn').click());                  // a click from code keeps the cursor in the box
  await redrawn(wrap);
  await expect(box).toBeFocused();
  expect(await box.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([4, 4]);
});

test('the incident was changed elsewhere meanwhile: the note is kept, but the save is still refused', async ({ page, backend }) => {
  const { wrap, form } = await openForm(page, backend);
  Object.assign(backend.tables.incidents[0], { actions_taken: 'SYNTHETIC note from the other device', updated_at: '2026-11-24T09:00:00+00:00' });
  await page.locator('#refreshBtn').click();
  await redrawn(wrap);
  await expect(form.locator('textarea[name="done"]')).toHaveValue('SYNTHETIC we tried the spare account ourselves');
  await form.locator('button[data-incsave="close"]').click();
  await expect(wrap.locator('[data-incresult]')).toContainText('was already changed');
  expect(param(patches(backend)[0], 'updated_at')).toBe('eq.' + T0);                          // guarded by the version the form was opened on
  expect(backend.tables.incidents[0]).toMatchObject({ status: 'open', actions_taken: 'SYNTHETIC note from the other device' });
});

test('the incident was closed elsewhere meanwhile: the form goes, the page keeps working', async ({ page, backend }) => {
  const { wrap } = await openForm(page, backend);
  Object.assign(backend.tables.incidents[0], { status: 'closed', closed_at: '2026-11-24T09:00:00+00:00', updated_at: '2026-11-24T09:00:00+00:00' });
  await page.locator('#refreshBtn').click();
  await redrawn(wrap);
  await expect(wrap.locator('form')).toHaveCount(0);
  await expect(wrap.locator('tr[data-id="inc-1"] button[data-increcord]')).toHaveCount(0);
  await expect(wrap.locator('tr[data-id="inc-2"] button[data-increcord]')).toHaveCount(1);
  expect(patches(backend)).toEqual([]);
});

test('Cancel still closes the form for good: Refresh does not bring it back', async ({ page, backend }) => {
  const { wrap } = await openForm(page, backend);
  await wrap.locator('button[data-inccancel]').click();
  await expect(wrap.locator('form')).toHaveCount(0);
  await page.locator('#refreshBtn').click();
  await redrawn(wrap);
  await expect(wrap.locator('form')).toHaveCount(0);
});
