#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-16). Never point this at Supabase.
// Runs the dashboard's supplier document storage adapter
// (assets/suppliers/he-supplier-docs-store.js) and the checklist engine
// (he-supplier-docs.js) against drafts/36 installed on a throwaway copy of the
// local database, through a tiny stand-in for the supabase-js client that turns
// exactly the calls the adapter makes into SQL, run as a given person. Proves:
// records survive a page refresh (a fresh store reads them back), a retried save
// never records twice, and an administrator or staff member cannot approve or
// change the checklist even when the page's own check is bypassed.
// All rows are synthetic.
// Usage: node supplier_docs_store_adapter_test.js -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const S = require('../../../../assets/suppliers/he-supplier-docs-store.js');
const D = require('../../../../assets/suppliers/he-supplier-docs.js');

const CONN = process.argv.slice(2);
const SRC = 'he_real', DB = 'he_supplier_docs_store_test';
const INSTALL = path.join(__dirname, '..', 'drafts', '36_DRAFT_supplier_documents.sql');
const O = '00000000-0000-4000-8000-0000000001a1', A = '00000000-0000-4000-8000-0000000001a2', E = '00000000-0000-4000-8000-0000000001a3';
const LAB = '00000000-0000-4000-8000-0000000001b1', BOT = '00000000-0000-4000-8000-0000000001b2', LBL = '00000000-0000-4000-8000-0000000001b3';
const POL = '00000000-0000-4000-8000-0000000001c1';
const K = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
let pass = 0, fail = 0;
const ok = (name, got, want) => { if (got === want) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected [' + want + '], got [' + got + ']'); } };
const has = (name, got, re) => { if (re.test(String(got))) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + re + ' in [' + String(got).slice(0, 220) + ']'); } };

function psql(db, sql) {
  return execFileSync('psql', CONN.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
const lit = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const val = (v) => Array.isArray(v) ? 'array[' + v.map(lit).join(',') + ']::text[]'
  : (v !== null && typeof v === 'object') ? lit(JSON.stringify(v)) + '::jsonb' : (typeof v === 'boolean' || typeof v === 'number') ? String(v) : lit(v);

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

// The stand-in client: only the read chains and rpc() the adapter uses.
let rpcCalls = 0;
function client(uid) {
  return {
    from(table) {
      const st = { cols: '*', where: [], order: null, limit: null };
      const b = {
        select(c) { st.cols = c; return b; },
        eq(k, v) { st.where.push(k + ' = ' + lit(v)); return b; },
        order(k, o) { st.order = k + (o && o.ascending === false ? ' desc' : ''); return b; },
        limit(n) { st.limit = n; return b; },
        then(res, rej) {
          const sql = 'select ' + st.cols + ' from public.' + table + (st.where.length ? ' where ' + st.where.join(' and ') : '') + (st.order ? ' order by ' + st.order : '') + (st.limit ? ' limit ' + st.limit : '');
          return Promise.resolve(asUser(uid, sql)).then(res, rej);
        },
      };
      return b;
    },
    rpc(name, args) {
      rpcCalls++;
      const r = asUser(uid, 'select public.' + name + '(' + Object.keys(args).map(k => k + ' => ' + val(args[k])).join(', ') + ') as r');
      return Promise.resolve(r.error ? r : { data: r.data[0].r, error: null });
    },
  };
}
const store = (uid, role) => S.createStore({ client: client(uid), enabled: true, role });
const count = (sql) => psql(DB, sql);

(async function main() {
  psql('postgres', 'drop database if exists ' + DB);
  psql('postgres', 'create database ' + DB + ' template ' + SRC);
  console.log('Supplier document storage adapter against drafts/36 (throwaway database ' + DB + ')');
  psql(DB, "delete from profiles where id in ('" + [O, A, E].join("','") + "');" +
    "insert into profiles (id, email, role, is_active, account_number) values ('" + O + "','owner@example.test','owner',true,'400000001')," +
    "('" + A + "','admin@example.test','administrator',true,'400000002'),('" + E + "','staff@example.test','employee',true,'400000003');" +
    "insert into suppliers (id, name, supplier_type, is_active) values ('" + LAB + "','SYN Lotion Lab','lab',true),('" + BOT + "','SYN Bottles','packaging',true),('" + LBL + "','SYN Label Printer','other',true);" +
    "insert into purchase_orders (id, po_number, supplier_id, status, payment_status) values ('" + POL + "','SYN-PO-951','" + LAB + "','received','paid');");

  // the column list the adapter reads matches the draft's tables
  const draft = fs.readFileSync(INSTALL, 'utf8');
  const missing = [];
  for (const [t, cols] of Object.entries(S.COLUMNS)) {
    const m = draft.match(new RegExp('create table if not exists public\\.' + t + ' \\(([\\s\\S]*?)\\n\\);'));
    if (!m) { missing.push(t + ' (table)'); continue; }
    for (const c of cols) if (!new RegExp('\\n\\s+' + c + '\\s').test(m[1])) missing.push(t + '.' + c);
  }
  ok('every column the adapter reads exists in drafts/36', missing.join(', '), '');

  const off = S.createStore({ client: client(O), enabled: false, role: 'owner' });
  ok('switched off: nothing is called', (await off.record({ requestKey: K(1) })).off, true);
  const pr = await store(O, 'owner').probe();
  ok('before install: storage is reported as not installed', pr.installed, false);
  has('  in plain words', pr.message, /not installed in the database yet/);
  execFileSync('psql', CONN.concat(['-d', DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', INSTALL]), { stdio: 'ignore' });
  ok('after install: storage is readable', (await store(E, 'employee').probe()).ok, true);

  console.log(' the checklist comes from the database');
  let L = await store(E, 'employee').load();
  ok('staff can load the checklist and documents', L.ok, true);
  ok('  staff do not see purchase orders (existing row rule), so no purchase documents are listed for them', L.context.purchaseOrders.length, 0);
  L = await store(A, 'administrator').load();
  ok('  the stored checklist is a valid checklist for the engine', D.checkChecklist(L.checklist).join('; '), '');
  ok('  it is the owner\'s Nov 16 checklist', JSON.stringify(Object.keys(L.checklist.profiles)) + '/' + L.checklist.purchase.map(d => d.key).join(','),
    '["lotion_lab","bottles_pumps","labels_printing"]/quote_or_order_confirmation,supplier_invoice,packing_slip');
  let ov = D.overview(L.suppliers, L.context, L.documents, { checklist: L.checklist, asOf: '2026-11-16' });
  const lab = () => ov.suppliers.find(s => s.supplier.id === LAB);
  ok('  the lab\'s received, paid order needs its 3 purchase documents, all missing', lab().missing + '/' + lab().total, '3/3');

  console.log(' recording, retries and refresh');
  const staff = store(E, 'employee');
  const input = { requestKey: K(1), supplierId: LAB, kind: 'certificate_of_analysis', subjectKind: 'batch', subjectRef: 'LOT-501', subjectLabel: 'Lot 501', reference: 'COA-501', receivedOn: '2026-11-15', documentDate: '2026-11-14', expiresOn: '2027-11-14' };
  const [r1, r2] = await Promise.all([staff.record(input), staff.record(input)]);
  ok('a double click: the first save records, the second is held back while the first is sent', (r1.ok ? 'ok' : r1.busy ? 'busy' : 'x') + '/' + (r2.ok ? 'ok' : r2.busy ? 'busy' : 'x'), 'ok/busy');
  const retry = await store(E, 'employee').record(input);
  ok('a retry after a lost reply (same request key, fresh page) adds nothing', retry.duplicate, true);
  has('  and says so in plain words', retry.message, /Already recorded/);
  ok('  one document in the database', count("select count(*) from supplier_documents"), '1');
  L = await store(O, 'owner').load();
  const doc = L.documents.find(d => d.subjectId === 'LOT-501');
  ok('after a refresh (a new page reading the database) the document is there', !!doc, true);
  ok('  with its reference, dates and status', [doc.reference, doc.receivedAt, doc.documentDate, doc.expiresOn, doc.status].join('/'), 'COA-501/2026-11-15/2026-11-14/2027-11-14/received');
  ov = D.overview(L.suppliers, L.context, L.documents, { checklist: L.checklist, asOf: '2026-11-16' });
  const coa = lab().rows.find(r => r.key === 'certificate_of_analysis' && r.subjectId === 'LOT-501');
  ok('  the checklist shows the new batch, its certificate awaiting review', coa && coa.status, 'AWAITING_REVIEW');
  ok('  and the batch record for that batch as missing', lab().rows.find(r => r.key === 'batch_record' && r.subjectId === 'LOT-501').status, 'MISSING');
  has('a save without a request key is refused before the database is asked', (await staff.record(Object.assign({}, input, { requestKey: 'x' }))).message, /request key/);
  has('an expiry before the document date is refused before the database is asked', (await staff.record(Object.assign({}, input, { requestKey: K(2), expiresOn: '2026-01-01' }))).message, /expiry is before/);
  has('staff recording a purchase document: the database says who records those', (await staff.record({ requestKey: K(3), supplierId: LAB, kind: 'supplier_invoice', subjectKind: 'purchase', subjectRef: POL })).message, /recorded by the owner or an administrator/);
  has('a purchase document for another supplier\'s order: the database says why', (await store(A, 'administrator').record({ requestKey: K(4), supplierId: BOT, kind: 'supplier_invoice', subjectKind: 'purchase', subjectRef: POL })).message, /not one of this supplier/);
  const inv = await store(A, 'administrator').record({ requestKey: K(5), supplierId: LAB, kind: 'supplier_invoice', subjectKind: 'purchase', subjectRef: POL, reference: 'INV-951' });
  ok('an administrator records the supplier invoice for the lab\'s order', inv.ok + '/' + inv.duplicate, 'true/false');

  console.log(' only the owner reviews or changes the checklist');
  const id = doc.id;
  has('the page refuses an administrator\'s approval', (await store(A, 'administrator').review(id, 'approved')).message, /Only the owner/);
  const before = rpcCalls;
  await store(A, 'administrator').review(id, 'approved');
  ok('  without asking the database', rpcCalls, before);
  has('with the page\'s check bypassed, the database refuses an administrator', (await store(A, null).review(id, 'approved')).message, /Only the owner can approve or reject/);
  has('  and staff', (await store(E, null).review(id, 'approved')).message, /Only the owner can approve or reject/);
  has('  and an administrator changing the checklist', (await store(A, null).setTypeProfiles('other', ['labels_printing'])).message, /Only the owner can change/);
  ok('  the document is still waiting', count("select status from supplier_documents where id = '" + id + "'"), 'received');
  has('a rejection needs a reason', (await store(O, 'owner').review(id, 'rejected', 'no')).message, /Say why/);
  const ap = await store(O, 'owner').review(id, 'approved');
  ok('the owner approves', ap.ok + '/' + ap.status, 'true/approved');
  const ap2 = await store(O, 'owner').review(id, 'approved');
  ok('  approving again changes nothing', ap2.alreadyDecided, true);
  L = await store(E, 'employee').load();
  ov = D.overview(L.suppliers, L.context, L.documents, { checklist: L.checklist, asOf: '2026-11-16' });
  ok('after a refresh the certificate counts as approved', lab().rows.find(r => r.key === 'certificate_of_analysis' && r.subjectId === 'LOT-501').status, 'APPROVED');
  ok('  and its expiry is shown', lab().rows.find(r => r.key === 'certificate_of_analysis' && r.subjectId === 'LOT-501').expiresOn, '2027-11-14');
  ok('  checked a day after it expires, it needs a new copy', D.overview(L.suppliers, L.context, L.documents, { checklist: L.checklist, asOf: '2027-11-15' })
    .suppliers.find(s => s.supplier.id === LAB).rows.find(r => r.key === 'certificate_of_analysis').status, 'EXPIRED');
  ok('the history holds the recording and the approval, in order', L.history.filter(h => h.document_id === id).map(h => h.event).reverse().join(','), 'recorded,approved');
  ok('  the approval is the owner\'s', L.history.find(h => h.document_id === id && h.event === 'approved').by_user, O);

  ok('the owner gives the "other" type the labels checklist', (await store(O, 'owner').setTypeProfiles('other', ['labels_printing'])).ok, true);
  psql(DB, "insert into supplier_document_subjects (supplier_id, subject_kind, subject_ref, label) values ('" + LBL + "','artwork','ART-9','Honey Milk label v9')");
  L = await store(E, 'employee').load();
  ov = D.overview(L.suppliers, L.context, L.documents, { checklist: L.checklist, asOf: '2026-11-16' });
  ok('  after a refresh the label printer is held to it: artwork and proof missing', ov.suppliers.find(s => s.supplier.id === LBL).rows.map(r => r.key + ':' + r.status).join(','), 'approved_artwork:MISSING,printer_proof:MISSING');
  ok('the owner takes the printer proof off the checklist', (await store(O, 'owner').setTypeActive('printer_proof', false)).ok, true);
  L = await store(E, 'employee').load();
  ok('  after a refresh it is no longer asked for', D.overview(L.suppliers, L.context, L.documents, { checklist: L.checklist, asOf: '2026-11-16' })
    .suppliers.find(s => s.supplier.id === LBL).rows.map(r => r.key).join(','), 'approved_artwork');

  console.log(' withdrawing');
  const r9 = await staff.record({ requestKey: K(9), supplierId: LAB, kind: 'batch_record', subjectKind: 'batch', subjectRef: 'LOT-501', reference: 'BR-WRONG' });
  ok('staff record a batch record', r9.ok, true);
  has('an administrator cannot withdraw what staff recorded', (await store(A, 'administrator').withdraw(r9.id, 'Recorded by mistake')).message, /Only the person who recorded it/);
  ok('the person who recorded it withdraws it', (await staff.withdraw(r9.id, 'Wrong invoice attached')).ok, true);
  L = await store(E, 'employee').load();
  ok('  after a refresh it is no longer counted, but stays in the history', (L.documents.some(d => d.id === r9.id)) + '/' + L.history.filter(h => h.document_id === r9.id).map(h => h.event).reverse().join(','), 'false/recorded,withdrawn');

  psql('postgres', 'drop database if exists ' + DB);
  console.log('passed ' + pass + ', failed ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
