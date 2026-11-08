// Wholesale Scout — one-store END-TO-END journey (Phase 2 slice). Node-only, pure,
// synthetic. Stitches the existing sales engine modules into the single lifecycle
// the Nov 7 brief asks to exercise: intake/shortlist -> lead scoring -> evidence-
// backed intro draft -> review (and invalidation when the draft changes) ->
// simulated reply classify -> follow-up suppression -> pipeline from lead through
// in-person sample handoff to order outcome. No sends, no live data.
const { test, expect } = require('@playwright/test');
const I = require('../../assets/sales/he-sales-import.js');
const L = require('../../assets/sales/he-sales-leads.js');
const O = require('../../assets/sales/he-sales-outreach.js');
const A = require('../../assets/sales/he-sales-approval.js');
const AI = require('../../assets/sales/he-sales-ai.js');
const C = require('../../assets/sales/he-sales-claims.js');
const R = require('../../assets/sales/he-sales-replies.js');
const F = require('../../assets/sales/he-sales-followup.js');
const P = require('../../assets/sales/he-sales-pipeline.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const ROWS = [
  { storeName: 'SYNTHETIC Glow Boutique', email: 'buyer@glow.example', website: 'glow.example', city: 'Portland', state: 'OR', source: 'owner list', sourceDate: '2026-11-01', category: 'boutique', fit: 'carries indie skincare' },
  { storeName: 'SYNTHETIC Glow  Boutique', website: 'glow.example', city: 'Portland', source: 'directory', sourceDate: '2026-11-02' }, // duplicate (same domain + name+city)
  { storeName: 'SYNTHETIC No Source', email: 'x@nosource.example' }, // missing provenance
];

test('1. intake: normalize, validate, capture source/date/fit + confidence, surface conflicts, repeat-safe', () => {
  const pv = I.importPreview(ROWS);
  expect(pv.count).toBe(3);
  const good = pv.prepared[0].normalized;
  expect(good.storeName).toBe('SYNTHETIC Glow Boutique');
  expect(good.source).toBe('owner list');
  expect(good.sourceDate).toBe('2026-11-01');
  expect(good.category).toBe('boutique');
  expect(good.fit).toBe('carries indie skincare');
  expect(good.confidence).toBe('full'); // source + date + a contact
  // missing provenance is flagged, not invented
  expect(pv.prepared[2].problems).toContain('missing source provenance');
  expect(pv.prepared[2].normalized.confidence).toBe('low');
  // the duplicate pair is surfaced
  expect(pv.duplicates.length).toBeGreaterThan(0);
  // repeated import is safe: same input -> same dedup graph, nothing merged silently
  const pv2 = I.importPreview(ROWS);
  expect(pv2.duplicates).toEqual(pv.duplicates);
  expect(pv2.count).toBe(3);
});

test('2. the store scores and ranks (deterministic, with reasons)', () => {
  const lead = { id: 'SYN-glow', storeName: 'SYNTHETIC Glow Boutique', category: 'boutique', size: 'medium', region: 'local' };
  const s = L.score(lead);
  expect(typeof s.score).toBe('number');
  expect(s.score).toBeGreaterThan(0);
  expect(Array.isArray(s.reasons)).toBe(true);
  expect(s.reasons.length).toBeGreaterThan(0);
});

test('3. evidence-backed intro draft uses only approved facts and is review-gated', () => {
  const drafter = AI.createDrafter();
  const lead = { id: 'SYN-glow', storeName: 'SYNTHETIC Glow Boutique', contactName: 'Jordan', scoring: { score: 88 } };
  const facts = { productName: { value: 'our Sea Foam body-care line', source: 'owner', status: 'APPROVED' } };
  const draft = O.buildOutreach({ kind: 'intro', lead, facts, drafter, claims: C });
  expect(draft.blocked).toBeFalsy();
  expect(draft.factsUsed.some(f => f.fact === 'productName' && f.status === 'APPROVED')).toBe(true);

  // An editable draft we review/approve, then CHANGE -> approval invalidated.
  const reviewDraft = { kind: 'intro', recipient: 'buyer@glow.example', subject: 'Sea Foam for Glow Boutique', body: draft.body || 'Hi Jordan — intro to our Sea Foam body-care line.', productFacts: { productName: 'Sea Foam' } };
  const approval = A.approve(reviewDraft, 'owner', '2026-11-07T00:00:00Z');
  expect(approval.status).toBe('APPROVED');
  expect(A.check(approval, reviewDraft).valid).toBe(true);
  const edited = Object.assign({}, reviewDraft, { body: reviewDraft.body + ' PS: new wholesale terms.' });
  const re = A.check(approval, edited);
  expect(re.valid).toBe(false);
  expect(re.invalidated).toBe(true);
  expect(A.changedFields(reviewDraft, edited)).toContain('body');
});

test('4. simulated replies classify; safety labels suppress follow-up', () => {
  expect(R.classify('We would love to carry this! Can we set up a call?').label).toBe('INTERESTED');
  const decline = R.classify('Not interested, please remove us.');
  expect(['DECLINED', 'UNSUBSCRIBE']).toContain(decline.label);
  expect(R.suppresses(decline.label)).toBe(true);
  // follow-up planner honours suppression and the newer-reply rule
  expect(F.nextFollowup({ optedOut: true, lastContactAt: '2026-11-01' }).due).toBe(false);
  const due = F.nextFollowup({ lastContactAt: '2026-11-01', now: '2026-11-10', sequenceSent: 0 });
  expect(due.due).toBe(true);
  const superseded = F.nextFollowup({ lastContactAt: '2026-11-01', lastReplyAt: '2026-11-05', now: '2026-11-10' });
  expect(superseded.due).toBe(false);
});

test('5. pipeline: one store from lead to in-person sample handoff to customer; gates + illegal moves enforced', () => {
  const p = P.createPipeline(); const k = 'SYN-glow';
  expect(p.move(k, 'QUALIFIED')).toBe('QUALIFIED');
  p.move(k, 'READY_FOR_OUTREACH');
  p.move(k, 'OUTREACH_DRAFTED');
  // OWNER_APPROVED requires explicit owner approval
  expect(() => p.move(k, 'OWNER_APPROVED')).toThrow(/requires explicit owner approval/);
  p.move(k, 'OWNER_APPROVED', 'owner reviewed', { ownerApproved: true });
  p.move(k, 'CONTACTED', 'sent by hand');
  p.move(k, 'REPLIED');
  p.move(k, 'INTERESTED');
  p.move(k, 'SAMPLE_CONSIDERATION');
  expect(() => p.move(k, 'SAMPLE_APPROVED')).toThrow(/requires explicit owner approval/);
  p.move(k, 'SAMPLE_APPROVED', 'owner approved sample kit', { ownerApproved: true });
  p.move(k, 'SAMPLE_SENT', 'in-person handoff: 1 Honey Milk + 1 Vegan');
  p.move(k, 'WHOLESALE_DISCUSSION');
  expect(p.move(k, 'CUSTOMER', 'first wholesale order')).toBe('CUSTOMER');
  // CUSTOMER is terminal; an illegal transition is refused
  expect(() => p.move(k, 'INTERESTED')).toThrow(/refused transition/);
});

test('5b. a declined store cannot be re-contacted (suppression is in the machine)', () => {
  const p = P.createPipeline(); const k = 'SYN-decline';
  p.move(k, 'QUALIFIED'); p.move(k, 'READY_FOR_OUTREACH'); p.move(k, 'OUTREACH_DRAFTED');
  p.move(k, 'OWNER_APPROVED', '', { ownerApproved: true }); p.move(k, 'CONTACTED'); p.move(k, 'DECLINED');
  expect(() => p.move(k, 'INTERESTED')).toThrow(/refused transition/);
  expect(p.move(k, 'DO_NOT_CONTACT')).toBe('DO_NOT_CONTACT');
});
