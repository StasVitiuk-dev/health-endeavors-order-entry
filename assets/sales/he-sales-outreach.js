// Sales & Growth — outreach draft builder (DRAFT ONLY, never sends).
//
// Ties together the provider-neutral drafter, the claim firewall and FACT
// PROVENANCE. A draft may use ONLY facts the owner has marked APPROVED; an
// UNKNOWN / UNVERIFIED / HISTORICAL / CONFLICTING fact is never stated as
// definitive. Prohibited claims block the draft (fail closed). A lead must also
// clear a minimum qualification score before it is even eligible for a draft
// (owner-overridable). Every draft records the facts it used, their sources and
// statuses, the provider, a version and an edit history.
//
// Deterministic orchestration (the only AI is whatever drafter you inject; the
// default template drafter is free). Pure. Dual-mode (Node require + browser).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE && root.HE.modules) root.HE.modules.define('he-sales-outreach', { api: 1, needs: [] }, function () { return api; });
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FACT_STATUSES = ['APPROVED', 'UNVERIFIED', 'HISTORICAL', 'CONFLICTING', 'UNKNOWN'];
  const DEFAULT_MIN_SCORE = 45; // "warm" or better; owner-overridable

  // Which APPROVED facts each draft kind needs before it can be built at all.
  const REQUIRED_FACTS = {
    intro: ['productName'],
    followup: ['productName'],
    reply_interested: ['productName'],
  };

  // Is a lead eligible for an outreach draft? Gate on the deterministic lead
  // score; the owner may override with a recorded reason.
  function eligibleForOutreach(scoring, opts) {
    const min = (opts && typeof opts.minScore === 'number') ? opts.minScore : DEFAULT_MIN_SCORE;
    const score = (scoring && typeof scoring.score === 'number') ? scoring.score : 0;
    if (opts && opts.ownerOverride) return { eligible: true, reason: 'owner override: ' + (opts.overrideReason || 'unspecified') };
    const eligible = score >= min;
    return { eligible, reason: eligible ? 'score ' + score + ' >= ' + min : 'score ' + score + ' below minimum ' + min };
  }

  // Collect the APPROVED facts from a provenance map. facts = { key: {value, source, status} }.
  function approvedFacts(facts) {
    const out = {};
    const used = [];
    for (const [k, f] of Object.entries(facts || {})) {
      if (f && f.status === 'APPROVED' && f.value != null) { out[k] = f.value; used.push({ fact: k, value: f.value, source: f.source || 'unknown', status: 'APPROVED' }); }
    }
    return { values: out, used };
  }

  // buildOutreach({ kind, lead, facts, drafter, claims, version, editor, eligibility })
  //   → a draft record, or a BLOCKED record with a reason. Never sends.
  function buildOutreach(req) {
    const r = req || {};
    const kind = r.kind || 'intro';
    const lead = r.lead || {};
    const drafter = r.drafter;
    const claims = r.claims;
    if (!drafter) throw new Error('he-sales-outreach: a drafter is required (inject he-sales-ai.createDrafter())');
    if (!claims) throw new Error('he-sales-outreach: the claim firewall is required (inject he-sales-claims)');

    // 1) qualification gate
    const elig = r.eligibility || eligibleForOutreach(lead.scoring, r);
    if (!elig.eligible) return blocked(kind, lead, 'not qualified for outreach — ' + elig.reason, []);

    // 2) required approved facts present?
    const { values, used } = approvedFacts(r.facts);
    const need = REQUIRED_FACTS[kind] || [];
    const missing = need.filter(k => values[k] == null);
    if (missing.length) return blocked(kind, lead, 'missing approved fact(s): ' + missing.join(', '), used);

    // 3) generate the draft from verified lead facts + approved product facts only
    const ctx = {
      storeName: lead.storeName, contactName: lead.contactName,
      productName: values.productName, senderName: values.senderName || 'Health Endeavors',
    };
    const d = drafter.draft(kind, ctx);

    // 4) claim firewall — fail closed
    const scan = claims.scan(d.subject + '\n' + d.body);
    if (!scan.ok) return blocked(kind, lead, 'claim firewall blocked the draft', used, scan.findings);

    return {
      status: 'DRAFT', sent: false, approvalState: 'DRAFT',
      kind, leadId: lead.id || lead.storeName, subject: d.subject, body: d.body,
      factsUsed: used, provider: d.provider, version: r.version || 1,
      editor: r.editor || null, editHistory: [], claimScan: scan,
      createdAt: r.now || null,
    };
  }

  function blocked(kind, lead, reason, used, findings) {
    return { status: 'BLOCKED', sent: false, approvalState: 'BLOCKED', kind, leadId: lead.id || lead.storeName,
      reason, factsUsed: used || [], claimFindings: findings || [] };
  }

  return { buildOutreach, eligibleForOutreach, approvedFacts, FACT_STATUSES, REQUIRED_FACTS, DEFAULT_MIN_SCORE };
}));
