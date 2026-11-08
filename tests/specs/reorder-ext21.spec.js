// Inventory reorder & cash flow engine — unit tests (Phase 2). Pure, Node-only,
// synthetic. Covers availability reconciliation (reserved/damaged/samples/
// in-transit), days of cover, zero-activity vs unknown-demand, manual-threshold
// fallback, pack/MOQ rounding, cash ranges, and duplicate-proposal dedupe.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RO = require('../../assets/inventory/he-reorder.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('availability excludes damaged, subtracts reserved + samples, reports incoming separately', () => {
  const a = RO.availability({ onHand: 100, reserved: 10, damaged: 5, sampleReserved: 2, inTransit: 50 });
  expect(a.available).toBe(88); // 100 - 10 - 2
  expect(a.incoming).toBe(50);
  const unknown = RO.availability({ reserved: 3 });
  expect(unknown.available).toBe(null);
});

test('days of cover separates zero activity from unknown demand', () => {
  expect(RO.daysOfCover(88, 4)).toMatchObject({ basis: 'ESTIMATED' });
  expect(RO.daysOfCover(88, 4).days).toBeCloseTo(22, 5);
  expect(RO.daysOfCover(88, 0)).toMatchObject({ basis: 'ZERO_ACTIVITY', days: Infinity });
  expect(RO.daysOfCover(88, null)).toMatchObject({ basis: 'UNKNOWN', days: null });
  expect(RO.daysOfCover(null, 4)).toMatchObject({ basis: 'UNKNOWN' });
});

test('velocity-driven reorder: fires when cover is below lead+safety, with a scenario range', () => {
  const p = RO.reorderProposal({ sku: 'HE-HONEY-8OZ', kind: 'finished', onHand: 40, reserved: 0, velocityPerDay: 4, leadTimeDays: 20, unitCost: 6, packSize: 12, moq: 24 });
  expect(p.decision).toBe('reorder');
  expect(p.quantity).toBeGreaterThan(0);
  expect(p.quantity % 12).toBe(0);           // rounded to pack size
  expect(p.quantity).toBeGreaterThanOrEqual(24); // >= MOQ
  expect(Array.isArray(p.quantityRange)).toBe(true);
  expect(p.quantityRange[0]).toBeLessThanOrEqual(p.quantityRange[1]);
  expect(p.cashRange[0]).toBeLessThanOrEqual(p.cashRange[1]);
  expect(p.runoutDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('well-stocked item: no reorder', () => {
  const p = RO.reorderProposal({ sku: 'HE-VEGAN-8OZ', onHand: 1000, velocityPerDay: 2, leadTimeDays: 20, unitCost: 6 });
  expect(p.decision).toBe('none');
  expect(p.quantity).toBe(0);
});

test('zero activity (known) does not trigger a velocity reorder', () => {
  const p = RO.reorderProposal({ sku: 'HE-DISCONTINUED', onHand: 5, velocityPerDay: 0, leadTimeDays: 20, unitCost: 6 });
  expect(p.decision).toBe('none');
  expect(p.coverBasis).toBe('ZERO_ACTIVITY');
});

test('unknown demand falls back to a manual threshold and is flagged sparse', () => {
  const below = RO.reorderProposal({ sku: 'CARTON-2JAR', kind: 'component', onHand: 20, velocityPerDay: null, reorderThreshold: 50, unitCost: 0.4, packSize: 25 });
  expect(below.decision).toBe('reorder_manual');
  expect(below.sparse).toBe(true);
  expect(below.quantity % 25).toBe(0);
  const above = RO.reorderProposal({ sku: 'CARTON-2JAR', onHand: 200, velocityPerDay: null, reorderThreshold: 50 });
  expect(above.decision).toBe('none');
});

test('unknown demand with no threshold, or unknown on-hand, needs owner data (never guessed)', () => {
  const noThresh = RO.reorderProposal({ sku: 'PUMP-BLACK', velocityPerDay: null, onHand: 10 });
  expect(noThresh.decision).toBe('needs_data');
  const noCount = RO.reorderProposal({ sku: 'LABEL-HONEY', velocityPerDay: 3, leadTimeDays: 14 });
  expect(noCount.decision).toBe('needs_data');
  expect(noCount.sparse).toBe(true);
});

test('cost unknown yields an UNKNOWN cash label, not a fake 0', () => {
  const p = RO.reorderProposal({ sku: 'BOTTLE-8OZ', kind: 'component', onHand: 10, velocityPerDay: 5, leadTimeDays: 20 });
  expect(p.decision).toBe('reorder');
  expect(p.cash).toBe(null);
  expect(p.cashLabel).toBe('UNKNOWN');
});

test('reorderPlan dedupes repeated suggestions and totals only known cash', () => {
  const items = [
    { sku: 'HE-HONEY-8OZ', onHand: 40, velocityPerDay: 4, leadTimeDays: 20, unitCost: 6, packSize: 12 },
    { sku: 'HE-HONEY-8OZ', onHand: 40, velocityPerDay: 4, leadTimeDays: 20, unitCost: 6, packSize: 12 }, // duplicate
    { sku: 'BOTTLE-8OZ', kind: 'component', onHand: 10, velocityPerDay: 5, leadTimeDays: 20 },           // no cost
    { sku: 'HE-VEGAN-8OZ', onHand: 1000, velocityPerDay: 2, leadTimeDays: 20, unitCost: 6 },             // no reorder
  ];
  const plan = RO.reorderPlan(items);
  expect(plan.proposals.find((p, i) => i === 1).duplicate).toBe(true);
  // actionable: one HONEY (dup excluded) + one BOTTLE; VEGAN not actionable
  expect(plan.actionable.map(p => p.key).sort()).toEqual(['BOTTLE-8OZ', 'HE-HONEY-8OZ']);
  expect(plan.cashUnknownCount).toBe(1); // BOTTLE has no unit cost
  expect(plan.cashTotal).toBeGreaterThan(0);
});
