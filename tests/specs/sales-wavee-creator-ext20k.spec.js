// Reserve IV — WAVE E: creator honesty (E8/E9/E10). Confirms the existing
// he-sales-creator already keeps audience fit, content rights, attribution and
// commercial outcome separate, never treats code use as proof of incremental
// demand, and represents unknown rights/attribution as unresolved. No code
// change — evidence that these acceptance items are already covered.
// Pure, deterministic. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const CRE = require('../../assets/sales/he-sales-creator.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('E8: fit separates audience reach from the rest; no public URL reads UNKNOWN reach', () => {
  const noUrl = CRE.fit({ niche: 'skincare', followers: 5000 });
  expect(noUrl.reasons.join(' ')).toMatch(/UNKNOWN reach/i);
  const withUrl = CRE.fit({ niche: 'skincare', followers: 5000, publicUrl: 'https://example.test/creator' });
  expect(withUrl.score).toBeGreaterThan(noUrl.score); // a public profile adds reach evidence
  expect(['strong', 'possible', 'weak']).toContain(withUrl.band);
});

test('E9/E10: ROI keeps attribution UNKNOWN and never asserts incremental demand', () => {
  const r = CRE.roi({ sampleCost: 40, traffic: null, attributedOrders: null });
  expect(r.attribution).toMatch(/UNKNOWN/);
  expect(r.trafficLabel).toBe('UNKNOWN');
  expect(r.note).toMatch(/no creator is contacted/i);
  // even with numbers present, attribution is never upgraded to a demand claim
  const r2 = CRE.roi({ sampleCost: 40, traffic: 100, attributedOrders: 5 });
  expect(r2.attribution).toMatch(/UNKNOWN/);         // code use != proven incremental demand
  expect(r2.conversion).toBeCloseTo(0.05, 4);        // a ratio, explicitly not causal
});

test('E10: safety flags never assume usage rights / payment / claims / auto-contact', () => {
  const ranked = CRE.rank(CRE.fixtures());
  expect(ranked.length).toBeGreaterThan(0);
  for (const c of ranked) {
    expect(c.safety.usageRightsAssumed).toBe(false);
    expect(c.safety.paymentPromise).toBe(false);
    expect(c.safety.medicalClaim).toBe(false);
    expect(c.safety.autoContact).toBe(false);
    expect(c.outreachDraft).toBeNull(); // nothing drafted or sent automatically
  }
});
