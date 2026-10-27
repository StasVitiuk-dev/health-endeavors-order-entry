// Sales & Growth — DATA QUALITY exception center (pure, deterministic, local).
//
// Scans synthetic/local sales records and surfaces exceptions for a human to
// resolve. It NEVER auto-repairs anything unsafe: it only flags, with a severity
// and a plain reason. Safe-auto-fixable issues are marked as such but still left
// for the owner (the page may offer a reviewed fix later).
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-dataquality'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Bounded outer repetition (253 = max hostname length) avoids a nested
  // unbounded quantifier / catastrophic backtracking; behavior is unchanged for
  // every real domain. (Reserve IV release-prep: clears the regex-audit gate.)
  const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+){1,253}$/i;
  const SEVERITY = ['CRITICAL', 'WARNING', 'INFO'];
  // Pipeline states a lead can legitimately be in (mirror of the pipeline machine's).
  const VALID_STATES = new Set(['NEW', 'RESEARCHING', 'QUALIFIED', 'NOT_A_FIT', 'READY_FOR_OUTREACH',
    'OUTREACH_DRAFTED', 'OWNER_APPROVED', 'CONTACTED', 'FOLLOW_UP_DUE', 'REPLIED', 'INTERESTED',
    'NEEDS_INFORMATION', 'NOT_NOW', 'DECLINED', 'SAMPLE_CONSIDERATION', 'SAMPLE_APPROVED',
    'SAMPLE_SENT', 'WHOLESALE_DISCUSSION', 'CUSTOMER', 'LOST', 'DO_NOT_CONTACT']);
  const KNOWN_PROVIDERS = new Set(['template', 'claude', 'openai', 'none']);

  function finding(kind, severity, record, detail, autoFixable) {
    return { kind, severity, recordId: (record && (record.id || record.leadId)) || null,
      store: (record && record.storeName) || null, detail, autoFixable: !!autoFixable };
  }

  // Scan a bundle of synthetic records. Each list is optional.
  function scan(data) {
    const d = data || {};
    const leads = d.leads || [];
    const out = [];

    // --- Lead-level exceptions ---
    const seenByEmail = {}, seenByDomain = {};
    for (const l of leads) {
      if (l.email && !EMAIL_RE.test(l.email)) out.push(finding('malformed-email', 'WARNING', l, `email "${l.email}" is not a valid address`, false));
      if (l.website && !DOMAIN_RE.test(String(l.website).replace(/^https?:\/\//, '').replace(/\/.*$/, ''))) out.push(finding('malformed-website', 'WARNING', l, `website "${l.website}" is not a valid domain`, false));
      if (!l.source) out.push(finding('missing-source', 'INFO', l, 'no lead source recorded', true));
      if (!l.sourceProvenance && !l.source) out.push(finding('missing-provenance', 'INFO', l, 'no provenance for how this lead arrived', true));
      if (l.pipelineState && !VALID_STATES.has(l.pipelineState)) out.push(finding('impossible-state', 'CRITICAL', l, `pipeline state "${l.pipelineState}" is not a known state`, false));
      if (l.scoring && typeof l.scoring.score === 'number' && (l.scoring.score < 0 || l.scoring.score > 100)) out.push(finding('invalid-score', 'CRITICAL', l, `score ${l.scoring.score} is outside 0–100`, false));
      // Duplicate detection (advisory; never merged here).
      const em = (l.email || '').toLowerCase();
      if (em) { if (seenByEmail[em]) out.push(finding('duplicate-lead', 'WARNING', l, `same email as ${seenByEmail[em]}`, false)); else seenByEmail[em] = l.id; }
      const dom = String(l.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
      if (dom) { if (seenByDomain[dom] && seenByDomain[dom] !== l.id) out.push(finding('conflicting-identity', 'INFO', l, `shares domain ${dom} with ${seenByDomain[dom]}`, false)); else seenByDomain[dom] = l.id; }
    }

    // --- Draft / approval staleness ---
    for (const dr of (d.drafts || [])) {
      if (dr.status === 'DRAFT' && dr.ageDays != null && dr.ageDays > 30) out.push(finding('stale-draft', 'INFO', dr, `draft is ${dr.ageDays}d old with no decision`, false));
      if (dr.status === 'APPROVED' && dr.ageDays != null && dr.ageDays > 30) out.push(finding('stale-approval', 'WARNING', dr, `approval is ${dr.ageDays}d old and never acted on`, false));
    }

    // --- Sample integrity (owner evidence required) ---
    for (const s of (d.samples || [])) {
      if ((s.state === 'SENT' || s.state === 'APPROVED') && !s.ownerApprovedBy) out.push(finding('sample-without-owner-evidence', 'CRITICAL', s, `sample in ${s.state} with no recorded owner approver`, false));
    }

    // --- Customers without a conversion event ---
    for (const c of (d.customers || [])) {
      if (c.pipelineState === 'CUSTOMER' && !c.conversionEvent) out.push(finding('customer-without-conversion', 'WARNING', c, 'marked CUSTOMER with no conversion event on record', false));
    }

    // --- AI provenance ---
    for (const run of (d.aiRuns || [])) {
      if (run.provider && !KNOWN_PROVIDERS.has(run.provider)) out.push(finding('unknown-ai-provider', 'WARNING', run, `AI run used unknown provider "${run.provider}"`, false));
      if (run.model === undefined || run.model === null) out.push(finding('unknown-ai-model', 'INFO', run, 'AI run has no recorded model', false));
    }

    const bySeverity = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    for (const f of out) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    out.sort((a, b) => order[a.severity] - order[b.severity]);
    return { findings: out, total: out.length, bySeverity,
      guard: 'Exceptions are flagged for a human. No record is auto-merged, auto-corrected, or deleted here.' };
  }

  // Deterministic messy fixtures covering each exception kind.
  function fixtures() {
    return {
      leads: [
        { id: 'DQ-1', storeName: 'Fern Apothecary', email: 'buyer@fernapothecary.example.com', website: 'fernapothecary.example.com', source: 'referral', pipelineState: 'QUALIFIED', scoring: { score: 72, serious: true } },
        { id: 'DQ-2', storeName: 'Fern Apothecary (dup)', email: 'buyer@fernapothecary.example.com', website: 'www.fernapothecary.example.com', source: 'search' },
        { id: 'DQ-3', storeName: 'Bad Email Co', email: 'nope@@bad', website: 'not a url', pipelineState: 'QUALIFIED' },
        { id: 'DQ-4', storeName: 'No Source Store' },
        { id: 'DQ-5', storeName: 'Impossible State', pipelineState: 'TELEPORTED', scoring: { score: 140, serious: true } },
      ],
      drafts: [{ id: 'DR-1', storeName: 'Stale Draft Co', status: 'DRAFT', ageDays: 45 }, { id: 'DR-2', storeName: 'Old Approval Co', status: 'APPROVED', ageDays: 60 }],
      samples: [{ id: 'SM-1', storeName: 'No-Evidence Spa', state: 'SENT', ownerApprovedBy: null }],
      customers: [{ id: 'CU-1', storeName: 'Ghost Customer', pipelineState: 'CUSTOMER', conversionEvent: null }],
      aiRuns: [{ id: 'AI-1', provider: 'mystery-llm', model: null }],
    };
  }

  return { SEVERITY, VALID_STATES, scan, fixtures };
}));
