// EXT7 (workstream D): Tax Records checked against an independent
// calculation, like accounting-oracle.spec.js does for Accounting. Orders,
// expenses, order lines and products are generated from fixed seeds and the
// page's figures, the "Sales tax by state" table and the cost estimate are
// compared with totals this test works out itself in whole cents. Nothing
// here calls the page's own functions. Synthetic data only.
//
// Rules re-stated here (docs/ops/N4-refunds-accounting-map.md, policy
// "status_only"; TAX_CATEGORY_MAP):
//   * deleted rows do not count; "cancel" or full "refund" statuses are not sales
//   * expense groups: ingredients / packaging / manufacturing = COGS, all else operating
//   * a state is one row however it is spelled (code, full name, case, spaces);
//     outside the US: "<province> (<country>)"; no address = "Unknown"
//   * the cost estimate matches order-line SKUs to products ignoring case/spaces

const { test, expect, login, gotoPage } = require('../helpers/dashboard');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'arithmetic, run once'); });

function prng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const STATUSES = ['paid', 'fulfilled', 'Cancelled', 'refunded', 'Partially Refunded', 'pending'];
// [shipping_address, the state key a person expects]
const ADDRESSES = [
  [{ province: 'California', province_code: 'CA', country_code: 'US' }, 'CA'],
  [{ province: 'CA' }, 'CA'],
  [{ province: ' california ' }, 'CA'],
  [{ province: 'new  york' }, 'NY'],
  [{ province: 'New York', province_code: 'NY', country_code: 'US' }, 'NY'],
  [{ province: 'tx' }, 'TX'],
  [{ province: 'Ontario', province_code: 'ON', country_code: 'CA' }, 'Ontario (CA)'],
  [null, null],
];
const COGS = new Set(['ingredients', 'packaging', 'manufacturing']);
const CATEGORIES = ['ingredients', 'packaging', 'manufacturing', 'shipping_supplies', 'advertising', 'software', 'other'];
const PRODUCTS = [['SYN-A', 125], ['SYN-B', 400], ['SYN-C', null]]; // [sku, cost cents | none]
const LINE_SKUS = ['SYN-A', 'syn-a', ' SYN-A ', 'SYN-B', 'Syn-B', 'SYN-C', 'NOPE-1', null];

function generate(seed, nOrders, nExpenses) {
  const r = prng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const orders = [], items = [];
  for (let i = 0; i < nOrders; i++) {
    const [addr, key] = pick(ADDRESSES);
    const o = { id: 'ord-t' + seed + '-' + String(i).padStart(4, '0'), totalCents: Math.floor(r() * 50000), taxCents: Math.floor(r() * 4000),
      status: pick(STATUSES), deleted: r() < 0.06, addr, key };
    orders.push(o);
    const nLines = Math.floor(r() * 3);
    for (let j = 0; j < nLines; j++) items.push({ id: o.id + '-l' + j, order_id: o.id, sku: pick(LINE_SKUS), quantity: 1 + Math.floor(r() * 4) });
  }
  const expenses = Array.from({ length: nExpenses }, (_, i) => ({ id: 'exp-t' + seed + '-' + i, category: pick(CATEGORIES), amountCents: 1 + Math.floor(r() * 30000), deleted: r() < 0.06 }));
  return { orders, items, expenses };
}

function expected({ orders, items, expenses }) {
  const counted = new Set();
  let revenue = 0, tax = 0, cogs = 0, operating = 0, estCogs = 0, unmatched = 0;
  const byState = {};
  for (const o of orders) {
    if (o.deleted) continue;
    const s = String(o.status || '').toLowerCase();
    const refund = s.includes('refund'), partial = refund && s.includes('partial');
    if (s.includes('cancel') || (refund && !partial)) continue;
    counted.add(o.id);
    revenue += o.totalCents; tax += o.taxCents;
    const k = o.key || 'Unknown / not yet verified';
    byState[k] = (byState[k] || 0) + o.taxCents;
  }
  for (const e of expenses) { if (e.deleted) continue; if (COGS.has(e.category)) cogs += e.amountCents; else operating += e.amountCents; }
  const costOf = new Map(PRODUCTS.map(([sku, c]) => [sku.toLowerCase(), c]));
  for (const it of items) {
    if (!counted.has(it.order_id)) continue;
    const c = it.sku ? costOf.get(it.sku.trim().toLowerCase()) : undefined;
    if (c === null || c === undefined) unmatched += it.quantity; else estCogs += it.quantity * c;
  }
  return { revenue, cogs, operating, net: revenue - cogs - operating, tax, byState, estCogs, unmatched };
}

function usd(c) {
  const neg = c < 0, a = Math.abs(c);
  return (neg ? '-' : '') + '$' + String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(a % 100).padStart(2, '0');
}

function serve(backend, data) {
  const when = '2026-03-01T12:00:00Z';
  backend.tables.orders = data.orders.map(o => ({ id: o.id, order_number: o.id.toUpperCase(), total: (o.totalCents / 100).toFixed(2),
    tax_total: (o.taxCents / 100).toFixed(2), currency: 'USD', status: o.status, placed_at: when, deleted_at: o.deleted ? when : null,
    source: 'shopify', raw_data: o.addr ? { shipping_address: o.addr } : null, customer_name: 'SYNTHETIC', created_at: when }));
  backend.tables.order_items = data.items.map(i => ({ ...i, product_name: 'SYNTHETIC', unit_price: 1, line_total: i.quantity }));
  backend.tables.products = PRODUCTS.map(([sku, c], i) => ({ id: 'prod-t' + i, name: 'SYNTHETIC ' + sku, sku, cost: c === null ? null : (c / 100).toFixed(2), is_active: true }));
  backend.tables.expenses = data.expenses.map(e => ({ id: e.id, category: e.category, amount: (e.amountCents / 100).toFixed(2), expense_date: '2026-03-02',
    vendor: 'SYNTHETIC', receipt_path: null, deleted_at: e.deleted ? when : null, note: null, created_at: when }));
  backend.maxRows = 1000;
}

async function read(page) {
  if (await page.locator('#taxRecordsPanel [data-animating]').count()) return 'still counting up';
  const nums = await page.locator('#taxStats .stat .num').allTextContents();
  if (nums.length !== 5) return 'figures not shown yet';
  const [revenue, cogs, operating, net, tax] = nums;
  const byState = {};
  for (const row of await page.locator('#taxStateWrap tbody tr').all()) {
    const [k, v] = await row.locator('td').allTextContents();
    byState[k] = v;
  }
  const cogsNums = await page.locator('#taxCogsWrap .stat .num').allTextContents();
  return { revenue, cogs, operating, net, tax, byState, estCogs: cogsNums[0], unmatched: cogsNums[1] };
}

for (const [seed, nO, nE] of [[11, 0, 0], [12, 7, 3], [13, 120, 40], [14, 1100, 300]]) {
  test(`Tax Records, seed ${seed}: ${nO} orders, ${nE} expenses — figures, state table and cost estimate equal an independent calculation`, async ({ page, backend }) => {
    test.setTimeout(120000);
    const data = generate(seed, nO, nE);
    serve(backend, data);
    const want = expected(data);
    await login(page);
    await gotoPage(page, 'taxRecordsPanel');
    await page.click('#taxRecordsPanel button[data-range="all"]');
    // The table lists every state seen (even at $0); "Unknown" only when it has tax.
    const UNKNOWN = 'Unknown / not yet verified';
    const states = Object.entries(want.byState).filter(([k, c]) => k !== UNKNOWN || c > 0);
    const wantStates = Object.fromEntries(states.map(([k, c]) => [k, usd(c)]));
    await expect.poll(() => read(page), { timeout: 30000 }).toEqual({
      revenue: usd(want.revenue), cogs: usd(want.cogs), operating: usd(want.operating), net: usd(want.net), tax: usd(want.tax),
      byState: wantStates, estCogs: usd(want.estCogs), unmatched: String(want.unmatched),
    });
  });
}
