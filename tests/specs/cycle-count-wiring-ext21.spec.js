// #54/#55 cycle count + adjustment approval — dashboard journey on Inventory,
// behind the default-OFF he_cycle_count flag. Shows discrepancies, the owner-
// only approval boundary, the advisory (never-written) adjustment and the audit
// trail. Flag OFF leaves Inventory unchanged.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

async function enable(page) {
  await page.addInitScript(() => { try { localStorage.setItem('he_cycle_count', 'on'); } catch (e) {} });
}

test('flag OFF (default): no cycle-count section on Inventory', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  await expect(page.locator('#cycleCountHost .cycleCount')).toHaveCount(0);
});

test('flag ON: discrepancies, owner-only approval, advisory adjustment and audit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await enable(page);
  await login(page);
  await gotoPage(page, 'inventoryPanel');
  const host = page.locator('#cycleCountHost');
  await expect(host.locator('.cycleCount')).toHaveCount(1);
  // Discrepancies are shown with direction.
  await expect(host).toContainText('HE-HONEY-8OZ');
  await expect(host).toContainText('SHORT');
  await expect(host).toContainText('OVER');
  // The permission boundary is visible: a staff approval attempt is refused.
  await expect(host).toContainText('only the owner may approve');
  // Before approval, no written adjustment is shown.
  await expect(host).not.toContainText('applied=false');
  // Approve as owner -> advisory adjustment (never written) + R4 + audit trail.
  await host.locator('[data-cyclecount="approve"]').click();
  await expect(host).toContainText('NOT written to stock');
  await expect(host).toContainText('applied=false');
  await expect(host).toContainText('adjust_inventory (R4)');
  await expect(host).toContainText('Audit: STARTED → COUNTED');
  // Reset returns to the pre-approval view.
  await host.locator('[data-cyclecount="reset"]').click();
  await expect(host).not.toContainText('applied=false');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|Refused to|cyclecount/i);
});
