// EXT6 (workstream 7): Accounting totals checked against an independent
// calculation. Orders and expenses are GENERATED from fixed seeds (so every
// run is the same), served through the mock with Supabase's 1,000-row reply
// cap, and the page's figures are compared with totals this test works out
// itself in whole cents. Nothing here calls the page's own functions, so a
// mistake in the page's arithmetic cannot hide in the expected values.
//
// The rules re-stated here (docs/ops/N4-refunds-accounting-map.md, current
// policy "status_only"):
//   * deleted orders/expenses (recycle bin) do not count
//   * an order whose status mentions "cancel", or "refund" but not "partial",
//     is excluded from revenue and shown as "Cancelled / refunded (excluded)"
//   * a partial refund counts in full and is listed under "needs review"
//   * net profit = revenue − expenses
// Synthetic data only.

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

function prng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const STATUSES = ['paid', 'fulfilled', 'Paid', 'pending', 'cancelled', 'Canceled', 'refunded', 'Refunded', 'partially_refunded', 'Partially Refunded', null, ''];

function generate(seed, nOrders, nExpenses) {
  const r = prng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const cents = () => (r() < 0.05 ? 0 : Math.floor(r() * 250000)); // $0 to $2,500.00, some exactly $0
  const orders = Array.from({ length: nOrders }, (_, i) => ({
    id: 'ord-' + seed + '-' + String(i).padStart(5, '0'), order_number: 'GEN-' + seed + '-' + i,
    totalCents: cents(), status: pick(STATUSES), deleted: r() < 0.07,
  }));
  const expenses = Array.from({ length: nExpenses }, (_, i) => ({
    id: 'exp-' + seed + '-' + String(i).padStart(5, '0'), amountCents: Math.floor(r() * 80000) + 1, deleted: r() < 0.07,
  }));
  return { orders, expenses };
}

function expected({ orders, expenses }) {
  let revenue = 0, excluded = 0, review = 0, spent = 0;
  for (const o of orders) {
    if (o.deleted) continue;
    const s = String(o.status || '').toLowerCase();
    const refund = s.indexOf('refund') !== -1, partial = refund && s.indexOf('partial') !== -1;
    if (s.indexOf('cancel') !== -1 || (refund && !partial)) { excluded += o.totalCents; continue; }
    revenue += o.totalCents;
    if (partial) review++;
  }
  for (const e of expenses) if (!e.deleted) spent += e.amountCents;
  return { revenue, spent, net: revenue - spent, excluded, review };
}

// Independent formatter: whole cents to "$1,234.56" / "-$1,234.56".
function usd(c) {
  const neg = c < 0, a = Math.abs(c);
  const d = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + '$' + d + '.' + String(a % 100).padStart(2, '0');
}

function serve(backend, data) {
  backend.tables.orders = data.orders.map(o => ({
    id: o.id, order_number: o.order_number, total: (o.totalCents / 100).toFixed(2), tax_total: '0.00', currency: 'USD',
    status: o.status, placed_at: '2026-03-01T12:00:00Z', deleted_at: o.deleted ? '2026-03-05T00:00:00Z' : null,
    source: 'manual', raw_data: null, customer_name: 'SYNTHETIC', created_at: '2026-03-01T12:00:00Z',
  }));
  backend.tables.expenses = data.expenses.map(e => ({
    id: e.id, category: 'packaging', amount: (e.amountCents / 100).toFixed(2), expense_date: '2026-03-02',
    vendor: 'SYNTHETIC', receipt_path: null, deleted_at: e.deleted ? '2026-03-05T00:00:00Z' : null, note: null, created_at: '2026-03-02T00:00:00Z',
  }));
  backend.maxRows = 1000;
}

async function openAllTime(page) {
  await gotoPage(page, 'accountingPanel');
  await page.click('#accountingPanel button[data-range="all"]');
}
// The figures count up for half a second when they appear (animateNumber),
// so a single read can catch a number on its way. Read only when no figure is
// still moving; callers poll until the read equals the expected figures.
async function readFigures(page) {
  if (await page.locator('#acctStats [data-animating]').count()) return 'still counting up';
  const nums = await page.locator('#acctStats .stat .num').allTextContents();
  if (nums.length !== 4) return 'figures not shown yet';
  const [revenue, spent, net, excluded] = nums;
  const review = await page.locator('#acctReviewWrap .deletedRow').count();
  return { revenue, spent, net, excluded, review };
}

const CASES = [
  [1, 0, 0], [2, 1, 1], [3, 99, 40], [4, 999, 10], [5, 1000, 1001], [6, 1001, 999], [7, 2500, 1200],
];
for (const [seed, nO, nE] of CASES) {
  test(`generated seed ${seed}: ${nO} orders, ${nE} expenses — page totals equal an independent calculation`, async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'arithmetic, run once');
    test.setTimeout(120000);
    const data = generate(seed, nO, nE);
    serve(backend, data);
    const want = expected(data);
    await login(page);
    await openAllTime(page);
    await expect.poll(() => readFigures(page), { timeout: 30000 })
      .toEqual({ revenue: usd(want.revenue), spent: usd(want.spent), net: usd(want.net), excluded: usd(want.excluded), review: want.review });
  });
}

// Totals that should come to exactly zero must not show "-$0.00": in
// floating point 0.1 + 0.2 is 0.30000000000000004, so 0.30 − (0.10 + 0.20)
// is a tiny negative number that the currency formatter prints as "-$0.00".
test('net profit that is exactly zero shows $0.00, not -$0.00', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'arithmetic, run once');
  serve(backend, {
    orders: [{ id: 'ord-z1', order_number: 'Z-1', totalCents: 30, status: 'paid', deleted: false }],
    expenses: [{ id: 'exp-z1', amountCents: 10, deleted: false }, { id: 'exp-z2', amountCents: 20, deleted: false }],
  });
  await login(page);
  await openAllTime(page);
  await expect.poll(() => readFigures(page), { timeout: 30000 })
    .toEqual({ revenue: '$0.30', spent: '$0.30', net: '$0.00', excluded: '$0.00', review: 0 });
});

test('many small amounts add up to the exact cent (1,001 × $0.01 orders and 3 × $0.10 expenses)', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'arithmetic, run once');
  test.setTimeout(120000);
  serve(backend, {
    orders: Array.from({ length: 1001 }, (_, i) => ({ id: 'ord-s' + String(i).padStart(5, '0'), order_number: 'S-' + i, totalCents: 1, status: 'paid', deleted: false })),
    expenses: [10, 10, 10].map((c, i) => ({ id: 'exp-s' + i, amountCents: c, deleted: false })),
  });
  await login(page);
  await openAllTime(page);
  await expect.poll(() => readFigures(page), { timeout: 30000 })
    .toEqual({ revenue: '$10.01', spent: '$0.30', net: '$9.71', excluded: '$0.00', review: 0 });
});

// EXT6: the count-up animation re-formatted the settled number in the
// browser's own language ("$25.000,00" on a German computer). The last frame
// now puts back the page's own text.
test.describe('a browser set to German', () => {
  test.use({ locale: 'de-DE' });
  test('figures settle in the page\'s own format ($25,000.00), not the browser language', async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    serve(backend, {
      orders: Array.from({ length: 10 }, (_, i) => ({ id: 'ord-d' + i, order_number: 'D-' + i, totalCents: 250000, status: 'paid', deleted: false })),
      expenses: [{ id: 'exp-d1', amountCents: 123456, deleted: false }],
    });
    await login(page);
    expect(await page.evaluate(() => (1234.5).toLocaleString())).toBe('1.234,5'); // the browser really is German
    await openAllTime(page);
    await expect.poll(() => readFigures(page), { timeout: 30000 })
      .toEqual({ revenue: '$25,000.00', spent: '$1,234.56', net: '$23,765.44', excluded: '$0.00', review: 0 });
  });
});

// EXT6: the Daily Summary counted revenue with its own rule (everything but
// the exact word "cancelled"), so "Canceled" and fully refunded orders were
// revenue there but not on Accounting. One rule everywhere now.
test.describe('Daily Summary uses the same revenue rule as Accounting', () => {
  test.use({ timezoneId: 'America/Chicago' });
  test('yesterday: paid $10 counts; "Canceled" $7, "refunded" $5 and "CANCELLED" $3 do not; a partial refund $2 does', async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'arithmetic, run once');
    await page.clock.setFixedTime(new Date('2026-06-15T17:00:00Z')); // noon in Chicago
    const y = '2026-06-14T17:00:00Z'; // yesterday noon in Chicago
    backend.tables.orders = [['paid', 1000], ['Canceled', 700], ['refunded', 500], ['CANCELLED', 300], ['partially_refunded', 200]].map(([status, c], i) => ({
      id: 'ord-ds' + i, order_number: 'DS-' + i, total: (c / 100).toFixed(2), tax_total: '0', currency: 'USD', status,
      placed_at: y, deleted_at: null, source: 'manual', raw_data: null, customer_name: 'SYNTHETIC', created_at: y,
    }));
    await login(page);
    await gotoPage(page, 'dailySummaryPanel');
    const revenue = page.locator('#dailySummaryStats .stat', { hasText: 'Revenue' }).locator('.num');
    await expect.poll(async () => (await page.locator('#dailySummaryStats [data-animating]').count()) ? 'moving' : revenue.textContent(), { timeout: 20000 }).toBe('$12.00');
  });
});

// EXT6: totals are labelled with the first order's currency and add every
// amount together. With more than one currency the sum means nothing, so the
// page says so instead of showing it as if it were right.
for (const [panel, button, where] of [['accountingPanel', '#accountingPanel button[data-range="all"]', 'Accounting'], ['taxRecordsPanel', null, 'Tax Records']]) {
  test(`${where}: orders in two currencies trigger a plain warning`, async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'run once');
    const now = new Date().toISOString();
    backend.tables.orders = [['USD', '10.00'], ['CAD', '20.00']].map(([currency, total], i) => ({
      id: 'ord-cur' + i, order_number: 'CUR-' + i, total, tax_total: '0', currency, status: 'paid',
      placed_at: now, deleted_at: null, source: 'manual', raw_data: null, customer_name: 'SYNTHETIC', created_at: now,
    }));
    backend.tables.expenses = [];
    await login(page);
    await gotoPage(page, panel);
    if (button) await page.click(button);
    await expect(page.locator('#dashError')).toContainText(where + ': these orders are in more than one currency (CAD, USD)');
    await expect(page.locator('#dashError')).toContainText('Do not rely on these totals');
  });
}

test('one currency only: no currency warning', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  serve(backend, { orders: [{ id: 'ord-one', order_number: 'ONE', totalCents: 1000, status: 'paid', deleted: false }], expenses: [] });
  await login(page);
  await openAllTime(page);
  await expect.poll(() => readFigures(page), { timeout: 30000 }).toMatchObject({ revenue: '$10.00' });
  await expect(page.locator('#dashError')).not.toContainText('more than one currency');
});

test.describe('home page "Today\'s revenue" uses the same rule', () => {
  test.use({ timezoneId: 'America/Chicago' });
  test('today: paid $10 counts; "Canceled" $7 and "refunded" $5 do not', async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'arithmetic, run once');
    await page.clock.setFixedTime(new Date('2026-06-15T17:00:00Z'));
    const t = '2026-06-15T15:00:00Z';
    backend.tables.orders = [['paid', '10.00'], ['Canceled', '7.00'], ['refunded', '5.00']].map(([status, total], i) => ({
      id: 'ord-td' + i, order_number: 'TD-' + i, total, tax_total: '0', currency: 'USD', status,
      placed_at: t, deleted_at: null, source: 'manual', raw_data: null, customer_name: 'SYNTHETIC', created_at: t,
    }));
    await login(page);
    const tileNum = page.locator('.stat', { hasText: "Today's revenue" }).locator('.num');
    await expect.poll(async () => (await page.locator('.stat [data-animating]').count()) ? 'moving' : tileNum.first().textContent(), { timeout: 20000 }).toBe('$10.00');
  });
});

// EXT6: the Orders page's "Total revenue" added up only the newest 300 orders
// it had read (cancelled and refunded included) while claiming to be the
// true total. Now: the Accounting rule, and an honest label when capped.
test.describe('Orders page revenue figure', () => {
  const ordersOf = (n, statusOf) => Array.from({ length: n }, (_, i) => ({
    id: 'ord-op' + String(i).padStart(4, '0'), order_number: 'OP-' + i, customer_name: 'SYNTHETIC', customer_email: null,
    status: statusOf(i), currency: 'USD', total: '1.00', tax_total: '0', source: 'manual', raw_data: null,
    placed_at: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(), deleted_at: null, created_at: '2026-01-01T00:00:00Z',
  }));
  async function figure(page) {
    await gotoPage(page, 'ordersPanel');
    const stat = page.locator('#orderStats .stat').nth(1);
    await expect.poll(async () => (await page.locator('#orderStats [data-animating]').count()) ? 'moving' : stat.innerText(), { timeout: 20000 }).not.toBe('moving');
    return (await stat.innerText()).replace(/\s+/g, ' ').trim();
  }
  test('10 orders, 2 cancelled / refunded: $8.00 "Total revenue (cancelled and refunded excluded)"', async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'arithmetic, run once');
    backend.tables.orders = ordersOf(10, i => (i === 3 ? 'Canceled' : i === 7 ? 'refunded' : 'paid'));
    await login(page);
    expect(await figure(page)).toBe('$8.00 Total revenue (cancelled and refunded excluded)');
  });
  test('450 orders: the figure says it covers the newest 300 only (never "Total")', async ({ page, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'arithmetic, run once');
    backend.tables.orders = ordersOf(450, () => 'paid');
    await login(page);
    expect(await figure(page)).toBe('$300.00 Revenue of the newest 300 orders (all orders: Accounting)');
    await expect(page.locator('#orderStats .stat').first().locator('.num')).toHaveText('450');
  });
});

// EXT6 (X6-14): manual orders saved without items count as revenue; the
// Accounting page lists them so they are not invisible.
test('Accounting lists manual orders saved without items (counted in revenue), not Shopify ones or cancelled ones', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  const now = new Date().toISOString();
  const o = (id, source, status, total) => ({ id, order_number: id.toUpperCase(), total, tax_total: '0', currency: 'USD', status, placed_at: now,
    deleted_at: null, source, raw_data: null, customer_name: 'SYNTHETIC', created_at: now });
  backend.tables.orders = [o('m-ok', 'manual', 'paid', '10.00'), o('m-empty', 'manual', 'paid', '20.00'), o('m-cancel', 'manual', 'cancelled', '5.00'), o('s-noitems', 'shopify', 'paid', '7.00')];
  backend.tables.order_items = [{ id: 'oi-1', order_id: 'm-ok', product_name: 'SYNTHETIC', quantity: 1, unit_price: 10, line_total: 10 }];
  backend.tables.expenses = [];
  await login(page);
  await openAllTime(page);
  await expect(page.locator('#acctNoItemsWrap .acctNoItemsRow')).toHaveCount(1);
  await expect(page.locator('#acctNoItemsWrap')).toContainText('M-EMPTY');
  await expect(page.locator('#acctNoItemsWrap')).toContainText('$20.00');
});

test('Accounting: every manual order has its items: "None found."', async ({ page, backend }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'run once');
  serve(backend, { orders: [{ id: 'ord-x', order_number: 'X', totalCents: 1000, status: 'paid', deleted: false }], expenses: [] });
  await login(page);
  await openAllTime(page);
  await expect(page.locator('#acctNoItemsWrap')).toContainText('None found.');
});
