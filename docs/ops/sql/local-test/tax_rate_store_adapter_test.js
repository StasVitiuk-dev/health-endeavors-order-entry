#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-28). Never point this at Supabase.
// Runs the dashboard's confirmed-tax-rate code (assets/invoice/he-tax-rate-store.js: list, confirm,
// re-check) and the tax rules' reading of it (toSetting, standing) against drafts/46 installed on a
// throwaway copy of the real-shape database, through a tiny stand-in for the supabase-js client that
// turns exactly the calls the code makes into SQL, run as a given person. The browser test against a
// real database skips on GitHub (no database there); this one runs in the database suite, so GitHub
// runs it too. All rows are synthetic; the rates are examples, not the owner's rate.
// Usage: node tax_rate_store_adapter_test.js -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const T = require('../../../../assets/invoice/he-tax-rate-store.js');

const CONN = process.argv.slice(2);
const SRC = 'he_real', DB = 'he_tax_rate_store_test';
const INSTALL = path.join(__dirname, '..', 'drafts', '46_DRAFT_tax_rates.sql');
const O = '00000000-0000-4000-8000-0000000046a1', A = '00000000-0000-4000-8000-0000000046a2', E = '00000000-0000-4000-8000-0000000046a3';
const PL = 'Ships from: SYNTHETIC place';
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
        order(k, o) { st.order.push(k + (o && o.ascending === false ? ' desc' : '')); return b; },
        limit(n) { st.limit = n; return b; },
        then(res, rej) {
          called.add(table);
          return Promise.resolve(asUser(uid, 'select ' + st.cols + ' from public.' + table + (st.order.length ? ' order by ' + st.order.join(', ') : '') + (st.limit ? ' limit ' + st.limit : ''))).then(res, rej);
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
const store = (uid, role) => T.createStore({ client: client(uid), enabled: true, role });

(async function main() {
  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  psql('postgres', 'create database ' + DB + ' template ' + SRC);
  console.log('Confirmed tax rates: the dashboard\'s code against drafts/46 (throwaway database ' + DB + ')');
  q("insert into profiles (id, email, role, is_active, account_number) values ('" + O + "','o46@example.test','owner',true,'946000001'), ('" + A + "','a46@example.test','administrator',true,'946000002'), ('" + E + "','e46@example.test','employee',true,'946000003');");

  const l0 = await store(O, 'owner').list();
  ok('before drafts/46: the page says it is not installed', [l0.ok, l0.installed === false || /not installed/.test(String(l0.message))], [false, true]);
  execFileSync('psql', CONN.concat(['-d', DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', INSTALL]), { stdio: 'ignore' });

  const c1 = await store(O, 'owner').confirm({ place: PL, ratePercent: '8.75', from: '2026-07-01', source: 'IDOR Tax Rate Finder' });
  ok('the owner confirms 8.75% from 2026-07-01, as the page sends it', [c1.ok, c1.duplicate, q('select rate from tax_rates')], [true, false, '0.08750']);
  const c1b = await store(O, 'owner').confirm({ place: PL, ratePercent: '8.75', from: '2026-07-01', source: 'IDOR Tax Rate Finder' });
  ok('  the same rate again: the database says it is already there; still one row', [c1b.ok, c1b.duplicate, q('select count(*) from tax_rates')], [true, true, '1']);
  const c2 = await store(A, 'administrator').confirm({ place: PL, ratePercent: '9.0', from: '2027-01-01', source: 'IDOR Tax Rate Finder', note: 'new year' });
  ok('an administrator confirms a new rate: the earlier one ends the day before', [c2.ok, q("select coalesce(effective_until::text, '-') from tax_rates where effective_from = '2026-07-01'")], [true, '2026-12-31']);
  const staff = await store(E, null).confirm({ place: PL, ratePercent: '1', from: '2027-02-01', source: 'IDOR Tax Rate Finder' });
  ok('staff cannot confirm a rate, even with the page\'s check bypassed', [staff.ok, q('select count(*) from tax_rates')], [false, '2']);
  has('  and are told so', staff.message, /owner|administrator|permission/i);
  const addr = await store(O, 'owner').confirm({ place: '123 Main St, Chicago IL 60601', ratePercent: '10.25', from: '2027-03-01', source: 'IDOR Tax Rate Finder' });
  ok('a street address as the place is refused before anything is sent', [addr.ok, q('select count(*) from tax_rates')], [false, '2']);

  const l1 = await store(E, 'employee').list();
  ok('everyone on staff reads the rates, newest first per place', [l1.ok, l1.rates.map(r => r.effective_from)], [true, ['2027-01-01', '2026-07-01']]);
  const s = l1.settings.map(x => x && T.pctText(x.rate));
  ok('  each stored rate becomes the setting the tax rules use (8.75 and 9)', s.sort(), ['8.75', '9']);
  const inForce = T.standing(l1.rates.find(r => r.effective_from === '2026-07-01'), '2026-11-28');   // the stored row, as the page passes it
  ok('  on Nov 28, 2026 the 8.75% rate is the one in force', inForce.state, 'IN_FORCE');
  const id = l1.rates.find(r => r.effective_from === '2026-07-01').id;
  const rc = await store(O, 'owner').recheck(id);
  ok('the owner records a re-check: stored with who and when', [rc.ok, q("select (rechecked_by = '" + O + "')::text from tax_rates where id = '" + id + "'")], [true, 'true']);
  const rcStaff = await store(E, null).recheck(id);
  ok('  staff cannot record a re-check', rcStaff.ok, false);

  ok('every call the code made exists in the draft', [...called].sort(), ['recheck_tax_rate', 'set_tax_rate', 'tax_rates']);
  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  console.log('tax rate store: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
