// Sales & Growth — DEAL PROGRESSION & AGING (pure, local, advisory).
//
// Looks at where each wholesale lead sits in the pipeline and HOW LONG it has
// sat there, so the owner can see deals that have quietly stalled. For every
// lead it computes total age, time in the current stage, an aging bucket, and
// whether the current stage has exceeded its soft SLA (stalled). It also builds
// a progression map (how many leads are in each stage) so the owner can see the
// shape of the funnel at a glance.
//
// This never advances a deal, contacts anyone, or writes anything — it reads a
// snapshot plus timestamps and reports. Time is injected (asOf) so the result
// is deterministic and testable; there is no hidden Date.now().
//
// Terminal stages (won/lost/declined/not-a-fit/DNC) are never "stalled": they
// are finished, not stuck.
//
// Pure. Deterministic. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-progression'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The forward funnel, in order. Used to draw the progression map; off-funnel
  // and terminal states are shown separately.
  const FUNNEL_ORDER = ['NEW', 'RESEARCHING', 'QUALIFIED', 'READY_FOR_OUTREACH',
    'OUTREACH_DRAFTED', 'OWNER_APPROVED', 'CONTACTED', 'FOLLOW_UP_DUE', 'REPLIED',
    'NEEDS_INFORMATION', 'INTERESTED', 'SAMPLE_CONSIDERATION', 'SAMPLE_APPROVED',
    'SAMPLE_SENT', 'WHOLESALE_DISCUSSION', 'CUSTOMER'];

  // Stages that are finished — never stalled.
  const TERMINAL = new Set(['CUSTOMER', 'LOST', 'DECLINED', 'DO_NOT_CONTACT', 'NOT_A_FIT', 'NOT_NOW']);

  // Soft SLA: days a lead may sit in a stage before it is "stalled". Stages the
  // owner can't push (waiting on a reply) get longer; owner-side stages (a
  // drafted outreach awaiting approval) get short ones. Unlisted stages use
  // DEFAULT_SLA.
  const DEFAULT_SLA = 14;
  const STAGE_SLA = {
    NEW: 5, RESEARCHING: 7, QUALIFIED: 7, READY_FOR_OUTREACH: 3,
    OUTREACH_DRAFTED: 2, OWNER_APPROVED: 3, CONTACTED: 10, FOLLOW_UP_DUE: 3,
    REPLIED: 3, NEEDS_INFORMATION: 5, INTERESTED: 10, SAMPLE_CONSIDERATION: 5,
    SAMPLE_APPROVED: 5, SAMPLE_SENT: 21, WHOLESALE_DISCUSSION: 21,
  };

  const DAY = 86400000;

  function toMs(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    const t = Date.parse(v);
    return isFinite(t) ? t : null;
  }
  function daysBetween(fromMs, toMsVal) {
    if (fromMs == null || toMsVal == null) return null;
    return Math.max(0, (toMsVal - fromMs) / DAY);
  }

  function bucketFor(days) {
    if (days == null) return 'UNKNOWN';
    if (days < 7) return 'FRESH';
    if (days < 21) return 'AGING';
    if (days < 45) return 'STALE';
    return 'COLD';
  }
  const BUCKETS = ['FRESH', 'AGING', 'STALE', 'COLD', 'UNKNOWN'];

  // Analyze one lead against asOf. currentStageDays uses enteredStateAt (falling
  // back to createdAt); ageDays uses createdAt (falling back to enteredStateAt).
  function analyzeLead(lead, asOfMs, slaOverride) {
    const l = lead || {};
    const enteredRaw = toMs(l.enteredStateAt) != null ? toMs(l.enteredStateAt) : toMs(l.createdAt);
    const createdRaw = toMs(l.createdAt) != null ? toMs(l.createdAt) : toMs(l.enteredStateAt);
    const state = l.state || 'NEW';
    const terminal = TERMINAL.has(state);

    // A1 (Reserve IV Wave A): never fabricate an age from a bad timestamp.
    //  - A date AFTER asOf (a future date) is not "0 days old" — it is
    //    nonsense, so it reads UNKNOWN instead of being clamped to FRESH.
    //  - enteredStateAt BEFORE createdAt (the lead entered a stage before it
    //    existed) is contradictory: measurable, but flagged and not treated as
    //    trustworthy "complete" data.
    const futureDated = (enteredRaw != null && enteredRaw > asOfMs) || (createdRaw != null && createdRaw > asOfMs);
    const inconsistentDates = enteredRaw != null && createdRaw != null && enteredRaw < createdRaw;

    const currentStageDays = (enteredRaw != null && enteredRaw <= asOfMs) ? daysBetween(enteredRaw, asOfMs) : null;
    const ageDays = (createdRaw != null && createdRaw <= asOfMs) ? daysBetween(createdRaw, asOfMs) : null;

    const sla = (slaOverride && slaOverride[state] != null) ? slaOverride[state]
      : (STAGE_SLA[state] != null ? STAGE_SLA[state] : DEFAULT_SLA);
    const stalled = !terminal && currentStageDays != null && currentStageDays > sla;
    return { leadId: l.id || null, name: l.name || null, state, terminal,
      ageDays, currentStageDays, sla,
      overBy: stalled ? currentStageDays - sla : 0,
      agingBucket: terminal ? 'DONE' : (futureDated || currentStageDays == null ? 'UNKNOWN' : bucketFor(currentStageDays)),
      stalled,
      futureDated, inconsistentDates,
      dataComplete: currentStageDays != null && ageDays != null && !futureDated && !inconsistentDates };
  }

  // Progression map: count of ACTIVE (non-terminal) leads per funnel stage, plus
  // the off-funnel/terminal tallies, in funnel order.
  function progressionMap(rows) {
    const counts = {};
    for (const s of FUNNEL_ORDER) counts[s] = 0;
    const terminalCounts = {};
    for (const r of rows) {
      if (r.terminal) { terminalCounts[r.state] = (terminalCounts[r.state] || 0) + 1; continue; }
      if (counts[r.state] == null) counts[r.state] = 0;
      counts[r.state] += 1;
    }
    const stages = Object.keys(counts).sort((a, b) => {
      const ia = FUNNEL_ORDER.indexOf(a), ib = FUNNEL_ORDER.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    }).map(s => ({ stage: s, count: counts[s] }));
    return { stages, terminal: terminalCounts };
  }

  // Full analysis: per-lead rows, the aging-bucket histogram, the stalled list
  // (worst first), and the progression map.
  function analyze(leads, opts) {
    const o = opts || {};
    const asOfMs = toMs(o.asOf) != null ? toMs(o.asOf) : Date.parse('2026-10-20T00:00:00Z');
    const rows = (leads || []).map(l => analyzeLead(l, asOfMs, o.sla));
    const histogram = {}; for (const b of BUCKETS) histogram[b] = 0; histogram.DONE = 0;
    for (const r of rows) histogram[r.agingBucket] = (histogram[r.agingBucket] || 0) + 1;
    // A3: worst first, with a deterministic id tie-break so equal-overBy leads
    // always come back in the same order across runs and input orderings.
    const stalled = rows.filter(r => r.stalled).sort((a, b) => (b.overBy - a.overBy) || String(a.leadId).localeCompare(String(b.leadId)));
    const active = rows.filter(r => !r.terminal);
    // Average only over active leads whose age is actually known (A6: a missing
    // or future date is not counted as age 0).
    const agedActive = active.filter(r => r.ageDays != null);
    const avgAge = agedActive.length ? agedActive.reduce((s, r) => s + r.ageDays, 0) / agedActive.length : 0;
    return {
      asOf: new Date(asOfMs).toISOString(),
      rows, histogram, stalled,
      stalledCount: stalled.length,
      activeCount: active.length,
      avgActiveAgeDays: avgAge,
      map: progressionMap(rows),
      guard: 'Read-only aging view. Advances no deal, contacts no one, writes nothing.',
    };
  }

  return { FUNNEL_ORDER, TERMINAL, STAGE_SLA, DEFAULT_SLA, BUCKETS,
    bucketFor, analyzeLead, progressionMap, analyze };
}));
