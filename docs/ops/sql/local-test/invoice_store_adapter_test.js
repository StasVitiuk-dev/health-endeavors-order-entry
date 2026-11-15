#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-15). Never point this at Supabase.
// Runs the dashboard's invoice storage adapter (assets/invoice/he-invoice-store.js)
// against drafts/32 installed on a throwaway copy of the local database, through
// a tiny stand-in for the supabase-js client that turns exactly the calls the
// adapter makes into SQL, run as a given person (the same way the database
// would see a signed-in user). Proves the adapter's column names, function
// arguments and error handling match the real draft. All rows are synthetic.
// Usage: node invoice_store_adapter_test.js -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const S = require('../../../../assets/invoice/he-invoice-store.js');
const I = require('../../../../assets/invoice/he-invoice.js');
const T = require('../../../../assets/invoice/he-tax.js');

const CONN = process.argv.slice(2);
const SRC = 'he_real', DB = 'he_invoice_store_test';
const INSTALL = path.join(__dirname, '..', 'drafts', '32_DRAFT_invoices.sql');
const O = '00000000-0000-4000-8000-0000000000a1', A = '00000000-0000-4000-8000-0000000000a2', E = '00000000-0000-4000-8000-0000000000a3';
const ORD = (n) => '00000000-0000-4000-8000-00000000c00' + n;
let pass = 0, fail = 0;
const ok = (name, got, want) => { if (got === want) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected [' + want + '], got [' + got + ']'); } };
const has = (name, got, re) => { if (re.test(String(got))) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + re + ' in [' + String(got).slice(0, 200) + ']'); } };

function psql(db, sql, input) {
  return execFileSync('psql', CONN.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1']).concat(input ? [] : ['-c', sql]),
    { input: input ? sql : undefined, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
const lit = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const val = (v) => (v !== null && typeof v === 'object') ? lit(JSON.stringify(v)) + '::jsonb' : (typeof v === 'boolean' || typeof v === 'number') ? String(v) : lit(v);

// Run SQL as a signed-in person, return the JSON result or { error } shaped the
// way supabase-js reports it (code + message).
// `sql` is a plain SELECT; a write passes its statement as `dml` and is run
// as a top-level WITH (Postgres does not allow it inside a subquery).
function asUser(uid, sql, dml) {
  const body = dml
    ? "with x as (" + dml + " returning *) select coalesce(jsonb_agg(t), '[]'::jsonb) from (" + sql.replace('{x}', 'x') + ") t"
    : "select coalesce(jsonb_agg(t), '[]'::jsonb) from (" + sql + ") t";
  const wrapped = "begin; set local role authenticated; set local request.jwt.claim.sub = " + lit(uid) + ";\n" + body + ";\ncommit;";
  try {
    const out = execFileSync('psql', CONN.concat(['-d', DB, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']),
      { input: wrapped, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const line = out.split('\n').map(s => s.trim()).filter(s => s.startsWith('['))[0];
    return { data: JSON.parse(line || '[]'), error: null };
  } catch (e) {
    const text = String(e.stderr || e.message);
    const m = text.match(/ERROR:\s+([0-9A-Z]{5}):\s+(.*)/);
    return { data: null, error: m ? { code: m[1], message: m[2].trim() } : { message: text.split('\n')[0] } };
  }
}

// The stand-in client: only the chains the adapter uses.
function client(uid) {
  return {
    from(table) {
      const st = { table, op: 'select', cols: '*', where: [], order: null, limit: null, single: false, row: null };
      const b = {
        select(c) { if (st.op === 'select') st.cols = c; else st.returning = c; return b; },
        insert(r) { st.op = 'insert'; st.row = r; return b; },
        update(r) { st.op = 'update'; st.row = r; return b; },
        delete() { st.op = 'delete'; return b; },
        eq(k, v) { st.where.push(k + ' = ' + lit(v)); return b; },
        order(k, o) { st.order = k + (o && o.ascending === false ? ' desc' : ''); return b; },
        limit(n) { st.limit = n; return b; },
        single() { st.single = true; return b; },
        then(res, rej) {
          const w = st.where.length ? ' where ' + st.where.join(' and ') : '';
          let sql, dml = null;
          const ret = st.returning || 'id';
          if (st.op === 'select') sql = 'select ' + st.cols + ' from public.' + table + w + (st.order ? ' order by ' + st.order : '') + (st.limit ? ' limit ' + st.limit : '');
          else {
            if (st.op === 'insert') dml = 'insert into public.' + table + ' (' + Object.keys(st.row).join(',') + ') values (' + Object.values(st.row).map(val).join(',') + ')';
            else if (st.op === 'update') dml = 'update public.' + table + ' set ' + Object.keys(st.row).map(k => k + ' = ' + val(st.row[k])).join(', ') + w;
            else dml = 'delete from public.' + table + w;
            sql = 'select ' + ret + ' from {x}';
          }
          const r = asUser(uid, sql, dml);
          if (!r.error && st.single) {
            if (r.data.length !== 1) return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }).then(res, rej);
            return Promise.resolve({ data: r.data[0], error: null }).then(res, rej);
          }
          return Promise.resolve(r).then(res, rej);
        },
      };
      return b;
    },
    rpc(name, args) {
      const sql = 'select public.' + name + '(' + Object.keys(args).map(k => k + ' => ' + val(args[k])).join(', ') + ') as r';
      const r = asUser(uid, sql);
      return Promise.resolve(r.error ? r : { data: r.data[0].r, error: null });
    },
  };
}

(async function main() {
  psql('postgres', 'drop database if exists ' + DB);
  psql('postgres', 'create database ' + DB + ' template ' + SRC);
  console.log('Invoice storage adapter against drafts/32 (throwaway database ' + DB + ')');
  psql(DB, "delete from profiles where id in ('" + [O, A, E].join("','") + "');" +
    "insert into profiles (id, email, role, is_active, account_number) values ('" + O + "','owner@example.test','owner',true,'100000001')," +
    "('" + A + "','admin@example.test','administrator',true,'100000002'),('" + E + "','staff@example.test','employee',true,'100000003');" +
    [1, 2, 3].map(n => "insert into orders (id, channel, status, order_number) values ('" + ORD(n) + "','synthetic','paid','SYN-" + n + "');").join(''));
  const owner = S.createStore({ client: client(O), enabled: true, role: 'owner' });
  const staff = S.createStore({ client: client(E), enabled: true, role: 'employee' });

  const pr = await owner.probe();
  ok('before install: the adapter says storage is not installed', pr.installed, false);
  has('  in plain words', pr.message, /not installed in the database yet/);
  psql(DB, require('fs').readFileSync(INSTALL, 'utf8'), true);
  ok('after install: storage is installed and readable', (await owner.probe()).installed, true);

  const ITEMS = [{ sku: 'SYN-A', product_name: 'Synthetic item A', quantity: 10, unit_price: 18.5, line_total: 180 },
    { sku: 'SYN-B', product_name: 'Synthetic item B', quantity: 4, unit_price: 18.5, line_total: 74 }];
  const mk = (n, tf, acct) => Object.assign(I.draftFromOrder({ id: ORD(n), order_number: 'SYN-' + n, currency: 'USD', shipping_total: 12.5 }, ITEMS,
    { account: acct || { id: 'SYN-ACCT-' + n }, taxFields: tf }).draft, { billTo: { name: 'SYN Store ' + n, city: 'Chicago', state: 'IL' } });
  const PENDING = T.invoiceTaxFields({ shipping: { mandatory: true } });
  const CONFIRMED = T.invoiceTaxFields({ shipping: { mandatory: true }, localRate: 0.0275 });

  const s1 = await staff.saveDraft(mk(1, PENDING)); if (!s1.ok) console.log('    (' + s1.message + ')');
  ok('staff save a draft made from an order', s1.ok, true);
  ok('  stored as a pending-rate draft with no number', psql(DB, "select status||'/'||tax_rate_status||'/'||coalesce(invoice_number,'none')||'/'||(bill_to->>'name')||'/'||tax_shipping from invoices where order_id = '" + ORD(1) + "'"), 'draft/PENDING/none/SYN Store 1/true');
  ok('  read back through the adapter, the totals match the engine', [s1.invoice.subtotal, s1.invoice.shipping, s1.invoice.total].join('/'), [254, 12.5, mk(1, PENDING).total].join('/'));
  has('a second draft for the same order is refused', (await staff.saveDraft(mk(1, PENDING))).message, /already has an invoice that is not void/);
  has('staff cannot issue (refused before the database)', (await staff.issue(s1.invoice.id)).message, /Only the owner or an administrator/);
  const pageless = S.createStore({ client: client(E), enabled: true });      // a page that does not know the role
  has('  and the database refuses too', (await pageless.issue(s1.invoice.id)).message, /Only the owner or an administrator can issue/);
  has('decision 1: the owner cannot issue a pending-rate draft', (await owner.issue(s1.invoice.id)).message, /still pending/);

  const conf = Object.assign(mk(1, CONFIRMED), { id: s1.invoice.id });
  const up = await staff.saveDraft(conf);
  ok('staff update the draft once the rate is confirmed', up.ok && up.invoice.taxRateStatus, 'CONFIRMED');
  const i1 = await owner.issue(s1.invoice.id);
  ok('the owner issues it: the database gives the number', i1.ok && /^HE-\d{4}-0001$/.test(i1.number), true);
  ok('  due on receipt, dated today in Central time', i1.terms + '/' + (i1.issueDate === i1.dueDate), 'DUE_ON_RECEIPT/true');
  has('asking again is safe and says so', (await owner.issue(s1.invoice.id)).message, /^Already issued as HE-\d{4}-0001\. Nothing changed\.$/);
  has('an issued invoice can no longer be saved as a draft', (await owner.saveDraft(conf)).message, /no longer a draft/);
  has('an issued invoice cannot be removed', (await owner.removeDraft(s1.invoice.id)).message, /stay on the record/);

  const s2 = await staff.saveDraft(mk(2, CONFIRMED, { id: 'SYN-ACCT-2', creditApproved: true }));
  ok('a Net 14 draft for an approved account is saved', s2.ok && s2.invoice.terms, 'NET_14');
  const admin = S.createStore({ client: client(A), enabled: true, role: 'administrator' });
  const i2 = await admin.issue(s2.invoice.id, { terms: 'NET_14', creditApproved: true });
  ok('an administrator issues it with Net 14: the next number', /^HE-\d{4}-0002$/.test(i2.number), true);
  ok('  due 14 days after the day of issue', psql(DB, "select (due_date - issue_date)::text from invoices where id = '" + s2.invoice.id + "'"), '14');
  has('voiding without a real reason is refused', (await admin.void(s2.invoice.id, 'no')).message, /written reason is required/);
  has('an administrator voids it; the number stays', (await admin.void(s2.invoice.id, 'Entered twice (synthetic)')).message, /HE-\d{4}-0002 stays on the record/);
  ok('  stored as void with the reason', psql(DB, "select status||'/'||void_reason from invoices where id = '" + s2.invoice.id + "'"), 'void/Entered twice (synthetic)');
  has('voiding again is safe', (await admin.void(s2.invoice.id, 'Entered twice (synthetic)')).message, /Already void/);

  const s3 = await staff.saveDraft(mk(3, CONFIRMED));
  ok('staff remove a draft they no longer need', (await staff.removeDraft(s3.invoice.id)).ok, true);
  ok('  it is gone', psql(DB, "select count(*) from invoices where order_id = '" + ORD(3) + "'"), '0');
  has('a row the page did not check is still refused by the database', (await (async () => {
    const r = client(E).from('invoices').insert({ order_id: ORD(3), status: 'draft', tax_exempt: true, tax: 5, total: 5 }).select('id').single();
    return (await r).error.message; })()), /invoices_exempt_has_no_tax/);

  const all = await owner.list(); if (!all.ok) console.log('    (' + all.message + ')');
  ok('the list shows what is stored, newest first, with numbers', all.invoices.map(x => x.status).join(','), 'void,issued');
  ok('  every row read back has the storage marker', all.invoices.every(x => x.storage === 'database' && x.synthetic === false), true);
  const anon = S.createStore({ client: { from: client(O).from, rpc: () => Promise.resolve(asUserAnon()) }, enabled: true });
  function asUserAnon() {
    try { execFileSync('psql', CONN.concat(['-d', DB, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', "begin; set local role anon; select public.issue_invoice('" + s1.invoice.id + "'); commit;"]), { stdio: ['pipe', 'pipe', 'pipe'] }); return { data: null, error: { message: 'no error' } }; }
    catch (e) { const m = String(e.stderr).match(/ERROR:\s+(.*)/); return { data: null, error: { code: '42501', message: m ? m[1] : 'denied' } }; }
  }
  has('a visitor who is not signed in cannot issue', (await anon.issue(s1.invoice.id)).message, /permission/);

  psql('postgres', 'drop database if exists ' + DB);
  console.log('passed ' + pass + ', failed ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
