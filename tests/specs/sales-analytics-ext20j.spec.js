// Sales & Growth: analytics (assets/sales/he-sales-analytics.js) —
// safe metric denominators, funnel SIMULATION, sample economics.
const { test, expect } = require('@playwright/test');
const A = require('../../assets/sales/he-sales-analytics.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('rate uses safe denominators: unknown/zero -> null, never a fake 0%', () => {
  expect(A.rate(3, 10)).toBe(0.3);
  expect(A.rate(0, 10)).toBe(0);     // a real 0 (10 contacted, 0 replies) is genuine
  expect(A.rate(5, 0)).toBe(null);   // no contacts -> UNKNOWN, not 0%
  expect(A.rate(5, undefined)).toBe(null);
  expect(A.rate(1, NaN)).toBe(null);
});

test('metrics returns null for rates whose denominator is zero/unknown', () => {
  const m = A.metrics({ contacted: 0, replies: 0, leads: 10, spend: 5 });
  expect(m.replyRate).toBe(null);          // 0 contacted
  expect(m.costPerLead).toBe(0.5);
  expect(m.costPerCustomer).toBe(null);    // 0 customers
});

test('funnel simulation is clearly labelled and monotonic non-increasing through stages', () => {
  const f = A.funnelSimulation(100, { draft: 1, contact: 0.9, reply: 0.3, interest: 0.5, sample: 0.4, customer: 0.5 });
  expect(f.label).toBe('SIMULATION');
  expect(f.drafts).toBeLessThanOrEqual(f.qualifiedLeads);
  expect(f.contacts).toBeLessThanOrEqual(f.drafts);
  expect(f.replies).toBeLessThanOrEqual(f.contacts);
  expect(f.customers).toBeGreaterThanOrEqual(0);
});

test('sample economics computes break-even and max sensible spend; UNKNOWN cost basis when nothing configured', () => {
  const e = A.sampleEconomics({ bottleCost: 4, shipCost: 6, packCost: 1, expectedOrder: 300, margin: 0.5, conversionRate: 0.25 });
  expect(e.sampleCost).toBe(11);
  expect(e.grossPerOrder).toBe(150);
  expect(e.breakEvenConversion).toBeCloseTo(11 / 150, 3);
  expect(e.maxSensibleSpendPerCustomer).toBe(150);
  expect(e.expectedGrossPerSample).toBe(150 * 0.25);
  const bare = A.sampleEconomics({ expectedOrder: 0, margin: 0 });
  expect(bare.breakEvenConversion).toBe(null);
  expect(bare.costBasis).toBe('UNKNOWN');
});
