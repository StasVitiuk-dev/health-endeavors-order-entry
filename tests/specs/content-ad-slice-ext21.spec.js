// Content & ad variants — one asset-to-draft journey (Phase 2 item 5). Node-only,
// pure, synthetic. Reuses he-sales-content (status machine + claim check + fact
// provenance), he-sales-approval (edit-returns-to-review), he-sales-campaign (ad
// variants with audience/hook/hypothesis), and the claim firewall.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const CT = require('../../assets/sales/he-sales-content.js');
const CAMP = require('../../assets/sales/he-sales-campaign.js');
const A = require('../../assets/sales/he-sales-approval.js');
const C = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('a content draft carries source facts + a version and runs the claim check', () => {
  const item = CT.opportunity('social', 'Sea Foam Honey Milk launch', { sourceFacts: ['owner photo #12', 'approved: Sea Foam Honey Milk'], body: 'Meet Sea Foam Honey Milk — a gentle daily body-care ritual.' });
  expect(item.version).toBe(1);
  expect(item.sourceFacts.length).toBe(2);
  expect(item.approval).toBe('OWNER_INPUT_REQUIRED');
  const checked = CT.checkClaims(item, C.scan);
  expect(checked.claimStatus).toBe('SAFE');
  // a medical claim is flagged, never silently allowed
  const bad = CT.checkClaims(CT.opportunity('social', 'cures eczema overnight', { body: 'This cures eczema overnight.' }), C.scan);
  expect(bad.claimStatus).toBe('BLOCKED');
  expect(bad.claimFindings.length).toBeGreaterThan(0);
});

test('the status machine moves idea -> draft -> owner review -> approved (only after a passed claim check)', () => {
  let item = CT.opportunity('newsletter', 'Autumn skincare', { body: 'A calm autumn ritual.' });
  item = CT.advance(item, 'DRAFT');
  expect(item.status).toBe('DRAFT');
  item = CT.advance(item, 'OWNER_REVIEW');
  // approval is refused until claims are checked SAFE (fails closed)
  expect(() => CT.advance(item, 'APPROVED')).toThrow(/claims unchecked or blocked/);
  item = CT.checkClaims(item, C.scan);
  expect(item.claimStatus).toBe('SAFE');
  expect(() => CT.advance(item, 'APPROVED')).toThrow(/owner approval/); // owner gate
  item = CT.advance(item, 'APPROVED', { ownerApproved: true });
  expect(item.status).toBe('APPROVED');
  expect(() => CT.advance(item, 'IDEA')).toThrow(); // illegal jump refused
});

test('editing an APPROVED draft returns it to review (approval invalidated)', () => {
  const draft = { kind: 'ig_caption', recipient: 'public', subject: 'Honey Milk', body: 'Meet Sea Foam Honey Milk.', productFacts: { productName: 'Sea Foam' } };
  const approval = A.approve(draft, 'owner', '2026-11-08T00:00:00Z');
  expect(approval.status).toBe('APPROVED');
  expect(A.check(approval, draft).valid).toBe(true);
  const edited = { ...draft, body: draft.body + ' Now 20% off!' }; // copy changed after approval
  const re = A.check(approval, edited);
  expect(re.valid).toBe(false);
  expect(re.invalidated).toBe(true);
});

test('ad variants carry audience/hook/hypothesis, flag claims, and rank safe first', () => {
  const vA = CAMP.variant('cta', 'Try Sea Foam Honey Milk today.', C.scan, { audience: 'lapsed retail', hook: 'ritual', hypothesis: 'ritual framing lifts CTR' });
  const vB = CAMP.variant('tone', 'Gentle daily care, made simple.', C.scan, { audience: 'new moms', hook: 'gentle', hypothesis: 'gentleness resonates' });
  const vClaim = CAMP.variant('cta', 'Clinically proven to cure dryness forever.', C.scan, { audience: 'test', hook: 'claim', hypothesis: 'should be blocked' });
  expect(vA.audience).toBe('lapsed retail');
  expect(vA.hypothesis).toMatch(/CTR/);
  expect(vClaim.claimSafe).toBe(false);          // claim flagged
  const cmp = CAMP.compare([vClaim, vA, vB]);
  expect(cmp.ranked.length).toBe(3);             // several alternatives
  expect(cmp.best.claimSafe).toBe(true);         // a safe variant ranks above the claim one
});
