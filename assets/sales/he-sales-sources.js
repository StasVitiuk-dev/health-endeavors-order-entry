// Sales & Growth — LEAD SOURCE + STORE-TYPE performance (pure, local, advisory).
//
// Compares lead sources (manual/website/referral/search/creator/event/social)
// and store types (spa/boutique/salon/…) on quality, reply/interest/conversion
// and cost. Safe denominators: an unknown or zero-base rate reads UNKNOWN, never
// a fake 0%. Reporting only.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-sources'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function rate(n, d) { return (d == null || d <= 0) ? null : +(n / d).toFixed(3); }
  function label(v) { return v == null ? 'UNKNOWN' : 'ESTIMATED'; }

  // Aggregate lead records by a key. Each lead may carry: replied, interested,
  // converted (customer), sampleUsed (bool), cost (number), scoring.score.
  function aggregate(leads, keyFn) {
    const g = {};
    for (const l of (leads || [])) {
      const k = keyFn(l) || 'unknown';
      const row = g[k] || (g[k] = { key: k, leads: 0, replied: 0, interested: 0, converted: 0, samples: 0, costSum: 0, scoreSum: 0, scored: 0 });
      row.leads++;
      if (l.replied) row.replied++;
      if (l.interested) row.interested++;
      if (l.converted || l.pipelineState === 'CUSTOMER') row.converted++;
      if (l.sampleUsed) row.samples++;
      if (typeof l.cost === 'number') row.costSum += l.cost;
      const sc = l.scoring && l.scoring.score;
      if (typeof sc === 'number') { row.scoreSum += sc; row.scored++; }
    }
    return Object.values(g).map(r => ({
      key: r.key, leads: r.leads,
      avgScore: r.scored ? Math.round(r.scoreSum / r.scored) : null, avgScoreLabel: label(r.scored ? 1 : null),
      replyRate: rate(r.replied, r.leads), replyLabel: label(rate(r.replied, r.leads)),
      interestRate: rate(r.interested, r.replied), interestLabel: label(rate(r.interested, r.replied)),
      conversionRate: rate(r.converted, r.leads), conversionLabel: label(rate(r.converted, r.leads)),
      sampleUseRate: rate(r.samples, r.leads),
      costPerLead: r.costSum > 0 ? +(r.costSum / r.leads).toFixed(2) : null,
      costPerCustomer: (r.costSum > 0 && r.converted > 0) ? +(r.costSum / r.converted).toFixed(2) : null,
    })).sort((a, b) => b.leads - a.leads);
  }

  function bySource(leads) { return aggregate(leads, l => l.source); }
  function byStoreType(leads) { return aggregate(leads, l => l.storeType || l.category); }

  function analyze(leads) {
    return { bySource: bySource(leads), byStoreType: byStoreType(leads),
      guard: 'Reporting only; unknown/zero-base rates read UNKNOWN, never a fake 0%.' };
  }

  return { rate, aggregate, bySource, byStoreType, analyze };
}));
