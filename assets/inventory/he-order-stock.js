// Stock per order (Nov 28; database step drafts/76, NOT installed): an order takes its
// bottles off the stock count exactly once, and gives them back once when it is
// cancelled. The rules live in the database (take_order_stock / give_back_order_stock:
// all or nothing, lines matched to products by SKU, owner or active administrator only);
// this module only asks, reads, and puts the answers into plain words.
//
//   createStore({ client, enabled })
//     findOrder(text)   one order by its number (exactly one, not deleted)
//     forOrder(id)      its lines, and what each line has taken / given back
//     take(id)          take_order_stock(id)
//     giveBack(id)      give_back_order_stock(id)
//   summarize(lines, moves)  per line: taken, given back; and the order's state:
//     'none' | 'taken' | 'given_back' | 'partly' (some lines taken, some not)
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
        const res = await client.from('orders').select('id, order_number, customer_name, placed_at, status, channel').in('order_number', wanted).is('deleted_at', null).limit(5);
        if (res && res.error) return refuse(friendlyError(res.error));
        const rows = (Array.isArray(res && res.data) ? res.data : []).filter(isObj);
        if (!rows.length) return refuse('No order has that number.');
        if (rows.length > 1) return refuse('More than one order has that number. Type it exactly as the order shows it.');
        return { ok: true, order: rows[0] };
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
    return { findOrder, forOrder, take: (id) => call('take_order_stock', id), giveBack: (id) => call('give_back_order_stock', id) };
  }

  return { friendlyError, summarize, createStore, MAX_LINES };
}));
