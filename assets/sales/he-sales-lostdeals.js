// Sales & Growth — LOST DEAL analysis (pure, deterministic, local).
//
// Buckets lost opportunities by reason and reports trends by store type, source,
// territory and lead-score band. Advisory reporting only; a lost deal can be
// flagged for possible re-opening but nothing is contacted.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-lostdeals'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const REASONS = ['PRICE', 'MOQ', 'TIMING', 'NO_RESPONSE', 'PRODUCT_FIT', 'NOT_INTERESTED', 'OTHER', 'UNKNOWN'];

  function normReason(r) { const u = String(r || '').toUpperCase(); return REASONS.includes(u) ? u : 'UNKNOWN'; }

  function scoreBand(score) {
    if (score == null) return 'unknown';
    if (score >= 80) return 'high'; if (score >= 50) return 'medium'; return 'low';
  }

  function tally(deals, keyFn) {
    const out = {};
    for (const d of (deals || [])) { const k = keyFn(d) || '—'; out[k] = (out[k] || 0) + 1; }
    return out;
  }

  function analyze(deals) {
    const ds = (deals || []).map(d => ({ ...d, reason: normReason(d.reason), band: scoreBand(d.scoreValue != null ? d.scoreValue : (d.scoring && d.scoring.score)) }));
    const byReason = {}; for (const r of REASONS) byReason[r] = 0;
    for (const d of ds) byReason[d.reason]++;
    // Re-opening candidates: lost to TIMING or NO_RESPONSE with a decent score.
    const reopenCandidates = ds.filter(d => (d.reason === 'TIMING' || d.reason === 'NO_RESPONSE') && (d.band === 'high' || d.band === 'medium'));
    return {
      total: ds.length, byReason,
      byStoreType: tally(ds, d => d.storeType),
      bySource: tally(ds, d => d.source),
      byTerritory: tally(ds, d => d.state),
      byScoreBand: tally(ds, d => d.band),
      reopenCandidates,
      topReason: REASONS.slice().sort((a, b) => byReason[b] - byReason[a])[0] || 'UNKNOWN',
      guard: 'Advisory analysis only. Re-opening is a suggestion; nothing is contacted.',
    };
  }

  return { REASONS, normReason, scoreBand, analyze };
}));
