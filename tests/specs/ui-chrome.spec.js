// The parts of the dashboard around the pages: theme, command palette,
// keyboard shortcuts, back/forward, quick-add reminder, the change-history
// overlay (Record Inspector) on desktop and phone, and the password prompt.
// Keyboard tests run at desktop size only (a phone has no keyboard shortcuts).

const { test, expect, login, gotoPage, openTasks, taskRow, OWNER_USER } = require('../helpers/dashboard');
const { enableWrites } = require('../helpers/stateful-backend');

const isPage = (page, id) => expect(page.locator(`section#${id}`)).toHaveClass(/activePage/);
const desktopOnly = (testInfo) => test.skip(testInfo.project.name !== 'desktop', 'keyboard / hover: desktop only');
const phoneOnly = (testInfo) => test.skip(testInfo.project.name !== 'iphone', 'tap to inspect: phone only');

const HISTORY = [{
  happened_at: '2026-09-20T15:00:00Z', person_name: 'Synthetic Owner', person_account_number: null, person_role: 'owner',
  table_name: 'tasks', record_id: 'task-open-1', area: 'Tasks', action: 'UPDATE', action_label: 'Updated',
  values_stored: true, old_data: { status: 'open' }, new_data: { status: 'in_progress' },
}];

test.beforeEach(async ({ page, backend }) => {
  backend.rpc.employee_activity = HISTORY;
  enableWrites(backend, ['manual_attention_items']);
  await login(page);
  await page.waitForLoadState('networkidle');
});

// ------------------------------------------------------------------ theme
test('theme button cycles Auto → Light → Dark → Auto and is remembered', async ({ page }) => {
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  await page.click('#themeBtn');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.click('#themeBtn');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('#dash')).toBeVisible();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.click('#themeBtn');
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
});

// --------------------------------------------------------- command palette
test.describe('command palette and keyboard', () => {
  test.beforeEach(({}, testInfo) => desktopOnly(testInfo));

  test('⌘K opens the palette; clicking a page result opens it; Esc closes', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('#paletteOverlay')).toHaveClass(/open/);
    await expect(page.locator('#paletteInput')).toBeFocused();
    await page.keyboard.type('Expenses');
    await page.locator('#paletteResults .pResult', { has: page.locator('.pKind', { hasText: /^Finance$/ }) }).first().click();
    await expect(page.locator('#paletteOverlay')).not.toHaveClass(/open/);
    await isPage(page, 'expensesPanel');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.press('Escape');
    await expect(page.locator('#paletteOverlay')).not.toHaveClass(/open/);
  });

  test('KNOWN BUG: typing a page name and pressing Enter opens a guide article, not the page', async ({ page }) => {
    // Same cause as the sidebar-search fixme in general.spec.js: guide
    // matches are listed first, so Enter picks the guide.
    await gotoPage(page, 'tasksPanel');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('Expenses');
    await expect(page.locator('#paletteResults .pResult.sel')).toContainText('Guide');
    await page.keyboard.press('Enter');
    await expect(page.locator('#helpOverlay')).toHaveClass(/open/);
    await isPage(page, 'tasksPanel');
  });

  test('the palette finds records too (a task by its title)', async ({ page }) => {
    // The palette searches records the pages have already loaded, and Tasks
    // loads in the background some time after login. Typing before that raced
    // (1 in 6 runs failed even on the unchanged integration branch), so load
    // Tasks first, move to another page, then search from there.
    await gotoPage(page, 'tasksPanel');
    await expect(page.locator('#tasksTableWrap')).toContainText('SYNTHETIC in-progress task');
    await gotoPage(page, 'ordersPanel');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('SYNTHETIC in-progress');
    const hit = page.locator('#paletteResults .pResult', { hasText: 'SYNTHETIC in-progress task' });
    await expect(hit).toBeVisible();
    await hit.click();
    await isPage(page, 'tasksPanel');
  });

  test('arrow keys move the selection; clicking outside closes', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    // The palette focuses its input 10 ms after opening; a key pressed before
    // that is lost, which made this test fail about 4 times in 10.
    await expect(page.locator('#paletteInput')).toBeFocused();
    const selIndex = () => page.locator('#paletteResults .pResult.sel').getAttribute('data-i');
    expect(await selIndex()).toBe('0');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await selIndex()).toBe('2');
    await page.keyboard.press('ArrowUp');
    expect(await selIndex()).toBe('1');
    await page.mouse.click(5, 5);
    await expect(page.locator('#paletteOverlay')).not.toHaveClass(/open/);
  });

  test('? shows the shortcut list; Esc closes it', async ({ page }) => {
    await page.keyboard.press('Shift+Slash');
    await expect(page.locator('#shortcutOverlay')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#shortcutOverlay')).not.toHaveClass(/open/);
  });

  test('g then a letter jumps to a page', async ({ page }) => {
    const go = async (letter, id) => { await page.keyboard.press('g'); await page.keyboard.press(letter); await isPage(page, id); };
    await go('o', 'ordersPanel');
    await go('e', 'expensesPanel');
    await go('i', 'inventoryPanel');
    await go('t', 'tasksPanel');
    await go('r', 'returnsPanel');
    await go('n', 'attentionPanel');
  });

  test('/ puts the cursor in the sidebar search; shortcuts are ignored while typing', async ({ page }) => {
    await gotoPage(page, 'tasksPanel');
    await page.keyboard.press('/');
    await expect(page.locator('#sidebarSearch')).toBeFocused();
    await page.keyboard.type('go');
    await isPage(page, 'tasksPanel');
    await expect(page.locator('#sidebarSearch')).toHaveValue('go');
  });

  test('⌘[ and ⌘] go back and forward between pages', async ({ page }) => {
    await gotoPage(page, 'ordersPanel');
    await gotoPage(page, 'expensesPanel');
    await gotoPage(page, 'tasksPanel');
    await page.keyboard.press('ControlOrMeta+BracketLeft');
    await isPage(page, 'expensesPanel');
    await page.keyboard.press('ControlOrMeta+BracketLeft');
    await isPage(page, 'ordersPanel');
    await page.keyboard.press('ControlOrMeta+BracketRight');
    await isPage(page, 'expensesPanel');
  });

  test('⌘N quick reminder saves only title, priority and who created it', async ({ page, backend }) => {
    await page.keyboard.press('ControlOrMeta+n');
    await expect(page.locator('#quickAddOverlay')).toHaveClass(/open/);
    await page.keyboard.type('SYNTHETIC reminder');
    await page.selectOption('#quickAddPriority', 'high');
    await page.click('#quickAddSave');
    await expect(page.locator('#quickAddOverlay')).not.toHaveClass(/open/);
    const w = backend.tableWrites().filter(r => r.table === 'manual_attention_items');
    expect(w).toHaveLength(1);
    expect(w[0].body).toEqual({ title: 'SYNTHETIC reminder', priority: 'high', created_by: OWNER_USER.id });
  });

  test('an empty quick reminder just closes without saving', async ({ page, backend }) => {
    await page.keyboard.press('ControlOrMeta+n');
    await page.keyboard.press('Enter');
    await expect(page.locator('#quickAddOverlay')).not.toHaveClass(/open/);
    expect(backend.tableWrites()).toEqual([]);
  });

  test('j / k move a row cursor on the Tasks page', async ({ page }) => {
    await openTasks(page);
    await page.locator('#tasksPanel h2').first().click();
    await page.keyboard.press('j');
    await expect(page.locator('#tasksTableWrap .rowCursor')).toHaveCount(1);
    const first = await page.locator('#tasksTableWrap .rowCursor').getAttribute('data-id');
    await page.keyboard.press('j');
    const second = await page.locator('#tasksTableWrap .rowCursor').getAttribute('data-id');
    expect(second).not.toBe(first);
    await page.keyboard.press('k');
    expect(await page.locator('#tasksTableWrap .rowCursor').getAttribute('data-id')).toBe(first);
  });
});

// ------------------------------------------------ change-history overlay
test.describe('change-history overlay (Record Inspector)', () => {
  test('desktop: hover a task row and press Space to see its history; Esc closes', async ({ page, backend }, testInfo) => {
    desktopOnly(testInfo);
    await openTasks(page);
    await taskRow(page, 'task-open-1').locator('td').first().hover();
    await page.keyboard.press('Space');
    const overlay = page.locator('#inspectorOverlay');
    await expect(overlay).toHaveClass(/open/);
    await expect(page.locator('#insBody')).toContainText('Synthetic Owner');
    const call = backend.requests.find(r => r.rpc === 'employee_activity' && r.body && r.body.p_area === 'tasks');
    expect(call.body).toMatchObject({ p_search: 'task-open-1', p_area: 'tasks' });
    await page.click('#insTabRaw');
    await expect(page.locator('#insBody')).toContainText('in_progress');
    await page.keyboard.press('Escape');
    await expect(overlay).not.toHaveClass(/open/);
  });

  test('phone: tapping a row opens the history as a sheet that fits the screen; Close closes it', async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    await openTasks(page);
    await taskRow(page, 'task-open-1').locator('td').first().click();
    const overlay = page.locator('#inspectorOverlay');
    await expect(overlay).toHaveClass(/open/);
    const card = await page.locator('#inspectorOverlay .insCard').boundingBox();
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(391);
    await expect(page.locator('#insCloseBtn')).toBeInViewport();
    await page.click('#insCloseBtn');
    await expect(overlay).not.toHaveClass(/open/);
  });

  test('phone: tapping a task button does not open the history', async ({ page }, testInfo) => {
    phoneOnly(testInfo);
    await openTasks(page);
    page.once('dialog', d => d.dismiss());
    await taskRow(page, 'task-open-1').locator('.taskStatusBtn', { hasText: 'Mark done' }).click();
    await expect(page.locator('#inspectorOverlay')).not.toHaveClass(/open/);
  });
});

// --------------------------------------------------------- password prompt
test.describe('password prompt for sensitive actions', () => {
  test('Enter in the password box confirms; an empty password is refused', async ({ page, backend }) => {
    backend.tables.orders = [{ id: 'o-1', order_number: 'SYN-2001', customer_name: 'SYNTHETIC', customer_email: 'x@example.test', status: 'paid', currency: 'USD', total: 1, placed_at: '2026-09-01T00:00:00Z', deleted_at: null }];
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await gotoPage(page, 'ordersPanel');
    await page.waitForLoadState('networkidle');
    const overlay = page.locator('#inspectorOverlay');
    if (await overlay.evaluate(el => el.classList.contains('open'))) await page.click('#insCloseBtn');
    await page.locator('.deleteOrderBtn').first().click();
    await page.click('#reauthConfirmBtn');
    await expect(page.locator('#reauthMsg')).toContainText('Enter your password');
    await page.fill('#reauthPassword', OWNER_USER.password);
    await page.press('#reauthPassword', 'Enter');
    await expect(page.locator('#reauthOverlay')).toBeHidden();
    await expect.poll(() => backend.tableWrites().filter(r => r.table === 'orders').length).toBe(1);
  });
});
