// The real fee and postage of each order — the dashboard side of
// docs/ops/sql/drafts/52 (owner, Nov 23: exact figures instead of estimates).
//   feesByOrder(parsed)        a channel money report (he-channel-money) -> the
//                              real fee per order number, in cents
//   rowsFor(parsed, orders)    those fees matched to the dashboard's orders by
//                              order number -> rows for set_order_costs
//   createStore().list(ids)    the saved costs of these orders
//   createStore().save(rows)   set_order_costs (owner and administrators; the
//                              database checks again on its own)
// Behind the he_order_costs switch (it reads and writes real records once
// drafts/52 is installed). Money figures only; no customer details.
//
// Pure apart from the database client it is GIVEN (supabase-js shaped).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-order-costs-store'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TABLE = 'order_costs', RPC = 'set_order_costs', MAX_SAVE = 500, CHUNK = 150;
  const FEE_SOURCES = ['shopify', 'amazon', 'etsy', 'tiktok', 'manual'];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ref = (v) => String(v == null ? '' : v).trim().replace(/^#/, '').toLowerCase().slice(0, 60);

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Real order costs are not installed in the database yet (drafts/52 needs the owner\'s approval).';
    }
    if (code === '42501') return /^Only /.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === '22023') return msg || 'The database refused the request.';
    if (code === '23514') return 'The database refused a figure that is out of range.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Nothing was changed; try again.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '.';
  }

  // the real fee per order number in a channel report: what the channel charged on
  // that order's lines (a refund's fee reversal reduces it); never below zero
  function feesByOrder(parsed) {
    const out = {};
    const rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
    rows.forEach(r => {
      if (!r || typeof r !== 'object' || !r.order) return;
      if (r.kind !== 'sale' && r.kind !== 'fee' && r.kind !== 'refund') return;
      if (!Number.isInteger(r.fees) || r.fees === 0) return;
      const k = ref(r.order); if (!k) return;
      out[k] = (out[k] || 0) - r.fees;                       // fees are negative amounts in the report
    });
    Object.keys(out).forEach(k => { if (!(out[k] > 0)) delete out[k]; });
    return out;
  }

  // orders: [{ id, order_number }] -> { rows, matched, unmatched: [order numbers not in the dashboard] }
  function rowsFor(parsed, orders) {
    const fees = feesByOrder(parsed);
    const source = parsed && FEE_SOURCES.indexOf(parsed.channel) >= 0 ? parsed.channel : 'manual';
    const byNumber = {};
    (Array.isArray(orders) ? orders : []).forEach(o => { if (o && UUID.test(String(o.id || '')) && ref(o.order_number)) byNumber[ref(o.order_number)] = o.id; });
    const rows = [], unmatched = [];
    Object.keys(fees).forEach(k => {
      if (byNumber[k]) rows.push({ order_id: byNumber[k], fee_cents: fees[k], fee_source: source, postage_cents: null, postage_source: null });
      else unmatched.push(k);
    });
    return { rows: rows.slice(0, MAX_SAVE), matched: Math.min(rows.length, MAX_SAVE), unmatched: unmatched, tooMany: rows.length > MAX_SAVE };
  }

  function createStore(deps) {
    const d = deps || {};
    const client = d.client;
    const usable = !!(client && typeof client.from === 'function' && d.enabled !== false);

    async function list(orderIds) {
      const ids = [...new Set((Array.isArray(orderIds) ? orderIds : []).filter(x => UUID.test(String(x))))];
      if (!usable) return { state: 'off', rows: [], message: '' };
      const rows = [];
      try {
        for (let i = 0; i < ids.length; i += CHUNK) {
          const res = await client.from(TABLE).select('order_id, fee_cents, fee_source, postage_cents, postage_source').in('order_id', ids.slice(i, i + CHUNK)).limit(1000);
          if (res && res.error) return { state: 'error', rows: [], message: friendlyError(res.error) };
          (res && Array.isArray(res.data) ? res.data : []).forEach(r => { if (r && r.order_id) rows.push(r); });
        }
        return { state: 'ok', rows: rows, message: '' };
      } catch (e) { return { state: 'error', rows: [], message: friendlyError(e) }; }
    }

    async function save(rows) {
      if (!usable || typeof client.rpc !== 'function') return { ok: false, message: 'The database is not available here.' };
      const clean = (Array.isArray(rows) ? rows : []).filter(r => r && UUID.test(String(r.order_id || '')) &&
        ((Number.isInteger(r.fee_cents) && r.fee_cents >= 0 && FEE_SOURCES.indexOf(r.fee_source) >= 0) || (Number.isInteger(r.postage_cents) && r.postage_cents >= 0 && !!r.postage_source)));
      if (!clean.length) return { ok: false, message: 'There is nothing to save: no order in the report matches an order in the dashboard.' };
      if (clean.length > MAX_SAVE) return { ok: false, message: 'At most ' + MAX_SAVE + ' orders at a time.' };
      try {
        const res = await client.rpc(RPC, { p_rows: clean });
        if (res && res.error) return { ok: false, message: friendlyError(res.error) };
        const out = res && res.data && typeof res.data === 'object' ? res.data : {};
        return { ok: true, saved: Number(out.saved) || 0, unknown: Number(out.unknown_orders) || 0, message: '' };
      } catch (e) { return { ok: false, message: friendlyError(e) }; }
    }

    return { list: list, save: save };
  }

  return { TABLE, RPC, MAX_SAVE, FEE_SOURCES, feesByOrder, rowsFor, friendlyError, createStore };
}));
