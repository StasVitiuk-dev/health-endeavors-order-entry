// Marketing approval binding (wave-1 item 8). Pure, Node-only, synthetic.
// An approval is bound to the exact source facts, text, recipient and
// permission it was granted against: editing any of them invalidates it; a
// permission revoked after approval (opt-out) supersedes it; a review quote
// whose permission was revoked is not publishable; and every blocked item
// carries a clear reason AND a next action. Nothing is ever sent.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const A = require('../../assets/sales/he-sales-approval.js');
const R = require('../../assets/sales/he-sales-reviews.js');
const C = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

function draft() {
  return {
    kind: 'wholesale', recipient: 'buyer@syntheticstore.test', subject: 'Intro',
    body: 'Hi — we would love to get Sea Foam onto your shelves. Samples attached.',
    attachments: [], productFacts: { productName: 'Sea Foam', source: 'owner-approved facts v3' },
    commercialTerms: { moq: 12, price: 15.0 },
  };
}

test('approval is bound to source, text, recipient and terms: editing any one invalidates it', () => {
  const d = draft();
  const appr = A.approve(d, 'owner', '2026-11-08T00:00:00Z');
  expect(appr.status).toBe('APPROVED');
  expect(A.check(appr, d).valid).toBe(true);
  // each of the four bound dimensions, changed in isolation, re-opens review
  expect(A.check(appr, { ...d, body: d.body + ' We also pay for posts.' }).invalidated).toBe(true); // text
  expect(A.check(appr, { ...d, recipient: 'someone-else@test' }).invalidated).toBe(true);            // recipient
  expect(A.check(appr, { ...d, productFacts: { productName: 'Sea Foam', source: 'edited facts' } }).invalidated).toBe(true); // source
  expect(A.check(appr, { ...d, commercialTerms: { moq: 1, price: 1 } }).invalidated).toBe(true);      // terms
});

test('opt-out after approval supersedes the approval, with a clear reason + next action', () => {
  const d = draft();
  const appr = A.approve(d, 'owner', '2026-11-08T00:00:00Z');
  expect(A.check(appr, d).valid).toBe(true);
  // the recipient opts out AFTER the draft was approved and queued
  const optedOut = { ...d, optOut: true };
  const re = A.check(appr, optedOut);
  expect(re.valid).toBe(false);
  expect(re.superseded).toBe(true);
  expect(re.reason).toMatch(/opt-out/i);
  expect(re.nextAction).toMatch(/remove this recipient from the queue/i); // clear next action
});

test('a blocked draft cannot be approved and states the reason + next action', () => {
  const blocked = { ...draft(), claimBlocked: true };
  const res = A.approve(blocked, 'owner');
  expect(res.status).toBe('REFUSED');
  expect(res.reason).toMatch(/claim firewall/i);
  expect(res.nextAction).toMatch(/edit the draft to remove the flagged claim/i);
});

test('a review quote whose permission was revoked is no longer publishable', () => {
  const granted = { id: 'rv1', text: 'I love the Sea Foam bar — my skin feels great.', permission: 'granted' };
  const qOk = R.quoteCandidate(granted, C.scan);
  expect(qOk.permissionOk).toBe(true);
  expect(qOk.publishable).toBe(true);
  // the reviewer revokes permission -> not publishable anymore
  const revoked = { ...granted, permission: 'revoked' };
  const qNo = R.quoteCandidate(revoked, C.scan);
  expect(qNo.permissionOk).toBe(false);
  expect(qNo.publishable).toBe(false);
});
