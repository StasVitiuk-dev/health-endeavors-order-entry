// N4: how refunds recorded on the Returns page count against revenue. The
// dashboard keeps today's behaviour ('status_only') until the owner decides.
// Both options are tested here so the switch is a one-line, tested change:
// ACCOUNTING_REFUND_POLICY in owner-login.html.

const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { load, SOURCE } = require('../helpers/extract-source');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const H = load(['classifyOrderStatus', 'refundsToSubtract']);

const ORDERS = [
  { id: 'o1', status: 'paid', total: 100 },
  { id: 'o2', status: 'refunded', total: 50 },          // already excluded by status
  { id: 'o3', status: 'partially_refunded', total: 80 },
];
const REFUNDS = [
  { order_id: 'o1', refund_amount: 30 },  // recorded on Returns only
  { order_id: 'o2', refund_amount: 50 },  // order already excluded: must not count twice
  { order_id: 'o3', refund_amount: 20 },
  { order_id: 'o-older', refund_amount: 10 }, // order placed in an earlier period
];

base.test.describe('refundsToSubtract (unit)', () => {
  base.test.beforeEach(({}, testInfo) => { base.test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

  base.test("today's policy ('status_only') subtracts nothing", () => {
    base.expect(H.refundsToSubtract(ORDERS, REFUNDS, 'status_only')).toBe(0);
  });
  base.test("'subtract_return_refunds' subtracts Returns refunds, never twice for an order already excluded by status", () => {
    base.expect(H.refundsToSubtract(ORDERS, REFUNDS, 'subtract_return_refunds')).toBe(60); // 30 + 20 + 10
  });
  base.test('missing amounts count as zero; empty lists are fine', () => {
    base.expect(H.refundsToSubtract([], [{ order_id: 'x', refund_amount: null }], 'subtract_return_refunds')).toBe(0);
    base.expect(H.refundsToSubtract(null, null, 'subtract_return_refunds')).toBe(0);
  });
  base.test('the dashboard ships with the current behaviour until the owner decides', () => {
    base.expect(SOURCE).toContain("const ACCOUNTING_REFUND_POLICY = 'status_only';");
  });
});

function seed(backend) {
  backend.tables.orders = [
    { id: 'o1', order_number: 'SYN-1', total: 100, tax_total: 0, currency: 'USD', status: 'paid', placed_at: '2026-03-01T12:00:00Z', deleted_at: null, source: 'manual', raw_data: null },
    { id: 'o2', order_number: 'SYN-2', total: 50, tax_total: 0, currency: 'USD', status: 'refunded', placed_at: '2026-03-01T12:00:00Z', deleted_at: null, source: 'manual', raw_data: null },
  ];
  backend.tables.expenses = [];
  backend.tables.returns = [
    { id: 'r1', order_id: 'o1', refund_amount: 30, refunded_at: '2026-03-05T12:00:00Z', status: 'refunded' },
    { id: 'r2', order_id: 'o2', refund_amount: 50, refunded_at: '2026-03-05T12:00:00Z', status: 'refunded' },
  ];
}

async function accountingAllTime(page) {
  await gotoPage(page, 'accountingPanel');
  await page.waitForLoadState('networkidle');
  await page.click('#accountingPanel button[data-range="all"]');
}

test("Accounting today: a $30 refund recorded on Returns does not reduce revenue ('status_only')", async ({ page, backend }) => {
  seed(backend);
  await login(page);
  await accountingAllTime(page);
  await expect(page.locator('#acctStats .stat', { hasText: 'Revenue' }).first()).toContainText('$100.00');
});

test("Accounting with 'subtract_return_refunds': revenue $70 and the refund tile shows $30 (the $50 on an already-refunded order is not taken twice)", async ({ page, backend }) => {
  seed(backend);
  const file = path.resolve(__dirname, '..', '..', 'owner-login.html');
  const html = fs.readFileSync(file, 'utf8').replace("const ACCOUNTING_REFUND_POLICY = 'status_only';", "const ACCOUNTING_REFUND_POLICY = 'subtract_return_refunds';");
  await page.route('**/owner-login.html', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await login(page);
  await accountingAllTime(page);
  await expect(page.locator('#acctStats .stat', { hasText: 'Revenue' }).first()).toContainText('$70.00');
  await expect(page.locator('#acctStats .stat', { hasText: 'Refunds on Returns' })).toContainText('$30.00');
});
