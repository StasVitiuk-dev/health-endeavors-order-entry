// Sales & Growth: AI cost control + routing (assets/sales/he-sales-cost.js).
const { test, expect } = require('@playwright/test');
const K = require('../../assets/sales/he-sales-cost.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('deterministic tasks route to NO AI (tier none), never escalate', () => {
  for (const t of ['count', 'sort', 'filter', 'dedupe', 'totals', 'lead_score', 'sample_candidate_score', 'metrics', 'search']) {
    expect(K.route(t).tier).toBe('none');
  }
});

test('routine reasoning uses cheap; hard/high-value uses strong; second opinion is opt-in only', () => {
  expect(K.route('classify_reply').tier).toBe('cheap');
  expect(K.route('draft_followup').tier).toBe('cheap');
  expect(K.route('draft_intro_personalized').tier).toBe('strong');
  expect(K.route('chief_of_staff').secondOpinion).toBe(false);
  expect(K.route('draft_reply_difficult', { highValue: true, ambiguous: true }).secondOpinion).toBe(true);
  expect(K.route('draft_reply_difficult', { highValue: true }).secondOpinion).toBe(false); // needs BOTH
  expect(K.route('something_unknown').tier).toBe('cheap'); // never strong, never auto-escalate
});

test('estimateCost: none is free; cheap < strong for the same tokens', () => {
  expect(K.estimateCost('none', 100000, 100000)).toBe(0);
  const cheap = K.estimateCost('cheap', 1000, 1000);
  const strong = K.estimateCost('strong', 1000, 1000);
  expect(cheap).toBeGreaterThan(0);
  expect(strong).toBeGreaterThan(cheap);
});

test('ledger: deterministic work costs nothing and never throws, even at huge scale', () => {
  const L = K.createLedger({ dailyBudget: 1, monthlyBudget: 20 });
  let aiCalls = 0;
  for (let i = 0; i < 10000; i++) {
    const r = L.route('lead_score');
    if (r.tier !== 'none') aiCalls++;
    L.spend('scorer', r.tier, 500, 200, { day: '2026-10-19', month: '2026-10' });
  }
  expect(aiCalls).toBe(0);
  expect(L.totals('2026-10-19', '2026-10').daySpent).toBe(0);
});

test('ledger: hard stop prevents runaway spend', () => {
  const L = K.createLedger({ dailyBudget: 0.01, monthlyBudget: 0.02 });
  // strong drafts cost real money; keep spending until the hard stop throws.
  let threw = false;
  try { for (let i = 0; i < 50; i++) L.spend('drafter', 'strong', 2000, 2000, { day: '2026-10-19', month: '2026-10' }); }
  catch (e) { threw = true; expect(String(e.message)).toMatch(/hard stop/); }
  expect(threw).toBe(true);
  expect(L.totals('2026-10-19', '2026-10').daySpent).toBeLessThanOrEqual(0.01);
});

test('ledger: canSpend warns as it approaches budget but still allows until the limit', () => {
  const L = K.createLedger({ dailyBudget: 1, monthlyBudget: 20, warnFraction: 0.5 });
  expect(L.canSpend(0.6, '2026-10-19', '2026-10')).toMatchObject({ ok: true, warn: true });
  expect(L.canSpend(0.1, '2026-10-19', '2026-10')).toMatchObject({ ok: true, warn: false });
  expect(L.canSpend(2, '2026-10-19', '2026-10').ok).toBe(false);
});
