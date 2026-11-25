// Inventory — PARTIAL RECEIVING AND RETURNS, a synthetic prototype of the stock
// rules (decision D-ops-5, backlog INV-17), revised to the owner's rules of Nov 22:
//   1 surplus deliveries are logged separately for the owner's review
//   2 rejected deliveries are recorded separately; their quantity stays outstanding
//   3 damaged goods we keep go into the Damaged bucket
//   4 a return to the supplier reopens the outstanding quantity only when a
//     replacement is expected
//   5 staff submit receiving records for purchase orders they may see; the owner
//     approves before any stock changes
//   6 customer returns wait in "awaiting inspection"; opened or used skincare
//     can never be restocked
//   7 corrections are linked stock movements with a reason and the approver
//
// PROTOTYPE ONLY. It works on an in-memory ledger of made-up stock and never
// writes real stock. It mirrors the database draft that would make these rules
// live (docs/ops/sql/drafts/40_DRAFT_partial_receiving_returns.sql, tested in
// staging by local-test/partial_receiving_test.sh); live stock changes stay with
// drafts/10 behind their switches until the owner approves draft 40.
//
// The rules, numbered as in docs/ops/PARTIAL_RECEIVING_RULES_2026-11-21.md:
//   R1  whole units only; at least one unit per submission
//   R2  good + damaged on a line never exceed what is still to come; anything
//       beyond is entered as surplus, and surplus only once the line is complete
//   R3  a receiving record is approved completely or not at all
//   R4  good units go to Available, damaged ones we keep go to Damaged, both on
//       approval; rejected units are recorded with a reason and stay outstanding
//   R5  surplus waits for the owner: kept (Available) or returned (no stock change)
//   R6  a return to the supplier never exceeds what was received and kept on the
//       line, nor what the chosen bucket holds; it reopens the line only when a
//       replacement is expected
//   R7  a customer return never exceeds what was sold and not yet returned; it
//       waits for inspection; every unit gets an outcome (restock, damaged,
//       unsuitable); opened or used units are never restocked
//   R8  staff (and administrators) submit for purchase orders they may see; only
//       the owner or an administrator approves, rejects or decides (owner decision,
//       Nov 24); the submitter or the owner cancels
//   R9  each submission carries a request key: sent again, nothing changes; the
//       same key with different contents is refused; a second approval of the
//       same record changes nothing
//   R10 every change writes one movement per bucket (before, change, after, why,
//       who asked, who approved) and a history entry; refusals are recorded; a
//       mistake is corrected once, by a linked reversing movement with a reason
//
// Pure. Dual-mode (Node require + browser HE.inventory registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.inventory = root.HE.inventory || {})['he-receiving'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BUCKETS = ['available', 'damaged'];
  const SUBMIT_ROLES = ['owner', 'administrator', 'manager', 'employee'];   // a manager can do what an employee can (drafts/62, Nov 24)
  const DECIDE_ROLES = ['owner', 'administrator'];   // owner decision, Nov 24: administrators approve too
  const LIVE_PATH = 'drafts/40 (partial receiving and returns, owner approval before stock changes) once the owner approves it; until then drafts/10 behind the stock_fn_* switches';
  const MAX_UNITS = 1000000;

  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const text = (v) => (v == null ? '' : String(v)).trim();
  const units = (v) => (v === undefined || v === null || v === '') ? 0 : (Number.isInteger(v) && v >= 0 && v <= MAX_UNITS ? v : NaN);
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const BUCKET_NAME = { available: 'Available', damaged: 'Damaged' };

  function createLedger(seed) {
    const s = isObj(seed) ? seed : {};
    const ledger = { products: {}, purchaseOrders: {}, sales: {}, records: [], surplus: [], supplierReturns: [], inspections: [],
      movements: [], corrections: [], history: [], refusals: [], keys: {}, synthetic: true, label: 'SIMULATED', livePath: LIVE_PATH };
    (Array.isArray(s.products) ? s.products : []).forEach(p => {
      if (!isObj(p) || !text(p.sku)) return;
      ledger.products[text(p.sku)] = { sku: text(p.sku), name: text(p.name) || text(p.sku), available: units(p.available) || 0, damaged: units(p.damaged) || 0 };
    });
    (Array.isArray(s.purchaseOrders) ? s.purchaseOrders : []).forEach(po => {
      if (!isObj(po) || !text(po.id)) return;
      ledger.purchaseOrders[text(po.id)] = { id: text(po.id), number: text(po.number) || text(po.id), supplier: text(po.supplier),
        // staff may submit only for purchase orders they are allowed to see
        staffMaySee: po.staffMaySee !== false,
        lines: (Array.isArray(po.lines) ? po.lines : []).filter(l => isObj(l) && ledger.products[text(l.sku)] && units(l.ordered) > 0)
          .map(l => ({ sku: text(l.sku), ordered: l.ordered, received: 0, damagedKept: 0, rejected: 0, returnedToSupplier: 0, replacementsExpected: 0 })) };
    });
    (Array.isArray(s.sales) ? s.sales : []).forEach(so => {
      if (!isObj(so) || !text(so.id)) return;
      ledger.sales[text(so.id)] = { id: text(so.id), number: text(so.number) || text(so.id), customer: text(so.customer),
        lines: (Array.isArray(so.lines) ? so.lines : []).filter(l => isObj(l) && ledger.products[text(l.sku)] && units(l.sold) > 0)
          .map(l => ({ sku: text(l.sku), sold: l.sold })) };
    });
    return ledger;
  }

  // ---- shared plumbing ----------------------------------------------------
  const NOT_A_LEDGER = { ok: false, reason: 'not a ledger', movements: [] };
  const isLedger = (L) => !!(L && isObj(L.products) && Array.isArray(L.movements));
  function refuse(L, kind, req, reason) {
    if (isLedger(L)) L.refusals.push({ kind: kind, requestKey: text(req && req.requestKey) || null, by: text(req && req.by) || null, at: (req && req.at) || null, reason: reason });
    return { ok: false, reason: reason, movements: [] };
  }
  function canSubmit(req, po) {
    const role = text(req.role);
    if (SUBMIT_ROLES.indexOf(role) < 0) return 'only staff, an administrator or the owner can submit this';
    if (role === 'employee' && po && !po.staffMaySee) return 'you can submit only for purchase orders you are allowed to see; hand it to the owner';
    return null;
  }
  const canDecide = (req) => DECIDE_ROLES.indexOf(text(req.role)) >= 0;
  // Owner decision of Nov 25: a manager decides deliveries and returns too, but never one they
  // recorded themselves (a second person always decides). Surplus and corrections stay
  // owner/administrator (canDecide). Needs drafts/66 (option A) or the option B rights in the database.
  const canDecideRecord = (req, recordedBy) => canDecide(req)
    || (text(req.role) === 'manager' && !!text(req.by) && text(req.by) !== text(recordedBy));
  // A new submission: role, request key, retry recognition.
  function keyed(L, kind, req, fingerprint) {
    if (!isLedger(L)) return { stop: NOT_A_LEDGER };
    if (!isObj(req)) return { stop: refuse(L, kind, {}, 'nothing was submitted') };
    const key = text(req.requestKey);
    if (!key) return { stop: refuse(L, kind, req, 'the page gave this submission no request key, so a retry could not be recognised') };
    const seen = L.keys[key];
    if (seen) {
      if (seen.fingerprint === fingerprint) return { stop: { ok: true, duplicate: true, reason: 'already recorded; nothing changed', id: seen.id, movements: [] } };
      return { stop: refuse(L, kind, req, 'that request key was already used for a different submission') };
    }
    return { key: key };
  }
  function move(L, sku, bucket, change, why, req, source, requestedBy) {
    const p = L.products[sku];
    const before = p[bucket];
    p[bucket] = before + change;
    const m = { n: L.movements.length + 1, sku: sku, bucket: bucket, before: before, change: change, after: p[bucket], why: why,
      requestedBy: requestedBy || text(req.by) || null, approvedBy: text(req.by) || null, at: req.at || null, source: source, corrects: null };
    L.movements.push(m);
    return m;
  }
  function log(L, entry) { entry.n = L.history.length + 1; L.history.push(entry); }
  function remember(L, key, fingerprint, id) { L.keys[key] = { fingerprint: fingerprint, id: id }; }
  const outstanding = (line) => Math.max(0, line.ordered - line.received);

  // ---- receiving records: staff submit, the owner decides ----------------------
  // req: { requestKey, poId, lines: [{ sku, good, damaged, rejected, rejectReason, surplus }], by, role, at, note }
  function submitReceiving(L, req) {
    const r = isObj(req) ? req : {};
    const lines = Array.isArray(r.lines) ? r.lines.filter(isObj).map(l => ({ sku: text(l.sku), good: units(l.good), damaged: units(l.damaged), rejected: units(l.rejected), rejectReason: text(l.rejectReason), surplus: units(l.surplus) })) : [];
    const fp = JSON.stringify(['receive', text(r.poId), lines.slice().sort((a, b) => a.sku < b.sku ? -1 : 1)]);
    const g = keyed(L, 'submitReceiving', r, fp); if (g.stop) return g.stop;
    const po = L.purchaseOrders[text(r.poId)];
    if (!po) return refuse(L, 'submitReceiving', r, 'that purchase order is not in this ledger');
    const who = canSubmit(r, po); if (who) return refuse(L, 'submitReceiving', r, who);
    if (!lines.length) return refuse(L, 'submitReceiving', r, 'no lines were submitted');
    const seenSku = {};
    for (const l of lines) {
      if ([l.good, l.damaged, l.rejected, l.surplus].some(Number.isNaN)) return refuse(L, 'submitReceiving', r, 'quantities must be whole units (no fractions, no negatives)');
      if (seenSku[l.sku]) return refuse(L, 'submitReceiving', r, l.sku + ' is listed twice; put it on one line');
      seenSku[l.sku] = true;
      const line = po.lines.find(x => x.sku === l.sku);
      if (!line) return refuse(L, 'submitReceiving', r, l.sku + ' is not on ' + po.number);
      if (l.good + l.damaged + l.rejected + l.surplus < 1) return refuse(L, 'submitReceiving', r, 'enter at least one unit of ' + l.sku);
      if (l.rejected && l.rejectReason.length < 3) return refuse(L, 'submitReceiving', r, 'say why the ' + plural(l.rejected, 'unit') + ' of ' + l.sku + ' were rejected');
      const toCome = outstanding(line);
      if (l.good + l.damaged > toCome) return refuse(L, 'submitReceiving', r, 'only ' + toCome + ' of ' + l.sku + ' are still to come on ' + po.number + '; enter the rest as surplus for the owner or an administrator to review');
      if (l.surplus && l.good + l.damaged < toCome) return refuse(L, 'submitReceiving', r, 'surplus is what arrived beyond the ' + toCome + ' still to come; receive those first');
    }
    const rec = { id: 'rr-' + (L.records.length + 1), poId: po.id, status: 'submitted', lines: lines, submittedBy: text(r.by) || null, submittedAt: r.at || null, note: text(r.note) || null, decidedBy: null, decidedAt: null, decisionNote: null };
    L.records.push(rec);
    remember(L, g.key, fp, rec.id);
    log(L, { kind: 'submitReceiving', id: rec.id, by: rec.submittedBy, at: rec.submittedAt, note: rec.note,
      what: 'receiving record for ' + po.number + ' submitted: ' + lines.map(describeLine).join('; ') + ' (waiting for the owner or an administrator; no stock changed)' });
    return { ok: true, duplicate: false, id: rec.id, movements: [], status: poStatus(L, po.id) };
  }
  function describeLine(l) {
    const parts = [];
    if (l.good) parts.push(l.good + ' good');
    if (l.damaged) parts.push(l.damaged + ' damaged, kept');
    if (l.rejected) parts.push(l.rejected + ' rejected (' + l.rejectReason + ')');
    if (l.surplus) parts.push(l.surplus + ' surplus');
    return l.sku + ': ' + parts.join(', ');
  }
  function findRecord(L, req, kind) {
    const r = isObj(req) ? req : {};
    if (!isLedger(L)) return { stop: NOT_A_LEDGER };
    const rec = L.records.find(x => x.id === text(r.recordId));
    if (!rec) return { stop: refuse(L, kind, r, 'no such receiving record') };
    return { r: r, rec: rec };
  }
  // req: { recordId, by, role, at, note }
  function approveReceiving(L, req) {
    const f = findRecord(L, req, 'approveReceiving'); if (f.stop) return f.stop;
    const r = f.r, rec = f.rec, po = L.purchaseOrders[rec.poId];
    if (!canDecideRecord(r, rec.submittedBy)) return refuse(L, 'approveReceiving', r, 'only the owner, an administrator or a manager (not for a record they submitted) approves stock changes');
    if (rec.status === 'approved') return { ok: true, duplicate: true, reason: 'already approved; nothing changed', id: rec.id, movements: [] };
    if (rec.status !== 'submitted') return refuse(L, 'approveReceiving', r, 'this receiving record was already ' + rec.status);
    // re-checked at approval: another record may have been approved in between (R2, R3)
    for (const l of rec.lines) {
      const line = po.lines.find(x => x.sku === l.sku), toCome = outstanding(line);
      if (l.good + l.damaged > toCome) return refuse(L, 'approveReceiving', r, 'only ' + toCome + ' of ' + l.sku + ' are still to come now; nothing was approved. Reject this record and submit the right figures');
    }
    const moved = [];
    for (const l of rec.lines) {
      const line = po.lines.find(x => x.sku === l.sku);
      if (l.good) moved.push(move(L, l.sku, 'available', l.good, 'received on ' + po.number, r, { recordId: rec.id, poId: po.id, kind: 'receipt' }, rec.submittedBy));
      if (l.damaged) moved.push(move(L, l.sku, 'damaged', l.damaged, 'received damaged on ' + po.number + ', kept', r, { recordId: rec.id, poId: po.id, kind: 'receipt' }, rec.submittedBy));
      line.received += l.good + l.damaged; line.damagedKept += l.damaged; line.rejected += l.rejected;
      if (l.surplus) L.surplus.push({ id: 'sp-' + (L.surplus.length + 1), recordId: rec.id, poId: po.id, sku: l.sku, quantity: l.surplus, status: 'waiting', decidedBy: null, note: null });
    }
    rec.status = 'approved'; rec.decidedBy = text(r.by) || null; rec.decidedAt = r.at || null; rec.decisionNote = text(r.note) || null;
    const rej = rec.lines.filter(l => l.rejected), sur = rec.lines.filter(l => l.surplus);
    log(L, { kind: 'approveReceiving', id: rec.id, by: rec.decidedBy, at: rec.decidedAt, note: rec.decisionNote,
      what: 'receiving record for ' + po.number + ' approved' + (rej.length ? '; rejected, still to come: ' + rej.map(l => l.rejected + ' ' + l.sku).join(', ') : '') + (sur.length ? '; surplus waiting for the owner or an administrator: ' + sur.map(l => l.surplus + ' ' + l.sku).join(', ') : '') });
    return { ok: true, duplicate: false, id: rec.id, movements: moved, status: poStatus(L, po.id) };
  }
  function closeRecord(L, req, to) {
    const kind = to === 'rejected' ? 'rejectReceiving' : 'cancelReceiving';
    const f = findRecord(L, req, kind); if (f.stop) return f.stop;
    const r = f.r, rec = f.rec;
    if (to === 'rejected' && !canDecideRecord(r, rec.submittedBy)) return refuse(L, kind, r, 'only the owner, an administrator or a manager (not for a record they submitted) rejects a receiving record');
    if (to === 'cancelled' && !(canDecide(r) || (text(r.by) && text(r.by) === rec.submittedBy))) return refuse(L, kind, r, 'only the person who submitted it, or the owner, can cancel it');
    if (rec.status === to) return { ok: true, duplicate: true, reason: 'already ' + to + '; nothing changed', id: rec.id, movements: [] };
    if (rec.status !== 'submitted') return refuse(L, kind, r, 'this receiving record was already ' + rec.status);
    if (to === 'rejected' && text(r.note).length < 3) return refuse(L, kind, r, 'say why the record is rejected');
    rec.status = to; rec.decidedBy = text(r.by) || null; rec.decidedAt = r.at || null; rec.decisionNote = text(r.note) || null;
    log(L, { kind: kind, id: rec.id, by: rec.decidedBy, at: rec.decidedAt, note: rec.decisionNote, what: 'receiving record ' + rec.id + ' ' + to + '; no stock changed' });
    return { ok: true, duplicate: false, id: rec.id, movements: [] };
  }
  const rejectReceiving = (L, req) => closeRecord(L, req, 'rejected');
  const cancelReceiving = (L, req) => closeRecord(L, req, 'cancelled');

  // req: { surplusId, decision: 'kept'|'returned', by, role, at, note }
  function decideSurplus(L, req) {
    const r = isObj(req) ? req : {};
    if (!isLedger(L)) return NOT_A_LEDGER;
    const sp = L.surplus.find(x => x.id === text(r.surplusId));
    if (!sp) return refuse(L, 'decideSurplus', r, 'no such surplus');
    if (!canDecide(r)) return refuse(L, 'decideSurplus', r, 'only the owner or an administrator decides on surplus');
    const d = text(r.decision);
    if (d !== 'kept' && d !== 'returned') return refuse(L, 'decideSurplus', r, 'say whether the surplus is kept or returned');
    if (sp.status === d) return { ok: true, duplicate: true, reason: 'already ' + d + '; nothing changed', movements: [] };
    if (sp.status !== 'waiting') return refuse(L, 'decideSurplus', r, 'this surplus was already ' + sp.status);
    const po = L.purchaseOrders[sp.poId];
    const moved = d === 'kept' ? [move(L, sp.sku, 'available', sp.quantity, 'surplus delivery on ' + po.number + ' kept by the owner' + (text(r.note) ? ': ' + text(r.note) : ''), r, { surplusId: sp.id, poId: po.id, kind: 'surplus_kept' })] : [];
    sp.status = d; sp.decidedBy = text(r.by) || null; sp.note = text(r.note) || null;
    log(L, { kind: 'decideSurplus', id: sp.id, by: sp.decidedBy, at: r.at || null, note: sp.note,
      what: plural(sp.quantity, 'surplus unit') + ' of ' + sp.sku + ' on ' + po.number + ' ' + (d === 'kept' ? 'kept (into Available)' : 'returned to the supplier (no stock change)') });
    return { ok: true, duplicate: false, movements: moved };
  }

  // ---- returns to the supplier --------------------------------------------------
  // req: { requestKey, poId, sku, quantity, from: 'available'|'damaged', reason, replacementExpected, by, role, at }
  function submitSupplierReturn(L, req) {
    const r = isObj(req) ? req : {};
    const qty = units(r.quantity), from = text(r.from) || 'available', repl = r.replacementExpected === true;
    const fp = JSON.stringify(['supplierReturn', text(r.poId), text(r.sku), qty, from, repl]);
    const g = keyed(L, 'submitSupplierReturn', r, fp); if (g.stop) return g.stop;
    const po = L.purchaseOrders[text(r.poId)];
    if (!po) return refuse(L, 'submitSupplierReturn', r, 'that purchase order is not in this ledger');
    const who = canSubmit(r, po); if (who) return refuse(L, 'submitSupplierReturn', r, who);
    const line = po.lines.find(x => x.sku === text(r.sku));
    if (!line) return refuse(L, 'submitSupplierReturn', r, text(r.sku) + ' is not on ' + po.number);
    if (Number.isNaN(qty) || qty < 1) return refuse(L, 'submitSupplierReturn', r, 'return at least one whole unit');
    if (BUCKETS.indexOf(from) < 0) return refuse(L, 'submitSupplierReturn', r, 'say whether the units come from Available or Damaged stock');
    if (text(r.reason).length < 5) return refuse(L, 'submitSupplierReturn', r, 'say why the units go back to the supplier');
    const sr = { id: 'sr-' + (L.supplierReturns.length + 1), poId: po.id, sku: line.sku, quantity: qty, from: from, reason: text(r.reason), replacementExpected: repl, status: 'submitted', submittedBy: text(r.by) || null, decidedBy: null };
    L.supplierReturns.push(sr);
    remember(L, g.key, fp, sr.id);
    log(L, { kind: 'submitSupplierReturn', id: sr.id, by: sr.submittedBy, at: r.at || null, note: sr.reason,
      what: plural(qty, 'unit') + ' of ' + line.sku + ' to go back to the supplier of ' + po.number + ' from ' + BUCKET_NAME[from] + (repl ? ', replacement expected' : ', no replacement') + ' (waiting for the owner or an administrator)' });
    return { ok: true, duplicate: false, id: sr.id, movements: [] };
  }
  // req: { returnId, decision: 'approved'|'rejected', by, role, at, note }
  function decideSupplierReturn(L, req) {
    const r = isObj(req) ? req : {};
    if (!isLedger(L)) return NOT_A_LEDGER;
    const sr = L.supplierReturns.find(x => x.id === text(r.returnId));
    if (!sr) return refuse(L, 'decideSupplierReturn', r, 'no such return to the supplier');
    if (!canDecideRecord(r, sr.submittedBy)) return refuse(L, 'decideSupplierReturn', r, 'only the owner, an administrator or a manager (not for a return they submitted) approves or rejects a return to the supplier');
    const d = text(r.decision);
    if (d !== 'approved' && d !== 'rejected') return refuse(L, 'decideSupplierReturn', r, 'say whether the return is approved or rejected');
    if (sr.status === d) return { ok: true, duplicate: true, reason: 'already ' + d + '; nothing changed', movements: [] };
    if (sr.status !== 'submitted') return refuse(L, 'decideSupplierReturn', r, 'this return was already ' + sr.status);
    const po = L.purchaseOrders[sr.poId], line = po.lines.find(x => x.sku === sr.sku);
    let moved = [];
    if (d === 'approved') {
      // received and kept = received - what already went back without a replacement
      const kept = line.received - line.returnedToSupplier + line.replacementsExpected;
      if (sr.quantity > kept) return refuse(L, 'decideSupplierReturn', r, 'only ' + kept + ' of ' + sr.sku + ' received on ' + po.number + ' can still go back; nothing was returned');
      const have = L.products[sr.sku][sr.from];
      if (sr.quantity > have) return refuse(L, 'decideSupplierReturn', r, 'only ' + have + ' of ' + sr.sku + ' are in ' + BUCKET_NAME[sr.from] + ' stock; nothing was returned');
      moved = [move(L, sr.sku, sr.from, -sr.quantity, 'returned to the supplier of ' + po.number + (sr.replacementExpected ? ' (replacement expected)' : '') + ': ' + sr.reason, r, { returnId: sr.id, poId: po.id, kind: 'supplier_return' }, sr.submittedBy)];
      line.returnedToSupplier += sr.quantity;
      // R6: only an expected replacement reopens the line
      if (sr.replacementExpected) { line.received -= sr.quantity; line.replacementsExpected += sr.quantity; }
    }
    sr.status = d; sr.decidedBy = text(r.by) || null;
    log(L, { kind: 'decideSupplierReturn', id: sr.id, by: sr.decidedBy, at: r.at || null, note: text(r.note) || null,
      what: 'return of ' + plural(sr.quantity, 'unit') + ' of ' + sr.sku + ' to the supplier of ' + po.number + ' ' + d + (d === 'approved' && sr.replacementExpected ? '; ' + sr.quantity + ' to come again' : '') });
    return { ok: true, duplicate: false, movements: moved, status: poStatus(L, po.id) };
  }

  // ---- customer returns: awaiting inspection, then the owner decides -------------
  // req: { requestKey, saleId, sku, quantity, reason, by, role, at }
  function recordCustomerReturn(L, req) {
    const r = isObj(req) ? req : {};
    const qty = units(r.quantity);
    const fp = JSON.stringify(['customerReturn', text(r.saleId), text(r.sku), qty]);
    const g = keyed(L, 'recordCustomerReturn', r, fp); if (g.stop) return g.stop;
    const who = canSubmit(r, null); if (who) return refuse(L, 'recordCustomerReturn', r, who);
    const so = L.sales[text(r.saleId)];
    if (!so) return refuse(L, 'recordCustomerReturn', r, 'that customer order is not in this ledger');
    const line = so.lines.find(x => x.sku === text(r.sku));
    if (!line) return refuse(L, 'recordCustomerReturn', r, text(r.sku) + ' is not on ' + so.number);
    if (Number.isNaN(qty) || qty < 1) return refuse(L, 'recordCustomerReturn', r, 'a return needs at least one whole unit');
    if (text(r.reason).length < 3) return refuse(L, 'recordCustomerReturn', r, 'say why the customer returned it');
    const open = stillReturnable(L, so.id, line.sku);
    if (qty > open) return refuse(L, 'recordCustomerReturn', r, 'would take back ' + plural(qty, 'unit') + ' of ' + line.sku + ', but only ' + open + ' of the ' + line.sold + ' sold on ' + so.number + ' have not been returned yet; nothing was taken back');
    const ins = { id: 'ci-' + (L.inspections.length + 1), saleId: so.id, sku: line.sku, quantity: qty, reason: text(r.reason), status: 'awaiting_inspection', recordedBy: text(r.by) || null,
      restock: 0, damaged: 0, unsuitable: 0, opened: null, used: null, decidedBy: null, note: null };
    L.inspections.push(ins);
    remember(L, g.key, fp, ins.id);
    log(L, { kind: 'recordCustomerReturn', id: ins.id, by: ins.recordedBy, at: r.at || null, note: ins.reason,
      what: plural(qty, 'unit') + ' of ' + line.sku + ' returned on ' + so.number + ': awaiting inspection (not available for sale)' });
    return { ok: true, duplicate: false, id: ins.id, movements: [] };
  }
  // req: { inspectionId, restock, damaged, unsuitable, opened, used, by, role, at, note }
  function decideCustomerReturn(L, req) {
    const r = isObj(req) ? req : {};
    if (!isLedger(L)) return NOT_A_LEDGER;
    const ins = L.inspections.find(x => x.id === text(r.inspectionId));
    if (!ins) return refuse(L, 'decideCustomerReturn', r, 'no such customer return');
    if (!canDecideRecord(r, ins.recordedBy)) return refuse(L, 'decideCustomerReturn', r, 'only the owner, an administrator or a manager (not for a return they recorded) decides what happens to returned units');
    if (ins.status === 'decided') return { ok: true, duplicate: true, reason: 'already decided; nothing changed', movements: [] };
    if (ins.status !== 'awaiting_inspection') return refuse(L, 'decideCustomerReturn', r, 'this return was already ' + ins.status);
    if (typeof r.opened !== 'boolean' || typeof r.used !== 'boolean') return refuse(L, 'decideCustomerReturn', r, 'say whether the product was opened and whether it was used');
    const restock = units(r.restock), damaged = units(r.damaged), unsuitable = units(r.unsuitable);
    if ([restock, damaged, unsuitable].some(Number.isNaN)) return refuse(L, 'decideCustomerReturn', r, 'quantities must be whole units (no fractions, no negatives)');
    if (restock > 0 && (r.opened || r.used)) return refuse(L, 'decideCustomerReturn', r, 'opened or used skincare cannot be restocked; record it as unsuitable or damaged');
    if (restock + damaged + unsuitable !== ins.quantity) return refuse(L, 'decideCustomerReturn', r, 'every returned unit needs an outcome: ' + plural(ins.quantity, 'unit') + ' came back');
    const so = L.sales[ins.saleId], moved = [];
    const src = { inspectionId: ins.id, saleId: so.id, kind: 'customer_return' };
    if (restock) moved.push(move(L, ins.sku, 'available', restock, 'customer return on ' + so.number + ', inspected and restocked', r, src, ins.recordedBy));
    if (damaged + unsuitable) moved.push(move(L, ins.sku, 'damaged', damaged + unsuitable, 'customer return on ' + so.number + ', ' + [damaged ? damaged + ' damaged' : '', unsuitable ? unsuitable + ' unsuitable (opened or used)' : ''].filter(Boolean).join(', '), r, src, ins.recordedBy));
    Object.assign(ins, { status: 'decided', restock: restock, damaged: damaged, unsuitable: unsuitable, opened: r.opened, used: r.used, decidedBy: text(r.by) || null, note: text(r.note) || null });
    log(L, { kind: 'decideCustomerReturn', id: ins.id, by: ins.decidedBy, at: r.at || null, note: ins.note,
      what: 'inspected ' + plural(ins.quantity, 'unit') + ' of ' + ins.sku + ' from ' + so.number + (r.opened || r.used ? ' (' + [r.opened ? 'opened' : '', r.used ? 'used' : ''].filter(Boolean).join(' and ') + ')' : ' (sealed)') + ': ' + restock + ' restocked, ' + damaged + ' damaged, ' + unsuitable + ' unsuitable' });
    return { ok: true, duplicate: false, movements: moved };
  }

  // ---- corrections: a linked reversing movement, once, by the owner ---------------
  // req: { requestKey, movementN, reason, by, role, at }
  function correctMovement(L, req) {
    const r = isObj(req) ? req : {};
    const fp = JSON.stringify(['correct', r.movementN]);
    const g = keyed(L, 'correctMovement', r, fp); if (g.stop) return g.stop;
    if (!canDecide(r)) return refuse(L, 'correctMovement', r, 'only the owner or an administrator can correct a stock movement');
    const m = L.movements.find(x => x.n === r.movementN);
    if (!m) return refuse(L, 'correctMovement', r, 'no such stock movement');
    if (m.corrects) return refuse(L, 'correctMovement', r, 'a correction is not corrected again; submit the right figure instead');
    if (L.corrections.some(c => c.movementN === m.n)) return refuse(L, 'correctMovement', r, 'movement ' + m.n + ' was already corrected');
    if (text(r.reason).length < 5) return refuse(L, 'correctMovement', r, 'say why the movement is corrected');
    if (L.products[m.sku][m.bucket] - m.change < 0) return refuse(L, 'correctMovement', r, BUCKET_NAME[m.bucket] + ' stock of ' + m.sku + ' would go below zero; nothing was corrected');
    const c = { id: 'sc-' + (L.corrections.length + 1), movementN: m.n, reason: text(r.reason), by: text(r.by) || null, at: r.at || null };
    L.corrections.push(c);
    const back = move(L, m.sku, m.bucket, -m.change, 'correction of movement ' + m.n + ': ' + c.reason, r, { correctionId: c.id, kind: 'correction' });
    back.corrects = m.n;
    // a corrected delivery is no longer received on its purchase-order line
    if (m.source && m.source.kind === 'receipt') {
      const line = L.purchaseOrders[m.source.poId].lines.find(x => x.sku === m.sku);
      line.received -= m.change; if (m.bucket === 'damaged') line.damagedKept -= m.change;
    }
    remember(L, g.key, fp, c.id);
    log(L, { kind: 'correctMovement', id: c.id, by: c.by, at: c.at, note: c.reason,
      what: 'movement ' + m.n + ' (' + BUCKET_NAME[m.bucket] + ' ' + (m.change > 0 ? '+' : '') + m.change + ') corrected by movement ' + back.n });
    return { ok: true, duplicate: false, movements: [back] };
  }

  // ---- read-outs ------------------------------------------------------------
  function stillReturnable(L, saleId, sku) {
    const so = L.sales[saleId], line = so && so.lines.find(x => x.sku === sku);
    if (!line) return 0;
    return line.sold - L.inspections.filter(i => i.saleId === saleId && i.sku === sku && i.status !== 'cancelled').reduce((t, i) => t + i.quantity, 0);
  }
  function poStatus(L, poId) {
    const po = L && L.purchaseOrders && L.purchaseOrders[text(poId)];
    if (!po) return null;
    const lines = po.lines.map(l => ({ sku: l.sku, ordered: l.ordered, received: l.received, damagedKept: l.damagedKept, rejected: l.rejected, toCome: outstanding(l),
      returnedToSupplier: l.returnedToSupplier, replacementsExpected: l.replacementsExpected }));
    const got = lines.reduce((t, l) => t + l.received, 0), want = lines.reduce((t, l) => t + l.ordered, 0);
    return { id: po.id, number: po.number, status: got === 0 ? 'OPEN' : got < want ? 'PARTLY_RECEIVED' : 'RECEIVED', lines: lines };
  }
  function saleStatus(L, saleId) {
    const so = L && L.sales && L.sales[text(saleId)];
    if (!so) return null;
    return { id: so.id, number: so.number, lines: so.lines.map(l => {
      const ins = L.inspections.filter(i => i.saleId === so.id && i.sku === l.sku);
      const sum = (k) => ins.filter(i => i.status === 'decided').reduce((t, i) => t + i[k], 0);
      return { sku: l.sku, sold: l.sold, awaitingInspection: ins.filter(i => i.status === 'awaiting_inspection').reduce((t, i) => t + i.quantity, 0),
        restocked: sum('restock'), damaged: sum('damaged'), unsuitable: sum('unsuitable'), stillReturnable: stillReturnable(L, so.id, l.sku) };
    }) };
  }
  // Everything waiting for the owner's decision.
  function waiting(L) {
    if (!isLedger(L)) return { receiving: [], surplus: [], supplierReturns: [], inspections: [], total: 0 };
    const w = { receiving: L.records.filter(x => x.status === 'submitted'), surplus: L.surplus.filter(x => x.status === 'waiting'),
      supplierReturns: L.supplierReturns.filter(x => x.status === 'submitted'), inspections: L.inspections.filter(x => x.status === 'awaiting_inspection') };
    w.total = w.receiving.length + w.surplus.length + w.supplierReturns.length + w.inspections.length;
    return w;
  }
  function stock(L, sku) {
    const p = L && L.products && L.products[text(sku)];
    return p ? { sku: p.sku, available: p.available, damaged: p.damaged } : null;
  }
  // Re-adds every movement from the starting figures: the ledger must agree with itself.
  function reconcile(L, start) {
    if (!isLedger(L)) return { ok: false, problems: ['not a ledger'] };
    const out = [];
    Object.keys(L.products).forEach(sku => {
      const s0 = (start && start[sku]) || { available: 0, damaged: 0 };
      BUCKETS.forEach(b => {
        const sum = L.movements.filter(m => m.sku === sku && m.bucket === b).reduce((t, m) => t + m.change, s0[b] || 0);
        if (sum !== L.products[sku][b]) out.push(sku + ' ' + b + ': movements add up to ' + sum + ', stock says ' + L.products[sku][b]);
      });
    });
    return { ok: out.length === 0, problems: out };
  }

  // ---- the worked example ----------------------------------------------------
  const SKU = 'SYN-HONEY-8OZ';
  function fixtures() {
    return {
      products: [{ sku: SKU, name: 'Honey Milk lotion 8 oz (made-up)', available: 5, damaged: 0 }],
      purchaseOrders: [{ id: 'po-syn-20', number: 'SYN-PO-020', supplier: 'SYN Lotion Lab', lines: [{ sku: SKU, ordered: 20 }] }],
      sales: [{ id: 'so-syn-5', number: 'SYN-1005', customer: 'A made-up customer', lines: [{ sku: SKU, sold: 5 }] }],
    };
  }
  function workedExample() {
    const L = createLedger(fixtures());
    const start = { [SKU]: { available: 5, damaged: 0 } };
    const owner = { by: 'owner', role: 'owner' }, staff = { by: 'staff (made-up)', role: 'employee' };
    const steps = [];
    const snap = (title, res, kind, who) => {
      const po = poStatus(L, 'po-syn-20').lines[0], so = saleStatus(L, 'so-syn-5').lines[0], st = stock(L, SKU);
      steps.push({ n: steps.length, title: title, kind: kind, who: who || null, ok: res ? res.ok : true, duplicate: !!(res && res.duplicate), reason: res && !res.ok ? res.reason : (res && res.duplicate ? res.reason : null),
        movements: res ? res.movements.map(m => ({ bucket: m.bucket, change: m.change, before: m.before, after: m.after })) : [],
        poStatus: poStatus(L, 'po-syn-20').status, ordered: po.ordered, received: po.received, toCome: po.toCome, rejected: po.rejected, returnedToSupplier: po.returnedToSupplier,
        sold: so.sold, awaitingInspection: so.awaitingInspection, stillReturnable: so.stillReturnable, waiting: waiting(L).total, available: st.available, damaged: st.damaged });
      return res;
    };
    const at = (d) => '2026-11-' + d + 'Z';
    snap('Start: purchase order SYN-PO-020 for 20 jars; 5 already in stock; a customer bought 5 earlier', null, 'start');
    const s1 = { requestKey: 'k-rr-1', poId: 'po-syn-20', lines: [{ sku: SKU, good: 8 }], at: at('21T10:00:00'), ...staff };
    const rr1 = snap('First delivery: staff record 8 jars arriving', submitReceiving(L, s1), 'submit', 'staff');
    snap('The same record is sent again (double click, or a retry after a lost reply)', submitReceiving(L, Object.assign({}, s1, { at: at('21T10:00:05') })), 'duplicate', 'staff');
    snap('A staff member tries to approve it', approveReceiving(L, { recordId: rr1.id, at: at('21T10:01:00'), ...staff }), 'refused', 'staff');
    snap('You approve the first delivery', approveReceiving(L, { recordId: rr1.id, at: at('21T11:00:00'), ...owner }), 'approve', 'owner');
    const rr2 = snap('Second delivery: 12 arrive; staff record 9 good, 1 damaged that we keep, 2 rejected (leaking, sent back with the driver)',
      submitReceiving(L, { requestKey: 'k-rr-2', poId: 'po-syn-20', lines: [{ sku: SKU, good: 9, damaged: 1, rejected: 2, rejectReason: 'Leaking caps' }], at: at('24T09:00:00'), ...staff }), 'submit', 'staff');
    snap('You approve the second delivery: the 2 rejected jars are still to come', approveReceiving(L, { recordId: rr2.id, at: at('24T09:30:00'), ...owner }), 'approve', 'owner');
    snap('Someone tries to record 5 more good jars (only 2 are still to come)', submitReceiving(L, { requestKey: 'k-rr-3-wrong', poId: 'po-syn-20', lines: [{ sku: SKU, good: 5 }], at: at('26T09:00:00'), ...staff }), 'refused', 'staff');
    const rr3 = snap('Third delivery: 5 arrive; staff record the 2 replacements as good and 3 as surplus',
      submitReceiving(L, { requestKey: 'k-rr-3', poId: 'po-syn-20', lines: [{ sku: SKU, good: 2, surplus: 3 }], at: at('26T09:05:00'), ...staff }), 'submit', 'staff');
    snap('You approve the third delivery: the order is complete; the 3 surplus jars wait for you', approveReceiving(L, { recordId: rr3.id, at: at('26T10:00:00'), ...owner }), 'approve', 'owner');
    snap('You keep the 3 surplus jars', decideSurplus(L, { surplusId: L.surplus[0].id, decision: 'kept', note: 'Supplier will invoice them', at: at('26T10:05:00'), ...owner }), 'decide', 'owner');
    const sr1 = snap('Staff ask to send 3 jars back to the supplier (wrong scent on the labels), no replacement',
      submitSupplierReturn(L, { requestKey: 'k-sr-1', poId: 'po-syn-20', sku: SKU, quantity: 3, from: 'available', reason: 'Wrong scent printed on the labels', replacementExpected: false, at: at('27T11:00:00'), ...staff }), 'submit', 'staff');
    snap('You approve that return: the order stays complete', decideSupplierReturn(L, { returnId: sr1.id, decision: 'approved', at: at('27T11:10:00'), ...owner }), 'approve', 'owner');
    const sr2 = snap('Staff ask to send the damaged jar back, replacement expected',
      submitSupplierReturn(L, { requestKey: 'k-sr-2', poId: 'po-syn-20', sku: SKU, quantity: 1, from: 'damaged', reason: 'Dented jar, supplier sends a new one', replacementExpected: true, at: at('27T11:20:00'), ...staff }), 'submit', 'staff');
    snap('You approve it: 1 jar is to come again', decideSupplierReturn(L, { returnId: sr2.id, decision: 'approved', at: at('27T11:25:00'), ...owner }), 'approve', 'owner');
    const sr3 = snap('Someone asks to send back 18 more', submitSupplierReturn(L, { requestKey: 'k-sr-3', poId: 'po-syn-20', sku: SKU, quantity: 18, from: 'available', reason: 'Testing the limit', at: at('27T11:30:00'), ...staff }), 'submit', 'staff');
    snap('You try to approve it (only 16 received jars can still go back)', decideSupplierReturn(L, { returnId: sr3.id, decision: 'approved', at: at('27T11:31:00'), ...owner }), 'refused', 'owner');
    snap('You reject that request', decideSupplierReturn(L, { returnId: sr3.id, decision: 'rejected', note: 'Not possible', at: at('27T11:32:00'), ...owner }), 'decide', 'owner');
    const cr = { requestKey: 'k-cr-1', saleId: 'so-syn-5', sku: SKU, quantity: 3, reason: 'Did not like the scent', at: at('28T15:00:00'), ...staff };
    const ci1 = snap('The customer returns 3 of the 5 they bought: they wait for inspection, not for sale', recordCustomerReturn(L, cr), 'submit', 'staff');
    snap('The same return is recorded again', recordCustomerReturn(L, Object.assign({}, cr, { at: at('28T15:00:09') })), 'duplicate', 'staff');
    snap('You inspect them: 2 sealed go back to Available, 1 cracked goes to Damaged',
      decideCustomerReturn(L, { inspectionId: ci1.id, restock: 2, damaged: 1, unsuitable: 0, opened: false, used: false, at: at('28T16:00:00'), ...owner }), 'decide', 'owner');
    const ci2 = snap('The customer returns the other 2, opened and used', recordCustomerReturn(L, { requestKey: 'k-cr-2', saleId: 'so-syn-5', sku: SKU, quantity: 2, reason: 'Skin reaction', at: at('29T10:00:00'), ...staff }), 'submit', 'staff');
    snap('You try to restock them (opened or used skincare is never resold)',
      decideCustomerReturn(L, { inspectionId: ci2.id, restock: 2, damaged: 0, unsuitable: 0, opened: true, used: true, at: at('29T10:30:00'), ...owner }), 'refused', 'owner');
    snap('You record them as unsuitable: they go to Damaged',
      decideCustomerReturn(L, { inspectionId: ci2.id, restock: 0, damaged: 0, unsuitable: 2, opened: true, used: true, note: 'Dispose', at: at('29T10:31:00'), ...owner }), 'decide', 'owner');
    snap('Someone tries to take back 1 more (none of that sale is still out)', recordCustomerReturn(L, { requestKey: 'k-cr-3', saleId: 'so-syn-5', sku: SKU, quantity: 1, reason: 'Testing the limit', at: at('29T11:00:00'), ...staff }), 'refused', 'staff');
    const keptN = L.movements.find(m => m.source.kind === 'surplus_kept').n;
    snap('Correction: the 3 surplus jars went back with the driver after all; you correct that movement with a reason',
      correctMovement(L, { requestKey: 'k-sc-1', movementN: keptN, reason: 'Driver took the surplus back; supplier confirmed', at: at('30T09:00:00'), ...owner }), 'correct', 'owner');
    snap('You try to correct the same movement again', correctMovement(L, { requestKey: 'k-sc-2', movementN: keptN, reason: 'Second attempt', at: at('30T09:05:00'), ...owner }), 'refused', 'owner');
    return { sku: SKU, steps: steps, history: L.history.slice(), movements: L.movements.slice(), refusals: L.refusals.slice(), corrections: L.corrections.slice(),
      waiting: waiting(L).total, reconcile: reconcile(L, start), label: 'SIMULATED', livePath: LIVE_PATH };
  }

  return { VERSION: '2026-11-22', BUCKETS: BUCKETS, SUBMIT_ROLES: SUBMIT_ROLES, DECIDE_ROLES: DECIDE_ROLES, LIVE_PATH: LIVE_PATH,
    createLedger: createLedger, submitReceiving: submitReceiving, approveReceiving: approveReceiving, rejectReceiving: rejectReceiving, cancelReceiving: cancelReceiving,
    decideSurplus: decideSurplus, submitSupplierReturn: submitSupplierReturn, decideSupplierReturn: decideSupplierReturn,
    recordCustomerReturn: recordCustomerReturn, decideCustomerReturn: decideCustomerReturn, correctMovement: correctMovement,
    poStatus: poStatus, saleStatus: saleStatus, waiting: waiting, stock: stock, reconcile: reconcile, fixtures: fixtures, workedExample: workedExample };
}));
