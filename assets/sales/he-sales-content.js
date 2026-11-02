// Sales & Growth — CONTENT opportunities (pure, synthetic, draft-only, claim-safe).
//
// Models content ideas (SEO, FAQ, blog, newsletter, social, creator, product
// copy) as items that move through a guarded status flow. A claim firewall check
// is injected (the real he-sales-claims scanner); an item with an unsafe claim is
// BLOCKED and can never reach APPROVED/SCHEDULED. Nothing is ever published —
// "scheduled" here means a local concept the owner would schedule by hand.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-content'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TYPES = ['seo', 'faq', 'blog', 'newsletter', 'social', 'creator', 'product_copy'];
  const STATUSES = ['IDEA', 'DRAFT', 'OWNER_REVIEW', 'LEGAL_REVIEW', 'APPROVED', 'BLOCKED', 'SCHEDULED'];
  // Legal, explainable status transitions. BLOCKED is terminal until re-drafted.
  const NEXT = {
    IDEA: ['DRAFT', 'BLOCKED'],
    DRAFT: ['OWNER_REVIEW', 'LEGAL_REVIEW', 'BLOCKED', 'IDEA'],
    OWNER_REVIEW: ['APPROVED', 'LEGAL_REVIEW', 'DRAFT', 'BLOCKED'],
    LEGAL_REVIEW: ['APPROVED', 'DRAFT', 'BLOCKED'],
    APPROVED: ['SCHEDULED', 'DRAFT'],
    SCHEDULED: ['APPROVED'],
    BLOCKED: ['DRAFT', 'IDEA'],
  };

  function opportunity(type, topic, opts) {
    const o = opts || {};
    if (!TYPES.includes(type)) throw new Error('unknown content type: ' + type);
    return { type, topic: String(topic || ''), status: 'IDEA',
      claimStatus: 'UNCHECKED', claimFindings: [],
      sourceFacts: o.sourceFacts || [], provider: o.provider || 'template',
      estCost: o.estCost == null ? null : o.estCost, version: 1,
      body: o.body || '', approval: 'OWNER_INPUT_REQUIRED', synthetic: true };
  }

  // Run the injected claim scanner over topic + body. A scanner is a function
  // returning { safe, findings }. If none is provided, claimStatus stays UNCHECKED
  // and the item cannot be approved (fails closed).
  function checkClaims(item, scan) {
    const text = (item.topic + '\n' + (item.body || '')).trim();
    if (typeof scan !== 'function') return { ...item, claimStatus: 'UNCHECKED', claimFindings: [] };
    const r = scan(text) || {};
    const findings = r.findings || [];
    const safe = r.safe != null ? r.safe : findings.length === 0;
    return { ...item, claimStatus: safe ? 'SAFE' : 'BLOCKED', claimFindings: findings,
      status: safe ? item.status : 'BLOCKED' };
  }

  // Guarded transition. APPROVED requires a SAFE claim check AND owner approval;
  // SCHEDULED requires APPROVED. Illegal moves throw.
  function advance(item, to, opts) {
    const o = opts || {};
    const allowed = NEXT[item.status] || [];
    if (!allowed.includes(to)) throw new Error(`illegal content transition ${item.status} -> ${to}`);
    if ((to === 'APPROVED') && item.claimStatus !== 'SAFE') throw new Error('cannot APPROVE content with claims unchecked or blocked');
    if ((to === 'APPROVED') && o.ownerApproved !== true) throw new Error('APPROVED requires owner approval');
    if (to === 'SCHEDULED' && item.status !== 'APPROVED') throw new Error('cannot SCHEDULE content before it is APPROVED');
    return { ...item, status: to, approval: to === 'APPROVED' || to === 'SCHEDULED' ? 'APPROVED' : item.approval,
      version: to === 'DRAFT' ? item.version + 1 : item.version };
  }

  // Group items for the content calendar view.
  function calendar(items) {
    const cols = {}; for (const s of STATUSES) cols[s] = [];
    for (const it of (items || [])) (cols[it.status] || (cols[it.status] = [])).push(it);
    const counts = {}; for (const s of STATUSES) counts[s] = cols[s].length;
    return { columns: cols, counts, total: (items || []).length,
      guard: 'Local planning only. Nothing is published; "scheduled" is a concept the owner schedules by hand.' };
  }

  // Fact provenance for a factual statement in content.
  function factProvenance(fact) {
    const f = fact || {};
    const status = f.status || 'UNVERIFIED';
    return { text: f.text || '', source: f.source || null, status,
      confidence: f.confidence || (status === 'APPROVED' ? 'HIGH' : 'UNKNOWN') };
  }

  // Synthetic ideas, including one with an unsafe therapeutic claim to prove
  // the firewall blocks it.
  function fixtures() {
    return [
      opportunity('seo', 'How wholesale buyers choose a body-care line', { sourceFacts: [{ text: 'cold-pressed oils', status: 'APPROVED', source: 'owner' }] }),
      opportunity('faq', 'What is your wholesale MOQ and lead time?'),
      opportunity('blog', 'Seasonal skincare gift sets for boutiques'),
      opportunity('newsletter', 'Monthly new-stockist spotlight'),
      opportunity('social', 'Behind the scenes: small-batch body butter'),
      opportunity('creator', 'Partner with a skincare micro-creator (gifting, no claims)'),
      opportunity('product_copy', 'Line-sheet copy for the shea body balm'),
      opportunity('blog', 'This balm cures eczema and treats inflammation', { body: 'cures eczema, treats inflammation' }), // must BLOCK
    ];
  }

  return { TYPES, STATUSES, NEXT, opportunity, checkClaims, advance, calendar, factProvenance, fixtures };
}));
