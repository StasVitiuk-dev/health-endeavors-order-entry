// Reserve IV — scalability of the decision-intelligence engines. They must stay
// correct AND fast at volume (1k / 10k / 50k synthetic rows), so wiring them to
// a large pipeline later can never hang the owner's page. Pure Node, no DOM.
// Node-only (desktop project).
//
// D1 (Wave D) — SCOPE: this file measures PURE-ENGINE compute time only (no DOM,
// no render, no navigation). The flag-ON browser side (engine-vs-render
// separation, repeated-navigation DOM stability) lives in
// sales-decision-perf-ext20k.spec.js. Budgets here are wall-clock ms on the CI
// runner and carry run-to-run variance; they are correctness-plus-ceiling
// checks, not production capacity claims.
const { test, expect } = require('@playwright/test');
const P = require('../../assets/sales/he-sales-priority.js');
const PR = require('../../assets/sales/he-sales-progression.js');
const C = require('../../assets/sales/he-sales-concentration.js');
const N = require('../../assets/sales/he-sales-nextaction.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// A deterministic pseudo-random generator so the data (and timings) are stable.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904187) >>> 0; return s / 4294967296; }; }

function makeLeads(n) {
  const r = rng(42);
  const states = PR.FUNNEL_ORDER.concat(['DECLINED', 'DO_NOT_CONTACT', 'LOST']);
  const asOf = Date.parse('2026-10-20T00:00:00Z');
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 'L' + i, name: 'Lead ' + i,
      state: states[Math.floor(r() * states.length)],
      createdAt: new Date(asOf - Math.floor(r() * 120) * 86400000).toISOString(),
      enteredStateAt: new Date(asOf - Math.floor(r() * 60) * 86400000).toISOString(),
      factors: { value: r(), fit: r(), urgency: r(), momentum: r(), effort: r(), risk: r() },
      account: 'ACC' + Math.floor(r() * (n / 10 + 1)),
      weightedValue: Math.floor(r() * 100) + 1,
    });
  }
  return out;
}

for (const n of [1000, 10000, 50000]) {
  test(`priority.rank stays correct and under budget at ${n}`, () => {
    const leads = makeLeads(n);
    const t0 = Date.now();
    const r = P.rank(leads, P.DEFAULT_WEIGHTS);
    const ms = Date.now() - t0;
    expect(r.count).toBe(n);
    // ranks are a 1..n permutation, sorted by total desc
    expect(r.ranked[0].rank).toBe(1);
    expect(r.ranked[n - 1].rank).toBe(n);
    for (let i = 1; i < r.ranked.length; i++) expect(r.ranked[i - 1].total).toBeGreaterThanOrEqual(r.ranked[i].total);
    expect(ms).toBeLessThan(4000);
  });

  test(`progression.analyze stays correct and under budget at ${n}`, () => {
    const leads = makeLeads(n);
    const t0 = Date.now();
    const a = PR.analyze(leads, { asOf: '2026-10-20T00:00:00Z' });
    const ms = Date.now() - t0;
    expect(a.rows.length).toBe(n);
    // histogram covers everyone exactly once
    const sum = Object.values(a.histogram).reduce((s, v) => s + v, 0);
    expect(sum).toBe(n);
    // stalled are all non-terminal
    expect(a.stalled.every(r => !r.terminal)).toBe(true);
    expect(ms).toBeLessThan(4000);
  });

  test(`concentration.analyze stays correct and under budget at ${n}`, () => {
    const leads = makeLeads(n);
    const t0 = Date.now();
    const c = C.analyze(leads);
    const ms = Date.now() - t0;
    expect(c.dealCount).toBe(n);
    expect(c.top1Share).toBeGreaterThanOrEqual(0);
    expect(c.top1Share).toBeLessThanOrEqual(1);
    expect(c.dealHHI).toBeGreaterThan(0);
    expect(c.dealHHI).toBeLessThanOrEqual(1);
    expect(ms).toBeLessThan(4000);
  });

  test(`nextaction.recommendAll stays safe and under budget at ${n}`, () => {
    const leads = makeLeads(n);
    const t0 = Date.now();
    const r = N.recommendAll(leads);
    const ms = Date.now() - t0;
    expect(r.count).toBe(n);
    expect(r.noExternalSideEffects).toBe(true); // never an action, at any scale
    expect(ms).toBeLessThan(4000);
  });
}

test('priority ranking is identical across two runs at 10k (determinism at scale)', () => {
  const a = P.rank(makeLeads(10000), P.DEFAULT_WEIGHTS).ranked.map(x => x.leadId);
  const b = P.rank(makeLeads(10000), P.DEFAULT_WEIGHTS).ranked.map(x => x.leadId);
  expect(a).toEqual(b);
});
