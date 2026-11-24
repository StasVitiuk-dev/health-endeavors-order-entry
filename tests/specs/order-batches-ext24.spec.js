// Batch on each order (owner, Nov 24: the batch is on a printed sticker; scanning
// it when packing keeps which batch went into which order, so a batch problem
// gives one list of orders). docs/ops/sql/drafts/54 holds the rules (local test:
// docs/ops/sql/local-test/order_batches_test.sh); this is the dashboard side,
// behind he_order_batches (a switch that saves real records, OFF).
// assets/scan/he-order-batches.js. Every value is made up.
const M = require('../../assets/scan/he-order-batches.js');
const L = require('../../assets/scan/he-batch-labels.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const id = (n) => '00000000-0000-4000-8000-0000000' + String(n).padStart(5, '0');

test.describe('the rules on the dashboard side (no browser)', () => {
  test('a scanned sticker and a typed number give the same batch; order numbers with and without #', ({}, ti) => {
    node(ti);
    expect(M.PREFIX).toBe(L.PREFIX);                                             // the stickers and the reader agree
    expect(M.lotFrom(L.payload('LOT-A').text)).toEqual({ ok: true, lot: 'LOT-A', reason: '' });
    expect(M.lotFrom('  LOT-A ')).toEqual({ ok: true, lot: 'LOT-A', reason: '' });
    expect(M.lotFrom('').reason).toContain('Scan the batch sticker');
    expect(M.lotFrom('x'.repeat(25)).ok).toBe(false);
    expect(M.lotFrom('café').ok).toBe(false);
    for (const junk of [null, undefined, {}, [], NaN]) expect(M.lotFrom(junk).ok).toBe(false);
    expect(M.orderNumbers('#1001')).toEqual(['#1001', '1001']);
    expect(M.orderNumbers(' 1001 ')).toEqual(['1001', '#1001']);
    for (const junk of ['', '   ', '#', null, undefined, {}]) expect(M.orderNumbers(junk)).toEqual([]);
    expect(['one', 'none', 'several', 'unchecked', 'other', null].map(M.word)).toEqual([
      'It matches a batch in stock.', 'Saved, but no batch in stock has this number. Check the sticker.',
      'Saved. Two products in stock share this batch number, so it is not linked to either.', 'Saved. This account cannot check batch numbers against stock.', 'Saved.', 'Saved.']);
  });

  test('who got a batch: one line per order, voided lines never count, junk ignored', ({}, ti) => {
    node(ti);
    const r = M.recallList([
      { order_id: id(1), quantity: 2, recorded_at: '2026-11-24T10:00:00Z' }, { order_id: id(1), quantity: 1, recorded_at: '2026-11-24T11:00:00Z' },
      { order_id: id(2), quantity: 4, recorded_at: '2026-11-23T09:00:00Z' }, { order_id: id(3), quantity: 9, recorded_at: '2026-11-24T12:00:00Z', voided_at: '2026-11-24T12:05:00Z' },
      null, 'x', { order_id: id(4), quantity: 'many' }, { quantity: 1 }],
    [{ id: id(1), order_number: '#1001', customer_name: 'SYNTHETIC Ada', placed_at: '2026-11-20T00:00:00Z' }, { id: id(2), order_number: '#1002' }, null]);
    expect(r).toMatchObject({ orders: 2, bottles: 7 });
    expect(r.lines.map(l => [l.order_number, l.quantity, l.customer_name])).toEqual([['#1001', 3, 'SYNTHETIC Ada'], ['#1002', 4, '']]);
    expect(M.recallList(null, null)).toEqual({ lines: [], orders: 0, bottles: 0 });
    expect(M.recallList([{ order_id: id(9), quantity: 1 }], []).lines[0].order_number).toBe('(order not readable)');
  });

  test('the store: what is sent, plain words when refused, nothing sent for nonsense', async ({}, ti) => {
    node(ti);
    const calls = [];
    const client = (res) => ({ rpc: async (n, a) => { calls.push([n, a]); return res; } });
    const ok = M.createStore({ client: client({ data: { ok: true, id: id(50), lot_number: 'LOT-A', quantity: 3, matched: 'one' } }) });
    expect(await ok.record(id(1), 'B-LOT-A', '2', 'scan')).toMatchObject({ ok: true, lot: 'LOT-A', quantity: 3, matched: 'one', message: 'It matches a batch in stock.' });
    expect(calls).toEqual([['record_order_batch', { p_order_id: id(1), p_lot_number: 'LOT-A', p_quantity: 2, p_source: 'scan' }]]);
    for (const [args, words] of [[['not-an-order', 'LOT-A', 1], 'Choose the order first'], [[id(1), '', 1], 'Scan the batch sticker'], [[id(1), 'LOT-A', 0], 'how many bottles'], [[id(1), 'LOT-A', 'two'], 'how many bottles'], [[id(1), 'LOT-A', 10001], 'how many bottles']])
      expect(await ok.record(...args), words).toMatchObject({ ok: false, message: expect.stringContaining(words) });
    expect(calls).toHaveLength(1);
    const refused = M.createStore({ client: client({ error: { code: '42501', message: 'Only an active team member can record a batch.' } }) });
    expect(await refused.record(id(1), 'LOT-A', 1)).toMatchObject({ ok: false, message: 'Only an active team member can record a batch.' });
    const missing = M.createStore({ client: client({ error: { code: 'PGRST202', message: 'Could not find the function public.record_order_batch' } }) });
    expect((await missing.record(id(1), 'LOT-A', 1)).message).toContain('not installed in the database yet');
    expect((await ok.voidRow(id(50), 'no')).message).toContain('Say why');
    expect(await M.createStore({ client: client({ data: { ok: true, already: false } }) }).voidRow(id(50), 'SYNTHETIC wrong bottle')).toEqual({ ok: true, already: false });
    expect(await M.createStore({ client: null }).record(id(1), 'LOT-A', 1)).toMatchObject({ ok: false });
    expect(await M.createStore({ client: client({}), enabled: false }).record(id(1), 'LOT-A', 1)).toMatchObject({ ok: false, off: true });
    expect(M.friendlyError(null)).toContain('no reason given');
    expect(M.friendlyError({ message: 'x'.repeat(5000) }).length).toBeLessThan(400);
  });
});

// a small stand-in for drafts/54 inside the mock database
function install(backend, opts) {
  const o = opts || {};
  backend.tables.orders = [
    { id: id(1), order_number: '#1001', customer_name: 'SYNTHETIC Ada', placed_at: '2026-11-20T15:00:00Z', status: 'paid', channel: 'shopify', total: 25, deleted_at: null },
    { id: id(2), order_number: '#1002', customer_name: 'SYNTHETIC Ben', placed_at: '2026-11-21T15:00:00Z', status: 'paid', channel: 'shopify', total: 50, deleted_at: null }];
  backend.tables.order_batches = [
    { id: id(60), order_id: id(2), lot_number: 'LOT-A', quantity: 2, recorded_at: '2026-11-22T10:00:00Z', voided_at: null, void_reason: null }];
  let n = 70;
  backend.rpc.record_order_batch = (b) => {
    if (o.refuse) return { __error: o.refuse };
    const rows = backend.tables.order_batches;
    let row = rows.find(r => r.order_id === b.p_order_id && r.lot_number.toLowerCase() === b.p_lot_number.toLowerCase() && !r.voided_at);
    if (row) row.quantity += b.p_quantity;
    else { row = { id: id(n++), order_id: b.p_order_id, lot_number: b.p_lot_number, quantity: b.p_quantity, recorded_at: '2026-11-24T12:00:00Z', voided_at: null, void_reason: null }; rows.push(row); }
    return { ok: true, id: row.id, lot_number: row.lot_number, quantity: row.quantity, matched: o.matched || 'one', product_id: null };
  };
  backend.rpc.void_order_batch = (b) => {
    const row = backend.tables.order_batches.find(r => r.id === b.p_id);
    if (!row) return { __error: { status: 400, code: 'P0002', message: 'That row does not exist.' } };
    if (row.voided_at) return { ok: true, already: true, id: row.id };
    row.voided_at = '2026-11-24T12:30:00Z'; row.void_reason = b.p_reason;
    return { ok: true, already: false, id: row.id };
  };
}
const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_order_batches', 'on'); } catch (e) {} });
const rpcCalls = (backend, name) => backend.requests.filter(r => r.rpc === name);

test.describe('on the Orders page', () => {
  test('switch off (as shipped): no section and nothing asked', async ({ page, backend }) => {
    install(backend);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    await expect(page.locator('#orderBatchesHost')).toHaveCount(0);
    // (the owner's Feature Flags page asks once, reading no rows, whether the step is installed: limit=0)
    expect(backend.requests.filter(r => r.table === 'order_batches' && !r.params.some(([k, v]) => k === 'limit' && v === '0'))).toEqual([]);
    expect(backend.requests.filter(r => r.rpc === 'record_order_batch' || r.rpc === 'void_order_batch')).toEqual([]);
  });

  test('find the order, scan two bottles of one batch and one of another; then the list of who got a batch', async ({ page, backend }) => {
    install(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderBatchesHost');
    await expect(host.locator('.scanCardHead')).toHaveText('Batch on each order');
    await host.locator('#obOrder').fill('1001');
    await host.locator('form[data-obform="find"] button').click();
    await expect(host.locator('[data-oborder]')).toContainText('Order #1001 · SYNTHETIC Ada · ordered 2026-11-20');
    await expect(host.locator('[data-oborder]')).toContainText('No batch is recorded on this order yet');
    await expect(host.locator('#obLot')).toBeFocused();

    // a handheld scanner types the sticker text and presses Enter
    await host.locator('#obLot').fill(L.payload('LOT-A').text);
    await host.locator('#obLot').press('Enter');
    await expect(host.locator('[data-obmessage]')).toHaveText('Batch LOT-A: 1 bottle on order #1001. It matches a batch in stock.');
    await expect(host.locator('#obLot')).toBeFocused();
    await expect(host.locator('#obLot')).toHaveValue('');                         // ready for the next bottle
    await host.locator('#obLot').fill('B-LOT-A');
    await host.locator('#obLot').press('Enter');
    await expect(host.locator('[data-obmessage]')).toContainText('Batch LOT-A: 2 bottles on order #1001');
    await host.locator('#obLot').fill('lot-b');
    await host.locator('#obQty').fill('3');
    await host.locator('form[data-obform="record"] button').click();
    await expect(host.locator('[data-obmessage]')).toContainText('Batch lot-b: 3 bottles on order #1001');
    expect(rpcCalls(backend, 'record_order_batch').map(r => r.body)).toEqual([
      { p_order_id: id(1), p_lot_number: 'LOT-A', p_quantity: 1, p_source: 'scan' },
      { p_order_id: id(1), p_lot_number: 'LOT-A', p_quantity: 1, p_source: 'scan' },
      { p_order_id: id(1), p_lot_number: 'lot-b', p_quantity: 3, p_source: 'typed' }]);
    await expect(host.locator('tr[data-obrow]')).toHaveCount(2);

    await host.locator('#obRecall').fill('lot-a');
    await host.locator('form[data-obform="recall"] button').click();
    await expect(host.locator('[data-obrecalltotal]')).toHaveAttribute('data-obrecalltotal', '2/4');
    await expect(host.locator('[data-obrecalltotal]')).toHaveText('Batch lot-a: 2 orders, 4 bottles.');
    await expect(host.locator('tr[data-obrecallrow]')).toHaveCount(2);
    await expect(host.locator('tr[data-obrecallrow="' + id(2) + '"]')).toContainText('SYNTHETIC Ben');
    expect(backend.tableWrites()).toEqual([]);                                    // every change went through the database's own functions
  });

  test('a wrong scan is voided with a reason by the owner; it stays listed as void and leaves the recall list', async ({ page, backend }) => {
    install(backend);
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderBatchesHost');
    await host.locator('#obOrder').fill('#1002');
    await host.locator('#obOrder').press('Enter');
    const row = host.locator('tr[data-obrow="' + id(60) + '"]');
    await row.locator('button[data-obvoid]').click();
    await expect(row.locator('input[name="reason"]')).toBeFocused();
    await row.locator('input[name="reason"]').fill('no');
    await row.locator('button[type="submit"]').click();
    await expect(host.locator('[data-obmessage]')).toContainText('Say why');
    expect(rpcCalls(backend, 'void_order_batch')).toEqual([]);
    await row.locator('input[name="reason"]').fill('SYNTHETIC scanned the wrong bottle');
    await row.locator('button[type="submit"]').click();
    await expect(host.locator('[data-obmessage]')).toContainText('The line is void. It stays on the record');
    await expect(row).toContainText('Void: SYNTHETIC scanned the wrong bottle');
    await expect(row.locator('button')).toHaveCount(0);
    expect(rpcCalls(backend, 'void_order_batch').map(r => r.body)).toEqual([{ p_id: id(60), p_reason: 'SYNTHETIC scanned the wrong bottle' }]);
    await host.locator('#obRecall').fill('LOT-A');
    await host.locator('#obRecall').press('Enter');
    await expect(host.locator('[data-obrecalltotal]')).toHaveText('No order has batch LOT-A recorded.');
  });

  test('an employee records but gets no Void button; the "could not check stock" answer is said plainly', async ({ page, backend }) => {
    install(backend, { matched: 'unchecked' });
    backend.tables.profiles[0].role = 'employee';
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderBatchesHost');
    await host.locator('#obOrder').fill('1002');
    await host.locator('#obOrder').press('Enter');
    await expect(host.locator('tr[data-obrow]')).toHaveCount(1);
    await expect(host.locator('button[data-obvoid]')).toHaveCount(0);
    await host.locator('#obLot').fill('LOT-C');
    await host.locator('#obLot').press('Enter');
    await expect(host.locator('[data-obmessage]')).toContainText('Saved. This account cannot check batch numbers against stock.');
  });

  test('unknown order, nonsense batch, a refusal and "not installed" are said in plain words; the typed text stays', async ({ page, backend }) => {
    install(backend, { refuse: { status: 404, code: 'PGRST202', message: 'Could not find the function public.record_order_batch(p_lot_number, p_order_id) in the schema cache' } });
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderBatchesHost');
    await host.locator('form[data-obform="find"] button').click();
    await expect(host.locator('[data-obmessage]')).toHaveText('Type the order number first.');
    await host.locator('#obOrder').fill('9999');
    await host.locator('#obOrder').press('Enter');
    await expect(host.locator('[data-obmessage]')).toHaveText('No order has that number.');
    await host.locator('#obOrder').fill('1001');
    await host.locator('#obOrder').press('Enter');
    await host.locator('#obLot').fill('x'.repeat(30));
    await host.locator('#obLot').press('Enter');
    await expect(host.locator('[data-obmessage]')).toContainText('That is not a batch number');
    await expect(host.locator('#obLot')).toHaveValue('x'.repeat(30));
    expect(rpcCalls(backend, 'record_order_batch')).toEqual([]);
    await host.locator('#obLot').fill('LOT-A');
    await host.locator('#obLot').press('Enter');
    await expect(host.locator('[data-obmessage]')).toContainText('not installed in the database yet');
    await expect(host.locator('#obLot')).toHaveValue('LOT-A');
    await expect(page.locator('body')).not.toContainText('schema cache');
    await host.locator('#obRecall').fill('');
    await host.locator('form[data-obform="recall"] button').click();
    await expect(host.locator('[data-obmessage]')).toContainText('Scan the batch sticker or type the batch number');
  });

  test('the section fits the screen (no sideways scrolling)', async ({ page, backend }) => {
    install(backend);
    backend.tables.orders[1].customer_name = 'SYNTHETIC ' + 'very-long-customer-name-'.repeat(8);
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const host = page.locator('#orderBatchesHost');
    await host.locator('#obOrder').fill('1002');
    await host.locator('#obOrder').press('Enter');
    await host.locator('tr[data-obrow] button[data-obvoid]').click();
    await host.locator('#obRecall').fill('LOT-A');
    await host.locator('form[data-obform="recall"] button').click();
    await expect(host.locator('tr[data-obrecallrow]')).toHaveCount(1);
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth, out = [];
      document.querySelectorAll('#orderBatchesHost, #orderBatchesHost *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > w + 1) out.push(el.tagName + '.' + el.className + ' ' + Math.round(r.right) + '>' + w); });
      return out.concat(document.documentElement.scrollWidth > w + 1 ? ['page scrolls sideways'] : []);
    });
    expect(over).toEqual([]);
  });
});
