// What is being typed on the Calendar page survives the calendar drawing itself again
// (Nov 26). The page reloads the calendar on Refresh and, right after sign-in, while it loads
// every page in the background; each reload redraws the open event. A half-typed note on a
// synced appointment (calendar-owner.spec.js) or a half-edited event of your own (here) used
// to come back empty. Every value is made up; the database is the mock.
const { test, expect, gotoPage, OWNER_USER } = require('../helpers/dashboard');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
const NOW = new Date('2026-06-15T15:00:00Z');
const MINE = { id: 'pe-1', owner_id: OWNER_USER.id, title: 'SYNTHETIC dentist', starts_at: '2026-06-15T19:00:00Z', ends_at: null, all_day: false };

async function openMine(page, backend) {
  backend.tables.profiles[0].role = 'administrator';                                          // non-owners get their own calendar
  backend.tables.personal_calendar_events = [Object.assign({}, MINE)];
  await page.clock.setFixedTime(NOW);
  await page.goto('/owner-login.html');
  await page.fill('#email', OWNER_USER.email);
  await page.fill('#password', OWNER_USER.password);
  await page.click('#loginBtn');
  await expect(page.locator('#whoAmI')).toContainText('role: administrator');
  await gotoPage(page, 'calendarPanel');
  await page.locator('#calViewToggle button[data-calview="day"]').click();
  await page.waitForLoadState('networkidle');
  await page.locator('#calBody .calEvent[data-uid="pe-1"] .eTitle').click();
  const box = page.locator('.calNoteBox[data-personaluid="pe-1"]');
  await expect(box.locator('.personalEditTitle')).toHaveValue('SYNTHETIC dentist');
  return box;
}

test('an event of your own being edited survives a redraw; the save still checks it was not changed elsewhere', async ({ page, backend }) => {
  const box = await openMine(page, backend);
  // the next reload is held back until the change has been typed, then let through
  let release; const held = new Promise(r => { release = r; });
  let heldOnce = false;
  await page.route('**/rest/v1/personal_calendar_events?*', async route => {
    if (route.request().method() === 'GET' && !heldOnce) { heldOnce = true; await held; }
    await route.fallback();
  });
  await page.locator('#refreshBtn').click();
  await expect.poll(() => heldOnce).toBe(true);
  await box.locator('.personalEditTitle').fill('SYNTHETIC dentist, bring the card');
  await box.locator('.personalEditEnd').fill('2026-06-15T14:30');
  await box.evaluate(el => el.setAttribute('data-test-old', '1'));
  release();
  await expect(page.locator('.calNoteBox[data-personaluid="pe-1"]:not([data-test-old])')).toHaveCount(1);   // drawn again
  await expect(box.locator('.personalEditTitle')).toHaveValue('SYNTHETIC dentist, bring the card');
  await expect(box.locator('.personalEditEnd')).toHaveValue('2026-06-15T14:30');
  await expect(box.locator('.personalEditEnd')).toBeFocused();                                 // back where you were typing
  // changed in another tab meanwhile: the save is refused, nothing is overwritten
  backend.tables.personal_calendar_events[0].title = 'SYNTHETIC changed in another tab';
  await box.locator('.personalEditSave').click();
  await expect(page.locator('#dashError')).toBeVisible();
  expect(backend.tables.personal_calendar_events[0].title).toBe('SYNTHETIC changed in another tab');
  // then the editor shows the other version, and saving from it works
  await expect(box.locator('.personalEditTitle')).toHaveValue('SYNTHETIC changed in another tab');
  await box.locator('.personalEditTitle').fill('SYNTHETIC changed in another tab, card');
  await box.locator('.personalEditSave').click();
  await expect.poll(() => backend.tables.personal_calendar_events[0].title).toBe('SYNTHETIC changed in another tab, card');
});

test('nothing changed in the editor: a redraw shows the event as it is now', async ({ page, backend }) => {
  const box = await openMine(page, backend);
  backend.tables.personal_calendar_events[0].title = 'SYNTHETIC renamed on the phone';
  await page.locator('#refreshBtn').click();
  await expect(box.locator('.personalEditTitle')).toHaveValue('SYNTHETIC renamed on the phone');
});
