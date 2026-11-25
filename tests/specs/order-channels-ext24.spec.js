// The sales channel on every order (owner's list: "All Orders with channel
// badges"; Shopify is the hub, so Amazon, Etsy and TikTok orders arrive in the
// same list). Behind he_order_channels (OFF). assets/views/he-order-channels.js.
// Reads only; every value is made up.
const C = require('../../assets/views/he-order-channels.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const order = (n, channel, extra) => Object.assign({ id: 'o-' + n, order_number: '#' + (1000 + n), customer_name: 'SYNTHETIC customer ' + n, customer_email: null, status: 'paid', currency: 'USD', total: 10 + n,
  placed_at: '2026-11-' + String(24 - Math.floor(n / 3)).padStart(2, '0') + 'T' + String(23 - (n % 20)).padStart(2, '0') + ':00:00Z', deleted_at: null, channel }, extra || {});

test.describe('naming and counting (no browser)', () => {
  test('however the channel is written, the order gets one of seven badges', ({}, ti) => {
    node(ti);
    const of = (channel, source) => C.channelOf({ channel, source });
    expect(['shopify', 'Shopify', ' online store ', 'website', 'ONLINE-STORE'].map(c => of(c))).toEqual(['shopify', 'shopify', 'shopify', 'shopify', 'shopify']);
    expect(['amazon', 'Amazon.com', 'etsy', 'tiktok', 'TikTok Shop', 'tik-tok'].map(c => of(c))).toEqual(['amazon', 'amazon', 'etsy', 'tiktok', 'tiktok', 'tiktok']);
    expect(['wholesale', 'B2B', 'manual', 'phone', 'in person'].map(c => of(c))).toEqual(['wholesale', 'wholesale', 'manual', 'manual', 'manual']);
    expect([of('ebay'), of(''), of(null), of(undefined, 'etsy'), of('   ', 'amazon'), of(7), of('__proto__'), of('constructor')]).toEqual(['other', 'other', 'other', 'etsy', 'amazon', 'other', 'other', 'other']);
    for (const junk of [null, undefined, 'x', 7, [], {}]) expect(C.channelOf(junk)).toBe('other');
    expect(Object.keys(C.NAMES)).toEqual(C.ORDER);
  });

  test('counts per channel in a fixed order, only channels that occur; one channel picked out', ({}, ti) => {
    node(ti);
    const list = [order(1, 'etsy'), order(2, 'shopify'), order(3, 'amazon'), order(4, 'shopify'), order(5, 'ebay'), order(6, null), null, 'x'];
    expect(C.tally(list)).toEqual([{ key: 'shopify', name: 'Website', count: 2 }, { key: 'amazon', name: 'Amazon', count: 1 }, { key: 'etsy', name: 'Etsy', count: 1 }, { key: 'other', name: 'Other', count: 2 }]);
    expect(C.pick(list, 'shopify').map(o => o.id)).toEqual(['o-2', 'o-4']);
    expect(C.pick(list, 'all')).toHaveLength(6);
    expect(C.pick(list, 'nonsense')).toHaveLength(6);
    expect(C.pick(list, 'tiktok')).toEqual([]);
    expect(C.tally(null)).toEqual([]); expect(C.pick(null, 'etsy')).toEqual([]);
  });
});

const on = (page) => page.addInitScript(() => { try { localStorage.setItem('he_order_channels', 'on'); } catch (e) {} });
const selectOf = (r) => (r.params.find(([k]) => k === 'select') || [])[1] || '';

test.describe('on the Orders page', () => {
  test('switch off (as shipped): no badge, no buttons, and the channel is not asked for', async ({ page, backend }) => {
    backend.tables.orders = [order(1, 'etsy'), order(2, 'shopify')];
    await login(page);
    await gotoPage(page, 'ordersPanel');
    await expect(page.locator('#ordersTableWrap tbody tr')).toHaveCount(2);
    await expect(page.locator('#ordersTableWrap [data-ochbar]')).toHaveCount(0);
    await expect(page.locator('#ordersTableWrap [data-ochbadge]')).toHaveCount(0);
    await expect(page.locator('#ordersTableWrap thead th')).toHaveCount(6);
    expect(backend.requests.filter(r => r.table === 'orders' && r.method === 'GET' && /customer_email/.test(selectOf(r)) && /channel/.test(selectOf(r)))).toEqual([]);
  });

  test('each order shows where it was sold; a button shows one channel, with counts; All brings every order back', async ({ page, backend }) => {
    backend.tables.orders = [order(1, 'etsy'), order(2, 'shopify'), order(3, 'Amazon'), order(4, 'online store'), order(5, 'tiktok shop'), order(6, null), order(7, 'etsy')];
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const wrap = page.locator('#ordersTableWrap');
    await expect(wrap.locator('tbody tr')).toHaveCount(7);
    await expect(wrap.locator('thead th').nth(2)).toHaveText('Sold on');
    await expect(wrap.locator('[data-ochbar] button')).toHaveText(['All 7', 'Website 2', 'Amazon 1', 'Etsy 2', 'TikTok 1', 'Other 1']);
    await expect(wrap.locator('tr[data-id="o-3"] [data-ochbadge]')).toHaveText('Amazon');
    await expect(wrap.locator('tr[data-id="o-4"] [data-ochbadge]')).toHaveText('Website');
    await expect(wrap.locator('tr[data-id="o-6"] [data-ochbadge]')).toHaveText('Other');
    await expect(wrap.locator('[data-ochannel="all"]')).toHaveAttribute('aria-pressed', 'true');

    await wrap.locator('[data-ochannel="etsy"]').click();
    await expect(wrap.locator('tbody tr')).toHaveCount(2);
    await expect(wrap.locator('[data-ochbadge]')).toHaveText(['Etsy', 'Etsy']);
    await expect(wrap.locator('[data-ochannel="etsy"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(wrap.locator('[data-ochannel="etsy"]')).toBeFocused();
    await expect(wrap.locator('[data-ochnote]')).toHaveText('Showing the 2 most recent Etsy orders.');
    await expect(page.locator('#orderStats')).toContainText('7');                 // the totals above still count every order

    await wrap.locator('[data-ochannel="all"]').click();
    await expect(wrap.locator('tbody tr')).toHaveCount(7);
    expect(backend.tableWrites()).toEqual([]);
  });

  test('more than 15 orders of one channel: the newest 15 are shown and the note says of how many', async ({ page, backend }) => {
    backend.tables.orders = Array.from({ length: 20 }, (_, i) => order(i + 1, i < 18 ? 'shopify' : 'etsy'));
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    const wrap = page.locator('#ordersTableWrap');
    await wrap.locator('[data-ochannel="shopify"]').click();
    await expect(wrap.locator('tbody tr')).toHaveCount(15);
    await expect(wrap.locator('[data-ochnote]')).toHaveText('Showing the 15 most recent Website orders of 18.');
  });

  test('the channel buttons and badges fit the screen (no sideways scrolling)', async ({ page, backend }) => {
    backend.tables.orders = ['shopify', 'amazon', 'etsy', 'tiktok', 'wholesale', 'manual', 'ebay'].map((c, i) => order(i + 1, c));
    await on(page);
    await login(page);
    await gotoPage(page, 'ordersPanel');
    await expect(page.locator('#ordersTableWrap [data-ochbar] button')).toHaveCount(8);
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth, out = [];
      document.querySelectorAll('#ordersTableWrap [data-ochbar], #ordersTableWrap [data-ochbar] *, #ordersTableWrap [data-ochbadge]').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > w + 1) out.push(el.tagName + ' ' + Math.round(r.right) + '>' + w); });
      return out.concat(document.documentElement.scrollWidth > w + 1 ? ['page scrolls sideways'] : []);
    });
    expect(over).toEqual([]);
  });
});
