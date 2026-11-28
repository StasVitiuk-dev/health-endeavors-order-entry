// Stock per order (Nov 28; database step drafts/76, NOT installed): an order takes its
// bottles off the stock count exactly once, and gives them back once when it is
// cancelled. The rules live in the database (take_order_stock / give_back_order_stock:
// all or nothing, lines matched to products by SKU, owner or active administrator only);
// this module only asks, reads, and puts the answers into plain words.
//
//   createStore({ client, enabled })
//     findOrder(text)   one order by its number (exactly one; a deleted one only if no live
//                       order has it, marked deleted: it may give back, never take)
//     forOrder(id)      its lines, and what each line has taken / given back
//     take(id)          take_order_stock(id)
//     giveBack(id)      give_back_order_stock(id)
//   summarize(lines, moves)  per line: taken, given back; and the order's state:
//     'none' | 'taken' | 'given_back' | 'partly' (some lines taken, some not)
//   waiting(orders, moves)   the recent orders that have not taken their stock yet (Nov 28), leaving out
//     cancelled, fully refunded, voided and expired ones, newest first
//     store.waiting(days)    the same, read from the database (orders of the last `days` days, the newest 50;
//                            `more` says when there may be older ones it did not check)
//
// A second press while one is on its way is refused here ("already being sent"); the
// database refuses a second take anyway. Dual-mode (Node require + HE.inventory).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.inventory = root.HE.inventory || {})['he-order-stock'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const str = (v) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : ''));
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const MAX_LINES = 200;
  const WAITING_MAX = 50;   // orders read for the waiting list

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 400) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || code === '42883' || (/does not exist|could not find the (table|function)/i.test(msg) && code !== 'P0002')) {
      return 'Stock per order is not installed in the database yet (drafts/76 needs the owner\'s approval). Nothing was changed.';
    }
    // the database's own sentences already say what happened and that nothing changed
    if (code === 'P0002' || code === '22023' || code === '23514') return msg || 'The database refused. Nothing was changed.';
    if (code === '42501') return /^Only /.test(msg) ? msg + ' Nothing was changed.' : 'You do not have permission to do that. Nothing was changed.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database, so it is not known whether the stock changed. Look at the order again before pressing a second time.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '. Nothing was changed.';
  }

  function summarize(lines, moves) {
    const ls = (Array.isArray(lines) ? lines : []).filter(isObj).filter(l => Number(l.quantity) > 0);
    const ms = (Array.isArray(moves) ? moves : []).filter(isObj);
    const took = new Set(ms.filter(m => m.kind === 'take').map(m => str(m.order_item_id)));
    const back = new Set(ms.filter(m => m.kind === 'give_back').map(m => str(m.order_item_id)));
    const rows = ls.map(l => ({ id: str(l.id), sku: str(l.sku), name: str(l.product_name), quantity: Number(l.quantity),
      taken: took.has(str(l.id)), givenBack: back.has(str(l.id)) }));
    const nTaken = rows.filter(r => r.taken).length, nBack = rows.filter(r => r.givenBack).length;
    const state = !rows.length || !nTaken ? 'none' : nBack === nTaken && nTaken === rows.length ? 'given_back' : nTaken === rows.length && !nBack ? 'taken' : 'partly';
    const bottles = rows.reduce((t, r) => t + (Number.isFinite(r.quantity) ? r.quantity : 0), 0);
    return { rows, state, bottles, canTake: rows.length > 0 && rows.some(r => !r.taken), canGiveBack: rows.some(r => r.taken && !r.givenBack) };
  }

  // cancelled, fully refunded, or a payment Shopify voided or let expire (no money taken, nothing ships)
  const notForSale = (status) => { const s = str(status).toLowerCase(); return s.includes('cancel') || (s.includes('refund') && !s.includes('partial')) || s.includes('void') || s.includes('expired'); };
  function waiting(orders, moves) {
    const took = new Set((Array.isArray(moves) ? moves : []).filter(isObj).filter(m => m.kind === 'take').map(m => str(m.order_id)));
    return (Array.isArray(orders) ? orders : []).filter(isObj)
      .filter(o => UUID.test(str(o.id)) && str(o.order_number) && !o.deleted_at && !notForSale(o.status) && !took.has(str(o.id)))
      .sort((a, b) => str(b.placed_at).localeCompare(str(a.placed_at)));
  }

  function createStore(deps) {
    const d = deps || {};
    const client = d.client;
    const enabled = d.enabled !== false;
    const inFlight = new Set();
    const refuse = (message, extra) => Object.assign({ ok: false, message: message }, extra || {});
    function ready(needs) {
      if (!enabled) return refuse('Stock per order is off.', { off: true });
      if (!client || typeof client[needs] !== 'function') return refuse('No database connection was given.');
      return null;
    }
    async function once(key, fn) {
      if (inFlight.has(key)) return refuse('That request is already being sent. Wait for it to finish.', { busy: true });
      inFlight.add(key);
      try { return await fn(); } catch (e) { return refuse(friendlyError(e), { error: true }); } finally { inFlight.delete(key); }
    }
    async function findOrder(text) {
      const r = ready('from'); if (r) return r;
      const n = str(text).trim().slice(0, 60);
      if (!n) return refuse('Type the order number first.');
      const wanted = n.startsWith('#') ? [n, n.slice(1)] : [n, '#' + n];
      return once('find:' + n.toLowerCase(), async function () {
        const res = await client.from('orders').select('id, order_number, customer_name, placed_at, status, channel, deleted_at').in('order_number', wanted).limit(5);
        if (res && res.error) return refuse(friendlyError(res.error));
        const all = (Array.isArray(res && res.data) ? res.data : []).filter(isObj);
        const live = all.filter(o => o.deleted_at == null);
        // a deleted order is found only when no live order has the number: it can give back, never take
        const rows = live.length ? live : all;
        if (!rows.length) return refuse('No order has that number.');
        if (rows.length > 1) return refuse('More than one order has that number. Type it exactly as the order shows it.');
        return { ok: true, order: Object.assign({}, rows[0], { deleted: !live.length }) };
      });
    }
    async function forOrder(orderId) {
      const r = ready('from'); if (r) return r;
      if (!UUID.test(str(orderId))) return refuse('Choose the order first.');
      return once('forOrder:' + orderId, async function () {
        const li = await client.from('order_items').select('id, sku, product_name, quantity').eq('order_id', orderId).order('id', { ascending: true }).limit(MAX_LINES);
        if (li && li.error) return refuse(friendlyError(li.error));
        const mv = await client.from('order_stock_moves').select('order_item_id, kind, quantity, moved_at').eq('order_id', orderId).limit(MAX_LINES * 2);
        if (mv && mv.error) return refuse(friendlyError(mv.error));
        return Object.assign({ ok: true }, summarize(li && li.data, mv && mv.data));
      });
    }
    async function call(fn, orderId) {
      const r = ready('rpc'); if (r) return r;
      if (!UUID.test(str(orderId))) return refuse('Choose the order first.');
      return once(fn + ':' + orderId, async function () {
        const res = await client.rpc(fn, { p_order_id: orderId });
        if (res && res.error) return refuse(friendlyError(res.error));
        const out = isObj(res && res.data) ? res.data : {};
        return { ok: true, changed: Number(out.lines_changed) || 0, already: Number(out.lines_already_done) || 0, order: str(out.order) };
      });
    }
    async function recentWaiting(days) {
      const r = ready('from'); if (r) return r;
      const d = Number.isInteger(days) && days > 0 && days <= 60 ? days : 14;
      const since = new Date(Date.now() - d * 86400000).toISOString();
      return once('waiting', async function () {
        const o = await client.from('orders').select('id, order_number, status, placed_at, deleted_at').gte('placed_at', since).is('deleted_at', null).order('placed_at', { ascending: false }).limit(WAITING_MAX);
        if (o && o.error) return refuse(friendlyError(o.error));
        const rows = (Array.isArray(o && o.data) ? o.data : []).filter(isObj);
        const ids = rows.map(x => str(x.id)).filter(x => UUID.test(x));
        if (!ids.length) return { ok: true, orders: [] };
        const m = await client.from('order_stock_moves').select('order_id, kind').in('order_id', ids).eq('kind', 'take').limit(MAX_LINES * 4);
        if (m && m.error) return refuse(friendlyError(m.error));
        // more: the newest WAITING_MAX orders were read, so older ones of the period were not checked here
        return { ok: true, orders: waiting(rows, m && m.data), more: rows.length >= WAITING_MAX };
      });
    }
    return { findOrder, forOrder, waiting: recentWaiting, take: (id) => call('take_order_stock', id), giveBack: (id) => call('give_back_order_stock', id) };
  }

  return { friendlyError, summarize, waiting, createStore, MAX_LINES };
}));
