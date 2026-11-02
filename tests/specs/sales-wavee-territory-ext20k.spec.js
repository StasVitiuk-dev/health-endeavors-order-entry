// Reserve IV — WAVE E: territory honesty. E5: actual coverage is distinct from
// missing geography. E6: a territory is NOT scored as low-potential merely
// because its data is sparse — unknown quality stays UNKNOWN and is surfaced as
// "needs scoring", never ranked low. E7: comparisons state their denominators.
// Pure, deterministic. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const TER = require('../../assets/sales/he-sales-territory.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('E6: an unscored (sparse) territory is UNKNOWN with a null whitespace score, not 0', () => {
  const rows = [
    { state: 'TX', scoring: { score: 90, serious: true } }, // scored, rankable
    { state: 'NV' }, // prospect exists but unscored -> UNKNOWN quality
    { state: 'NV' },
  ];
  const byState = TER.byState(rows).map(TER.score);
  const nv = byState.find(t => t.key === 'NV');
  expect(nv.rankable).toBe(false);
  expect(nv.whitespaceScore).toBeNull();      // NOT 0
  expect(nv.whitespaceLabel).toBe('UNKNOWN');
  expect(nv.reasons.join(' ')).toMatch(/needs scoring, not low potential/i);
});

test('E6: the white-space ranking excludes unknown-quality territories entirely', () => {
  const rows = [
    { state: 'TX', scoring: { score: 90, serious: true } },
    { state: 'NV' }, { state: 'NV' }, // unscored
  ];
  const ws = TER.whitespace(rows, 'state');
  expect(ws.map(t => t.key)).not.toContain('NV');     // never shown as low white-space
  const a = TER.analyze(rows);
  expect(a.needsData.map(t => t.key)).toContain('NV'); // surfaced honestly instead
  expect(a.guard).toMatch(/not low potential/i);
});

test('E6: a genuinely low-quality (but scored) territory still ranks, distinct from unknown', () => {
  const rows = [
    { state: 'CA', scoring: { score: 85, serious: true } },
    { state: 'AL', scoring: { score: 20, serious: true } }, // scored but weak
  ];
  const ws = TER.whitespace(rows, 'state');
  const keys = ws.map(t => t.key);
  expect(keys).toContain('AL');            // low-but-known is rankable
  expect(ws.find(t => t.key === 'AL').rankable).toBe(true);
  expect(ws[0].key).toBe('CA');            // higher quality ranks first
});

test('E5/E7: coverage uses an explicit denominator and is null when none qualified', () => {
  const rows = [
    { state: 'OR', scoring: { score: 70, serious: true }, won: true, pipelineState: 'CUSTOMER' },
    { state: 'WA' }, // unqualified -> coverage denominator is 0
  ];
  const byState = TER.byState(rows);
  const wa = byState.find(t => t.key === 'WA');
  expect(wa.coverage).toBeNull();          // no qualified -> no fabricated coverage
  const or = byState.find(t => t.key === 'OR');
  expect(or.qualified).toBeGreaterThanOrEqual(1);
});

test('backward compatible: fully-scored whitespace ranking unchanged', () => {
  const rows = [
    { state: 'CA', scoring: { score: 90, serious: true } },
    { state: 'CA', scoring: { score: 85, serious: true } },
    { state: 'NY', scoring: { score: 88, serious: true }, won: true, pipelineState: 'CUSTOMER' },
  ];
  const ws = TER.whitespace(rows, 'state');
  expect(ws[0].key).toBe('CA');
});
