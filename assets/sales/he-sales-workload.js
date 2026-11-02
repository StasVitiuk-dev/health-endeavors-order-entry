// Sales & Growth — OWNER WORKLOAD model + response-time analysis (pure, local).
//
// Estimates how much owner time the current sales queue implies, so outreach
// volume can be kept sane, and reports synthetic response-time stats (owner
// approval latency, lead response time, time-to-conversion, sample-to-
// conversion). Advisory only; it schedules and sends nothing.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-workload'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY = 86400000;
  // Synthetic minutes-per-item defaults (owner-tunable later).
  const MINUTES = { draftApproval: 2, reply: 3, sampleDecision: 4, contentApproval: 5 };

  function workload(queue, minutes) {
    const q = queue || {};
    const m = Object.assign({}, MINUTES, minutes || {});
    const items = {
      draftsAwaiting: q.draftsAwaiting || 0,
      repliesToReview: q.repliesToReview || 0,
      samplesToDecide: q.samplesToDecide || 0,
      contentApprovals: q.contentApprovals || 0,
    };
    const totalMinutes = items.draftsAwaiting * m.draftApproval + items.repliesToReview * m.reply
      + items.samplesToDecide * m.sampleDecision + items.contentApprovals * m.contentApproval;
    const totalItems = Object.values(items).reduce((a, b) => a + b, 0);
    return { items, totalItems, estMinutes: totalMinutes, estMinutesLabel: 'ESTIMATE',
      sustainable: totalMinutes <= (q.dailyBudgetMinutes == null ? 60 : q.dailyBudgetMinutes),
      note: 'Estimate to help keep outreach volume manageable; nothing is scheduled.' };
  }

  // Durations (days) from paired timestamps; null entries ignored. Returns
  // count/avg/median or UNKNOWN when there is nothing to measure.
  function durationStats(pairs) {
    const ds = (pairs || []).map(p => {
      const a = Date.parse(p.from), b = Date.parse(p.to);
      return (isFinite(a) && isFinite(b) && b >= a) ? (b - a) / DAY : null;
    }).filter(x => x != null).sort((a, b) => a - b);
    if (!ds.length) return { count: 0, avgDays: null, medianDays: null, label: 'UNKNOWN' };
    const avg = ds.reduce((s, x) => s + x, 0) / ds.length;
    const mid = Math.floor(ds.length / 2);
    const median = ds.length % 2 ? ds[mid] : (ds[mid - 1] + ds[mid]) / 2;
    return { count: ds.length, avgDays: +avg.toFixed(1), medianDays: +median.toFixed(1), label: 'ESTIMATED' };
  }

  function responseTimes(data) {
    const d = data || {};
    return {
      ownerApproval: durationStats(d.ownerApprovalPairs),      // draft created -> approved
      leadResponse: durationStats(d.leadResponsePairs),        // contacted -> replied
      timeToConversion: durationStats(d.conversionPairs),      // first contact -> customer
      sampleToConversion: durationStats(d.samplePairs),        // sample sent -> customer
    };
  }

  return { MINUTES, workload, durationStats, responseTimes };
}));
