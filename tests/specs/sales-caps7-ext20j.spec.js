// Sales & Growth new capability modules: creator prospects/ROI/safety,
// sample candidate ranking + fraud watcher, what-changed digest + reviews.
const { test, expect } = require('@playwright/test');
const CRE = require('../../assets/sales/he-sales-creator.js');
const SA = require('../../assets/sales/he-sales-sampleadvisor.js');
const CH = require('../../assets/sales/he-sales-changes.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// ---------- creator ----------
test('creator: ranking is deterministic, on-niche wins, safety flags all false', () => {
  const ranked = CRE.fixtures();
  expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
  // every hard safety switch is false (no auto-contact / payment / claims / rights)
  for (const c of ranked) {
    expect(c.safety.autoContact).toBe(false);
    expect(c.safety.paymentPromise).toBe(false);
    expect(c.safety.medicalClaim).toBe(false);
    expect(c.safety.usageRightsAssumed).toBe(false);
    expect(c.outreachDraft).toBe(null); // nothing drafted/sent automatically
  }
});

test('creator: ROI keeps attribution UNKNOWN, never fabricated', () => {
  const r = CRE.roi({ sampleCost: 40, traffic: null, attributedOrders: null });
  expect(r.attribution).toMatch(/UNKNOWN/);
  expect(r.trafficLabel).toBe('UNKNOWN');
  expect(r.note).toMatch(/no creator is contacted/i);
});

// ---------- sample advisor ----------
test('sample advisor: ranks by fit/value and penalizes prior sampling', () => {
  const r = SA.rank([
    { id: 'a', storeName: 'Big Spa Group', scoring: { score: 80 }, replyQuality: 'strong', likelyOrderSize: 'large', locations: 4, priorSamples: 0 },
    { id: 'b', storeName: 'Repeat Sampler', scoring: { score: 80 }, replyQuality: 'strong', likelyOrderSize: 'large', locations: 4, priorSamples: 3 },
  ], 5);
  expect(r.ranked[0].id).toBe('a');             // same base, 'b' penalized for prior samples
  expect(r.guard).toMatch(/owner approves every sample/i);
});

test('sample advisor: fraud watcher flags repeated domain/contact and aliases', () => {
  const reqs = [
    { id: 1, storeName: 'Spa One', email: 'a@sketchy.example.com', website: 'sketchy.example.com' },
    { id: 2, storeName: 'Spa Two', email: 'b@sketchy.example.com', website: 'www.sketchy.example.com' },
    { id: 3, storeName: 'Spa Three', email: 'a@sketchy.example.com', website: 'sketchy.example.com' },
  ];
  const r = SA.fraudScan(reqs, { maxPerDomain: 2 });
  const kinds = new Set(r.flags.map(f => f.kind));
  expect(kinds).toContain('repeated-domain');
  expect(kinds).toContain('repeated-contact');
  expect(kinds).toContain('possible-alias');
  expect(r.guard).toMatch(/no request is auto-denied or approved/i);
});

// ---------- changes ----------
test('changes: digest buckets material events into the four windows', () => {
  const asOf = '2026-10-19T12:00:00Z';
  const ev = [
    { at: '2026-10-19T09:00:00Z', kind: 'new_lead' },
    { at: '2026-10-19T10:00:00Z', kind: 'reply' },
    { at: '2026-10-18T10:00:00Z', kind: 'customer_won' },
    { at: '2026-10-14T10:00:00Z', kind: 'dnc' },
    { at: '2026-09-25T10:00:00Z', kind: 'opportunity_lost' },
    { at: '2026-10-19T09:30:00Z', kind: 'not_material' }, // ignored
  ];
  const d = CH.digest(ev, asOf);
  expect(d.today.new_lead).toBe(1);
  expect(d.today.reply).toBe(1);
  expect(d.yesterday.customer_won).toBe(1);
  expect(d.last7.dnc).toBe(1);
  expect(d.last30.opportunity_lost).toBe(1); // Sep 25 -> Oct 19 is ~24 days, within 30
});

test('changes: weekly review surfaces risks and keeps topSources UNKNOWN without data', () => {
  const asOf = '2026-10-19T12:00:00Z';
  const ev = [
    { at: '2026-10-15T10:00:00Z', kind: 'dnc' },
    { at: '2026-10-16T10:00:00Z', kind: 'agent_failure' },
    { at: '2026-10-17T10:00:00Z', kind: 'opportunity_lost' },
  ];
  const r = CH.review(ev, 7, asOf);
  expect(r.optOuts).toBe(1);
  expect(r.agentFailures).toBe(1);
  expect(r.topSourcesLabel).toBe('UNKNOWN');
  expect(r.risks.length).toBeGreaterThanOrEqual(2);
});
