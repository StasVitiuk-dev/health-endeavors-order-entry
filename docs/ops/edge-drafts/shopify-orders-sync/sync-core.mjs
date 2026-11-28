// DRAFT (2026-11-28). NOT DEPLOYED. Only for R9 path B (docs/ops/R9_SHOPIFY_ORDERS_DESIGN.md): if the
// owner keeps today's order import (path A), this program is never used. The core of the Shopify order
// sync; runs inside a Supabase Edge Function (index.ts) once the owner approves drafts/78 and this
// program; tested locally with made-up Shopify replies (docs/ops/sql/local-test/shopify_orders_test.mjs).
//
// What it does, and nothing else:
//   1 asks Shopify (GraphQL Admin API, READ-ONLY queries) for the orders created or changed recently,
//     with their lines (id, SKU, name, quantity, price) and totals; NO customer details are asked for
//   2 hands each order to save_shopify_order() (drafts/78), which writes it once: the order by
//     Shopify's order id, each line by Shopify's line id; running twice changes nothing
// It never sends a mutation, never changes stock (that is the stock-per-order step, drafts/76) and
// never logs the access key. Access scope needed: read_orders, nothing else.
// It obeys the dashboard's own "Shopify Order Sync" switch (feature_flags.shopify_order_sync): while that
// is off, or missing, or cannot be read, it asks Shopify nothing and writes nothing. System mode
// "Emergency" turns that switch off, so Emergency stops this program too.
//
// Pure apart from what it is given: fetchJson (to Shopify), db.rpc (to Supabase), sleep and now.
// Works in Deno (the Edge Function) and in Node (the test).

export const API_VERSION = '2026-10';
export const MAX_PAGES = 20;          // 20 pages x 50 = 1,000 orders per run at most
export const PAGE_SIZE = 50;
export const MAX_LINES = 100;         // lines asked per order; an order with more is reported, not half-saved

export const ORDERS_QUERY = `query Orders($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT) {
    nodes {
      id name createdAt cancelledAt test displayFinancialStatus currencyCode
      subtotalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      lineItems(first: ${MAX_LINES}) {
        nodes { id sku name quantity originalUnitPriceSet { shopMoney { amount } } }
        pageInfo { hasNextPage }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

// "41.9" -> "41.90"; anything else -> null. Fractions of a cent are not real money.
export function money(v) {
  const s = v == null ? '' : String(v).trim();
  if (!/^-?\d{1,10}(\.\d{1,4})?$/.test(s)) return null;
  const n = Number(s);
  const c = Math.round(n * 100);
  if (Math.abs(n * 100 - c) > 1e-6) return null;
  return (c < 0 ? '-' : '') + (Math.abs(c) / 100).toFixed(2);
}
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const amt = (set) => money(isObj(set) && isObj(set.shopMoney) ? set.shopMoney.amount : null);
const ORDER_ID = /^gid:\/\/shopify\/Order\/\d{1,20}$/;
const LINE_ID = /^gid:\/\/shopify\/LineItem\/\d{1,20}$/;

// Shopify's financial status in the dashboard's words; a cancelled order says "cancelled" whatever was paid.
export function statusOf(n) {
  if (typeof n.cancelledAt === 'string' && n.cancelledAt) return 'cancelled';
  const s = String(n.displayFinancialStatus || 'pending').toLowerCase();
  return /^[a-z_]{1,30}$/.test(s) ? s : 'pending';
}

// One Shopify order -> { row } for save_shopify_order(), or { error } naming what is wrong (nothing is saved).
export function mapOrder(n) {
  if (!isObj(n) || typeof n.id !== 'string' || !ORDER_ID.test(n.id)) return { error: 'an order without a readable id' };
  const label = typeof n.name === 'string' && n.name ? n.name.slice(0, 40) : n.id;
  const totals = { subtotal: amt(n.subtotalPriceSet), shipping_total: amt(n.totalShippingPriceSet), tax_total: amt(n.totalTaxSet), total: amt(n.totalPriceSet) };
  if (Object.values(totals).some(v => v == null)) return { error: 'order ' + label + ' has an unreadable amount' };
  if (typeof n.createdAt !== 'string' || isNaN(Date.parse(n.createdAt))) return { error: 'order ' + label + ' has no readable date' };
  if (typeof n.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(n.currencyCode)) return { error: 'order ' + label + ' has no readable currency' };
  const li = n.lineItems;
  if (!isObj(li) || !Array.isArray(li.nodes)) return { error: 'order ' + label + ' has no readable lines' };
  if (li.pageInfo && li.pageInfo.hasNextPage) return { error: 'order ' + label + ' has more than ' + MAX_LINES + ' lines; not saved, look at it in Shopify' };
  const lines = [];
  for (const l of li.nodes) {
    if (!isObj(l) || typeof l.id !== 'string' || !LINE_ID.test(l.id)) return { error: 'order ' + label + ' has a line without a readable id' };
    const q = l.quantity;
    const unit = amt(l.originalUnitPriceSet);
    if (!Number.isInteger(q) || q < 0 || q > 100000 || unit == null) return { error: 'order ' + label + ' has a line with an unreadable quantity or price' };
    lines.push({ external_line_id: l.id, sku: typeof l.sku === 'string' ? l.sku.trim().slice(0, 80) : null,
      product_name: typeof l.name === 'string' ? l.name.slice(0, 200) : null, quantity: q, unit_price: unit,
      line_total: money((Math.round(Number(unit) * 100) * q) / 100) });
  }
  return { row: Object.assign({ external_order_id: n.id, order_number: label, placed_at: n.createdAt, status: statusOf(n),
    currency: n.currencyCode, lines }, totals), test: n.test === true };
}

// One GraphQL call, with retries for Shopify's rate limit (HTTP 429 or THROTTLED): wait, at most 4 times.
async function ask(fetchJson, sleep, query, variables) {
  if (/^\s*mutation\b/i.test(query) || /\bmutation\s*[({]/i.test(query)) throw new Error('refused: the sync only reads');
  for (let attempt = 0; ; attempt++) {
    const r = await fetchJson({ query, variables });
    const throttled = r.status === 429 || (Array.isArray(r.body && r.body.errors) && r.body.errors.some(e => e && e.extensions && e.extensions.code === 'THROTTLED'));
    if (throttled && attempt < 4) { await sleep(1000 * Math.pow(2, attempt)); continue; }
    if (r.status === 401 || r.status === 403) throw new Error('Shopify refused the access key (' + r.status + '). Check that the app has the read_orders scope.');
    if (r.status !== 200) throw new Error('Shopify answered ' + r.status + '.');
    if (Array.isArray(r.body && r.body.errors) && r.body.errors.length) throw new Error('Shopify reported: ' + String(r.body.errors[0] && r.body.errors[0].message || 'an error').slice(0, 200));
    const conn = r.body && r.body.data && r.body.data.orders;
    if (!isObj(conn) || !Array.isArray(conn.nodes)) throw new Error('Shopify answered in an unexpected shape.');
    return conn;
  }
}

// opts: { fetchJson, db: { rpc(name, args), syncSwitchOn() }, sleep, now, sinceDays }
export async function runSync(opts) {
  const o = opts || {};
  let on = false;
  try { on = (await o.db.syncSwitchOn()) === true; } catch (e) { on = false; }
  if (!on) return { ok: true, skipped: 'The Shopify Order Sync switch is off (or could not be read): nothing was asked or written.' };
  const now = o.now ? new Date(o.now) : new Date();
  const days = Number.isInteger(o.sinceDays) && o.sinceDays > 0 && o.sinceDays <= 60 ? o.sinceDays : 3;
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const sleep = o.sleep || ((ms) => new Promise(r => setTimeout(r, ms)));
  const problems = [];
  const out = { ok: true, since, orders_seen: 0, created: 0, lines_added: 0, lines_changed: 0, held: [], test_orders: 0, skipped_deleted: 0, refused: 0, problems };
  let after = null, complete = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const conn = await ask(o.fetchJson, sleep, ORDERS_QUERY, { first: PAGE_SIZE, after, query: 'updated_at:>=' + since });
    for (const n of conn.nodes) {
      out.orders_seen++;
      const m = mapOrder(n);
      if (m.error) { problems.push(m.error); out.refused++; continue; }
      if (m.test) out.test_orders++;
      let res;
      try { res = await o.db.rpc('save_shopify_order', { p_order: m.row }); }
      catch (e) { problems.push('order ' + m.row.order_number + ' was not saved: ' + String(e && e.message || e).slice(0, 200)); out.refused++; continue; }
      if (res && res.skipped === 'deleted_on_the_dashboard') { out.skipped_deleted++; continue; }
      if (res && res.created) out.created++;
      out.lines_added += Number(res && res.lines_added) || 0;
      out.lines_changed += Number(res && res.lines_changed) || 0;
      if (res && Array.isArray(res.lines_held) && res.lines_held.length) out.held.push(m.row.order_number + ': ' + res.lines_held.join(', '));
    }
    if (!(conn.pageInfo && conn.pageInfo.hasNextPage && conn.pageInfo.endCursor)) { complete = true; break; }
    after = conn.pageInfo.endCursor;
  }
  if (!complete) problems.push('more than ' + (MAX_PAGES * PAGE_SIZE) + ' orders changed since ' + since + '; the rest comes on the next run');
  if (out.held.length) problems.push('Shopify changed ' + out.held.length + ' order line(s) whose stock was already taken; they were left as they were (look at them on Orders)');
  out.problems = problems.slice(0, 20);
  return out;
}
