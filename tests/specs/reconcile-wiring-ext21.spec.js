// #08 payment reconciliation review — dashboard journey on Accounting, behind
// the default-OFF he_reconcile flag. Every difference is named and stays open
// until closed with a written note; closing never changes a figure. Advisory:
// no money is moved. Flag OFF leaves Accounting unchanged.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('flag OFF (default): no reconciliation section on Accounting', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#reconcileHost')).toBeEmpty();
});

test('flag ON: differences are named; a note is required; closing changes no figure', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_reconcile', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'accountingPanel');
  const host = page.locator('#reconcileHost');
  await expect(host.locator('.reconcileReview')).toHaveCount(1);
  await expect(host).toContainText('SIMULATED');
  await expect(host).toContainText('no money is moved');
  // One line per outcome in the worked example.
  for (const o of ['MATCHED', 'UNDERPAID', 'OVERPAID', 'MISSING', 'UNEXPECTED', 'DUPLICATE']) {
    await expect(host.locator('tr[data-outcome="' + o + '"]')).toHaveCount(1);
  }
  const status = host.locator('[data-reconcile-state]');
  await expect(status).toHaveAttribute('data-reconcile-state', 'NEEDS_REVIEW');
  await expect(status).toContainText('5 open');
  await expect(status).toContainText('expected $603.93');
  await expect(status).toContainText('recorded $552.53');
  // A matched line offers nothing to review.
  await expect(host.locator('tr[data-outcome="MATCHED"] button')).toHaveCount(0);
  // Closing without a note is refused, and says why.
  const shortRow = host.locator('tr[data-outcome="UNDERPAID"]');
  await shortRow.locator('[data-reconcile="review"]').click();
  await expect(host.locator('[data-reconcile-msg]')).toContainText('a written note is required');
  await expect(host.locator('tr[data-outcome="UNDERPAID"]')).toHaveAttribute('data-review', 'OPEN');
  // With a note it is recorded — by name, with the note — and the money is unchanged.
  await host.locator('#reconcileNote').fill('Customer confirmed the balance arrives Friday.');
  await host.locator('tr[data-outcome="UNDERPAID"] [data-reconcile="review"]').click();
  const reviewed = host.locator('tr[data-outcome="UNDERPAID"]');
  await expect(reviewed).toHaveAttribute('data-review', 'REVIEWED');
  await expect(reviewed).toContainText('Reviewed by owner (example)');
  await expect(reviewed).toContainText('Customer confirmed the balance arrives Friday.');
  await expect(reviewed).toContainText('$150.00');
  await expect(status).toContainText('4 open');
  await expect(status).toContainText('recorded $552.53');
  await expect(host.locator('[data-reconcile-msg]')).toContainText('The figures are unchanged');
  // The note field is labelled for assistive technology.
  await expect(host.getByLabel(/Review note/)).toHaveCount(1);
  // Reset returns to the starting example.
  await host.locator('[data-reconcile="reset"]').click();
  await expect(status).toContainText('5 open');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
