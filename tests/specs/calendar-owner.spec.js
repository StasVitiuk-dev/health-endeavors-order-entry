// Calendar page as the owner sees it: Day / Week / Month views, moving
// between dates, the per-calendar filter chips and per-event notes. The
// browser clock is frozen at 10am Central on Monday, June 15, 2026. Verifies
// existing behaviour; synthetic data only (the mock answers every request).

const { test, expect, login, gotoPage, OWNER_USER } = require('../helpers/dashboard');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

const NOW = new Date('2026-06-15T15:00:00Z');
const EVENTS = [
  { id: 'ce-1', uid: 'uid-work', calendar_name: 'SYNTHETIC Work', summary: 'SYNTHETIC standup', location: null, starts_at: '2026-06-15T14:00:00Z', ends_at: '2026-06-15T14:30:00Z', all_day: false },
  { id: 'ce-2', uid: 'uid-home', calendar_name: 'SYNTHETIC Home', summary: 'SYNTHETIC dinner', location: 'SYNTHETIC place', starts_at: '2026-06-15T23:00:00Z', ends_at: null, all_day: false },
  { id: 'ce-3', uid: 'uid-later', calendar_name: 'SYNTHETIC Work', summary: 'SYNTHETIC review', location: null, starts_at: '2026-06-18T15:00:00Z', ends_at: null, all_day: false },
];

const lastEventQuery = backend => backend.requests.filter(r => r.table === 'calendar_events' && r.params.some(([k]) => k === 'starts_at')).pop();

test.beforeEach(async ({ page, backend }) => {
  backend.tables.calendar_events = EVENTS;
  backend.tables.calendar_notes = [];
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'calendarPanel');
  await page.locator('#calViewToggle button[data-calview="day"]').click();
  await expect(page.locator('#calBody')).toContainText('SYNTHETIC standup');
});

test('Day view lists today\'s events with their calendar; later days are not shown', async ({ page }) => {
  await expect(page.locator('#calBody')).toContainText('SYNTHETIC dinner');
  await expect(page.locator('#calBody')).toContainText('SYNTHETIC place');
  await expect(page.locator('#calBody')).not.toContainText('SYNTHETIC review');
});

test('Week view shows the rest of the week too, and the choice is remembered after a reload', async ({ page }) => {
  await page.locator('#calViewToggle button[data-calview="week"]').click();
  await expect(page.locator('#calBody')).toContainText('SYNTHETIC review');
  await page.reload();
  await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('#calViewToggle button[data-calview="week"]')).not.toHaveClass(/secondary/);
});

test('Month view shows a grid with the month label; next/today move the dates asked for', async ({ page, backend }) => {
  await page.locator('#calViewToggle button[data-calview="month"]').click();
  await expect(page.locator('#calMonthLabel')).toContainText('June 2026');
  await page.click('#calNextBtn');
  await expect(page.locator('#calMonthLabel')).toContainText('July 2026');
  // The July grid starts in the last days of June or on July 1, never in early June.
  const julyFrom = () => (lastEventQuery(backend).params.find(([k, v]) => k === 'starts_at' && v.startsWith('gte.')) || [])[1];
  await expect.poll(julyFrom).toMatch(/^gte\.2026-(06-(2|3)|07-)/);
  await page.click('#calTodayBtn');
  await expect(page.locator('#calMonthLabel')).toContainText('June 2026');
});

test('a calendar chip hides and shows that calendar\'s events', async ({ page }) => {
  const chip = page.locator('#calFilters .calChipBtn', { hasText: 'SYNTHETIC Home' });
  await chip.click();
  await expect(page.locator('#calBody')).not.toContainText('SYNTHETIC dinner');
  await expect(page.locator('#calBody')).toContainText('SYNTHETIC standup');
  await chip.click();
  await expect(page.locator('#calBody')).toContainText('SYNTHETIC dinner');
});

test('saving a note on an event stores it by the event\'s id (so it survives the sync)', async ({ page, backend }) => {
  await page.locator('#calBody .calEvent[data-uid="uid-work"] .eTitle').click();
  const box = page.locator('.calNoteBox[data-noteuid="uid-work"]');
  await expect(box).toBeVisible();
  await box.locator('.calNoteText').fill('SYNTHETIC bring notes');
  await box.locator('.calNoteSave').click();
  await expect.poll(() => backend.tableWrites().filter(r => r.table === 'calendar_notes').length).toBe(1);
  const [w] = backend.tableWrites().filter(r => r.table === 'calendar_notes');
  expect(Object.keys(w.body).sort()).toEqual(['created_by', 'event_uid', 'note', 'updated_at']);
  expect(w.body).toMatchObject({ event_uid: 'uid-work', note: 'SYNTHETIC bring notes', created_by: OWNER_USER.id });
  // EXT9: a new note is a plain insert (an upsert silently replaced a note saved elsewhere).
  expect(w.method).toBe('POST');
  expect(new URLSearchParams(w.query).get('on_conflict')).toBeNull();
  // The synced events themselves are never written to.
  expect(backend.tableWrites().filter(r => r.table === 'calendar_events')).toEqual([]);
});

// EXT9: two tabs (or two people) editing the same note or event never
// silently overwrite each other.
test.describe('calendar edits made elsewhere are never overwritten', () => {
  test('a note added in another tab meanwhile: this one is refused, nothing overwritten, the text is kept in the message', async ({ page, backend }) => {
    await page.context().route(/\/rest\/v1\/calendar_notes(\?|$)/, r => r.request().method() === 'POST'
      ? r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "calendar_notes_event_uid_key"' }) })
      : r.fallback());
    await page.locator('#calBody .calEvent[data-uid="uid-work"] .eTitle').click();
    const box = page.locator('.calNoteBox[data-noteuid="uid-work"]');
    await box.locator('.calNoteText').fill('SYNTHETIC mine');
    await box.locator('.calNoteSave').click();
    await expect(page.locator('#dashError')).toContainText('changed or added somewhere else');
    await expect(page.locator('#dashError')).toContainText('SYNTHETIC mine');
  });

  test('editing an existing note only applies while it is still the text shown', async ({ page, backend }) => {
    backend.tables.calendar_notes = [{ id: 'cn-1', event_uid: 'uid-work', note: 'SYNTHETIC old note' }];
    await page.reload();
    await gotoPage(page, 'calendarPanel');
    await page.locator('#calBody .calEvent[data-uid="uid-work"] .eTitle').click();
    const box = page.locator('.calNoteBox[data-noteuid="uid-work"]');
    await expect(box.locator('.calNoteText')).toHaveValue('SYNTHETIC old note');
    await box.locator('.calNoteText').fill('SYNTHETIC edited');
    await box.locator('.calNoteSave').click();
    await expect.poll(() => backend.tableWrites().filter(r => r.table === 'calendar_notes').length).toBe(1);
    const [w] = backend.tableWrites().filter(r => r.table === 'calendar_notes');
    expect(w.method).toBe('PATCH');
    expect(w.body).toMatchObject({ note: 'SYNTHETIC edited' });
    const p = new URLSearchParams(w.query);
    expect(p.get('event_uid')).toBe('eq.uid-work');
    expect(p.get('note')).toBe('eq.SYNTHETIC old note');
  });
});
