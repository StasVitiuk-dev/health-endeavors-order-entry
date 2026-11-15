// A very long task title (pasted text) on the Tasks page (Nov 15). At phone
// size a 50,000-character title used to become one card ~43,000 px tall and
// took ~9 s to lay out (the iPhone-size "50,000-character" timing test failed
// for this reason, on the untouched base as well). Now only the first 300
// characters are drawn, with a note of how much is hidden; the saved title is
// not changed and short titles look exactly as before. Synthetic data.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const HUGE = 'SYNTHETIC ' + 'W'.repeat(50000);
const row = (id, title, status) => ({ id, title, status: status || 'open', priority: 'normal', due_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' });

test('a 50,000-character title is drawn short, says how much is hidden, and the page stays fast and narrow', async ({ page, backend }) => {
  backend.tables.tasks = (backend.tables.tasks || []).concat([row('task-huge', HUGE), row('task-done-huge', HUGE, 'done'), row('task-short', 'SYNTHETIC call the bottle supplier')]);
  await login(page);
  const t0 = Date.now();
  await gotoPage(page, 'tasksPanel');
  const open = page.locator('#tasksTableWrap tr[data-id="task-huge"] .taskTitle');
  await expect(open).toContainText('SYNTHETIC WWW');
  const ms = Date.now() - t0;
  const text = await open.textContent();
  expect(text.length).toBeLessThan(400);
  expect(text).toMatch(/… \(49,710 more characters not shown\)$/);
  const done = page.locator('#recentDoneWrap tr[data-id="task-done-huge"] .taskTitle');
  await expect(done).toContainText('more characters not shown');
  // A short title is drawn exactly as saved.
  await expect(page.locator('#tasksTableWrap tr[data-id="task-short"] .taskTitle')).toHaveText('SYNTHETIC call the bottle supplier');
  // The card is a normal size and nothing scrolls sideways.
  const box = await page.locator('#tasksTableWrap tr[data-id="task-huge"]').boundingBox();
  expect(box.height).toBeLessThan(600);
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(ms, 'Tasks page with a 50,000-character title').toBeLessThan(5000);
  // The saved title is untouched: what the page was given is still all there.
  expect(backend.tables.tasks.find(t => t.id === 'task-huge').title.length).toBe(HUGE.length);
});

test('a title of exactly 300 characters is not shortened; 301 is', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  const t300 = 'S'.repeat(300), t301 = 'T'.repeat(301);
  backend.tables.tasks = [row('t300', t300), row('t301', t301)];
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await expect(page.locator('tr[data-id="t300"] .taskTitle')).toHaveText(t300);
  await expect(page.locator('tr[data-id="t301"] .taskTitle')).toHaveText('T'.repeat(300) + '… (1 more characters not shown)');
});
