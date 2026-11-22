// The partial receiving and returns example on the Inventory page (owner request
// of Nov 21, D-ops-5): OFF by default; with its switch on it shows the worked
// example step by step, its history and movements, and the rules for review.
// Example data only; the test checks that no request writes anything.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls } = require('../helpers/a11y-audit');

async function on(page) { await page.addInitScript(() => { try { localStorage.setItem('he_partial_receiving', 'on'); } catch (e) {} }); }
function watchWrites(page) {
  const writes = [];
  // A write is a table insert/update/delete, or a call to a stock function
  // (the dashboard's own background reads are POSTs to read-only functions).
  page.on('request', r => {
    const u = r.url(), m = r.method();
    if (!/supabase\.co\/rest\/v1\//.test(u)) return;
    const rpc = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(u);
    if (rpc ? /receive|adjust|return|stock|quarantine|inventory/.test(rpc[1]) : ['POST', 'PATCH', 'PUT', 'DELETE'].includes(m)) writes.push(m + ' ' + u);
  });
  return writes;
}

test('switch OFF (the default): the Inventory page is unchanged', async ({ page }) => {
  await login(page); await gotoPage(page, 'inventoryPanel');
  await expect(page.locator('#partialReceivingHost')).toBeEmpty();
});

test('switch ON: the owner\'s example step by step — remaining quantity and stock movement at each step', async ({ page }) => {
  const writes = watchWrites(page);
  await on(page); await login(page); await gotoPage(page, 'inventoryPanel');
  const host = page.locator('#partialReceivingHost');
  await expect(host).toContainText('SIMULATED — example data, no stock is written');
  const step = n => host.locator('tr[data-partialrcv-step="' + n + '"]');
  await expect(host.locator('[data-partialrcv-steps]')).toHaveAttribute('data-partialrcv-steps', '11');
  await expect(step(1)).toContainText('8 of 20');
  await expect(step(1)).toContainText('Available +8 (5 → 13)');
  await expect(step(2)).toContainText('Already recorded: nothing changed');
  await expect(step(3)).toContainText('Refused: would receive 13 units');
  await expect(step(4)).toContainText('20 of 20');
  await expect(step(5)).toContainText('Available -3 (25 → 22)');
  await expect(step(8)).toContainText('Available +2 (22 → 24); Damaged +1 (0 → 1)');
  await expect(step(10)).toContainText('Refused: would take back 3 units');
  // history and movements
  await host.locator('[data-partialrcv="history"]').click();
  await expect(host.locator('[data-partialrcv-history]')).toHaveAttribute('data-partialrcv-history', '4');
  await expect(host.locator('[data-partialrcv-reconcile]')).toHaveAttribute('data-partialrcv-reconcile', 'ok');
  await expect(host.locator('[data-partialrcv="history"]')).toBeFocused();
  // the rules for review
  await host.locator('[data-partialrcv="rules"]').click();
  await expect(host.locator('[data-partialrcv-rules] li')).toHaveCount(9);
  await expect(host.locator('[data-partialrcv="rules"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await host.evaluate(unnamedControls)).toEqual([]);
  expect(writes).toEqual([]);
});

test('at phone size the step table does not push the page sideways', async ({ page }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  await on(page); await login(page); await gotoPage(page, 'inventoryPanel');
  await expect(page.locator('#partialReceivingHost tr[data-partialrcv-step="10"]')).toHaveCount(1);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});
