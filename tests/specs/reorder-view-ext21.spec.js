// Inventory reorder planning view — browser journey (Phase 2 item 4). Behind the
// default-OFF he_reorder_planning flag; read-only, synthetic fixtures, no writes.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

async function enablePlanning(page) {
  await page.addInitScript(() => { try { localStorage.setItem('he_reorder_planning', 'on'); } catch (e) {} });
}

test('flag OFF (default): no reorder planning section on Inventory', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  await expect(page.locator('#reorderPlanningHost .reorderPlan')).toHaveCount(0);
});

test('flag ON: planning table shows reasons, zero-vs-unknown, filter and a deduplicated draft', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await enablePlanning(page);
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  const plan = page.locator('#reorderPlanningHost .reorderPlan');
  await expect(plan).toBeVisible();
  // A velocity-driven reorder is suggested with a reason.
  await expect(plan).toContainText('Reorder');
  await expect(plan).toContainText('below lead+safety');
  // Unknown on-hand is surfaced as "Needs data", never guessed.
  await expect(plan).toContainText('Needs data');
  // Filter to components hides a finished SKU.
  await plan.locator('[data-reorder="filter"][data-kind="component"]').click();
  await expect(page.locator('#reorderPlanningHost')).not.toContainText('HE-HONEY-8OZ');
  await expect(page.locator('#reorderPlanningHost')).toContainText('BOTTLE-8OZ');
  // Back to all; preview the deduplicated draft.
  await plan.locator('[data-reorder="filter"][data-kind="all"]').click();
  await page.locator('[data-reorder="draft"]').click();
  await expect(page.locator('#reorderPlanningHost')).toContainText('Draft reorder (simulated — not placed)');
  await expect(page.locator('#reorderPlanningHost')).toContainText('Cash needed');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});

test('on a phone, the planning view is reachable and readable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'phone only');
  await enablePlanning(page);
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  await expect(page.locator('#reorderPlanningHost .reorderPlan')).toBeVisible();
});
