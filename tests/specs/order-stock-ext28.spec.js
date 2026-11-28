// Stock per order (Nov 28, launch promise 2: "stock goes down by exactly the amount sold").
// docs/ops/sql/drafts/76 holds the rules (local test: docs/ops/sql/local-test/order_stock_moves_test.sh,
// 88 checks against a real PostgreSQL); this is the dashboard side, behind he_order_stock (a switch
// that saves real records, OFF), assets/inventory/he-order-stock.js. Every value is made up.
const M = require('../../assets/inventory/he-order-stock.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const id = (n) => '00000000-0000-4000-8000-0000000' + String(n).padStart(5, '0');

test.describe('the rules on the dashboard side (no browser)', () => {
  test('summary: which lines took stock, the order\'s state, and what can be pressed', ({}, ti) => {
    node(ti);
    const lines = [{ id: 'a', sku: 'SYN-A', product_name: 'A', quantity: 2 }, { id: 'b', sku: 'SYN-B', product_name: 'B', quantity: 1 }, { id: 'c', sku: 'SYN-C', quantity: 0 }, null, 'x'];
    expect(M.summarize(lines, [])).toMatchObject({ state: 'none', bottles: 3, canTake: true, canGiveBack: false });
    expect(M.summarize(lines, [{ order_item_id: 'a', kind: 'take' }, { order_item_id: 'b', kind: 'take' }])).toMatchObject({ state: 'taken', canTake: false, canGiveBack: true });
    expect(M.summarize(lines, [{ order_item_id: 'a', kind: 'take' }])).toMatchObject({ state: 'partly', canTake: true, canGiveBack: true });
    const back = [{ order_item_id: 'a', kind: 'take' }, { order_item_id: 'b', kind: 'take' }, { order_item_id: 'a', kind: 'give_back' }, { order_item_id: 'b', kind: 'give_back' }];
    // a given-back order offers nothing more: the database refuses a second take of the same line anyway
    expect(M.summarize(lines, back)).toMatchObject({ state: 'given_back', canTake: false, canGiveBack: false });
    expect(M.summarize(null, null)).toMatchObject({ rows: [], state: 'none', canTake: false, canGiveBack: false });
  });

  test('the store: what is sent, the database\'s own words when refused, nothing sent for nonsense', async ({}, ti) => {
    node(ti);
    const calls = [];
    const client = (res) => ({ rpc: async (n, a) => { calls.push([n, a]); return res; } });
    const ok = M.createStore({ client: client({ data: { order: '#1001', kind: 'take', lines_changed: 2, lines_already_done: 0 } }) });
    expect(await ok.take(id(1))).toEqual({ ok: true, changed: 2, already: 0, order: '#1001' });
    expect(await ok.giveBack(id(1))).toMatchObject({ ok: true, changed: 2 });
    expect(calls).toEqual([['take_order_stock', { p_order_id: id(1) }], ['give_back_order_stock', { p_order_id: id(1) }]]);
    expect(await ok.take('not-an-order')).toMatchObject({ ok: false, message: 'Choose the order first.' });
    expect(calls).toHaveLength(2);
    for (const [err, words] of [
      [{ code: '23514', message: 'Order #1001: not enough in stock for SYN-A: needs 2, has 1. Nothing was changed. Count the shelf and correct the stock first.' }, 'not enough in stock for SYN-A: needs 2, has 1'],
      [{ code: '22023', message: 'Order #1001: no product has the SKU of these lines: SYN-GHOST — Ghost. Nothing was changed.' }, 'no product has the SKU'],
      [{ code: '42501', message: 'Only the Owner or an Administrator can change stock.' }, 'Only the Owner or an Administrator can change stock. Nothing was changed.'],
      [{ code: 'PGRST202', message: 'Could not find the function public.take_order_stock(p_order_id) in the schema cache' }, 'not installed in the database yet (drafts/76'],
      [{ message: 'TypeError: Failed to fetch' }, 'it is not known whether the stock changed']]) {
      const s = M.createStore({ client: client({ error: err }) });
      expect((await s.take(id(1))).message, words).toContain(words);
    }
    expect(await M.createStore({ client: client({}), enabled: false }).take(id(1))).toMatchObject({ ok: false, off: true });
  });

  test('finding an order: a live one first; a deleted one only when it is the only one, marked deleted', async ({}, ti) => {
    node(ti);
    const asked = [];
    const client = (rows) => ({ from: (t) => { const q = { t, f: [] };
      const chain = { select: (c) => { q.cols = c; return chain; }, in: (k, v) => { q.f.push(['in', k, v]); return chain; },
        is: (k, v) => { q.f.push(['is', k, v]); return chain; }, limit: async () => { asked.push(q); return { data: rows }; } };
      return chain; } });
    const live = { id: id(1), order_number: '#1001', deleted_at: null }, gone = { id: id(9), order_number: '#1001', deleted_at: '2026-11-28T08:00:00Z' };
    expect(await M.createStore({ client: client([gone, live]) }).findOrder('1001')).toEqual({ ok: true, order: Object.assign({}, live, { deleted: false }) });
    expect(await M.createStore({ client: client([gone]) }).findOrder('#1001')).toEqual({ ok: true, order: Object.assign({}, gone, { deleted: true }) });
    expect(await M.createStore({ client: client([live, Object.assign({}, live, { id: id(2) })]) }).findOrder('1001')).toMatchObject({ ok: false, message: expect.stringContaining('More than one order') });
    expect(await M.createStore({ client: client([gone, Object.assign({}, gone, { id: id(8) })]) }).findOrder('1001')).toMatchObject({ ok: false, message: expect.stringContaining('More than one order') });
    expect(await M.createStore({ client: client([]) }).findOrder('1001')).toMatchObject({ ok: false, message: 'No order has that number.' });
    expect(asked[0]).toMatchObject({ t: 'orders', f: [['in', 'order_number', ['1001', '#1001']]] });
    expect(asked[0].cols).toContain('deleted_at');
  });

  test('a second press while the first is on its way is not sent', async ({}, ti) => {
    node(ti);
    let release; const calls = [];
    const client = { rpc: (n, a) => { calls.push(n); return new Promise(r => { release = () => r({ data: { lines_changed: 1 } }); }); } };
    const s = M.createStore({ client });
    const first = s.take(id(1));
    expect(await s.take(id(1))).toMatchObject({ ok: false, busy: true });
    release();
    expect(await first).toMatchObject({ ok: true, changed: 1 });
    expect(calls).toEqual(['take_order_stock']);
  });
});

// a small stand-in for drafts/76 inside the mock database
function install(backend, opts) {
  const o = opts || {};
  backend.tables.orders = [
    { id: id(1), order_number: '#1001', customer_name: 'SYNTHETIC Ada', placed_at: '2026-11-27T15:00:00Z', status: 'paid', channel: 'shopify', total: 60, deleted_at: null },
    { id: id(2), order_number: '#1002', customer_name: 'SYNTHETIC Ben', placed_at: '2026-11-27T16:00:00Z', status: 'paid', channel: 'etsy', total: 20, deleted_at: null }];
  backend.tables.order_items = [
    { id: id(11), order_id: id(1), sku: 'SYN-LAV-8OZ', product_name: 'SYNTHETIC Lavender Body Lotion 8 oz', quantity: 2 },
    { id: id(12), order_id: id(1), sku: 'SYN-HONEY-4OZ', product_name: 'SYNTHETIC Honey Milk Cream 4 oz', quantity: 1 },
    { id: id(13), order_id: id(2), sku: 'SYN-GHOST', product_name: 'SYNTHETIC Unknown', quantity: 1 }];
  backend.tables.order_stock_moves = [];
  const run = (kind) => (b) => {
    if (o.refuse) return { __error: o.refuse };
    const ord = backend.tables.orders.find(x => x.id === b.p_order_id);
    if (ord && ord.deleted_at && kind === 'take') return { __error: { status: 404, code: 'P0002', message: 'That order does not exist or was deleted. Nothing was changed.' } };
    if (b.p_order_id === id(2) && kind === 'take') return { __error: { status: 400, code: '22023', message: 'Order #1002: no product has the SKU of these lines: SYN-GHOST — SYNTHETIC Unknown. Nothing was changed. Add the SKU to the product (or correct the order line) and try again.' } };
    let changed = 0, already = 0;
    for (const l of backend.tables.order_items.filter(x => x.order_id === b.p_order_id)) {
      const took = backend.tables.order_stock_moves.some(m => m.order_item_id === l.id && m.kind === 'take');
      if (kind === 'give_back' && !took) continue;
      if (backend.tables.order_stock_moves.some(m => m.order_item_id === l.id && m.kind === kind)) { already++; continue; }
      backend.tables.order_stock_moves.push({ order_id: b.p_order_id, order_item_id: l.id, kind, quantity: l.quantity, moved_at: '2026-11-28T09:00:00Z' });
      changed++;
    }
    return { order: '#1001', kind, lines_changed: changed, lines_already_done: already };
  };
  backend.rpc.take_order_stock = run('take');
  backend.rpc.give_back_order_stock = run('give_back');
}
const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_order_stock', 'on'); } catch (e) {} });
const rpcCalls = (backend, name) => backend.requests.filter(r => r.rpc === name);

test.describe('on the Orders page', () => {
  test('switch off (as shipped): no section and nothing asked', async ({ page, backend }) => {
    install(backend);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    await expect(page.locator('#orderStockHost')).toHaveCount(0);
    // (the owner's Feature Flags page may ask once, reading no rows, whether the step is installed: limit=0)
    expect(backend.requests.filter(r => r.table === 'order_stock_moves' && !r.params.some(([k, v]) => k === 'limit' && v === '0'))).toEqual([]);
    expect(backend.requests.filter(r => r.rpc === 'take_order_stock' || r.rpc === 'give_back_order_stock')).toEqual([]);
  });

  test('find an order, take its bottles off stock with two presses, once; then give them back once', async ({ page, backend }) => {
    install(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderStockHost');
    await expect(host.locator('.scanCardHead')).toHaveText('Stock per order');
    await host.locator('#osOrder').fill('1001');                                    // without the #
    await host.locator('#osOrder').press('Enter');
    const order = host.locator('[data-osorder]');
    await expect(order).toContainText('Order #1001 · SYNTHETIC Ada · Not taken off stock yet · 3 bottles');
    await expect(host.locator('tr[data-osline]')).toHaveCount(2);
    await expect(order).toHaveAttribute('data-osstate', 'none');
    const take = host.locator('button[data-os="take"]');
    await expect(take).toBeFocused();
    await take.click();
    await expect(take).toHaveText('Press again to take them off stock');
    expect(rpcCalls(backend, 'take_order_stock')).toEqual([]);                      // the first press changes nothing
    await take.click();
    await expect(host.locator('[data-osmessage]')).toHaveText('Taken off stock: 2 lines of order #1001. Recorded in the stock history.');
    await expect(order).toHaveAttribute('data-osstate', 'taken');
    await expect(host.locator('button[data-os="take"]')).toHaveCount(0);             // nothing left to take
    expect(rpcCalls(backend, 'take_order_stock').map(r => r.body)).toEqual([{ p_order_id: id(1) }]);
    const back = host.locator('button[data-os="back"]');
    await back.click(); await back.click();
    await expect(host.locator('[data-osmessage]')).toHaveText('Given back to stock: 2 lines of order #1001. Recorded in the stock history.');
    await expect(order).toHaveAttribute('data-osstate', 'given_back');
    await expect(host.locator('button[data-os]')).toHaveCount(0);
    expect(rpcCalls(backend, 'give_back_order_stock')).toHaveLength(1);
    expect(backend.tableWrites()).toEqual([]);                                      // every change went through the database's own functions
    expect(await host.evaluate(unnamedControls)).toEqual([]);
  });

  test('while the database answers slowly, the button says so, is disabled, and more presses send nothing', async ({ page, backend }) => {
    install(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    let release;
    const gate = new Promise(r => { release = r; });
    await page.route('**/rest/v1/rpc/take_order_stock', async (route) => { await gate; await route.fallback(); });
    const host = page.locator('#orderStockHost');
    await host.locator('#osOrder').fill('1001');
    await host.locator('#osOrder').press('Enter');
    const take = host.locator('button[data-os="take"]');
    await take.click();                                                              // arms
    await take.click();                                                              // sends
    await expect(take).toHaveText('Taking them off stock…');
    await expect(take).toBeDisabled();
    await take.click({ force: true }); await take.click({ force: true });            // impatient presses
    release();
    await expect(host.locator('[data-osmessage]')).toHaveText('Taken off stock: 2 lines of order #1001. Recorded in the stock history.');
    expect(rpcCalls(backend, 'take_order_stock')).toHaveLength(1);
  });

  test('an unknown SKU, an unknown order and "not installed" are said in plain words', async ({ page, backend }) => {
    install(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderStockHost');
    await host.locator('form[data-osform="find"] button').click();
    await expect(host.locator('[data-osmessage]')).toHaveText('Type the order number first.');
    await host.locator('#osOrder').fill('9999');
    await host.locator('#osOrder').press('Enter');
    await expect(host.locator('[data-osmessage]')).toHaveText('No order has that number.');
    await host.locator('#osOrder').fill('#1002');
    await host.locator('#osOrder').press('Enter');
    await host.locator('button[data-os="take"]').click();
    await host.locator('button[data-os="take"]').click();
    await expect(host.locator('[data-osmessage]')).toContainText('no product has the SKU of these lines: SYN-GHOST');
    await expect(host.locator('[data-osorder]')).toHaveAttribute('data-osstate', 'none');
    expect(backend.tables.order_stock_moves).toEqual([]);
    backend.rpc.take_order_stock = () => ({ __error: { status: 404, code: 'PGRST202', message: 'Could not find the function public.take_order_stock(p_order_id) in the schema cache' } });
    await host.locator('button[data-os="take"]').click();
    await host.locator('button[data-os="take"]').click();
    await expect(host.locator('[data-osmessage]')).toContainText('Stock per order is not installed in the database yet');
  });

  test('a deleted order that took bottles can give them back, and is never offered to take', async ({ page, backend }) => {
    install(backend);
    backend.tables.orders[0].deleted_at = '2026-11-28T08:00:00Z';                     // a duplicate import, removed
    backend.tables.order_stock_moves.push({ order_id: id(1), order_item_id: id(11), kind: 'take', quantity: 2, moved_at: '2026-11-28T07:00:00Z' });
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderStockHost');
    await host.locator('#osOrder').fill('1001');
    await host.locator('#osOrder').press('Enter');
    const order = host.locator('[data-osorder]');
    await expect(order).toContainText('Order #1001 (deleted) · SYNTHETIC Ada · Partly taken off stock');
    await expect(host.locator('[data-osdeleted]')).toContainText('It can never take bottles off stock');
    await expect(host.locator('button[data-os="take"]')).toHaveCount(0);              // one line is still "not yet", but a deleted order never takes
    const back = host.locator('button[data-os="back"]');
    await back.click(); await back.click();
    await expect(host.locator('[data-osmessage]')).toContainText('Given back to stock: 1 line');
    await expect(host.locator('button[data-os]')).toHaveCount(0);
    expect(rpcCalls(backend, 'take_order_stock')).toEqual([]);
    expect(rpcCalls(backend, 'give_back_order_stock')).toHaveLength(1);
  });

  for (const scheme of ['light', 'dark']) {
    test(`controls are named and text meets AA contrast (${scheme}), before and after taking stock`, async ({ page, backend }, ti) => {
      test.skip(ti.project.name !== 'desktop', 'colours; run once');
      install(backend);
      await page.emulateMedia({ colorScheme: scheme });
      await on(page);
      await login(page);
      await gotoPage(page, 'ordersPanel');
      const host = page.locator('#orderStockHost');
      await host.locator('#osOrder').fill('1001');
      await host.locator('#osOrder').press('Enter');
      await expect(host.locator('tr[data-osline]')).toHaveCount(2);
      expect(await host.evaluate(unnamedControls)).toEqual([]);
      expect(await host.evaluate(contrastFailures)).toEqual([]);
      const take = host.locator('button[data-os="take"]');
      await take.click(); await take.click();
      await expect(host.locator('[data-osmessage]')).toContainText('Taken off stock');
      expect(await host.evaluate(contrastFailures)).toEqual([]);
    });
  }

  test('an employee sees the card but cannot change stock', async ({ page, backend }) => {
    install(backend);
    backend.tables.profiles[0].role = 'employee';
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderStockHost');
    await expect(host).toContainText('Only the owner or an administrator can change stock.');
    await expect(host.locator('#osOrder')).toHaveCount(0);
  });

  test('the section fits the screen (no sideways scrolling)', async ({ page, backend }) => {
    install(backend);
    backend.tables.orders[0].customer_name = 'SYNTHETIC ' + 'very-long-customer-name-'.repeat(8);
    backend.tables.order_items[0].product_name = 'SYNTHETIC ' + 'Very Long Product Name '.repeat(6);
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderStockHost');
    await host.locator('#osOrder').fill('1001');
    await host.locator('#osOrder').press('Enter');
    await expect(host.locator('tr[data-osline]')).toHaveCount(2);
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth, out = [];
      document.querySelectorAll('#orderStockHost, #orderStockHost *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > w + 1) out.push(el.tagName + '.' + el.className); });
      return out.concat(document.documentElement.scrollWidth > w + 1 ? ['page scrolls sideways'] : []);
    });
    expect(over).toEqual([]);
  });
});
