// #26 operations watch — dashboard journey on Report History, behind the
// default-OFF he_ops_watch flag. Flags unusual daily figures, stock and orders
// for a person to look at; "Mark as seen" records that someone looked and does
// NOT clear the flag. Advisory: nothing is paused or changed. Flag OFF leaves
// Report History unchanged.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test('flag OFF (default): no operations watch on Report History', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  await expect(page.locator('#opsWatchHost')).toBeEmpty();
});

test('flag ON: flags are listed with a next step; "seen" does not clear a flag', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('he_ops_watch', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'reportHistoryPanel');
  const host = page.locator('#opsWatchHost');
  await expect(host.locator('.opsWatch')).toHaveCount(1);
  await expect(host).toContainText('SIMULATED');
  await expect(host).toContainText('nothing is changed');
  // It says where the figures came from, and that stock/orders are example data.
  await expect(host.locator('[data-opswatch-source]')).toContainText('Stock and orders: example data');
  // The example stock and order problems are always present.
  for (const kind of ['negative-stock', 'reserved-over-stock', 'order-total-not-positive', 'possible-duplicate-order', 'unusually-large-order']) {
    await expect(host.locator('tr[data-opswatch-kind="' + kind + '"]')).toHaveCount(1);
  }
  // Most serious first, each with a suggested next step.
  const first = host.locator('tbody tr').first();
  await expect(first).toHaveAttribute('data-opswatch-kind', 'negative-stock');
  await expect(first).toContainText('Urgent');
  await expect(first).toContainText('Count this item');
  // The thresholds are declared as not tuned.
  await expect(host).toContainText('not tuned on real history');
  // "Mark as seen" records who looked — and the flag is still there.
  const summary = host.locator('[data-opswatch-summary]');
  const before = await summary.textContent();
  await first.locator('[data-opswatch="ack"]').click();
  const seen = host.locator('tr[data-opswatch-kind="negative-stock"]');
  await expect(seen).toHaveAttribute('data-opswatch-state', 'ACKNOWLEDGED');
  await expect(seen).toContainText('Seen by owner (example) (still present)');
  await expect(summary).toContainText('1 seen');
  await expect(summary).toContainText('1 urgent');
  expect(await summary.textContent()).not.toBe(before);
  // Reset returns to the starting state.
  await host.locator('[data-opswatch="reset"]').click();
  await expect(host.locator('tr[data-opswatch-kind="negative-stock"]')).toHaveAttribute('data-opswatch-state', 'OPEN');
  expect(errors.join('\n')).not.toMatch(/Trusted Type|require-trusted-types|Refused to/i);
});
