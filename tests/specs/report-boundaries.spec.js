// Read-only accounting calculations at date and cent boundaries (2026-10-06,
// EXT3 workstream 13). Business time is Central (America/Chicago). Timestamps
// below are written in UTC so the test data is unambiguous:
//   May 31 23:30 CDT  = 2026-06-01T04:30:00Z   (May)
//   Jun  1 00:30 CDT  = 2026-06-01T05:30:00Z   (June)
//   Dec 31 23:30 CST  = 2026-01-01T05:30:00Z   (2025)
//   Jan  1 00:30 CST  = 2026-01-01T06:30:00Z   (2026)
// No accounting rule is invented here: refunds follow the current policy
// ('status_only', refund-policy.spec.js); this only checks which day/month/
// year an order falls in, and that cents add up exactly.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'report logic; run once'); });

const NOW = new Date('2026-06-15T15:00:00Z'); // 10:00 Central
const order = (id, placed_at, total, extra = {}) => ({ id, order_number: id, customer_name: 'SYNTHETIC', customer_email: null, status: 'paid', currency: 'USD', total, tax_total: 0, placed_at, deleted_at: null, source: 'manual', raw_data: null, channel: 'manual', ...extra });

async function openWith(page, backend, orders, panel) {
  Object.assign(backend.tables, { orders, expenses: [], returns: [], order_items: [] });
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, panel);
  await page.waitForLoadState('networkidle');
}
const revenue = (page, wrap) => page.locator(`#${wrap} .stat`).first().locator('.num');

test('Accounting "This Month": an order at 23:30 on May 31 (Central) is May, 00:30 on June 1 is June', async ({ page, backend }) => {
  await openWith(page, backend, [
    order('SYN-MAY31', '2026-06-01T04:30:00Z', 7),
    order('SYN-JUN01', '2026-06-01T05:30:00Z', 11),
  ], 'accountingPanel');
  await page.click('#acctToggle button[data-range="month"]');
  await expect(revenue(page, 'acctStats')).toHaveText('$11.00');
  await page.click('#acctToggle button[data-range="all"]');
  await expect(revenue(page, 'acctStats')).toHaveText('$18.00');
});

test('Tax Records "This Year" / "Last Year": 23:30 on Dec 31 (Central) is last year, 00:30 on Jan 1 is this year', async ({ page, backend }) => {
  await openWith(page, backend, [
    order('SYN-DEC31', '2026-01-01T05:30:00Z', 5),
    order('SYN-JAN01', '2026-01-01T06:30:00Z', 9),
  ], 'taxRecordsPanel');
  await page.click('#taxToggle button[data-range="year"]');
  await expect(revenue(page, 'taxStats')).toHaveText('$9.00');
  await page.click('#taxToggle button[data-range="lastyear"]');
  await expect(revenue(page, 'taxStats')).toHaveText('$5.00');
});

test('cents add up exactly: 100 × $0.10 + 100 × $0.20 + 100 × $0.05 = $35.00 (no floating-point drift)', async ({ page, backend }) => {
  const orders = [];
  for (let i = 0; i < 100; i++) {
    orders.push(order('SYN-A' + i, '2026-06-02T15:00:00Z', 0.1), order('SYN-B' + i, '2026-06-02T15:00:00Z', 0.2), order('SYN-C' + i, '2026-06-02T15:00:00Z', 0.05));
  }
  await openWith(page, backend, orders, 'accountingPanel');
  await page.click('#acctToggle button[data-range="all"]');
  await expect(revenue(page, 'acctStats')).toHaveText('$35.00');
});

test('a deleted order and a cancelled order never count as revenue, at any range', async ({ page, backend }) => {
  await openWith(page, backend, [
    order('SYN-OK', '2026-06-10T15:00:00Z', 20),
    order('SYN-DEL', '2026-06-10T15:00:00Z', 500, { deleted_at: '2026-06-11T00:00:00Z' }),
    order('SYN-CAN', '2026-06-10T15:00:00Z', 70, { status: 'cancelled' }),
  ], 'accountingPanel');
  for (const r of ['today', 'week', 'month', 'all']) {
    await page.click(`#acctToggle button[data-range="${r}"]`);
    await expect(revenue(page, 'acctStats'), r).toHaveText(r === 'today' ? '$0.00' : '$20.00');
  }
});

test('a purchase order whose cost was logged twice is listed for review; totals are not changed (RP-06)', async ({ page, backend }) => {
  Object.assign(backend.tables, {
    orders: [], returns: [], order_items: [],
    expenses: [
      { id: 'e1', category: 'packaging', amount: 40, expense_date: '2026-06-02', vendor: null, note: 'Purchase order PO-7', receipt_path: null, deleted_at: null },
      { id: 'e2', category: 'packaging', amount: 40, expense_date: '2026-06-03', vendor: null, note: 'Purchase order PO-7', receipt_path: null, deleted_at: null },
      { id: 'e3', category: 'packaging', amount: 25, expense_date: '2026-06-03', vendor: null, note: 'Purchase order PO-8', receipt_path: null, deleted_at: null },
      { id: 'e4', category: 'packaging', amount: 999, expense_date: '2026-06-03', vendor: null, note: 'Purchase order PO-8', receipt_path: null, deleted_at: '2026-06-04T00:00:00Z' },
    ],
  });
  await page.clock.setFixedTime(NOW);
  await login(page);
  await gotoPage(page, 'accountingPanel');
  await page.click('#acctToggle button[data-range="all"]');
  await expect(page.locator('#acctDupWrap .acctDupRow')).toHaveCount(1); // PO-8's second entry is deleted
  await expect(page.locator('#acctDupWrap')).toContainText('Purchase order PO-7 — logged 2 times, $80.00 in total');
  await expect(page.locator('#acctStats .stat').nth(1).locator('.num')).toHaveText('$105.00'); // expenses total unchanged
});
