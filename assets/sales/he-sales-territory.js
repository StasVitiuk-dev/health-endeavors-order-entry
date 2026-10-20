// Sales & Growth — TERRITORY & EXPANSION analysis (pure, deterministic, local).
//
// Aggregates leads/customers by geography (state / city / region), scores each
// territory's quality and coverage, and flags white-space (good prospects, thin
// coverage) and low-coverage regions. It makes NO exclusivity promises and takes
// no action — it is an advisory map of where attention could go.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-territory'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Rough US region grouping by state code (advisory; unknown states -> OTHER).
  const REGION = {
    West: ['CA', 'OR', 'WA', 'NV', 'AZ', 'ID', 'MT', 'WY', 'UT', 'CO', 'AK', 'HI', 'NM'],
    Midwest: ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
    South: ['TX', 'OK', 'AR', 'LA', 'MS', 'AL', 'TN', 'KY', 'GA', 'FL', 'SC', 'NC', 'VA', 'WV', 'MD', 'DE', 'DC'],
    Northeast: ['NY', 'NJ', 'PA', 'CT', 'RI', 'MA', 'VT', 'NH', 'ME'],
  };
  const STATE_REGION = (() => { const m = {}; for (const [reg, sts] of Object.entries(REGION)) for (const s of sts) m[s] = reg; return m; })();
  function regionOf(state) { return STATE_REGION[String(state || '').toUpperCase()] || 'OTHER'; }

  // Aggregate rows (leads with optional scoring + a won flag) by a key function.
  function aggregateBy(rows, keyFn) {
    const out = {};
    for (const r of (rows || [])) {
      const key = keyFn(r) || '—';
      const g = out[key] || (out[key] = { key, prospects: 0, qualified: 0, won: 0, scoreSum: 0, scored: 0 });
      g.prospects++;
      if (r.scoring && r.scoring.serious) g.qualified++;
      if (r.won || r.pipelineState === 'CUSTOMER') g.won++;
      if (r.scoring && typeof r.scoring.score === 'number') { g.scoreSum += r.scoring.score; g.scored++; }
    }
    return Object.values(out).map(g => ({
      key: g.key, prospects: g.prospects, qualified: g.qualified, won: g.won,
      avgScore: g.scored ? Math.round(g.scoreSum / g.scored) : null,
      avgScoreLabel: g.scored ? 'ESTIMATED' : 'UNKNOWN',
      // Coverage = won customers per qualified prospect; white-space = quality high, coverage low.
      coverage: g.qualified ? +(g.won / g.qualified).toFixed(2) : null,
    })).sort((a, b) => b.prospects - a.prospects);
  }

  function byState(rows) { return aggregateBy(rows, r => r.state); }
  function byCity(rows) { return aggregateBy(rows, r => [r.city, r.state].filter(Boolean).join(', ')); }
  function byRegion(rows) { return aggregateBy(rows, r => regionOf(r.state)); }

  // Territory score: quality (avg score) weighted down by existing coverage, so a
  // high-quality, low-coverage territory ranks as white-space. Explainable.
  function score(t) {
    const quality = t.avgScore == null ? 0 : t.avgScore;        // 0..100
    const cov = t.coverage == null ? 0 : Math.min(t.coverage, 1); // 0..1
    const whitespace = Math.round(quality * (1 - cov));          // high when good + uncovered
    const reasons = [];
    if (t.avgScore == null) reasons.push('no scored prospects yet (UNKNOWN quality)');
    else reasons.push(`avg prospect score ${t.avgScore}`);
    reasons.push(t.won ? `${t.won} customer(s) already` : 'no customers yet');
    reasons.push(`${t.qualified} qualified of ${t.prospects} prospects`);
    return { ...t, whitespaceScore: whitespace, whitespaceLabel: t.avgScore == null ? 'UNKNOWN' : 'ESTIMATED', reasons };
  }

  function whitespace(rows, level) {
    const agg = (level === 'city' ? byCity : level === 'region' ? byRegion : byState)(rows).map(score);
    return agg.filter(t => t.qualified >= 1).sort((a, b) => b.whitespaceScore - a.whitespaceScore);
  }

  function analyze(rows) {
    return {
      byState: byState(rows).map(score),
      byRegion: byRegion(rows).map(score),
      topWhitespace: whitespace(rows, 'state').slice(0, 10),
      totalProspects: (rows || []).length,
      guard: 'Advisory geography only. No exclusivity is promised or enforced.',
    };
  }

  return { REGION, regionOf, aggregateBy, byState, byCity, byRegion, score, whitespace, analyze };
}));
