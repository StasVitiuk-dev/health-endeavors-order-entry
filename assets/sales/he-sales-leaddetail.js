// Sales & Growth — LEAD DETAIL dossier (pure composition over the other modules).
//
// Assembles everything known about one lead into a structured, owner-facing
// workbench view model: identity, provenance, score + explanation, pipeline
// state, next-best-action, notes, outreach/reply/follow-up/sample history,
// commercial blockers, a merged timeline, audit events, data-quality warnings
// and AI usage/cost for this lead. Pure and read-only: it composes data, it
// never sends, approves or mutates anything.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-leaddetail'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Next-best-action from the current pipeline state. Advisory; never auto-acted.
  // Returns { action, why, ownerDecision } — ownerDecision true means a human
  // must make the call (approve outreach / approve sample), never the system.
  function nextBestAction(lead) {
    const s = (lead && lead.pipelineState) || 'NEW';
    const map = {
      NEW: { action: 'Research & score this prospect', why: 'not yet qualified', ownerDecision: false },
      RESEARCHING: { action: 'Finish research, then score', why: 'research in progress', ownerDecision: false },
      QUALIFIED: { action: 'Draft an intro (owner approves before any send)', why: 'qualified and a fit', ownerDecision: false },
      READY_FOR_OUTREACH: { action: 'Review the draft and approve for manual send', why: 'draft is ready', ownerDecision: true },
      OUTREACH_DRAFTED: { action: 'Owner review of the outreach draft', why: 'awaiting approval', ownerDecision: true },
      OWNER_APPROVED: { action: 'Owner sends the approved note by hand', why: 'approved, not sent', ownerDecision: true },
      CONTACTED: { action: 'Wait for a reply; schedule a follow-up', why: 'contacted', ownerDecision: false },
      FOLLOW_UP_DUE: { action: 'Draft a follow-up (respect suppression)', why: 'follow-up due', ownerDecision: false },
      REPLIED: { action: 'Classify the reply and respond', why: 'they replied', ownerDecision: false },
      INTERESTED: { action: 'Send line sheet / discuss terms; consider a sample', why: 'interested', ownerDecision: false },
      NEEDS_INFORMATION: { action: 'Answer their questions from approved facts', why: 'they need info', ownerDecision: false },
      SAMPLE_CONSIDERATION: { action: 'Owner decides on a sample (budget-checked)', why: 'sample under consideration', ownerDecision: true },
      SAMPLE_APPROVED: { action: 'Owner arranges the sample; no auto-ship', why: 'sample approved', ownerDecision: true },
      SAMPLE_SENT: { action: 'Follow up after the sample lands', why: 'sample sent', ownerDecision: false },
      WHOLESALE_DISCUSSION: { action: 'Work the terms toward an order', why: 'in discussion', ownerDecision: true },
      DECLINED: { action: 'Mark declined; do not contact further', why: 'declined', ownerDecision: false },
      DO_NOT_CONTACT: { action: 'Suppressed — no further contact', why: 'opted out', ownerDecision: false },
      CUSTOMER: { action: 'Move to retention / reorder cadence', why: 'won', ownerDecision: false },
      LOST: { action: 'Record the lost reason; maybe revisit later', why: 'lost', ownerDecision: false },
    };
    return map[s] || { action: 'Review this lead', why: 'state ' + s, ownerDecision: false };
  }

  // Commercial blockers that would stop a real wholesale deal (facts the owner/
  // legal must supply). Advisory checklist, not a gate on the UI.
  function commercialBlockers(commercial) {
    const c = commercial || {};
    const need = ['wholesalePrice', 'moq', 'shippingTerms', 'approvedClaims', 'lineSheet', 'legalStatus'];
    const labels = { wholesalePrice: 'wholesale price', moq: 'minimum order (MOQ)', shippingTerms: 'shipping/payment terms', approvedClaims: 'approved claims', lineSheet: 'line sheet', legalStatus: 'legal review' };
    return need.filter(k => !c[k]).map(k => ({ field: k, label: labels[k], status: 'OWNER_INPUT_REQUIRED' }));
  }

  // Merge the per-lead history streams into one time-ordered timeline.
  function timeline(history) {
    const h = history || {};
    const ev = [];
    const push = (list, type) => (list || []).forEach(x => ev.push({ at: x.at || x.date || x.ts || null, type, detail: x.summary || x.text || x.kind || x.status || '' }));
    push(h.outreach, 'outreach'); push(h.replies, 'reply'); push(h.followups, 'follow-up');
    push(h.samples, 'sample'); push(h.audit, 'audit'); push(h.notes, 'note');
    return ev.filter(e => e.at).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }

  // Build the full dossier. `deps` optionally injects scorers (leads, dataquality)
  // so the score explanation and DQ warnings are the real ones.
  function dossier(lead, history, deps) {
    const l = lead || {};
    const h = history || {};
    const d = deps || {};
    const scoring = l.scoring || (d.leads && typeof d.leads.score === 'function' ? d.leads.score(l) : null);
    const dq = d.dataquality && typeof d.dataquality.scan === 'function' ? d.dataquality.scan({ leads: [l] }).findings : (h.dataQuality || []);
    const aiRuns = h.aiRuns || [];
    const aiCost = aiRuns.reduce((s, r) => s + (r.cost || 0), 0);
    return {
      identity: { id: l.id, storeName: l.storeName, contactName: l.contactName || null, category: l.category || null, city: l.city || null, state: l.state || null },
      contact: { email: l.email || null, website: l.website || null, reachable: !!(l.email || l.website) },
      provenance: { source: l.source || 'unknown', detail: l.sourceProvenance || null, label: l.synthetic ? 'SIMULATED' : 'ACTUAL' },
      score: scoring ? { value: scoring.score, band: scoring.band, serious: scoring.serious, reasons: scoring.reasons || [] } : { value: null, label: 'UNKNOWN' },
      pipelineState: l.pipelineState || 'NEW',
      nextBestAction: nextBestAction(l),
      notes: h.notes || [],
      outreachHistory: h.outreach || [],
      replyHistory: h.replies || [],
      followupHistory: h.followups || [],
      sampleHistory: h.samples || [],
      commercialBlockers: commercialBlockers(l.commercial || h.commercial),
      timeline: timeline(h),
      auditEvents: h.audit || [],
      dataQualityWarnings: dq,
      aiUsage: { runs: aiRuns.length, estCost: aiRuns.length ? +aiCost.toFixed(4) : null, label: aiRuns.length ? 'ESTIMATED' : 'UNKNOWN' },
      guard: 'Read-only dossier. Nothing here sends, approves, or changes a record.',
    };
  }

  return { nextBestAction, commercialBlockers, timeline, dossier };
}));
