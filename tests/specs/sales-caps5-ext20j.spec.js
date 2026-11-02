// Sales & Growth new capability modules: benchmark/gold harness, scorecards,
// provider matrices, safety center / kill switch / budgets.
const { test, expect } = require('@playwright/test');
const BM = require('../../assets/sales/he-sales-benchmark.js');
const SC = require('../../assets/sales/he-sales-scorecards.js');
const PR = require('../../assets/sales/he-sales-providers.js');
const SAF = require('../../assets/sales/he-sales-safety.js');
const REPLIES = require('../../assets/sales/he-sales-replies.js');
const CLAIMS = require('../../assets/sales/he-sales-claims.js');
const LEADS = require('../../assets/sales/he-sales-leads.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// ---------- benchmark ----------
test('benchmark: the deterministic reply classifier meets its gold baseline', () => {
  const r = BM.runSuite(BM.GOLD.reply, t => REPLIES.classify(t), res => res.label);
  expect(r.total).toBe(BM.GOLD.reply.length);
  expect(r.accuracy).toBeGreaterThanOrEqual(0.8);
  expect(BM.regression(r.accuracy, 0.8).pass).toBe(true);
});

test('benchmark: the claim firewall catches every unsafe gold case', () => {
  const r = BM.runSuite(BM.GOLD.claim, t => CLAIMS.scan(t), res => (res.findings && res.findings.length ? 'UNSAFE' : 'SAFE'));
  expect(r.accuracy).toBe(1); // firewall must be perfect on the gold set
});

test('benchmark: lead scoring bands match gold; regression fails below baseline', () => {
  const r = BM.runSuite(BM.GOLD.leadBand, l => LEADS.score(l), res => (res.serious ? 'serious' : 'weak'));
  expect(r.accuracy).toBeGreaterThanOrEqual(0.5);
  expect(BM.regression(0.4, 0.8).pass).toBe(false);
  expect(BM.regression(null, 0.8).pass).toBe(false); // UNKNOWN never passes
});

// ---------- scorecards ----------
test('scorecards: aggregate run history into per-agent rates + failure groups', () => {
  const runs = [
    { agent: 'Draft Writer', result: 'ok', approved: true, cost: 0.01, latencyMs: 500 },
    { agent: 'Draft Writer', result: 'ok', ownerEdited: true, cost: 0.012, latencyMs: 700 },
    { agent: 'Draft Writer', result: 'fail', failure: 'timeout', cost: 0, latencyMs: 30000 },
    { agent: 'Reply Classifier', result: 'ok', unknown: true, cost: 0, latencyMs: 2 },
  ];
  const cards = SC.scorecards(runs);
  const dw = cards.find(c => c.agent === 'Draft Writer');
  expect(dw.runs).toBe(3);
  expect(dw.correctness).toBeCloseTo(0.667, 2);
  expect(dw.ownerEditRate).toBeCloseTo(0.333, 2);
  const fa = SC.failureAnalysis(runs);
  expect(fa.byKind.timeout).toBe(1);
  expect(fa.top).toBe('timeout');
});

test('scorecards: trend direction across periods, UNKNOWN when unmeasurable', () => {
  const t = SC.trend([
    { label: 'wk1', runs: [{ agent: 'A', result: 'ok' }, { agent: 'A', result: 'fail', failure: 'timeout' }] },
    { label: 'wk2', runs: [{ agent: 'A', result: 'ok' }, { agent: 'A', result: 'ok' }] },
  ], 'A', 'correctness');
  expect(t.direction).toBe('UP');
  expect(SC.trend([], 'A', 'correctness').direction).toBe('UNKNOWN');
});

// ---------- providers ----------
test('providers: paid providers are not configured; fallback always floors at template', () => {
  expect(PR.byId('cheap').configured).toBe(false);
  expect(PR.byId('strong').configured).toBe(false);
  expect(PR.byId('template').configured).toBe(true);
  const chain = PR.fallbackChain(['strong', 'cheap', 'template']);
  expect(chain[chain.length - 1]).toBe('template'); // safe floor
  // unconfigured providers are skipped
  expect(chain).not.toContain('strong');
  const matrix = PR.costMatrix(500, 300);
  expect(matrix.find(m => m.provider === 'template').cost).toBe(0);
  expect(PR.chaos(['strong', 'cheap', 'template'])[0].fallsBackTo).toBe('template');
});

// ---------- safety ----------
test('safety: defaults are safe and invariants fail closed', () => {
  const d = SAF.defaults();
  expect(d.featureFlag).toBe(false);
  expect(d.sendEnabled).toBe(false);
  expect(SAF.assertInvariants(d)).toBe(true);
  expect(() => SAF.assertInvariants({ sendEnabled: true })).toThrow(/send mode/);
  expect(() => SAF.assertInvariants({ gmailConnected: true })).toThrow(/Gmail/);
  expect(() => SAF.assertInvariants({ productionDbConnected: true })).toThrow(/production DB/);
  expect(() => SAF.assertInvariants({ sampleOwnerOnly: false })).toThrow(/owner-only/);
});

test('safety: kill switch blocks AI runs; budget guard warns then hard-stops', () => {
  const on = SAF.killSwitch({ featureFlag: true }, true);
  expect(on.aiRunsAllowed).toBe(false);
  expect(SAF.canRunAI({ featureFlag: true, pauseAll: true }).ok).toBe(false);
  expect(SAF.canRunAI({ featureFlag: false }).ok).toBe(false);
  expect(SAF.canRunAI({ featureFlag: true }, { a: true }, 'a').ok).toBe(false);
  expect(SAF.canRunAI({ featureFlag: true }).ok).toBe(true);
  expect(SAF.budgetGuard(0.9, 1).warn).toBe(true);
  expect(SAF.budgetGuard(1, 1).hardStop).toBe(true);
  expect(SAF.budgetGuard(0.5, 1).ok).toBe(true);
});

test('safety: the safety center lists protective controls and all invariants hold', () => {
  const c = SAF.safetyCenter({ featureFlag: true });
  const send = c.rows.find(r => r.key === 'Send');
  expect(send.status).toMatch(/DISABLED/);
  expect(send.protective).toBe(true);
  expect(c.rows.find(r => r.key === 'Gmail connection').status).toMatch(/NOT CONNECTED/);
});
