// Settings shared by every device (owner, Nov 24: "I need everything to be updated
// everywhere right away"): the Real profit estimates are saved in the database
// (docs/ops/sql/drafts/50) so every phone and computer shows the same numbers.
// assets/views/he-shared-settings.js. Until the database step is installed the
// numbers stay in the browser (real-profit-ext24). Every value is made up.
const S = require('../../assets/views/he-shared-settings.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const id = (n) => '00000000-0000-4000-8000-0000000' + String(n).padStart(5, '0');
const reader = (res) => ({ from: () => ({ select: () => ({ eq: () => ({ limit: async () => res }) }) }) });

test.describe('the store (no browser)', () => {
  test('what may be saved: a small list of named values, never anything named like a secret', ({}, ti) => {
    node(ti);
    expect(S.checkValue('profit_estimates', { postage: 4, fees: { etsy: { percent: 9.5 } } })).toMatchObject({ ok: true, value: { postage: 4 } });
    expect(S.checkValue('Bad Key', {}).ok).toBe(false);
    expect(S.checkValue('x', {}).ok).toBe(false);
    expect(S.checkValue('list_value', [1, 2])).toMatchObject({ ok: false, reason: 'A setting must be a list of named values.' });
    expect(S.checkValue('big_value', { t: 'a'.repeat(9000) })).toMatchObject({ ok: false, reason: 'This setting is too large to save.' });
    for (const name of ['password', 'api_key', 'apiKey', 'service_token', 'client_secret', 'recovery_codes']) {
      expect(S.checkValue('some_setting', { nested: [{ [name]: 'x' }] }), name).toMatchObject({ ok: false, reason: 'Passwords, keys and tokens are never saved as settings.' });
    }
    const loop = {}; loop.self = loop;
    expect(S.checkValue('loop_value', loop).ok).toBe(false);
  });

  test('reading: installed with a value, installed without, not installed, could not check', async ({}, ti) => {
    node(ti);
    const store = (res) => S.createStore({ client: reader(res) });
    expect(await store({ data: [{ key: 'profit_estimates', value: { postage: 5 }, updated_at: '2026-11-24T16:00:00Z', updated_by: id(1) }] }).get('profit_estimates'))
      .toMatchObject({ state: 'installed', value: { postage: 5 }, updatedAt: '2026-11-24T16:00:00Z' });
    expect(await store({ data: [] }).get('profit_estimates')).toMatchObject({ state: 'installed', value: null });
    expect(await store({ data: [{ value: 'not an object' }] }).get('profit_estimates')).toMatchObject({ state: 'installed', value: null });
    expect(await store({ error: { code: 'PGRST205', message: 'Could not find the table' } }).get('profit_estimates')).toMatchObject({ state: 'not_installed', value: null });
    expect(await store({ error: { code: '42P01', message: 'relation does not exist' } }).get('profit_estimates')).toMatchObject({ state: 'not_installed' });
    expect(await store({ error: { code: '42501', message: 'permission denied' } }).get('profit_estimates')).toMatchObject({ state: 'unknown', value: null });
    expect(await S.createStore({ client: { from: () => { throw new Error('x'); } } }).get('profit_estimates')).toMatchObject({ state: 'unknown' });
    expect(await S.createStore({ client: null }).get('profit_estimates')).toMatchObject({ state: 'unknown' });
    expect(await store({ data: [] }).get('Bad Key')).toMatchObject({ state: 'unknown' });
  });

  test('saving: one database function, plain words when it is refused, nothing sent when the value is not allowed', async ({}, ti) => {
    node(ti);
    const calls = [];
    const client = (res) => ({ from: () => ({}), rpc: async (name, args) => { calls.push([name, args]); return res; } });
    expect(await S.createStore({ client: client({ data: { ok: true, key: 'profit_estimates', updated_at: '2026-11-24T16:00:00Z' } }) }).set('profit_estimates', { postage: 5 }))
      .toMatchObject({ ok: true, updatedAt: '2026-11-24T16:00:00Z' });
    expect(calls).toEqual([['set_shared_setting', { p_key: 'profit_estimates', p_value: { postage: 5 }, p_audience: 'owner_admin' }]]);
    expect(await S.createStore({ client: client({ error: { code: '42501', message: 'Only the owner can change a shared setting.' } }) }).set('profit_estimates', { postage: 5 }))
      .toMatchObject({ ok: false, message: 'Only the owner can change a shared setting.' });
    expect(await S.createStore({ client: client({ error: { code: 'PGRST202', message: 'Could not find the function' } }) }).set('profit_estimates', { postage: 5 }))
      .toMatchObject({ ok: false, notInstalled: true });
    calls.length = 0;
    expect(await S.createStore({ client: client({ data: {} }) }).set('profit_estimates', { api_key: 'x' })).toMatchObject({ ok: false, message: 'Passwords, keys and tokens are never saved as settings.' });
    expect(calls).toEqual([]);
  });
});

const PRODUCTS = [{ id: id(1), sku: 'LAV-30', name: 'Lavender oil 30ml', cost: 4 }];
const ORDERS = [{ id: id(11), order_number: 'HE-1001', channel: 'shopify', source: 'shopify', status: 'paid', subtotal: 30, shipping_total: 5, tax_total: 2.4, total: 37.4, placed_at: '2026-11-10T15:00:00Z', deleted_at: null }];
const ITEMS = [{ id: id(101), order_id: id(11), sku: 'LAV-30', product_name: 'Lavender oil 30ml', quantity: 2, unit_price: 15, line_total: 30 }];
// HE-1001: 3500 sales - 800 cost - 132 fee = 2568 before postage and packaging

async function seed(page, backend, shared) {
  await page.clock.setFixedTime(new Date('2026-11-24T16:00:00Z'));
  backend.tables.orders = ORDERS.map(o => Object.assign({}, o));
  backend.tables.order_items = ITEMS.map(o => Object.assign({}, o));
  backend.tables.products = PRODUCTS.map(o => Object.assign({}, o));
  backend.tables.purchase_order_items = [];
  backend.tables.shared_settings = shared ? [{ id: 'profit_estimates', key: 'profit_estimates', value: shared, audience: 'owner_admin', updated_at: '2026-11-23T15:00:00Z', updated_by: id(1) }] : [];
  // the browser holds DIFFERENT numbers (postage 4, packaging 1), to show which copy wins
  await page.addInitScript(() => { try { localStorage.setItem('he_real_profit', 'on'); if (!localStorage.getItem('he_profit_estimates')) localStorage.setItem('he_profit_estimates', JSON.stringify({ postage: 4, packaging: 1 })); } catch (e) {} });
}

test.describe('Real profit with the shared settings installed', () => {
  test('the numbers every device shares win over this browser\'s copy; saving goes to the database', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await seed(page, backend, { postage: 6, packaging: 2 });
    backend.rpc.set_shared_setting = (body) => {
      backend.tables.shared_settings = [{ id: body.p_key, key: body.p_key, value: body.p_value, audience: body.p_audience, updated_at: '2026-11-24T16:00:00Z', updated_by: id(1) }];
      return { ok: true, key: body.p_key, updated_at: '2026-11-24T16:00:00Z' };
    };
    await login(page); await gotoPage(page, 'accountingPanel');
    const host = page.locator('#realProfitHost');
    await expect(host.locator('[data-rpprofit]')).toHaveText('$17.68');          // 2568 - 600 - 200 (the shared copy), not - 400 - 100
    await host.getByRole('button', { name: 'Fee and postage estimates' }).click();
    await expect(host.locator('[data-rpshared]')).toHaveAttribute('data-rpshared', 'installed');
    await expect(host.locator('[data-rpshared]')).toContainText('These numbers are the same on every phone and computer');
    await expect(host.getByLabel('Postage per order ($)')).toHaveValue('6');
    await host.getByLabel('Postage per order ($)').fill('7');
    await host.getByRole('button', { name: 'Save estimates' }).click();
    await expect(host.locator('[data-rpmessage]')).toHaveText('Estimates saved for every phone and computer.');
    await expect(host.locator('[data-rpprofit]')).toHaveText('$16.68');
    const saves = backend.requests.filter(r => r.rpc === 'set_shared_setting');
    expect(saves).toHaveLength(1);
    expect(saves[0].body).toMatchObject({ p_key: 'profit_estimates', p_audience: 'owner_admin', p_value: { postage: 7, packaging: 2 } });
    // nothing else was written
    expect(backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && !r.rpc && String(r.path || '').startsWith('/rest/v1/')).map(r => r.method + ' ' + r.path)).toEqual([]);
    // "another device": a browser with no numbers of its own shows the saved ones
    await page.evaluate(() => localStorage.removeItem('he_profit_estimates'));
    await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'accountingPanel');
    await expect(page.locator('#realProfitHost [data-rpprofit]')).toHaveText('$16.68');
  });

  test('installed but nothing saved yet: this browser\'s numbers show, and it says they are not shared yet', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await seed(page, backend, null);
    await login(page); await gotoPage(page, 'accountingPanel');
    const host = page.locator('#realProfitHost');
    await expect(host.locator('[data-rpprofit]')).toHaveText('$20.68');          // 2568 - 400 - 100 (this browser)
    await host.getByRole('button', { name: 'Fee and postage estimates' }).click();
    await expect(host.locator('[data-rpshared]')).toHaveText('Not shared yet: press Save estimates and every phone and computer will use them.');
  });

  test('when the database refuses (not the owner), it says so and nothing changes anywhere', async ({ page, backend }, ti) => {
    test.skip(ti.project.name !== 'desktop', 'run once');
    await seed(page, backend, { postage: 6, packaging: 2 });
    backend.tables.profiles[0].role = 'administrator';
    backend.rpc.set_shared_setting = () => ({ __error: { status: 403, code: '42501', message: 'Only the owner can change a shared setting.' } });
    await login(page); await gotoPage(page, 'accountingPanel');
    const host = page.locator('#realProfitHost');
    await expect(host.locator('[data-rpprofit]')).toHaveText('$17.68');
    await host.getByRole('button', { name: 'Fee and postage estimates' }).click();
    await host.getByLabel('Postage per order ($)').fill('1');
    await host.getByRole('button', { name: 'Save estimates' }).click();
    await expect(host.locator('[data-rpmessage]')).toHaveText('Only the owner can change a shared setting. Nothing was changed.');
    await expect(host.locator('[data-rpprofit]')).toHaveText('$17.68');
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('he_profit_estimates')))).toEqual({ postage: 4, packaging: 1 });
  });
});
