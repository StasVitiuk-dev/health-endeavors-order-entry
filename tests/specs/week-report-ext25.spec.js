// The weekly owner report (owner, Nov 24: "Weekly owner report, let's add it").
// On Backups & Printouts (behind he_backups_page), for the owner and administrators:
// one finished week, Monday to Sunday, on one page. Read when "Show the report" is
// pressed; nothing is changed. Home reminds until the newest week was opened.
// assets/reports/he-week-report.js. Every value is made up; window.print is replaced.
const W = require('../../assets/reports/he-week-report.js');
const F = require('../../assets/views/he-attention-feed.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const NOW = new Date(2026, 10, 25, 12, 0, 0).getTime();          // a Wednesday, on the calendar of whoever runs this
const at = (day, hour) => new Date(2026, 10, day, hour == null ? 12 : hour, 0, 0).toISOString();
const order = (n, day, extra) => Object.assign({ id: 'o-' + n, order_number: 'HE-' + (1000 + n), customer_name: 'SYNTHETIC client ' + n, customer_email: 'client' + n + '@example.test',
  status: 'paid', currency: 'USD', total: 10 * n, placed_at: at(day), deleted_at: null }, extra || {});
const item = (n, qty, name) => ({ id: 'i-' + n + '-' + name, order_id: 'o-' + n, sku: name.toUpperCase(), product_name: name, quantity: qty });
const act = (n, who, role) => ({ id: 'a-' + n, person_name: 'SYNTHETIC ' + who, person_account_number: who === 'Ana' ? '111222333' : '444555666', person_role: role || 'employee', table_name: 'tasks', area: 'Tasks', action: 'UPDATE', happened_at: at(18) });

test.describe('the arithmetic (no browser)', () => {
  test('the week is the last finished Monday to Sunday on the viewer\'s own calendar, whatever the day it is asked', ({}, ti) => {
    node(ti);
    const w = W.weekOf(NOW, 0);
    expect([w.key, w.first, w.last, w.label]).toEqual(['2026-11-16', '2026-11-16', '2026-11-22', 'Nov 16 – Nov 22, 2026']);
    expect(new Date(w.from).getTime()).toBe(new Date(2026, 10, 16).getTime());
    expect(new Date(w.to).getTime()).toBe(new Date(2026, 10, 23).getTime());
    expect(new Date(w.prevFrom).getTime()).toBe(new Date(2026, 10, 9).getTime());
    // asked on the Monday itself (one minute after midnight) and on the Sunday night: the same rule
    expect(W.weekOf(new Date(2026, 10, 23, 0, 1).getTime(), 0).key).toBe('2026-11-16');
    expect(W.weekOf(new Date(2026, 10, 22, 23, 59).getTime(), 0).key).toBe('2026-11-09');
    expect(W.weekOf(NOW, 1).label).toBe('Nov 9 – Nov 15, 2026');
    // across a new year, and across the clock change in March (still seven calendar days)
    expect(W.weekOf(new Date(2027, 0, 6, 9).getTime(), 0).label).toBe('Dec 28 – Jan 3, 2027');
    const march = W.weekOf(new Date(2027, 2, 17, 9).getTime(), 0);
    expect([march.first, march.last]).toEqual(['2027-03-08', '2027-03-14']);
    expect(W.weeks(NOW, 3).map(x => x.key)).toEqual(['2026-11-16', '2026-11-09', '2026-11-02']);
    expect(W.weeks(NOW, 999)).toHaveLength(26);
    // odd input never throws; an impossible time is read as now
    for (const bad of [1e300, -1e300, NaN, Infinity, 'x', null, undefined, {}]) expect(() => W.weekOf(bad, bad)).not.toThrow();
    expect(W.weekOf(NOW, -3).key).toBe('2026-11-16');
  });

  test('sales are exact: cancelled orders are counted as placed but not added to the money; the week before is compared', ({}, ti) => {
    node(ti);
    const r = W.build({ now: NOW, week: W.weekOf(NOW, 0),
      orders: [order(1, 16), order(2, 17, { customer_email: 'CLIENT1@example.test' }), order(3, 18, { status: 'Cancelled' }), order(4, 19, { total: null }), order(5, 20, { deleted_at: at(20) }), null, 'x'],
      prevOrders: [order(9, 10, { total: '12.50' }), order(8, 11, { status: 'refunded', total: 99 })],
      items: [item(1, 2, 'Lotion'), item(2, 1, 'Lotion'), item(2, 3, 'Gift box'), item(3, 50, 'Lotion'), item(99, 7, 'Nobody'), { order_id: 'o-1', quantity: -4, product_name: 'Lotion' }] });
    expect(r.sales).toEqual({ state: 'ok', orders: 4, counted: 3, notCounted: 1, noAmount: 1, byCurrency: [{ currency: 'USD', cents: 3000 }], clients: 3, items: 'ok', units: 6,
      top: [{ name: 'Gift box', qty: 3 }, { name: 'Lotion', qty: 3 }],
      before: { state: 'ok', orders: 2, byCurrency: [{ currency: 'USD', cents: 1250 }], ordersChange: 2, centsChange: 1750, currency: 'USD' } });
    const lines = W.lines(r).filter(l => l.section === 'Sales').map(l => [l.label, l.value, l.note]);
    expect(lines).toEqual([
      ['Orders placed', '4', 'the week before: 2 (+2)'],
      ['Order totals (tax and shipping included)', '$30.00', 'the week before: $12.50 (+$17.50)'],
      ['Bottles and other items sold', '6', ''],
      ['Clients who ordered', '3', ''],
      ['Cancelled or refunded (not in the totals)', '1', ''],
      ['Orders with no amount saved (not in the totals)', '1', ''],
      ['Sold most', '3 × Gift box', ''], ['', '3 × Lotion', '']]);
    // two currencies are never added together, and then no money difference is claimed
    const two = W.build({ now: NOW, orders: [order(1, 16), order(2, 17, { currency: 'cad' })], prevOrders: [order(9, 10)], items: [] }).sales;
    expect(two.byCurrency).toEqual([{ currency: 'CAD', cents: 2000 }, { currency: 'USD', cents: 1000 }]);
    expect(two.before.centsChange).toBeNull();
    // a quiet week after a busy one: the difference is negative, not hidden
    const quiet = W.lines(W.build({ now: NOW, orders: [], prevOrders: [order(9, 10)], items: [] }));
    expect(quiet.slice(0, 2).map(l => [l.value, l.note])).toEqual([['0', 'the week before: 1 (-1)'], ['$0.00', 'the week before: $90.00 (-$90.00)']]);
  });

  test('a part that could not be read says so and is never zero; a part that was not asked for is left out', ({}, ti) => {
    node(ti);
    const r = W.build({ now: NOW, orders: null, prevOrders: [], questions: null, waiting: null, returns: false, stock: null, tasks: null, incidents: [{ id: 1 }], activity: null });
    expect([r.sales.state, r.questions.state, r.returns.state, r.stock.state, r.work.state, r.reviews.state, r.people.state]).toEqual(['unknown', 'unknown', 'unknown', 'unknown', 'ok', 'off', 'unknown']);
    expect(W.lines(r).map(l => [l.section, l.label, l.value])).toEqual([
      ['Sales', 'Orders of the week', 'could not be read'], ['Customers', 'Customer questions', 'could not be read'], ['Returns', 'Returns', 'could not be read'],
      ['Stock right now', 'Stock', 'could not be read'], ['Work', 'Tasks opened', 'could not be read'], ['Work', 'Incidents opened', '1'], ['People', 'What each person did', 'could not be read']]);
    // the orders were read but their items were not: the money stands, the bottle count says so
    const half = W.build({ now: NOW, orders: [order(1, 16)], items: null });
    expect([half.sales.units, half.sales.items]).toEqual([null, 'unknown']);
    expect(W.lines(half).find(l => l.label === 'Bottles and other items sold').value).toBe('could not be read');
    // nothing given at all: an empty report, never an error
    for (const junk of [null, undefined, 'x', 7, [], {}]) expect(W.lines(W.build(junk))).toEqual([]);
    for (const junk of [null, undefined, 'x', 7, []]) expect(() => W.toText(junk)).not.toThrow();
  });

  test('customers, returns, stock, reviews and people: each figure is counted from the records', ({}, ti) => {
    node(ti);
    const week = W.weekOf(NOW, 0);
    const r = W.build({ now: NOW, week: week,
      questions: [{ id: 1 }, { id: 2 }, { id: 3 }, null],
      waiting: [{ id: 2, status: 'new', created_at: new Date(NOW - 5 * 86400000 - 3600000).toISOString() }, { id: 3, status: 'needs_review', created_at: new Date(NOW - 86400000).toISOString() }, { id: 4, status: 'answered', created_at: at(1) }],
      returns: [{ id: 'r1', created_at: at(17), refunded_at: at(19), refund_amount: '12.50' }, { id: 'r2', created_at: at(18), refunded_at: null, refund_amount: null },
        { id: 'r3', created_at: at(3), refunded_at: at(20), refund_amount: null }, { id: 'r4', created_at: at(24), refunded_at: at(24), refund_amount: 5 }],
      stock: [{ product_id: 'p1', available: 2, low_stock_threshold: 5 }, { product_id: 'p2', available: 5, low_stock_threshold: 5 }, { product_id: 'p3', available: 80, low_stock_threshold: 10 },
        { product_id: 'p4', available: 0, low_stock_threshold: null }, { product_id: null, available: 1, low_stock_threshold: 9 }],
      products: [{ id: 'p1', name: 'SYNTHETIC Lotion 8 oz' }, { id: 'p2', name: '', sku: 'GIFT-1' }],
      tasks: [{ id: 1 }, { id: 2 }], incidents: [],
      reviews: [{ stars: 5, date: '2026-11-16' }, { stars: 4, date: '2026-11-22' }, { stars: 1, date: null, addedAt: Date.parse(at(18)) }, { stars: 5, date: '2026-11-23' }, { stars: 2, date: '2026-11-18', status: 'removed' }, { stars: 9, date: '2026-11-18' }],
      activity: [act(1, 'Ana'), act(2, 'Ana'), act(2, 'Ana'), act(3, 'Ben', 'administrator'), { id: 'a-4', happened_at: at(18) }, null] });
    expect(r.questions).toEqual({ state: 'ok', arrived: 3, waiting: 2, oldestDays: 5 });
    expect(r.returns).toEqual({ state: 'ok', opened: 2, refunded: 2, refundCents: 1250, refundNoAmount: 1 });
    expect(r.stock).toEqual({ state: 'ok', products: 4, lowCount: 2, noLevel: 1, low: [{ name: 'SYNTHETIC Lotion 8 oz', available: 2, level: 5 }, { name: 'GIFT-1', available: 5, level: 5 }] });
    expect(r.work).toEqual({ state: 'ok', tasks: 2, incidents: 0 });
    expect(r.reviews).toEqual({ state: 'ok', count: 3, low: 1, five: 1, averageTenths: 33 });
    expect(r.people).toEqual({ state: 'ok', total: 4, people: 3, capped: false, rows: [
      { name: 'SYNTHETIC Ana', role: 'employee', account: '111222333', actions: 2 },           // the same record sent twice is counted once
      { name: 'No name recorded', role: '', account: '', actions: 1 },
      { name: 'SYNTHETIC Ben', role: 'administrator', account: '444555666', actions: 1 }] });
    const text = W.toText(r);
    expect(text.split('\n')[0]).toBe('Weekly report, Nov 16 – Nov 22, 2026');
    expect(text).toContain('Waiting for an answer right now: 2 (the oldest has waited 5 days)');
    expect(text).toContain('Reviews received: 3 (average 3.3 of 5 · 1 with five stars · 1 with one or two)');
    expect(text).toContain('Refunds given: 2 ($12.50 (1 with no amount saved))');
    expect(text).toContain('  SYNTHETIC Lotion 8 oz (2 left, alert at 5)');
    expect(text).toContain('Products with no alert level set: 1 (these can never show as low)');
    expect(text).toContain('  SYNTHETIC Ana · #111222333 (2 changes · employee)');
    expect(text).not.toMatch(/client\d|@example/);                                           // no customer names or emails on the report
    // a list too long to read to the end says "at least", never a plain number
    const capped = W.lines(W.build({ now: NOW, activity: [act(1, 'Ana')], activityCapped: true })).find(l => l.label === 'Recorded changes in the week');
    expect([capped.value, capped.note]).toEqual(['at least 1', 'the list was too long to read to the end; see Employee Activity']);
  });

  test('the Home reminder: the newest finished week, until that week was opened', ({}, ti) => {
    node(ti);
    expect(W.due(NOW, '')).toMatchObject({ due: true, week: { key: '2026-11-16' } });
    expect(W.due(NOW, '2026-11-09').due).toBe(true);
    expect(W.due(NOW, '2026-11-16').due).toBe(false);
    expect(W.due(NOW, '2026-11-23').due).toBe(false);
    for (const junk of [null, undefined, 7, {}, 'last week', '16/11/2026']) expect(W.due(NOW, junk).due).toBe(true);
    // in the feed: one item that opens Backups & Printouts; nothing without a week
    const feed = F.buildFeed({ week: { key: '2026-11-16', label: 'Nov 16 – Nov 22, 2026' } }, NOW);
    const mine = feed.filter(i => i.id === 'week:2026-11-16');
    expect(mine.map(i => [i.title, i.level, i.page, i.actions.map(a => a.label)])).toEqual([['Your weekly report for Nov 16 – Nov 22, 2026 is ready', 'today', 'backupsPanel', ['Open the weekly report']]]);
    for (const none of [null, undefined, {}, { key: 'x' }, 'x']) expect(F.buildFeed({ week: none }, NOW).filter(i => String(i.id).startsWith('week:'))).toEqual([]);
  });
});

// ---------- on the page ----------
const FIXED = '2026-11-25T18:00:00Z';                         // a Wednesday; last week is Nov 16 – Nov 22
const iso = (day, hour) => '2026-11-' + String(day).padStart(2, '0') + 'T' + String(hour == null ? 18 : hour).padStart(2, '0') + ':00:00Z';
const row = (n, day, extra) => Object.assign({ id: 'o-' + n, order_number: 'HE-' + (1000 + n), customer_name: 'SYNTHETIC client ' + n, customer_email: 'client' + n + '@example.test',
  status: 'paid', currency: 'USD', total: 10 * n, placed_at: iso(day), deleted_at: null }, extra || {});
function seed(backend) {
  backend.tables.daily_reports = []; backend.tables.sop_documents = [];
  backend.tables.orders = [row(1, 16), row(2, 18), row(3, 20, { status: 'cancelled' }), row(4, 11), row(5, 24)];      // 4: the week before; 5: this week, not finished
  backend.tables.order_items = [item(1, 2, 'SYNTHETIC Lotion'), item(2, 1, 'SYNTHETIC Lotion'), item(3, 9, 'SYNTHETIC Lotion'), item(5, 4, 'SYNTHETIC Lotion')];
  backend.tables.customer_inquiries = [{ id: 'q1', status: 'answered', created_at: iso(17), customer_name: 'SYNTHETIC asker' }, { id: 'q2', status: 'new', created_at: iso(21), customer_name: 'SYNTHETIC asker' },
    { id: 'q3', status: 'needs_review', created_at: iso(24), customer_name: 'SYNTHETIC asker' }];
  backend.tables.returns = [{ id: 'r1', order_id: 'o-1', reason: 'damaged', status: 'refunded', refund_amount: '10.00', refunded_at: iso(19), created_at: iso(17) }];
  backend.tables.products = [{ id: 'p1', sku: 'LOT-8', name: 'SYNTHETIC Lotion 8 oz' }, { id: 'p2', sku: 'LOT-2', name: 'SYNTHETIC Lotion 2 oz' }];
  backend.tables.inventory = [{ id: 'inv1', product_id: 'p1', available: 3, low_stock_threshold: 10 }, { id: 'inv2', product_id: 'p2', available: 40, low_stock_threshold: 10 }];
  backend.tables.tasks = [{ id: 't1', title: 'SYNTHETIC task', status: 'open', created_at: iso(18) }, { id: 't2', title: 'SYNTHETIC older task', status: 'open', created_at: iso(3) }];
  backend.tables.incidents = [];
  backend.rpc.employee_activity = (body) => (body.p_offset ? [] : [act(1, 'Ana'), act(2, 'Ana'), act(3, 'Ben', 'administrator')]);
}
async function open(page, backend, opts) {
  const o = opts || {};
  await page.clock.setFixedTime(new Date(FIXED));
  seed(backend);
  if (o.role) backend.tables.profiles[0].role = o.role;
  await page.addInitScript((feed) => { try { localStorage.setItem('he_backups_page', 'on'); if (feed) localStorage.setItem('he_attention_feed', 'on'); } catch (e) {}
    window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, !!o.feed);
  await login(page);
  if (o.stay) return;
  await gotoPage(page, 'backupsPanel');
  await expect(page.locator('#backupsPanel h2')).toHaveText('Backups & Printouts');
}
// the report's own question about the people of a week (the Activity page and the daily digest ask without an end)
const peopleCalls = (backend) => backend.requests.filter(r => r.rpc === 'employee_activity' && r.body && r.body.p_to != null);
const writes = (backend) => backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && String(r.path || '').startsWith('/rest/v1/') && !r.rpc);
const value = (host, label) => host.locator('[data-wrtable] tr', { has: host.page().locator('th[scope="row"]', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).locator('[data-wrvalue]');

test('Show the report: last week\'s exact figures from the records, and nothing is written', async ({ page, backend }) => {
  await open(page, backend);
  const host = page.locator('#wrHost');
  await expect(host.locator('h3')).toHaveText('Weekly report');
  await expect(host.locator('#wrWeek option').first()).toHaveText('Nov 16 – Nov 22, 2026 (last week)');
  await expect(host.locator('[data-wrtable]')).toHaveCount(0);                                // nothing is read until the button is pressed
  expect(peopleCalls(backend)).toEqual([]);
  await host.locator('[data-wr="show"]').click();
  await expect(host.locator('[data-wrtable]')).toHaveAttribute('data-wrtable', '2026-11-16');
  await expect(host.locator('[data-wrnote]')).toHaveText('The week of Nov 16 – Nov 22, 2026. Every figure is exact.');
  await expect(value(host, 'Orders placed')).toHaveText('3');
  await expect(value(host, 'Order totals (tax and shipping included)')).toHaveText('$30.00');           // 10 + 20; the cancelled 30 is not added
  await expect(value(host, 'Bottles and other items sold')).toHaveText('3');
  await expect(value(host, 'Cancelled or refunded (not in the totals)')).toHaveText('1');
  await expect(value(host, 'New questions in the week')).toHaveText('2');
  await expect(value(host, 'Waiting for an answer right now')).toHaveText('2');
  await expect(value(host, 'Returns opened')).toHaveText('1');
  await expect(value(host, 'Refunds given')).toHaveText('1');
  await expect(value(host, 'Products at or under their alert level')).toHaveText('1');
  await expect(value(host, 'Tasks opened')).toHaveText('1');
  await expect(value(host, 'Recorded changes in the week')).toHaveText('3');
  await expect(host.locator('[data-wrtable]')).toContainText('the week before: 1 (+2)');
  await expect(host.locator('[data-wrtable]')).toContainText('SYNTHETIC Lotion 8 oz');
  await expect(host.locator('[data-wrtable]')).toContainText('SYNTHETIC Ana · #111222333');
  await expect(host.locator('[data-wrtable]')).not.toContainText('SYNTHETIC client');          // no customer names
  await expect(host.locator('[data-wrsection]')).toHaveText(['Sales', 'Customers', 'Returns', 'Stock right now', 'Work', 'People']);   // the Reviews inbox is off: reviews are left out
  // the people were asked for that week only
  const call = peopleCalls(backend)[0].body;
  expect([Date.parse(call.p_to) - Date.parse(call.p_from), call.p_person, call.p_area, call.p_search]).toEqual([7 * 86400000, null, null, null]);
  expect(writes(backend)).toEqual([]);
});

test('Print gives one Letter page of the same figures; another week can be chosen', async ({ page, backend }, ti) => {
  await open(page, backend);
  const host = page.locator('#wrHost');
  await host.locator('[data-wr="show"]').click();
  await host.locator('[data-wr="print"]').click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  const doc = page.locator('#invoicePrintHost [data-printweek="2026-11-16"]');
  await expect(doc).toContainText('Weekly report, Nov 16 – Nov 22, 2026');
  await expect(doc.locator('[data-wrvalue]').first()).toHaveText('3');
  await expect(doc).toContainText('Exact figures from the records. Nothing is estimated.');
  await expect(host.locator('[data-wrnote]')).toHaveText('Opened the weekly report for Nov 16 – Nov 22, 2026 for printing.');
  if (ti.project.name === 'desktop') {
    const pages = [...(await page.pdf({ preferCSSPageSize: true })).toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(m => Math.round(+m[1]) + 'x' + Math.round(+m[2]));
    expect(pages).toEqual(['612x792']);
  }
  // the week before: the old report goes at once, the new one is read on the button
  await host.locator('#wrWeek').selectOption('1');
  await expect(host.locator('#wrWeek')).toBeFocused();
  await expect(host.locator('[data-wrtable]')).toHaveCount(0);
  await host.locator('[data-wr="show"]').click();
  await expect(host.locator('[data-wrtable]')).toHaveAttribute('data-wrtable', '2026-11-09');
  await expect(value(host, 'Orders placed')).toHaveText('1');
  await expect(value(host, 'Order totals (tax and shipping included)')).toHaveText('$40.00');
});

test('a part the database would not give says "could not be read"; the rest of the report still shows', async ({ page, backend }) => {
  await open(page, backend);
  await page.route('**/rest/v1/returns?*', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'SYNTHETIC permission denied for table returns' }) }));
  await page.route('**/rest/v1/rpc/employee_activity*', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'SYNTHETIC not allowed' }) }));
  const host = page.locator('#wrHost');
  await host.locator('[data-wr="show"]').click();
  await expect(host.locator('[data-wrnote]')).toHaveText('The week of Nov 16 – Nov 22, 2026. 2 parts could not be read; press "Show the report" to try again.');
  await expect(value(host, 'Returns')).toHaveText('could not be read');
  await expect(value(host, 'What each person did')).toHaveText('could not be read');
  await expect(value(host, 'Orders placed')).toHaveText('3');
  await expect(host.locator('[data-wrtable]')).not.toContainText('Refunds given');             // never a zero in place of a figure that was not read
});

test('Home reminds until the newest week was opened; opening it clears the reminder', async ({ page, backend }) => {
  await open(page, backend, { feed: true, stay: true });
  await gotoPage(page, 'attentionPanel');
  const item = page.locator('#attentionFeedHost [data-feeditem="week:2026-11-16"]');
  await expect(item.locator('.feedTitle')).toHaveText('Your weekly report for Nov 16 – Nov 22, 2026 is ready');
  await item.locator('[data-feedopen="backupsPanel"]').click();
  const host = page.locator('#wrHost');
  // looking at an older week does not clear it
  await host.locator('#wrWeek').selectOption('1');
  await host.locator('[data-wr="show"]').click();
  await expect(host.locator('[data-wrtable]')).toHaveAttribute('data-wrtable', '2026-11-09');
  expect(await page.evaluate(() => localStorage.getItem('he_week_report_seen'))).toBeNull();
  await host.locator('#wrWeek').selectOption('0');
  await host.locator('[data-wr="show"]').click();
  await expect(host.locator('[data-wrtable]')).toHaveAttribute('data-wrtable', '2026-11-16');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('he_week_report_seen'))).toBe('2026-11-16');
  await gotoPage(page, 'attentionPanel');
  await expect(page.locator('#attentionFeedHost')).toBeVisible();
  await expect(page.locator('#attentionFeedHost [data-feeditem^="week:"]')).toHaveCount(0);
  // the person's own settings are not in use (the switch is off): nothing was asked of them, nothing saved
  expect(backend.requests.filter(r => r.rpc === 'set_my_setting' || (r.table === 'my_settings' && !r.params.some(([k, v]) => k === 'limit' && v === '0')))).toEqual([]);   // (limit 0 is the Feature Flags page asking whether it is installed)
  expect(writes(backend)).toEqual([]);
});

test('with the person\'s own settings in use, the opened week is saved once for every device of that person', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'one size is enough');
  backend.tables.my_settings = [];
  backend.rpc.set_my_setting = (b) => { backend.tables.my_settings = backend.tables.my_settings.filter(r => r.key !== b.p_key).concat([{ id: 'ms-' + b.p_key, key: b.p_key, value: b.p_value, updated_at: '2026-11-25T18:00:05Z' }]); return { ok: true, key: b.p_key, updated_at: '2026-11-25T18:00:05Z' }; };
  await page.addInitScript(() => { try { localStorage.setItem('he_my_settings', 'on'); } catch (e) {} });
  await open(page, backend);
  const host = page.locator('#wrHost');
  await host.locator('[data-wr="show"]').click();
  await expect(host.locator('[data-wrtable]')).toHaveAttribute('data-wrtable', '2026-11-16');
  const saves = () => backend.requests.filter(r => r.rpc === 'set_my_setting' && r.body.p_key === 'week_report_seen').map(r => r.body);
  await expect.poll(saves).toEqual([{ p_key: 'week_report_seen', p_value: { week: '2026-11-16' } }]);
  await host.locator('[data-wr="show"]').click();                                             // shown again: already saved, not saved twice
  await expect(host.locator('[data-wrnote]')).toHaveText('The week of Nov 16 – Nov 22, 2026. Every figure is exact.');
  await page.waitForTimeout(300);
  expect(saves()).toHaveLength(1);
});

test('an administrator has the report; an employee does not, and the page shows nothing in its place', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'one size is enough');
  await open(page, backend, { role: 'employee' });
  await expect(page.locator('#backupsPanel h3').first()).toHaveText('Daily recaps');
  await expect(page.locator('#wrHost')).toHaveCount(0);
  await expect(page.locator('#backupsPanel')).not.toContainText('null');
  expect(peopleCalls(backend)).toEqual([]);
});

test('an administrator sees and opens the weekly report', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'one size is enough');
  await open(page, backend, { role: 'administrator' });
  const host = page.locator('#wrHost');
  await host.locator('[data-wr="show"]').click();
  await expect(value(host, 'Orders placed')).toHaveText('3');
});

test('at phone size the report fits without sideways scrolling', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  await open(page, backend);
  await page.locator('#wrHost [data-wr="show"]').click();
  await expect(page.locator('#wrHost [data-wrtable]')).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  // and the figures themselves are on the screen (a wide table inside a scrolling box would pass the check above)
  const edges = await page.locator('#wrHost [data-wrvalue]').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().right)));
  const width = await page.evaluate(() => window.innerWidth);
  expect(edges.length).toBeGreaterThan(8);
  expect(Math.max(...edges)).toBeLessThanOrEqual(width);
});
