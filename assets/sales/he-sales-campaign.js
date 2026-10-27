// Sales & Growth — CAMPAIGN LAB + outreach-volume simulation (pure, synthetic).
//
// A workspace for comparing outreach *variants* (subject line, CTA, length,
// tone, segment, angle) and for simulating outreach volume. Everything is a
// labelled SIMULATION: no message is produced for sending and nothing is sent.
// Quality / personalization scores are deterministic; claim warnings come from
// an injected claim scanner so an unsafe variant is flagged, never hidden.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-campaign'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VARIANT_KINDS = ['subject', 'cta', 'length', 'tone', 'segment', 'creator_angle', 'newsletter_angle'];

  // Deterministic readability-ish quality: rewards a sensible length and a single
  // clear call-to-action, penalizes ALL CAPS and exclamation spam. 0..100.
  function qualityScore(text) {
    const t = String(text || '');
    if (!t.trim()) return 0;
    const words = t.trim().split(/\s+/).length;
    let s = 70;
    if (words < 3) s -= 30; else if (words > 120) s -= 25; else if (words >= 20 && words <= 90) s += 10;
    const caps = (t.match(/\b[A-Z]{3,}\b/g) || []).length; s -= Math.min(caps * 5, 20);
    const bangs = (t.match(/!/g) || []).length; s -= Math.min(bangs * 5, 15);
    if (/\b(unsubscribe|opt[- ]?out)\b/i.test(t)) s += 5; // honest footer
    return Math.max(0, Math.min(100, s));
  }

  // Personalization: presence of real merge tokens / lead-specific references,
  // not generic "Dear buyer". Deterministic. 0..100.
  function personalizationScore(text) {
    const t = String(text || '');
    let s = 0;
    const tokens = (t.match(/\{\{[a-z_]+\}\}/gi) || []).length; s += Math.min(tokens * 25, 60);
    if (/\b(store|shop|boutique|spa|salon)\b/i.test(t)) s += 15;
    if (/\b(your|you)\b/i.test(t)) s += 15;
    if (/\bDear (buyer|owner|team)\b/i.test(t)) s -= 20; // generic
    return Math.max(0, Math.min(100, s));
  }

  function variant(kind, text, scan, opts) {
    const o = opts || {};
    if (!VARIANT_KINDS.includes(kind)) throw new Error('unknown variant kind: ' + kind);
    const claim = typeof scan === 'function' ? (scan(text) || {}) : { findings: [] };
    const warnings = (claim.findings || []).length;
    return { kind, text: String(text || ''), qualityScore: qualityScore(text),
      personalizationScore: personalizationScore(text), claimWarnings: warnings,
      claimSafe: warnings === 0, estCost: o.estCost == null ? null : o.estCost,
      ownerChoice: false, label: 'SIMULATION', synthetic: true };
  }

  // Compare variants: safe ones first, then by quality + personalization.
  function compare(variants) {
    const scored = (variants || []).map(v => ({ ...v, combined: (v.claimSafe ? 1000 : 0) + v.qualityScore + v.personalizationScore }));
    scored.sort((a, b) => b.combined - a.combined);
    return { ranked: scored, best: scored[0] || null,
      guard: 'Simulation only. No variant is sent; the owner picks and sends by hand.' };
  }

  // Simulate a day's outreach at a given volume. All outputs are projections
  // (ESTIMATE/SIMULATION), with safe rounding; costs use a synthetic rate.
  function simulateVolume(opts) {
    const o = opts || {};
    const perDay = Math.max(0, Math.round(o.perDay || 0));
    const replyRate = o.replyRate == null ? 0.15 : o.replyRate;      // synthetic default
    const interestRate = o.interestRate == null ? 0.25 : o.interestRate; // of replies
    const draftMinutes = o.ownerMinutesPerDraft == null ? 2 : o.ownerMinutesPerDraft;
    const costPerDraft = o.costPerDraft == null ? 0.01 : o.costPerDraft; // synthetic $
    const replies = Math.round(perDay * replyRate);
    const interested = Math.round(replies * interestRate);
    const followUps = Math.round(perDay * 0.4);                       // spaced follow-ups
    const samplePressure = Math.round(interested * 0.5);              // some ask for samples
    return { perDay, replies, interested, followUps, samplePressure,
      ownerMinutes: Math.round((perDay + replies) * draftMinutes),
      estCost: +(perDay * costPerDraft).toFixed(2), costLabel: 'ESTIMATE', label: 'SIMULATION' };
  }

  function volumeTable(options) {
    const opts = options || [5, 10, 25, 50, 100];
    return opts.map(n => simulateVolume({ perDay: n }));
  }

  return { VARIANT_KINDS, qualityScore, personalizationScore, variant, compare, simulateVolume, volumeTable };
}));
