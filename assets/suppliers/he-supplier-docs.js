// Supplier document checklist (owner decision of Nov 16). Pure, synthetic,
// READ-ONLY: it reports which documents a supplier should have on file, which
// are missing and which are waiting for review. It stores nothing, contacts
// nobody and invents no document.
//
// The checklist is CONFIGURABLE: it is plain data (DEFAULT_CHECKLIST below) and
// every function takes a replacement. A supplier gets
//   * the purchase documents, for each of their purchase orders, where they
//     apply to the stage the order has reached, and
//   * the documents of each "document profile" the supplier has. A profile
//     follows from the supplier type unless the supplier names its own
//     (documentProfiles), so one supplier can be, say, bottles AND printing.
//
//   purchases          quote or order confirmation · supplier invoice · packing slip
//   lotion lab         approved ingredient list per formula · batch or lot
//                      record per batch · certificate of analysis per batch
//   bottles and pumps  component specification per component
//   labels / printing  approved artwork and printer proof per artwork
//
// A document only counts when it was REVIEWED: marked approved, with who
// approved it and when. One that has merely arrived is AWAITING REVIEW.
//
// Storage: the existing `documents` table knows a supplier and a fixed category,
// not a purchase order, a batch or a review, so these documents get their own
// tables in docs/ops/sql/drafts/36 (not installed; needs the owner's approval).
// he-supplier-docs-store.js reads them into the shapes this file takes. Until
// storage is installed and switched on, the screen runs on fixtures().
//
// Pure. Dual-mode (Node require + browser HE.suppliers registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.suppliers = root.HE.suppliers || {})['he-supplier-docs'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATUSES = ['MISSING', 'REJECTED', 'EXPIRED', 'AWAITING_REVIEW', 'APPROVED'];
  const ROLES_MAY_REVIEW = ['owner', 'administrator', 'manager'];   // a manager since Nov 25 (owner decision), never for their own document

  // per: what one copy of the document belongs to.
  // stages (purchase documents only): the purchase-order stages at which the
  // document is expected. An order that has not reached one of them does not
  // need it yet ("where applicable").
  const DEFAULT_CHECKLIST = Object.freeze({
    purchase: Object.freeze([
      Object.freeze({ key: 'quote_or_order_confirmation', label: 'Quote or order confirmation', per: 'purchase', stages: Object.freeze(['ordered', 'shipped', 'received']) }),
      Object.freeze({ key: 'supplier_invoice', label: 'Supplier invoice', per: 'purchase', stages: Object.freeze(['shipped', 'received']), alsoWhenPaid: true }),
      Object.freeze({ key: 'packing_slip', label: 'Packing slip', per: 'purchase', stages: Object.freeze(['received']) }),
    ]),
    profiles: Object.freeze({
      lotion_lab: Object.freeze({ label: 'Lotion lab', documents: Object.freeze([
        Object.freeze({ key: 'approved_ingredient_list', label: 'Approved ingredient list', per: 'formula' }),
        Object.freeze({ key: 'batch_record', label: 'Batch or lot record', per: 'batch' }),
        Object.freeze({ key: 'certificate_of_analysis', label: 'Certificate of analysis', per: 'batch' }),
      ]) }),
      bottles_pumps: Object.freeze({ label: 'Bottles and pumps', documents: Object.freeze([
        Object.freeze({ key: 'component_specification', label: 'Component specification', per: 'component' }),
      ]) }),
      labels_printing: Object.freeze({ label: 'Printed labels or direct bottle printing', documents: Object.freeze([
        Object.freeze({ key: 'approved_artwork', label: 'Approved artwork', per: 'artwork' }),
        Object.freeze({ key: 'printer_proof', label: 'Printer proof', per: 'artwork' }),
      ]) }),
    }),
    // Which profiles a supplier type gets when the supplier names none itself.
    // The supplier types are the ones the suppliers table allows.
    profilesByType: Object.freeze({
      lab: Object.freeze(['lotion_lab']),
      packaging: Object.freeze(['bottles_pumps']),
      manufacturer: Object.freeze([]), supplier: Object.freeze([]), freight: Object.freeze([]), other: Object.freeze([]),
    }),
  });

  const text = (v) => (v == null ? '' : String(v)).trim();
  const list = (v) => (Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object'; }) : []);
  const dayOf = (v) => { const s = text(v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
  const sameId = (a, b) => a != null && b != null && String(a) === String(b);

  // A checklist is usable only if every entry has a key, a label and a subject.
  function checkChecklist(checklist) {
    const c = checklist; const problems = [];
    const PER = ['purchase', 'formula', 'batch', 'component', 'artwork', 'supplier'];
    if (!c || typeof c !== 'object') return ['the checklist is missing'];
    const seen = {};
    const one = function (d, where) {
      if (!d || !text(d.key) || !text(d.label)) { problems.push(where + ': a document needs a key and a label'); return; }
      if (PER.indexOf(d.per) < 0) problems.push(where + ' "' + d.key + '": unknown subject "' + d.per + '"');
      if (seen[d.key]) problems.push('the document key "' + d.key + '" is used twice');
      seen[d.key] = true;
    };
    if (!Array.isArray(c.purchase)) problems.push('the purchase documents are not a list');
    else c.purchase.forEach(function (d) { one(d, 'purchase'); if (d && !Array.isArray(d.stages)) problems.push('purchase "' + (d.key || '?') + '": the stages are not a list'); });
    const profiles = (c.profiles && typeof c.profiles === 'object') ? c.profiles : null;
    if (!profiles) problems.push('the profiles are missing');
    else Object.keys(profiles).forEach(function (k) {
      const p = profiles[k];
      if (!p || !Array.isArray(p.documents)) { problems.push('profile "' + k + '" has no document list'); return; }
      p.documents.forEach(function (d) { one(d, 'profile ' + k); });
    });
    const byType = (c.profilesByType && typeof c.profilesByType === 'object') ? c.profilesByType : {};
    Object.keys(byType).forEach(function (t) {
      (Array.isArray(byType[t]) ? byType[t] : []).forEach(function (k) { if (!profiles || !profiles[k]) problems.push('supplier type "' + t + '" names an unknown profile "' + k + '"'); });
    });
    return problems;
  }

  // The profiles of one supplier: its own list when it has one, else by type.
  function profilesFor(supplier, checklist) {
    const c = checklist || DEFAULT_CHECKLIST; const s = supplier || {};
    const known = (c.profiles && typeof c.profiles === 'object') ? c.profiles : {};
    const own = Array.isArray(s.documentProfiles) ? s.documentProfiles : null;
    const byType = (c.profilesByType && c.profilesByType[text(s.supplier_type)]) || [];
    const out = [];
    (own || byType).forEach(function (k) { if (known[k] && out.indexOf(k) < 0) out.push(k); });
    return out;
  }

  // Does this purchase document apply to this order yet?
  function purchaseDocApplies(doc, po) {
    const status = text(po && po.status).toLowerCase();
    if (!status || status === 'draft' || status === 'cancelled' || (po && po.deleted_at)) return false;
    if ((doc.stages || []).indexOf(status) >= 0) return true;
    const paid = text(po && po.payment_status).toLowerCase();
    return doc.alsoWhenPaid === true && (paid === 'partial' || paid === 'paid');
  }

  // Everything one supplier should have, one line per document and subject.
  //   context: { purchaseOrders, formulas, batches, components, artworks }
  //   each subject row names its supplier with supplier_id (or supplierId).
  function requirementsFor(supplier, context, checklist) {
    const c = checklist || DEFAULT_CHECKLIST; const ctx = context || {}; const s = supplier || {};
    const mine = function (rows) { return list(rows).filter(function (r) { return sameId(r.supplier_id != null ? r.supplier_id : r.supplierId, s.id); }); };
    const out = [];
    const add = function (doc, group, subjectKind, subjectId, subjectLabel) {
      out.push({ key: doc.key, label: doc.label, group: group, per: doc.per, subjectKind: subjectKind,
        subjectId: subjectId == null ? null : String(subjectId), subjectLabel: subjectLabel });
    };
    mine(ctx.purchaseOrders).forEach(function (po) {
      list(c.purchase).forEach(function (doc) {
        if (purchaseDocApplies(doc, po)) add(doc, 'Purchases', 'purchase', po.id, 'Purchase order ' + (text(po.po_number) || text(po.id)));
      });
    });
    const SUBJECTS = { formula: ['formulas', 'Formula'], batch: ['batches', 'Batch'], component: ['components', 'Component'], artwork: ['artworks', 'Artwork'] };
    profilesFor(s, c).forEach(function (pk) {
      const profile = c.profiles[pk];
      list(profile.documents).forEach(function (doc) {
        if (doc.per === 'supplier') { add(doc, profile.label, 'supplier', s.id, text(s.name) || 'This supplier'); return; }
        const sub = SUBJECTS[doc.per]; if (!sub) return;
        mine(ctx[sub[0]]).forEach(function (row) {
          const id = row.id != null ? row.id : (row.lot_number != null ? row.lot_number : row.name);
          add(doc, profile.label, doc.per, id, sub[1] + ' ' + (text(row.lot_number) || text(row.name) || text(row.sku) || text(id)));
        });
      });
    });
    return out;
  }

  // The state of one document on file.
  //   document: { supplier_id, kind, subjectKind, subjectId, status, receivedAt,
  //               reviewedBy, reviewedAt, expiresOn, reviewNote }
  function documentState(doc, asOf) {
    const d = doc || {};
    const status = text(d.status).toLowerCase();
    if (status === 'rejected') return 'REJECTED';
    const reviewed = status === 'approved' && text(d.reviewedBy) && text(d.reviewedAt);
    if (!reviewed) return 'AWAITING_REVIEW';              // arrived, or "approved" with nobody's name on it
    const expires = dayOf(d.expiresOn); const on = dayOf(asOf);
    if (d.expiresOn != null && !expires) return 'AWAITING_REVIEW';   // an expiry date that cannot be read is not trusted
    if (expires && on && expires < on) return 'EXPIRED';
    return 'APPROVED';
  }

  // One supplier's checklist, with what is on file for each line.
  function supplierChecklist(supplier, context, documents, opts) {
    const o = opts || {}; const c = o.checklist || DEFAULT_CHECKLIST; const s = supplier || {};
    const problems = checkChecklist(c);
    if (problems.length) return { ok: false, reason: 'the checklist cannot be used: ' + problems.join('; '), supplier: { id: s.id == null ? null : s.id, name: text(s.name) }, rows: [], problems: problems };
    const docs = list(documents).filter(function (d) { return sameId(d.supplier_id != null ? d.supplier_id : d.supplierId, s.id); });
    const rank = { APPROVED: 4, AWAITING_REVIEW: 3, EXPIRED: 2, REJECTED: 1 };
    const rows = requirementsFor(s, context, c).map(function (req) {
      let best = null; let bestState = 'MISSING';
      docs.forEach(function (d) {
        if (text(d.kind) !== req.key || text(d.subjectKind) !== req.subjectKind || !sameId(d.subjectId, req.subjectId)) return;
        const st = documentState(d, o.asOf);
        if (!best || rank[st] > rank[bestState]) { best = d; bestState = st; }
      });
      return Object.assign({}, req, {
        status: bestState,
        reviewedBy: best && bestState === 'APPROVED' ? text(best.reviewedBy) : null,
        reviewedAt: best && bestState === 'APPROVED' ? text(best.reviewedAt) : null,
        receivedAt: best ? (text(best.receivedAt) || null) : null,
        expiresOn: best ? (dayOf(best.expiresOn) || null) : null,
        note: best ? (text(best.reviewNote) || null) : null,
        // the stored document behind this line (null for example data and missing lines)
        documentId: best && best.id != null ? String(best.id) : null,
        recordedBy: best ? (text(best.recordedBy) || null) : null,
        reference: best ? (text(best.reference) || null) : null,
      });
    });
    const count = function (st) { return rows.filter(function (r) { return r.status === st; }).length; };
    // A rejected or expired document has to be replaced, so it counts as missing work.
    const missing = count('MISSING') + count('REJECTED') + count('EXPIRED');
    const awaiting = count('AWAITING_REVIEW');
    return {
      ok: true, supplier: { id: s.id == null ? null : s.id, name: text(s.name), supplierType: text(s.supplier_type) || null },
      profiles: profilesFor(s, c).map(function (k) { return { key: k, label: c.profiles[k].label }; }),
      rows: rows, total: rows.length, approved: count('APPROVED'), missing: missing, awaitingReview: awaiting,
      counts: { MISSING: count('MISSING'), REJECTED: count('REJECTED'), EXPIRED: count('EXPIRED'), AWAITING_REVIEW: awaiting, APPROVED: count('APPROVED') },
      needsAttention: missing > 0 || awaiting > 0,
      readOnly: true, synthetic: true, label: 'SIMULATED',
    };
  }

  // Every supplier, most work first.
  function overview(suppliers, context, documents, opts) {
    const all = list(suppliers).map(function (s) { return supplierChecklist(s, context, documents, opts); });
    const usable = all.filter(function (x) { return x.ok; });
    usable.sort(function (a, b) { return (b.missing - a.missing) || (b.awaitingReview - a.awaitingReview) || a.supplier.name.localeCompare(b.supplier.name); });
    return {
      ok: all.every(function (x) { return x.ok; }), reason: (all.find(function (x) { return !x.ok; }) || {}).reason || null,
      suppliers: usable,
      totals: { suppliers: usable.length, documents: usable.reduce(function (n, x) { return n + x.total; }, 0),
        missing: usable.reduce(function (n, x) { return n + x.missing; }, 0),
        awaitingReview: usable.reduce(function (n, x) { return n + x.awaitingReview; }, 0),
        approved: usable.reduce(function (n, x) { return n + x.approved; }, 0) },
      readOnly: true, synthetic: true, label: 'SIMULATED',
    };
  }

  // Review one document that has arrived. Pure: returns a new document.
  //   who: { role, by, at }   decision: 'approved' | 'rejected'
  function reviewDocument(doc, decision, who) {
    const w = who || {}; const d = doc;
    if (!d || typeof d !== 'object') return { ok: false, reason: 'no document', document: d || null };
    if (ROLES_MAY_REVIEW.indexOf(w.role) < 0) return { ok: false, reason: 'only the owner, an administrator or a manager may review a supplier document', document: d };
    if (w.role === 'manager' && text(d.recordedBy) && text(d.recordedBy) === text(w.by)) return { ok: false, reason: 'a manager does not review a document they recorded themselves', document: d };
    if (decision !== 'approved' && decision !== 'rejected') return { ok: false, reason: 'a review is either approved or rejected', document: d };
    if (!text(w.by) || !text(w.at)) return { ok: false, reason: 'a review records who reviewed it and when', document: d };
    const note = text(w.note).slice(0, 500);
    if (decision === 'rejected' && note.length < 5) return { ok: false, reason: 'say why the document is rejected', document: d };
    const state = documentState(d);
    if (state === 'APPROVED' || state === 'REJECTED') return { ok: false, reason: 'this document was already reviewed', duplicate: true, document: d };
    return { ok: true, document: Object.assign({}, d, { status: decision, reviewedBy: text(w.by), reviewedAt: text(w.at), reviewNote: note || null }) };
  }

  // Example data: a lotion lab, a bottle-and-pump supplier that also prints
  // directly on bottles, and a label printer. All made up.
  function fixtures() {
    return {
      asOf: '2026-11-16',
      suppliers: [
        { id: 'SUP-LAB', name: 'SYN Lotion Lab', supplier_type: 'lab', is_active: true },
        { id: 'SUP-BOT', name: 'SYN Bottles & Pumps Co', supplier_type: 'packaging', is_active: true, documentProfiles: ['bottles_pumps', 'labels_printing'] },
        { id: 'SUP-LBL', name: 'SYN Label Printer', supplier_type: 'other', is_active: true, documentProfiles: ['labels_printing'] },
      ],
      context: {
        purchaseOrders: [
          { id: 'PO-LAB-1', po_number: 'SYN-PO-101', supplier_id: 'SUP-LAB', status: 'received', payment_status: 'paid' },
          { id: 'PO-LAB-2', po_number: 'SYN-PO-104', supplier_id: 'SUP-LAB', status: 'ordered', payment_status: 'unpaid' },
          { id: 'PO-BOT-1', po_number: 'SYN-PO-102', supplier_id: 'SUP-BOT', status: 'shipped', payment_status: 'unpaid' },
          { id: 'PO-LBL-1', po_number: 'SYN-PO-103', supplier_id: 'SUP-LBL', status: 'draft', payment_status: 'unpaid' },
        ],
        formulas: [{ id: 'F-HONEY', name: 'Honey Milk', supplier_id: 'SUP-LAB' }, { id: 'F-VEGAN', name: 'Vegan', supplier_id: 'SUP-LAB' }],
        batches: [{ id: 'B-204', lot_number: 'LOT-204', supplier_id: 'SUP-LAB' }, { id: 'B-205', lot_number: 'LOT-205', supplier_id: 'SUP-LAB' }],
        components: [{ id: 'C-BOTTLE-8', name: '8 oz bottle', supplier_id: 'SUP-BOT' }, { id: 'C-PUMP-24', name: '24-410 pump', supplier_id: 'SUP-BOT' }],
        artworks: [{ id: 'A-HONEY-V3', name: 'Honey Milk label v3', supplier_id: 'SUP-LBL' }, { id: 'A-BOTTLE-V1', name: 'Direct print v1', supplier_id: 'SUP-BOT' }],
      },
      documents: [
        // Lotion lab
        { supplier_id: 'SUP-LAB', kind: 'quote_or_order_confirmation', subjectKind: 'purchase', subjectId: 'PO-LAB-1', status: 'approved', reviewedBy: 'owner (example)', reviewedAt: '2026-10-02', receivedAt: '2026-10-01' },
        { supplier_id: 'SUP-LAB', kind: 'supplier_invoice', subjectKind: 'purchase', subjectId: 'PO-LAB-1', status: 'approved', reviewedBy: 'owner (example)', reviewedAt: '2026-10-20', receivedAt: '2026-10-19' },
        { supplier_id: 'SUP-LAB', kind: 'packing_slip', subjectKind: 'purchase', subjectId: 'PO-LAB-1', status: 'received', receivedAt: '2026-10-21' },
        { supplier_id: 'SUP-LAB', kind: 'approved_ingredient_list', subjectKind: 'formula', subjectId: 'F-HONEY', status: 'approved', reviewedBy: 'owner (example)', reviewedAt: '2026-09-15', receivedAt: '2026-09-10' },
        { supplier_id: 'SUP-LAB', kind: 'batch_record', subjectKind: 'batch', subjectId: 'B-204', status: 'approved', reviewedBy: 'owner (example)', reviewedAt: '2026-10-22', receivedAt: '2026-10-21' },
        { supplier_id: 'SUP-LAB', kind: 'certificate_of_analysis', subjectKind: 'batch', subjectId: 'B-204', status: 'approved', reviewedBy: 'owner (example)', reviewedAt: '2026-10-22', receivedAt: '2026-10-21' },
        { supplier_id: 'SUP-LAB', kind: 'certificate_of_analysis', subjectKind: 'batch', subjectId: 'B-205', status: 'received', receivedAt: '2026-11-12' },
        // Bottles and pumps (also prints directly on bottles)
        { supplier_id: 'SUP-BOT', kind: 'quote_or_order_confirmation', subjectKind: 'purchase', subjectId: 'PO-BOT-1', status: 'approved', reviewedBy: 'owner (example)', reviewedAt: '2026-11-03', receivedAt: '2026-11-02' },
        { supplier_id: 'SUP-BOT', kind: 'component_specification', subjectKind: 'component', subjectId: 'C-BOTTLE-8', status: 'approved', reviewedBy: 'owner (example)', reviewedAt: '2026-08-01', receivedAt: '2026-07-30' },
        { supplier_id: 'SUP-BOT', kind: 'component_specification', subjectKind: 'component', subjectId: 'C-PUMP-24', status: 'rejected', reviewedBy: 'owner (example)', reviewedAt: '2026-11-05', receivedAt: '2026-11-04', reviewNote: 'Wrong neck size on the drawing' },
        { supplier_id: 'SUP-BOT', kind: 'approved_artwork', subjectKind: 'artwork', subjectId: 'A-BOTTLE-V1', status: 'received', receivedAt: '2026-11-10' },
        // Label printer
        { supplier_id: 'SUP-LBL', kind: 'approved_artwork', subjectKind: 'artwork', subjectId: 'A-HONEY-V3', status: 'approved', reviewedBy: 'owner (example)', reviewedAt: '2026-10-28', receivedAt: '2026-10-27' },
      ],
    };
  }

  return { STATUSES, ROLES_MAY_REVIEW, DEFAULT_CHECKLIST, checkChecklist, profilesFor, purchaseDocApplies, requirementsFor, documentState, supplierChecklist, overview, reviewDocument, fixtures };
}));
