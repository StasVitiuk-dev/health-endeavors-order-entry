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
