// Sales & Growth new capability modules: content, campaign lab, forecast.
// Draft-only / simulation-only; claim firewall blocks unsafe content; forecasts
// are labelled ESTIMATE/SIMULATION/NOT_GUARANTEED; inventory scenarios never
// reserve stock.
const { test, expect } = require('@playwright/test');
const CON = require('../../assets/sales/he-sales-content.js');
const CAM = require('../../assets/sales/he-sales-campaign.js');
const FC = require('../../assets/sales/he-sales-forecast.js');
const CLAIMS = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// ---------- content ----------
test('content: an unsafe claim BLOCKS and can never be approved', () => {
  const items = CON.fixtures().map(it => CON.checkClaims(it, CLAIMS.scan));
  const bad = items.find(it => /cures eczema/.test(it.topic));
  expect(bad.claimStatus).toBe('BLOCKED');
  expect(bad.status).toBe('BLOCKED');
  expect(() => CON.advance(bad, 'APPROVED', { ownerApproved: true })).toThrow(/illegal|claims/);
});

test('content: a safe item advances only with a claim check + owner approval', () => {
  let it = CON.checkClaims(CON.opportunity('faq', 'What is your wholesale MOQ?'), CLAIMS.scan);
  expect(it.claimStatus).toBe('SAFE');
  it = CON.advance(it, 'DRAFT');
  it = CON.advance(it, 'OWNER_REVIEW');
  expect(() => CON.advance(it, 'APPROVED')).toThrow(/owner approval/); // no ownerApproved flag
  it = CON.advance(it, 'APPROVED', { ownerApproved: true });
  expect(it.status).toBe('APPROVED');
  it = CON.advance(it, 'SCHEDULED');
  expect(it.status).toBe('SCHEDULED');
});

test('content: unchecked claims cannot be approved (fails closed); calendar groups by status', () => {
  const raw = CON.opportunity('blog', 'Seasonal gift sets');
  // skip the claim check entirely -> UNCHECKED
  let it = CON.advance(raw, 'DRAFT'); it = CON.advance(it, 'OWNER_REVIEW');
  expect(() => CON.advance(it, 'APPROVED', { ownerApproved: true })).toThrow(/unchecked|blocked/i);
  const cal = CON.calendar(CON.fixtures());
  expect(cal.total).toBe(8);
  expect(cal.guard).toMatch(/nothing is published/i);
});

// ---------- campaign ----------
test('campaign: variant scores are deterministic and claim warnings surface', () => {
  const safe = CAM.variant('subject', 'A quick note for your {{store}} — small-batch body balm', CLAIMS.scan);
  expect(safe.claimWarnings).toBe(0);
  expect(safe.personalizationScore).toBeGreaterThan(0);
  const unsafe = CAM.variant('cta', 'Our balm cures eczema — reply to order', CLAIMS.scan);
  expect(unsafe.claimWarnings).toBeGreaterThan(0);
  expect(unsafe.claimSafe).toBe(false);
});

test('campaign: compare ranks claim-safe variants above unsafe ones', () => {
  const vs = [
    CAM.variant('subject', 'Our balm cures eczema!!!', CLAIMS.scan),
    CAM.variant('subject', 'Wholesale body-care for your {{store}} boutique', CLAIMS.scan),
  ];
  const r = CAM.compare(vs);
  expect(r.best.claimSafe).toBe(true);
  expect(r.guard).toMatch(/no variant is sent/i);
});

test('campaign: volume simulation scales workload/cost and is labelled SIMULATION', () => {
  const table = CAM.volumeTable([5, 50]);
  expect(table[0].label).toBe('SIMULATION');
  expect(table[1].ownerMinutes).toBeGreaterThan(table[0].ownerMinutes);
  expect(table[1].estCost).toBeGreaterThan(table[0].estCost);
});

// ---------- forecast ----------
test('forecast: weighted pipeline splits high-confidence vs speculative, labelled', () => {
  const w = FC.weightedPipeline({ NEW: 50, INTERESTED: 10, WHOLESALE_DISCUSSION: 4, LOST: 9 });
  expect(w.label).toBe('ESTIMATE');
  expect(w.note).toBe('NOT_GUARANTEED');
  expect(w.highConfidence).toBeLessThanOrEqual(w.weighted);
  expect(w.rawIfAllClosed).toBeGreaterThan(w.weighted);
});

test('forecast: inventory-constrained reports status without reserving stock', () => {
  expect(FC.inventoryConstrained({ available: null, wholesaleDemand: 10 }).status).toBe('NOT_ENOUGH_DATA');
  expect(FC.inventoryConstrained({ available: 100, retailReserve: 40, sampleReserve: 10, wholesaleDemand: 30 }).status).toBe('SAFE');
  expect(FC.inventoryConstrained({ available: 100, retailReserve: 80, sampleReserve: 10, wholesaleDemand: 30 }).status).toBe('REVIEW');
  expect(FC.inventoryConstrained({ available: 50, retailReserve: 40, sampleReserve: 20, wholesaleDemand: 5 }).status).toBe('OVERCOMMITTED');
  expect(FC.inventoryConstrained({ available: 100, retailReserve: 0, sampleReserve: 0, wholesaleDemand: 1 }).note).toMatch(/no stock is reserved/i);
});

test('forecast: revenue scenario is a labelled simulation with sane funnel math', () => {
  const r = FC.revenueScenario({ leadVolume: 1000, replyRate: 0.2, interestRate: 0.25, conversionRate: 0.2, avgFirstOrder: 300, repeatOrders: 1 });
  expect(r.label).toBe('SIMULATION');
  expect(r.replies).toBe(200);
  expect(r.interested).toBe(50);
  expect(r.customers).toBe(10);
  expect(r.grossSales).toBe(6000);
});
