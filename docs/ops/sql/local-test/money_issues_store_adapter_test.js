#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-28). Never point this at Supabase.
// Runs the dashboard's money-differences code (assets/reports/he-money-issues-store.js: the list of
// differences on Accounting and Home, saving the ones found in a bank or card file, "mark checked")
// against drafts/42 installed on a throwaway copy of the real-shape database, through a tiny stand-in
// for the supabase-js client that turns exactly the calls the code makes into SQL, run as a given
// person. It runs in the database suite, so GitHub runs it too. All rows are synthetic.
// Usage: node money_issues_store_adapter_test.js -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const MI = require('../../../../assets/reports/he-money-issues-store.js');

const CONN = process.argv.slice(2);
const SRC = 'he_real', DB = 'he_money_issues_store_test';
const INSTALL = path.join(__dirname, '..', 'drafts', '42_DRAFT_shopify_payouts_money_issues.sql');
const O = '00000000-0000-4000-8000-0000000042a1', A = '00000000-0000-4000-8000-0000000042a2', E = '00000000-0000-4000-8000-0000000042a3';
let pass = 0, fail = 0;
const ok = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + w + ', got ' + g); } };
const has = (name, got, re) => { if (re.test(String(got))) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + re + ' in [' + String(got).slice(0, 240) + ']'); } };

const psql = (db, sql) => execFileSync('psql', CONN.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const q = (sql) => psql(DB, sql);
const lit = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const val = (v) => v == null ? 'null' : (typeof v === 'boolean' || typeof v === 'number') ? String(v) : lit(v);

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
const called = new Set();
function client(uid) {
  return {
    from(table) {
      const st = { cols: '*', order: [], limit: null };
      const b = {
        select(c) { st.cols = c; return b; },
        eq(k, v) { (st.where = st.where || []).push(k + ' = ' + lit(v)); return b; },
        order(k, o) { st.order.push(k + (o && o.ascending === false ? ' desc' : '')); return b; },
        limit(n) { st.limit = n; return b; },
        then(res, rej) {
          called.add(table);
          return Promise.resolve(asUser(uid, 'select ' + st.cols + ' from public.' + table + (st.where && st.where.length ? ' where ' + st.where.join(' and ') : '') + (st.order.length ? ' order by ' + st.order.join(', ') : '') + (st.limit ? ' limit ' + st.limit : ''))).then(res, rej);
        },
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
const store = (uid, role) => MI.createStore({ client: client(uid), enabled: true, role });
// three items as the money-matching engine (he-money-match.js) hands them over; amounts in cents
const ITEMS = [
  { needsLook: true, outcome: 'MISSING', kind: 'shopify_payout', ref: 'SYN-P-1', label: 'Shopify payout', date: '2026-11-20', expected: 12345, why: 'no deposit found within 5 days' },
  { needsLook: true, outcome: 'AMOUNT_DIFFERS', kind: 'bank', ref: 'SYN-P-2', label: 'Shopify payout', date: '2026-11-21', expected: 5000, found: 4990,
    bankLine: { cents: 4990, description: 'SHOPIFY PAYOUT SYNTHETIC' }, why: 'the deposit is $0.10 less' },
  { needsLook: true, outcome: 'NOT_RECORDED', kind: 'card', date: '2026-11-22', found: 1999, bankLine: { cents: -1999, description: 'SYNTHETIC LABELS' }, why: 'no expense recorded' },
  { needsLook: false, outcome: 'MATCHED', kind: 'bank', ref: 'SYN-P-3' }];

(async function main() {
  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  psql('postgres', 'create database ' + DB + ' template ' + SRC);
  console.log('Money differences: the dashboard\'s code against drafts/42 (throwaway database ' + DB + ')');
  q("insert into profiles (id, email, role, is_active, account_number) values ('" + O + "','o42@example.test','owner',true,'942000001'), ('" + A + "','a42@example.test','administrator',true,'942000002'), ('" + E + "','e42@example.test','employee',true,'942000003');");

  const l0 = await store(O, 'owner').listOpen();
  ok('before drafts/42: the page says it is not installed', [l0.ok, /not installed/.test(String(l0.message))], [false, true]);
  execFileSync('psql', CONN.concat(['-d', DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', INSTALL]), { stdio: 'ignore' });

  const s1 = await store(O, 'owner').save(ITEMS);
  ok('the owner saves the three differences found in a file (a match is not saved)', [s1.ok, s1.added, s1.already, q('select count(*) from money_match_issues')], [true, 3, 0, '3']);
  ok('  amounts are stored in dollars, exactly', q("select string_agg(coalesce(expected::text,'-') || '/' || coalesce(found::text,'-'), ' ' order by occurred_on) from money_match_issues"), '123.45/- 50.00/49.90 -/19.99');
  const s2 = await store(A, 'administrator').save(ITEMS);
  ok('the same file saved again by an administrator adds nothing', [s2.ok, s2.added, s2.already, q('select count(*) from money_match_issues')], [true, 0, 3, '3']);
  const staff = await store(E, null).save(ITEMS.slice(0, 1).map(x => Object.assign({}, x, { ref: 'SYN-P-9' })));
  ok('staff cannot save a difference, even with the page\'s check bypassed', [staff.ok, q('select count(*) from money_match_issues')], [false, '3']);
  const staffList = await store(E, null).listOpen();
  ok('  and see none', [staffList.ok ? staffList.issues.length : 0], [0]);

  const l1 = await store(O, 'owner').listOpen();
  ok('the open list shows all three, oldest first', [l1.ok, l1.issues.map(x => x.outcome)], [true, ['MISSING', 'AMOUNT_DIFFERS', 'NOT_RECORDED']]);
  const id = l1.issues[0].id;
  const short = await store(O, 'owner').markChecked(id, 'ok');
  ok('marking checked needs a note of at least 5 characters (said before sending)', short.ok, false);
  const c1 = await store(A, 'administrator').markChecked(id, 'deposit arrived on the 26th');
  ok('an administrator marks one checked with a note; it leaves the open list and stays on the record', [c1.ok, (await store(O, 'owner').listOpen()).issues.length, q("select status || '|' || (checked_by = '" + A + "') from money_match_issues where id = '" + id + "'")], [true, 2, 'checked|true']);
  const c2 = await store(O, 'owner').markChecked(id, 'checked twice by mistake');
  ok('  marking it again: the database says it is already checked', c2.ok, false);
  let del = '';
  try { del = execFileSync('psql', CONN.concat(['-d', DB, '-qtAX', '-v', 'ON_ERROR_STOP=1']), { input: "begin; set local role authenticated; set local request.jwt.claim.sub = '" + O + "'; delete from public.money_match_issues; commit;", encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { del = String(e.stderr || e.message); }
  ok('nobody deletes a difference, the owner included (the delete really runs, as the owner)', [/permission denied|row-level|never deleted|refused/i.test(del) || q('select count(*) from money_match_issues') === '3', q('select count(*) from money_match_issues')], [true, '3']);
  ok('every call the code made exists in the draft', [...called].sort(), ['mark_money_issue_checked', 'money_match_issues', 'record_money_issue']);
  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  console.log('money issues store: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
