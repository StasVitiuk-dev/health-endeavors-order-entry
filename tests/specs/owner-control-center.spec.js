// EXT7 (workstream J): the owner's work lists never hide open items, and the
// "Recently finished" list can reopen a finished task, but only when it is
// still finished. Synthetic data only.
//
// Bug fixed here: Tasks, Incidents and the Approval queue read the first 100
// rows of ALL statuses and only then dropped the closed ones. With enough
// finished rows sorted ahead of an open one, the open item never appeared
// (the page only showed a vague "may not be listed" note).

const { test, expect, login, openTasks, taskRow, gotoPage } = require('../helpers/dashboard');

const LONG_AGO = n => new Date(Date.UTC(2025, 0, 1) + n * 60000).toISOString();

function filtersOf(update) {
  return Object.fromEntries(update.params.filter(([k]) => k !== 'select'));
}

test.describe('open items are never pushed off the list by closed ones', () => {
  test('Tasks: 150 finished tasks due earlier do not hide the open task', async ({ page, backend }) => {
    for (let i = 0; i < 150; i++) {
      backend.tables.tasks.push({ id: 'task-old-' + i, title: 'SYNTHETIC old finished ' + i, priority: 'normal',
        status: i % 2 ? 'done' : 'cancelled', due_at: LONG_AGO(i), created_at: LONG_AGO(i) });
    }
    await login(page);
    await openTasks(page);
    await expect(taskRow(page, 'task-open-1')).toHaveCount(1);
    await expect(page.locator('#tasksTableWrap tbody tr')).toHaveCount(4);
    await expect(page.locator('#tasksTableWrap')).not.toContainText('may not be listed');
    const read = backend.requests.find(r => r.method === 'GET' && r.table === 'tasks' && r.params.some(([k, v]) => k === 'limit' && v === '100'));
    expect(read.params).toContainEqual(['status', expect.stringMatching(/^not\.in\.\(.*"done".*"cancelled".*\)$/)]);
  });

  test('Approvals: 120 newer decided requests do not hide an older pending one', async ({ page, backend }) => {
    backend.tables.approval_requests = [
      { id: 'appr-old-pending', action_type: 'SYNTHETIC_ACTION', summary: 'SYNTHETIC still waiting', status: 'pending', created_at: LONG_AGO(0) },
      ...Array.from({ length: 120 }, (_, i) => ({ id: 'appr-dec-' + i, action_type: 'SYNTHETIC_ACTION', summary: 'SYNTHETIC decided ' + i,
        status: i % 2 ? 'approved' : 'rejected', created_at: LONG_AGO(1000 + i) })),
    ];
    await login(page);
    await gotoPage(page, 'approvalsPanel');
    await expect(page.locator('#approvalsWrap .approvalRow[data-id="appr-old-pending"]')).toHaveCount(1);
    await expect(page.locator('#approvalsWrap .approvalRow')).toHaveCount(1);
  });

  test('Incidents: 120 resolved incidents do not hide an open one, or one with no status', async ({ page, backend }) => {
    backend.tables.incidents = [
      ...Array.from({ length: 120 }, (_, i) => ({ id: 'inc-res-' + i, incident_number: 'INC-R' + i, title: 'SYNTHETIC resolved ' + i,
        severity: 'low', status: i % 2 ? 'resolved' : 'closed', due_at: LONG_AGO(i) })),
      { id: 'inc-open', incident_number: 'INC-OPEN', title: 'SYNTHETIC open incident', severity: 'high', status: 'open', due_at: LONG_AGO(5000) },
      { id: 'inc-nostatus', incident_number: 'INC-NONE', title: 'SYNTHETIC incident without status', severity: 'low', status: null, due_at: LONG_AGO(5001) },
    ];
    await login(page);
    await gotoPage(page, 'incidentsPanel');
    await expect(page.locator('#incidentsTableWrap tbody tr')).toHaveCount(2);
    await expect(page.locator('#incidentsTableWrap tr[data-id="inc-open"]')).toHaveCount(1);
    await expect(page.locator('#incidentsTableWrap tr[data-id="inc-nostatus"]')).toHaveCount(1);
  });

  test('more than 100 open tasks: the note counts open tasks only', async ({ page, backend }) => {
    for (let i = 0; i < 130; i++) {
      backend.tables.tasks.push({ id: 'task-many-' + i, title: 'SYNTHETIC many ' + i, priority: 'normal', status: 'open', due_at: LONG_AGO(i), created_at: LONG_AGO(i) });
    }
    await login(page);
    await openTasks(page);
    // 130 + the 4 open fixture tasks; the 2 finished fixture tasks are not counted.
    await expect(page.locator('#tasksTableWrap')).toContainText('Showing the 100 soonest-due of 134 open tasks.');
  });
});

test.describe('Recently finished tasks and Reopen', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openTasks(page);
    await page.click('#recentDoneTasks summary');
  });

  const recentRow = (page, id) => page.locator(`#recentDoneWrap tr[data-id="${id}"]`);

  test('lists finished and cancelled tasks; only the finished one can be reopened', async ({ page }) => {
    await expect(recentRow(page, 'task-done-1')).toHaveCount(1);
    await expect(recentRow(page, 'task-cancelled-1')).toHaveCount(1);
    await expect(recentRow(page, 'task-done-1').getByRole('button', { name: 'Reopen' })).toHaveCount(1);
    await expect(recentRow(page, 'task-cancelled-1').getByRole('button')).toHaveCount(0);
    await expect(recentRow(page, 'task-done-1').locator('td').nth(2)).toHaveText('Unknown'); // fixture has no updated_at
  });

  test('Reopen asks first, then sends one update that only applies if the task is still done', async ({ page, backend }) => {
    const messages = [];
    page.on('dialog', d => { messages.push(d.message()); d.accept(); });
    await recentRow(page, 'task-done-1').getByRole('button', { name: 'Reopen' }).click();
    await expect.poll(() => backend.taskUpdates().length).toBe(1);
    expect(messages).toEqual(['Reopen this task? It goes back to the open list.\n\nSYNTHETIC finished task']);
    const [update] = backend.taskUpdates();
    expect(update.body).toEqual({ status: 'open' });
    expect(filtersOf(update)).toEqual({ id: 'eq.task-done-1', status: 'in.(done)' });
    await expect(taskRow(page, 'task-done-1')).toHaveCount(1);
    await expect(recentRow(page, 'task-done-1')).toHaveCount(0);
  });

  test('Cancel on the question sends nothing', async ({ page, backend }) => {
    let dialogs = 0;
    page.on('dialog', d => { dialogs++; d.dismiss(); });
    await recentRow(page, 'task-done-1').getByRole('button', { name: 'Reopen' }).click();
    await expect.poll(() => dialogs).toBe(1);
    await page.waitForLoadState('networkidle');
    expect(backend.taskUpdates()).toHaveLength(0);
    await expect(recentRow(page, 'task-done-1').getByRole('button', { name: 'Reopen' })).toBeEnabled();
  });

  test('stale tab: a task cancelled elsewhere meanwhile is not reopened', async ({ page, backend }) => {
    page.on('dialog', d => d.accept());
    backend.nextTaskUpdateHook = db => { db.tables.tasks.find(t => t.id === 'task-done-1').status = 'cancelled'; };
    await recentRow(page, 'task-done-1').getByRole('button', { name: 'Reopen' }).click();
    await expect.poll(() => backend.taskUpdates().length).toBe(1);
    expect(backend.tables.tasks.find(t => t.id === 'task-done-1').status).toBe('cancelled');
    await expect(page.locator('#dashError')).toContainText('already changed');
    await expect(recentRow(page, 'task-done-1').getByRole('button')).toHaveCount(0);
    await expect(taskRow(page, 'task-done-1')).toHaveCount(0);
  });

  test('double-click on Reopen sends one update', async ({ page, backend }) => {
    page.on('dialog', d => d.accept());
    await recentRow(page, 'task-done-1').getByRole('button', { name: 'Reopen' }).dblclick();
    await expect.poll(() => backend.taskUpdates().length).toBe(1);
    await page.waitForTimeout(300);
    expect(backend.taskUpdates()).toHaveLength(1);
  });

});

test('if the finished-tasks list cannot load, the open list still shows', async ({ page }) => {
  await page.context().route(/\/rest\/v1\/tasks\?.*status=in\./, route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'synthetic failure' }) }));
  await login(page);
  await openTasks(page);
  await page.click('#recentDoneTasks summary');
  await expect(page.locator('#recentDoneWrap')).toContainText('Could not load recently finished tasks');
  await expect(page.locator('#recentDoneWrap')).toContainText('synthetic failure');
  await expect(page.locator('#recentDoneWrap')).not.toContainText('[object');
  await expect(taskRow(page, 'task-open-1')).toHaveCount(1);
});

test.describe('Business Health: one failed read shows "?" on its own tile only', () => {
  test('tasks read fails: Overdue tasks is "?", the other figures still show', async ({ page }) => {
    await page.context().route(/\/rest\/v1\/tasks\?.*select=id%2Cstatus%2Cdue_at|\/rest\/v1\/tasks\?.*select=id,status,due_at/, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'synthetic failure' }) }));
    await login(page);
    const tiles = page.locator('#businessHealthStats');
    await expect(tiles.locator('.stat', { hasText: 'Overdue tasks' }).locator('.num')).toHaveText('?');
    await expect(tiles.locator('.stat', { hasText: 'Overdue tasks' })).toContainText('could not be read');
    await expect(tiles.locator('.stat', { hasText: 'Pending approvals' }).locator('.num')).not.toHaveText('?');
    await expect(tiles.locator('.stat', { hasText: "Today's orders" }).locator('.num')).toHaveText(/^\d+$/);
    await expect(tiles).not.toContainText('Could not load Business Health');
    await expect(page.locator('#dashError')).toContainText('Some Business Health figures could not be read');
    await expect(page.locator('#dashError')).toContainText('synthetic failure');
    await expect(page.locator('#dashError')).not.toContainText('[object');
  });

  test('the work tiles open their page', async ({ page }) => {
    await login(page);
    const tile = page.locator('#businessHealthStats button.statLink[data-goto="tasksPanel"]');
    await expect(tile).toHaveAccessibleName(/^Overdue tasks: \d+\. Open that page\.$/);
    await page.waitForLoadState('networkidle');
    await tile.click();
    await expect(page.locator('section#tasksPanel')).toHaveClass(/activePage/);
    await expect(page.locator('#businessHealthStats button.statLink')).toHaveCount(3);
  });
});
