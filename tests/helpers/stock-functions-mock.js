// EXT9: an in-memory copy of the database functions R1–R5
// (docs/ops/sql/drafts/10_DRAFT_stock_functions.sql) for the browser tests.
// It follows the SQL rule by rule: same checks, same order, same error codes
// and hints, same results. Each call works on a copy of the tables and only
// keeps it if the whole call succeeds, like one database transaction.
// The SQL itself is tested on real PostgreSQL by the local-test scripts; this
// file only lets the page's switched-on path be tested end to end.
//
//   installStockFunctions(backend, { ownerOrAdmin: true, failAt: null })
// failAt: 'after_first_stock' throws part-way through R1 (proves nothing is kept).

const BUCKETS = ['available', 'reserved', 'damaged', 'sample', 'wholesale', 'promotional', 'returned', 'recalled'];
const TOUCHED = ['purchase_orders', 'purchase_order_items', 'inventory', 'inventory_lots', 'inventory_adjustments', 'expenses', 'recalls', 'returns', 'products'];

class DbError extends Error {
  constructor(code, message, hint) { super(message); this.code = code; this.hint = hint || null; }
}
const fail = (code, message, hint) => { throw new DbError(code, message, hint); };
let seq = 0;
const newId = p => `${p}-fn-${++seq}`;
const now = () => new Date().toISOString();
const centralDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function installStockFunctions(backend, opts = {}) {
  const o = Object.assign({ ownerOrAdmin: true, failAt: null, uid: 'owner-user' }, opts);
  backend.stockFunctionCalls = [];

  function txn(name, fn) {
    return body => {
      backend.stockFunctionCalls.push({ name, body });
      const saved = {};
      for (const t of TOUCHED) saved[t] = JSON.parse(JSON.stringify(backend.tables[t] || []));
      try {
        return fn(body || {});
      } catch (e) {
        for (const t of TOUCHED) backend.tables[t] = saved[t]; // roll back
        if (e instanceof DbError) return { __error: { status: e.code === '42501' ? 403 : 400, code: e.code, message: e.message, hint: e.hint } };
        return { __error: { status: 500, code: 'XX000', message: String(e && e.message || e) } };
      }
    };
  }
  const T = n => (backend.tables[n] = backend.tables[n] || []);

  function applyStock(productId, bucket, change, reason, lotId, expected) {
    if (!BUCKETS.includes(bucket)) fail('22023', `Unknown stock bucket "${bucket}".`);
    if (change == null || change === 0 || !Number.isInteger(change)) fail('22023', 'A stock change must be a non-zero whole number.');
    if (!o.ownerOrAdmin) fail('42501', 'Only the Owner or an Administrator can change stock.');
    if (!T('products').some(p => p.id === productId)) fail('P0002', 'That product no longer exists.');
    let inv = T('inventory').find(r => r.product_id === productId);
    if (!inv) {
      inv = { id: newId('inv'), product_id: productId };
      for (const b of BUCKETS) inv[b] = 0;
      T('inventory').push(inv);
    }
    const current = Number(inv[bucket] || 0);
    if (expected != null && current !== expected) {
      fail('55000', `${bucket[0].toUpperCase() + bucket.slice(1)} changed since the page loaded: it is now ${current}, not ${expected}. Nothing was changed — reload and try again.`, 'stale_value');
    }
    const next = current + change;
    if (next < 0) fail('23514', `That would leave ${bucket[0].toUpperCase() + bucket.slice(1)} at ${next} — only ${current} in that bucket right now.`, 'below_zero');
    inv[bucket] = next; inv.updated_at = now(); inv.updated_by = o.uid;
    T('inventory_adjustments').push({ id: newId('adj'), product_id: productId, bucket, change_amount: change, reason, adjusted_by: o.uid, lot_id: lotId || null, adjusted_at: now() });
    return next;
  }

  backend.rpc.adjust_inventory = txn('adjust_inventory', b => {
    if (!T('products').some(p => p.id === b.p_product_id)) fail('P0002', 'That product no longer exists.');
    const reason = b.p_reason && String(b.p_reason).trim() ? String(b.p_reason).trim() : null;
    const v = applyStock(b.p_product_id, b.p_bucket, b.p_change, reason, null, b.p_expected == null ? null : b.p_expected);
    return { product_id: b.p_product_id, bucket: b.p_bucket, change: b.p_change, new_value: v };
  });

  backend.rpc.receive_purchase_order = txn('receive_purchase_order', b => {
    const lots = b.p_lots == null ? [] : b.p_lots;
    if (!Array.isArray(lots)) fail('22023', 'Lot details must be a list.');
    if (!o.ownerOrAdmin) fail('42501', 'Only the Owner or an Administrator can receive a delivery.');
    const po = T('purchase_orders').find(p => p.id === b.p_po_id);
    if (!po) fail('P0002', 'That purchase order no longer exists.');
    if (po.deleted_at) fail('55000', `Purchase order ${po.po_number} was deleted, so it can't be received.`);
    if (po.status === 'received') return { already_received: true, po_number: po.po_number };
    if (!['ordered', 'shipped'].includes(po.status)) fail('55000', `Purchase order ${po.po_number} is "${po.status}" — only ordered or shipped orders can be received.`);
    // Lines live in their own table and, in the fixtures, embedded on the order.
    let lines = T('purchase_order_items').filter(l => l.purchase_order_id === po.id);
    const embedded = !lines.length && Array.isArray(po.purchase_order_items);
    if (embedded) lines = po.purchase_order_items;
    if (lines.some(l => l.product_id && (Number(l.quantity) !== Math.trunc(Number(l.quantity)) || Number(l.quantity_received || 0) !== Math.trunc(Number(l.quantity_received || 0))))) {
      fail('22023', `A catalogue line on purchase order ${po.po_number} has a quantity that is not a whole number. Fix the line first — stock is counted in whole units.`, 'non_whole_quantity');
    }
    const itemsValue = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_cost || 0), 0);
    const extras = Number(po.shipping_cost || 0) + Number(po.tax || 0);
    for (const l of lines) {
      if (!(Number(l.quantity) > 0)) continue;
      const lv = Number(l.quantity) * Number(l.unit_cost || 0);
      const share = itemsValue > 0 ? lv / itemsValue * extras : extras / lines.length;
      l.landed_unit_cost = Math.round((lv + share) / Number(l.quantity) * 10000) / 10000;
    }
    let stocked = 0, skipped = 0;
    const ordered = [...lines].sort((a, c) => String(a.product_id || '￿').localeCompare(String(c.product_id || '￿')) || String(a.id).localeCompare(String(c.id)));
    for (const l of ordered) {
      const outstanding = Number(l.quantity) - Number(l.quantity_received || 0);
      if (outstanding <= 0) continue;
      if (!l.product_id) { skipped++; continue; }
      if (!T('products').some(p => p.id === l.product_id)) fail('P0002', `A product on purchase order ${po.po_number} no longer exists.`);
      let lotId = null;
      const entry = lots.find(e => e && String(e.line_id) === String(l.id));
      const lotNumber = entry && entry.lot_number && String(entry.lot_number).trim() ? String(entry.lot_number).trim() : null;
      if (lotNumber) {
        if (lotNumber.length > 100) fail('22001', 'Lot number is too long.');
        let lot = T('inventory_lots').find(x => x.product_id === l.product_id && String(x.lot_number).toLowerCase() === lotNumber.toLowerCase());
        if (lot) { lot.quantity_received = Number(lot.quantity_received) + outstanding; lot.quantity_remaining = Number(lot.quantity_remaining) + outstanding; lot.updated_at = now(); }
        else { lot = { id: newId('lot'), product_id: l.product_id, lot_number: lotNumber, purchase_order_id: po.id, quantity_received: outstanding, quantity_remaining: outstanding, created_by: o.uid, received_at: now() }; T('inventory_lots').push(lot); }
        lotId = lot.id;
      }
      applyStock(l.product_id, 'available', outstanding, `Delivery received (${po.po_number})`, lotId);
      if (o.failAt === 'after_first_stock') throw new Error('injected failure part-way through the receive');
      l.quantity_received = Number(l.quantity);
      stocked++;
    }
    const total = Math.round((itemsValue + extras) * 100) / 100;
    let expenseId = null;
    if (total > 0) {
      const sup = T('suppliers').find(x => x.id === po.supplier_id);
      expenseId = newId('exp');
      T('expenses').push({ id: expenseId, category: po.expense_category, amount: total, expense_date: b.p_expense_date || centralDate(), vendor: sup ? sup.name : null, note: 'Purchase order ' + po.po_number, deleted_at: null, created_at: now() });
    }
    Object.assign(po, { status: 'received', received_at: now(), received_by: o.uid, updated_at: now() });
    return { already_received: false, po_number: po.po_number, stocked, skipped, expense_id: expenseId, expense_total: total };
  });

  backend.rpc.quarantine_recall = txn('quarantine_recall', b => {
    if (!o.ownerOrAdmin) fail('42501', 'Only the Owner or an Administrator can quarantine stock.');
    const rc = T('recalls').find(r => r.id === b.p_recall_id);
    if (!rc) fail('P0002', 'That recall no longer exists.');
    if (rc.status !== 'initiated') return { already_done: true, status: rc.status, quantity_quarantined: rc.quantity_quarantined };
    const lot = T('inventory_lots').find(x => x.id === rc.lot_id);
    if (!lot) fail('P0002', 'The recalled lot no longer exists.');
    if (Number(lot.quantity_remaining) !== Math.trunc(Number(lot.quantity_remaining))) fail('22023', `Lot ${lot.lot_number} has a remaining count that is not a whole number; fix it before quarantining.`, 'non_whole_quantity');
    const inv = T('inventory').find(r => r.product_id === lot.product_id);
    const amount = Math.min(Number(lot.quantity_remaining || 0), Number((inv && inv.available) || 0));
    if (amount <= 0) fail('55000', "There's nothing left in Available for this lot to quarantine — check Inventory directly.", 'nothing_to_quarantine');
    applyStock(lot.product_id, 'available', -amount, 'Recall — quarantined', lot.id);
    applyStock(lot.product_id, 'recalled', amount, 'Recall — quarantined', lot.id);
    Object.assign(rc, { status: 'quarantined', quantity_quarantined: amount, updated_at: now() });
    return { already_done: false, quantity_quarantined: amount };
  });

  backend.rpc.receive_return = txn('receive_return', b => {
    const d = b.p_disposition;
    if (!d) fail('22023', 'Pick what happens to the stock before marking this Received.');
    if (!['restock_available', 'restock_damaged', 'discard'].includes(d)) fail('22023', `Unknown disposition "${d}".`);
    if (d !== 'discard' && !o.ownerOrAdmin) fail('42501', 'Only the Owner or an Administrator can restock a return. Nothing was changed.');
    const ret = T('returns').find(r => r.id === b.p_return_id);
    if (!ret) fail('P0002', 'That return no longer exists.');
    if (ret.status !== 'approved') return { already_done: true, status: ret.status };
    if (ret.received_at) return { already_done: true, status: ret.status, reason: 'received_before' };
    const item = T('order_items').find(i => i.id === ret.order_item_id) || {};
    const order = T('orders').find(x => x.id === item.order_id) || {};
    const lineQty = Number(item.quantity || 0);
    const qty = b.p_quantity != null ? b.p_quantity : lineQty;
    if (b.p_quantity != null && (b.p_quantity < 1 || b.p_quantity > lineQty)) fail('22023', `Returned quantity must be between 1 and ${lineQty} (the quantity on the order line).`);
    let restocked = false, note = null;
    if (d !== 'discard' && qty > 0) {
      if (!item.sku) note = 'no_sku';
      else {
        const prod = T('products').find(p => p.sku && String(p.sku).toLowerCase() === String(item.sku).toLowerCase());
        if (!prod) note = 'no_product_with_sku';
        else { applyStock(prod.id, d === 'restock_available' ? 'available' : 'damaged', qty, `Return received (order ${order.order_number || '?'})`, null); restocked = true; }
      }
    }
    Object.assign(ret, { status: 'received', disposition: d, received_at: now(), updated_at: now() });
    return { already_done: false, restocked, quantity: restocked ? qty : 0, note, sku: item.sku || null };
  });

  backend.rpc.delete_unused_product = txn('delete_unused_product', b => {
    if (!o.ownerOrAdmin) fail('42501', 'Only the Owner or an Administrator can delete a product.');
    const id = b.p_product_id;
    if (['purchase_order_items', 'inventory_lots', 'inventory_adjustments', 'recalls'].some(t => T(t).some(r => r.product_id === id))) return { deleted: false, reason: 'in_use' };
    const prod = T('products').find(p => p.id === id);
    if (prod && prod.sku && String(prod.sku).trim() && T('order_items').some(i => i.sku && String(i.sku).toLowerCase() === String(prod.sku).toLowerCase())) return { deleted: false, reason: 'sold' };
    if (!prod) return { deleted: false, reason: 'not_found' };
    const inv = T('inventory').find(r => r.product_id === id);
    if (inv && BUCKETS.some(k => Number(inv[k] || 0) !== 0)) return { deleted: false, reason: 'has_stock', units: BUCKETS.reduce((s, k) => s + Number(inv[k] || 0), 0) };
    if (T('quality_checks').some(r => r.product_id === id)) return { deleted: false, reason: 'in_use' }; // foreign key in the real database
    backend.tables.inventory = T('inventory').filter(r => r.product_id !== id);
    backend.tables.products = T('products').filter(p => p.id !== id);
    return { deleted: true };
  });
}

// A function the page calls but the database does not have (switched on, not
// installed): PostgREST answers 404 PGRST202.
function functionMissing() {
  return () => ({ __error: { status: 404, code: 'PGRST202', message: 'Could not find the function public.receive_purchase_order in the schema cache' } });
}

module.exports = { installStockFunctions, functionMissing, BUCKETS };
