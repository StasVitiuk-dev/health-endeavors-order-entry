// Reserve IV — PIPELINE CONCENTRATION & QUALITY RISK. HHI, top-N dependency,
// single-deal/single-account flags, thin pipeline. Pure, deterministic, no side
// effects. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const C = require('../../assets/sales/he-sales-concentration.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('HHI: perfectly spread -> low, everything in one -> 1', () => {
  expect(C.hhi([1, 1, 1, 1])).toBeCloseTo(0.25, 10); // 4 equal shares
  expect(C.hhi([10])).toBeCloseTo(1, 10);
  expect(C.hhi([])).toBe(0);
});

test('one dominant deal trips SINGLE_DEAL_DEPENDENCY and HIGH risk', () => {
  const r = C.analyze([
    { id: 'big', account: 'A', weightedValue: 80 },
    { id: 's1', account: 'B', weightedValue: 5 },
    { id: 's2', account: 'C', weightedValue: 5 },
    { id: 's3', account: 'D', weightedValue: 5 },
    { id: 's4', account: 'E', weightedValue: 5 },
  ]);
  expect(r.top1Share).toBeCloseTo(0.8, 10);
  expect(r.flags.map(f => f.code)).toContain('SINGLE_DEAL_DEPENDENCY');
  expect(r.riskLevel).toBe('HIGH');
  expect(r.topDeal.id).toBe('big');
});

test('one account spanning several deals trips SINGLE_ACCOUNT_DEPENDENCY', () => {
  const r = C.analyze([
    { id: 'd1', account: 'Mega', weightedValue: 30 },
    { id: 'd2', account: 'Mega', weightedValue: 30 },
    { id: 'd3', account: 'Small', weightedValue: 20 },
    { id: 'd4', account: 'Tiny', weightedValue: 20 },
  ]);
  expect(r.topAccountShare).toBeCloseTo(0.6, 10);
  expect(r.flags.map(f => f.code)).toContain('SINGLE_ACCOUNT_DEPENDENCY');
  expect(r.topAccount.account).toBe('Mega');
  // but no single DEAL exceeds 35%
  expect(r.flags.map(f => f.code)).not.toContain('SINGLE_DEAL_DEPENDENCY');
});

test('a well-spread pipeline is LOW risk with no flags', () => {
  const deals = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ id, account: id, weightedValue: 10 }));
  const r = C.analyze(deals);
  expect(r.flags).toEqual([]);
  expect(r.riskLevel).toBe('LOW');
  expect(r.top1Share).toBeCloseTo(1 / 6, 10);
  expect(r.dealHHI).toBeCloseTo(1 / 6, 10);
});

test('too few deals (none dominant) -> THIN_PIPELINE (medium)', () => {
  // 3 equal deals: each 33% (< 35% single-deal threshold, < 50% account), so
  // the only flag is the thin pipeline (< 5 active deals).
  const r = C.analyze([
    { id: 'a', account: 'A', weightedValue: 33 },
    { id: 'b', account: 'B', weightedValue: 33 },
    { id: 'c', account: 'C', weightedValue: 34 },
  ]);
  expect(r.flags.map(f => f.code)).toEqual(['THIN_PIPELINE']);
  expect(r.riskLevel).toBe('MEDIUM');
});

test('empty / zero-value pipeline -> EMPTY_PIPELINE, no crash, no fake totals', () => {
  const r = C.analyze([]);
  expect(r.total).toBe(0);
  expect(r.dealCount).toBe(0);
  expect(r.dealHHI).toBe(0);
  expect(r.topDeal).toBe(null);
  expect(r.flags.map(f => f.code)).toContain('EMPTY_PIPELINE');
  const z = C.analyze([{ id: 'x', account: 'X', weightedValue: 0 }, { id: 'y', weightedValue: -5 }]);
  expect(z.dealCount).toBe(0);
  expect(z.guard).toMatch(/sends nothing/i);
});

test('thresholds are configurable', () => {
  const deals = [{ id: 'a', account: 'A', weightedValue: 40 }, { id: 'b', account: 'B', weightedValue: 60 }];
  // default single-deal 0.35 -> 'b' at 0.6 trips; raise to 0.7 -> no deal flag
  const strict = C.analyze(deals, { singleDealShare: 0.7, minActiveDeals: 1 });
  expect(strict.flags.map(f => f.code)).not.toContain('SINGLE_DEAL_DEPENDENCY');
});
