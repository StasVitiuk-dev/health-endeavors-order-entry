// Drop-off receipts (owner request, Nov 23: "100 parcels at UPS: scan the receipt
// and every order updates"). The reader (assets/scan/he-dropoff.js) and the Orders
// section behind the he_dropoff switch (OFF, not on Feature Flags: it writes real
// records once drafts/48 is installed; the database side is tested by
// docs/ops/sql/local-test/shipments_test.sh). Every value is made up.
const E = require('../../assets/scan/he-scan.js');
const D = require('../../assets/scan/he-dropoff.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');
const { unnamedControls, contrastFailures } = require('../helpers/a11y-audit');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const UPS = '1Z999AA10123456784', USPS = '9400111899223197428497', INTL = 'EA123456785US', FDX = '123456789012';
const RECEIPT = [
  'THE UPS STORE #1234',
  'Store phone (555) 010-2299   Chicago IL 60601',
  'Receipt 000123456789   11/24/2026 10:42 AM',
  'Qty 1  Tracking 1Z 999 AA1 01 2345 6784',
  'Qty 1  Tracking 1Z999AA10123456784',
  'USPS 9400 1118 9922 3197 4284 97  Total $12.40',
  '42060601' + USPS,
  'Intl EA 123 456 785 US',
  'FedEx ' + FDX,
  'Subtotal 34.56 Tax 2.10 Card ****4242'].join('\n');

test.describe('the receipt reader (no browser)', () => {
  test('finds every parcel on a cluttered receipt, once, and nothing else', ({}, ti) => {
    node(ti);
    const r = D.extractTrackings(RECEIPT, E);
    expect(r.found.map(x => x.tracking + ':' + x.carrier)).toEqual([UPS + ':ups', USPS + ':usps', INTL + ':usps']);
    expect(r.unsure).toEqual([{ tracking: FDX, carrier: 'fedex', confidence: 'format' }]);   // no check digit: shown to check
    // the receipt number, phone, ZIP, quantities and prices are not parcels
    expect(r.found.concat(r.unsure).map(x => x.tracking)).not.toContain('000123456789');
    // a wrong check digit is never accepted, spaced or not
    expect(D.extractTrackings('1Z 999 AA1 01 2345 6785\n9400111899223197428490', E).found).toEqual([]);
    // a 12-digit number on a line that does not say FedEx is ignored
    expect(D.extractTrackings('Order 123456789012', E).unsure).toEqual([]);
    // typed one per line, lower case, with dashes
    expect(D.extractTrackings('1z999aa1-0123-456784\nea123456785us', E).found.map(x => x.tracking)).toEqual([UPS, INTL]);
    // barcodes read from a photo
    expect(D.fromBarcodes([UPS, 'not a parcel', USPS, UPS], E).found.map(x => x.tracking)).toEqual([UPS, USPS]);
  });

  test('broken or huge input never breaks it; at most 500 numbers', ({}, ti) => {
    node(ti);
    expect(D.extractTrackings(null, E)).toEqual({ found: [], unsure: [], truncated: false });
    expect(D.extractTrackings('x', null).found).toEqual([]);
    const t0 = Date.now();
    const huge = D.extractTrackings(('Qty 1 Tracking 1Z 999 AA1 01 2345 6784 ' + '9'.repeat(40) + '\n').repeat(3000) + 'x'.repeat(250000), E);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(huge.truncated).toBe(true);
    expect(huge.found.map(x => x.tracking)).toEqual([UPS]);
    // 600 different valid UPS-shaped numbers: only the first 500
    const many = [];
    for (let n = 0; many.length < 600 && n < 100000; n++) {
      const t = '1Z999AA1' + String(n).padStart(9, '0');
      for (let d = 0; d < 10; d++) if (E.validateTracking(t + d).valid) { many.push(t + d); break; }
    }
    const r = D.extractTrackings(many.join('\n'), E);
    expect(r.found.length).toBe(500);
    expect(r.truncated).toBe(true);
  });

  test('the database\'s answer in plain words; the store refuses what it must', async ({}, ti) => {
    node(ti);
    const s = D.summarize([
      { tracking: UPS, result: 'marked', order_id: 'o1', status: 'dropped_off' },
      { tracking: USPS, result: 'already', order_id: 'o2', status: 'in_transit' },
      { tracking: INTL, result: 'not_found' },
      { tracking: 'X', result: 'not_marked', status: 'cancelled' }, null, { result: 'marked' }], { o1: { order_number: '1042' } });
    expect(s.counts).toEqual({ marked: 1, already: 1, not_found: 1, not_marked: 1, ambiguous: 0 });
    expect(s.sentence).toBe('1 parcel marked dropped off, 1 already done, 1 not on any order yet, 1 not marked (cancelled or returned).');
    expect(s.rows[0]).toMatchObject({ order: '1042', word: 'Marked dropped off' });
    const calls = [];
    let release;
    const client = { rpc: (name, args) => { calls.push([name, args]); return new Promise(r => { release = () => r({ data: { ok: true, results: (args.p_trackings || []).map(t => ({ tracking: t, result: 'marked' })) } }); }); } };
    expect((await D.createStore({ client, enabled: false }).markDroppedOff([UPS])).off).toBe(true);
    const st = D.createStore({ client, enabled: true });
    expect((await st.markDroppedOff([' ', null])).message).toMatch(/at least one/);
    const first = st.markDroppedOff([UPS, '1z999aa10123456784']);
    expect((await st.markDroppedOff([UPS])).busy).toBe(true);           // a double click sends once
    release();
    expect(await first).toEqual({ ok: true, results: [{ tracking: UPS, result: 'marked' }] });
    expect(calls).toEqual([['mark_dropped_off', { p_trackings: [UPS] }]]);
    expect((await st.attach('not-a-uuid', 'ups', UPS)).message).toMatch(/Choose the order/);
    expect((await st.attach('00000000-0000-4000-8000-000000000001', 'pigeon', UPS)).message).toMatch(/carrier/);
    const nf = D.createStore({ client: { rpc: async () => ({ error: { code: 'PGRST202', message: 'Could not find the function public.mark_dropped_off' } }) }, enabled: true });
    expect((await nf.markDroppedOff([UPS])).message).toMatch(/not installed in the database yet/);
    expect(D.friendlyError({ code: '23505', message: 'Tracking number X is already on another order. One label belongs to one parcel.' })).toMatch(/already on another order/);
    expect(D.friendlyError({ message: 'Failed to fetch' })).toMatch(/Could not reach the database/);
  });
});

// ---------- the Orders section ----------
async function on(page) { await page.addInitScript(() => { try { localStorage.setItem('he_dropoff', 'on'); } catch (e) {} }); }
const sec = (page) => page.locator('#dropoffHost');
const rpcCalls = (backend, name) => backend.requests.filter(r => r.rpc === name);

test.describe('the Orders section', () => {
  test('switch OFF (default): Orders is exactly as before', async ({ page }) => {
    await login(page); await gotoPage(page, 'ordersPanel');
    await expect(page.locator('#ordersPanel h2').first()).toBeVisible();
    await expect(sec(page)).toHaveCount(0);
  });

  test('paste a receipt, check the numbers found, mark them; a number on no order is added to its order', async ({ page, backend }) => {
    await on(page);
    backend.tables.orders = [
      { id: '00000000-0000-4000-8000-00000000e001', channel: 'shopify', source: 'shopify', order_number: '1042', customer_name: 'SYNTHETIC Ana', status: 'paid', currency: 'USD', total: 24, placed_at: '2026-11-23T15:00:00Z', created_at: '2026-11-23T15:00:00Z', deleted_at: null },
      { id: '00000000-0000-4000-8000-00000000e002', channel: 'shopify', source: 'shopify', order_number: '1043', customer_name: 'SYNTHETIC Bo', status: 'paid', currency: 'USD', total: 18, placed_at: '2026-11-23T16:00:00Z', created_at: '2026-11-23T16:00:00Z', deleted_at: null }];
    const order = backend.tables.orders[0];
    const state = { added: {} };
    backend.rpc.mark_dropped_off = (b) => ({ ok: true, results: (b.p_trackings || []).map(t => (
      t === UPS ? { tracking: t, result: 'marked', order_id: order.id, status: 'dropped_off' }
      : t === USPS ? { tracking: t, result: 'already', order_id: order.id, status: 'in_transit' }
      : state.added[t] ? { tracking: t, result: 'marked', order_id: state.added[t], status: 'dropped_off' }
      : { tracking: t, result: 'not_found' })) });
    backend.rpc.add_shipment = (b) => { state.added[b.p_tracking] = b.p_order_id; return { ok: true, duplicate: false, id: '00000000-0000-4000-8000-00000000d001' }; };
    await login(page); await gotoPage(page, 'ordersPanel');
    const s = sec(page);
    await expect(s.locator('h3')).toContainText('Drop-off receipt');
    await s.locator('#doText').fill(RECEIPT);
    await s.locator('[data-do="find"]').click();
    await expect(s.locator('[data-domessage]')).toContainText('4 tracking numbers found (1 to check');
    await expect(s.locator('[data-dopick]')).toHaveCount(4);
    await expect(s.locator('[data-dopick]:checked')).toHaveCount(3);            // the FedEx one is not ticked
    await expect(s.locator('[data-do="mark"]')).toHaveText('Mark 3 parcels dropped off');
    await s.locator(`[data-dopick="${FDX}"]`).check();
    await expect(s.locator('[data-do="mark"]')).toHaveText('Mark 4 parcels dropped off');
    await s.locator(`[data-dopick="${FDX}"]`).uncheck();
    await s.locator('[data-do="mark"]').dblclick();
    await expect(s.locator('[data-doresults] .doSentence')).toHaveText('1 parcel marked dropped off, 1 already done, 1 not on any order yet.');
    expect(rpcCalls(backend, 'mark_dropped_off').length).toBe(1);                // a double click sent it once
    expect(rpcCalls(backend, 'mark_dropped_off')[0].body.p_trackings.sort()).toEqual([INTL, UPS, USPS].sort());
    await expect(s.locator('tr[data-doresult="marked"]')).toContainText('#' + order.order_number);
    // the number on no order: choose its order, add and mark
    const row = s.locator('tr[data-doresult="not_found"]');
    await row.locator('select').selectOption(order.id);
    await row.locator('[data-doattach]').click();
    await expect(s.locator('[data-doresults] .doSentence')).toHaveText('2 parcels marked dropped off, 1 already done.');
    expect(rpcCalls(backend, 'add_shipment').map(r => r.body)).toEqual([{ p_order_id: order.id, p_carrier: 'usps', p_tracking: INTL, p_source: 'typed' }]);
    // start again
    await s.locator('[data-do="clear"]').click();
    await expect(s.locator('[data-dopick]')).toHaveCount(0);
    await expect(s.locator('#doText')).toHaveValue('');
  });

  test('not installed yet: says so plainly and changes nothing', async ({ page, backend }) => {
    await on(page);
    backend.rpc.mark_dropped_off = () => ({ __error: { status: 404, code: 'PGRST202', message: 'Could not find the function public.mark_dropped_off(p_trackings) in the schema cache' } });
    await login(page); await gotoPage(page, 'ordersPanel');
    const s = sec(page);
    await s.locator('#doText').fill(UPS);
    await s.locator('[data-do="find"]').click();
    await s.locator('[data-do="mark"]').click();
    await expect(s.locator('[data-domessage]')).toContainText('not installed in the database yet');
    await expect(s.locator('[data-doresults]')).toHaveCount(0);
  });

  test('nothing found: says what to do', async ({ page }) => {
    await on(page);
    await login(page); await gotoPage(page, 'ordersPanel');
    await sec(page).locator('#doText').fill('Thank you for shopping\nTotal $12.40');
    await sec(page).locator('[data-do="find"]').click();
    await expect(sec(page).locator('[data-domessage]')).toContainText('No tracking number found');
    await expect(sec(page).locator('[data-do="mark"]')).toHaveCount(0);
  });

  test('readable in light and dark; every control named', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'colours are the same at phone size');
    await on(page);
    backend.rpc.mark_dropped_off = (b) => ({ ok: true, results: (b.p_trackings || []).map(t => ({ tracking: t, result: t === UPS ? 'marked' : 'not_found' })) });
    await login(page);
    const check = (loc) => loc.evaluate((root, src) => (new Function('return ' + src)())(root), contrastFailures.toString());
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await gotoPage(page, 'ordersPanel');
      await sec(page).locator('#doText').fill(RECEIPT);
      await sec(page).locator('[data-do="find"]').click();
      await sec(page).locator('[data-do="mark"]').click();
      await expect(sec(page).locator('[data-doresults]')).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
      expect(await check(sec(page)), scheme).toEqual([]);
      expect(await sec(page).evaluate(unnamedControls), scheme).toEqual([]);
      await sec(page).locator('[data-do="clear"]').click();
    }
  });

  test('at phone size it fits and the buttons are easy to tap', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'iphone', 'phone only');
    await on(page);
    backend.rpc.mark_dropped_off = (b) => ({ ok: true, results: (b.p_trackings || []).map(t => ({ tracking: t, result: 'not_found' })) });
    await login(page); await gotoPage(page, 'ordersPanel');
    await sec(page).locator('#doText').fill(RECEIPT);
    await sec(page).locator('[data-do="find"]').click();
    await sec(page).locator('[data-do="mark"]').click();
    await expect(sec(page).locator('[data-doresults]')).toBeVisible();
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)).toBeLessThanOrEqual(1);
    const small = await sec(page).evaluate(hst => [...hst.querySelectorAll('button')].map(b => b.getBoundingClientRect()).filter(r => r.width > 0 && (r.height < 32 || r.width < 32)).length);
    expect(small).toBe(0);
  });
});
