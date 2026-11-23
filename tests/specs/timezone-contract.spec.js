// Timezone contract, page level (2026-10-06, extension 4, workstream E).
// docs/ops/TIMEZONE_CONTRACT.md: calendar days are the viewer's own calendar
// (Central for the business); date-only columns (expense_date) are compared
// as calendar dates, never as a UTC slice of a local midnight.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'date logic; run once'); });

const expenseQuery = backend => {
  const r = backend.requests.filter(x => x.table === 'expenses' && x.method === 'GET' && decodeURIComponent(x.query).startsWith('?select=id,amount,expense_date,deleted_at,note')).pop(); // the Accounting read
  return r ? decodeURIComponent(r.query) : '';
};

async function openAccounting(page, backend, now, range) {
  Object.assign(backend.tables, { orders: [], expenses: [], returns: [], order_items: [] });
  await page.clock.setFixedTime(now);
  await login(page);
  await gotoPage(page, 'accountingPanel');
  await page.waitForLoadState('networkidle');
  await page.click(`#acctToggle button[data-range="${range}"]`);
  await page.waitForLoadState('networkidle');
}

test.describe('Central viewer', () => {
  test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

  test('"Last 7 days" at 9 pm still includes expenses dated 7 days ago (was cut by the UTC date)', async ({ page, backend }) => {
    await openAccounting(page, backend, new Date('2026-10-07T02:00:00Z'), 'week'); // 21:00 CDT Oct 6
    await expect.poll(() => expenseQuery(backend)).toContain('expense_date=gte.2026-09-29');
  });

  test('"This Month" at 11:59 pm on the last day still asks for this month', async ({ page, backend }) => {
    await openAccounting(page, backend, new Date('2026-07-01T04:59:00Z'), 'month'); // 23:59 CDT Jun 30
    await expect.poll(() => expenseQuery(backend)).toContain('expense_date=gte.2026-06-01');
  });
});

test.describe('viewer travelling outside Central (Berlin)', () => {
  test.use({ timezoneId: 'Europe/Berlin', locale: 'en-US' });

  test('"This Month" just after midnight on the 1st asks for expenses from the 1st, not the 30th', async ({ page, backend }) => {
    await openAccounting(page, backend, new Date('2026-09-30T22:30:00Z'), 'month'); // 00:30 CEST Oct 1
    await expect.poll(() => expenseQuery(backend)).toContain('expense_date=gte.2026-10-01');
  });
});
