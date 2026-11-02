// Employee Activity page: people chips, search, area and date filters,
// "Clear all", paging, and how privacy-light entries are shown. Checks what
// the page asks the protected employee_activity function for. Verifies
// existing behaviour; synthetic data only (the mock answers every request).

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.use({ timezoneId: 'America/Chicago' });

const PEOPLE = [
  { id: 'p-owner', display_name: 'SYNTHETIC Owner', email: 'o@example.test', account_number: '111222333', role: 'owner' },
  { id: 'p-admin', display_name: 'SYNTHETIC Admin', email: 'a@example.test', account_number: '444555666', role: 'administrator' },
];

function entry(i, extra = {}) {
  return {
    id: i, happened_at: '2026-09-20T15:00:00Z', person_id: 'p-admin', person_name: 'SYNTHETIC Admin', person_email: 'a@example.test',
    person_account_number: '444555666', person_role: 'administrator', area: 'Tasks', table_name: 'tasks', action: 'UPDATE',
    action_label: 'changed', record_id: 'task-' + i, values_stored: true, old_data: { status: 'open' }, new_data: { status: 'done', title: 'SYNTHETIC task ' + i },
    ...extra,
  };
}

// The last employee_activity call made for the list (not the daily digest,
// which always asks for up to 500 rows).
const lastListCall = backend => backend.requests.filter(r => r.rpc === 'employee_activity' && r.body.p_limit === 50).pop();

test.beforeEach(async ({ page, backend }) => {
  backend.rpc.employee_activity_people = PEOPLE;
  backend.rpc.employee_activity_areas = [{ table_name: 'tasks', area: 'Tasks', entries: 3 }, { table_name: 'customers', area: 'Customers', entries: 1 }];
  backend.rpc.employee_activity = [
    entry(1),
    entry(2, { table_name: 'customers', area: 'Customers', record_id: 'cust-1', values_stored: false, old_data: null, new_data: { changed_fields: ['email', 'phone'], note: 'values not stored' } }),
  ];
  await login(page);
  await gotoPage(page, 'activityPanel');
  await page.waitForLoadState('networkidle');
});

test('people chips show name, formatted account number and role; clicking one filters by that person', async ({ page, backend }) => {
  const chip = page.locator('#activityPeople .personChip', { hasText: 'SYNTHETIC Admin' });
  await expect(chip).toContainText('#444-555-666');
  await expect(chip).toContainText('Administrator');
  await chip.click();
  await expect.poll(() => lastListCall(backend).body.p_person).toBe('p-admin');
  await page.locator('#activityPeople .personChip', { hasText: 'Everyone' }).click();
  await expect.poll(() => lastListCall(backend).body.p_person).toBe(null);
});

test('search, area and date range are passed to the protected feed', async ({ page, backend }) => {
  await page.fill('#activitySearch', 'SYN-1001');
  await page.press('#activitySearch', 'Enter');
  await expect.poll(() => lastListCall(backend).body.p_search).toBe('SYN-1001');
  await page.selectOption('#activityArea', 'customers');
  await expect.poll(() => lastListCall(backend).body.p_area).toBe('customers');
  await page.selectOption('#activityRange', 'today');
  await expect.poll(() => lastListCall(backend).body.p_from).not.toBe(null);
  expect(lastListCall(backend).body).toMatchObject({ p_search: 'SYN-1001', p_area: 'customers', p_limit: 50, p_offset: 0 });
});

test('"Clear all" resets search, person, area and date range', async ({ page, backend }) => {
  await page.fill('#activitySearch', 'SYNTHETIC');
  await page.selectOption('#activityRange', '7');
  await page.locator('#activityPeople .personChip', { hasText: 'SYNTHETIC Admin' }).click();
  await page.click('#activityClearBtn');
  await expect(page.locator('#activitySearch')).toHaveValue('');
  await expect.poll(() => lastListCall(backend).body).toMatchObject({ p_search: null, p_person: null, p_area: null, p_from: null });
});

test('a full page of 50 shows "Load more", which asks for the next 50', async ({ page, backend }) => {
  backend.rpc.employee_activity = Array.from({ length: 50 }, (_, i) => entry(i + 1));
  await page.click('#activitySearchBtn');
  await expect(page.locator('#activityMoreWrap')).toBeVisible();
  await page.click('#activityMoreBtn');
  await expect.poll(() => lastListCall(backend).body.p_offset).toBe(50);
});

test('fewer than 50 results hide "Load more"', async ({ page }) => {
  await expect(page.locator('#activityMoreWrap')).toBeHidden();
});

test('privacy-light entries show which fields changed, never the values', async ({ page }) => {
  const wrap = page.locator('#activityWrap');
  await expect(wrap).toContainText('SYNTHETIC Admin');
  const item = wrap.locator('.actItem', { hasText: 'Customers' });
  await item.locator('.actToggle').click();
  const detail = item.locator('.actDetail');
  await expect(detail).toContainText('Email');
  await expect(detail).toContainText('Phone');
  await expect(detail).toContainText("Actual values aren't recorded");
  // A full-detail entry shows before and after values instead.
  const full = wrap.locator('.actItem', { hasText: 'Tasks' });
  await full.locator('.actToggle').click();
  await expect(full.locator('.actDetail')).toContainText('done');
});

test('looking around the activity page writes nothing', async ({ page, backend }) => {
  await page.selectOption('#activityRange', '30');
  await page.waitForLoadState('networkidle');
  expect(backend.tableWrites()).toEqual([]);
});

// SC-02 / SC-03 (2026-10-06): the export and the daily digest must not
// silently stop at what happens to be loaded.
const feed = all => body => all.slice(body.p_offset || 0, (body.p_offset || 0) + (body.p_limit || 50));

test('"Export to spreadsheet" contains every matching change (1,200), not only the 50 on screen', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'download; run once');
  const fs = require('fs');
  backend.rpc.employee_activity = feed(Array.from({ length: 1200 }, (_, i) => entry(i + 1)));
  await page.click('#activitySearchBtn');
  await expect(page.locator('#activityMoreWrap')).toBeVisible(); // only 50 loaded on screen
  const [file] = await Promise.all([page.waitForEvent('download'), page.click('#activityExportBtn')]);
  const csv = fs.readFileSync(await file.path(), 'utf8');
  expect(csv.trim().split('\r\n').length).toBe(1201); // header + 1,200
  // the export keeps the page's filters
  const exportCalls = backend.requests.filter(r => r.rpc === 'employee_activity' && r.body.p_limit === 500 && r.body.p_from !== undefined && 'p_person' in r.body);
  expect(exportCalls.length).toBe(3);
});

test('the "Today" digest says 500+ when it hits its limit, not an exact-looking 500', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'wording; run once');
  backend.rpc.employee_activity = feed(Array.from({ length: 900 }, (_, i) => entry(i + 1)));
  await page.reload();
  await expect(page.locator('#dash')).toBeVisible();
  await gotoPage(page, 'activityPanel');
  await expect(page.locator('#activityDigest')).toContainText('500+ changes');
});

// EXT5 (workstream 32): pages are counted by position. A change recorded
// while someone pages or exports shifts everything by one; the next page
// then repeats rows. The audit log only grows, so ids already shown are
// skipped (newest-first feed, like the real one).
test('a change recorded between "Load more" clicks does not show a row twice', async ({ page, backend }) => {
  let all = Array.from({ length: 60 }, (_, i) => entry(60 - i)); // ids 60..1, newest first
  backend.rpc.employee_activity = body => all.slice(body.p_offset || 0, (body.p_offset || 0) + (body.p_limit || 50));
  await page.click('#activitySearchBtn');
  await expect(page.locator('#activityMoreWrap')).toBeVisible();
  all = [entry(61, { record_id: 'task-new' }), ...all]; // one new change arrives at the top
  await page.click('#activityMoreBtn');
  await expect.poll(() => lastListCall(backend).body.p_offset).toBe(50);
  await page.waitForLoadState('networkidle');
  // the row that would be repeated is entry 11 (position 50 before the shift)
  await expect(page.locator('#activityWrap')).toContainText('SYNTHETIC task 1');
  const text = await page.locator('#activityWrap').innerText();
  expect((text.match(/SYNTHETIC task 11\b/g) || []).length, 'entry 11 shown once').toBe(1);
  expect((text.match(/SYNTHETIC task 61\b/g) || []).length, 'the new entry is not on page 2').toBe(0);
});

test('the export has no duplicate rows when changes arrive while it pages', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'download; run once');
  const fs = require('fs');
  let all = Array.from({ length: 1200 }, (_, i) => entry(1200 - i));
  let calls = 0;
  backend.rpc.employee_activity = body => {
    if (body.p_limit === 500 && (body.p_offset || 0) > 0 && calls++ === 0) all = [entry(1201), entry(1202), ...all]; // 2 new changes mid-export
    return all.slice(body.p_offset || 0, (body.p_offset || 0) + (body.p_limit || 50));
  };
  await page.click('#activitySearchBtn');
  const [file] = await Promise.all([page.waitForEvent('download'), page.click('#activityExportBtn')]);
  const lines = fs.readFileSync(await file.path(), 'utf8').trim().split('\r\n').slice(1);
  expect(new Set(lines).size).toBe(lines.length);
});
