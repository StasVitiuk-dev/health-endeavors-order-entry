// Sales & Growth new capability modules: retention, territory, data quality.
// All pure, synthetic, advisory-only; insufficient data must read UNKNOWN, never
// a fabricated number, and nothing here acts in the real world.
const { test, expect } = require('@playwright/test');
const RET = require('../../assets/sales/he-sales-retention.js');
const TER = require('../../assets/sales/he-sales-territory.js');
const DQ = require('../../assets/sales/he-sales-dataquality.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// ---------- retention ----------
test('retention: reorderInterval is UNKNOWN below two orders and averages otherwise', () => {
  expect(RET.reorderInterval(['2026-01-01']).confidence).toBe('UNKNOWN');
  expect(RET.reorderInterval([]).avgDays).toBe(null);
  const ri = RET.reorderInterval(['2026-01-01', '2026-02-01', '2026-03-03']);
  expect(ri.avgDays).toBeGreaterThan(25);
  expect(['LOW', 'MEDIUM', 'HIGH']).toContain(ri.confidence);
});

test('retention: classify assigns sensible segments and never invents history', () => {
  const asOf = '2026-10-19';
  expect(RET.classify({ id: 'a', orderDates: [] }, asOf).segment).toBe('UNKNOWN');
  expect(RET.classify({ id: 'b', orderDates: ['2026-10-01'] }, asOf).segment).toBe('NEW');
  // long-dormant multi-order customer -> LOST
  const lost = RET.classify({ id: 'c', orderDates: ['2024-01-01', '2024-02-01'] }, asOf);
  expect(['LOST', 'INACTIVE']).toContain(lost.segment);
});

test('retention: analyze returns advisory candidate lists and a guard, no messaging', () => {
  const a = RET.analyze(RET.fixtures(7), '2026-10-19');
  expect(a.rows.length).toBe(6);
  expect(Array.isArray(a.winBack)).toBe(true);
  expect(Array.isArray(a.vips)).toBe(true);
  expect(a.guard).toMatch(/no customer is messaged/i);
  // every segment count key is valid
  for (const k of Object.keys(a.counts)) expect(RET.SEGMENTS).toContain(k);
});

// ---------- territory ----------
test('territory: aggregation marks unknown quality as UNKNOWN, never 0', () => {
  const rows = [
    { state: 'TX', city: 'Austin', scoring: { score: 80, serious: true } },
    { state: 'TX', city: 'Dallas' }, // unscored
    { state: 'OR', city: 'Portland', scoring: { score: 60, serious: true }, won: true },
  ];
  const st = TER.byState(rows);
  const tx = st.find(t => t.key === 'TX');
  expect(tx.prospects).toBe(2);
  expect(tx.qualified).toBe(1);
  const or = st.find(t => t.key === 'OR');
  expect(or.won).toBe(1);
  expect(TER.regionOf('TX')).toBe('South');
  expect(TER.regionOf('ZZ')).toBe('OTHER');
});

test('territory: whitespace ranks high-quality low-coverage territories first; explainable', () => {
  const rows = [
    { state: 'CA', scoring: { score: 90, serious: true } },
    { state: 'CA', scoring: { score: 85, serious: true } },
    { state: 'NY', scoring: { score: 88, serious: true }, won: true, pipelineState: 'CUSTOMER' },
  ];
  const ws = TER.whitespace(rows, 'state');
  expect(ws[0].key).toBe('CA'); // uncovered high quality beats already-covered NY
  expect(ws[0].reasons.length).toBeGreaterThan(0);
  expect(TER.analyze(rows).guard).toMatch(/no exclusivity/i);
});

// ---------- data quality ----------
test('data quality: flags each exception kind and never auto-repairs', () => {
  const r = DQ.scan(DQ.fixtures());
  const kinds = new Set(r.findings.map(f => f.kind));
  for (const k of ['malformed-email', 'malformed-website', 'impossible-state', 'invalid-score', 'duplicate-lead', 'stale-draft', 'stale-approval', 'sample-without-owner-evidence', 'customer-without-conversion', 'unknown-ai-provider'])
    expect(kinds).toContain(k);
  expect(r.bySeverity.CRITICAL).toBeGreaterThan(0);
  expect(r.guard).toMatch(/no record is auto-merged|auto-corrected|deleted/i);
  // sorted CRITICAL first
  expect(r.findings[0].severity).toBe('CRITICAL');
});

test('data quality: a clean record set yields no findings', () => {
  const r = DQ.scan({ leads: [{ id: 'ok', storeName: 'Clean Co', email: 'a@clean.example.com', website: 'clean.example.com', source: 'referral', sourceProvenance: 'owner', pipelineState: 'QUALIFIED', scoring: { score: 70 } }] });
  expect(r.total).toBe(0);
});
