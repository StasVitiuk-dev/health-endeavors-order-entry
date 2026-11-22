// DRAFT (2026-11-22). NOT DEPLOYED. The core of the daily Shopify payout sync
// (owner request of Nov 22). Runs inside a Supabase Edge Function (index.ts) once
// the owner approves drafts/42 and this function; tested locally with made-up
// Shopify replies (docs/ops/sql/local-test/shopify_sync_core_test.mjs).
//
// What it does, and nothing else:
//   1 asks Shopify (GraphQL Admin API, READ-ONLY queries) for recent Shopify
//     Payments payouts and the balance transactions inside them
//   2 stores them in shopify_payouts / shopify_balance_transactions (insert or
//     update by Shopify's id, so running twice changes nothing)
//   3 runs check_shopify_payouts(), which records every payout that does not add
//     up as an open difference for the owner
// It never sends a mutation, never touches orders, customers, products or
// money, and never logs the access key. It needs these read-only access scopes:
// read_shopify_payments_accounts (or read_shopify_payments) and
// read_shopify_payments_payouts.
//
// Pure apart from what it is given: fetchJson (to Shopify), db (to Supabase),
// sleep and now. Works in Deno (the Edge Function) and in Node (the test).

export const API_VERSION = '2026-10';
export const MAX_PAGES = 40;           // 40 pages x 100 = 4,000 transactions per run at most
export const PAGE_SIZE = 100;

export const PAYOUTS_QUERY = `query Payouts($first: Int!, $after: String, $query: String) {
  shopifyPaymentsAccount {
    payouts(first: $first, after: $after, query: $query) {
      nodes { id issuedAt status net { amount currencyCode } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;
export const TRANSACTIONS_QUERY = `query BalanceTransactions($first: Int!, $after: String, $query: String) {
  shopifyPaymentsAccount {
    balanceTransactions(first: $first, after: $after, query: $query) {
      nodes { id type test transactionDate amount { amount currencyCode } fee { amount } net { amount } associatedPayout { id } associatedOrder { id name } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

// "41.9" -> 41.90 as a fixed two-decimal string; anything else -> null.
export function money(v) {
  const s = v == null ? '' : String(v).trim();
  if (!/^-?\d{1,10}(\.\d{1,4})?$/.test(s)) return null;
  const n = Number(s);
  const c = Math.round(n * 100);
  if (Math.abs(n * 100 - c) > 1e-6) return null;          // fractions of a cent are not real money
  return (c < 0 ? '-' : '') + (Math.abs(c) / 100).toFixed(2);
}
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const cur = (v) => (typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? v : null);

export function mapPayout(n) {
  if (!isObj(n) || typeof n.id !== 'string' || !n.id) return { error: 'a payout without an id' };
  const net = money(n.net && n.net.amount), currency = cur(n.net && n.net.currencyCode);
  if (net == null || !currency) return { error: 'payout ' + n.id + ' has no readable amount' };
  if (typeof n.issuedAt !== 'string' || isNaN(Date.parse(n.issuedAt))) return { error: 'payout ' + n.id + ' has no readable date' };
  return { row: { id: n.id, issued_at: n.issuedAt, status: String(n.status || 'UNKNOWN').slice(0, 40), net, currency } };
}
export function mapTransaction(n) {
  if (!isObj(n) || typeof n.id !== 'string' || !n.id) return { error: 'a transaction without an id' };
  const amount = money(n.amount && n.amount.amount), fee = money(n.fee && n.fee.amount), net = money(n.net && n.net.amount);
  const currency = cur(n.amount && n.amount.currencyCode);
  if (amount == null || fee == null || net == null || !currency) return { error: 'transaction ' + n.id + ' has no readable amount' };
  if (Math.round(Number(amount) * 100) - Math.round(Number(fee) * 100) !== Math.round(Number(net) * 100)) return { error: 'transaction ' + n.id + ': net is not amount minus fee' };
  const order = isObj(n.associatedOrder) ? (n.associatedOrder.name || n.associatedOrder.id || null) : null;
  return { row: { id: n.id, payout_id: isObj(n.associatedPayout) && n.associatedPayout.id ? n.associatedPayout.id : null,
    type: String(n.type || 'UNKNOWN').slice(0, 40), amount, fee, net, currency,
    order_ref: order == null ? null : String(order).slice(0, 120),
    occurred_at: typeof n.transactionDate === 'string' && !isNaN(Date.parse(n.transactionDate)) ? n.transactionDate : null,
    test: n.test === true } };
}

// One GraphQL call with retries for Shopify's rate limit (HTTP 429 or a
// THROTTLED error): wait and try again, at most 4 times.
async function ask(fetchJson, sleep, query, variables) {
  if (/^\s*mutation\b/i.test(query) || /\bmutation\s*[({]/i.test(query)) throw new Error('refused: the sync only reads');
  for (let attempt = 0; ; attempt++) {
    const r = await fetchJson({ query, variables });
    const throttled = r.status === 429 || (Array.isArray(r.body && r.body.errors) && r.body.errors.some(e => e && e.extensions && e.extensions.code === 'THROTTLED'));
    if (throttled && attempt < 4) { await sleep(1000 * Math.pow(2, attempt)); continue; }
    if (r.status === 401 || r.status === 403) throw new Error('Shopify refused the access key (' + r.status + '). Check that the app has the read-only payout scopes.');
    if (r.status !== 200) throw new Error('Shopify answered ' + r.status + '.');
    if (Array.isArray(r.body && r.body.errors) && r.body.errors.length) throw new Error('Shopify reported: ' + String(r.body.errors[0] && r.body.errors[0].message || 'an error').slice(0, 200));
    const acct = r.body && r.body.data && r.body.data.shopifyPaymentsAccount;
    if (acct === null) throw new Error('This store has no Shopify Payments account, or the key cannot see it.');
    return acct;
  }
}
async function pages(fetchJson, sleep, query, field, filter) {
  const out = [];
  let after = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const acct = await ask(fetchJson, sleep, query, { first: PAGE_SIZE, after, query: filter });
    const conn = acct && acct[field];
    if (!isObj(conn) || !Array.isArray(conn.nodes)) throw new Error('Shopify answered in an unexpected shape.');
    out.push(...conn.nodes);
    if (!(conn.pageInfo && conn.pageInfo.hasNextPage && conn.pageInfo.endCursor)) return { nodes: out, complete: true };
    after = conn.pageInfo.endCursor;
  }
  return { nodes: out, complete: false };
}

// opts: { fetchJson, db: { upsert(table, rows), rpc(name) }, sleep, now, sinceDays }
export async function runSync(opts) {
  const o = opts || {};
  const now = o.now ? new Date(o.now) : new Date();
  const days = Number.isInteger(o.sinceDays) && o.sinceDays > 0 && o.sinceDays <= 120 ? o.sinceDays : 35;
  const since = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const sleep = o.sleep || ((ms) => new Promise(r => setTimeout(r, ms)));
  const problems = [];
  // Shopify's search fields: payouts by issued_at, balance transactions by processed_at
  const P = await pages(o.fetchJson, sleep, PAYOUTS_QUERY, 'payouts', 'issued_at:>=' + since);
  const T = await pages(o.fetchJson, sleep, TRANSACTIONS_QUERY, 'balanceTransactions', 'processed_at:>=' + since);
  const payouts = [], txs = [];
  P.nodes.forEach(n => { const m = mapPayout(n); if (m.error) problems.push(m.error); else payouts.push(m.row); });
  T.nodes.forEach(n => { const m = mapTransaction(n); if (m.error) problems.push(m.error); else txs.push(m.row); });
  if (!P.complete || !T.complete) problems.push('more than ' + (MAX_PAGES * PAGE_SIZE) + ' records since ' + since + '; the rest is fetched on the next run');
  if (payouts.length) await o.db.upsert('shopify_payouts', payouts);
  if (txs.length) await o.db.upsert('shopify_balance_transactions', txs);
  const added = await o.db.rpc('check_shopify_payouts');
  return { ok: true, since, payouts: payouts.length, transactions: txs.length, newDifferences: Number(added) || 0, problems: problems.slice(0, 20) };
}
