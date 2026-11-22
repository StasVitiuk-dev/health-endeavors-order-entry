#!/usr/bin/env node
// LOCAL TEST ONLY (2026-11-22). Never contacts Shopify or Supabase.
// Runs the daily Shopify payout sync core (docs/ops/edge-drafts/shopify-payouts-sync/
// sync-core.mjs) against MADE-UP Shopify replies, and writes into drafts/42 on a
// throwaway copy of the local database through a stand-in for the service role,
// then runs the daily check. Proves: read-only queries, pagination, the rate-limit
// pause, refusal of bad amounts, running twice changes nothing, and that a payout
// that does not add up becomes one open difference.
// Usage: node shopify_sync_core_test.mjs -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../../edge-drafts/shopify-payouts-sync/sync-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONN = process.argv.slice(2);
const SRC = 'he_real', DB = 'he_shopify_sync_test';
const INSTALL = path.join(HERE, '..', 'drafts', '42_DRAFT_shopify_payouts_money_issues.sql');
let pass = 0, fail = 0;
const ok = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ': expected ' + w + ', got ' + g); } };
const psql = (db, sql) => execFileSync('psql', CONN.concat(['-d', db, '-qtAX', '-v', 'ON_ERROR_STOP=1', '-c', sql]), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const lit = (v) => v == null ? 'null' : typeof v === 'boolean' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";

// ---- made-up Shopify ------------------------------------------------------------
const PAYOUTS = [
  { id: 'gid://shopify/ShopifyPaymentsPayout/9001', issuedAt: '2026-11-16T18:00:00Z', status: 'PAID', net: { amount: '412.07', currencyCode: 'USD' } },
  { id: 'gid://shopify/ShopifyPaymentsPayout/9002', issuedAt: '2026-11-18T18:00:00Z', status: 'PAID', net: { amount: '261.87', currencyCode: 'USD' } },
  { id: 'gid://shopify/ShopifyPaymentsPayout/9003', issuedAt: '2026-11-21T18:00:00Z', status: 'IN_TRANSIT', net: { amount: '99.0', currencyCode: 'USD' } },
];
const tx = (id, payout, type, amount, fee, net, order, test) => ({ id, type, test: !!test, transactionDate: '2026-11-15T15:00:00Z',
  amount: { amount, currencyCode: 'USD' }, fee: { amount: fee }, net: { amount: net }, associatedPayout: { id: payout }, associatedOrder: order ? { id: 'gid://shopify/Order/' + order, name: '#' + order } : null });
const TXS = [
  tx('b1', 'gid://shopify/ShopifyPaymentsPayout/9001', 'CHARGE', '250.0', '7.55', '242.45', 1101),
  tx('b2', 'gid://shopify/ShopifyPaymentsPayout/9001', 'CHARGE', '175.0', '5.38', '169.62', 1102),
  tx('b3', 'gid://shopify/ShopifyPaymentsPayout/9001', 'TRANSFER', '-412.07', '0.0', '-412.07'),
  tx('b4', 'gid://shopify/ShopifyPaymentsPayout/9002', 'CHARGE', '270.0', '8.13', '261.87', 1103),
  tx('b5', 'gid://shopify/ShopifyPaymentsPayout/9003', 'CHARGE', '101.0', '3.0', '98.0', 1104),
];
function fakeShopify(opts) {
  const o = opts || {}; const calls = []; let throttles = o.throttle || 0;
  const fn = async (payload) => {
    calls.push(payload);
    if (throttles > 0) { throttles--; return { status: 429, body: null }; }
    if (o.status) return { status: o.status, body: null };
    if (o.errors) return { status: 200, body: { errors: [{ message: o.errors }] } };
    const v = payload.variables || {};
    const isPayouts = /payouts\(/.test(payload.query);
    const all = isPayouts ? (o.payouts || PAYOUTS) : (o.txs || TXS);
    const start = v.after ? Number(v.after) : 0, size = o.pageSize || 2;
    const nodes = all.slice(start, start + size);
    const more = start + size < all.length;
    const conn = { nodes, pageInfo: { hasNextPage: more, endCursor: more ? String(start + size) : null } };
    return { status: 200, body: { data: { shopifyPaymentsAccount: isPayouts ? { payouts: conn } : { balanceTransactions: conn } } } };
  };
  return { fn, calls };
}
// the service role writing into the throwaway database (bypasses the row rules, as in Supabase)
function serviceDb() {
  const writes = [];
  return {
    writes,
    async upsert(table, rows) {
      writes.push(table + ':' + rows.length);
      const cols = Object.keys(rows[0]);
      const values = rows.map(r => '(' + cols.map(c => lit(r[c])).join(',') + ')').join(',');
      psql(DB, 'insert into public.' + table + ' (' + cols.join(',') + ') values ' + values + ' on conflict (id) do update set ' + cols.filter(c => c !== 'id').map(c => c + ' = excluded.' + c).join(', ') + ', synced_at = now()');
    },
    async rpc(name) { return Number(psql(DB, 'select public.' + name + '()')); },
  };
}

(async () => {
  console.log('Shopify payout sync core (made-up Shopify, throwaway database ' + DB + ')');
  console.log(' 1. reading Shopify');
  ok('money: Shopify\'s amounts become exact two-decimal figures', ['41.9', '-43.12', '0.0', '12', '1.005', 'abc', null].map(C.money), ['41.90', '-43.12', '0.00', '12.00', null, null, null]);
  ok('the queries only read (no mutation)', [C.PAYOUTS_QUERY, C.TRANSACTIONS_QUERY].every(q => /^query /.test(q) && !/mutation/i.test(q)), true);
  ok('a payout without an amount is refused, not stored as 0', C.mapPayout({ id: 'x', issuedAt: '2026-11-01T00:00:00Z', net: { amount: null, currencyCode: 'USD' } }).error, 'payout x has no readable amount');
  ok('a transaction whose net is not amount minus fee is refused', C.mapTransaction(tx('bad', 'p', 'CHARGE', '10.0', '1.0', '10.0')).error, 'transaction bad: net is not amount minus fee');

  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  psql('postgres', 'create database ' + DB + ' template ' + SRC);
  execFileSync('psql', CONN.concat(['-d', DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', INSTALL]), { stdio: 'pipe' });

  console.log(' 2. a full run, two pages each, with one rate-limit pause');
  const S1 = fakeShopify({ throttle: 1 }); const db1 = serviceDb(); const waits = [];
  const r1 = await C.runSync({ fetchJson: S1.fn, db: db1, sleep: async (ms) => { waits.push(ms); }, now: '2026-11-24T12:00:00Z' });
  ok('it stores 3 payouts and 5 transactions and finds 1 difference', [r1.payouts, r1.transactions, r1.newDifferences, r1.problems], [3, 5, 1, []]);
  ok('  it paused once for the rate limit and tried again', waits, [1000]);
  ok('  it asked for the last 35 days, by Shopify\'s own date fields', [S1.calls[1].variables.query, S1.calls[S1.calls.length - 1].variables.query], ['issued_at:>=2026-10-20', 'processed_at:>=2026-10-20']);
  ok('  it followed the pages (2 + 3 calls after the pause)', S1.calls.length, 1 + 2 + 3);
  ok('  the database holds what Shopify said', psql(DB, "select count(*)||'/'||sum(net) from shopify_payouts") + ' ' + psql(DB, "select count(*) from shopify_balance_transactions"), '3/772.94 5');
  ok('  the difference names the payout that does not add up', psql(DB, 'select summary from money_match_issues'), 'Shopify payout of $99.00: its 1 transaction(s) add up to $98.00');

  console.log(' 3. running again changes nothing; an update from Shopify is applied');
  const r2 = await C.runSync({ fetchJson: fakeShopify().fn, db: serviceDb(), sleep: async () => {}, now: '2026-11-24T13:00:00Z' });
  ok('a second run adds no payout, transaction or difference', [psql(DB, 'select count(*) from shopify_payouts'), psql(DB, 'select count(*) from shopify_balance_transactions'), r2.newDifferences], ['3', '5', 0]);
  const moved = PAYOUTS.map(p => p.id.endsWith('9003') ? Object.assign({}, p, { status: 'PAID' }) : p);
  await C.runSync({ fetchJson: fakeShopify({ payouts: moved }).fn, db: serviceDb(), sleep: async () => {}, now: '2026-11-25T12:00:00Z' });
  ok('  a payout that has now arrived is updated, not duplicated', psql(DB, "select status from shopify_payouts where id like '%9003'") + '/' + psql(DB, 'select count(*) from shopify_payouts'), 'PAID/3');

  console.log(' 4. what goes wrong is said plainly, and nothing is half-written');
  const before = psql(DB, 'select count(*) from shopify_balance_transactions');
  const tryRun = async (shop) => { try { await C.runSync({ fetchJson: shop.fn, db: serviceDb(), sleep: async () => {} }); return 'no error'; } catch (e) { return e.message; } };
  ok('a wrong or revoked key', await tryRun(fakeShopify({ status: 401 })), 'Shopify refused the access key (401). Check that the app has the read-only payout scopes.');
  ok('Shopify reporting an error', await tryRun(fakeShopify({ errors: 'Access denied for shopifyPaymentsAccount field.' })), 'Shopify reported: Access denied for shopifyPaymentsAccount field.');
  ok('still rate-limited after 4 tries', await tryRun(fakeShopify({ throttle: 9 })), 'Shopify answered 429.');
  ok('  none of these wrote anything', psql(DB, 'select count(*) from shopify_balance_transactions'), before);
  const bad = TXS.concat([tx('b9', 'gid://shopify/ShopifyPaymentsPayout/9002', 'CHARGE', 'abc', '0.0', '0.0', 1109)]);
  const r3 = await C.runSync({ fetchJson: fakeShopify({ txs: bad }).fn, db: serviceDb(), sleep: async () => {} });
  ok('an unreadable transaction is reported and left out; the rest is stored', [r3.transactions, r3.problems], [5, ['transaction b9 has no readable amount']]);

  psql('postgres', 'drop database if exists ' + DB + ' with (force)');
  console.log('passed ' + pass + ', failed ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
