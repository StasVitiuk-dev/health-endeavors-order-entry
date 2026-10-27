// Reserve IV — WAVE E: retention correctness. E1: unknown purchase history is
// distinct from an inactive customer. E2: reorder timing stays hypothetical
// (confidence label) until there is enough history. E4: suppression/eligibility
// applies to every proposed lifecycle action — a DNC/opt-out customer is never
// proposed for contact. Pure, deterministic. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const RET = require('../../assets/sales/he-sales-retention.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const ASOF = '2026-10-20T00:00:00Z';

test('E1: no order history is UNKNOWN, not INACTIVE/LOST', () => {
  const unknown = RET.classify({ id: 'u', orderDates: [] }, ASOF);
  expect(unknown.segment).toBe('UNKNOWN');
  expect(unknown.reason).toMatch(/no order history/i);
  // a customer WITH history but a long gap is a different thing entirely
  const stale = RET.classify({ id: 's', orderDates: ['2024-01-01', '2024-02-01'] }, ASOF);
  expect(['INACTIVE', 'LOST']).toContain(stale.segment);
  expect(stale.segment).not.toBe('UNKNOWN');
});

test('E2: reorder interval is UNKNOWN below two orders, labelled otherwise', () => {
  expect(RET.reorderInterval(['2026-01-01']).confidence).toBe('UNKNOWN');
  const two = RET.reorderInterval(['2026-01-01', '2026-03-01']);
  expect(two.avgDays).toBeGreaterThan(0);
  expect(['LOW', 'MEDIUM', 'HIGH']).toContain(two.confidence);
});

test('E4: a suppressed customer is segmented but never proposed for contact', () => {
  const customers = [
    // an at-risk/lost customer who IS reachable -> should be a candidate
    { id: 'ok', orderDates: ['2026-01-01', '2026-02-01'] },
    // an identical history but suppressed (DNC) -> must be excluded from candidates
    { id: 'dnc', orderDates: ['2026-01-01', '2026-02-01'], dnc: true },
    { id: 'optout', orderDates: ['2026-09-20', '2026-10-10'], optOut: true },
  ];
  const a = RET.analyze(customers, ASOF);
  const ids = l => l.map(r => r.id);
  // suppressed customers are classified (present in rows) and flagged
  expect(a.rows.find(r => r.id === 'dnc').suppressed).toBe(true);
  // ...but never in any actionable contact list
  const allCandidates = ids(a.reorderCandidates).concat(ids(a.winBack), ids(a.reviewRequest));
  expect(allCandidates).not.toContain('dnc');
  expect(allCandidates).not.toContain('optout');
  // ...and surfaced in their own non-actionable list instead
  expect(ids(a.suppressedCandidates).sort()).toEqual(['dnc', 'optout']);
  expect(a.guard).toMatch(/never proposed for contact/i);
});

test('E4: an equivalent non-suppressed customer still IS a candidate (no over-filtering)', () => {
  const a = RET.analyze([{ id: 'ok', orderDates: ['2024-01-01', '2024-02-01'] }], ASOF);
  // long-gap, reachable -> appears in winBack
  expect(a.winBack.map(r => r.id)).toContain('ok');
});

test('backward compatible: customers without a suppression flag behave as before', () => {
  const a = RET.analyze(RET.fixtures(7), ASOF);
  expect(Array.isArray(a.reorderCandidates)).toBe(true);
  expect(Array.isArray(a.suppressedCandidates)).toBe(true);
  expect(a.suppressedCandidates.length).toBe(0); // fixtures carry no suppression
});
