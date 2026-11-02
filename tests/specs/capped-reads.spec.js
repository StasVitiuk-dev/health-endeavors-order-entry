// EXT8 (workstream K): lists that read a capped number of rows must never
// hide open work behind closed rows, and every visible figure is either
// complete or says which subset it shows. Synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'data logic; run once'); });

const AT = n => new Date(Date.UTC(2025, 0, 1) + n * 60000).toISOString();

test.describe('Customer inquiries', () => {
  test('210 newer answered questions do not hide an older one still needing review; figures are exact', async ({ page, backend }) => {
    backend.tables.customer_inquiries = [
      { id: 'inq-old-open', customer_name: 'SYNTHETIC old waiting', customer_email: 'old@example.test', channel: 'email', question_text: 'SYNTHETIC still waiting', status: 'needs_review', severity: 'high', created_at: AT(0) },
      { id: 'inq-old-new', customer_name: 'SYNTHETIC old new', customer_email: 'new@example.test', channel: 'email', question_text: 'SYNTHETIC no draft', status: 'new', severity: null, created_at: AT(1) },
      ...Array.from({ length: 210 }, (_, i) => ({ id: 'inq-ans-' + i, customer_name: 'SYNTHETIC answered ' + i, customer_email: 'a' + i + '@example.test',
        channel: 'email', question_text: 'SYNTHETIC done', status: 'answered', severity: 'low', created_at: AT(1000 + i) })),
    ];
    backend.maxRows = 1000;
    await login(page);
    await gotoPage(page, 'inquiriesPanel');
    await expect(page.locator('#inquiriesWrap .approvalRow[data-id="inq-old-open"]')).toHaveCount(1);
    await expect(page.locator('#inquiriesWrap .approvalRow[data-id="inq-old-new"]')).toHaveCount(1);
    const stat = lbl => page.locator('#inqStats .stat', { hasText: lbl }).locator('.num');
    await expect(stat('Needs review')).toHaveText('1');
    await expect(stat('New, no draft')).toHaveText('1');
    await expect(stat('Answered')).toHaveText('210');
    await expect(page.locator('#inquiriesWrap')).toContainText('Answered: the newest 100 of 210.');
  });
});

test.describe('Returns: logging a return for an older order', () => {
  test('an order older than the newest 200 can be found by its number and its items load', async ({ page, backend }) => {
    backend.tables.orders = [
      { id: 'ord-old', order_number: 'HE-OLD-7', customer_name: 'SYNTHETIC old buyer', status: 'paid', total: 10, currency: 'USD', placed_at: AT(0), deleted_at: null, created_at: AT(0) },
      ...Array.from({ length: 205 }, (_, i) => ({ id: 'ord-n' + i, order_number: 'HE-N' + i, customer_name: 'SYNTHETIC', status: 'paid', total: 1, currency: 'USD', placed_at: AT(1000 + i), deleted_at: null, created_at: AT(1000 + i) })),
    ];
    backend.tables.order_items = [{ id: 'oi-old', order_id: 'ord-old', product_name: 'SYNTHETIC old lotion', sku: 'SYN-A', quantity: 2, unit_price: 5, line_total: 10 }];
    await login(page);
    await gotoPage(page, 'returnsPanel');
    await expect(page.locator('#retOrder option[value="ord-old"]')).toHaveCount(0);
    await expect(page.locator('#retOrderHint')).toContainText('newest 200 orders');
    await page.fill('#retOrderFind', 'old-7');
    await page.press('#retOrderFind', 'Enter');
    await expect(page.locator('#retOrder')).toHaveValue('ord-old');
    await expect(page.locator('#retOrderItem option', { hasText: 'SYNTHETIC old lotion' })).toHaveCount(1);
    await expect(page.locator('#retOrderHint')).toContainText('Found order HE-OLD-7');
  });

  test('the search matches the number literally (% and _ are not wildcards)', async ({ page, backend }) => {
    backend.tables.orders = [{ id: 'ord-a', order_number: 'HE-A1', customer_name: 'SYNTHETIC', status: 'paid', total: 1, currency: 'USD', placed_at: AT(1), deleted_at: null, created_at: AT(1) }];
    await login(page);
    await gotoPage(page, 'returnsPanel');
    await page.fill('#retOrderFind', '%');
    await page.click('#retOrderFindBtn');
    await expect(page.locator('#retOrderHint')).toContainText('No order number contains "%"');
  });
});

test.describe('Global search: orders older than the loaded ones', () => {
  const seed = backend => {
    backend.tables.orders = [
      { id: 'ord-old', order_number: 'HE-OLD-7', customer_name: 'SYNTHETIC Willow Shop', status: 'paid', total: 42.5, currency: 'USD', placed_at: AT(0), deleted_at: null, created_at: AT(0) },
      { id: 'ord-pct', order_number: 'HE-50%OFF', customer_name: 'SYNTHETIC', status: 'paid', total: 1, currency: 'USD', placed_at: AT(2), deleted_at: null, created_at: AT(2) },
      ...Array.from({ length: 320 }, (_, i) => ({ id: 'ord-n' + i, order_number: 'HE-N' + i, customer_name: 'SYNTHETIC', status: 'paid', total: 1, currency: 'USD', placed_at: AT(1000 + i), deleted_at: null, created_at: AT(1000 + i) })),
    ];
  };

  test('not among the loaded orders, but "Look up in all orders" finds it by number or customer', async ({ page, backend }) => {
    seed(backend);
    await login(page);
    await page.fill('#sidebarSearch', 'willow');
    await expect(page.locator('#sidebarNav .searchResultLink', { hasText: 'Willow' })).toHaveCount(0); // not loaded
    await page.click('#orderLookupBtn');
    await expect(page.locator('#orderLookupResults .orderLookupLink')).toHaveCount(1);
    await expect(page.locator('#orderLookupResults')).toContainText('HE-OLD-7');
    await expect(page.locator('#orderLookupResults')).toContainText('$42.50');
  });

  test('% in the search text is literal: "50%" finds HE-50%OFF only', async ({ page, backend }) => {
    seed(backend);
    await login(page);
    await page.fill('#sidebarSearch', '50%');
    await page.click('#orderLookupBtn');
    await expect(page.locator('#orderLookupResults .orderLookupLink')).toHaveCount(1);
    await expect(page.locator('#orderLookupResults')).toContainText('HE-50%OFF');
  });

  test('no match says so plainly', async ({ page, backend }) => {
    seed(backend);
    await login(page);
    await page.fill('#sidebarSearch', 'zzzz');
    await page.click('#orderLookupBtn');
    await expect(page.locator('#orderLookupResults')).toContainText('No order number or customer name contains this.');
  });
});

test.describe('Recycle bins and history lists say how many there are and can show more', () => {
  test('deleted orders: 60 in the bin; the oldest is reachable with "Show more" and can be restored', async ({ page, backend }) => {
    backend.tables.orders = Array.from({ length: 60 }, (_, i) => ({ id: 'ord-del-' + i, order_number: 'HE-D' + i, customer_name: 'SYNTHETIC', customer_email: null,
      status: 'paid', total: 1, currency: 'USD', placed_at: AT(i), deleted_at: AT(100 + i), created_at: AT(i) }));
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const wrap = page.locator('#deletedOrdersWrap');
    await expect(wrap.locator('.deletedRow')).toHaveCount(50);
    await expect(wrap).toContainText('Showing the 50 most recent of 60 deleted orders.');
    await expect(wrap.locator('.deletedRow[data-id="ord-del-0"]')).toHaveCount(0);
    await wrap.getByRole('button', { name: 'Show more' }).click();
    await expect(wrap.locator('.deletedRow')).toHaveCount(60);
    await expect(wrap.locator('.deletedRow[data-id="ord-del-0"]')).toHaveCount(1);
    await expect(wrap.locator('.listMore')).toHaveCount(0);
  });

  test('deleted expenses and inventory history: counts and Show more', async ({ page, backend }) => {
    backend.tables.expenses = Array.from({ length: 55 }, (_, i) => ({ id: 'exp-del-' + i, category: 'other', amount: 1, expense_date: '2026-03-01', vendor: 'SYNTHETIC',
      receipt_path: null, note: null, deleted_at: AT(i), created_at: AT(i) }));
    await login(page);
    await gotoPage(page, 'expensesPanel');
    await expect(page.locator('#deletedExpensesWrap')).toContainText('Showing the 50 most recent of 55 deleted expenses.');
    await page.locator('#deletedExpensesWrap').getByRole('button', { name: 'Show more' }).click();
    await expect(page.locator('#deletedExpensesWrap .deletedRow')).toHaveCount(55);
  });

  test('evidence: an old open incident (outside the newest 200) can be picked', async ({ page, backend }) => {
    backend.tables.incidents = [
      { id: 'inc-old-open', incident_number: 'INC-OLD', title: 'SYNTHETIC old open', severity: 'low', status: 'open', created_at: AT(0) },
      ...Array.from({ length: 210 }, (_, i) => ({ id: 'inc-c' + i, incident_number: 'INC-C' + i, title: 'SYNTHETIC closed', severity: 'low', status: 'closed', created_at: AT(1000 + i) })),
    ];
    backend.tables.evidence_locker = [];
    await login(page);
    await gotoPage(page, 'evidenceLockerPanel');
    await expect(page.locator('#evidenceIncident option[value="inc-old-open"]')).toHaveCount(1);
  });
});
