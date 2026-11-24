// Batch on each order — the dashboard side of docs/ops/sql/drafts/54 (owner, Nov
// 24: the batch is on a printed sticker; scanning it when packing keeps which
// batch went into which order, so a batch problem gives one list of orders).
//
//   lotFrom(text)                 -> { ok, lot, reason }     a scanned sticker ("B-LOT") or a typed number
//   lotsFromBarcodes(values)      -> the batches on a photo (only our own stickers count)
//   orderNumbers(text)            -> the ways an order number may be written ("1001", "#1001")
//   word(matched)                 -> the plain sentence for the database's answer
//   recallList(rows, orders)      -> { lines, orders, bottles }   who got a batch
//   createStore({ client, enabled }) -> record(), voidRow(), forOrder(), forBatch()
//
// Pure apart from the database client it is GIVEN (supabase-js shaped).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.scan = root.HE.scan || {})['he-order-batches'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PREFIX = 'B-';          // the same prefix the stickers carry (he-batch-labels.js)
  const MAX_LOT = 24;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const str = (v) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : ''));
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  function lotFrom(text) {
    let t = str(text).trim().slice(0, 200);
    if (t.slice(0, PREFIX.length) === PREFIX && t.length > PREFIX.length) t = t.slice(PREFIX.length).trim();
    if (!t) return { ok: false, lot: '', reason: 'Scan the batch sticker or type the batch number.' };
    if (t.length > MAX_LOT || !/^[\x20-\x7e]+$/.test(t)) return { ok: false, lot: '', reason: 'That is not a batch number (1 to ' + MAX_LOT + ' plain characters).' };
    return { ok: true, lot: t, reason: '' };
  }

  // what the phone read from a photo -> the batches on it: only our own stickers
  // ("B-" + number) count, so a product barcode or a tracking number in the same
  // photo is never taken for a batch; each batch once, at most 20
  function lotsFromBarcodes(values) {
    const out = [], seen = Object.create(null);
    (Array.isArray(values) ? values : []).slice(0, 200).forEach(v => {
      const t = str(v).trim();
      if (t.slice(0, PREFIX.length) !== PREFIX || t.length <= PREFIX.length) return;
      const lot = lotFrom(t);
      if (!lot.ok) return;
      const key = lot.lot.toLowerCase();
      if (seen[key] || out.length >= 20) return;
      seen[key] = true; out.push(lot.lot);
    });
    return out;
  }

  function orderNumbers(text) {
    const t = str(text).trim().slice(0, 60);
    if (!t) return [];
    const bare = t.replace(/^#+/, '').trim();
    if (!bare) return [];
    return [...new Set([t, bare, '#' + bare])];
  }

  const WORDS = {
    one: 'It matches a batch in stock.',
    none: 'Saved, but no batch in stock has this number. Check the sticker.',
    several: 'Saved. Two products in stock share this batch number, so it is not linked to either.',
    unchecked: 'Saved. This account cannot check batch numbers against stock.',
  };
  const word = (matched) => WORDS[str(matched)] || 'Saved.';

  // who got a batch: one line per order, newest first; voided rows never count
  function recallList(rows, orders) {
    const byId = Object.create(null);
    (Array.isArray(orders) ? orders : []).forEach(o => { if (isObj(o) && o.id != null) byId[o.id] = o; });
    const per = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (!isObj(r) || r.voided_at || r.order_id == null) return;
      const q = Number(r.quantity);
      if (!Number.isInteger(q) || q < 1) return;
      const line = per[r.order_id] || (per[r.order_id] = { order_id: r.order_id, quantity: 0, recorded_at: '' });
      line.quantity += q;
      if (str(r.recorded_at) > line.recorded_at) line.recorded_at = str(r.recorded_at);
    });
    const lines = Object.keys(per).map(id => {
      const o = byId[id] || {};
      return { order_id: per[id].order_id, order_number: str(o.order_number) || '(order not readable)', customer_name: str(o.customer_name), placed_at: str(o.placed_at),
        status: str(o.status), quantity: per[id].quantity, recorded_at: per[id].recorded_at };
    }).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || a.order_number.localeCompare(b.order_number));
    return { lines: lines, orders: lines.length, bottles: lines.reduce((t, l) => t + l.quantity, 0) };
  }

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg) && code !== 'P0002') {
      return 'Batches on orders are not installed in the database yet (drafts/54 needs the owner\'s approval).';
    }
    if (code === 'P0002') return /order/i.test(msg) ? 'That order does not exist (or was deleted).' : 'That row does not exist.';
    if (code === '42501') return /^(Only|A |The )/.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === '22023') return msg || 'The database refused the value. Nothing was changed.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Nothing was changed; try again.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '. Nothing was changed.';
  }

  function createStore(deps) {
    const d = deps || {};
    const client = d.client;
    const enabled = d.enabled !== false;
    const inFlight = new Set();
    const refuse = (message, extra) => Object.assign({ ok: false, message: message }, extra || {});
    function ready(needs) {
      if (!enabled) return refuse('Batches on orders are off.', { off: true });
      if (!client || typeof client[needs] !== 'function') return refuse('No database connection was given.');
      return null;
    }
    async function once(key, fn) {
      if (inFlight.has(key)) return refuse('That request is already being sent. Wait for it to finish.', { busy: true });
      inFlight.add(key);
      try { return await fn(); } catch (e) { return refuse(friendlyError(e), { error: true }); } finally { inFlight.delete(key); }
    }
    async function record(orderId, lotText, quantity, source) {
      const r = ready('rpc'); if (r) return r;
      if (!UUID.test(str(orderId))) return refuse('Choose the order first.');
      const lot = lotFrom(lotText); if (!lot.ok) return refuse(lot.reason);
      const n = typeof quantity === 'number' ? quantity : Number(str(quantity).trim() || '1');
      if (!Number.isInteger(n) || n < 1 || n > 10000) return refuse('Type how many bottles (a whole number, 1 or more).');
      return once('record:' + orderId + ':' + lot.lot.toLowerCase(), async function () {
        const res = await client.rpc('record_order_batch', { p_order_id: orderId, p_lot_number: lot.lot, p_quantity: n, p_source: source === 'typed' ? 'typed' : 'scan' });
        if (res && res.error) return refuse(friendlyError(res.error));
        const out = (res && isObj(res.data)) ? res.data : {};
        return { ok: true, id: out.id || null, lot: str(out.lot_number) || lot.lot, quantity: Number(out.quantity) || n, matched: str(out.matched), message: word(out.matched) };
      });
    }
    async function voidRow(id, reason) {
      const r = ready('rpc'); if (r) return r;
      if (!UUID.test(str(id))) return refuse('Choose the row to void.');
      const why = str(reason).trim();
      if (why.length < 3 || why.length > 300) return refuse('Say why in a few words (3 to 300 characters).');
      return once('void:' + id, async function () {
        const res = await client.rpc('void_order_batch', { p_id: id, p_reason: why });
        if (res && res.error) return refuse(friendlyError(res.error));
        return { ok: true, already: !!(res && isObj(res.data) && res.data.already) };
      });
    }
    async function forOrder(orderId) {
      const r = ready('from'); if (r) return r;
      if (!UUID.test(str(orderId))) return refuse('Choose the order first.');
      return once('forOrder:' + orderId, async function () {
        const res = await client.from('order_batches').select('id, order_id, lot_number, quantity, recorded_at, voided_at, void_reason').eq('order_id', orderId).order('recorded_at', { ascending: false }).limit(200);
        if (res && res.error) return refuse(friendlyError(res.error));
        return { ok: true, rows: (Array.isArray(res && res.data) ? res.data : []).filter(isObj) };
      });
    }
    // every live row of a batch (by the number that was scanned, whatever the capitals) with its orders
    async function forBatch(lotText) {
      const r = ready('from'); if (r) return r;
      const lot = lotFrom(lotText); if (!lot.ok) return refuse(lot.reason);
      return once('forBatch:' + lot.lot.toLowerCase(), async function () {
        const res = await client.from('order_batches').select('id, order_id, lot_number, quantity, recorded_at, voided_at').ilike('lot_number', lot.lot.replace(/[\\%_]/g, '\\$&')).is('voided_at', null).order('recorded_at', { ascending: false }).limit(1000);
        if (res && res.error) return refuse(friendlyError(res.error));
        const rows = (Array.isArray(res && res.data) ? res.data : []).filter(isObj);
        const ids = [...new Set(rows.map(x => x.order_id).filter(x => UUID.test(str(x))))].slice(0, 1000);
        let orders = [];
        if (ids.length) {
          const o = await client.from('orders').select('id, order_number, customer_name, placed_at, status').in('id', ids).limit(1000);
          if (o && o.error) return refuse(friendlyError(o.error));
          orders = Array.isArray(o && o.data) ? o.data : [];
        }
        return Object.assign({ ok: true, lot: lot.lot, truncated: rows.length === 1000 }, recallList(rows, orders));
      });
    }
    return { enabled: enabled, record: record, voidRow: voidRow, forOrder: forOrder, forBatch: forBatch };
  }

  return { PREFIX, MAX_LOT, lotFrom, lotsFromBarcodes, orderNumbers, word, recallList, friendlyError, createStore };
}));
