// Tasks page on an iPhone-sized screen (390px).
const { test, expect, login, openTasks, taskRow } = require('../helpers/dashboard');

test.skip(({ viewport }) => viewport.width > 500, 'phone only');

test.beforeEach(async ({ page }) => {
  await login(page);
  await openTasks(page);
});

test('task buttons are fully visible without sideways scrolling', async ({ page }) => {
  const buttons = page.locator('#tasksTableWrap .taskStatusBtn');
  const count = await buttons.count();
  expect(count).toBe(7); // 3 open tasks × 2 buttons + 1 in-progress task × 1
  const viewportWidth = page.viewportSize().width;
  for (let i = 0; i < count; i++) {
    const box = await buttons.nth(i).boundingBox();
    expect(box.x, `button ${i} starts off-screen`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `button ${i} runs off the right edge`).toBeLessThanOrEqual(viewportWidth);
  }
  // The page itself doesn't scroll sideways.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('task buttons are big enough to tap', async ({ page }) => {
  const buttons = page.locator('#tasksTableWrap .taskStatusBtn');
  for (let i = 0; i < await buttons.count(); i++) {
    const box = await buttons.nth(i).boundingBox();
    expect(box.height, `button ${i} is too short to tap reliably`).toBeGreaterThanOrEqual(28);
  }
});

test('tapping "Mark in progress" works on a phone', async ({ page, backend }) => {
  await taskRow(page, 'task-open-1').getByRole('button', { name: 'Mark in progress' }).tap();
  await expect.poll(() => backend.taskUpdates().length).toBe(1);
  await expect(taskRow(page, 'task-open-1').locator('td').nth(2)).toHaveText('In progress');
});
