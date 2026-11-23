// Sales & Growth — COMMERCIAL + LINE-SHEET + release READINESS (pure, local).
//
// Tracks the commercial facts a real wholesale deal needs (price, MOQ, MSRP,
// terms, claims, certs, legal, contact channel), reports each as APPROVED /
// MISSING / UNVERIFIED / CONFLICTING / OWNER_DECISION / LEGAL_REVIEW, and rolls
// them up into a line-sheet readiness status (BLOCKED / DRAFT_READY /
// OWNER_REVIEW / READY_FOR_EXPORT) that can never reach a ready state while a
// required fact is missing. Also a Sales Readiness Center status roll-up.
// Advisory only; it sets no prices and exports nothing.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-readiness'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FACT_STATES = ['APPROVED', 'MISSING', 'UNVERIFIED', 'CONFLICTING', 'OWNER_DECISION', 'LEGAL_REVIEW'];
  // The commercial facts required before a line sheet can be final-ready.
  const REQUIRED = ['wholesalePrice', 'moq', 'shippingTerms', 'paymentTerms', 'approvedClaims', 'lineSheet', 'legalStatus'];
  const OPTIONAL = ['msrp', 'size', 'certifications', 'samplePolicy', 'contactChannel'];
  const LABELS = {
    wholesalePrice: 'Wholesale price', moq: 'Minimum order (MOQ)', msrp: 'MSRP', size: 'Size',
    shippingTerms: 'Shipping terms', paymentTerms: 'Payment terms', approvedClaims: 'Approved claims',
    certifications: 'Certifications', samplePolicy: 'Sample policy', lineSheet: 'Line sheet',
    legalStatus: 'Legal review', contactChannel: 'Contact channel',
  };

  // Normalize one fact into a state. A value present + verified -> APPROVED;
  // present + unverified flag -> UNVERIFIED; two conflicting sources ->
  // CONFLICTING; legal field pending -> LEGAL_REVIEW; absent -> MISSING.
  function factState(key, fact) {
    if (fact == null || fact === '' || fact.value == null || fact.value === '') return 'MISSING';
    if (fact.conflicting) return 'CONFLICTING';
    if (key === 'legalStatus' && fact.value !== 'approved') return 'LEGAL_REVIEW';
    if (fact.ownerDecision) return 'OWNER_DECISION';
    if (fact.verified === false) return 'UNVERIFIED';
    return 'APPROVED';
  }

  function commercial(facts) {
    const f = facts || {};
    const all = REQUIRED.concat(OPTIONAL);
    const rows = all.map(k => ({ key: k, label: LABELS[k] || k, required: REQUIRED.includes(k), state: factState(k, f[k]) }));
    const byState = {}; for (const s of FACT_STATES) byState[s] = 0;
    for (const r of rows) byState[r.state]++;
    const missingRequired = rows.filter(r => r.required && r.state !== 'APPROVED');
    return { rows, byState, missingRequired, guard: 'Advisory. No price or term is set here; the owner/legal supply these.' };
  }

  // Line-sheet readiness: BLOCKED unless every required fact is APPROVED; then
  // DRAFT_READY -> OWNER_REVIEW -> READY_FOR_EXPORT as the owner advances it.
  function lineSheet(facts, stage) {
    const c = commercial(facts);
    if (c.missingRequired.length) return { status: 'BLOCKED', blockers: c.missingRequired.map(r => r.label), reason: 'required commercial facts are not all APPROVED' };
    const s = stage || 'DRAFT_READY';
    const order = ['DRAFT_READY', 'OWNER_REVIEW', 'READY_FOR_EXPORT'];
    const status = order.includes(s) ? s : 'DRAFT_READY';
    return { status, blockers: [], reason: 'all required facts APPROVED; ' + status };
  }

  // Sales Readiness Center: overall statuses the owner reviews before go-live.
  function center(state) {
    const s = state || {};
    const rows = [
      { item: 'Local engine + pages', status: 'LOCAL READY' },
      { item: 'Owner decisions (price/MOQ/claims/caps)', status: s.ownerDecisionsDone ? 'LOCAL READY' : 'OWNER DECISION' },
      { item: 'Sales Gmail + send', status: 'GMAIL REQUIRED' },
      { item: 'Website integration', status: 'WEBSITE REQUIRED' },
      { item: 'Legal review of claims/terms', status: s.legalDone ? 'LOCAL READY' : 'LEGAL REQUIRED' },
      { item: 'Production database', status: 'PRODUCTION DB REQUIRED' },
      { item: 'Merge to main', status: 'MERGE REQUIRED' },
      { item: 'Deploy (GitHub Pages)', status: 'DEPLOY REQUIRED' },
    ];
    return { rows, guard: 'Nothing is auto-advanced; each non-local step is an explicit owner/external action.' };
  }

  return { FACT_STATES, REQUIRED, OPTIONAL, LABELS, factState, commercial, lineSheet, center };
}));
