// Tasks page: the "Mark done" / "Mark in progress" buttons (task buttons v2).
const { test, expect, login, openTasks, taskRow } = require('../helpers/dashboard');

function buttonLabels(row) {
  return row.locator('.taskStatusBtn').allInnerTexts();
}

// Waits until the page has sent `n` task updates and the list has redrawn.
async function waitForTaskUpdates(page, backend, n) {
  await expect.poll(() => backend.taskUpdates().length).toBe(n);
  await page.waitForLoadState('networkidle');
}

function filtersOf(update) {
  return Object.fromEntries(update.params.filter(([k]) => k !== 'select'));
}

test.describe('task list', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openTasks(page);
  });

  test('open task shows "Mark done" then "Mark in progress"', async ({ page }) => {
    expect(await buttonLabels(taskRow(page, 'task-open-1'))).toEqual(['Mark done', 'Mark in progress']);
  });

  test('in-progress task shows only "Mark done"', async ({ page }) => {
    expect(await buttonLabels(taskRow(page, 'task-progress-1'))).toEqual(['Mark done']);
  });

  test('done and cancelled tasks are not in the active list', async ({ page }) => {
    await expect(taskRow(page, 'task-done-1')).toHaveCount(0);
    await expect(taskRow(page, 'task-cancelled-1')).toHaveCount(0);
    await expect(page.locator('#tasksTableWrap tbody tr')).toHaveCount(4);
  });

  test('overdue open task is highlighted', async ({ page }) => {
    await expect(taskRow(page, 'task-overdue-1')).toHaveClass(/overdue/);
    await expect(taskRow(page, 'task-open-1')).not.toHaveClass(/overdue/);
  });
});

test.describe('status changes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openTasks(page);
  });

  test('open → in_progress: one update, no confirmation, list refreshes', async ({ page, backend }) => {
    let dialogs = 0;
    page.on('dialog', d => { dialogs++; d.dismiss(); });
    await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark in progress' }).click();
    await waitForTaskUpdates(page, backend, 1);

    const [update] = backend.taskUpdates();
    expect(update.body).toEqual({ status: 'in_progress' });
    expect(filtersOf(update)).toEqual({ id: 'eq.task-open-1', status: 'in.(open)' });
    expect(dialogs).toBe(0);

    const row = taskRow(page, 'task-open-1');
    await expect(row.locator('td').nth(2)).toHaveText('In progress');
    expect(await buttonLabels(row)).toEqual(['Mark done']);
    expect(backend.tables.tasks.find(t => t.id === 'task-open-1').status).toBe('in_progress');
  });

  test('open → done: confirmation, then exactly one update', async ({ page, backend }) => {
    const messages = [];
    page.on('dialog', d => { messages.push(d.message()); d.accept(); });
    await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark done' }).click();
    await waitForTaskUpdates(page, backend, 1);

    expect(messages).toEqual(['Mark this task done?\n\nSYNTHETIC open task one']);
    const [update] = backend.taskUpdates();
    expect(update.body).toEqual({ status: 'done' });
    expect(filtersOf(update)).toEqual({ id: 'eq.task-open-1', status: 'in.(open,in_progress)' });
    await expect(taskRow(page, 'task-open-1')).toHaveCount(0);
  });

  test('in_progress → done: confirmation, then exactly one update', async ({ page, backend }) => {
    const messages = [];
    page.on('dialog', d => { messages.push(d.message()); d.accept(); });
    await taskRow(page, 'task-progress-1').getByRole('button', { name: 'Mark done' }).click();
    await waitForTaskUpdates(page, backend, 1);

    expect(messages).toEqual(['Mark this task done?\n\nSYNTHETIC in-progress task']);
    const [update] = backend.taskUpdates();
    expect(update.body).toEqual({ status: 'done' });
    expect(filtersOf(update)).toEqual({ id: 'eq.task-progress-1', status: 'in.(open,in_progress)' });
    await expect(taskRow(page, 'task-progress-1')).toHaveCount(0);
  });

  test('Cancel on the confirmation sends no update', async ({ page, backend }) => {
    let dialogs = 0;
    page.on('dialog', d => { dialogs++; d.dismiss(); });
    await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark done' }).click();
    await expect.poll(() => dialogs).toBe(1);
    await page.waitForLoadState('networkidle');

    expect(backend.taskUpdates()).toHaveLength(0);
    const row = taskRow(page, 'task-open-1');
    await expect(row.locator('td').nth(2)).toHaveText('Open');
    // Buttons stay usable after cancelling.
    await expect(row.locator('.taskStatusBtn').first()).toBeEnabled();
    expect(await buttonLabels(row)).toEqual(['Mark done', 'Mark in progress']);
  });

  test('double-click on "Mark in progress" sends only one update', async ({ page, backend }) => {
    await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark in progress' }).dblclick();
    await waitForTaskUpdates(page, backend, 1);
    await page.waitForTimeout(300);
    expect(backend.taskUpdates()).toHaveLength(1);
  });

  test('double-click on "Mark done" sends only one update', async ({ page, backend }) => {
    page.on('dialog', d => d.accept());
    await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark done' }).dblclick();
    await waitForTaskUpdates(page, backend, 1);
    await page.waitForTimeout(300);
    expect(backend.taskUpdates()).toHaveLength(1);
  });

  test('clicks while an update is still in flight are ignored', async ({ page, backend }) => {
    backend.delayMs.tasks = 600; // slow network
    await page.evaluate(() => {
      const btn = document.querySelector('#tasksTableWrap tr[data-id="task-open-1"] .taskStatusBtn[data-to="in_progress"]');
      btn.click(); btn.click(); btn.click();
    });
    await expect.poll(() => backend.taskUpdates().length).toBe(1);
    // Both buttons on that row are disabled until the list refreshes.
    await expect(taskRow(page, 'task-open-1').locator('.taskStatusBtn').first()).toBeDisabled();
    await page.waitForTimeout(1500);
    expect(backend.taskUpdates()).toHaveLength(1);
  });

  test('stale state: task already finished elsewhere is not changed again', async ({ page, backend }) => {
    page.on('dialog', d => d.accept());
    // Someone else (or an agent) marks the task done just before our click lands.
    backend.nextTaskUpdateHook = db => { db.tables.tasks.find(t => t.id === 'task-open-1').status = 'done'; };
    await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark in progress' }).click();
    await waitForTaskUpdates(page, backend, 1);

    // The database-side condition (status still "open") stopped the change.
    expect(backend.tables.tasks.find(t => t.id === 'task-open-1').status).toBe('done');
    await expect(page.locator('#dashError')).toContainText('already changed');
    await expect(taskRow(page, 'task-open-1')).toHaveCount(0);
  });

  test('stale state: task already in progress elsewhere shows its real state', async ({ page, backend }) => {
    backend.nextTaskUpdateHook = db => { db.tables.tasks.find(t => t.id === 'task-open-2').status = 'in_progress'; };
    await taskRow(page, 'task-open-2').getByRole('button', { name: 'Mark in progress' }).click();
    await waitForTaskUpdates(page, backend, 1);

    await expect(page.locator('#dashError')).toContainText('already changed');
    const row = taskRow(page, 'task-open-2');
    await expect(row.locator('td').nth(2)).toHaveText('In progress');
    expect(await buttonLabels(row)).toEqual(['Mark done']);
  });

  test('a failed update shows an error and leaves the task as it was', async ({ page, backend }) => {
    await page.context().route(/\/rest\/v1\/tasks\?/, route => {
      if (route.request().method() === 'PATCH') {
        backend.requests.push({ method: 'PATCH', table: 'tasks', params: [], body: null, path: '/rest/v1/tasks', headers: {} });
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'synthetic server error' }) });
      }
      return route.fallback();
    });
    await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark in progress' }).click();
    await expect(page.locator('#dashError')).toContainText('Could not update that task');
    const row = taskRow(page, 'task-open-1');
    await expect(row.locator('td').nth(2)).toHaveText('Open');
    await expect(row.locator('.taskStatusBtn').first()).toBeEnabled();
  });

  test('status update sends only the "status" field, and only to the tasks table', async ({ page, backend }) => {
    page.on('dialog', d => d.accept());
    await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark in progress' }).click();
    await waitForTaskUpdates(page, backend, 1);
    await taskRow(page, 'task-progress-1').getByRole('button', { name: 'Mark done' }).click();
    await waitForTaskUpdates(page, backend, 2);

    for (const update of backend.taskUpdates()) {
      expect(Object.keys(update.body)).toEqual(['status']);
    }
    expect(backend.tableWrites().map(w => `${w.method} ${w.table}`)).toEqual(['PATCH tasks', 'PATCH tasks']);
  });

  test('"Mark done" does not move under the cursor after "Mark in progress"', async ({ page, backend }) => {
    const row = taskRow(page, 'task-open-1');
    const doneBefore = await row.getByRole('button', { name: 'Mark done' }).boundingBox();
    const progressBox = await row.getByRole('button', { name: 'Mark in progress' }).boundingBox();
    const cx = progressBox.x + progressBox.width / 2;
    const cy = progressBox.y + progressBox.height / 2;

    await page.mouse.click(cx, cy);
    await waitForTaskUpdates(page, backend, 1);
    await expect(row.locator('td').nth(2)).toHaveText('In progress');

    const doneAfter = await row.getByRole('button', { name: 'Mark done' }).boundingBox();
    // A couple of pixels of settling is fine (the row gets shorter); a jump
    // would be at least a button's height (25px or more).
    expect(Math.abs(doneAfter.x - doneBefore.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(doneAfter.y - doneBefore.y)).toBeLessThanOrEqual(4);
    // Nothing clickable slid into the spot that was just clicked.
    const underCursor = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      const btn = el && el.closest('button');
      return btn ? `${btn.textContent.trim()} (${btn.closest('tr') ? btn.closest('tr').getAttribute('data-id') : '?'})` : null;
    }, [cx, cy]);
    expect(underCursor).toBeNull();
  });

  test('status change survives a page reload', async ({ page, backend }) => {
    await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark in progress' }).click();
    await waitForTaskUpdates(page, backend, 1);
    await page.reload();
    await expect(page.locator('#dash')).toBeVisible();
    await expect(page.locator('section#tasksPanel')).toHaveClass(/activePage/);
    await expect(taskRow(page, 'task-open-1').locator('td').nth(2)).toHaveText('In progress');
  });
});
