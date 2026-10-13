// AI Agent Activity page: the agent registry's status text.
// Agents #2, #3, #7 and #8 must show their last recorded state (switched off
// on Sept 26, 2026 until the store has products) as a recorded state, not as
// a verified live fact, and must no longer claim they are waiting for GitHub
// minutes to reset on October 1. Page-text only; no agent setting is touched.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('switched-off agents show their last recorded state, not the old "waiting on minutes" text', async ({ page, backend }) => {
  await login(page);
  await gotoPage(page, 'aiPanel');
  const wrap = page.locator('#agentRegistryWrap');
  await expect(wrap).toContainText('#10');
  await expect(wrap).not.toContainText('waiting on GitHub Actions minutes');
  for (const n of [2, 3, 7, 8]) {
    const card = wrap.locator('.deletedRow', { hasText: `#${n} —` });
    await expect(card).toContainText('Last recorded state (September 26, 2026): switched off');
    await expect(card).toContainText('check GitHub → Actions before relying on this');
  }
  // Agents that run inside Supabase keep their own wording.
  await expect(wrap.locator('.deletedRow', { hasText: '#4 —' })).toContainText('Migrated to Supabase pg_cron');
  // Viewing the page must not change any agent switch.
  expect(backend.tableWrites()).toEqual([]);
});
