// Sales & Growth — OWNER DAILY QUEUE (pure, local, advisory).
//
// Turns the current sales state into a prioritized owner queue bucketed into
// NEEDS_OWNER_NOW / TODAY / THIS_WEEK / BLOCKED / WATCH. Every item carries a
// reason, priority, due date, linked lead, recommended next action, whether an
// owner decision is required, and — always NO in this mode — whether it has an
// external side effect. It schedules and sends nothing.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-queue'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BUCKETS = ['NEEDS_OWNER_NOW', 'TODAY', 'THIS_WEEK', 'BLOCKED', 'WATCH'];

  function item(o) {
    return { bucket: o.bucket, reason: o.reason, priority: o.priority == null ? 3 : o.priority,
      dueDate: o.dueDate || null, leadId: o.leadId || null, nextAction: o.nextAction || '',
      ownerDecisionRequired: !!o.ownerDecisionRequired, externalSideEffect: false }; // always NO in this mode
  }

  // Build the queue from synthetic/local inputs. Nothing here can act.
  function build(input) {
    const d = input || {};
    const q = [];
    for (const a of (d.approvalsAwaiting || [])) q.push(item({ bucket: 'NEEDS_OWNER_NOW', reason: 'Outreach/sample draft awaiting owner approval', priority: 1, leadId: a.leadId, nextAction: 'Review and approve (then send by hand)', ownerDecisionRequired: true, dueDate: a.dueDate }));
    for (const s of (d.sampleDecisions || [])) q.push(item({ bucket: 'NEEDS_OWNER_NOW', reason: 'Sample candidate needs an owner decision', priority: 1, leadId: s.leadId, nextAction: 'Decide on the sample (budget-checked)', ownerDecisionRequired: true }));
    for (const r of (d.repliesToReview || [])) q.push(item({ bucket: 'TODAY', reason: 'New reply to review', priority: 2, leadId: r.leadId, nextAction: 'Read the reply and respond' }));
    for (const f of (d.followUpsDue || [])) q.push(item({ bucket: 'TODAY', reason: 'Follow-up due', priority: 2, leadId: f.leadId, nextAction: 'Draft a follow-up (suppression-checked)', dueDate: f.dueDate }));
    for (const w of (d.watch || [])) q.push(item({ bucket: 'WATCH', reason: w.reason || 'Keep an eye on this', priority: 4, leadId: w.leadId, nextAction: w.nextAction || 'Monitor' }));
    for (const b of (d.blocked || [])) q.push(item({ bucket: 'BLOCKED', reason: b.reason || 'Blocked on an owner/external input', priority: 3, leadId: b.leadId, nextAction: b.nextAction || 'Supply the missing input', ownerDecisionRequired: true }));
    for (const t of (d.thisWeek || [])) q.push(item({ bucket: 'THIS_WEEK', reason: t.reason || 'Scheduled this week', priority: 3, leadId: t.leadId, nextAction: t.nextAction || 'Plan' }));

    const byBucket = {}; for (const b of BUCKETS) byBucket[b] = [];
    for (const it of q) byBucket[it.bucket].push(it);
    for (const b of BUCKETS) byBucket[b].sort((a, b2) => a.priority - b2.priority);
    const counts = {}; for (const b of BUCKETS) counts[b] = byBucket[b].length;
    return { byBucket, counts, total: q.length,
      noExternalSideEffects: q.every(it => it.externalSideEffect === false),
      guard: 'A to-do list for the owner. Nothing here sends, approves, or acts automatically.' };
  }

  return { BUCKETS, item, build };
}));
