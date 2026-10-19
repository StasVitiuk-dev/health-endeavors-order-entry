// Sales & Growth — PROVIDER matrices: cost, fallback, latency, chaos (synthetic).
//
// Describes AI providers as configurable FAKE entries (no credentials, no
// network) so the owner can compare cost/capability and reason about fallback
// and failure behaviour before ever enabling a real one. Deterministic.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-providers'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Synthetic providers. `configured:false` for paid ones — must stay owner-gated.
  // Costs are per-1k-token placeholders the owner edits later.
  const PROVIDERS = [
    { id: 'template', tier: 'deterministic', configured: true, inPer1k: 0, outPer1k: 0, typicalLatencyMs: 2, note: 'free deterministic templates' },
    { id: 'cheap', tier: 'cheap', configured: false, inPer1k: 0.0003, outPer1k: 0.0006, typicalLatencyMs: 600, note: 'placeholder cheap model (owner enables)' },
    { id: 'strong', tier: 'strong', configured: false, inPer1k: 0.003, outPer1k: 0.015, typicalLatencyMs: 1500, note: 'placeholder strong model (owner enables)' },
  ];

  function byId(id) { return PROVIDERS.find(p => p.id === id) || null; }

  function estimateCost(providerId, inTokens, outTokens) {
    const p = byId(providerId);
    if (!p) return { cost: null, label: 'UNKNOWN' };
    const cost = (inTokens / 1000) * p.inPer1k + (outTokens / 1000) * p.outPer1k;
    return { provider: providerId, cost: +cost.toFixed(5), configured: p.configured, label: p.configured ? 'ESTIMATED' : 'ESTIMATED (provider not enabled)' };
  }

  // Cost matrix for a representative workload across providers.
  function costMatrix(inTokens, outTokens) {
    return PROVIDERS.map(p => ({ provider: p.id, tier: p.tier, configured: p.configured, ...estimateCost(p.id, inTokens || 500, outTokens || 300) }));
  }

  // Fallback chain: ordered list, skipping unconfigured, always ending at the
  // free deterministic provider so there is always a safe floor.
  function fallbackChain(preferred) {
    const want = (preferred || ['strong', 'cheap', 'template']);
    const chain = want.filter(id => { const p = byId(id); return p && (p.configured || id === 'template'); });
    if (!chain.includes('template')) chain.push('template');
    return chain;
  }

  // Simulate a provider failure sweep: for each provider, what the chain falls
  // back to if it is unavailable. No real calls.
  function chaos(preferred) {
    const chain = (preferred || ['strong', 'cheap', 'template']);
    return chain.map((id, i) => ({ down: id, fallsBackTo: fallbackChain(chain.slice(i + 1))[0] || 'template' }));
  }

  // Latency matrix (typical synthetic latency per provider).
  function latencyMatrix() { return PROVIDERS.map(p => ({ provider: p.id, typicalLatencyMs: p.typicalLatencyMs })); }

  return { PROVIDERS, byId, estimateCost, costMatrix, fallbackChain, chaos, latencyMatrix };
}));
