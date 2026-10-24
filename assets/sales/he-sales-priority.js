// Sales & Growth — PRIORITIZATION ENGINE v2 (pure, local, advisory).
//
// Ranks wholesale leads by an EXPLAINABLE weighted score and shows how stable
// that ranking is. Every score breaks down into per-factor contributions the
// owner can read ("value 0.30, fit 0.21, urgency 0.14 ..."), and a sensitivity
// pass answers "would the order change if I cared more/less about X?". This is
// decision support only: it sorts a list. It never contacts a lead, moves a
// deal, approves anything, or has any external side effect.
//
// Factors are each a 0..1 number. Two are "lower is better" (effort, risk): a
// high value there REDUCES priority, so their contribution uses (1 - value).
// Weights are relative; they are normalized to sum to 1 before scoring, so the
// total score is always in 0..1 and comparable across runs.
//
// Pure. Deterministic. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-priority'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Factor -> whether a higher raw value means higher priority (true) or lower
  // priority (false, "cost-like"). Order is the display order.
  const FACTORS = [
    { key: 'value', higherIsBetter: true, label: 'Account value' },
    { key: 'fit', higherIsBetter: true, label: 'Brand/product fit' },
    { key: 'urgency', higherIsBetter: true, label: 'Time urgency' },
    { key: 'momentum', higherIsBetter: true, label: 'Recent momentum' },
    { key: 'effort', higherIsBetter: false, label: 'Effort to close' },
    { key: 'risk', higherIsBetter: false, label: 'Deal/claim risk' },
  ];
  const FACTOR_KEYS = FACTORS.map(f => f.key);

  const DEFAULT_WEIGHTS = { value: 0.30, fit: 0.22, urgency: 0.18, momentum: 0.12, effort: 0.10, risk: 0.08 };

  function clamp01(n) { n = Number(n); if (!isFinite(n)) return 0; return n < 0 ? 0 : n > 1 ? 1 : n; }

  // Normalize a weights object to sum to 1 over the known factors. Missing
  // factors default to 0; an all-zero (or invalid) set falls back to equal
  // weights so scoring never divides by zero or silently drops everything.
  function normalizeWeights(weights) {
    const w = {};
    let sum = 0;
    for (const k of FACTOR_KEYS) { const v = Math.max(0, Number((weights || {})[k]) || 0); w[k] = v; sum += v; }
    if (sum <= 0) { for (const k of FACTOR_KEYS) w[k] = 1 / FACTOR_KEYS.length; return w; }
    for (const k of FACTOR_KEYS) w[k] = w[k] / sum;
    return w;
  }

  // Effective 0..1 contribution of a raw factor value, respecting direction.
  function effective(key, rawValue) {
    const f = FACTORS.find(x => x.key === key);
    const v = clamp01(rawValue);
    return f && f.higherIsBetter === false ? (1 - v) : v;
  }

  // Score one lead. Returns the total (0..1) and a readable per-factor
  // breakdown sorted by how much each factor pushed the score up.
  function score(lead, weights) {
    const w = normalizeWeights(weights);
    const factors = (lead && lead.factors) || {};
    const contributions = FACTORS.map(f => {
      const eff = effective(f.key, factors[f.key]);
      return { factor: f.key, label: f.label, raw: clamp01(factors[f.key]),
        higherIsBetter: f.higherIsBetter, weight: w[f.key], effective: eff,
        contribution: w[f.key] * eff };
    });
    const total = contributions.reduce((s, c) => s + c.contribution, 0);
    const sorted = contributions.slice().sort((a, b) => b.contribution - a.contribution);
    return { leadId: (lead && lead.id) || null, name: (lead && lead.name) || null,
      total, contributions, top: sorted.slice(0, 3).map(c => c.factor),
      explain: sorted.filter(c => c.contribution > 0)
        .map(c => `${c.label} ${c.contribution.toFixed(2)}`).join(', ') || 'no positive factors' };
  }

  // Rank a list of leads. Deterministic tie-break: higher total, then leadId
  // ascending, so the same input always yields the same order. Ranks are 1-based.
  //
  // A4 (Reserve IV Wave A): a repeated lead id is the SAME lead listed twice, so
  // it is ranked ONCE (first occurrence wins) rather than silently appearing
  // twice and inflating the count/ranking. Leads with no id cannot be
  // de-duplicated and are each kept. The number dropped is reported.
  function rank(leads, weights) {
    const seen = new Set();
    let duplicatesDropped = 0;
    const kept = [];
    for (const l of (leads || [])) {
      const id = l && l.id;
      if (id != null) {
        if (seen.has(id)) { duplicatesDropped++; continue; }
        seen.add(id);
      }
      kept.push(l);
    }
    const scored = kept.map(l => score(l, weights));
    scored.sort((a, b) => (b.total - a.total) || String(a.leadId).localeCompare(String(b.leadId)));
    scored.forEach((s, i) => { s.rank = i + 1; });
    return { weights: normalizeWeights(weights), ranked: scored, count: scored.length, duplicatesDropped,
      guard: 'Advisory ranking only — sorts a list; contacts no one and changes no deal.' };
  }

  // Sensitivity: shift ONE factor's weight by delta (relative, e.g. +0.5 =
  // +50%), renormalize, re-rank, and report how the order moved. A low
  // "churn" (few rank changes, small max move) means the ranking is robust to
  // that preference; a high churn means the order hinges on that factor.
  function sensitivity(leads, weights, opts) {
    const o = opts || {};
    const factor = o.factor;
    const delta = o.delta == null ? 0.5 : Number(o.delta);
    if (FACTOR_KEYS.indexOf(factor) < 0) throw new Error('sensitivity: unknown factor "' + factor + '"');
    const baseW = normalizeWeights(weights);
    const bumped = Object.assign({}, baseW);
    bumped[factor] = Math.max(0, baseW[factor] * (1 + delta));
    const before = rank(leads, baseW).ranked;
    const after = rank(leads, bumped).ranked;
    const afterRankById = {}; after.forEach(s => { afterRankById[s.leadId] = s.rank; });
    const moves = before.map(s => {
      const newRank = afterRankById[s.leadId];
      return { leadId: s.leadId, name: s.name, from: s.rank, to: newRank, move: s.rank - newRank };
    });
    const changed = moves.filter(m => m.move !== 0).length;
    const maxMove = moves.reduce((m, x) => Math.max(m, Math.abs(x.move)), 0);
    const topChanged = before.length ? before[0].leadId !== after[0].leadId : false;
    return { factor, delta, changed, maxMove, topChanged,
      stability: before.length ? 1 - (changed / before.length) : 1,
      moves: moves.filter(m => m.move !== 0).sort((a, b) => Math.abs(b.move) - Math.abs(a.move)),
      guard: 'What-if on preferences only. Re-sorts the same list; no side effects.' };
  }

  // Run sensitivity across every factor, so the owner sees which preference the
  // ranking is most fragile to.
  function sensitivityAll(leads, weights, delta) {
    const rows = FACTOR_KEYS.map(k => {
      const s = sensitivity(leads, weights, { factor: k, delta: delta == null ? 0.5 : delta });
      return { factor: k, changed: s.changed, maxMove: s.maxMove, topChanged: s.topChanged, stability: s.stability };
    });
    rows.sort((a, b) => (b.changed - a.changed) || (b.maxMove - a.maxMove));
    return { rows, mostInfluential: rows.length ? rows[0].factor : null,
      guard: 'What-if across all preference weights. No side effects.' };
  }

  return { FACTORS, FACTOR_KEYS, DEFAULT_WEIGHTS, normalizeWeights, effective,
    score, rank, sensitivity, sensitivityAll };
}));
