#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-28). Never contacts Shopify or Supabase.
// R9 path B: runs the Shopify order sync core (docs/ops/edge-drafts/shopify-orders-sync/sync-core.mjs)
// against MADE-UP Shopify replies, writing through drafts/78 (save_shopify_order) as the database's
// own service role, on a throwaway copy of the real-shape database, with drafts/76 (stock per order)
// installed too. Proves: read-only queries, no customer details asked, pagination, the rate-limit
// pause, each order and line written once (also twice at the same moment), Shopify edits applied
// except to lines whose stock was already taken, cancelled orders, a dashboard-deleted order never
// brought back, unreadable orders refused whole, who may call it, and the undo (drafts/79).
// Usage: node shopify_orders_test.mjs -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../../edge-drafts/shopify-orders-sync/sync-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONN = process.argv.slice(2);
const SRC = 'he_real', DB = 'he_shopify_orders_test';
const D = (f) => path.join(HERE, '..', 'drafts', f);
let pass = 0, fail = 0;
const ok = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + w + ', got ' + g); } };
const has = (name, got, want) => { const g = String(got); if (g.includes(want)) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected to find [' + want + '] in [' + g.slice(0, 240) + ']'); } };
const run = (db, sql) => { try { return execFileSync('psql', CONN.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch (e) { return 'ERROR ' + String(e.stderr || e.message).trim(); } };
const q = (sql) => run(DB, sql);
const file = (f) => { try { execFileSync('psql', CONN.concat(['-d', DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', f]), { stdio: 'pipe' }); return 0; } catch (e) { return e.status || 1; } };
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const SERVICE = 'service' + '_role';   // the database's own service key, as the Edge Function uses it
const as = (role, sql, who) => q('begin; set local role ' + role + ';' + (who ? " set local request.jwt.claim.sub = '" + who + "';" : '') + ' ' + sql + '; commit;')
  .split('\n').filter(l => !/^(BEGIN|COMMIT|SET)$/.test(l)).join('\n');
const OWNER = '00000000-0000-4000-8000-0000000078a1';

// the database side the program talks to: save_shopify_order() as the service role
function serviceDb() {
  const calls = [];
  return { calls, async syncSwitchOn() {
    const v = as(SERVICE, "select enabled from public.feature_flags where flag_key = 'shopify_order_sync'");
    if (v.startsWith('ERROR')) throw new Error(v);
    return v === 't';
  }, async rpc(name, args) {
    calls.push(name);
    const out = as(SERVICE, 'select public.' + name + '(' + lit(JSON.stringify(args.p_order)) + '::jsonb)');
    if (out.startsWith('ERROR')) throw new Error(out.replace(/^ERROR\s+(ERROR:\s+)?/, '').split('\n')[0]);
    return JSON.parse(out);
  } };
}

// ---- made-up Shopify ------------------------------------------------------------
const money = (a) => ({ shopMoney: { amount: a } });
const line = (id, sku, name, qty, price) => ({ id: 'gid://shopify/LineItem/' + id, sku, name, quantity: qty, originalUnitPriceSet: money(price) });
const order = (id, name, lines, extra) => Object.assign({ id: 'gid://shopify/Order/' + id, name, createdAt: '2026-11-27T15:00:00Z', cancelledAt: null, test: false,
  displayFinancialStatus: 'PAID', currencyCode: 'USD', subtotalPriceSet: money('60.0'), totalShippingPriceSet: money('5.0'), totalTaxSet: money('3.9'),
  totalPriceSet: money('68.9'), lineItems: { nodes: lines, pageInfo: { hasNextPage: false } } }, extra || {});
const ORDERS = [
  order(5001, '#1001', [line(71, 'SYN-LAV-8OZ', 'SYNTHETIC Lavender Lotion 8 oz', 2, '24.0'), line(72, 'SYN-HONEY-4OZ', 'SYNTHETIC Honey Cream 4 oz', 1, '12.0')]),
  order(5002, '#1002', [line(73, 'SYN-LAV-8OZ', 'SYNTHETIC Lavender Lotion 8 oz', 1, '24.0')], { totalPriceSet: money('32.9'), subtotalPriceSet: money('24.0') }),
  order(5003, '#1003', [line(74, 'SYN-HONEY-4OZ', 'SYNTHETIC Honey Cream 4 oz', 1, '12.0')], { test: true, totalPriceSet: money('20.9'), subtotalPriceSet: money('12.0') }),
];
function fakeShopify(opts) {
  const o = opts || {}; const calls = []; let throttles = o.throttle || 0;
  const fn = async (payload) => {
    calls.push(payload);
    if (throttles > 0) { throttles--; return { status: 429, body: null }; }
    if (o.status) return { status: o.status, body: null };
    if (o.errors) return { status: 200, body: { errors: [{ message: o.errors }] } };
    const v = payload.variables || {}; const all = o.orders || ORDERS;
    const start = v.after ? Number(v.after) : 0, size = o.pageSize || 2;
    const more = start + size < all.length;
    return { status: 200, body: { data: { orders: { nodes: all.slice(start, start + size), pageInfo: { hasNextPage: more, endCursor: more ? String(start + size) : null } } } } };
  };
  return { fn, calls };
}
const sync = (shop, db, now) => C.runSync({ fetchJson: shop.fn, db: db || serviceDb(), sleep: async () => {}, now: now || '2026-11-28T12:00:00Z' });

(async () => {
  console.log('Shopify order sync, R9 path B (drafts/78, drafts/79; made-up Shopify; throwaway database ' + DB + ')');
  console.log(' 1. reading Shopify');
  ok('the query only reads (no mutation)', /^query /.test(C.ORDERS_QUERY) && !/mutation/i.test(C.ORDERS_QUERY), true);
  ok('  and asks for no customer details (no customer, email, phone, address or card)', /customer|email|phone|address|billing|shipping[A-Z]|card/i.test(C.ORDERS_QUERY.replace(/totalShippingPriceSet/g, '')), false);
  ok('a cancelled order is "cancelled" whatever was paid', [C.statusOf({ cancelledAt: '2026-11-28T00:00:00Z', displayFinancialStatus: 'PAID' }), C.statusOf({ displayFinancialStatus: 'PARTIALLY_REFUNDED' })], ['cancelled', 'partially_refunded']);
  ok('an order without an amount is refused, not saved as 0', C.mapOrder(order(9, '#9', [], { totalPriceSet: money(null) })).error, 'order #9 has an unreadable amount');
  ok('an order with more lines than one page is refused whole', C.mapOrder(order(9, '#9', [], { lineItems: { nodes: [], pageInfo: { hasNextPage: true } } })).error, 'order #9 has more than 100 lines; not saved, look at it in Shopify');
  ok('the quantity is what will ship (a unit removed or refunded in Shopify is left out)',
     C.mapOrder(order(9, '#9', [Object.assign(line(1, 'SYN-A', 'A', 3, '1.0'), { currentQuantity: 2 })])).row.lines[0].quantity, 2);
  ok('a line total is the unit price times the quantity, to the cent', C.mapOrder(ORDERS[0]).row.lines.map(l => l.line_total), ['48.00', '12.00']);

  run('postgres', 'drop database if exists ' + DB + ' with (force)');
  run('postgres', 'create database ' + DB + ' template ' + SRC);
  // the service key's rights as Supabase gives them by default (the local copy has none)
  // and, as Supabase does, every new function in public is given to the service key
  const serviceRights = () => q('grant usage on schema public to ' + SERVICE + '; grant select, insert, update, delete on public.orders, public.order_items to ' + SERVICE +
    '; alter default privileges in schema public grant execute on functions to ' + SERVICE);
  serviceRights();
  q("insert into profiles (id, email, role, is_active, deleted_at, account_number) values ('" + OWNER + "','o78@example.test','owner',true,null,'780000001');" +
    " insert into products (id, sku, name, status) values (gen_random_uuid(),'SYN-LAV-8OZ','SYNTHETIC Lavender','active'), (gen_random_uuid(),'SYN-HONEY-4OZ','SYNTHETIC Honey','active');" +
    " insert into inventory (product_id, available) select id, 20 from products where sku like 'SYN-%';" +
    " insert into orders (channel, external_order_id, order_number, status, source) values ('manual', null, '#1001', 'paid', 'manual')");
  // STAND-IN for production's switches table (as in production_shape_install_test.sh), switch OFF
  q("create table if not exists public.feature_flags (id uuid primary key default gen_random_uuid(), flag_key text not null, label text, description text, enabled boolean not null default false);" +
    " insert into public.feature_flags (flag_key, label, enabled) values ('shopify_order_sync', 'Shopify order sync', false);" +
    ' grant select on public.feature_flags to ' + SERVICE);
  ok('drafts/76 (stock per order) installs', file(D('76_DRAFT_order_stock_moves.sql')), 0);
  ok('drafts/78 installs', file(D('78_DRAFT_shopify_orders.sql')), 0);
  ok('  and again: nothing changes', file(D('78_DRAFT_shopify_orders.sql')), 0);

  console.log(' 2. who may call it');
  has('a visitor cannot', as('anon', "select public.save_shopify_order('{}'::jsonb)"), 'permission denied');
  has('the owner signed in on the dashboard cannot either (only the program)', as('authenticated', "select public.save_shopify_order('{}'::jsonb)", OWNER), 'permission denied');

  console.log(' 3. the dashboard\'s Shopify Order Sync switch decides');
  const off = fakeShopify(); const r0 = await sync(off);
  ok('switch OFF (as before launch): it asks Shopify nothing and writes nothing', [r0.skipped ? 'skipped' : 'ran', off.calls.length, q("select count(*) from orders where channel = 'shopify'")], ['skipped', 0, '0']);
  const noSwitch = fakeShopify();
  const rMissing = await C.runSync({ fetchJson: noSwitch.fn, db: { syncSwitchOn: async () => { throw new Error('no table'); }, rpc: async () => { throw new Error('must not be called'); } }, sleep: async () => {} });
  ok('  a switch that cannot be read counts as off', [rMissing.skipped ? 'skipped' : 'ran', noSwitch.calls.length], ['skipped', 0]);
  q("update public.feature_flags set enabled = true where flag_key = 'shopify_order_sync'");
  console.log(' 4. a first run (switch ON): two pages, one rate-limit pause');
  const S1 = fakeShopify({ throttle: 1 }); const waits = [];
  const r1 = await C.runSync({ fetchJson: S1.fn, db: serviceDb(), sleep: async (ms) => { waits.push(ms); }, now: '2026-11-28T12:00:00Z' });
  ok('3 orders seen and created, 4 lines, 1 of them a test order, nothing refused', [r1.orders_seen, r1.created, r1.lines_added, r1.test_orders, r1.refused, r1.problems], [3, 3, 4, 1, 0, []]);
  ok('  it paused once for the rate limit', waits, [1000]);
  ok('  it asked for orders changed in the last 3 days', S1.calls[1].variables.query, "updated_at:>='2026-11-25T12:00:00.000Z'");
  ok('  the database holds them as Shopify said (channel shopify, Shopify ids, SKUs, totals)',
     q("select string_agg(order_number||':'||status||':'||total, ' ' order by order_number) from orders where channel = 'shopify'") + ' | ' + q("select count(*) from order_items where external_line_id is not null"),
     '#1001:paid:68.90 #1002:paid:32.90 #1003:paid:20.90 | 4');
  ok('  the manual order with the same number is untouched', q("select count(*) from orders where channel = 'manual' and order_number = '#1001'"), '1');
  ok('  no customer detail was written', q("select count(*) from orders where channel = 'shopify' and (customer_name is not null or customer_email is not null or raw_data is not null)"), '0');

  console.log(' 5. running again changes nothing; two runs at the same moment write once');
  const r2 = await sync(fakeShopify());
  ok('a second run creates nothing and changes nothing', [r2.created, r2.lines_added, r2.lines_changed], [0, 0, 0]);
  ok('  still 3 orders and 4 lines', q("select count(*) from orders where channel = 'shopify'") + '/' + q('select count(*) from order_items where external_line_id is not null'), '3/4');
  const fresh = [order(5010, '#1010', [line(80, 'SYN-LAV-8OZ', 'SYNTHETIC Lavender Lotion 8 oz', 1, '24.0')])];
  await Promise.all([sync(fakeShopify({ orders: fresh })), sync(fakeShopify({ orders: fresh }))]);
  ok('  a new order sent by two runs at once is written once, with one line', q("select count(*) from orders where external_order_id = 'gid://shopify/Order/5010'") + '/' + q("select count(*) from order_items oi join orders o on o.id = oi.order_id where o.external_order_id = 'gid://shopify/Order/5010'"), '1/1');

  console.log(' 6. Shopify edits and cancellations');
  const O1 = q("select id from orders where external_order_id = 'gid://shopify/Order/5001'");
  ok('the owner takes order #1001 off stock (drafts/76)', JSON.parse(as('authenticated', "select public.take_order_stock('" + O1 + "')", OWNER)).lines_changed, 2);
  const edited = [order(5001, '#1001', [line(71, 'SYN-LAV-8OZ', 'SYNTHETIC Lavender Lotion 8 oz', 3, '24.0'), line(72, 'SYN-HONEY-4OZ', 'SYNTHETIC Honey Cream 4 oz', 1, '12.0')], { totalPriceSet: money('92.9') }),
                  order(5002, '#1002', [line(73, 'SYN-LAV-8OZ', 'SYNTHETIC Lavender Lotion 8 oz', 2, '24.0')], { totalPriceSet: money('56.9') })];
  const r3 = await sync(fakeShopify({ orders: edited }));
  ok('a line whose stock was taken is held, not rewritten; the other order\'s line is updated', [r3.lines_changed, r3.held], [1, ['#1001: SYN-LAV-8OZ']]);
  has('  and the run says so in plain words', r3.problems.join(' '), 'whose stock was already taken; they were left as they were');
  ok('  #1001 line still 2 (as taken), its total updated; #1002 line now 2',
     q("select oi.quantity from order_items oi where oi.external_line_id = 'gid://shopify/LineItem/71'") + '/' + q("select total from orders where external_order_id = 'gid://shopify/Order/5001'") + '/' + q("select quantity from order_items where external_line_id = 'gid://shopify/LineItem/73'"),
     '2/92.90/2');
  await sync(fakeShopify({ orders: [order(5002, '#1002', [line(73, 'SYN-LAV-8OZ', 'SYNTHETIC Lavender Lotion 8 oz', 2, '24.0')], { cancelledAt: '2026-11-28T10:00:00Z', displayFinancialStatus: 'REFUNDED', totalPriceSet: money('56.9') })] }));
  ok('a cancelled order becomes "cancelled"', q("select status from orders where external_order_id = 'gid://shopify/Order/5002'"), 'cancelled');
  q("update orders set deleted_at = now() where external_order_id = 'gid://shopify/Order/5003'");
  const r4 = await sync(fakeShopify());
  ok('an order deleted on the dashboard is never brought back', [r4.skipped_deleted, q("select count(*) from orders where external_order_id = 'gid://shopify/Order/5003' and deleted_at is null")], [1, '0']);

  q("update public.feature_flags set enabled = false where flag_key = 'shopify_order_sync'");
  const emergency = fakeShopify({ orders: [order(5040, '#1040', [line(95, 'SYN-LAV-8OZ', 'SYNTHETIC Lavender Lotion 8 oz', 1, '24.0')])] });
  const rE = await sync(emergency);
  ok('Emergency (the switch turned off again): the next run asks and writes nothing', [rE.skipped ? 'skipped' : 'ran', emergency.calls.length, q("select count(*) from orders where external_order_id = 'gid://shopify/Order/5040'")], ['skipped', 0, '0']);
  q("update public.feature_flags set enabled = true where flag_key = 'shopify_order_sync'");
  console.log(' 7. what goes wrong is said plainly, and nothing is half-written');
  const before = q('select count(*) from order_items');
  const tryRun = async (shop) => { try { await sync(shop); return 'no error'; } catch (e) { return e.message; } };
  ok('a wrong or revoked key', await tryRun(fakeShopify({ status: 401 })), 'Shopify refused the access key (401). Check that the app has the read_orders scope.');
  ok('Shopify reporting an error', await tryRun(fakeShopify({ errors: 'Access denied for orders field.' })), 'Shopify reported: Access denied for orders field.');
  ok('still rate-limited after 4 tries', await tryRun(fakeShopify({ throttle: 9 })), 'Shopify answered 429.');
  const badOrders = [order(5020, '#1020', [line(90, 'SYN-LAV-8OZ', 'x', 1, 'abc')]), order(5021, '#1021', [line(91, 'SYN-HONEY-4OZ', 'SYNTHETIC Honey Cream 4 oz', 1, '12.0')])];
  const r5 = await sync(fakeShopify({ orders: badOrders }));
  ok('an unreadable order is refused whole and named; the next one is saved', [r5.refused, r5.created, r5.problems[0]], [1, 1, 'order #1020 has a line with an unreadable quantity or price']);
  has('the database refuses a line without a Shopify line id, and saves nothing of that order',
      as(SERVICE, "select public.save_shopify_order('{\"external_order_id\":\"gid://shopify/Order/5030\",\"order_number\":\"#1030\",\"status\":\"paid\",\"currency\":\"USD\",\"subtotal\":1,\"shipping_total\":0,\"tax_total\":0,\"total\":1,\"placed_at\":\"2026-11-28T00:00:00Z\",\"lines\":[{\"external_line_id\":\"x\",\"quantity\":1}]}'::jsonb)"),
      'a line has no Shopify line id');
  ok('  order #1030 is not there', q("select count(*) from orders where external_order_id = 'gid://shopify/Order/5030'"), '0');
  ok('  none of the failures wrote a line', q('select count(*) from order_items'), String(Number(before) + 1));
  has('a second line with the same Shopify line id on one order is impossible',
      q("insert into order_items (order_id, external_line_id, sku, quantity) values ('" + O1 + "', 'gid://shopify/LineItem/71', 'SYN-LAV-8OZ', 1)"), 'duplicate key');

  console.log(' 8. undo (drafts/79)');
  ok('drafts/79 runs', file(D('79_DRAFT_rollback_shopify_orders.sql')), 0);
  ok('  the function is gone; no order or line was removed; the Shopify line ids are kept (they are in use)',
     q("select count(*) from pg_proc where proname = 'save_shopify_order'") + '/' + q("select count(*) from orders where channel = 'shopify'") + '/' + q('select count(*) from order_items where external_line_id is not null'),
     '0/5/6');
  ok('  installing again works and keeps everything', file(D('78_DRAFT_shopify_orders.sql')) + '/' + q("select count(*) from order_items where external_line_id is not null"), '0/6');
  run('postgres', 'drop database if exists ' + DB + ' with (force)');
  run('postgres', 'create database ' + DB + ' template ' + SRC);
  ok('without the service key\'s right to write orders, drafts/78 stops', file(D('78_DRAFT_shopify_orders.sql')), 3);
  q('grant usage on schema public to ' + SERVICE + '; grant select, insert, update, delete on public.orders, public.order_items to ' + SERVICE);
  ok('when the service key would not get the function by itself, drafts/78 stops and leaves nothing',
     [file(D('78_DRAFT_shopify_orders.sql')), q("select count(*) from pg_proc where proname = 'save_shopify_order'"), q("select count(*) from information_schema.columns where table_name = 'order_items' and column_name = 'external_line_id'")], [3, '0', '0']);
  serviceRights();
  ok('on a database with no Shopify lines, install then undo leaves no trace', [file(D('78_DRAFT_shopify_orders.sql')), file(D('79_DRAFT_rollback_shopify_orders.sql')),
     q("select count(*) from information_schema.columns where table_name = 'order_items' and column_name = 'external_line_id'")], [0, 0, '0']);
  ok('  a second undo stops: nothing to undo', file(D('79_DRAFT_rollback_shopify_orders.sql')), 3);
  q('alter table orders drop constraint if exists orders_channel_external_order_id_key; drop index if exists orders_channel_external_order_id_key');
  ok('without the one-order-per-Shopify-id rule, drafts/78 stops', file(D('78_DRAFT_shopify_orders.sql')), 3);
  ok('  and created nothing', q("select count(*) from pg_proc where proname = 'save_shopify_order'"), '0');

  run('postgres', 'drop database if exists ' + DB + ' with (force)');
  console.log('shopify orders: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
