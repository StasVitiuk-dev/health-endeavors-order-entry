// Partial receiving and returns — the dashboard side of docs/ops/sql/drafts/40
// (the owner's rules of Nov 22, D-ops-5). Connected to the "Deliveries" section on
// Purchase Orders behind the he_receiving_store switch, which is not on the
// Feature Flags page and does anything only once drafts/40 is installed (staff
// also need drafts/44 to see purchase orders). Supplier returns, customer-return
// inspections and corrections are available here for the next screens.
//
// Staff submit; only the owner approves, rejects or decides; stock changes only
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
  const STAFF = new Set(['owner', 'administrator', 'employee']);
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
    const isOwner = () => role === 'owner';
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
    // and what is still to come; plus every request waiting for the owner.
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
        if (toCome != null && x.good + x.damaged > toCome) return refuse('Only ' + toCome + ' unit(s) are still to come on a line; enter the rest as surplus for the owner to review.');
        if (toCome != null && x.surplus && x.good + x.damaged < toCome) return refuse('Surplus is what arrived beyond the ' + toCome + ' unit(s) still to come.');
        if (!x.rejected) delete x.rejected_reason;
        lines.push(x);
      }
      if (!lines.length) return refuse('Enter at least one unit that arrived.');
      const note = String(q.note || '').trim().slice(0, 500);
      return call('submit:' + q.requestKey, RPC.submit, { p_request_key: q.requestKey, p_purchase_order_id: q.poId, p_lines: lines, p_note: note || null },
        'Delivery recorded. It waits for the owner; stock changes only when the owner approves.');
    }
    const ownerOnly = () => (role != null && !isOwner()) ? refuse('Only the owner approves, rejects or decides.') : null;
    async function approve(id, note) {
      const r = ready() || ownerOnly(); if (r) return r;
      if (!isUuid(id)) return refuse('That is not a receiving record.');
      return call('decide:' + id, RPC.approve, { p_id: id, p_note: note ? String(note).trim().slice(0, 500) : null }, 'Approved. Stock and the purchase order are updated.');
    }
    async function reject(id, reason) {
      const r = ready() || ownerOnly(); if (r) return r;
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
        p_reason: String(q.reason).trim().slice(0, 300), p_replacement_expected: q.replacementExpected === true }, 'Return to the supplier recorded. It waits for the owner.');
    }
    async function decideSupplierReturn(id, decision, note) {
      const r = ready() || ownerOnly(); if (r) return r;
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
      const r = ready() || ownerOnly(); if (r) return r;
      const q = isObj(d) ? d : {};
      if (!isUuid(id)) return refuse('That is not a customer return.');
      if (typeof q.opened !== 'boolean' || typeof q.used !== 'boolean') return refuse('Say whether the product was opened and whether it was used.');
      const [a, b, c] = [units(q.restock), units(q.damaged), units(q.unsuitable)];
      if ([a, b, c].some(Number.isNaN)) return refuse('Enter whole numbers of units.');
      if (a > 0 && (q.opened || q.used)) return refuse('Opened or used skincare cannot be restocked; record it as unsuitable or damaged.');
      return call('crd:' + id, RPC.decideCustomerReturn, { p_id: id, p_restock: a, p_damaged: b, p_unsuitable: c, p_opened: q.opened, p_used: q.used, p_note: q.note ? String(q.note).trim().slice(0, 500) : null }, 'Inspection recorded.');
    }
    async function correctMovement(d) {
      const r = ready() || ownerOnly(); if (r) return r;
      const q = isObj(d) ? d : {};
      if (!isUuid(q.requestKey) || !Number.isInteger(q.movementId)) return refuse('Choose the stock movement to correct.');
      if (String(q.reason || '').trim().length < 5) return refuse('Say why it is corrected (at least 5 characters).');
      return call('fix:' + q.movementId, RPC.correct, { p_request_key: q.requestKey, p_movement_id: q.movementId, p_reason: String(q.reason).trim().slice(0, 300) }, 'Corrected by a linked movement.');
    }
    return { enabled, probe, load, submit, approve, reject, cancel, decideSurplus, submitSupplierReturn, decideSupplierReturn, recordCustomerReturn, decideCustomerReturn, correctMovement };
  }

  return { RPC, RECORD_COLUMNS, LINE_COLUMNS, friendlyError, createStore };
}));
