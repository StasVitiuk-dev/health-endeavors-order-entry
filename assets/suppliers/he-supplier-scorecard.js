// #12/#53 Supplier scorecard + document validation. Pure, synthetic, READ-ONLY.
// Derives, from data the dashboard ALREADY holds, a read-only view of a
// supplier's delivery accuracy (from their purchase orders) and document status
// (from documents linked to them). It invents no supplier data: it reports only
// what the passed records support, and marks anything unprovable UNKNOWN.
//
// Schema reconciliation (fields the suppliers table does NOT have, so these are
// DERIVED or assumed — documented so the gap is explicit, per #12/#53):
//   * suppliers: id, name, supplier_type, contact_name, email, phone, is_active
//     — no delivery-accuracy fields -> delivery is derived from purchase orders.
//   * purchase orders carry expected_date and (when received) received_date/
//     status -> on-time vs late. A PO missing either date is UNKNOWN timing,
//     never counted as on-time.
//   * documents link to a supplier and carry expires_at -> present/expiring/
//     expired. There is NO per-supplier "required documents" field, so the
//     required set is an EXPLICIT, caller-supplied assumption (default below).
//
// Pure. Dual-mode (Node require + browser HE.suppliers registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.suppliers = root.HE.suppliers || {})['he-supplier-scorecard'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Documented assumption: the document types a supplier is expected to have on
  // file. No schema field encodes this, so the caller can override it.
  const DEFAULT_REQUIRED_DOCS = ['insurance', 'w9', 'coa']; // coa = certificate of analysis
  const EXPIRING_SOON_DAYS = 30;
  const MISSING_FIELDS = [
    'suppliers.on_time_delivery (derived from purchase orders here)',
    'suppliers.required_documents (assumed via DEFAULT_REQUIRED_DOCS)',
    'purchase_orders.received_date (used when present; UNKNOWN timing otherwise)',
  ];

  const day = 86400000;
  function daysBetween(a, b) { const ta = Date.parse(a), tb = Date.parse(b); return (isFinite(ta) && isFinite(tb)) ? Math.round((tb - ta) / day) : null; }
  function pct(n, d) { return d > 0 ? Math.round((n / d) * 1000) / 10 : null; }

  // Delivery accuracy from a supplier's purchase orders. On-time = received on or
  // before the expected date. Missing dates -> UNKNOWN timing (never on-time).
  function deliveryScore(supplier, purchaseOrders) {
    const sid = supplier && supplier.id;
    const pos = (Array.isArray(purchaseOrders) ? purchaseOrders : []).filter(p => p && p.supplier_id === sid);
    const received = pos.filter(p => p.status === 'received' || p.received_date);
    let onTime = 0, late = 0, unknownTiming = 0, totalLateDays = 0, lateCount = 0;
    received.forEach(p => {
      const d = (p.received_date && p.expected_date) ? daysBetween(p.expected_date, p.received_date) : null;
      if (d == null) { unknownTiming += 1; return; }
      if (d <= 0) onTime += 1; else { late += 1; totalLateDays += d; lateCount += 1; }
    });
    const scored = onTime + late; // POs with a known timing
    return {
      supplierId: sid, totalPOs: pos.length, receivedPOs: received.length,
      onTime: onTime, late: late, unknownTiming: unknownTiming,
      onTimeRate: pct(onTime, scored), onTimeRateBasis: scored ? 'ACTUAL' : 'UNKNOWN',
      avgDaysLate: lateCount ? Math.round((totalLateDays / lateCount) * 10) / 10 : null,
      open: pos.filter(p => p.status !== 'received' && !p.received_date).length,
      label: 'SIMULATED',
    };
  }

  // Document status for a supplier against an explicit required-doc set.
  function documentStatus(supplier, documents, requiredTypes, asOfDate) {
    const sid = supplier && supplier.id;
    const required = (Array.isArray(requiredTypes) && requiredTypes.length) ? requiredTypes : DEFAULT_REQUIRED_DOCS;
    const asOf = asOfDate || null;
    const mine = (Array.isArray(documents) ? documents : []).filter(d => d && d.supplier_id === sid);
    const rows = required.map(type => {
      const doc = mine.find(d => String(d.doc_type).toLowerCase() === String(type).toLowerCase());
      if (!doc) return { type: type, status: 'MISSING', expiresAt: null };
      if (!doc.expires_at) return { type: type, status: 'PRESENT_NO_EXPIRY', expiresAt: null };
      const left = asOf ? daysBetween(asOf, doc.expires_at) : null;
      let status = 'VALID';
      if (left != null) { if (left < 0) status = 'EXPIRED'; else if (left <= EXPIRING_SOON_DAYS) status = 'EXPIRING_SOON'; }
      return { type: type, status: status, expiresAt: doc.expires_at, daysLeft: left };
    });
    const flags = rows.filter(r => r.status === 'MISSING' || r.status === 'EXPIRED' || r.status === 'EXPIRING_SOON');
    return { supplierId: sid, required: required, rows: rows, flags: flags, flagCount: flags.length,
      allClear: flags.length === 0, label: 'SIMULATED' };
  }

  function scorecard(supplier, purchaseOrders, documents, opts) {
    const o = opts || {};
    const delivery = deliveryScore(supplier, purchaseOrders);
    const docs = documentStatus(supplier, documents, o.requiredTypes, o.asOfDate);
    // Overall attention if delivery is poor (a known rate under threshold) or any
    // document flag exists. UNKNOWN delivery is surfaced, not treated as good.
    const threshold = typeof o.onTimeThreshold === 'number' ? o.onTimeThreshold : 90;
    const deliveryConcern = delivery.onTimeRate != null && delivery.onTimeRate < threshold;
    return {
      supplier: { id: supplier && supplier.id, name: supplier && supplier.name },
      delivery: delivery, documents: docs,
      needsAttention: deliveryConcern || !docs.allClear,
      reasons: [].concat(deliveryConcern ? ['on-time rate ' + delivery.onTimeRate + '% < ' + threshold + '%'] : [],
        docs.flags.map(f => 'document ' + f.type + ': ' + f.status)),
      readOnly: true, synthetic: true, label: 'SIMULATED',
    };
  }

  function fixtures() {
    return {
      supplier: { id: 'SUP-1', name: 'SYN Glass & Jars Co', supplier_type: 'manufacturer', is_active: true },
      purchaseOrders: [
        { id: 'PO-1', supplier_id: 'SUP-1', status: 'received', expected_date: '2026-09-01', received_date: '2026-09-01' }, // on time
        { id: 'PO-2', supplier_id: 'SUP-1', status: 'received', expected_date: '2026-09-15', received_date: '2026-09-20' }, // 5 late
        { id: 'PO-3', supplier_id: 'SUP-1', status: 'received', expected_date: '2026-10-01' },                              // received, unknown timing
        { id: 'PO-4', supplier_id: 'SUP-1', status: 'shipped', expected_date: '2026-11-20' },                              // open
        { id: 'PO-X', supplier_id: 'SUP-2', status: 'received', expected_date: '2026-09-01', received_date: '2026-09-01' },// other supplier
      ],
      documents: [
        { supplier_id: 'SUP-1', doc_type: 'insurance', expires_at: '2027-06-01' },     // valid
        { supplier_id: 'SUP-1', doc_type: 'w9', expires_at: '2026-11-20' },            // expiring soon (vs asOf 2026-11-14)
        // coa missing -> flagged
      ],
      asOfDate: '2026-11-14',
    };
  }

  return { DEFAULT_REQUIRED_DOCS, EXPIRING_SOON_DAYS, MISSING_FIELDS, deliveryScore, documentStatus, scorecard, fixtures };
}));
