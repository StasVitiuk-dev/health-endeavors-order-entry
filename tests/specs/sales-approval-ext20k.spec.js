// Reserve IV — WAVE B: approval integrity. An approval applies to exactly the
// draft that was approved; any edit to approval-material fields voids it;
// approval is never a send; a suppressed lead can't be approved and can't be
// overridden. Pure, deterministic. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const A = require('../../assets/sales/he-sales-approval.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const DRAFT = {
  kind: 'intro', recipient: 'buyer@example-spa.test', subject: 'Intro',
  body: 'Hello, we make body-care products...', attachments: ['linesheet.pdf'],
  productFacts: { skuCount: 4 }, commercialTerms: { moq: 24 },
};

test('fingerprint is deterministic and order-independent', () => {
  const reordered = { commercialTerms: { moq: 24 }, body: DRAFT.body, kind: 'intro', recipient: DRAFT.recipient, subject: 'Intro', attachments: ['linesheet.pdf'], productFacts: { skuCount: 4 } };
  expect(A.fingerprint(DRAFT)).toBe(A.fingerprint(reordered));
  expect(A.fingerprint(DRAFT)).toMatch(/^[0-9a-f]{8}$/);
});

test('B4: approve is never send — the record says sent:false', () => {
  const ap = A.approve(DRAFT, 'owner', '2026-10-20T00:00:00Z');
  expect(ap.status).toBe('APPROVED');
  expect(ap.sent).toBe(false);
  expect(ap.note).toMatch(/not a send/i);
  expect(A.check(ap, DRAFT).valid).toBe(true);
  expect(A.check(ap, DRAFT).sent).toBe(false);
});

test('B5: editing any approval-material field invalidates the approval', () => {
  const ap = A.approve(DRAFT, 'owner');
  for (const f of A.APPROVAL_FIELDS) {
    const edited = Object.assign({}, DRAFT);
    // change the field in a type-appropriate way
    edited[f] = Array.isArray(DRAFT[f]) ? DRAFT[f].concat('x')
      : (typeof DRAFT[f] === 'object' && DRAFT[f] ? Object.assign({}, DRAFT[f], { _changed: 1 })
      : String(DRAFT[f]) + ' (edited)');
    const res = A.check(ap, edited);
    expect(res.valid, `editing ${f} should invalidate`).toBe(false);
    expect(res.invalidated).toBe(true);
  }
});

test('B5: changedFields names exactly what changed', () => {
  const edited = Object.assign({}, DRAFT, { body: 'new body', recipient: 'someone-else@test' });
  expect(A.changedFields(DRAFT, edited).sort()).toEqual(['body', 'recipient']);
  expect(A.changedFields(DRAFT, DRAFT)).toEqual([]);
});

test('B3: a suppressed lead cannot be approved, and suppression after approval wins', () => {
  // cannot approve a suppressed draft
  const refused = A.approve(Object.assign({}, DRAFT, { suppressed: true }), 'owner');
  expect(refused.status).toBe('REFUSED');
  expect(refused.sent).toBe(false);
  // an approval made while clear is voided if the lead later becomes DNC
  const ap = A.approve(DRAFT, 'owner');
  const later = A.check(ap, Object.assign({}, DRAFT, { dnc: true }));
  expect(later.valid).toBe(false);
  expect(later.superseded).toBe(true);
});

test('a claim-firewall-blocked draft cannot be approved', () => {
  const r = A.approve(Object.assign({}, DRAFT, { claimBlocked: true }), 'owner');
  expect(r.status).toBe('REFUSED');
  expect(r.reason).toMatch(/claim firewall/i);
});

test('check with no approval on record is never valid', () => {
  expect(A.check(null, DRAFT).valid).toBe(false);
  expect(A.check({ status: 'DRAFT' }, DRAFT).valid).toBe(false);
});

test('approve does not mutate the draft', () => {
  const frozen = Object.freeze(Object.assign({}, DRAFT));
  expect(() => A.approve(frozen, 'owner')).not.toThrow();
  expect(frozen.status).toBeUndefined();
});
