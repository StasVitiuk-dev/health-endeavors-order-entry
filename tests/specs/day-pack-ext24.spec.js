// The day pack (owner, Nov 24: "I want to be able to print backup for all day,
// clients list and everything when I need"). On Backups & Printouts (behind
// he_backups_page): choose a day, press Print, and get every order of that day
// with its items, the clients of the day and the totals. Read when Print is
// pressed; nothing is changed. assets/reports/he-day-pack.js. Every value is
// made up; window.print is replaced.
const D = require('../../assets/reports/he-day-pack.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const order = (n, extra) => Object.assign({ id: 'o-' + n, order_number: 'HE-' + (1000 + n), customer_name: 'SYNTHETIC client ' + n, customer_email: 'client' + n + '@example.test', status: 'paid', currency: 'USD', total: 10 * n,
  placed_at: '2026-11-24T' + String(10 + n).padStart(2, '0') + ':00:00Z', deleted_at: null }, extra || {});
const item = (n, qty, name) => ({ id: 'i-' + n + '-' + name, order_id: 'o-' + n, sku: name.toUpperCase(), product_name: name, quantity: qty });

test.describe('the arithmetic (no browser)', () => {
  test('a day is a real calendar date; its limits are that day on the viewer\'s own calendar', ({}, ti) => {
    node(ti);
    expect(D.checkDay('2026-11-24')).toEqual({ ok: true, day: '2026-11-24', reason: '' });
    expect(D.checkDay(' 2028-02-29 ').ok).toBe(true);
    for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '1999-01-01', '2101-01-01']) expect(D.checkDay(bad)).toEqual({ ok: false, day: '', reason: 'That is not a real date.' });
    for (const bad of ['', '24/11/2026', 'today', null, undefined, 7, {}, []]) expect(D.checkDay(bad)).toEqual({ ok: false, day: '', reason: 'Choose a day.' });
    const b = D.bounds('2026-11-24');
    expect(new Date(b[0]).getTime()).toBe(new Date(2026, 10, 24).getTime());
    expect(new Date(b[1]).getTime()).toBe(new Date(2026, 10, 25).getTime());
    expect(D.bounds('nonsense')).toBeNull();
  });

  test('orders in time order with their items; one line per client; totals are exact and leave cancelled orders out', ({}, ti) => {
    node(ti);
    const p = D.build({ day: '2026-11-24', orders: [order(3), order(1), order(2, { customer_email: 'CLIENT1@example.test', customer_name: 'synthetic client 1' }), order(4, { status: 'cancelled' }),
      order(5, { total: null }), order(6, { deleted_at: '2026-11-24T20:00:00Z' }), order(7, { customer_name: null, customer_email: null, total: '7.25', currency: 'cad' })],
      items: [item(1, 2, 'Lavender oil'), item(1, 1, 'Rose oil'), item(3, 4, 'Lavender oil'), item(4, 9, 'Rose oil'), item(99, 1, 'Nobody')] });
    expect(p.orders.map(o => o.number)).toEqual(['HE-1001', 'HE-1002', 'HE-1003', 'HE-1004', 'HE-1005', 'HE-1007']);       // the deleted one is not there
    expect(p.orders[0].lines).toEqual([{ qty: 2, name: 'Lavender oil', sku: 'LAVENDER OIL' }, { qty: 1, name: 'Rose oil', sku: 'ROSE OIL' }]);
    expect(p.orders[1].lines).toEqual([]);
    // client 1 placed two orders (the email is the same whatever its capitals)
    expect(p.clients.map(c => [c.name, c.email, c.orders])).toEqual([
      ['No name on the order', '', ['HE-1007']],
      ['SYNTHETIC client 1', 'client1@example.test', ['HE-1001', 'HE-1002']],
      ['SYNTHETIC client 3', 'client3@example.test', ['HE-1003']],
      ['SYNTHETIC client 4', 'client4@example.test', ['HE-1004']],
      ['SYNTHETIC client 5', 'client5@example.test', ['HE-1005']]]);
    // 10 + 20 + 30 dollars; the cancelled 40 is not added; the order with no amount is counted as "no amount"
    expect(p.totals).toEqual({ orders: 6, counted: 5, notCounted: 1, noAmount: 1, units: 7, byCurrency: [{ currency: 'CAD', cents: 725 }, { currency: 'USD', cents: 6000 }], clients: 5 });
  });

  test('an empty day and odd input give an empty pack, never an error', ({}, ti) => {
    node(ti);
    const empty = { orders: 0, counted: 0, notCounted: 0, noAmount: 0, units: 0, byCurrency: [], clients: 0 };
    expect(D.build({ day: '2026-11-24', orders: [], items: [] })).toEqual({ day: '2026-11-24', orders: [], clients: [], totals: empty });
    for (const junk of [null, undefined, 'x', 7, [], {}, { orders: 'x', items: 7 }, { orders: [null, 'x', 7, {}, { id: null }], items: [null, 'x', {}, { order_id: null }] }]) expect(D.build(junk).totals).toEqual(empty);
    const odd = D.build({ day: '2026-11-24', orders: [{ id: 1, order_number: '  A   B ', total: 'abc', status: 'PAID', placed_at: 7, customer_name: 'x'.repeat(500) }], items: [{ order_id: 1, quantity: -3, product_name: '' , sku: '' }] });
    expect(odd.orders[0]).toMatchObject({ number: 'A B', totalCents: null, status: 'paid', placedAt: null, counted: true });
    expect(odd.orders[0].customer).toHaveLength(120);
    expect(odd.orders[0].lines).toEqual([{ qty: 0, name: 'Item', sku: '' }]);
  });
});

// the day pack's own read of the orders: its columns, and both ends of the day
const packReads = (backend) => backend.requests.filter(r => r.table === 'orders' && r.method === 'GET'
  && r.params.some(([k, v]) => k === 'select' && v === 'id,order_number,customer_name,customer_email,status,currency,total,placed_at,deleted_at')
  && r.params.some(([k, v]) => k === 'placed_at' && String(v).startsWith('lt.')));

test.describe('the client list (no browser)', () => {
  test('every client once: counted orders, exact totals, first and last order; cancelled orders are not counted but the client stays', ({}, ti) => {
    node(ti);
    const L = D.clientList([order(1), order(2, { customer_email: 'CLIENT1@example.test', customer_name: 'synthetic client 1', placed_at: '2026-11-20T09:00:00Z' }), order(3, { status: 'refunded' }),
      order(4, { customer_name: null, customer_email: null, total: null }), order(5, { deleted_at: '2026-11-24T20:00:00Z' }), order(6, { currency: 'cad', total: '7.25', customer_email: 'client1@example.test' }), null, 'x']);
    expect(L.totals).toEqual({ clients: 3, orders: 5, counted: 4, repeat: 1 });
    expect(L.clients).toEqual([
      { name: 'No name on the order', email: '', orders: 1, notCounted: 0, first: '2026-11-24T14:00:00Z', last: '2026-11-24T14:00:00Z', byCurrency: [] },
      { name: 'SYNTHETIC client 1', email: 'client1@example.test', orders: 3, notCounted: 0, first: '2026-11-20T09:00:00Z', last: '2026-11-24T16:00:00Z', byCurrency: [{ currency: 'CAD', cents: 725 }, { currency: 'USD', cents: 3000 }] },
      { name: 'SYNTHETIC client 3', email: 'client3@example.test', orders: 0, notCounted: 1, first: '2026-11-24T13:00:00Z', last: '2026-11-24T13:00:00Z', byCurrency: [] }]);
    for (const junk of [null, undefined, 'x', 7, {}, [null, 'x', {}, { id: null }]]) expect(D.clientList(junk)).toEqual({ clients: [], totals: { clients: 0, orders: 0, counted: 0, repeat: 0 } });
  });

  test('the periods: 30, 90 and 365 days back from now, or everything; an unknown choice is 90 days', ({}, ti) => {
    node(ti);
    const now = Date.parse('2026-11-24T18:00:00Z');
    expect(D.PERIODS.map(p => p.key)).toEqual(['30', '90', '365', 'all']);
    expect(D.periodBounds('30', now)).toEqual({ key: '30', name: 'The last 30 days', from: '2026-10-25T18:00:00.000Z', to: '2026-11-24T18:00:00.000Z' });
    expect(D.periodBounds('all', now)).toEqual({ key: 'all', name: 'All orders', from: null, to: '2026-11-24T18:00:00.000Z' });
    for (const junk of ['zzz', null, undefined, 7, {}]) expect(D.periodBounds(junk, now).key).toBe('90');
    // a time no calendar can hold never throws: it is read as now
    for (const bad of [1e300, -1e300, 8640000000000001, Number.MAX_SAFE_INTEGER, NaN, Infinity, 'x', null]) expect(() => D.periodBounds('30', bad)).not.toThrow();
    expect(Math.abs(Date.parse(D.periodBounds('all', 1e300).to) - Date.now())).toBeLessThan(60000);
  });
});

async function open(page, backend) {
  await page.clock.setFixedTime(new Date('2026-11-24T18:00:00Z'));
  backend.tables.daily_reports = [{ id: 'dr-1', report_date: '2026-11-24', orders_count: 3, revenue: '60.00', currency: 'USD', new_inquiries_count: 1, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 4, ai_cost: 0.25, emailed: true }];
  backend.tables.sop_documents = [];
  backend.tables.orders = [order(1), order(2, { customer_email: 'client1@example.test', customer_name: 'SYNTHETIC client 1' }), order(3), order(4, { status: 'cancelled' }),
    order(8, { placed_at: '2026-11-20T15:00:00Z' })];                                                   // another day: not in the pack
  backend.tables.order_items = [item(1, 2, 'Lavender oil'), item(3, 4, 'Rose oil'), item(8, 1, 'Other day')];
  await page.addInitScript(() => { try { localStorage.setItem('he_backups_page', 'on'); } catch (e) {} window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await login(page);
  await gotoPage(page, 'backupsPanel');
  await expect(page.locator('#backupsPanel h2')).toHaveText('Backups & Printouts');
}

test.describe('on Backups & Printouts', () => {
  test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

  test('opening the page reads no orders; the day starts as today', async ({ page, backend }) => {
    await open(page, backend);
    await expect(page.locator('#bkDay')).toHaveValue('2026-11-24');
    await expect(page.locator('[data-bkdaypack] h3')).toHaveText(['Day pack', 'Client list']);
    expect(await page.evaluate(() => window.__printed || 0)).toBe(0);
    expect(packReads(backend)).toEqual([]);
  });

  test('Print the day pack: the day\'s orders with items, its clients once each, exact totals, the saved recap; nothing is written', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await open(page, backend);
    const before = backend.requests.length;
    await page.getByRole('button', { name: 'Print the day pack' }).click();
    await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBe(1);
    await expect(page.locator('#backupsPanel [data-bkmessage]')).toHaveText('Opened the day pack for 2026-11-24 for printing: 4 orders, 3 clients.');
    const doc = page.locator('#invoicePrintHost');
    const first = doc.locator('[data-printdaypack="2026-11-24"]');
    await expect(first).toContainText('Day pack, 2026-11-24');
    await expect(first.locator('tr', { hasText: 'Orders placed this day' })).toContainText('4');
    await expect(first.locator('tr', { hasText: 'Order totals' })).toContainText('$60.00');          // 10 + 20 + 30; the cancelled 40 is not added
    await expect(first.locator('tr', { hasText: 'Bottles and other items sold' })).toContainText('6');
    await expect(first.locator('tr', { hasText: 'Cancelled or refunded' })).toContainText('1');
    await expect(first).toContainText('Exact figures, added up from the orders listed in this pack. Nothing is estimated.');
    await expect(first).toContainText('The saved nightly recap of this day');
    const orders = doc.locator('[data-printdayorders="4"]');
    await expect(orders.locator('tbody tr')).toHaveCount(4);
    await expect(orders.locator('tbody tr').first()).toContainText('HE-1001');
    await expect(orders.locator('tbody tr').first()).toContainText('2 × Lavender oil');
    await expect(orders.locator('tbody tr').first()).toContainText('5:00 AM');                          // 11:00 UTC on the Central calendar
    await expect(orders.locator('tbody tr').nth(1)).toContainText('no items saved');
    await expect(orders.locator('tbody tr').nth(3)).toContainText('cancelled');
    await expect(orders).not.toContainText('HE-1008');
    const clients = doc.locator('[data-printdayclients="3"]');
    await expect(clients.locator('tbody tr')).toHaveCount(3);
    await expect(clients.locator('tbody tr').first()).toContainText('HE-1001, HE-1002');
    await expect(clients).toContainText('This page holds customer names and email addresses. Keep it in the business folder.');
    // only reads: one read of the day's orders, by the viewer's calendar day; no table is written
    const made = backend.requests.slice(before);
    expect(made.filter(r => r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/')).map(r => r.method + ' ' + r.path)).toEqual([]);
    expect(packReads(backend)).toHaveLength(1);
    expect(packReads(backend)[0].params.filter(([k]) => k === 'placed_at').map(([, v]) => v).sort()).toEqual(['gte.2026-11-24T06:00:00.000Z', 'lt.2026-11-25T06:00:00.000Z']);
    expect(made.some(r => r.table === 'order_items' && r.params.some(([k, v]) => k === 'order_id' && v === 'in.(o-1,o-2,o-3,o-4)'))).toBe(true);
  });

  test('a day with no orders still prints (the paper says so); a day with no saved recap says that too', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await open(page, backend);
    await page.locator('#bkDay').fill('2026-11-10');
    await page.getByRole('button', { name: 'Print the day pack' }).click();
    await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBe(1);
    await expect(page.locator('#backupsPanel [data-bkmessage]')).toHaveText('Opened the day pack for 2026-11-10 for printing: 0 orders, 0 clients.');
    const doc = page.locator('#invoicePrintHost');
    await expect(doc.locator('[data-printdayorders="0"]')).toContainText('No orders were placed on this day.');
    await expect(doc.locator('[data-printdayclients="0"]')).toContainText('No clients on this day.');
    await expect(doc.locator('[data-printdaypack]')).toContainText('No nightly recap is saved for this day yet');
    await expect(doc.locator('[data-printdaypack] tr', { hasText: 'Order totals' })).toContainText('$0.00');
    expect(packReads(backend)).toHaveLength(1);
  });

  test('no day chosen: it asks for one and prints nothing; a failed read says so and prints nothing', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await open(page, backend);
    await page.locator('#bkDay').fill('');
    await page.getByRole('button', { name: 'Print the day pack' }).click();
    await expect(page.locator('#backupsPanel [data-bkmessage]')).toHaveText('Choose a day.');
    await expect(page.locator('#bkDay')).toBeFocused();
    await page.locator('#bkDay').fill('2026-11-24');
    await page.route('**/rest/v1/orders?*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'XX000', message: 'SYNTHETIC failure' }) }));
    await page.getByRole('button', { name: 'Print the day pack' }).click();
    await expect(page.locator('#backupsPanel [data-bkmessage]')).toContainText('The orders of 2026-11-24 could not be read');
    await expect(page.locator('#backupsPanel [data-bkmessage]')).toContainText('Nothing was printed.');
    expect(await page.evaluate(() => window.__printed || 0)).toBe(0);
  });

  test('Print the client list: every client once with exact totals; the period chosen decides which orders are read; nothing is written', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await open(page, backend);
    await expect(page.locator('#bkPeriod')).toHaveValue('90');
    const before = backend.requests.length;
    await page.getByRole('button', { name: 'Print the client list' }).click();
    await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBe(1);
    // the five made-up orders: client 1 twice, clients 3, 4 (cancelled) and 8
    await expect(page.locator('#backupsPanel [data-bkmessage]')).toHaveText('Opened the client list for printing: 4 clients from 5 orders.');
    const doc = page.locator('#invoicePrintHost [data-printclients="4"]');
    await expect(doc).toContainText('Client list, the last 90 days');
    await expect(doc).toContainText('4 clients · 4 counted orders · 1 ordered more than once.');
    const first = doc.locator('tbody tr').first();
    await expect(first).toContainText('SYNTHETIC client 1');
    await expect(first).toContainText('$30.00');                                   // 10 + 20
    await expect(first).toContainText('2026-11-24');
    await expect(doc.locator('tbody tr', { hasText: 'SYNTHETIC client 4' })).toContainText('0 (+1 cancelled)');
    await expect(doc).toContainText('This page holds customer names and email addresses.');
    const q = backend.requests.slice(before).filter(r => r.table === 'orders' && r.params.some(([k, v]) => k === 'placed_at' && String(v).startsWith('gte.')));
    expect(q).toHaveLength(1);
    expect(q[0].params.filter(([k]) => k === 'placed_at').map(([, v]) => v).sort()).toEqual(['gte.2026-08-26T18:00:00.000Z', 'lt.2026-11-24T18:00:00.000Z']);
    // "All orders" asks without a start
    await page.locator('#bkPeriod').selectOption('all');
    const mid = backend.requests.length;
    await page.getByRole('button', { name: 'Print the client list' }).click();
    await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBe(2);
    await expect(page.locator('#invoicePrintHost')).toContainText('Client list, all orders');
    const all = backend.requests.slice(mid).filter(r => r.table === 'orders' && r.params.some(([k, v]) => k === 'select' && v.includes('customer_email')));
    expect(all).toHaveLength(1);
    expect(all[0].params.filter(([k]) => k === 'placed_at').map(([, v]) => v)).toEqual(['lt.2026-11-24T18:00:00.000Z']);
    expect(backend.requests.slice(before).filter(r => r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/')).map(r => r.method + ' ' + r.path)).toEqual([]);
  });

  test('at phone size the day pack controls fit without sideways scrolling', async ({ page, backend }, ti) => {
    test.skip(ti.project.name === 'desktop', 'phone');
    await open(page, backend);
    await expect(page.getByRole('button', { name: 'Print the day pack' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});
