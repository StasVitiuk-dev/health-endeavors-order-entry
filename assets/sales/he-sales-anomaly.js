// Sales & Growth — ANOMALY center (pure, deterministic, local).
//
// Given recent synthetic metric series, surfaces anomalies the owner should know
// about: reply-rate collapse, bounce spike, DNC spike, sample-conversion decline,
// follow-up backlog, AI-cost spike, a bad lead source, and owner-approval
// backlog. Advisory only — it raises flags, it changes nothing.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-anomaly'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SEVERITY = ['CRITICAL', 'WARNING', 'INFO'];

  function mean(xs) { const a = (xs || []).filter(x => typeof x === 'number'); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }

  function flag(kind, severity, detail, value, baseline) {
    return { kind, severity, detail, value: value == null ? null : +(+value).toFixed(3), baseline: baseline == null ? null : +(+baseline).toFixed(3) };
  }

  // `m` carries current values and short baselines (arrays of recent periods).
  function scan(m) {
    const d = m || {};
    const out = [];

    // reply-rate collapse: current well below recent baseline
    if (d.replyRate != null && Array.isArray(d.replyRateHistory) && d.replyRateHistory.length >= 2) {
      const base = mean(d.replyRateHistory);
      if (base != null && base > 0 && d.replyRate < base * 0.5) out.push(flag('reply-rate-collapse', 'WARNING', 'reply rate dropped below half its recent average', d.replyRate, base));
    }
    // bounce spike
    if (d.bounceRate != null && d.bounceRate > (d.bounceBaseline == null ? 0.05 : d.bounceBaseline) * 2) out.push(flag('bounce-spike', 'WARNING', 'bounce rate is more than twice baseline', d.bounceRate, d.bounceBaseline));
    // DNC spike
    if (d.dncToday != null && d.dncBaseline != null && d.dncToday > d.dncBaseline * 3) out.push(flag('dnc-spike', 'CRITICAL', 'opt-outs well above normal — pause and review', d.dncToday, d.dncBaseline));
    // sample conversion decline
    if (d.sampleConversion != null && d.sampleConversionBaseline != null && d.sampleConversion < d.sampleConversionBaseline * 0.5) out.push(flag('sample-conversion-decline', 'WARNING', 'sample→customer conversion fell sharply', d.sampleConversion, d.sampleConversionBaseline));
    // follow-up backlog
    if (d.followUpBacklog != null && d.followUpBacklog > (d.followUpBacklogLimit == null ? 25 : d.followUpBacklogLimit)) out.push(flag('follow-up-backlog', 'INFO', 'follow-ups are piling up', d.followUpBacklog, d.followUpBacklogLimit));
    // AI cost spike
    if (d.aiCostToday != null && d.aiCostBaseline != null && d.aiCostToday > d.aiCostBaseline * 2) out.push(flag('ai-cost-spike', 'WARNING', 'AI spend today is more than twice baseline', d.aiCostToday, d.aiCostBaseline));
    // bad lead source (a source with near-zero conversion but real volume)
    for (const s of (d.sources || [])) {
      if (s.leads >= 20 && (s.conversion == null || s.conversion < 0.01)) out.push(flag('bad-lead-source', 'INFO', `source "${s.name}" has volume but ~0 conversion`, s.conversion || 0, null));
    }
    // owner approval backlog
    if (d.approvalBacklog != null && d.approvalBacklog > (d.approvalBacklogLimit == null ? 15 : d.approvalBacklogLimit)) out.push(flag('owner-approval-backlog', 'WARNING', 'drafts/samples awaiting owner decision are backing up', d.approvalBacklog, d.approvalBacklogLimit));

    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    out.sort((a, b) => order[a.severity] - order[b.severity]);
    const bySeverity = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    for (const f of out) bySeverity[f.severity]++;
    return { anomalies: out, total: out.length, bySeverity, guard: 'Advisory only — anomalies are flagged; nothing is paused or changed automatically.' };
  }

  return { SEVERITY, mean, scan };
}));
