// Partial receiving and returns — the dashboard side of docs/ops/sql/drafts/40
// (the owner's rules of Nov 22, D-ops-5). Connected to the "Deliveries" section on
// Purchase Orders behind the he_receiving_store switch, which is not on the
// Feature Flags page and does anything only once drafts/40 is installed (staff
// also need drafts/44 to see purchase orders). Supplier returns, customer-return
// inspections and corrections are available here for the next screens.
//
// Staff submit; only the owner or an administrator approves, rejects or decides; stock changes only
// on the owner's approval. The database enforces every rule again on its own;
// this file gives plain-English messages earlier and maps the shapes. Each
// submission carries a request key from the page, so a retry records once.
// Pure apart from the database client it is GIVEN (supabase-js shaped).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.inventory = root.HE.inventory || {})['he-receiving-store'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RPC = {
    submit: 'submit_receiving_record', approve: 'approve_receiving_record', reject: 'reject_receiving_record', cancel: 'cancel_receiving_record',
    surplus: 'decide_receiving_surplus', supplierReturn: 'submit_supplier_return', decideSupplierReturn: 'decide_supplier_return',
    customerReturn: 'record_customer_return', decideCustomerReturn: 'decide_customer_return', correct: 'correct_stock_movement',
  };
  const RECORD_COLUMNS = ['id', 'request_key', 'purchase_order_id', 'status', 'note', 'submitted_by', 'submitted_at', 'decided_by', 'decided_at', 'decision_note'];
  const LINE_COLUMNS = ['id', 'record_id', 'po_item_id', 'good', 'damaged', 'rejected', 'rejected_reason', 'surplus', 'surplus_status', 'surplus_decided_by', 'surplus_decided_at', 'surplus_note'];
  const PO_COLUMNS = ['id', 'po_number', 'status', 'supplier_id', 'deleted_at', 'created_at'];
  const ITEM_COLUMNS = ['id', 'purchase_order_id', 'sku', 'description', 'quantity', 'quantity_received'];
  const OPEN_PO = ['ordered', 'shipped', 'received'];
  // Nov 23: the returns screens (supplier returns, customer-return checks, corrections)
  const SR_COLUMNS = ['id', 'request_key', 'po_item_id', 'quantity', 'from_bucket', 'reason', 'replacement_expected', 'status', 'submitted_by', 'submitted_at', 'decided_by', 'decided_at', 'decision_note'];
  const CR_COLUMNS = ['id', 'request_key', 'return_id', 'order_item_id', 'quantity', 'status', 'received_by', 'received_at', 'opened', 'used', 'restock', 'damaged', 'unsuitable', 'decided_by', 'decided_at', 'decision_note'];
  const MOVE_COLUMNS = ['id', 'product_id', 'bucket', 'change', 'reason', 'source_kind', 'corrects', 'at'];
  const MAX_MOVES = 50;
  const STAFF = new Set(['owner', 'administrator', 'manager', 'employee']);   // a manager can do what an employee can (drafts/62, Nov 24)
  const MAX_UNITS = 1000000, MAX_LIST = 200;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = (v) => typeof v === 'string' && UUID.test(v);
  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const units = (v) => (v === '' || v == null) ? 0 : (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : (Number.isInteger(v) ? v : NaN));

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Partial receiving is not installed in the database yet (drafts/40 needs the owner\'s approval). Nothing was saved.';
    }
    if (code === '42501') return /^Only /.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === '22023' || code === 'P0002' || code === '23514') return msg || 'The database refused the request.';
    if (!code && /fetch|network|timeout|failed|aborted/i.test(msg)) return 'Could not reach the database, so the page cannot tell whether it was recorded. Press the button again: it is recorded at most once.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '.';
  }

  function createStore(options) {
    const o = options || {};
    const client = o.client || null, enabled = o.enabled === true, role = o.role == null ? null : String(o.role);
    const inFlight = new Set();
    const refuse = (message, extra) => Object.assign({ ok: false, message }, extra || {});
    const isApprover = () => role === 'owner' || role === 'administrator';   // owner decision, Nov 24
    function ready() {
      if (!enabled) return refuse('Partial receiving is off.', { off: true });
      if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') return refuse('No database connection was given.');
      if (role != null && !STAFF.has(role)) return refuse('Only staff, an administrator or the owner can use deliveries.', { forbidden: true });
      return null;
    }
    async function once(key, fn) {
      if (inFlight.has(key)) return refuse('That request is already being sent. Wait for it to finish.', { busy: true });
      inFlight.add(key);
      try { return await fn(); } catch (e) { return refuse(friendlyError(e), { error: true }); } finally { inFlight.delete(key); }
    }
    async function call(key, name, args, okText) {
      return once(key, async function () {
        const res = await client.rpc(name, args);
        if (res && res.error) return refuse(friendlyError(res.error), { retry: !res.error.code });
        const d = isObj(res && res.data) ? res.data : {};
        if (d.ok === false) return refuse('Already ' + (d.status || 'decided') + '. Nothing changed.', { status: d.status || null });
        return { ok: true, id: d.id || null, status: d.status || null, duplicate: d.duplicate === true || d.already_decided === true,
          message: d.duplicate === true ? 'Already recorded. Nothing changed.' : d.already_decided === true ? 'Already ' + d.status + '. Nothing changed.' : okText };
      });
    }

    async function probe() {
      const r = ready(); if (r) return r;
      return once('probe', async function () {
        const res = await client.from('receiving_records').select('id').limit(1);
        if (res && res.error) { const m = friendlyError(res.error); return refuse(m, { installed: !/not installed/.test(m) }); }
        return { ok: true, installed: true };
      });
    }

    // Purchase orders the person can see that can still receive, with their lines
    // and what is still to come; plus every request waiting for the owner or an administrator.
    async function load() {
      const r = ready(); if (r) return r;
      return once('load', async function () {
        const [po, items, recs, lines] = await Promise.all([
          client.from('purchase_orders').select(PO_COLUMNS.join(',')).order('created_at', { ascending: false }).limit(MAX_LIST),
          client.from('purchase_order_items').select(ITEM_COLUMNS.join(',')).limit(MAX_LIST * 10),
          client.from('receiving_records').select(RECORD_COLUMNS.join(',')).order('submitted_at', { ascending: false }).limit(MAX_LIST),
          client.from('receiving_record_lines').select(LINE_COLUMNS.join(',')).limit(MAX_LIST * 10),
        ]);
        for (const x of [po, items, recs, lines]) if (x && x.error) return refuse(friendlyError(x.error));
        const its = (items.data || []).filter(isObj);
        const orders = (po.data || []).filter(p => isObj(p) && !p.deleted_at && OPEN_PO.indexOf(p.status) >= 0).map(p => ({
          id: p.id, number: p.po_number || '(no number)', status: p.status,
          lines: its.filter(i => i.purchase_order_id === p.id).map(i => ({ id: i.id, sku: i.sku || '', description: i.description || '',
            ordered: Number(i.quantity) || 0, received: Number(i.quantity_received) || 0, toCome: Math.max(0, (Number(i.quantity) || 0) - (Number(i.quantity_received) || 0)) })),
        }));
        const lineRows = (lines.data || []).filter(isObj);
        const records = (recs.data || []).filter(isObj).map(x => Object.assign({}, x, { lines: lineRows.filter(l => l.record_id === x.id) }));
        return { ok: true, orders, records, waiting: records.filter(x => x.status === 'submitted'),
          surplusWaiting: lineRows.filter(l => l.surplus_status === 'waiting') };
      });
    }

    // Everything the returns screens show, in one reading: order lines that can
    // still come back, purchase-order lines with received units, both kinds of
    // return, and (owner and administrators only; the database shows staff none)
    // the latest stock movements with which of them were already corrected.
    async function loadReturns() {
      const r = ready(); if (r) return r;
      return once('loadReturns', async function () {
        const [ords, oItems, po, pItems, srs, crs, moves, prods] = await Promise.all([
          client.from('orders').select('id,order_number,status,deleted_at,placed_at').order('placed_at', { ascending: false }).limit(MAX_LIST),
          client.from('order_items').select('id,order_id,sku,product_name,quantity').limit(MAX_LIST * 10),
          client.from('purchase_orders').select('id,po_number,status,deleted_at').order('created_at', { ascending: false }).limit(MAX_LIST),
          client.from('purchase_order_items').select(ITEM_COLUMNS.join(',')).limit(MAX_LIST * 10),
          client.from('supplier_returns').select(SR_COLUMNS.join(',')).order('submitted_at', { ascending: false }).limit(MAX_LIST),
          client.from('customer_return_inspections').select(CR_COLUMNS.join(',')).order('received_at', { ascending: false }).limit(MAX_LIST),
          client.from('stock_movements').select(MOVE_COLUMNS.join(',')).order('id', { ascending: false }).limit(MAX_MOVES),
          client.from('products').select('id,sku,name').limit(MAX_LIST * 5),
        ]);
        for (const x of [srs, crs]) if (x && x.error) { const m = friendlyError(x.error); return refuse(m, { installed: !/not installed/.test(m) }); }
        for (const x of [ords, oItems, po, pItems, moves, prods]) if (x && x.error) return refuse(friendlyError(x.error));
        const rows = (x) => (Array.isArray(x && x.data) ? x.data : []).filter(isObj);
        const cr = rows(crs), sr = rows(srs);
        const orders = {}; rows(ords).filter(o => !o.deleted_at && !/cancel/i.test(String(o.status || ''))).forEach(o => { orders[o.id] = o; });
        const backOn = (id) => cr.filter(c => c.order_item_id === id && c.status !== 'cancelled').reduce((a, c) => a + (Number(c.quantity) || 0), 0);
        const orderLines = rows(oItems).filter(i => orders[i.order_id]).map(i => ({ id: i.id, order: orders[i.order_id].order_number || '(no number)', sku: i.sku || '', name: i.product_name || '',
          sold: Number(i.quantity) || 0, canReturn: Math.max(0, (Number(i.quantity) || 0) - backOn(i.id)) })).filter(l => l.sold > 0);
        const pos = {}; rows(po).filter(p => !p.deleted_at).forEach(p => { pos[p.id] = p; });
        const poLines = rows(pItems).filter(i => pos[i.purchase_order_id]).map(i => ({ id: i.id, po: pos[i.purchase_order_id].po_number || '(no number)', sku: i.sku || '', description: i.description || '',
          received: Number(i.quantity_received) || 0 })).filter(l => l.received > 0);
        const names = {}; rows(prods).forEach(p => { names[p.id] = p.sku || p.name || 'product'; });
        const mv = rows(moves);
        const corrected = new Set(mv.filter(m => m.corrects != null).map(m => Number(m.corrects)));
        const movements = mv.map(m => Object.assign({}, m, { product: names[m.product_id] || 'product', corrected: corrected.has(Number(m.id)), isCorrection: m.source_kind === 'correction' }));
        return { ok: true, installed: true, orderLines, poLines, supplierReturns: sr, customerReturns: cr, movements,
          supplierWaiting: sr.filter(x => x.status === 'submitted'), customerWaiting: cr.filter(x => x.status === 'awaiting_inspection') };
      });
    }

    // d: { requestKey, poId, lines: [{ poItemId, good, damaged, rejected, rejectedReason, surplus }], note, toCome?: { poItemId: n } }
    async function submit(d) {
      const r = ready(); if (r) return r;
      const q = isObj(d) ? d : {};
      if (!isUuid(q.requestKey)) return refuse('The page gave this delivery no request key, so a retry could not be recognised. Nothing was saved.');
      if (!isUuid(q.poId)) return refuse('Choose the purchase order.');
      const lines = [];
      for (const l of (Array.isArray(q.lines) ? q.lines : []).filter(isObj)) {
        const x = { po_item_id: l.poItemId, good: units(l.good), damaged: units(l.damaged), rejected: units(l.rejected), surplus: units(l.surplus), rejected_reason: String(l.rejectedReason || '').trim() };
        if ([x.good, x.damaged, x.rejected, x.surplus].some(n => Number.isNaN(n) || n < 0 || n > MAX_UNITS)) return refuse('Enter whole numbers of units (no fractions, no negatives).');
        if (x.good + x.damaged + x.rejected + x.surplus === 0) continue;
        if (!isUuid(x.po_item_id)) return refuse('A line is not on this purchase order.');
        if (x.rejected && x.rejected_reason.length < 5) return refuse('Say why units were rejected (at least 5 characters).');
        const toCome = isObj(q.toCome) && Number.isInteger(q.toCome[x.po_item_id]) ? q.toCome[x.po_item_id] : null;
        if (toCome != null && x.good + x.damaged > toCome) return refuse('Only ' + toCome + ' unit(s) are still to come on a line; enter the rest as surplus for the owner or an administrator to review.');
        if (toCome != null && x.surplus && x.good + x.damaged < toCome) return refuse('Surplus is what arrived beyond the ' + toCome + ' unit(s) still to come.');
        if (!x.rejected) delete x.rejected_reason;
        lines.push(x);
      }
      if (!lines.length) return refuse('Enter at least one unit that arrived.');
      const note = String(q.note || '').trim().slice(0, 500);
      return call('submit:' + q.requestKey, RPC.submit, { p_request_key: q.requestKey, p_purchase_order_id: q.poId, p_lines: lines, p_note: note || null },
        'Delivery recorded. It waits for the owner or an administrator; stock changes only when one of them approves.');
    }
    const ownerOnly = () => (role != null && !isApprover()) ? refuse('Only the owner or an administrator approves, rejects or decides.') : null;
    // Owner decision of Nov 25: a manager approves, rejects and decides deliveries and returns too
    // (never one they recorded: the database refuses that). Surplus and corrections stay ownerOnly().
    const deciderOnly = () => (role != null && !isApprover() && role !== 'manager') ? refuse('Only the owner, an administrator or a manager approves, rejects or decides.') : null;
    async function approve(id, note) {
      const r = ready() || deciderOnly(); if (r) return r;
      if (!isUuid(id)) return refuse('That is not a receiving record.');
      return call('decide:' + id, RPC.approve, { p_id: id, p_note: note ? String(note).trim().slice(0, 500) : null }, 'Approved. Stock and the purchase order are updated.');
    }
    async function reject(id, reason) {
      const r = ready() || deciderOnly(); if (r) return r;
      if (!isUuid(id)) return refuse('That is not a receiving record.');
      const why = String(reason || '').trim();
      if (why.length < 5) return refuse('Say why the delivery record is rejected (at least 5 characters).');
      return call('decide:' + id, RPC.reject, { p_id: id, p_reason: why.slice(0, 500) }, 'Rejected. No stock changed.');
    }
    async function cancel(id) {
      const r = ready(); if (r) return r;
      if (!isUuid(id)) return refuse('That is not a receiving record.');
      return call('decide:' + id, RPC.cancel, { p_id: id }, 'Cancelled. No stock changed.');
    }
    async function decideSurplus(lineId, decision, note) {
      const r = ready() || ownerOnly(); if (r) return r;
      if (!isUuid(lineId)) return refuse('That is not a delivery line.');
      if (decision !== 'kept' && decision !== 'returned') return refuse('Choose keep or return.');
      return call('surplus:' + lineId, RPC.surplus, { p_line_id: lineId, p_decision: decision, p_note: note ? String(note).trim().slice(0, 300) : null },
        decision === 'kept' ? 'Surplus kept: it is added to Available stock.' : 'Surplus returned: no stock change.');
    }
    // the next screens: supplier returns, customer-return inspections, corrections
    async function submitSupplierReturn(d) {
      const r = ready(); if (r) return r;
      const q = isObj(d) ? d : {};
      if (!isUuid(q.requestKey) || !isUuid(q.poItemId)) return refuse('Choose the purchase order line.');
      const n = units(q.quantity); if (!(n >= 1)) return refuse('Enter how many units go back (a whole number).');
      if (q.fromBucket !== 'available' && q.fromBucket !== 'damaged') return refuse('Say whether they come from Available or Damaged stock.');
      if (String(q.reason || '').trim().length < 5) return refuse('Say why they go back (at least 5 characters).');
      return call('sr:' + q.requestKey, RPC.supplierReturn, { p_request_key: q.requestKey, p_po_item_id: q.poItemId, p_quantity: n, p_from_bucket: q.fromBucket,
        p_reason: String(q.reason).trim().slice(0, 300), p_replacement_expected: q.replacementExpected === true }, 'Return to the supplier recorded. It waits for the owner or an administrator.');
    }
    async function decideSupplierReturn(id, decision, note) {
      const r = ready() || deciderOnly(); if (r) return r;
      if (!isUuid(id) || (decision !== 'approved' && decision !== 'rejected')) return refuse('Choose approve or reject.');
      return call('srd:' + id, RPC.decideSupplierReturn, { p_id: id, p_decision: decision, p_note: note ? String(note).trim().slice(0, 500) : null }, decision === 'approved' ? 'Approved: stock is reduced.' : 'Rejected. No stock changed.');
    }
    async function recordCustomerReturn(d) {
      const r = ready(); if (r) return r;
      const q = isObj(d) ? d : {};
      if (!isUuid(q.requestKey) || !isUuid(q.orderItemId)) return refuse('Choose the order line.');
      const n = units(q.quantity); if (!(n >= 1)) return refuse('Enter how many units came back (a whole number).');
      return call('cr:' + q.requestKey, RPC.customerReturn, { p_request_key: q.requestKey, p_order_item_id: q.orderItemId, p_quantity: n, p_return_id: isUuid(q.returnId) ? q.returnId : null }, 'Recorded: awaiting inspection, not for sale.');
    }
    async function decideCustomerReturn(id, d) {
      const r = ready() || deciderOnly(); if (r) return r;
      const q = isObj(d) ? d : {};
      if (!isUuid(id)) return refuse('That is not a customer return.');
      if (typeof q.opened !== 'boolean' || typeof q.used !== 'boolean') return refuse('Say whether the product was opened and whether it was used.');
      const [a, b, c] = [units(q.restock), units(q.damaged), units(q.unsuitable)];
      if ([a, b, c].some(Number.isNaN)) return refuse('Enter whole numbers of units.');
      if (a > 0 && (q.opened || q.used)) return refuse('Opened or used skincare cannot be restocked; record it as unsuitable or damaged.');
      return call('crd:' + id, RPC.decideCustomerReturn, { p_id: id, p_restock: a, p_damaged: b, p_unsuitable: c, p_opened: q.opened, p_used: q.used, p_note: q.note ? String(q.note).trim().slice(0, 500) : null }, 'Inspection recorded.');
    }
    // Nov 23: cancel a return recorded by mistake, while it still waits. The
    // database lets only the person who recorded it, or the owner, do this; the
    // record stays (status cancelled) and no stock changes.
    async function cancelReturn(table, id, waitingStatus, key) {
      const r = ready(); if (r) return r;
      if (!isUuid(id)) return refuse('That is not a return.');
      return once(key + id, async function () {
        const res = await client.from(table).update({ status: 'cancelled' }).eq('id', id).eq('status', waitingStatus).select('id,status');
        if (res && res.error) return refuse(friendlyError(res.error));
        if (!Array.isArray(res && res.data) || !res.data.length) return refuse('Nothing changed: it was already decided or cancelled, or only the person who recorded it (or the owner) can cancel it.');
        return { ok: true, status: 'cancelled', message: 'Cancelled. It stays on the record; no stock changed.' };
      });
    }
    const cancelSupplierReturn = (id) => cancelReturn('supplier_returns', id, 'submitted', 'src:');
    const cancelCustomerReturn = (id) => cancelReturn('customer_return_inspections', id, 'awaiting_inspection', 'crc:');
    async function correctMovement(d) {
      const r = ready() || ownerOnly(); if (r) return r;
      const q = isObj(d) ? d : {};
      if (!isUuid(q.requestKey) || !Number.isInteger(q.movementId)) return refuse('Choose the stock movement to correct.');
      if (String(q.reason || '').trim().length < 5) return refuse('Say why it is corrected (at least 5 characters).');
      return call('fix:' + q.movementId, RPC.correct, { p_request_key: q.requestKey, p_movement_id: q.movementId, p_reason: String(q.reason).trim().slice(0, 300) }, 'Corrected by a linked movement.');
    }
    return { enabled, probe, load, loadReturns, submit, approve, reject, cancel, decideSurplus, submitSupplierReturn, decideSupplierReturn, cancelSupplierReturn, recordCustomerReturn, decideCustomerReturn, cancelCustomerReturn, correctMovement };
  }

  return { RPC, RECORD_COLUMNS, LINE_COLUMNS, SR_COLUMNS, CR_COLUMNS, MOVE_COLUMNS, friendlyError, createStore };
}));
