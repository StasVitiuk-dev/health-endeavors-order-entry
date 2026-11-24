// Real fees and postage per order (owner, Nov 23: "they are estimates, not the
// exact fee per order: how can we fix this?"). docs/ops/sql/drafts/52 stores each
// order's real fee and postage; Real profit uses them where saved and the
// estimates elsewhere; Money per channel saves the real fees from a channel's
// report. Behind he_order_costs (a switch that saves real records, OFF).
// assets/reports/he-order-costs-store.js. Every value is made up.
const O = require('../../assets/reports/he-order-costs-store.js');
const C = require('../../assets/reports/he-channel-money.js');
const P = require('../../assets/reports/he-profit.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const id = (n) => '00000000-0000-4000-8000-0000000' + String(n).padStart(5, '0');
const file = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') });
const ETSY = `Date,Type,Title,Info,Currency,Amount,Fees & Taxes,Net
"November 12, 2026",Sale,"Payment for Order #3000000001",,USD,$27.00,--,$27.00
"November 12, 2026",Fee,"Transaction fee: SYN Lavender oil","Order #3000000001",USD,--,-$1.63,-$1.63
"November 12, 2026",Fee,"Processing fee","Order #3000000001",USD,--,-$1.06,-$1.06
"November 14, 2026",Sale,"Payment for Order #3000000002",,USD,$25.00,--,$25.00
"November 14, 2026",Fee,"Transaction fee","Order #3000000002",USD,--,-$1.50,-$1.50
"November 14, 2026",Fee,"Listing fee","Listing #1",USD,--,-$0.20,-$0.20
"November 16, 2026",Marketing,"Etsy Ads",,USD,--,-$1.00,-$1.00
`;

test.describe('the arithmetic and the matching (no browser)', () => {
  test('a real fee or postage replaces the estimate for that order only; the rest stay estimates', ({}, ti) => {
    node(ti);
    const base = { products: [{ id: id(1), sku: 'A', cost: 4 }], postagePerOrder: 4, packagingPerOrder: 1,
      orders: [{ id: id(11), channel: 'shopify', status: 'paid', subtotal: 30, shipping_total: 5 }, { id: id(12), channel: 'tiktok', status: 'paid', subtotal: 20 }],
      items: [{ order_id: id(11), sku: 'A', quantity: 2, line_total: 30 }, { order_id: id(12), sku: 'A', quantity: 1, line_total: 20 }] };
    const est = P.compute(base);
    expect(est.orders.map(o => [o.fee, o.feeExact, o.profit])).toEqual([[132, false, 2068], [null, false, null]]);   // TikTok has no fee estimate
    const r = P.compute(Object.assign({}, base, { orderCosts: [{ order_id: id(11), fee_cents: 150, postage_cents: null }, { order_id: id(12), fee_cents: 260, postage_cents: 385 }, null, { order_id: id(99), fee_cents: -1 }, { order_id: id(11) }] }));
    expect(r.orders.map(o => [o.fee, o.feeExact, o.postage, o.postageExact, o.profit])).toEqual([[150, true, 400, false, 2050], [260, true, 385, true, 855]]);
    expect(r.totals).toMatchObject({ complete: 2, exactFees: 2, exactPostage: 1, profit: 2905 });
    expect(est.totals).toMatchObject({ complete: 1, exactFees: 0, exactPostage: 0 });
  });

  test('a channel report gives the real fee per order; matched to the dashboard by order number', ({}, ti) => {
    node(ti);
    const p = C.parseReport(ETSY, 'etsy');
    expect(O.feesByOrder(p)).toEqual({ '3000000001': 269, '3000000002': 150 });          // the listing fee and the ads belong to no order
    const m = O.rowsFor(p, [{ id: id(11), order_number: '#3000000001' }, { id: 'not-a-uuid', order_number: '3000000002' }, null]);
    expect(m).toMatchObject({ matched: 1, unmatched: ['3000000002'], tooMany: false });
    expect(m.rows).toEqual([{ order_id: id(11), fee_cents: 269, fee_source: 'etsy', postage_cents: null, postage_source: null }]);
    expect(O.feesByOrder(null)).toEqual({});
    expect(O.rowsFor({ rows: [{ kind: 'sale', order: 'x', fees: 'abc' }] }, []).rows).toEqual([]);
  });

  test('the store: reading, saving, plain words when refused; nothing sent when there is nothing to save', async ({}, ti) => {
    node(ti);
    const calls = [];
    const client = (res) => ({ from: () => ({ select: () => ({ in: () => ({ limit: async () => res }) }) }), rpc: async (n, a) => { calls.push([n, a]); return res; } });
    expect(await O.createStore({ client: client({ data: [{ order_id: id(11), fee_cents: 269 }] }) }).list([id(11), 'junk'])).toMatchObject({ state: 'ok', rows: [{ order_id: id(11), fee_cents: 269 }] });
    expect(await O.createStore({ client: client({ error: { code: 'PGRST205', message: 'Could not find the table' } }) }).list([id(11)])).toMatchObject({ state: 'error', message: expect.stringContaining('not installed') });
    expect(await O.createStore({ client: null }).list([id(11)])).toMatchObject({ state: 'off', rows: [] });
    const rows = [{ order_id: id(11), fee_cents: 269, fee_source: 'etsy', postage_cents: null, postage_source: null }];
    expect(await O.createStore({ client: client({ data: { ok: true, saved: 1, unknown_orders: 0 } }) }).save(rows)).toMatchObject({ ok: true, saved: 1, unknown: 0 });
    expect(calls).toEqual([['set_order_costs', { p_rows: rows }]]);
    expect(await O.createStore({ client: client({ error: { code: '42501', message: 'Only the owner and administrators can save order costs.' } }) }).save(rows)).toMatchObject({ ok: false, message: 'Only the owner and administrators can save order costs.' });
    calls.length = 0;
    expect((await O.createStore({ client: client({ data: {} }) }).save([{ order_id: 'x', fee_cents: 1, fee_source: 'etsy' }, { order_id: id(11), fee_cents: -1, fee_source: 'etsy' }, null])).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

async function seed(page, backend) {
  await page.clock.setFixedTime(new Date('2026-11-24T16:00:00Z'));
  backend.tables.orders = [
    { id: id(11), order_number: '3000000001', channel: 'etsy', source: 'etsy', status: 'paid', subtotal: 27, shipping_total: 0, tax_total: 0, total: 27, placed_at: '2026-11-12T15:00:00Z', deleted_at: null },
    { id: id(12), order_number: 'HE-1002', channel: 'shopify', source: 'shopify', status: 'paid', subtotal: 30, shipping_total: 5, tax_total: 0, total: 35, placed_at: '2026-11-13T15:00:00Z', deleted_at: null }];
  backend.tables.order_items = [
    { id: id(101), order_id: id(11), sku: 'A', product_name: 'SYN Lavender oil', quantity: 1, unit_price: 27, line_total: 27 },
    { id: id(102), order_id: id(12), sku: 'A', product_name: 'SYN Lavender oil', quantity: 2, unit_price: 15, line_total: 30 }];
  backend.tables.products = [{ id: id(1), sku: 'A', name: 'SYN Lavender oil', cost: 4 }];
  backend.tables.purchase_order_items = [];
  backend.tables.order_costs = [];
  await page.addInitScript(() => { try { localStorage.setItem('he_real_profit', 'on'); localStorage.setItem('he_channel_money', 'on'); localStorage.setItem('he_order_costs', 'on'); localStorage.setItem('he_profit_estimates', JSON.stringify({ postage: 4, packaging: 1 })); } catch (e) {} });
}

test.describe('on Accounting, with the switch on', () => {
  test('Money per channel saves the real fees; Real profit then uses them and says how many', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await seed(page, backend);
    backend.rpc.set_order_costs = (body) => { backend.tables.order_costs = body.p_rows.map((r, i) => Object.assign({ id: 'c' + i }, r)); return { ok: true, saved: body.p_rows.length, unknown_orders: 0 }; };
    await login(page); await gotoPage(page, 'accountingPanel');
    const profit = page.locator('#realProfitHost');
    // estimates only: Etsy 2700 - 400 - (9.5% + 0.45 = 302) - 400 - 100 = 1498; Shopify 3500 - 800 - 132 - 400 - 100 = 2068
    await expect(profit.locator('[data-rpprofit]')).toHaveText('$35.66');
    await expect(profit.locator('[data-rpexact]')).toHaveText('Real figures: the fee of 0 and the postage of 0 of the 2 counted orders. The rest use your estimates.');
    const money = page.locator('#channelMoneyHost');
    await money.locator('#cmFile_etsy').setInputFiles(file('etsy.csv', ETSY));
    await money.getByRole('button', { name: 'Save the real fees of the Etsy report to their orders' }).click();
    await expect(money.locator('[data-cmmessage]')).toHaveText('Saved the real fee of 1 order. 1 in the report is not in the dashboard yet. Real profit now uses them.');
    const saves = backend.requests.filter(r => r.rpc === 'set_order_costs');
    expect(saves).toHaveLength(1);
    expect(saves[0].body.p_rows).toEqual([{ order_id: id(11), fee_cents: 269, fee_source: 'etsy', postage_cents: null, postage_source: null }]);
    // Real profit with the real Etsy fee: 2700 - 400 - 269 - 400 - 100 = 1531; total 1531 + 2068 = 3599
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'accountingPanel');
    await expect(page.locator('#realProfitHost [data-rpprofit]')).toHaveText('$35.99');
    await expect(page.locator('#realProfitHost [data-rpexact]')).toHaveText('Real figures: the fee of 1 and the postage of 0 of the 2 counted orders. The rest use your estimates.');
    // nothing was written except through the one database function
    expect(backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/')).map(r => r.method + ' ' + r.path)).toEqual([]);
  });

  test('a refusal says so and saves nothing; a failed read falls back to the estimates and says so', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await seed(page, backend);
    backend.rpc.set_order_costs = () => ({ __error: { status: 403, code: '42501', message: 'Only the owner and administrators can save order costs.' } });
    await page.route('**/rest/v1/order_costs?*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: 'Could not find the table' }) }));
    await login(page); await gotoPage(page, 'accountingPanel');
    await expect(page.locator('#realProfitHost [data-rpprofit]')).toHaveText('$35.66');
    await expect(page.locator('#realProfitHost [data-rpexact]')).toContainText('The real order costs could not be read');
    const money = page.locator('#channelMoneyHost');
    await money.locator('#cmFile_etsy').setInputFiles(file('etsy.csv', ETSY));
    await money.getByRole('button', { name: 'Save the real fees of the Etsy report to their orders' }).click();
    await expect(money.locator('[data-cmmessage]')).toHaveText('Only the owner and administrators can save order costs. Nothing was saved.');
  });
});

test('with the switch off (the default): no save button, no line, and the order costs are never asked for', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'run once');
  await seed(page, backend);
  await page.addInitScript(() => { try { localStorage.removeItem('he_order_costs'); } catch (e) {} });
  await login(page); await gotoPage(page, 'accountingPanel');
  await expect(page.locator('#realProfitHost [data-rpprofit]')).toHaveText('$35.66');
  await expect(page.locator('#realProfitHost [data-rpexact]')).toHaveCount(0);
  await page.locator('#channelMoneyHost #cmFile_etsy').setInputFiles(file('etsy.csv', ETSY));
  await expect(page.locator('#channelMoneyHost [data-cmchannel="etsy"]')).toHaveCount(1);
  await expect(page.locator('#channelMoneyHost [data-cmsave]')).toHaveCount(0);
  expect(backend.requests.filter(r => r.table === 'order_costs' && !(r.params || []).some(([k, v]) => k === 'limit' && v === '0')).length).toBe(0);   // (only the owner's install check on Feature Flags may ask, and it reads no rows)
});
