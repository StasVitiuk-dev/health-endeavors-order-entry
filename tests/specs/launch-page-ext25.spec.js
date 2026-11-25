// "Ready to launch" (owner, Nov 24: "Ready to launch page: yes"). A page in Overview,
// behind the preview switch he_launch_page (off by default), for the owner and
// administrators. The dashboard checks what it can read; a person marks the rest done.
// Two-step sign-in is the last line. assets/views/he-launch.js. Every value is made up.
const L = require('../../assets/views/he-launch.js');
const { test, expect, login, gotoPage } = require('../helpers/dashboard');

const node = (ti) => test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
const NOW = Date.parse('2026-11-25T18:00:00Z');
const step = (key, state, extra) => Object.assign({ key: key, name: 'SYNTHETIC ' + key, needsStep: true, state: state }, extra || {});
const product = (n, extra) => Object.assign({ id: 'p' + n, sku: 'SKU-' + n, name: 'SYNTHETIC product ' + n, is_active: true, status: 'active', retail_price: 24 }, extra || {});
const inv = (n, available, level) => ({ id: 'inv' + n, product_id: 'p' + n, available: available, low_stock_threshold: level });
const allReady = () => ({ steps: [step('a', 'installed'), step('b', 'installed'), step('c', 'not_installed', { needsStep: false })], products: [product(1), product(2)], stock: [inv(1, 40, 10), inv(2, 12, 5)],
  shopify: { switchOn: true, orders: 3 }, tax: { state: 'installed', inForce: 1 }, questions: [] });
const states = (r) => Object.fromEntries(r.lines.map(l => [l.key, l.state]));

test.describe('the rules (no browser)', () => {
  test('fourteen lines in a fixed order; six are checked by the dashboard, eight by a person; two-step sign-in is the last', ({}, ti) => {
    node(ti);
    expect(L.LINES.map(l => l.key)).toEqual(['steps', 'products', 'stock', 'shopify', 'tax', 'questions', 'email', 'people', 'printers', 'backups', 'rehearsal', 'agents', 'policies', 'twostep']);
    expect(L.LINES.filter(l => l.kind === 'auto')).toHaveLength(6);
    expect(L.YOURS).toEqual(['email', 'people', 'printers', 'backups', 'rehearsal', 'agents', 'policies', 'twostep']);
    expect(L.LINES.filter(l => l.last).map(l => l.key)).toEqual(['twostep']);
    expect(L.LINES[L.LINES.length - 1].key).toBe('twostep');
    for (const l of L.LINES) { expect(l.title.length).toBeGreaterThan(10); expect(l.why.length).toBeGreaterThan(20); }
  });

  test('everything in order and every line marked: 14 of 14; with nothing marked the six checked lines are ready and eight are to do', ({}, ti) => {
    node(ti);
    const none = L.build(allReady());
    expect([none.ready, none.total, none.left, none.unknown, none.state]).toEqual([6, 14, 8, 0, 'todo']);
    let ticks = {};
    L.YOURS.forEach((k, n) => { ticks = L.tick(ticks, k, true, 'SYNTHETIC Owner', NOW + n); });
    const all = L.build(Object.assign(allReady(), { ticks: ticks }));
    expect([all.ready, all.total, all.left, all.state]).toEqual([14, 14, 0, 'ready']);
    expect(all.lines.find(l => l.key === 'twostep').tick).toEqual({ on: true, at: NOW + 7, by: 'SYNTHETIC Owner' });
    expect(all.lines.find(l => l.key === 'steps').detail).toBe('All 2 are installed.');           // the one that needs no step is not counted
  });

  test('each checked line says what is missing, in words', ({}, ti) => {
    node(ti);
    const r = L.build({ steps: [step('a', 'installed'), step('b', 'not_installed'), step('c', 'unknown')],
      products: [product(1), product(2, { retail_price: null }), product(3, { is_active: false, retail_price: null }), product(4, { status: 'discontinued', retail_price: 0 })],
      stock: [inv(1, 0, 10), inv(2, 9, null)], shopify: { switchOn: false, orders: 0 }, tax: { state: 'off' }, questions: [{ id: 1, status: 'new' }, { id: 2, status: 'needs_review' }, { id: 3, status: 'answered' }] });
    expect(states(r)).toMatchObject({ steps: 'todo', products: 'todo', stock: 'todo', shopify: 'todo', tax: 'todo', questions: 'todo' });
    const d = Object.fromEntries(r.lines.map(l => [l.key, l.detail]));
    expect(d.steps).toBe('1 of 3 installed. Still to install: SYNTHETIC b. 1 step could not be checked.');
    expect(d.products).toBe('2 products for sale; 1 with no price: SYNTHETIC product 2.');
    expect(d.stock).toBe('1 product has nothing counted; 1 product has no alert level.');
    expect(d.shopify).toBe('The Shopify order switch is off. It is kept off on purpose until the stock steps are installed; it is one of the last switches to turn on.');
    expect(d.tax).toBe('The step is installed. Turn on "Confirmed tax rates" on Feature Flags, then confirm your rate on Tax Records.');
    expect(d.questions).toBe('2 customers are waiting for an answer.');
    expect(L.build(Object.assign(allReady(), { shopify: { switchOn: true, orders: 0 } })).lines[3].state).toBe('todo');
    expect(L.build(Object.assign(allReady(), { shopify: { switchOn: 'missing', orders: 0 } })).lines[3].detail).toBe('The Shopify order switch does not exist in the database yet.');
    expect(L.build(Object.assign(allReady(), { tax: { state: 'not_installed' } })).lines[4].state).toBe('todo');
    expect(L.build(Object.assign(allReady(), { tax: { state: 'installed', inForce: 0 } })).lines[4].detail).toBe('No rate is confirmed for today. Confirm it on Tax Records.');
    expect(L.build(Object.assign(allReady(), { products: [] })).lines[1].detail).toBe('No product for sale yet. Add your products on Inventory (or import the list).');
  });

  test('a line that could not be read is "Could not check", never ready', ({}, ti) => {
    node(ti);
    for (const junk of [null, undefined, 'x', 7, [], {}]) {
      const r = L.build(junk);
      expect(states(r)).toMatchObject({ steps: 'unknown', products: 'unknown', stock: 'unknown', shopify: 'unknown', tax: 'unknown', questions: 'unknown' });
      expect([r.ready, r.unknown, r.state]).toEqual([0, 6, 'unknown']);
    }
    const odd = L.build({ steps: [step('a', 'installed'), step('b', 'weird')], products: 'x', stock: [null], shopify: { switchOn: 'yes', orders: -1 }, tax: { state: 'installed', inForce: 'many' }, questions: 7 });
    expect(Object.values(states(odd)).slice(0, 6)).toEqual(['unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown']);
    expect(odd.lines[0].detail).toBe('1 of 2 installed; 1 step could not be checked.');
  });

  test('marks: only the eight "confirmed by you" lines; a new mark is later than the one it replaces; two devices are joined, the later mark of each line wins', ({}, ti) => {
    node(ti);
    let a = L.tick({}, 'printers', true, '  SYNTHETIC   Owner ', NOW);
    expect(a).toEqual({ printers: { on: true, at: NOW, by: 'SYNTHETIC Owner' } });
    expect(L.tick(a, 'steps', true, 'x', NOW)).toEqual(a);                         // a checked line cannot be marked by hand
    expect(L.tick(a, 'nonsense', true, 'x', NOW)).toEqual(a);
    a = L.tick(a, 'printers', false, 'SYNTHETIC Admin', NOW - 5000);               // a clock that is behind: still later than the mark it replaces
    expect(a.printers).toEqual({ on: false, at: NOW + 1, by: 'SYNTHETIC Admin' });
    const b = L.tick(L.tick({}, 'printers', true, 'SYNTHETIC Owner', NOW + 9), 'email', true, 'SYNTHETIC Owner', NOW + 3);
    expect(L.merge(a, b)).toEqual({ email: { on: true, at: NOW + 3, by: 'SYNTHETIC Owner' }, printers: { on: true, at: NOW + 9, by: 'SYNTHETIC Owner' } });
    expect(L.merge(b, a)).toEqual(L.merge(a, b));
    // what is kept is checked again on the way in
    expect(L.clean({ ticks: { printers: { on: 'yes', at: NOW }, email: { on: true, at: -1 }, people: { on: true, at: NOW, by: 'x'.repeat(500) }, steps: { on: true, at: NOW }, __proto__: { on: true, at: NOW } } }))
      .toEqual({ people: { on: true, at: NOW, by: 'x'.repeat(80) } });
    for (const junk of [null, undefined, 'x', 7, [], { ticks: 'x' }]) expect(L.clean(junk)).toEqual({});
  });
});

// ---------- on the page ----------
const order = (n, source, day) => ({ id: 'o-' + n, order_number: 'HE-' + (1000 + n), customer_name: 'SYNTHETIC client ' + n, status: 'paid', currency: 'USD', total: 20, channel: source, source: source, placed_at: '2026-11-' + String(day).padStart(2, '0') + 'T15:00:00Z', deleted_at: null });
function seed(backend, opts) {
  const o = opts || {};
  backend.tables.products = [product(1), product(2, { retail_price: o.ready ? 18 : null })];
  backend.tables.inventory = [Object.assign(inv(1, 40, 10), { reserved: 0 }), Object.assign(inv(2, o.ready ? 30 : 0, o.ready ? 5 : null), { reserved: 0 })];
  backend.tables.orders = o.ready ? [order(1, 'shopify', 20), order(2, 'manual', 21)] : [order(2, 'manual', 21)];
  backend.tables.customer_inquiries = o.ready ? [] : [{ id: 'q1', status: 'new', created_at: '2026-11-24T15:00:00Z', customer_name: 'SYNTHETIC asker' }];
  const flags = backend.tables.feature_flags || (backend.tables.feature_flags = []);
  const sync = flags.find(f => f.flag_key === 'shopify_order_sync');
  if (sync) sync.enabled = !!o.ready; else flags.push({ id: 'ff-sync', flag_key: 'shopify_order_sync', label: 'Shopify Order Sync', description: 'SYNTHETIC', enabled: !!o.ready });
}
async function open(page, backend, opts) {
  const o = opts || {};
  await page.clock.setFixedTime(new Date(NOW));
  seed(backend, o);
  if (o.role) backend.tables.profiles[0].role = o.role;
  // database steps that are not installed: their table does not exist (the made-up database answers for any other table)
  for (const table of (o.missing || [])) await page.route('**/rest/v1/' + table + '?*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public." + table + "' in the schema cache" }) }));
  await page.addInitScript(() => { try { localStorage.setItem('he_launch_page', 'on'); } catch (e) {} });
  await login(page);
  await gotoPage(page, 'launchPanel');
  await expect(page.locator('#launchPanel h2')).toHaveText('Ready to launch');
}
const line = (page, key) => page.locator('#launchPanel [data-lpline="' + key + '"]');
const writes = (backend) => backend.requests.filter(r => r.method && r.method !== 'GET' && r.method !== 'HEAD' && String(r.path || '').startsWith('/rest/v1/') && !r.rpc);

test('switch OFF (the default): no page in the menu and nothing drawn', async ({ page }) => {
  await login(page);
  await expect(page.locator('#sidebarNav')).not.toContainText('Ready to launch');
  await expect(page.locator('#launchPanel')).toBeEmpty();
});

test('the page shows what is ready and what is not, in words, and where to go; nothing is written', async ({ page, backend }) => {
  await open(page, backend, { missing: ['tax_rates', 'order_costs'] });
  const host = page.locator('#launchPanel');
  await expect(page.locator('#sidebarNav')).toContainText('Ready to launch');
  await expect(host.locator('[data-lpline]')).toHaveCount(14);
  await expect(host.locator('[data-lpline]').last()).toHaveAttribute('data-lpline', 'twostep');
  await expect(line(page, 'twostep')).toContainText('(the last step)');
  await expect(line(page, 'products')).toHaveAttribute('data-lpstate', 'todo');
  await expect(line(page, 'products').locator('[data-lpdetail]')).toHaveText('2 products for sale; 1 with no price: SYNTHETIC product 2.');
  await expect(line(page, 'stock').locator('[data-lpdetail]')).toHaveText('1 product has nothing counted; 1 product has no alert level.');
  await expect(line(page, 'shopify').locator('[data-lpdetail]')).toContainText('The Shopify order switch is off.');
  await expect(line(page, 'questions').locator('[data-lpdetail]')).toHaveText('1 customer is waiting for an answer.');
  await expect(line(page, 'questions').locator('[data-lpbadge]')).toHaveText('To do');
  // the database steps: two of the thirteen are not installed here, and they are named
  await expect(line(page, 'steps')).toHaveAttribute('data-lpstate', 'todo');
  await expect(line(page, 'steps').locator('[data-lpdetail]')).toHaveText('11 of 13 installed. Still to install: Confirmed tax rates; Real fees and postage per order.');
  await expect(line(page, 'tax').locator('[data-lpdetail]')).toHaveText('Its database step is not installed yet (Feature Flags shows which).');
  await expect(host.locator('[data-lptotal]')).toHaveAttribute('data-lptotal', '0/14');
  await expect(host.locator('progress')).toHaveAttribute('value', '0');
  // a line takes you to its page
  await line(page, 'questions').locator('[data-lpgoto="inquiriesPanel"]').click();
  await expect(page.locator('#inquiriesPanel')).toBeVisible();
  expect(writes(backend)).toEqual([]);
});

test('with the records in order the checked lines are ready', async ({ page, backend }) => {
  await open(page, backend, { ready: true });
  for (const key of ['steps', 'products', 'stock', 'shopify', 'questions']) await expect(line(page, key)).toHaveAttribute('data-lpstate', 'ready');
  await expect(line(page, 'steps').locator('[data-lpdetail]')).toHaveText('All 13 are installed.');
  // the tax step is installed but its switch is off in this browser: the line says what to do next
  await expect(line(page, 'tax').locator('[data-lpdetail]')).toHaveText('The step is installed. Turn on "Confirmed tax rates" on Feature Flags, then confirm your rate on Tax Records.');
  await expect(line(page, 'shopify').locator('[data-lpdetail]')).toHaveText('The switch is on; 1 order has come from Shopify in the last 30 days.');
  await expect(line(page, 'products').locator('[data-lpbadge]')).toHaveText('Ready');
  await expect(page.locator('#launchPanel [data-lptotal]')).toHaveAttribute('data-lptotal', '5/14');
});

test('a line the database would not give says "Could not check"; "Check again" reads it afresh', async ({ page, backend }) => {
  await open(page, backend, { ready: true });
  let fail = true;
  await page.route('**/rest/v1/products?*', route => (fail ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'SYNTHETIC permission denied for table products' }) }) : route.fallback()));
  await page.locator('#launchPanel [data-lpagain]').click();
  await expect(line(page, 'products')).toHaveAttribute('data-lpstate', 'unknown');
  await expect(line(page, 'products').locator('[data-lpbadge]')).toHaveText('Could not check');
  await expect(line(page, 'stock')).toHaveAttribute('data-lpstate', 'unknown');              // stock needs the products too
  await expect(line(page, 'questions')).toHaveAttribute('data-lpstate', 'ready');
  await expect(page.locator('#launchPanel [data-lptotal]')).toContainText('could not be checked');
  fail = false;
  await page.locator('#launchPanel [data-lpagain]').click();
  await expect(line(page, 'products')).toHaveAttribute('data-lpstate', 'ready');
  await expect(page.locator('#launchPanel [data-lpagain]')).toBeFocused();
});

test('"Mark as done" is kept with the day and the name, survives a reload, and can be taken back; nothing is written to the database', async ({ page, backend }) => {
  await open(page, backend, { missing: ['tax_rates'] });
  const printers = line(page, 'printers');
  await expect(printers).toHaveAttribute('data-lpstate', 'todo');
  await expect(line(page, 'steps').locator('[data-lptick]')).toHaveCount(0);                // a checked line has no button to mark it by hand
  await printers.locator('[data-lptick]').click();
  await expect(printers).toHaveAttribute('data-lpstate', 'ready');
  await expect(printers.locator('[data-lpdone]')).toHaveText('Marked done on Nov 25, 2026 by Synthetic Owner.');
  await expect(printers.locator('[data-lptick]')).toBeFocused();
  await expect(printers.locator('[data-lptick]')).toHaveText('Not done after all');
  await expect(page.locator('#launchPanel [data-lpmessage]')).toHaveText('Marked done: Both printers printed their test page.');
  await expect(page.locator('#launchPanel [data-lptotal]')).toHaveAttribute('data-lptotal', '1/14');
  await page.reload(); await expect(page.locator('#dash')).toBeVisible(); await gotoPage(page, 'launchPanel');
  await expect(line(page, 'printers')).toHaveAttribute('data-lpstate', 'ready');
  await line(page, 'printers').locator('[data-lptick]').click();
  await expect(line(page, 'printers')).toHaveAttribute('data-lpstate', 'todo');
  await expect(page.locator('#launchPanel')).toContainText('Your marks are kept in this browser.');
  expect(backend.requests.filter(r => r.rpc === 'set_shared_setting')).toEqual([]);
  expect(writes(backend)).toEqual([]);
});

test('with the shared settings in use a mark is saved for every device, and a mark made on another device shows here', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'one size is enough');
  backend.tables.shared_settings = [{ id: 'ss-launch', key: 'launch_list', value: { ticks: { email: { on: true, at: NOW - 60000, by: 'SYNTHETIC Admin' } } }, updated_at: '2026-11-25T17:59:00Z', updated_by: null }];
  backend.rpc.set_shared_setting = (b) => { backend.tables.shared_settings = backend.tables.shared_settings.filter(r => r.key !== b.p_key).concat([{ id: 'ss-' + b.p_key, key: b.p_key, value: b.p_value, updated_at: '2026-11-25T18:00:05Z', updated_by: null }]); return { ok: true, key: b.p_key, updated_at: '2026-11-25T18:00:05Z' }; };
  await page.addInitScript(() => { try { localStorage.setItem('he_shared_settings', 'on'); } catch (e) {} });
  await open(page, backend);
  await expect(line(page, 'email')).toHaveAttribute('data-lpstate', 'ready');                 // marked on another device
  await expect(line(page, 'email').locator('[data-lpdone]')).toContainText('by SYNTHETIC Admin');
  await expect(page.locator('#launchPanel')).toContainText('Your marks are the same on every device');
  await line(page, 'backups').locator('[data-lptick]').click();
  const saves = () => backend.requests.filter(r => r.rpc === 'set_shared_setting' && r.body.p_key === 'launch_list').map(r => r.body);
  await expect.poll(() => saves().length).toBe(1);
  const saved = saves()[0];
  expect(saved.p_audience).toBe('owner_admin');
  expect(Object.keys(saved.p_value.ticks).sort()).toEqual(['backups', 'email']);               // the other device's mark is kept, not overwritten
  expect(saved.p_value.ticks.backups).toMatchObject({ on: true, by: 'Synthetic Owner' });
});

test('an administrator has the page; an employee is told it is not for them and nothing is read', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'one size is enough');
  await open(page, backend, { role: 'employee' });
  await expect(page.locator('#launchPanel')).toContainText('This page is for the owner and administrators.');
  await expect(page.locator('#launchPanel [data-lpline]')).toHaveCount(0);
});

test('an administrator sees the lines and can mark one', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'desktop', 'one size is enough');
  await open(page, backend, { role: 'administrator' });
  await expect(page.locator('#launchPanel [data-lpline]')).toHaveCount(14);
  await line(page, 'agents').locator('[data-lptick]').click();
  await expect(line(page, 'agents')).toHaveAttribute('data-lpstate', 'ready');
});

test('at phone size the page fits without sideways scrolling', async ({ page, backend }, ti) => {
  test.skip(ti.project.name !== 'iphone', 'phone only');
  await open(page, backend);
  await expect(page.locator('#launchPanel [data-lpline]')).toHaveCount(14);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  const edges = await page.locator('#launchPanel .lpLine').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().right)));
  expect(Math.max(...edges)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
});
