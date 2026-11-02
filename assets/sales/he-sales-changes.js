// Sales & Growth — WHAT-CHANGED digest + weekly/monthly review (pure, local).
//
// From a synthetic event log, summarizes material changes over TODAY /
// YESTERDAY / LAST_7_DAYS / LAST_30_DAYS and builds a weekly/monthly owner
// review (wins, losses, stale, samples, cost, top sources, risks). Reporting
// only; it changes nothing.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-changes'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY = 86400000;
  // Event kinds we consider "material" for the what-changed view.
  const MATERIAL = ['new_lead', 'new_qualified', 'reply', 'interested', 'dnc', 'sample_request',
    'sample_approved', 'customer_won', 'opportunity_lost', 'cost_change', 'agent_failure'];

  function windowCounts(events, since, until) {
    const c = {}; for (const k of MATERIAL) c[k] = 0;
    for (const e of (events || [])) {
      const t = Date.parse(e.at);
      if (!isFinite(t) || t < since || t >= until) continue;
      if (MATERIAL.includes(e.kind)) c[e.kind]++;
    }
    return c;
  }

  // `asOf` pins "now". Returns counts for the four windows, material kinds only.
  function digest(events, asOf) {
    const now = Date.parse(asOf || new Date().toISOString());
    const startOfToday = now - (now % DAY);
    return {
      today: windowCounts(events, startOfToday, now + 1),
      yesterday: windowCounts(events, startOfToday - DAY, startOfToday),
      last7: windowCounts(events, now - 7 * DAY, now + 1),
      last30: windowCounts(events, now - 30 * DAY, now + 1),
      guard: 'Reporting only; material changes summarized, nothing altered.',
    };
  }

  // Weekly/monthly review over a window (days). Rolls counts into a narrative-ish
  // structured summary. topSources optionally supplied from he-sales-sources.
  function review(events, days, asOf, extras) {
    const now = Date.parse(asOf || new Date().toISOString());
    const c = windowCounts(events, now - days * DAY, now + 1);
    const ex = extras || {};
    return {
      periodDays: days,
      wins: c.customer_won, losses: c.opportunity_lost, newLeads: c.new_lead, qualified: c.new_qualified,
      replies: c.reply, interested: c.interested, samplesRequested: c.sample_request, samplesApproved: c.sample_approved,
      optOuts: c.dnc, agentFailures: c.agent_failure,
      topSources: ex.topSources || null, topSourcesLabel: ex.topSources ? 'ESTIMATED' : 'UNKNOWN',
      risks: [
        c.dnc > 0 ? c.dnc + ' opt-out(s) — respect suppression' : null,
        c.agent_failure > 0 ? c.agent_failure + ' agent failure(s) to review' : null,
        c.opportunity_lost > c.customer_won ? 'more lost than won this period' : null,
      ].filter(Boolean),
      guard: 'Summary only; no action is taken.',
    };
  }

  return { MATERIAL, windowCounts, digest, review };
}));
