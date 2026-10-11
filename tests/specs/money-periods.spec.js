// EXT8 (workstream B): Accounting periods checked against an independent
// calculation on a pinned clock in Central time. Orders and expenses sit on
// both sides of every boundary (midnight, the 1st of the month, 7 days ago).
// The test works out each window from local calendar dates with Intl; it
// never calls the page's own range code. Synthetic data only.
//
// Rules re-stated (docs/ops/TIMEZONE_CONTRACT.md, N4 status-only refunds):
//   Today       = local date is today
//   Last 7 days = local date on or after (today - 7)   [EXT8: orders and expenses alike]
//   This Month  = local date on or after the 1st of this month
//   All Time    = everything
//   no upper bound (a future-dated record counts: X6-24, documented, deferred)
//   cancelled / fully refunded orders are excluded; partial refunds count; deleted rows never count

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'arithmetic; run once'); });

const NOW = new Date('2026-10-07T20:30:00Z'); // Wed Oct 7, 15:30 CDT
const TZ = 'America/Chicago';
const localDate = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
const today = localDate(NOW.toISOString());
const shift = (ymd, days) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const WINDOWS = { today: today, week: shift(today, -7), month: today.slice(0, 8) + '01', all: '0000-01-01' };

const ORDERS = [ // [id, placed_at (UTC), cents, status, deleted]
  ['o-today-early', '2026-10-07T05:05:00Z', 1001, 'paid'],          // Oct 7 00:05 CDT
  ['o-yday-late', '2026-10-07T04:55:00Z', 2002, 'paid'],            // Oct 6 23:55 CDT
  ['o-week-first', '2026-09-30T05:05:00Z', 4004, 'fulfilled'],      // Sep 30 00:05 CDT (first day of the window)
  ['o-week-out', '2026-09-30T04:50:00Z', 8008, 'paid'],             // Sep 29 23:50 CDT (just outside)
  ['o-month-first', '2026-10-01T05:00:00Z', 16016, 'paid'],         // Oct 1 00:00 CDT exactly
  ['o-month-out', '2026-10-01T04:59:59Z', 32032, 'paid'],           // Sep 30 23:59:59 CDT
  ['o-future', '2026-10-10T17:00:00Z', 64064, 'paid'],              // future-dated: counts (X6-24)
  ['o-cancel-today', '2026-10-07T15:00:00Z', 777, 'Cancelled'],     // excluded
  ['o-partial-week', '2026-10-02T15:00:00Z', 555, 'Partially Refunded'], // counts
  ['o-deleted-today', '2026-10-07T16:00:00Z', 999, 'paid', true],   // never counts
];
const EXPENSES = [ // [id, expense_date, cents, deleted]
  ['e-today', '2026-10-07', 300], ['e-week-first', '2026-09-30', 1100], ['e-week-out', '2026-09-29', 2500],
  ['e-month-first', '2026-10-01', 4700], ['e-deleted', '2026-10-07', 9900, true],
];

function expected(range) {
  const from = WINDOWS[range];
  let revenue = 0, excluded = 0, spent = 0;
  for (const [, at, cents, status, deleted] of ORDERS) {
    if (deleted || (range !== 'all' && localDate(at) < from) || (range === 'today' && localDate(at) < today)) continue;
    const s = status.toLowerCase(), refund = s.includes('refund'), partial = refund && s.includes('partial');
    if (s.includes('cancel') || (refund && !partial)) excluded += cents; else revenue += cents;
  }
  for (const [, date, cents, deleted] of EXPENSES) {
    if (deleted || (range !== 'all' && date < from)) continue;
    spent += cents;
  }
  return { revenue, spent, net: revenue - spent, excluded };
}
const usd = c => (c < 0 ? '-' : '') + '$' + String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(Math.abs(c) % 100).padStart(2, '0');

async function figures(page) {
  const nums = await page.locator('#acctStats .stat .num').allTextContents();
  if (nums.length !== 4) return 'not shown yet';
  const [revenue, spent, net, excluded] = nums;
  return { revenue, spent, net, excluded };
}

for (const range of ['today', 'week', 'month', 'all']) {
  test(`Accounting "${range}" on a pinned Central clock equals the independent calculation at every boundary`, async ({ page, backend }) => {
    backend.tables.orders = ORDERS.map(([id, at, cents, status, deleted]) => ({ id, order_number: id.toUpperCase(), total: (cents / 100).toFixed(2), tax_total: '0.00',
      currency: 'USD', status, placed_at: at, deleted_at: deleted ? at : null, source: 'shopify', raw_data: null, customer_name: 'SYNTHETIC', created_at: at }));
    backend.tables.expenses = EXPENSES.map(([id, date, cents, deleted]) => ({ id, category: 'packaging', amount: (cents / 100).toFixed(2), expense_date: date,
      vendor: 'SYNTHETIC', receipt_path: null, deleted_at: deleted ? '2026-10-07T00:00:00Z' : null, note: null, created_at: '2026-10-01T00:00:00Z' }));
    backend.tables.returns = [];
    await page.clock.setFixedTime(NOW);
    await login(page);
    await gotoPage(page, 'accountingPanel');
    await page.click(`#accountingPanel button[data-range="${range}"]`);
    const e = expected(range);
    await expect.poll(() => figures(page), { timeout: 15000 }).toEqual({ revenue: usd(e.revenue), spent: usd(e.spent), net: usd(e.net), excluded: usd(e.excluded) });
  });
}

test('the window button says what it does: "Last 7 days"', async ({ page }) => {
  await login(page);
  await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#accountingPanel button[data-range="week"]')).toHaveText('Last 7 days');
});

// Owner decision X6-14 (not decided here): should a manual order saved
// without its items count as revenue? Policy A (today's behaviour): yes,
// and it is listed for review. Policy B: no. Both are computed; the page
// must show A, and its list must add up to exactly the A - B difference, so
// the owner can see what B would change.
test('orders saved without items: revenue follows policy A; the listed orders equal the policy-B difference', async ({ page, backend }) => {
  const orders = [
    ['m-with', 1500, 'paid', true], ['m-empty-1', 2500, 'paid', false], ['m-empty-2', 400, 'fulfilled', false],
    ['m-empty-cancelled', 9000, 'Cancelled', false], // excluded anyway, so not listed
  ];
  backend.tables.orders = orders.map(([id, cents, status]) => ({ id, order_number: id.toUpperCase(), total: (cents / 100).toFixed(2), tax_total: '0.00', currency: 'USD',
    status, placed_at: '2026-10-05T15:00:00Z', deleted_at: null, source: 'manual', raw_data: null, customer_name: 'SYNTHETIC', created_at: '2026-10-05T15:00:00Z' }));
  backend.tables.order_items = [{ id: 'oi-1', order_id: 'm-with', product_name: 'SYNTHETIC', sku: 'SYN-A', quantity: 1, unit_price: 15, line_total: 15 }];
  backend.tables.expenses = [];
  const counted = orders.filter(([, , s]) => !s.toLowerCase().includes('cancel'));
  const policyA = counted.reduce((n, [, c]) => n + c, 0);
  const policyB = counted.filter(([, , , hasItems]) => hasItems).reduce((n, [, c]) => n + c, 0);
  await login(page);
  await gotoPage(page, 'accountingPanel');
  await page.click('#accountingPanel button[data-range="all"]');
  await expect.poll(() => figures(page).then(f => f.revenue), { timeout: 15000 }).toBe(usd(policyA));
  const listed = await page.locator('#acctNoItemsWrap .acctNoItemsRow').allTextContents();
  const listedCents = listed.reduce((n, t) => n + Math.round(Number((/\$([\d,]+\.\d\d)/.exec(t) || [, '0'])[1].replace(/,/g, '')) * 100), 0);
  expect(listed).toHaveLength(2);
  expect(listedCents).toBe(policyA - policyB);
});
