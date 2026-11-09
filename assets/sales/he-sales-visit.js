// In-person sample VISIT log (Phase 2 wholesale follow-on). A visit is a sample
// HAND-DELIVERED at a store, distinct from a SHIPPED sample (he-sales-samples):
// stock is consumed on the spot and the visit carries an outcome. Records stock
// consumed, sample cost (never fabricated when a unit cost is unknown) and the
// outcome, and is idempotent by a visit key so an interrupted retry never
// double-counts. Pure, synthetic, advisory — it NEVER sends, and never writes
// production stock (the missing safe write contract is named).
//
// Pure. Dual-mode (Node require + browser HE.sales registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-visit'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VISIT_OUTCOMES = ['PENDING', 'ORDERED', 'FOLLOW_UP', 'DECLINED'];
  // How a visit outcome maps onto the shipped-sample lifecycle states, so a
  // visit can advance the sample book consistently (advisory; never auto-applied).
  const OUTCOME_TO_SAMPLE_STATE = { ORDERED: 'CONVERTED', DECLINED: 'NO_ORDER', FOLLOW_UP: 'FOLLOW_UP_DUE', PENDING: 'RECEIVED' };
  const MISSING_WRITE_CONTRACT = 'adjust_inventory (R4) — a safe hand-delivered-sample stock decrement; not in the local build (this visit log is advisory/read-only).';

  const money = (c) => Math.round(c) / 100;

  function createVisitLog() {
    const seen = new Set();
    const visits = [];
    return {
      // Record one in-person visit. Idempotent by key (store|date|kit by default).
      record: function (v) {
        const i = v || {};
        const key = String(i.key || ([i.store, i.date, i.kitId].join('|')));
        if (seen.has(key)) return { ok: false, duplicate: true, reason: 'visit already recorded (no double-count)', key: key };
        const jars = Math.max(0, Number(i.jars) || 0);
        const hasCost = i.unitCost != null;
        const sampleCost = hasCost ? money(Math.round((Number(i.unitCost) || 0) * 100) * jars) : null;
        const outcome = VISIT_OUTCOMES.indexOf(i.outcome) !== -1 ? i.outcome : 'PENDING';
        const rec = {
          key: key, store: i.store || null, date: i.date || null, by: i.by || null,
          jars: jars, sampleCost: sampleCost, costBasis: hasCost ? 'ACTUAL' : 'UNKNOWN',
          outcome: outcome, suggestedSampleState: OUTCOME_TO_SAMPLE_STATE[outcome],
          synthetic: true, label: 'SIMULATED',
        };
        seen.add(key); visits.push(rec);
        return { ok: true, visit: rec };
      },
      all: function () { return visits.slice(); },
      stockConsumed: function () { return visits.reduce(function (n, v) { return n + v.jars; }, 0); },
      totalCost: function () {
        let known = 0, unknownCount = 0;
        visits.forEach(function (v) { if (v.sampleCost == null) unknownCount += 1; else known += Math.round(v.sampleCost * 100); });
        return { known: money(known), unknownCount: unknownCount, costBasis: unknownCount ? 'PARTIAL/UNKNOWN' : 'ACTUAL' };
      },
      outcomes: function () { const o = {}; VISIT_OUTCOMES.forEach(function (k) { o[k] = 0; }); visits.forEach(function (v) { o[v.outcome] += 1; }); return o; },
      contract: MISSING_WRITE_CONTRACT,
    };
  }

  return { VISIT_OUTCOMES, OUTCOME_TO_SAMPLE_STATE, MISSING_WRITE_CONTRACT, createVisitLog };
}));
