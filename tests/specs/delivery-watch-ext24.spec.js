// Delivery watch (owner, Nov 24: "like a Swiss watch"): every unfinished parcel
// (drafts/48) checked against fixed rules; the ones that need the owner appear in
// the attention feed with the next step and a suggested customer message (copied,
// never sent). Pure rules in assets/scan/he-delivery-watch.js. Every value is made up.
const W = require('../../assets/scan/he-delivery-watch.js');
const F = require('../../assets/views/he-attention-feed.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const NOW = Date.parse('2026-11-24T15:00:00Z');
const H = 3600000, D = 24 * H;
const at = (ms) => new Date(NOW - ms).toISOString();
const P = (id, status, ageMs, extra) => Object.assign({ id: id, order_id: 'o-' + id, carrier: 'ups', tracking_number: '1Z999AA10123456784', status: status, status_at: at(ageMs), created_at: at(ageMs) }, extra || {});

test.describe('the rules (no browser)', () => {
  test('each status, at each threshold', ({}, ti) => {
    node(ti);
    const lv = (p, o) => { const r = W.watch([p], Object.assign({ now: NOW }, o || {})); return r.length ? r[0].level : 'none'; };
    // label made, not handed over
    expect(lv(P('a', 'label_created', 23 * H))).toBe('none');
    expect(lv(P('a', 'label_created', 24 * H))).toBe('today');
    expect(lv(P('a', 'label_created', 3 * D))).toBe('urgent');
    // dropped off: never "stuck" until carrier tracking is connected
    expect(lv(P('b', 'dropped_off', 30 * D))).toBe('none');
    expect(lv(P('b', 'dropped_off', 2 * D), { trackingConnected: true })).toBe('none');
    expect(lv(P('b', 'dropped_off', 3 * D), { trackingConnected: true })).toBe('today');
    expect(lv(P('b', 'dropped_off', 6 * D), { trackingConnected: true })).toBe('urgent');
    // in transit
    expect(lv(P('c', 'in_transit', 4 * D))).toBe('none');
    expect(lv(P('c', 'in_transit', 5 * D))).toBe('today');
    expect(lv(P('c', 'in_transit', 10 * D))).toBe('urgent');
    // out for delivery, exception, returned, finished
    expect(lv(P('d', 'out_for_delivery', 20 * H))).toBe('none');
    expect(lv(P('d', 'out_for_delivery', D))).toBe('urgent');
    expect(lv(P('e', 'exception', H))).toBe('urgent');
    expect(lv(P('f', 'returned', H))).toBe('urgent');
    expect(lv(P('g', 'delivered', 100 * D))).toBe('none');
    expect(lv(P('h', 'cancelled', 100 * D))).toBe('none');
  });

  test('next step, suggested message with the order and tracking, most urgent and oldest first', ({}, ti) => {
    node(ti);
    const r = W.watch([P('a', 'label_created', 2 * D), P('f', 'returned', H), P('e', 'exception', 5 * H, { carrier: 'usps', tracking_number: 'EA123456785US' })],
      { now: NOW, ordersById: { 'o-e': { order_number: '1042', customer_name: 'SYNTHETIC Ana Example' }, 'o-f': { order_number: '1043', customer_name: '' } } });
    expect(r.map(x => x.id)).toEqual(['e', 'f', 'a']);          // urgent first, oldest first; then today
    expect(r[0]).toMatchObject({ level: 'urgent', title: 'Delivery problem', order: '1042', tracking: 'EA123456785US' });
    expect(r[0].next).toMatch(/tracking page/);
    expect(r[0].customerMessage).toMatch(/^Hi SYNTHETIC,/);
    expect(r[0].customerMessage).toContain('order #1042');
    expect(r[0].customerMessage).toContain('USPS EA123456785US');
    expect(r[1].customerMessage).toMatch(/^Hi,\n\nYour parcel \(order #1043\) was returned/);
    expect(r[2].title).toBe('Label made 2 days ago, parcel not handed over');
    expect(r[2].customerMessage).toBeNull();                     // nothing to tell the customer yet
  });

  test('broken rows never break it; in the feed under Deliveries', ({}, ti) => {
    node(ti);
    expect(W.watch(null)).toEqual([]);
    expect(W.watch([null, 5, {}, { id: 'x', status: 'returned' }, { id: 'y', status: 'returned', status_at: 'not a date' }], { now: NOW })).toEqual([]);
    const items = F.buildFeed({ delivery: W.watch([P('f', 'returned', H), P('a', 'label_created', 2 * D)], { now: NOW }) }, NOW);
    expect(items.map(i => i.id)).toEqual(['parcel:f', 'parcel:a']);
    expect(items[0]).toMatchObject({ kind: 'delivery', level: 'urgent', page: 'ordersPanel' });
    expect(items[0].actions.map(a => a.label)).toEqual(['Copy message', 'Open Orders']);
    expect(items[0].suggestion).toMatch(/returned to us/);
    expect(F.view(items, { now: NOW, filter: 'delivery' }).items.length).toBe(2);
    expect(F.view(items, { now: NOW, filter: 'message' }).items.length).toBe(0);
  });
});

test.describe('in the feed on Home', () => {
  test('a returned parcel and a label not handed over appear, with the message to copy', async ({ page, backend }) => {
    await page.clock.setFixedTime(new Date(NOW));
    backend.tables.orders = [{ id: '00000000-0000-4000-8000-00000000e001', channel: 'shopify', source: 'shopify', order_number: '1042', customer_name: 'SYNTHETIC Ana', status: 'paid', currency: 'USD', total: 24, placed_at: at(5 * D), created_at: at(5 * D), deleted_at: null }];
    backend.tables.shipments = [
      { id: '00000000-0000-4000-8000-00000000d001', order_id: '00000000-0000-4000-8000-00000000e001', carrier: 'usps', tracking_number: 'EA123456785US', status: 'returned', status_at: at(2 * H), created_at: at(4 * D) },
      { id: '00000000-0000-4000-8000-00000000d002', order_id: '00000000-0000-4000-8000-00000000e001', carrier: 'ups', tracking_number: '1Z999AA10123456784', status: 'label_created', status_at: at(30 * H), created_at: at(30 * H) },
      { id: '00000000-0000-4000-8000-00000000d003', order_id: '00000000-0000-4000-8000-00000000e001', carrier: 'ups', tracking_number: '1Z999AA10123456785', status: 'label_created', status_at: at(2 * H), created_at: at(2 * H) }];
    await page.addInitScript(() => { window.__copied = []; try { localStorage.setItem('he_attention_feed', 'on'); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); } catch (e) {} });
    await login(page); await gotoPage(page, 'attentionPanel');
    const f = page.locator('#attentionFeedHost');
    const ret = f.locator('[data-feeditem="parcel:00000000-0000-4000-8000-00000000d001"]');
    await expect(ret).toBeVisible();
    await expect(ret.locator('.feedLevel')).toHaveText('Urgent');
    await expect(ret.locator('.feedTitle')).toHaveText('Returned to you · order #1042');
    await expect(ret.locator('.feedDraft')).toContainText('Suggested message to the customer (not sent)');
    await expect(f.locator('[data-feeditem="parcel:00000000-0000-4000-8000-00000000d002"] .feedTitle')).toContainText('Label made 1 day ago');
    await expect(f.locator('[data-feeditem="parcel:00000000-0000-4000-8000-00000000d003"]')).toHaveCount(0);   // only 2 hours old
    await ret.locator('[data-feedcopy]').click();
    await expect.poll(() => page.evaluate(() => window.__copied.length)).toBe(1);
    expect(await page.evaluate(() => window.__copied[0])).toMatch(/^Hi SYNTHETIC,\n\nYour parcel \(order #1042\) was returned/);
    await f.locator('[data-feedfilter="delivery"]').click();
    await expect(f.locator('[data-feeditem]')).toHaveCount(2);
    expect(backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/')).map(r => r.method + ' ' + r.path)).toEqual([]);   // reads only
  });
});
