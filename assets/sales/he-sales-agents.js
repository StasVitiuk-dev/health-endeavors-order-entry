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
  // Lists come from data: anything that is not a list is treated as empty, and
  // empty rows are dropped, so one bad row cannot crash a whole page.
  const rowsOf = (x) => {
    const a = Array.isArray(x) ? x : ((x && typeof x === 'object' && typeof x[Symbol.iterator] === 'function') ? Array.from(x) : []);
    return a.some(function (r) { return r == null; }) ? a.filter(function (r) { return r != null; }) : a;
  };

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
    for (const a of rowsOf(agents == null ? AGENTS : agents)) {
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
    return rowsOf(agents == null ? AGENTS : agents).map(a => ({
      name: a.name, mode: a.mode, enabled: a.enabled, paused: a.paused,
      lastRun: a.lastRun, lastSuccess: a.lastSuccess, lastError: a.lastError,
      draftsCreated: a.draftsCreated, unknowns: a.unknowns, provider: a.provider,
    }));
  }

  // #25 Service health: from a job's own signals (enabled/paused/lastRun/
  // lastSuccess/lastError) derive an honest STATE and the NEXT OPERATOR ACTION.
  // Pure and deterministic — a missing signal never reads as "healthy".
  // States, in precedence order: PAUSED, ERROR, OFF, NEVER_RUN, STALE, OK.
  const HEALTH_STATES = ['OK', 'STALE', 'ERROR', 'NEVER_RUN', 'PAUSED', 'OFF'];
  function hoursBetween(fromISO, toMs) {
    const t = Date.parse(fromISO);
    if (!isFinite(t)) return null;
    return (toMs - t) / 36e5;
  }
  function jobHealth(job, nowISO, staleAfterHours) {
    const a = job || {};
    const nowMs = Date.parse(nowISO);
    const now = isFinite(nowMs) ? nowMs : Date.now();
    const stale = (typeof staleAfterHours === 'number' && staleAfterHours > 0) ? staleAfterHours : 24;
    const sinceSuccess = a.lastSuccess ? hoursBetween(a.lastSuccess, now) : null;
    const base = { name: a.name || a.id || null, lastRun: a.lastRun || null, lastSuccess: a.lastSuccess || null,
      lastError: a.lastError || null, sinceSuccessHours: sinceSuccess == null ? null : Math.round(sinceSuccess * 10) / 10,
      staleAfterHours: stale };
    // 1) explicitly held by the owner.
    if (a.paused === true) return { ...base, state: 'PAUSED', reason: 'held by the owner', nextAction: 'Resume the job (owner) when you want it to run again.' };
    // 2) an unresolved error (no success since the error) is surfaced, never hidden.
    //    lastError is a MESSAGE; the error's time is lastErrorAt if given, else the
    //    last run time. The error is unresolved unless a success came after it.
    const errWhen = a.lastErrorAt || a.lastRun || null;
    const errUnresolved = !!a.lastError && (!a.lastSuccess
      || (errWhen && isFinite(Date.parse(errWhen)) ? Date.parse(errWhen) >= Date.parse(a.lastSuccess) : true));
    if (errUnresolved) return { ...base, state: 'ERROR', reason: 'last run failed: ' + String(a.lastError).slice(0, 80), nextAction: 'Review the last error and re-run once; if it repeats, check the provider/credentials/config.' };
    // 3) off by default (not scheduled to run).
    if (a.enabled === false || a.mode === 'OFF') return { ...base, state: 'OFF', reason: 'off by default — not scheduled', nextAction: 'No action needed. Turn it on (owner) only when you want it to run.' };
    // 4) never produced a success yet.
    if (!a.lastRun && !a.lastSuccess) return { ...base, state: 'NEVER_RUN', reason: 'has not run yet', nextAction: 'Run it once to establish a baseline and a last-success time.' };
    // 5) ran successfully but too long ago.
    if (sinceSuccess != null && sinceSuccess > stale) return { ...base, state: 'STALE', reason: 'last success ' + base.sinceSuccessHours + 'h ago (> ' + stale + 'h)', nextAction: 'Check the scheduler is running and re-run; confirm the last-success time updates.' };
    // 6) healthy.
    return { ...base, state: 'OK', reason: sinceSuccess == null ? 'running' : ('last success ' + base.sinceSuccessHours + 'h ago'), nextAction: 'No action needed.' };
  }
  function healthRows(jobs, nowISO, staleAfterHours) {
    return rowsOf(jobs == null ? AGENTS : jobs).map(j => jobHealth(j, nowISO, staleAfterHours));
  }
  function healthSummary(jobs, nowISO, staleAfterHours) {
    const rows = healthRows(jobs, nowISO, staleAfterHours);
    const counts = {}; for (const s of HEALTH_STATES) counts[s] = 0;
    rows.forEach(r => { counts[r.state] = (counts[r.state] || 0) + 1; });
    const needsAttention = rows.filter(r => r.state === 'ERROR' || r.state === 'STALE');
    return { counts, total: rows.length, needsAttention: needsAttention.length,
      firstAction: needsAttention.length ? needsAttention[0].nextAction : null };
  }

  // Synthetic job records covering each health state, for the Service Health
  // view and its tests. Times are relative to a fixed 'now' the caller passes.
  function healthFixtures() {
    return {
      now: '2026-11-13T12:00:00Z', staleAfterHours: 24,
      jobs: [
        { id: 'nightly-check', name: 'Nightly integrity check', enabled: true, mode: 'READ_ONLY', lastRun: '2026-11-13T06:00:00Z', lastSuccess: '2026-11-13T06:00:00Z' },               // OK
        { id: 'report-rollup', name: 'Daily report roll-up', enabled: true, mode: 'READ_ONLY', lastRun: '2026-11-11T06:00:00Z', lastSuccess: '2026-11-11T06:00:00Z' },                  // STALE (>24h)
        { id: 'tracking-sync', name: 'Tracking sync (simulated)', enabled: true, mode: 'SIMULATION', lastRun: '2026-11-13T11:00:00Z', lastSuccess: '2026-11-12T06:00:00Z', lastError: 'provider timeout' }, // ERROR
        { id: 'reorder-scan', name: 'Reorder point scan', enabled: true, mode: 'READ_ONLY' },                                                                                           // NEVER_RUN
        { id: 'review-digest', name: 'Review digest', enabled: true, mode: 'READ_ONLY', paused: true, lastSuccess: '2026-11-13T06:00:00Z' },                                            // PAUSED
        { id: 'creator-scout', name: 'Creator scout', enabled: false, mode: 'OFF' },                                                                                                    // OFF
      ],
    };
  }

  // A compact summary for the command center / readiness view.
  function summary(agents) {
    const list = rowsOf(agents == null ? AGENTS : agents);
    const byGroup = {};
    for (const a of list) byGroup[a.group] = (byGroup[a.group] || 0) + 1;
    return { total: list.length, enabled: list.filter(a => a.enabled).length,
      draftCapable: list.filter(a => Array.isArray(a.caps) && a.caps.includes('draft')).length, byGroup };
  }

  return { MODES, SAFE_CAPS, FORBIDDEN_CAPS, HEALTH_STATES, AGENTS, assertSafe, activityRows, jobHealth, healthRows, healthSummary, healthFixtures, summary };
}));
