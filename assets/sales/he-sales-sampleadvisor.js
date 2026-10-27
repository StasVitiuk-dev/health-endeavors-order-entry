// Sales & Growth — SAMPLE candidate ranking + fraud/abuse watcher (pure, local).
//
// Ranks sample candidates by fit and likely value, and flags possible sample
// abuse (repeated requests, shared domain/contact, business aliases, suspicious
// frequency). Advisory only: the owner still approves every sample, and nothing
// is reserved or shipped. Complements he-sales-samples (which holds the approval
// state machine and budget guard).
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-sampleadvisor'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Candidate score 0..100 from serious-prospect signals. Explainable.
  function candidateScore(c) {
    let s = 0; const r = [];
    const fit = (c.scoring && c.scoring.score) || c.fit || 0;
    s += Math.round(fit * 0.4); r.push('fit ' + fit);
    if (c.replyQuality === 'strong') { s += 20; r.push('strong reply'); } else if (c.replyQuality === 'ok') s += 10;
    if (c.likelyOrderSize === 'large') { s += 20; r.push('large likely order'); } else if (c.likelyOrderSize === 'medium') s += 10;
    if (c.locations >= 3) { s += 10; r.push(c.locations + ' locations'); }
    if (c.priorSamples >= 1) { s -= 15; r.push('already sampled ' + c.priorSamples + 'x'); }
    return { score: Math.max(0, Math.min(100, s)), reasons: r };
  }

  function rank(candidates, budgetRemaining) {
    const scored = (candidates || []).map(c => ({ id: c.id, storeName: c.storeName, ...candidateScore(c),
      withinBudget: budgetRemaining == null ? null : (budgetRemaining > 0) }));
    scored.sort((a, b) => b.score - a.score);
    return { ranked: scored, budgetRemaining: budgetRemaining == null ? null : budgetRemaining,
      guard: 'Ranking is advisory. The owner approves every sample; nothing is reserved or shipped.' };
  }

  // Fraud/abuse watcher: group requests and flag suspicious patterns.
  function fraudScan(requests, opts) {
    const o = opts || {};
    const maxPerDomain = o.maxPerDomain == null ? 2 : o.maxPerDomain;
    const byDomain = {}, byContact = {}, flags = [];
    const norm = s => String(s || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    for (const r of (requests || [])) {
      const dom = norm(r.website || (r.email || '').split('@')[1]);
      const contact = String(r.email || '').toLowerCase();
      if (dom) (byDomain[dom] = byDomain[dom] || []).push(r.id);
      if (contact) (byContact[contact] = byContact[contact] || []).push(r.id);
    }
    for (const [dom, ids] of Object.entries(byDomain)) if (ids.length > maxPerDomain) flags.push({ kind: 'repeated-domain', severity: 'WARNING', detail: ids.length + ' sample requests from domain ' + dom, ids });
    for (const [c, ids] of Object.entries(byContact)) if (ids.length > 1) flags.push({ kind: 'repeated-contact', severity: 'WARNING', detail: ids.length + ' requests from ' + c, ids });
    // business aliases: same domain but different store names
    for (const [dom, ids] of Object.entries(byDomain)) {
      const names = new Set((requests || []).filter(r => ids.includes(r.id)).map(r => String(r.storeName || '').toLowerCase().trim()));
      if (names.size > 1) flags.push({ kind: 'possible-alias', severity: 'INFO', detail: 'domain ' + dom + ' used by ' + names.size + ' different names', ids });
    }
    return { flags, total: flags.length, guard: 'Advisory. Flags are for a human; no request is auto-denied or approved.' };
  }

  return { candidateScore, rank, fraudScan };
}));
