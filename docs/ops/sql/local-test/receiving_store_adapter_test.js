#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-28). Never point this at Supabase.
// Runs the dashboard's deliveries-and-returns code (assets/inventory/he-receiving-store.js: the
// Deliveries section on Purchase Orders and the returns screens) against drafts/40 (with drafts/44,
// staff see purchase orders) installed on a throwaway copy of the real-shape database, through a tiny
// stand-in for the supabase-js client that turns exactly the calls the code makes into SQL, run as a
// given person. Until now this code had only met the browser tests' mock database; this proves the
// real functions take the arguments the page sends (names and types), answer in the shape the page
// reads, change stock only on approval, and refuse what the page would also refuse even when the
// page's own check is bypassed. All rows are synthetic.
// Usage: node receiving_store_adapter_test.js -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const R = require('../../../../assets/inventory/he-receiving-store.js');

const CONN = process.argv.slice(2);
const SRC = 'he_real', DB = 'he_receiving_store_test';
const D40 = path.join(__dirname, '..', 'drafts', '40_DRAFT_partial_receiving_returns.sql');
const D44 = path.join(__dirname, '..', 'drafts', '44_DRAFT_staff_read_purchase_orders.sql');
const U = (n) => '00000000-0000-4000-8000-0000000040' + String(n).padStart(2, '0');
const O = U(1), A = U(2), E = U(4);
const P = U(10), SUP = U(11), PO = U(12), IT = U(13), ORDR = U(14), OI = U(15);
const K = (n) => '00000000-0000-4000-9000-' + String(n).padStart(12, '0');
let pass = 0, fail = 0;
const ok = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + w + ', got ' + g); } };
const has = (name, got, re) => { if (re.test(String(got))) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + re + ' in [' + String(got).slice(0, 240) + ']'); } };

const psql = (db, sql) => execFileSync('psql', CONN.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const q = (sql) => psql(DB, sql);
const lit = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const val = (v) => v == null ? 'null' : (Array.isArray(v) || typeof v === 'object') ? lit(JSON.stringify(v)) + '::jsonb'
  : (typeof v === 'boolean' || typeof v === 'number') ? String(v) : lit(v);

function asUser(uid, sql, wrap) {
  const body = wrap === false ? sql : "select coalesce(jsonb_agg(t), '[]'::jsonb) from (" + sql + ") t";
  const wrapped = "begin; set local role authenticated; set local request.jwt.claim.sub = " + lit(uid) + ";\n" + body + ";\ncommit;";
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

// The stand-in client: exactly the chains and rpc() the deliveries-and-returns code uses.
const called = new Set();
function client(uid) {
  return {
    from(table) {
      const st = { cols: '*', where: [], order: null, limit: null, set: null, ret: null };
      const run = () => {
        called.add(table + (st.set ? ':update' : ''));
        if (st.set) {
          const sets = Object.keys(st.set).map(k => k + ' = ' + lit(st.set[k])).join(', ');
          // an update ... returning, as PostgREST runs it for .update().select()
          return asUser(uid, 'with u as (update public.' + table + ' set ' + sets + ' where ' + st.where.join(' and ') + ' returning ' + (st.ret || 'id') + ') select coalesce(jsonb_agg(u), \'[]\'::jsonb) from u', false);
        }
        return asUser(uid, 'select ' + st.cols + ' from public.' + table + (st.where.length ? ' where ' + st.where.join(' and ') : '') + (st.order ? ' order by ' + st.order : '') + (st.limit ? ' limit ' + st.limit : ''));
      };
      const b = {
        select(c) { if (st.set) st.ret = c; else st.cols = c; return b; },
        update(v) { st.set = v; return b; },
        eq(k, v) { st.where.push(k + ' = ' + lit(v)); return b; },
        order(k, o) { st.order = k + (o && o.ascending === false ? ' desc' : ''); return b; },
        limit(n) { st.limit = n; return b; },
        then(res, rej) { return Promise.resolve(run()).then(res, rej); },
      };
      return b;
    },
    rpc(name, args) {
      called.add(name);
      const r = asUser(uid, 'select public.' + name + '(' + Object.keys(args).map(k => k + ' => ' + val(args[k])).join(', ') + ') as r');
      return Promise.resolve(r.error ? r : { data: r.data[0].r, error: null });
    },
  };
}
const store = (uid, role) => R.createStore({ client: client(uid), enabled: true, role });
const stock = () => q("select available || '/' || coalesce(damaged, 0) from inventory where product_id = '" + P + "'");
const received = () => q("select quantity_received from purchase_order_items where id = '" + IT + "'");

(async function main() {
  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  psql('postgres', 'create database ' + DB + ' template ' + SRC);
  console.log('Deliveries and returns: the dashboard\'s code against drafts/40 and 44 (throwaway database ' + DB + ')');
  q("insert into profiles (id, email, role, is_active, account_number) values ('" + O + "','o40@example.test','owner',true,'940000001'), ('" + A + "','a40@example.test','administrator',true,'940000002'), ('" + E + "','e40@example.test','employee',true,'940000004');" +
    " insert into products (id, name, sku) values ('" + P + "','SYNTHETIC Honey Milk 8 oz','SYN-RCV-A');" +
    " insert into inventory (product_id, available, damaged) values ('" + P + "', 5, 0);" +
    " insert into suppliers (id, name, supplier_type, is_active) values ('" + SUP + "','SYN Lotion Lab','lab',true);" +
    " insert into purchase_orders (id, po_number, supplier_id, status, payment_status) values ('" + PO + "','SYN-PO-040','" + SUP + "','ordered','unpaid');" +
    " insert into purchase_order_items (id, purchase_order_id, product_id, sku, description, quantity, unit_cost, quantity_received) values ('" + IT + "','" + PO + "','" + P + "','SYN-RCV-A','Honey Milk 8 oz',20,4,0);" +
    " insert into orders (id, channel, status, order_number) values ('" + ORDR + "','synthetic','paid','SYN-4005');" +
    " insert into order_items (id, order_id, sku, quantity) values ('" + OI + "','" + ORDR + "','SYN-RCV-A',5);");

  const pr0 = await store(O, 'owner').probe();
  ok('before drafts/40: the page says it is not installed', [pr0.ok, pr0.installed], [false, false]);
  execFileSync('psql', CONN.concat(['-d', DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', D40]), { stdio: 'ignore' });
  execFileSync('psql', CONN.concat(['-d', DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', D44]), { stdio: 'ignore' });
  ok('after install: readable', (await store(E, 'employee').probe()).ok, true);

  console.log(' a delivery in parts (staff record, the owner approves)');
  const l0 = await store(E, 'employee').load();
  const po0 = (l0.orders || []).find(p => p.id === PO);
  ok('staff see the purchase order with 20 to come', [l0.ok, po0 && po0.lines[0].toCome], [true, 20]);
  const s1 = await store(E, 'employee').submit({ requestKey: K(1), poId: PO, lines: [{ poItemId: IT, good: 8 }], toCome: { [IT]: 20 } });
  ok('staff record 8 good units: waiting, stock not changed yet', [s1.ok, s1.status, stock()], [true, 'submitted', '5/0']);
  const s1b = await store(E, 'employee').submit({ requestKey: K(1), poId: PO, lines: [{ poItemId: IT, good: 8 }], toCome: { [IT]: 20 } });
  ok('  the same request again (a retry) records nothing twice', [s1b.ok, s1b.duplicate, q("select count(*) from receiving_records")], [true, true, '1']);
  const self = await store(E, null).approve(s1.id);
  ok('staff cannot approve, even with the page\'s check bypassed; stock unchanged', [self.ok, stock()], [false, '5/0']);
  has('  and are told so', self.message, /owner|administrator|permission/i);
  const a1 = await store(O, 'owner').approve(s1.id, 'counted');
  ok('the owner approves: stock 5 + 8 = 13; 8 received on the order', [a1.ok, a1.status, stock(), received()], [true, 'approved', '13/0', '8']);
  const a1b = await store(O, 'owner').approve(s1.id);
  ok('  approving twice changes nothing', [a1b.ok, stock()], [true, '13/0']);
  const s2 = await store(E, 'employee').submit({ requestKey: K(2), poId: PO, lines: [{ poItemId: IT, good: 3, rejected: 2, rejectedReason: 'leaking caps' }] });
  const r2 = await store(A, 'administrator').reject(s2.id, 'count again please');
  ok('an administrator rejects a record: no stock change', [s2.ok, r2.ok, r2.status, stock(), received()], [true, true, 'rejected', '13/0', '8']);
  const over = await store(E, null).submit({ requestKey: K(3), poId: PO, lines: [{ poItemId: IT, good: 13 }] });
  ok('more good units than are still to come (page check bypassed): the database refuses', [over.ok, q("select count(*) from receiving_records where request_key = '" + K(3) + "'")], [false, '0']);
  has('  in its own words', over.message, /to come|surplus|more than/i);
  const s4 = await store(E, 'employee').submit({ requestKey: K(4), poId: PO, lines: [{ poItemId: IT, good: 12, surplus: 3 }], toCome: { [IT]: 12 } });
  const a4 = await store(O, 'owner').approve(s4.id);
  const l4 = await store(O, 'owner').load();
  ok('12 more with 3 surplus: approved, 25 in stock, the surplus waits for a decision', [a4.ok, stock(), received(), l4.surplusWaiting.length], [true, '25/0', '20', 1]);
  const sp = await store(O, 'owner').decideSurplus(l4.surplusWaiting[0].id, 'kept');
  ok('  the owner keeps the surplus: added to Available', [sp.ok, stock()], [true, '28/0']);

  console.log(' a return to the supplier, a customer return, a correction');
  const sr = await store(E, 'employee').submitSupplierReturn({ requestKey: K(5), poItemId: IT, quantity: 2, fromBucket: 'available', reason: 'wrong scent batch' });
  ok('staff record 2 units back to the supplier: waiting, stock unchanged', [sr.ok, stock()], [true, '28/0']);
  const srd = await store(A, 'administrator').decideSupplierReturn(sr.id, 'approved');
  ok('  an administrator approves: stock 28 - 2 = 26', [srd.ok, stock()], [true, '26/0']);
  const cr = await store(E, 'employee').recordCustomerReturn({ requestKey: K(6), orderItemId: OI, quantity: 2 });
  ok('staff record a customer return of 2: awaiting inspection, not for sale', [cr.ok, cr.status, stock()], [true, 'awaiting_inspection', '26/0']);
  const opened = await store(O, null).decideCustomerReturn(cr.id, { opened: true, used: false, restock: 2, damaged: 0, unsuitable: 0 });
  ok('  opened skincare restocked (page check bypassed): the database refuses', [opened.ok, stock()], [false, '26/0']);
  const crd = await store(O, 'owner').decideCustomerReturn(cr.id, { opened: false, used: false, restock: 1, damaged: 1, unsuitable: 0, note: 'one box crushed' });
  ok('  the owner inspects: 1 back to Available, 1 to Damaged', [crd.ok, stock()], [true, '27/1']);
  const cr2 = await store(E, 'employee').recordCustomerReturn({ requestKey: K(7), orderItemId: OI, quantity: 1 });
  const crc = await store(E, 'employee').cancelCustomerReturn(cr2.id);
  ok('a return recorded by mistake is cancelled by the person who recorded it; it stays on the record', [crc.ok, q("select status from customer_return_inspections where id = '" + cr2.id + "'"), stock()], [true, 'cancelled', '27/1']);
  const crc2 = await store(E, 'employee').cancelCustomerReturn(cr2.id);
  ok('  cancelling twice: nothing changed, said plainly', [crc2.ok, /Nothing changed/.test(crc2.message)], [false, true]);
  const lr = await store(O, 'owner').loadReturns();
  const mv = (lr.movements || []).find(m => /supplier/i.test(String(m.source_kind)) || /scent/.test(String(m.reason)));
  ok('the returns screen reads both kinds of return and the stock movements', [lr.ok, lr.supplierReturns.length, lr.customerReturns.length, !!mv], [true, 1, 2, true]);
  const staffMoves = await store(E, 'employee').loadReturns();
  ok('  staff see no stock movements (the database shows them none)', [staffMoves.ok, staffMoves.movements.length], [true, 0]);
  const fix = await store(O, 'owner').correctMovement({ requestKey: K(8), movementId: Number(mv && mv.id), reason: 'returned by mistake' });
  ok('the owner corrects the supplier-return movement: stock back to 29, by a linked movement', [fix.ok, stock(), q("select count(*) from stock_movements where corrects = " + Number(mv && mv.id))], [true, '29/1', '1']);
  const fix2 = await store(O, 'owner').correctMovement({ requestKey: K(9), movementId: Number(mv && mv.id), reason: 'again by mistake' });
  ok('  correcting the same movement twice: the database refuses, stock unchanged', [fix2.ok, stock()], [false, '29/1']);

  const expected = ['approve_receiving_record', 'correct_stock_movement', 'customer_return_inspections', 'customer_return_inspections:update', 'decide_customer_return', 'decide_receiving_surplus',
    'decide_supplier_return', 'order_items', 'orders', 'products', 'purchase_order_items', 'purchase_orders', 'receiving_record_lines', 'receiving_records', 'record_customer_return',
    'reject_receiving_record', 'stock_movements', 'submit_receiving_record', 'submit_supplier_return', 'supplier_returns'];
  ok('every call the code made exists in the drafts (names and argument names matched)', [...called].sort(), expected);
  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  console.log('receiving store: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
