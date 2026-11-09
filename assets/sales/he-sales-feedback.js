// Sales & Growth — FEEDBACK analysis + human routing (pure, synthetic).
//
// Builds on he-sales-reviews (classification, dedupe, permission+claim gating,
// source-as-data) and adds the W-3 pieces it does not cover:
//   * ROUTE-TO-HUMAN: packaging, quality and safety concerns are escalated to a
//     person with a reason — never auto-resolved, never auto-replied.
//   * CONFLICT: contradictory feedback about the same product/theme (e.g. "leaks"
//     vs "great seal") is surfaced, not silently averaged away.
//   * DUPLICATES: same product + same text collapses (reuses reviews.reviewKey).
//   * PII GUARD: private details in source text (email, phone, street address,
//     card-like numbers) are detected; a testimonial draft that still contains
//     PII is BLOCKED, and the review view shows a redacted copy.
//   * TESTIMONIAL DRAFT: publishable only with provenance (a known review id +
//     source) AND permission === 'granted' AND approved wording (claim firewall
//     clean) AND no PII. Owner approval is still required downstream; nothing is
//     ever published or sent here.
//
// Pure. Dual-mode (Node require + browser HE.sales registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-feedback'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Themes that must reach a human. Safety first, then quality, then packaging.
  const ROUTE_TO_HUMAN = ['safety', 'quality', 'packaging', 'leaking'];
  // Themes where opposite sentiments are a genuine contradiction worth flagging.
  const CONFLICT_THEMES = ['leaking', 'pump', 'quality', 'scent', 'texture', 'packaging'];

  // PII detectors. Deterministic, conservative: better to over-flag and make a
  // human look than to leak a customer's details into a testimonial.
  const PII_RULES = [
    ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
    ['phone', /(?:\+?\d[\s().-]?){10,}/],
    ['card', /\b(?:\d[ -]?){13,16}\b/],
    ['address', /\b\d{1,5}\s+[A-Za-z0-9.\s]{3,}\b(?:street|st|avenue|ave|road|rd|lane|ln|blvd|boulevard|drive|dr|court|ct)\b/i],
  ];

  function findPII(text) {
    const s = String(text == null ? '' : text);
    const found = [];
    for (const [kind, re] of PII_RULES) if (re.test(s)) found.push(kind);
    return found;
  }

  // Redact detected PII for display. Never mutates the stored source.
  function redactPII(text) {
    let s = String(text == null ? '' : text);
    for (const [kind, re] of PII_RULES) s = s.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), '[' + kind + ' redacted]');
    return s;
  }

  // Route one classified review to a human when it carries a routed theme.
  // `classify` is he-sales-reviews.classifyReview (injected so this stays pure).
  function routeOne(classified) {
    const c = classified || {};
    const reasons = (c.themes || []).filter(t => ROUTE_TO_HUMAN.indexOf(t) !== -1);
    return { id: c.id || null, product: c.product || 'unknown', toHuman: reasons.length > 0,
      routeReasons: reasons, urgent: !!c.urgent, sentiment: c.sentiment || 'unknown',
      pii: findPII(c.source), label: 'SIMULATED' };
  }

  // Analyze a batch. reviewsApi = he-sales-reviews (for classifyReview/reviewKey).
  function analyze(reviews, reviewsApi) {
    if (!reviewsApi || typeof reviewsApi.classifyReview !== 'function') throw new Error('he-sales-feedback: inject he-sales-reviews');
    const seen = new Map(); // key -> first classified
    let duplicates = 0;
    const classified = [];
    (reviews || []).forEach(function (r) {
      const key = reviewsApi.reviewKey(r);
      if (seen.has(key)) { duplicates += 1; return; }
      const c = reviewsApi.classifyReview(r);
      seen.set(key, c); classified.push(c);
    });
    const routed = classified.map(routeOne);
    const toHuman = routed.filter(x => x.toHuman);
    const withPII = routed.filter(x => x.pii.length > 0);

    // Conflicts: same product + same theme carrying both positive and negative.
    const conflicts = [];
    const byProductTheme = {};
    classified.forEach(c => (c.themes || []).forEach(t => {
      if (CONFLICT_THEMES.indexOf(t) === -1) return;
      const k = c.product + '|' + t;
      (byProductTheme[k] = byProductTheme[k] || new Set()).add(c.sentiment);
    }));
    for (const [k, set] of Object.entries(byProductTheme)) {
      if (set.has('positive') && set.has('negative')) {
        const [product, theme] = k.split('|');
        conflicts.push({ product, theme, sentiments: Array.from(set) });
      }
    }
    return {
      count: classified.length, duplicatesCollapsed: duplicates,
      toHuman: toHuman, toHumanCount: toHuman.length,
      conflicts: conflicts, piiFlagged: withPII,
      note: 'SIMULATED — routed to a human for decision; nothing auto-replied or published.',
      label: 'SIMULATED',
    };
  }

  // A testimonial draft from a review. Publishable only with provenance +
  // permission granted + approved wording (claims clean) + no PII. Never sends.
  function testimonialDraft(review, reviewsApi, claims) {
    if (!reviewsApi || typeof reviewsApi.classifyReview !== 'function') throw new Error('he-sales-feedback: inject he-sales-reviews');
    if (!claims || typeof claims.scan !== 'function') throw new Error('he-sales-feedback: inject he-sales-claims');
    const r = review || {};
    const c = reviewsApi.classifyReview(r);
    const blockers = [];
    // provenance: a known review id + a source must exist.
    const hasProvenance = !!(r.id && (r.source || r.text));
    if (!hasProvenance) blockers.push('missing provenance (review id + source)');
    if (c.permission !== 'granted') blockers.push('permission not granted');
    const claimScan = claims.scan(String(r.text == null ? '' : r.text));
    if (!claimScan.ok) blockers.push('prohibited claim in wording');
    const pii = findPII(r.text);
    if (pii.length) blockers.push('contains private details: ' + pii.join(', '));
    const publishable = blockers.length === 0;
    return {
      reviewId: r.id || null, product: c.product,
      provenance: hasProvenance ? { reviewId: r.id, source: r.source || 'review text', permission: c.permission } : null,
      display: redactPII(String(r.text == null ? '' : r.text)),
      claimFindings: claimScan.findings, pii: pii,
      status: publishable ? 'READY_FOR_OWNER_APPROVAL' : 'BLOCKED', blockers: blockers,
      publishable: publishable, published: false, sent: false, synthetic: true, label: 'SIMULATED',
    };
  }

  function fixtures() {
    return [
      { id: 'SYN-R1', product: 'Shea Body Butter', rating: 5, permission: 'granted', text: 'Absolutely love this — reorder every month.' },
      { id: 'SYN-R2', product: 'Shea Body Butter', rating: 1, permission: 'unknown', text: 'The jar arrived leaking and the lid was cracked.' },
      { id: 'SYN-R3', product: 'Shea Body Butter', rating: 5, permission: 'granted', text: 'Great seal, nothing leaked in transit.' }, // conflicts with R2 on leaking
      { id: 'SYN-R4', product: 'Sea Foam', rating: 2, permission: 'granted', text: 'Gave me a rash — call me at 555-123-4567.' }, // safety + PII
      { id: 'SYN-R5', product: 'Shea Body Butter', rating: 5, permission: 'granted', text: 'Absolutely love this — reorder every month.' }, // duplicate of R1
      { id: 'SYN-R6', product: 'Sea Foam', rating: 5, permission: 'granted', text: 'This cured my eczema!' }, // unsupported claim
    ];
  }

  return { ROUTE_TO_HUMAN, CONFLICT_THEMES, PII_RULES, findPII, redactPII, routeOne, analyze, testimonialDraft, fixtures };
}));
