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
  // The rule (owner decision of Nov 16) is stated, and the boundary is visible:
  // a staff attempt AND an ordinary administrator's attempt are both refused.
  await expect(host).toContainText('Staff and administrators may propose an adjustment with a reason. Only the owner approves it.');
  const boundary = host.locator('[data-cyclecount-boundary]');
  await expect(boundary).toContainText('Staff approval attempt: only the owner may approve a stock adjustment');
  await expect(boundary).toContainText('Administrator approval attempt: only the owner may approve a stock adjustment (an administrator may propose one)');
  // The proposal carries who proposed it and the reason.
  await expect(host.locator('[data-cyclecount-status]')).toHaveAttribute('data-cyclecount-status', 'PENDING_APPROVAL');
  await expect(host.locator('[data-cyclecount-status]')).toContainText('proposed by staff · reason: Monthly shelf count');
  // Before approval, no approved record is shown.
  await expect(host.locator('[data-cyclecount-record]')).toHaveCount(0);
  // Approve as owner -> the full record (never written to stock) + R4 + audit trail.
  await host.locator('[data-cyclecount="approve"]').click();
  await expect(host).toContainText('NOT written to stock');
  const rec = host.locator('[data-cyclecount-record="HE-HONEY-8OZ"]');
  await expect(rec).toContainText('original count 40 → requested count 38 (-2)');
  await expect(rec).toContainText('Reason: Monthly shelf count');
  await expect(rec).toContainText('Proposed by staff, 2026-11-14 09:15 UTC · approved by owner, 2026-11-14 10:00 UTC · not written to stock');
  await expect(host.locator('[data-cyclecount-record]')).toHaveCount(2);
  await expect(host).toContainText('adjust_inventory (R4)');
  await expect(host).toContainText('Audit: STARTED → COUNTED');
  // Reset returns to the pre-approval view.
  await host.locator('[data-cyclecount="reset"]').click();
  await expect(host.locator('[data-cyclecount-record]')).toHaveCount(0);
  expect(errors.join('\n')).not.toMatch(/Trusted Type|Refused to|cyclecount/i);
});

test('flag ON, signed in as an administrator: the approval is refused and says why', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  await enable(page);
  await login(page);
  backend.tables.profiles[0].role = 'administrator';
  await page.reload(); // the page reads the signed-in person's role when it loads
  await expect(page.locator('#dash')).toBeVisible();
  await expect(page.locator('#whoAmI')).toContainText('role: administrator');
  await gotoPage(page, 'inventoryPanel');
  const host = page.locator('#cycleCountHost');
  await expect(host.locator('.cycleCount')).toHaveCount(1);
  await host.locator('[data-cyclecount="approve"]').click();
  await expect(host.locator('[data-cyclecount-refused]')).toContainText('only the owner may approve a stock adjustment');
  await expect(host.locator('[data-cyclecount-record]')).toHaveCount(0);
});
