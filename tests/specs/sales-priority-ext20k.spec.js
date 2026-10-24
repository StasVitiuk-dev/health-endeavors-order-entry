// Reserve IV — PRIORITIZATION ENGINE v2 (decision intelligence).
// Explainable weighted ranking + preference sensitivity. Pure, deterministic,
// no side effects. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const P = require('../../assets/sales/he-sales-priority.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const LEADS = [
  { id: 'a', name: 'Big Spa Group', factors: { value: 0.9, fit: 0.8, urgency: 0.5, momentum: 0.6, effort: 0.3, risk: 0.2 } },
  { id: 'b', name: 'Corner Shop', factors: { value: 0.3, fit: 0.5, urgency: 0.2, momentum: 0.2, effort: 0.8, risk: 0.6 } },
  { id: 'c', name: 'Urgent Reorder', factors: { value: 0.6, fit: 0.6, urgency: 0.95, momentum: 0.9, effort: 0.4, risk: 0.1 } },
];

test('weights normalize to 1 and fall back to equal when empty/invalid', () => {
  const w = P.normalizeWeights({ value: 2, fit: 2 });
  const sum = P.FACTOR_KEYS.reduce((s, k) => s + w[k], 0);
  expect(sum).toBeCloseTo(1, 10);
  expect(w.value).toBeCloseTo(0.5, 10);
  const eq = P.normalizeWeights({});
  expect(eq.value).toBeCloseTo(1 / 6, 10);
  const bad = P.normalizeWeights({ value: -5, fit: NaN });
  expect(P.FACTOR_KEYS.reduce((s, k) => s + bad[k], 0)).toBeCloseTo(1, 10);
});

test('score is in 0..1, cost-like factors (effort, risk) count inverted', () => {
  const s = P.score(LEADS[0], P.DEFAULT_WEIGHTS);
  expect(s.total).toBeGreaterThan(0);
  expect(s.total).toBeLessThanOrEqual(1);
  // effort raw 0.3 -> effective 0.7 (lower effort is better)
  const eff = s.contributions.find(c => c.factor === 'effort');
  expect(eff.effective).toBeCloseTo(0.7, 10);
  const risk = s.contributions.find(c => c.factor === 'risk');
  expect(risk.effective).toBeCloseTo(0.8, 10);
  // contributions sum to total
  expect(s.contributions.reduce((a, c) => a + c.contribution, 0)).toBeCloseTo(s.total, 10);
  expect(s.explain).toMatch(/Account value/);
});

test('ranking is deterministic and the strong account leads under default weights', () => {
  const r1 = P.rank(LEADS, P.DEFAULT_WEIGHTS);
  const r2 = P.rank(LEADS.slice().reverse(), P.DEFAULT_WEIGHTS);
  expect(r1.ranked.map(x => x.leadId)).toEqual(r2.ranked.map(x => x.leadId));
  expect(r1.ranked[0].leadId).toBe('a');
  expect(r1.ranked[0].rank).toBe(1);
  expect(r1.guard).toMatch(/contacts no one/i);
});

test('raising the urgency weight promotes the urgent-reorder lead (sensitivity)', () => {
  const s = P.sensitivity(LEADS, P.DEFAULT_WEIGHTS, { factor: 'urgency', delta: 2 });
  // c is high urgency+momentum; a big urgency bump should move it up.
  const cMove = s.moves.find(m => m.leadId === 'c');
  expect(cMove).toBeTruthy();
  expect(cMove.move).toBeGreaterThan(0); // moved toward rank 1
  expect(s.stability).toBeGreaterThanOrEqual(0);
  expect(s.stability).toBeLessThanOrEqual(1);
  expect(s.guard).toMatch(/no side effects/i);
});

test('a zero-delta sensitivity changes nothing; unknown factor throws', () => {
  const s = P.sensitivity(LEADS, P.DEFAULT_WEIGHTS, { factor: 'value', delta: 0 });
  expect(s.changed).toBe(0);
  expect(s.maxMove).toBe(0);
  expect(s.topChanged).toBe(false);
  expect(s.stability).toBe(1);
  expect(() => P.sensitivity(LEADS, P.DEFAULT_WEIGHTS, { factor: 'nope' })).toThrow(/unknown factor/);
});

test('sensitivityAll ranks factors by influence and names the most influential', () => {
  const all = P.sensitivityAll(LEADS, P.DEFAULT_WEIGHTS, 1);
  expect(all.rows.length).toBe(P.FACTOR_KEYS.length);
  expect(P.FACTOR_KEYS).toContain(all.mostInfluential);
  // rows are sorted by churn (changed desc)
  for (let i = 1; i < all.rows.length; i++) {
    expect(all.rows[i - 1].changed).toBeGreaterThanOrEqual(all.rows[i].changed);
  }
});

test('empty input is safe', () => {
  const r = P.rank([], P.DEFAULT_WEIGHTS);
  expect(r.count).toBe(0);
  expect(r.ranked).toEqual([]);
  const s = P.sensitivity([], P.DEFAULT_WEIGHTS, { factor: 'value' });
  expect(s.changed).toBe(0);
  expect(s.stability).toBe(1);
});
