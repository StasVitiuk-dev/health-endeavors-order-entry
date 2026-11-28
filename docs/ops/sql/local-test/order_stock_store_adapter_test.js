#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-28). Never point this at Supabase.
// Runs the dashboard's Stock per order code (assets/inventory/he-order-stock.js: find an order, open
// it by id, read its lines and moves, the waiting list, take, give back) against drafts/76 installed
// on a throwaway copy of the real-shape database, through a tiny stand-in for the supabase-js client
// that turns exactly the calls the code makes into SQL, run as a given person. Until now this code had
// only met a mock database in the browser tests; this proves the real one answers the same way:
// the right rows come back, the stock really moves once, the database's refusals reach the page in
// plain words, and an employee cannot change stock even when the page's own check is bypassed.
// All rows are synthetic.
// Usage: node order_stock_store_adapter_test.js -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const M = require('../../../../assets/inventory/he-order-stock.js');

const CONN = process.argv.slice(2);
const SRC = 'he_real', DB = 'he_order_stock_store_test';
const INSTALL = path.join(__dirname, '..', 'drafts', '76_DRAFT_order_stock_moves.sql');
const O = '00000000-0000-4000-8000-0000000077a1', E = '00000000-0000-4000-8000-0000000077a4';
const P1 = '00000000-0000-4000-8000-0000000077b1', P2 = '00000000-0000-4000-8000-0000000077b2';
const O1 = '00000000-0000-4000-8000-0000000077c1', O2 = '00000000-0000-4000-8000-0000000077c2', O3 = '00000000-0000-4000-8000-0000000077c3';
const O4 = '00000000-0000-4000-8000-0000000077c4', O5 = '00000000-0000-4000-8000-0000000077c5', O6 = '00000000-0000-4000-8000-0000000077c6';
let pass = 0, fail = 0;
const ok = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + w + ', got ' + g); } };
const has = (name, got, re) => { if (re.test(String(got))) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + re + ' in [' + String(got).slice(0, 220) + ']'); } };

const psql = (db, sql) => execFileSync('psql', CONN.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const q = (sql) => psql(DB, sql);
const lit = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";

function asUser(uid, sql) {
  const wrapped = "begin; set local role authenticated; set local request.jwt.claim.sub = " + lit(uid) + ";\nselect coalesce(jsonb_agg(t), '[]'::jsonb) from (" + sql + ") t;\ncommit;";
  try {
    const out = execFileSync('psql', CONN.concat(['-d', DB, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']), { input: wrapped, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const line = out.split('\n').map(s => s.trim()).filter(s => s.startsWith('['))[0];
    return { data: JSON.parse(line || '[]'), error: null };
  } catch (e) {
    const t = String(e.stderr || e.message);
    const m = t.match(/ERROR:\s+([0-9A-Z]{5}):\s+(.*)/);
    return { data: null, error: m ? { code: m[1], message: m[2].trim() } : { message: t.split('\n')[0] } };
  }
}

// The stand-in client: exactly the read chains and rpc() the Stock per order code uses.
const calls = [];
function client(uid) {
  return {
    from(table) {
      const st = { cols: '*', where: [], order: null, limit: null };
      const b = {
        select(c) { st.cols = c; return b; },
        eq(k, v) { st.where.push(k + ' = ' + lit(v)); return b; },
        in(k, vs) { st.where.push(k + ' in (' + vs.map(lit).join(',') + ')'); return b; },
        is(k, v) { st.where.push(k + ' is ' + (v === null ? 'null' : String(v))); return b; },
        gte(k, v) { st.where.push(k + ' >= ' + lit(v)); return b; },
        order(k, o) { st.order = k + (o && o.ascending === false ? ' desc' : ''); return b; },
        limit(n) { st.limit = n; return b; },
        then(res, rej) {
          const sql = 'select ' + st.cols + ' from public.' + table + (st.where.length ? ' where ' + st.where.join(' and ') : '') + (st.order ? ' order by ' + st.order : '') + (st.limit ? ' limit ' + st.limit : '');
          calls.push(table);
          return Promise.resolve(asUser(uid, sql)).then(res, rej);
        },
      };
      return b;
    },
    rpc(name, args) {
      calls.push(name);
      const r = asUser(uid, 'select public.' + name + '(p_order_id => ' + lit(args.p_order_id) + '::uuid) as r');
      return Promise.resolve(r.error ? r : { data: r.data[0].r, error: null });
    },
  };
}
const store = (uid) => M.createStore({ client: client(uid), enabled: true });
const avail = () => q("select string_agg(available::text, ',' order by product_id) from inventory where product_id in ('" + P1 + "','" + P2 + "')");

(async function main() {
  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  psql('postgres', 'create database ' + DB + ' template ' + SRC);
  console.log('Stock per order: the dashboard\'s code against drafts/76 (throwaway database ' + DB + ')');
  q("insert into profiles (id, email, role, is_active, deleted_at, account_number) values ('" + O + "','o77@example.test','owner',true,null,'770000001'), ('" + E + "','e77@example.test','employee',true,null,'770000004');" +
    " insert into products (id, sku, name, status) values ('" + P1 + "','SYN-BODY-200','SYNTHETIC body cream','active'), ('" + P2 + "','SYN-FACE-50','SYNTHETIC face serum','active');" +
    " insert into inventory (product_id, available) values ('" + P1 + "', 10), ('" + P2 + "', 4);" +
    " insert into orders (id, channel, external_order_id, order_number, status, total, placed_at) values" +
    " ('" + O1 + "','shopify','S-1','#2001','paid',60, now() - interval '1 day'), ('" + O2 + "','etsy','E-1','2001','paid',20, now() - interval '2 days')," +
    " ('" + O3 + "','shopify','S-3','#2003','cancelled',20, now() - interval '1 day'), ('" + O4 + "','shopify','S-4','#2004','voided',20, now() - interval '1 day')," +
    " ('" + O5 + "','shopify','S-5','#2005','paid',20, now() - interval '30 days'), ('" + O6 + "','manual',null,'#2006','paid',90, now() - interval '3 days');" +
    " insert into order_items (order_id, sku, product_name, quantity) values" +
    " ('" + O1 + "','SYN-BODY-200','Body',2), ('" + O1 + "','syn-face-50','Serum (lower-case SKU)',1), ('" + O2 + "','SYN-BODY-200','Body',1)," +
    " ('" + O6 + "','SYN-FACE-50','Serum',9);");

  const before = await store(O).take(O1);
  ok('before drafts/76 is installed: the page says so, nothing changed', [before.ok, avail()], [false, '10,4']);
  has('  in plain words', before.message, /not installed in the database yet/);
  execFileSync('psql', CONN.concat(['-d', DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', INSTALL]), { stdio: 'ignore' });

  console.log(' finding and opening orders');
  const two = await store(O).findOrder('2001');
  ok('two orders share the number 2001 (two channels): both offered, nothing guessed', [two.ok, (two.choices || []).map(c => c.channel).sort()], [false, ['etsy', 'shopify']]);
  const one = await store(O).findOrder('#2006');
  ok('a single match is opened', [one.ok, one.order && one.order.id], [true, O6]);
  const byId = await store(O).openOrder(O1);
  ok('the waiting list opens an order by its id', [byId.ok, byId.order && byId.order.order_number, byId.order && byId.order.deleted], [true, '#2001', false]);
  ok('a number nobody has', (await store(O).findOrder('9999')).message, 'No order has that number.');

  console.log(' the waiting list (orders of the last 14 days not taken off stock)');
  const w1 = await store(O).waiting(14);
  ok('cancelled, voided and older orders are left out; newest first', [w1.ok, w1.orders.map(o => o.order_number), w1.more], [true, ['#2001', '2001', '#2006'], false]);

  console.log(' taking stock, through the real function');
  const lines = await store(O).forOrder(O1);
  ok('the order\'s lines and state are read', [lines.ok, lines.state, lines.bottles, lines.canTake], [true, 'none', 3, true]);
  const t1 = await store(O).take(O1);
  ok('the owner takes #2001: 2 lines changed (the lower-case SKU matches)', [t1.ok, t1.changed, t1.already, t1.order], [true, 2, 0, '#2001']);
  ok('  stock body 10 - 2 = 8, serum 4 - 1 = 3', avail(), '8,3');
  const t2 = await store(O).take(O1);
  ok('  taking again changes nothing', [t2.ok, t2.changed, t2.already, avail()], [true, 0, 2, '8,3']);
  const after = await store(O).forOrder(O1);
  ok('  the card now shows it taken, ready to give back', [after.state, after.canTake, after.canGiveBack], ['taken', false, true]);
  const w2 = await store(O).waiting(14);
  ok('  and it has left the waiting list', w2.orders.map(o => o.order_number), ['2001', '#2006']);

  console.log(' refusals reach the page in plain words, and nothing changes');
  const short = await store(O).take(O6);
  ok('not enough stock (9 serums, 3 left)', [short.ok, avail()], [false, '8,3']);
  has('  the database\'s own sentence', short.message, /not enough in stock for SYN-FACE-50: needs 9, has 3\. Nothing was changed/);
  const staff = await store(E).take(O2);
  ok('an employee cannot take stock, even when the page\'s check is bypassed', [staff.ok, avail()], [false, '8,3']);
  has('  and is told so', staff.message, /Only the Owner or an Administrator can change stock\. Nothing was changed\./);
  const seen = await store(E).forOrder(O1);
  ok('  an employee does not see the stock record (the card shows nothing taken to them)', [seen.ok, seen.state], [true, 'none']);

  console.log(' giving back once');
  const b1 = await store(O).giveBack(O1);
  ok('the owner gives #2001 back: 2 lines, stock back to 10 and 4', [b1.ok, b1.changed, avail()], [true, 2, '10,4']);
  const b2 = await store(O).giveBack(O1);
  ok('  giving back again changes nothing', [b2.ok, b2.changed, avail()], [true, 0, '10,4']);
  ok('  the record holds one take and one give-back per line', q("select string_agg(kind || ':' || n, ' ' order by kind) from (select kind, count(*) n from order_stock_moves where order_id = '" + O1 + "' group by kind) x"), 'give_back:2 take:2');

  ok('the code made only the calls it is meant to (reads, and the two functions)', [...new Set(calls)].sort(), ['give_back_order_stock', 'order_items', 'order_stock_moves', 'orders', 'take_order_stock']);
  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  console.log('order stock store: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
