// EXT11 (X11-01): an order saved without a total used to add $0.00 to
// revenue silently on Home, Daily Summary, Accounting and Tax Records
// (Number(null) is 0), so the figures looked complete when they were not.
// Each page now says how many orders it left out. Synthetic data only.
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'arithmetic; run once'); });

const order = (id, total, placedAt, status = 'paid') => ({ id, order_number: id.toUpperCase(), total, tax_total: '0.00', currency: 'USD', status,
  placed_at: placedAt, deleted_at: null, source: 'manual', raw_data: null, customer_name: 'SYNTHETIC', created_at: placedAt });

// The page has one banner shared by every page; record each message it shows.
async function recordBanner(page) {
  await page.addInitScript(() => {
    window.__bannerTexts = [];
    new MutationObserver(() => {
      const el = document.getElementById('dashError');
      if (el && el.textContent) window.__bannerTexts.push(el.textContent);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}
const bannerHas = (page, text) => page.evaluate(t => window.__bannerTexts.some(x => x.includes(t)), text);

test('Home: today\'s revenue says an order without a total is not counted', async ({ page, backend }) => {
  const now = new Date().toISOString();
  backend.tables.orders = [order('t-ok', '25.00', now), order('t-empty', null, now), order('t-cancel-empty', null, now, 'Cancelled')];
  await login(page);
  const tile = page.locator('#attentionPanel .stat', { hasText: "Today's revenue" });
  await expect(tile).toContainText('1 order without a total not counted');
  await expect(tile).toHaveClass(/statWarn/);
  await expect(tile.locator('.num')).toHaveText('$25.00', { timeout: 15000 });
});

test('Home: no warning when every order has a total', async ({ page, backend }) => {
  const now = new Date().toISOString();
  backend.tables.orders = [order('t-ok', '25.00', now), order('t-ok2', '0.00', now)];
  await login(page);
  const tile = page.locator('#attentionPanel .stat', { hasText: "Today's revenue" });
  await expect(tile).toBeVisible();
  await expect(tile).not.toContainText('without a total');
});

test('Daily Summary: yesterday\'s orders without a total are named in a warning', async ({ page, backend }) => {
  await recordBanner(page);
  await page.clock.setFixedTime(new Date('2026-06-15T17:00:00Z'));
  const y = '2026-06-14T17:00:00Z';
  backend.tables.orders = [order('d-ok', '10.00', y), order('d-empty', '', y), order('d-empty2', null, y)];
  await login(page);
  await gotoPage(page, 'dailySummaryPanel');
  await expect.poll(() => bannerHas(page, 'Daily Summary: 2 orders have no total saved')).toBe(true);
});

for (const [panel, button, where] of [['accountingPanel', '#accountingPanel button[data-range="all"]', 'Accounting'], ['taxRecordsPanel', null, 'Tax Records']]) {
  test(`${where}: an order without a total is reported, a cancelled one is not`, async ({ page, backend }) => {
    await recordBanner(page);
    const now = new Date().toISOString();
    backend.tables.orders = [order('a-ok', '10.00', now), order('a-empty', null, now), order('a-cancel-empty', null, now, 'Cancelled')];
    backend.tables.expenses = [];
    await login(page);
    await page.waitForLoadState('networkidle');
    await gotoPage(page, panel);
    if (button) await page.click(button);
    await expect.poll(() => bannerHas(page, where + ': 1 order has no total saved')).toBe(true);
  });
}

test('Tax export: the file says how many orders without a total are not in revenue', async ({ page, backend }) => {
  const now = new Date().toISOString();
  backend.tables.orders = [order('x-ok', '10.00', now), order('x-empty', null, now)];
  backend.tables.expenses = [];
  await login(page);
  await gotoPage(page, 'taxRecordsPanel');
  await expect(page.locator('#taxStats')).toHaveAttribute('data-range', /.+/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  const [file] = await Promise.all([page.waitForEvent('download'), page.click('#taxExportBtn')]);
  const csv = require('fs').readFileSync(await file.path(), 'utf8');
  const plain = csv.replace(/"/g, '');
  expect(plain).toContain('Orders with no total saved (NOT included in revenue),1');
  expect(plain).toContain('Revenue,$10.00');
});
