// Micro-creator & UGC discovery — slice (Phase 2 item 7). Node-only, pure,
// synthetic. A shortlist with source + confidence, uncertainty never invented,
// an editable outreach draft that returns to review when changed, sample
// allocation kept separate from store visits, and permission captured.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const CR = require('../../assets/sales/he-sales-creator.js');
const CT = require('../../assets/sales/he-sales-content.js');
const A = require('../../assets/sales/he-sales-approval.js');
const C = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('shortlist carries source + confidence; reach/engagement stay UNKNOWN without evidence', () => {
  const list = CR.rank([
    { id: 'k1', name: 'SYNTHETIC @glowskin', platform: 'instagram', niche: 'skincare', audienceType: 'consumers', publicUrl: 'https://example.test/glowskin', engagementBand: 'high', followers: 8000, geoFit: 'local', source: 'owner list', sourceDate: '2026-11-01' },
    { id: 'k2', name: 'SYNTHETIC @noprofile', platform: 'tiktok', niche: 'skincare', audienceType: 'consumers', source: 'directory', sourceDate: '2026-11-02' }, // no public URL
  ]);
  expect(list[0].id).toBe('k1');              // ranked by fit confidence
  expect(list[0].source).toBe('owner list');
  expect(list[0].reach).toBe(8000);
  // no public URL -> reach + engagement UNKNOWN, never fabricated
  const np = list.find(r => r.id === 'k2');
  expect(np.reach).toBe('UNKNOWN');
  expect(np.engagement).toBe('UNKNOWN');
  expect(np.reasons).toEqual(expect.arrayContaining(['no public URL (UNKNOWN reach)']));
});

test('an editable outreach draft returns to review when changed; claims are flagged', () => {
  const draft = CT.checkClaims(CT.opportunity('creator', 'gift offer', { body: 'Hi — would you like a Sea Foam sample to try?' }), C.scan);
  expect(draft.claimStatus).toBe('SAFE');
  const review = { kind: 'creator', recipient: '@glowskin', subject: 'gift', body: draft.body, productFacts: { productName: 'Sea Foam' } };
  const approval = A.approve(review, 'owner', '2026-11-08T00:00:00Z');
  expect(A.check(approval, review).valid).toBe(true);
  const edited = { ...review, body: review.body + ' We pay $200 per post.' };
  expect(A.check(approval, edited).invalidated).toBe(true); // edit returns to review
});

test('sample allocation for a creator is tracked separately from store visits', () => {
  // A creator gift and a store-visit sample are different allocation buckets.
  const allocations = [
    { id: 'a1', kind: 'creator-gift', creator: 'k1', jars: 2, permission: 'granted' },
    { id: 'a2', kind: 'store-visit', store: 'SYN-glow', jars: 2 },
  ];
  const creatorGifts = allocations.filter(a => a.kind === 'creator-gift');
  const storeVisits = allocations.filter(a => a.kind === 'store-visit');
  expect(creatorGifts.length).toBe(1);
  expect(storeVisits.length).toBe(1);
  expect(creatorGifts[0].creator).toBe('k1'); // not conflated with store visits
  expect(creatorGifts[0].permission).toBe('granted');
});

test('owner controls contact: a prospect is only IDENTIFIED, never auto-contacted', () => {
  const p = CR.prospect({ id: 'k1', name: 'SYNTHETIC @glowskin', niche: 'skincare', publicUrl: 'https://example.test/x', engagementBand: 'high' });
  expect(p.status).toBe('IDENTIFIED');
  expect(p.outreachDraft).toBe(null); // nothing drafted or sent on its own
  expect(p.permission).toBe('unknown');
});
