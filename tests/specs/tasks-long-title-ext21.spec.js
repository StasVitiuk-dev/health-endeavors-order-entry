// A very long task title (pasted text) on the Tasks page (Nov 15). At phone
// size a 50,000-character title used to become one card ~43,000 px tall and
// took ~9 s to lay out (the iPhone-size "50,000-character" timing test failed
// for this reason, on the untouched base as well). The Orders page froze the
// same way on a long customer name. Now any table cell draws at most the first
// 600 characters of a text, with a note of how much is hidden (one shared rule,
// clipLongCellText in assets/app/he-ui.js); saved data is not changed and
// shorter text looks exactly as before. Synthetic data.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { seedBusiness } = require('../fixtures/business-data');

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
  expect(text.length).toBeLessThan(700);
  expect(text).toMatch(/… \(49,410 more characters not shown\)$/);
  const done = page.locator('#recentDoneWrap tr[data-id="task-done-huge"] .taskTitle');
  await expect(done).toContainText('more characters not shown');
  // A short title is drawn exactly as saved.
  await expect(page.locator('#tasksTableWrap tr[data-id="task-short"] .taskTitle')).toHaveText('SYNTHETIC call the bottle supplier');
  // The card is a normal size and nothing scrolls sideways.
  const box = await page.locator('#tasksTableWrap tr[data-id="task-huge"]').boundingBox();
  expect(box.height).toBeLessThan(900);
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(ms, 'Tasks page with a 50,000-character title').toBeLessThan(5000);
  // The saved title is untouched: what the page was given is still all there.
  expect(backend.tables.tasks.find(t => t.id === 'task-huge').title.length).toBe(HUGE.length);
});

test('a title of exactly 600 characters is not shortened; 601 is', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  const t600 = 'S'.repeat(600), t601 = 'T'.repeat(601);
  backend.tables.tasks = [row('t600', t600), row('t601', t601)];
  await login(page);
  await gotoPage(page, 'tasksPanel');
  await expect(page.locator('tr[data-id="t600"] .taskTitle')).toHaveText(t600);
  await expect(page.locator('tr[data-id="t601"] .taskTitle')).toHaveText('T'.repeat(600) + '… (1 more characters not shown)');
});

test('every operations page stays fast with 50,000-character text in each table (phone and computer)', async ({ page, backend }, ti) => {
  test.setTimeout(240000);
  seedBusiness(backend);
  // A very long value in each free-text field of the first row of each table
  // (named one by one: other text columns only accept fixed values).
  const FREE_TEXT = { tasks: ['title'], orders: ['customer_name'], order_items: ['product_name'], products: ['name'], expenses: ['vendor'], returns: ['reason'] };
  let fields = 0;
  for (const [name, cols] of Object.entries(FREE_TEXT)) {
    const first = (backend.tables[name] || [])[0];
    if (!first) continue;
    for (const k of cols) if (typeof first[k] === 'string') { first[k] = HUGE; fields++; }
  }
  expect(fields).toBeGreaterThanOrEqual(5);
  await login(page);
  const slow = [], tall = [];
  for (const p of ['ordersPanel', 'inventoryPanel', 'returnsPanel', 'expensesPanel', 'accountingPanel', 'tasksPanel', 'attentionPanel']) {
    const t0 = Date.now();
    await gotoPage(page, p);
    await page.waitForLoadState('networkidle');
    const ms = Date.now() - t0;
    if (ms > 5000) slow.push(p + ' ' + ms + ' ms');
    const h = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('table.phoneCards tr')].filter(r => r.getClientRects().length).map(r => r.getBoundingClientRect().height)));
    if (h > 2500) tall.push(p + ' row ' + Math.round(h) + ' px');
  }
  expect(slow, ti.project.name).toEqual([]);
  expect(tall, ti.project.name).toEqual([]);
});
