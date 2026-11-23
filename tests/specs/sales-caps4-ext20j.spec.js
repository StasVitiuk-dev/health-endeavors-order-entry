// Sales & Growth new capability modules: lead-detail dossier, lost deals,
// anomaly center, owner workload. All pure, read-only/advisory, synthetic.
const { test, expect } = require('@playwright/test');
const LD = require('../../assets/sales/he-sales-leaddetail.js');
const LOST = require('../../assets/sales/he-sales-lostdeals.js');
const AN = require('../../assets/sales/he-sales-anomaly.js');
const WL = require('../../assets/sales/he-sales-workload.js');
const LEADS = require('../../assets/sales/he-sales-leads.js');
const DQ = require('../../assets/sales/he-sales-dataquality.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// ---------- lead detail ----------
test('lead detail: dossier composes every section and stays read-only', () => {
  const lead = { id: 'SYN-1001', storeName: 'Cedar Day Spa', category: 'spa', city: 'Austin', state: 'TX',
    email: 'buyer@cedar.example.com', website: 'cedar.example.com', source: 'referral', pipelineState: 'INTERESTED',
    carriesSimilarBrands: true, synthetic: true };
  const history = {
    outreach: [{ at: '2026-10-01', summary: 'intro draft' }],
    replies: [{ at: '2026-10-05', text: 'interested, send pricing' }],
    followups: [{ at: '2026-10-09', summary: 'follow-up planned' }],
    samples: [], notes: [{ at: '2026-10-06', text: 'wants line sheet' }],
    audit: [{ at: '2026-10-05', kind: 'reply_received' }],
    aiRuns: [{ cost: 0.012 }, { cost: 0.004 }],
  };
  const d = LD.dossier(lead, history, { leads: LEADS, dataquality: DQ });
  expect(d.identity.storeName).toBe('Cedar Day Spa');
  expect(d.score.value).toBeGreaterThan(0);          // real scorer ran
  expect(d.nextBestAction.action).toMatch(/line sheet|terms|sample/i);
  expect(d.timeline.length).toBeGreaterThanOrEqual(4);
  expect(d.timeline[0].at <= d.timeline[d.timeline.length - 1].at).toBe(true); // time-ordered
  expect(d.aiUsage.estCost).toBeCloseTo(0.016, 3);
  expect(d.guard).toMatch(/read-only/i);
});

test('lead detail: next-best-action marks owner-decision states and blockers are owner input', () => {
  expect(LD.nextBestAction({ pipelineState: 'SAMPLE_CONSIDERATION' }).ownerDecision).toBe(true);
  expect(LD.nextBestAction({ pipelineState: 'NEW' }).ownerDecision).toBe(false);
  const blockers = LD.commercialBlockers({});
  expect(blockers.length).toBeGreaterThan(0);
  for (const b of blockers) expect(b.status).toBe('OWNER_INPUT_REQUIRED');
});

// ---------- lost deals ----------
test('lost deals: buckets reasons, normalizes unknowns, flags reopen candidates', () => {
  const deals = [
    { id: 1, reason: 'PRICE', storeType: 'spa', source: 'referral', state: 'TX', scoreValue: 40 },
    { id: 2, reason: 'timing', storeType: 'boutique', source: 'event', state: 'OR', scoreValue: 85 },
    { id: 3, reason: 'weird', storeType: 'salon', source: 'search', state: 'TX', scoreValue: 90 },
    { id: 4, reason: 'NO_RESPONSE', storeType: 'spa', source: 'social', state: 'NV', scoreValue: 75 },
  ];
  const a = LOST.analyze(deals);
  expect(a.total).toBe(4);
  expect(a.byReason.UNKNOWN).toBe(1);               // 'weird' -> UNKNOWN
  expect(a.reopenCandidates.length).toBe(2);        // timing(85) + no_response(75)
  expect(a.guard).toMatch(/nothing is contacted/i);
});

// ---------- anomaly ----------
test('anomaly: surfaces collapse/spike/backlog and sorts CRITICAL first', () => {
  const r = AN.scan({
    replyRate: 0.04, replyRateHistory: [0.2, 0.18, 0.22],
    bounceRate: 0.2, bounceBaseline: 0.05,
    dncToday: 12, dncBaseline: 2,
    followUpBacklog: 40,
    aiCostToday: 5, aiCostBaseline: 1,
    approvalBacklog: 30,
    sources: [{ name: 'cheap-list', leads: 50, conversion: 0 }],
  });
  const kinds = new Set(r.anomalies.map(a => a.kind));
  for (const k of ['reply-rate-collapse', 'bounce-spike', 'dnc-spike', 'ai-cost-spike', 'bad-lead-source', 'owner-approval-backlog', 'follow-up-backlog'])
    expect(kinds).toContain(k);
  expect(r.anomalies[0].severity).toBe('CRITICAL'); // dnc-spike
  expect(r.guard).toMatch(/nothing is paused/i);
});

test('anomaly: a healthy snapshot raises nothing', () => {
  const r = AN.scan({ replyRate: 0.2, replyRateHistory: [0.2, 0.21], bounceRate: 0.03, dncToday: 1, dncBaseline: 2, followUpBacklog: 2, aiCostToday: 1, aiCostBaseline: 1, approvalBacklog: 2 });
  expect(r.total).toBe(0);
});

// ---------- workload ----------
test('workload: estimates owner minutes and sustainability; durations UNKNOWN when empty', () => {
  const w = WL.workload({ draftsAwaiting: 10, repliesToReview: 5, samplesToDecide: 2, contentApprovals: 1, dailyBudgetMinutes: 60 });
  expect(w.totalItems).toBe(18);
  expect(w.estMinutes).toBe(10 * 2 + 5 * 3 + 2 * 4 + 1 * 5);
  expect(typeof w.sustainable).toBe('boolean');
  expect(WL.durationStats([]).label).toBe('UNKNOWN');
  const s = WL.durationStats([{ from: '2026-10-01', to: '2026-10-04' }, { from: '2026-10-01', to: '2026-10-03' }]);
  expect(s.count).toBe(2);
  expect(s.avgDays).toBeGreaterThan(0);
});
