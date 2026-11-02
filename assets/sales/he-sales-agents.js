// Sales & Growth — ADVISORY agent registry (pure, data-only, every agent OFF by default).
//
// These describe the advisory helpers the Sales & Growth subsystem *could* run.
// They are advisory on purpose: an agent may only observe, score, flag, draft,
// summarize or simulate. No agent may send a message, approve an outreach,
// approve/reserve/ship a sample, move money, or change production — those stay
// owner-only and are not even expressible here (see SAFE_CAPS / assertSafe).
//
// Every agent ships `enabled:false`. Turning one on (later, by the owner) still
// only lets it produce drafts/flags for human review; it can never act.
//
// Modes (how an enabled agent would behave, never automatically):
//   OFF                  not running (the default for all)
//   SIMULATION           runs against synthetic fixtures only
//   READ_ONLY            observes/scores/summarizes; produces no drafts
//   DRAFT_ONLY           may produce drafts for owner approval; never sends
//   PAUSED               configured but held by the owner
//   BLOCKED_OWNER_INPUT  needs an owner decision/value before it can run
//   ERROR                last run failed; surfaced honestly, not hidden
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-agents'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MODES = ['OFF', 'SIMULATION', 'READ_ONLY', 'DRAFT_ONLY', 'PAUSED', 'BLOCKED_OWNER_INPUT', 'ERROR'];
  // The ONLY capabilities an advisory agent may hold. Anything that would act in
  // the real world (send/approve/reserve/ship/charge/delete/contact) is absent on
  // purpose and rejected by assertSafe().
  const SAFE_CAPS = ['observe', 'score', 'flag', 'draft', 'summarize', 'simulate', 'classify', 'dedupe', 'rank', 'plan'];
  const FORBIDDEN_CAPS = ['send', 'email', 'sms', 'approve', 'reserve', 'ship', 'charge', 'pay', 'refund', 'delete', 'contact', 'post', 'publish', 'order'];

  // group: which page/area the agent belongs to. caps: from SAFE_CAPS only.
  // runsOn: 'synthetic' until the owner connects real data. Every agent OFF.
  function A(id, name, group, caps, purpose) {
    return { id, name, group, caps, purpose, mode: 'OFF', enabled: false, paused: false,
      runsOn: 'synthetic', provider: caps.includes('draft') ? 'template' : 'none',
      lastRun: null, lastSuccess: null, lastError: null, draftsCreated: 0, unknowns: 0 };
  }

  // The advisory roster, grouped by sales area. Deterministic order.
  const AGENTS = [
    // Lead sourcing & hygiene
    A('lead-intake', 'Lead Intake Normalizer', 'Leads', ['observe', 'dedupe'], 'Normalizes pasted/imported leads and flags likely duplicates; never merges.'),
    A('lead-scorer', 'Lead Scorer', 'Leads', ['score', 'rank'], 'Explains a 0–100 body-care fit score with reasons; read-only.'),
    A('lead-enricher', 'Lead Enrichment Suggester', 'Leads', ['observe', 'flag'], 'Flags missing fields (website, buyer email) to fill in by hand.'),
    A('lead-dedupe', 'Duplicate Finder', 'Leads', ['dedupe', 'flag'], 'Groups likely-duplicate stores by domain/email/phone/name+city.'),
    A('lead-fit', 'Category-Fit Checker', 'Leads', ['score', 'flag'], 'Flags prospects that are a poor fit for a body-care line.'),
    A('lead-region', 'Territory Clusterer', 'Territory', ['observe', 'summarize'], 'Clusters leads by region to show where coverage is thin.'),
    // Pipeline hygiene
    A('pipe-stale', 'Stale Card Watcher', 'Pipeline', ['observe', 'flag'], 'Flags cards with no movement past a threshold; suggests a follow-up.'),
    A('pipe-nextstep', 'Next-Step Suggester', 'Pipeline', ['plan', 'flag'], 'Suggests the next legal pipeline step; never moves a card.'),
    A('pipe-hygiene', 'Pipeline Hygiene Auditor', 'Pipeline', ['observe', 'summarize'], 'Summarizes cards missing owner info, notes or a due date.'),
    A('pipe-forecast', 'Pipeline Forecaster', 'Analytics', ['summarize', 'simulate'], 'Projects a labelled SIMULATION of pipeline value; never a promise.'),
    // Outreach drafting (draft-only)
    A('out-intro', 'Intro Draft Writer', 'Approvals', ['draft'], 'Drafts a first-contact note from approved facts; owner sends it.'),
    A('out-followup', 'Follow-up Draft Writer', 'Approvals', ['draft', 'plan'], 'Drafts a follow-up after a gap; respects suppression rules.'),
    A('out-reengage', 'Re-engagement Draft Writer', 'Approvals', ['draft'], 'Drafts a gentle re-engagement for a cold lead; owner approves.'),
    A('out-linesheet', 'Line-Sheet Reply Drafter', 'Approvals', ['draft'], 'Drafts a reply that attaches the owner-approved line sheet.'),
    A('out-claimcheck', 'Claim Firewall', 'Approvals', ['observe', 'flag'], 'Blocks any draft containing a therapeutic/medical claim; fails closed.'),
    A('out-tone', 'Tone & Length Checker', 'Approvals', ['observe', 'flag'], 'Flags drafts that are too long, pushy or off-brand.'),
    // Replies & follow-up
    A('reply-classify', 'Reply Classifier', 'Pipeline', ['classify'], 'Labels inbound replies (interested, price, terms, decline, unsubscribe…); UNKNOWN-first.'),
    A('reply-suppress', 'Unsubscribe/Bounce Guard', 'Pipeline', ['classify', 'flag'], 'Detects unsubscribe/bounce/out-of-office and suppresses further contact.'),
    A('followup-planner', 'Follow-up Planner', 'Pipeline', ['plan', 'flag'], 'Plans at most a few spaced follow-ups; never for opted-out leads.'),
    // Samples (flag-only; approval is owner-only elsewhere)
    A('sample-candidate', 'Sample Candidate Flagger', 'Samples', ['flag', 'score'], 'Flags serious prospects that *could* merit a sample; cannot approve one.'),
    A('sample-budget', 'Sample Budget Watcher', 'Samples', ['observe', 'flag'], 'Warns when flagged candidates would exceed the monthly sample budget.'),
    A('sample-roi', 'Sample ROI Reporter', 'Samples', ['summarize'], 'Reports sample→customer conversion honestly (UNKNOWN when unknown).'),
    // Analytics & data quality
    A('analytics-funnel', 'Funnel Reporter', 'Analytics', ['summarize'], 'Summarizes the funnel with safe denominators (UNKNOWN, never fake 0%).'),
    A('analytics-cost', 'AI Cost Reporter', 'Analytics', ['summarize'], 'Reports estimated AI spend vs budget; flags approaching the hard stop.'),
    A('dq-missing', 'Data-Quality Auditor', 'Data Quality', ['observe', 'flag'], 'Flags malformed emails/domains and missing contact info in the lead list.'),
    A('dq-conflict', 'Conflict Detector', 'Data Quality', ['observe', 'flag'], 'Flags conflicting records for the same store for a human to resolve.'),
    // Content & growth ideas (draft-only, claim-checked)
    A('content-ideas', 'Content Opportunity Suggester', 'Content', ['draft', 'flag'], 'Suggests claim-safe content ideas for wholesale buyers; owner decides.'),
    A('content-faq', 'Buyer-FAQ Drafter', 'Content', ['draft'], 'Drafts answers to common wholesale questions from approved facts.'),
    A('retention-watch', 'Retention Watcher', 'Retention', ['observe', 'flag'], 'Flags customers who have gone quiet since their last order.'),
    A('retention-reorder', 'Reorder Reminder Drafter', 'Retention', ['draft', 'plan'], 'Drafts a reorder nudge at a sensible interval; owner approves and sends.'),
    A('expansion-scout', 'Expansion Scout', 'Territory', ['observe', 'summarize'], 'Summarizes regions/segments with room to grow; informational only.'),
    A('campaign-lab', 'Campaign Simulator', 'Analytics', ['simulate'], 'Runs labelled SIMULATION of an outreach campaign; sends nothing.'),
  ];

  // Safety invariant: every agent OFF, caps drawn only from SAFE_CAPS, and no
  // forbidden (acting) capability anywhere. Throws on the first violation.
  function assertSafe(agents) {
    for (const a of (agents || AGENTS)) {
      if (a.enabled !== false) throw new Error('agent not OFF by default: ' + a.id);
      if (a.mode !== 'OFF') throw new Error('agent mode not OFF by default: ' + a.id);
      for (const c of a.caps) {
        if (!SAFE_CAPS.includes(c)) throw new Error('agent ' + a.id + ' has non-advisory cap: ' + c);
        if (FORBIDDEN_CAPS.includes(c)) throw new Error('agent ' + a.id + ' has forbidden cap: ' + c);
      }
    }
    return true;
  }

  // Rows for he-sales-ui.agentActivityView(): honest health, never a fake "healthy".
  function activityRows(agents) {
    return (agents || AGENTS).map(a => ({
      name: a.name, mode: a.mode, enabled: a.enabled, paused: a.paused,
      lastRun: a.lastRun, lastSuccess: a.lastSuccess, lastError: a.lastError,
      draftsCreated: a.draftsCreated, unknowns: a.unknowns, provider: a.provider,
    }));
  }

  // A compact summary for the command center / readiness view.
  function summary(agents) {
    const list = agents || AGENTS;
    const byGroup = {};
    for (const a of list) byGroup[a.group] = (byGroup[a.group] || 0) + 1;
    return { total: list.length, enabled: list.filter(a => a.enabled).length,
      draftCapable: list.filter(a => a.caps.includes('draft')).length, byGroup };
  }

  return { MODES, SAFE_CAPS, FORBIDDEN_CAPS, AGENTS, assertSafe, activityRows, summary };
}));
