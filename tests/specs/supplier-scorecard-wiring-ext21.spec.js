// #12/#53 supplier scorecard — dashboard journey on Suppliers, behind the
// default-OFF he_supplier_scorecard flag. Read-only worked example: delivery
// accuracy (unknown timing is never counted as on time) and required-document
// status. Flag OFF leaves Suppliers unchanged.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('flag OFF (default): no scorecard on Suppliers', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'suppliersPanel');
  await expect(page.locator('#supplierScorecardHost')).toBeEmpty();
});

test('flag ON: delivery accuracy, unknown timing kept separate, document flags', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_supplier_scorecard', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'suppliersPanel');
  const host = page.locator('#supplierScorecardHost');
  await expect(host.locator('.supplierScorecard')).toHaveCount(1);
  await expect(host).toContainText('SIMULATED');
  await expect(host).toContainText('SYN Glass & Jars Co');
  // 4 orders for this supplier (the other supplier's order is excluded): 3 received,
  // 1 on time, 1 late, 1 with no received date -> unknown, 1 still open.
  const delivery = host.locator('[data-scorecard="delivery"]');
  await expect(delivery).toContainText('3 received of 4 orders');
  await expect(delivery).toContainText('on time 1');
  await expect(delivery).toContainText('late 1');
  await expect(delivery).toContainText('timing unknown 1');
  await expect(delivery).toContainText('still open 1');
  // The rate is over the 2 deliveries with both dates, not all 3.
  await expect(host).toContainText('On-time rate: 50% of the 2 deliveries with both dates');
  await expect(host).toContainText('average 5 days late when late');
  // Documents: insurance valid, W-9 expiring soon, certificate of analysis missing.
  await expect(host.locator('tr[data-docstatus="VALID"]')).toContainText('insurance');
  await expect(host.locator('tr[data-docstatus="EXPIRING_SOON"]')).toContainText('w9');
  await expect(host.locator('tr[data-docstatus="EXPIRING_SOON"]')).toContainText('6');
  await expect(host.locator('tr[data-docstatus="MISSING"]')).toContainText('coa');
  await expect(host.locator('[data-scorecard="attention"]')).toContainText('Needs attention');
  await expect(host.locator('[data-scorecard="attention"]')).toContainText('document coa: MISSING');
  // Read-only: no buttons or inputs in the scorecard.
  await expect(host.locator('button, input, select, textarea')).toHaveCount(0);
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
