// Real profit (owner, Nov 24, gap 5): profit per order, per product and per sales
// channel after product cost, platform fees, postage and packaging, on Accounting
// behind he_real_profit (OFF, on Feature Flags). assets/reports/he-profit.js.
// Reads only; the estimates are kept in this browser. Every value is made up.
const P = require('../../assets/reports/he-profit.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const id = (n) => '00000000-0000-4000-8000-0000000' + String(n).padStart(5, '0');
const PRODUCTS = [{ id: id(1), sku: 'LAV-30', name: 'Lavender oil 30ml', cost: 4 }, { id: id(2), sku: 'ROSE-30', name: 'Rose oil 30ml', cost: null }];
const PO_LINES = [
  { product_id: id(1), landed_unit_cost: 5, quantity_received: 10, created_at: '2026-10-01T10:00:00Z' },
  { product_id: id(1), landed_unit_cost: 3.5, quantity_received: 10, created_at: '2026-11-01T10:00:00Z' },
  { product_id: id(1), landed_unit_cost: 1, quantity_received: 0, created_at: '2026-11-05T10:00:00Z' }];   // not received: ignored
const ORDERS = [
  { id: id(11), order_number: 'HE-1001', channel: 'shopify', source: 'shopify', status: 'paid', subtotal: 30, shipping_total: 5, tax_total: 2.4, total: 37.4, placed_at: '2026-11-10T15:00:00Z', deleted_at: null },
  { id: id(12), order_number: 'AMZ-1', channel: 'amazon', source: 'amazon', status: 'paid', subtotal: 20, shipping_total: 0, tax_total: 0, total: 20, placed_at: '2026-11-11T15:00:00Z', deleted_at: null },
  { id: id(13), order_number: 'HE-1002', channel: 'shopify', source: 'shopify', status: 'paid', subtotal: 25, shipping_total: 0, tax_total: 0, total: 25, placed_at: '2026-11-12T15:00:00Z', deleted_at: null },
  { id: id(14), order_number: 'HE-1003', channel: 'shopify', source: 'shopify', status: 'cancelled', subtotal: 99, shipping_total: 0, tax_total: 0, total: 99, placed_at: '2026-11-13T15:00:00Z', deleted_at: null }];
const ITEMS = [
  { order_id: id(11), sku: 'LAV-30', product_name: 'Lavender oil 30ml', quantity: 2, unit_price: 15, line_total: 30 },
  { order_id: id(12), sku: 'LAV-30', product_name: 'Lavender oil 30ml', quantity: 1, unit_price: 20, line_total: 20 },
  { order_id: id(13), sku: 'ROSE-30', product_name: 'Rose oil 30ml', quantity: 1, unit_price: 25, line_total: 25 },
  { order_id: id(14), sku: 'LAV-30', product_name: 'Lavender oil 30ml', quantity: 9, unit_price: 11, line_total: 99 }];

test.describe('the arithmetic (no browser)', () => {
  test('profit per order, channel and product; missing costs are never guessed; cancelled left out', ({}, ti) => {
    node(ti);
    const r = P.compute({ products: PRODUCTS, poLines: PO_LINES, orders: ORDERS, items: ITEMS, postagePerOrder: 4, packagingPerOrder: 1 });
    // HE-1001: 3500 sales (tax not counted) - 700 cost (2 x newest received landed 3.50) - 132 fee (2.9% + 0.30) - 400 - 100
    const a = r.orders.find(o => o.order === 'HE-1001');
    expect(a).toMatchObject({ revenue: 3500, productCost: 700, fee: 132, postage: 400, packaging: 100, profit: 2168, missing: [] });
    expect(r.orders.find(o => o.order === 'AMZ-1')).toMatchObject({ fee: 300, profit: 850 });
    const rose = r.orders.find(o => o.order === 'HE-1002');
    expect(rose.profit).toBeNull();
    expect(rose.missing).toEqual(['product cost']);
    expect(r.leftOut).toEqual([{ id: id(14), order: 'HE-1003', status: 'cancelled' }]);
    expect(r.totals).toMatchObject({ orders: 3, complete: 2, missing: 1, revenue: 5500, profit: 3018, margin: 54.9 });
    expect(r.missingWhy).toEqual({ 'product cost': 1 });
    expect(r.channels.map(c => [c.channel, c.orders, c.complete, c.profit, c.margin])).toEqual([['shopify', 2, 1, 2168, 61.9], ['amazon', 1, 1, 850, 42.5]]);
    expect(r.products).toEqual([{ product: 'Lavender oil 30ml', units: 3, revenue: 5500, profit: 3018, margin: 54.9 }]);
  });

  test('a blank estimate is unknown, never zero', ({}, ti) => {
    node(ti);
    expect(P.feeFor('tiktok', 1000, P.DEFAULT_FEES)).toBeNull();
    expect(P.feeFor('shopify', 1000, { shopify: { percent: 2.9, perOrder: null } })).toBeNull();
    expect(P.feeFor('manual', 1000, P.DEFAULT_FEES)).toBe(0);
    const r = P.compute({ products: PRODUCTS, poLines: PO_LINES, orders: ORDERS, items: ITEMS });   // no postage, no packaging
    expect(r.totals.complete).toBe(0);
    expect(r.totals.profit).toBe(0);
    expect(r.missingWhy).toMatchObject({ 'postage estimate': 3, 'packaging estimate': 3 });
    const tik = P.compute({ products: PRODUCTS, orders: [{ id: id(21), channel: 'TikTok Shop', status: 'paid', subtotal: 10 }], items: [{ order_id: id(21), sku: 'LAV-30', quantity: 1, line_total: 10 }], postagePerOrder: 1, packagingPerOrder: 0 });
    expect(tik.orders[0]).toMatchObject({ channel: 'tiktok', profit: null, missing: ['fee estimate'] });
  });

  test('malformed rows do not break it; partly refunded orders are marked to check', ({}, ti) => {
    node(ti);
    const r = P.compute({ products: [null, {}, 'x'], poLines: [null, { product_id: id(1) }], orders: [null, {}, { id: id(31), status: 'partially_refunded', total: 12, tax_total: 2 }, { id: id(32), deleted_at: '2026-11-01' }], items: [null, { order_id: id(31), sku: 'nope', quantity: 'abc' }], postagePerOrder: 0, packagingPerOrder: 0 });
    expect(r.orders).toHaveLength(1);
    expect(r.orders[0]).toMatchObject({ revenue: 1000, profit: null, check: 'partly refunded: check the refund' });
    expect(r.orders[0].missing).toContain('product cost');
    expect(P.compute(undefined).totals).toMatchObject({ orders: 0, profit: 0, margin: null });
  });

  test('the estimates form is checked', ({}, ti) => {
    node(ti);
    const ok = P.checkEstimates({ shopify_percent: '2.9', shopify_per: '0.30', tiktok_percent: '', postage: '4.5', packaging: ' 0.8 ' });
    expect(ok.ok).toBe(true);
    expect(ok.fees.shopify).toEqual({ percent: 2.9, perOrder: 0.3 });
    expect(ok.fees.tiktok).toEqual({ percent: null, perOrder: null });
    expect([ok.postage, ok.packaging]).toEqual([4.5, 0.8]);
    const bad = P.checkEstimates({ amazon_percent: '60', etsy_per: '-1', postage: 'abc', packaging: '101' });
    expect(bad.ok).toBe(false);
    expect(bad.problems).toEqual(['Amazon: the percent must be between 0 and 50.', 'Etsy: the amount per order must be between $0 and $50.',
      'The postage estimate must be between $0 and $100 per order.', 'The packaging estimate must be between $0 and $100 per order.']);
  });
});

async function seed(page, backend) {
  await page.clock.setFixedTime(new Date('2026-11-24T16:00:00Z'));
  backend.tables.orders = ORDERS.map(o => Object.assign({}, o));
  backend.tables.order_items = ITEMS.map((o, i) => Object.assign({ id: id(100 + i) }, o));
  backend.tables.products = PRODUCTS.map(o => Object.assign({}, o));
  backend.tables.purchase_order_items = PO_LINES.map((o, i) => Object.assign({ id: id(200 + i) }, o));
}

test.describe('on Accounting', () => {
  test('off by default: the page is unchanged', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await seed(page, backend);
    await login(page); await gotoPage(page, 'accountingPanel');
    await expect(page.locator('#acctStats')).toBeVisible();
    await expect(page.locator('#realProfitHost')).toHaveCount(0);
    expect(backend.requests.filter(r => r.table === 'purchase_order_items')).toEqual([]);
  });

  test('on: totals, channels, products, the missing count; estimates checked and saved here; reads only', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await seed(page, backend);
    await page.addInitScript(() => { try { localStorage.setItem('he_real_profit', 'on'); localStorage.setItem('he_profit_estimates', JSON.stringify({ postage: 4, packaging: 1 })); } catch (e) {} });
    await login(page); await gotoPage(page, 'accountingPanel');
    const host = page.locator('#realProfitHost');
    await expect(host.locator('h3')).toHaveText('Real profit');
    // right under the Accounting totals
    expect(await page.evaluate(() => document.getElementById('acctStats').nextElementSibling.id)).toBe('realProfitHost');
    await expect(host.locator('[data-rpprofit]')).toHaveText('$30.18');
    await expect(host.locator('[data-rptotals]')).toContainText('Profit (2 of 3 orders)');
    await expect(host.locator('[data-rptotals]')).toContainText('54.9%');
    await expect(host.locator('[data-rpmissing]')).toHaveText('1 order is not counted in the profit: 1 with a product with no cost.');
    await expect(host.locator('tr[data-rpchannel="shopify"]')).toContainText('1 of 2');
    await expect(host.locator('tr[data-rpchannel="amazon"]')).toContainText('$8.50');
    await expect(host.locator('tr[data-rpproduct]')).toHaveCount(1);
    await expect(host).toContainText('1 cancelled or refunded order is left out.');
    // the period
    await host.getByRole('button', { name: 'Last month' }).click();
    await expect(host.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true');
    await expect(host.locator('.empty')).toHaveText('No orders in this period.');
    await host.getByRole('button', { name: 'This month' }).click();
    await expect(host.locator('[data-rpprofit]')).toHaveText('$30.18');
    // estimates: a wrong value is refused and nothing is saved
    await host.getByRole('button', { name: 'Fee and postage estimates' }).click();
    await host.getByLabel('Postage per order ($)').fill('abc');
    await host.getByRole('button', { name: 'Save estimates' }).click();
    await expect(host.locator('[data-rpmessage]')).toHaveText('The postage estimate must be between $0 and $100 per order.');
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_profit_estimates'))).postage).toBe(4);
    await host.getByLabel('Postage per order ($)').fill('5');
    await host.getByRole('button', { name: 'Save estimates' }).click();
    await expect(host.locator('[data-rpmessage]')).toHaveText('Estimates saved in this browser.');
    await expect(host.locator('[data-rpprofit]')).toHaveText('$28.18');   // one dollar more postage on each of the 2 counted orders
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_profit_estimates'))).postage).toBe(5);
    expect(backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/')).map(r => r.method + ' ' + r.path)).toEqual([]);
  });

  test('a read that fails says so instead of showing $0', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await seed(page, backend);
    await page.route('**/rest/v1/purchase_order_items?*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) }));
    await page.addInitScript(() => { try { localStorage.setItem('he_real_profit', 'on'); } catch (e) {} });
    await login(page); await gotoPage(page, 'accountingPanel');
    await expect(page.locator('#realProfitHost [role="status"]')).toContainText('Profit could not be worked out just now');
    await expect(page.locator('#realProfitHost [data-rpprofit]')).toHaveCount(0);
  });

  test('readable in light and dark; named controls; fits a phone', async ({ page, backend }, ti) => {
    await seed(page, backend);
    await page.addInitScript(() => { try { localStorage.setItem('he_real_profit', 'on'); localStorage.setItem('he_profit_estimates', JSON.stringify({ postage: 4, packaging: 1 })); } catch (e) {} });
    await login(page);
    const check = (loc) => loc.evaluate((root, src) => (new Function('return ' + src)())(root), contrastFailures.toString());
    for (const scheme of ti.project.name === 'desktop' ? ['light', 'dark'] : ['light']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoPage(page, 'accountingPanel');
      await expect(page.locator('#realProfitHost [data-rpprofit]')).toBeVisible();
      const edit = page.locator('#realProfitHost [data-rp="edit"]');
      if ((await edit.getAttribute('aria-expanded')) !== 'true') await edit.click();
      await expect(page.locator('#realProfitHost form')).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      // the big numbers are the look's own gradient text in dark mode (transparent colour;
      // their contrast is checked in looks-ext22), so they are left out here, as there
      const gradient = await page.evaluate(() => [...document.querySelectorAll('#realProfitHost .stat .num')].filter(e => getComputedStyle(e).color === 'rgba(0, 0, 0, 0)').length);
      const found = await check(page.locator('#realProfitHost'));
      expect(gradient ? found.filter(x => !/^div\.num/.test(x)) : found, scheme).toEqual([]);
      expect(await page.locator('#realProfitHost').evaluate(unnamedControls), scheme).toEqual([]);
    }
    if (ti.project.name === 'iphone') expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
  });
});
