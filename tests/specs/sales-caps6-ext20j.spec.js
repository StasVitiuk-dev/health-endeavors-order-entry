// Sales & Growth new capability modules: readiness (commercial/line-sheet/
// center), lead-source & store-type performance, owner daily queue.
const { test, expect } = require('@playwright/test');
const RD = require('../../assets/sales/he-sales-readiness.js');
const SRC = require('../../assets/sales/he-sales-sources.js');
const Q = require('../../assets/sales/he-sales-queue.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

// ---------- readiness ----------
test('readiness: a line sheet is BLOCKED until every required fact is APPROVED', () => {
  const empty = RD.lineSheet({});
  expect(empty.status).toBe('BLOCKED');
  expect(empty.blockers.length).toBeGreaterThan(0);
  const full = {
    wholesalePrice: { value: 12, verified: true }, moq: { value: 24, verified: true },
    shippingTerms: { value: 'FOB', verified: true }, paymentTerms: { value: 'net30', verified: true },
    approvedClaims: { value: 'moisturizing', verified: true }, lineSheet: { value: 'v1', verified: true },
    legalStatus: { value: 'approved', verified: true },
  };
  expect(RD.lineSheet(full).status).toBe('DRAFT_READY');
  expect(RD.lineSheet(full, 'READY_FOR_EXPORT').status).toBe('READY_FOR_EXPORT');
});

test('readiness: fact states reflect missing/unverified/conflicting/legal', () => {
  expect(RD.factState('wholesalePrice', null)).toBe('MISSING');
  expect(RD.factState('wholesalePrice', { value: 12, verified: false })).toBe('UNVERIFIED');
  expect(RD.factState('moq', { value: 24, conflicting: true })).toBe('CONFLICTING');
  expect(RD.factState('legalStatus', { value: 'pending' })).toBe('LEGAL_REVIEW');
  expect(RD.factState('legalStatus', { value: 'approved' })).toBe('APPROVED');
});

test('readiness: center never shows anything deployed/merged as done', () => {
  const c = RD.center({});
  const gmail = c.rows.find(r => /Gmail/.test(r.item));
  expect(gmail.status).toBe('GMAIL REQUIRED');
  expect(c.rows.find(r => /Merge/.test(r.item)).status).toBe('MERGE REQUIRED');
});

// ---------- sources ----------
test('sources: rates use safe denominators (UNKNOWN, never fake 0%)', () => {
  const leads = [
    { source: 'referral', storeType: 'spa', replied: true, interested: true, converted: true, cost: 0, scoring: { score: 80 } },
    { source: 'referral', storeType: 'spa', replied: false, scoring: { score: 60 } },
    { source: 'search', storeType: 'boutique' }, // no replies -> interestRate denominator 0
  ];
  const a = SRC.analyze(leads);
  const ref = a.bySource.find(s => s.key === 'referral');
  expect(ref.leads).toBe(2);
  expect(ref.replyRate).toBeCloseTo(0.5, 2);
  const search = a.bySource.find(s => s.key === 'search');
  expect(search.interestRate).toBe(null);       // 0 replies -> UNKNOWN, not 0
  expect(search.interestLabel).toBe('UNKNOWN');
  expect(a.guard).toMatch(/never a fake 0%/i);
});

// ---------- queue ----------
test('queue: buckets items, flags owner decisions, and has no external side effects', () => {
  const q = Q.build({
    approvalsAwaiting: [{ leadId: 'L1' }],
    sampleDecisions: [{ leadId: 'L2' }],
    repliesToReview: [{ leadId: 'L3' }],
    followUpsDue: [{ leadId: 'L4', dueDate: '2026-10-20' }],
    blocked: [{ leadId: 'L5', reason: 'needs price' }],
    watch: [{ leadId: 'L6' }],
  });
  expect(q.counts.NEEDS_OWNER_NOW).toBe(2);
  expect(q.byBucket.NEEDS_OWNER_NOW.every(i => i.ownerDecisionRequired)).toBe(true);
  expect(q.noExternalSideEffects).toBe(true);
  expect(q.byBucket.NEEDS_OWNER_NOW[0].externalSideEffect).toBe(false);
  expect(q.guard).toMatch(/nothing here sends/i);
});
