// W-3 feedback analysis + routing (FU6). Pure, Node-only, synthetic. Builds on
// he-sales-reviews. Routes packaging/quality/safety to a human, detects
// conflicting feedback and duplicates, flags private details (PII) in source
// text, and gates testimonial drafts on provenance + permission + approved
// wording + PII-safe. Nothing is auto-replied, published, or sent.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const F = require('../../assets/sales/he-sales-feedback.js');
const RV = require('../../assets/sales/he-sales-reviews.js');
const C = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('routes packaging, quality and safety to a human; collapses duplicates', () => {
  const a = F.analyze(F.fixtures(), RV);
  expect(a.duplicatesCollapsed).toBe(1);           // R5 duplicates R1
  expect(a.count).toBe(5);
  expect(a.toHumanCount).toBeGreaterThanOrEqual(3);
  const reasons = new Set([].concat(...a.toHuman.map(x => x.routeReasons)));
  expect(reasons.has('safety')).toBe(true);
  expect(reasons.has('leaking') || reasons.has('packaging')).toBe(true);
  expect(a.note).toMatch(/nothing auto-replied or published/);
});

test('surfaces conflicting feedback about the same product/theme instead of averaging it away', () => {
  const a = F.analyze(F.fixtures(), RV);
  // R2 ("arrived leaking", negative) vs R3 ("great seal, nothing leaked", positive).
  const leak = a.conflicts.find(c => c.product === 'Shea Body Butter' && c.theme === 'leaking');
  expect(leak).toBeTruthy();
  expect(leak.sentiments).toEqual(expect.arrayContaining(['positive', 'negative']));
});

test('detects private details (PII) in source text', () => {
  expect(F.findPII('reach me at buyer@example.com')).toContain('email');
  expect(F.findPII('call 555-123-4567')).toContain('phone');
  expect(F.findPII('nothing private here')).toEqual([]);
  // Redaction never leaks the detail but keeps the rest of the sentence.
  const red = F.redactPII('Gave me a rash — call me at 555-123-4567.');
  expect(red).not.toContain('555-123-4567');
  expect(red).toContain('[phone redacted]');
});

test('a testimonial draft needs provenance + permission + approved wording + no PII', () => {
  const fx = F.fixtures();
  // R1: permission granted, clean, no PII, has id+text -> ready for owner approval.
  const ok = F.testimonialDraft(fx[0], RV, C);
  expect(ok.status).toBe('READY_FOR_OWNER_APPROVAL');
  expect(ok.publishable).toBe(true);
  expect(ok.published).toBe(false);
  expect(ok.provenance.reviewId).toBe('SYN-R1');
  // R4: safety + a phone number -> BLOCKED on PII, display redacted.
  const pii = F.testimonialDraft(fx[3], RV, C);
  expect(pii.status).toBe('BLOCKED');
  expect(pii.blockers.join(' ')).toMatch(/private details/);
  expect(pii.display).not.toContain('555-123-4567');
  // R6: unsupported therapeutic claim -> BLOCKED on wording.
  const claim = F.testimonialDraft(fx[5], RV, C);
  expect(claim.status).toBe('BLOCKED');
  expect(claim.blockers.join(' ')).toMatch(/prohibited claim/);
  // R2: permission unknown -> BLOCKED on permission.
  const perm = F.testimonialDraft(fx[1], RV, C);
  expect(perm.status).toBe('BLOCKED');
  expect(perm.blockers.join(' ')).toMatch(/permission not granted/);
});

test('missing provenance blocks a testimonial even with permission', () => {
  // A review with no id and no source text cannot be attributed.
  const orphan = { product: 'Shea Body Butter', rating: 5, permission: 'granted', text: '' };
  const d = F.testimonialDraft(orphan, RV, C);
  expect(d.status).toBe('BLOCKED');
  expect(d.blockers.join(' ')).toMatch(/missing provenance/);
});
