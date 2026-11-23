// A dialog that opens takes keyboard focus (Nov 15). Found by a probe: the
// shortcut list, the Guide box and the record history opened with focus left
// on the page behind them, so a screen reader was not told anything had
// opened, and Enter or Space pressed whatever button was focused BEHIND the
// dialog (for example Delete on an order). The password prompt, the command
// palette, the quick reminder and Scan Shipment already took focus (tested in
// a11y-basics, ui-chrome and keyboard-focus-ext21). Computer size: keyboard.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { seedBusiness } = require('../fixtures/business-data');

const inside = (page, id) => page.evaluate(d => document.getElementById(d).contains(document.activeElement), id);

test.beforeEach(async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'keyboard; run once');
  seedBusiness(backend);
  await login(page);
  await gotoPage(page, 'ordersPanel');
  await page.waitForLoadState('networkidle');
});

test('shortcut list: focus moves in, Enter cannot press the button behind it, Escape returns focus', async ({ page, backend }) => {
  const del = page.locator('#ordersTableWrap .deleteOrderBtn').first();
  await del.focus();
  await page.keyboard.press('Shift+Slash');
  await expect(page.locator('#shortcutOverlay.open')).toBeVisible();
  await expect(page.locator('#shortcutOverlay h3')).toBeFocused();
  // Enter and Space now go to the dialog, not to "Delete" behind it.
  await page.keyboard.press('Enter');
  await page.keyboard.press(' ');
  await expect(page.locator('#reauthOverlay')).toBeHidden();
  await expect(page.locator('#shortcutOverlay.open')).toBeVisible();
  // Tab stays inside (the list has no buttons, so focus simply stays put).
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); expect(await inside(page, 'shortcutOverlay'), 'Tab ' + i).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(page.locator('#shortcutOverlay.open')).toHaveCount(0);
  await expect(del).toBeFocused();
  expect(backend.tableWrites()).toEqual([]);
});

test('Guide box: focus moves to its title; Tab stays inside; Escape closes', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('how do returns work');
  await expect(page.locator('#paletteResults .pResult.sel')).toContainText('Guide');
  await page.keyboard.press('Enter');
  await expect(page.locator('#helpOverlay.open')).toBeVisible();
  await expect(page.locator('#helpTitle')).toBeFocused();
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); expect(await inside(page, 'helpOverlay'), 'Tab ' + i).toBe(true); }
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Shift+Tab'); expect(await inside(page, 'helpOverlay'), 'Shift+Tab ' + i).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(page.locator('#helpOverlay.open')).toHaveCount(0);
});

test('record history: focus moves to its title; Tab stays inside; Escape closes', async ({ page }) => {
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.locator('#ordersTableWrap tbody tr').first().hover();
  await page.keyboard.press(' ');
  await expect(page.locator('#inspectorOverlay.open')).toBeVisible();
  await expect(page.locator('#insTitle')).toBeFocused();
  // The title is not a control, so it draws no focus ring (the buttons still do).
  expect(await page.locator('#insTitle').evaluate(e => getComputedStyle(e).outlineStyle)).toBe('none');
  // The title names the record with its cells kept apart (they used to run
  // together: "SYN-1001SYNTHETIC Customer Onepaid$100.00Jun 15,").
  await expect(page.locator('#insTitle')).toHaveText('Orders · SYN-1001 · SYNTHETIC Customer One · paid');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); expect(await inside(page, 'inspectorOverlay'), 'Tab ' + i).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspectorOverlay.open')).toHaveCount(0);
});

test('every dialog holds keyboard focus the moment it is open', async ({ page }) => {
  const outside = [];
  const check = async (name, id) => { if (!(await inside(page, id))) outside.push(name); await page.keyboard.press('Escape'); };
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#paletteOverlay.open')).toBeVisible();
  await check('command palette', 'paletteOverlay');
  await page.keyboard.press('ControlOrMeta+n');
  await expect(page.locator('#quickAddOverlay.open')).toBeVisible();
  await check('quick reminder', 'quickAddOverlay');
  await page.locator('#refreshBtn').focus();
  await page.keyboard.press('Shift+Slash');
  await expect(page.locator('#shortcutOverlay.open')).toBeVisible();
  await check('shortcut list', 'shortcutOverlay');
  await page.locator('#ordersTableWrap .deleteOrderBtn').first().click();
  await expect(page.locator('#reauthOverlay')).toBeVisible();
  await check('password prompt', 'reauthOverlay');
  expect(outside).toEqual([]);
});

test('record history title: whole cells only, no button text, a very long name is cut with an ellipsis', async ({ page, backend }) => {
  const LONG = 'SYNTHETIC ' + 'long name '.repeat(30).trim();
  backend.tables.tasks = [
    { id: 'task-long', title: LONG, status: 'open', priority: 'normal', due_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' },
    { id: 'task-plain', title: 'SYNTHETIC call the bottle supplier', status: 'open', priority: 'low', due_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' },
  ];
  await page.reload();                      // the page had already loaded its tasks
  await gotoPage(page, 'tasksPanel');
  await expect(page.locator('#tasksTableWrap tr[data-id="task-plain"]')).toBeVisible();
  const open = async id => {
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.locator(`#tasksTableWrap tr[data-id="${id}"] .taskTitle`).hover();
    await page.keyboard.press(' ');
    await expect(page.locator('#inspectorOverlay.open')).toBeVisible();
    const t = await page.locator('#insTitle').textContent();
    await page.keyboard.press('Escape');
    return t;
  };
  const plain = await open('task-plain');
  expect(plain.startsWith('Tasks · SYNTHETIC call the bottle supplier · low')).toBe(true);
  // No text taken from the row's buttons.
  const buttons = await page.locator('#tasksTableWrap tr[data-id="task-plain"] button').allTextContents();
  expect(buttons.length).toBeGreaterThan(0);
  for (const b of buttons.map(x => x.trim()).filter(Boolean)) expect(plain.includes(' · ' + b), b).toBe(false);
  const long = await open('task-long');
  expect(long).toBe('Tasks · ' + LONG.slice(0, 47) + '…');
});
