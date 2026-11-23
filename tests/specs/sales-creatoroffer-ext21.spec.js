// W-4 creator scouting + sample-offer draft (FU6). Pure, Node-only, synthetic.
// Fixtures only. Reuses he-sales-creator (shortlist/fit). Produces a shortlist
// with source + fit evidence, leaves missing engagement UNKNOWN, and drafts a
// sample offer for human review. Gifting, stock adjustment and contact stay
// DISABLED. Nothing is contacted, gifted, written to stock, or sent.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const O = require('../../assets/sales/he-sales-creatoroffer.js');
const CR = require('../../assets/sales/he-sales-creator.js');
const C = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('shortlist carries source + fit evidence and keeps gifting/stock/contact disabled', () => {
  const fx = O.fixtures();
  const out = O.shortlistWithOffers(fx.creators, fx.facts, C, CR);
  // Capabilities disabled at both the batch and the per-offer level.
  expect(out.capabilities).toEqual({ contact: false, gifting: false, stockAdjust: false });
  expect(out.disabledNote).toMatch(/adjust_inventory \(R4\)/);
  expect(out.sent).toBe(false);
  const drafted = out.shortlist.filter(x => x.offer.status === 'DRAFT_FOR_HUMAN_REVIEW');
  expect(drafted.length).toBeGreaterThanOrEqual(1);
  const top = drafted[0].offer;
  expect(top.capabilities).toEqual({ contact: false, gifting: false, stockAdjust: false });
  expect(top.evidence.fitReasons.length).toBeGreaterThan(0);  // fit evidence
  expect(top.evidence.source).toBeTruthy();                   // provenance/source
  expect(top.published).toBe(false);
});

test('missing engagement metrics are left UNKNOWN (never invented)', () => {
  const fx = O.fixtures();
  const out = O.shortlistWithOffers(fx.creators, fx.facts, C, CR);
  const known = out.shortlist.find(x => x.prospect.name === 'cleanskinco');
  const missing = out.shortlist.find(x => x.prospect.name === 'boutiquebuyer');
  expect(known.offer.evidence.engagement).toBe('high');       // real evidence passes through
  expect(missing.offer.evidence.engagement).toBe('UNKNOWN');  // absent stays UNKNOWN
  expect(out.counts.unknownEngagement).toBeGreaterThanOrEqual(1);
});

test('a weak-fit creator is NOT shortlisted for an offer', () => {
  const fx = O.fixtures();
  const out = O.shortlistWithOffers(fx.creators, fx.facts, C, CR);
  const weak = out.shortlist.find(x => x.prospect.name === 'randomfood');
  expect(weak.offer.status).toBe('NOT_ELIGIBLE');
});

test('the sample-offer draft is claim-checked and needs an approved product fact', () => {
  const fx = O.fixtures();
  const prospect = CR.rank(fx.creators)[0];
  // Without an approved product fact, the offer cannot be drafted.
  const noFact = O.sampleOfferDraft({ prospect: prospect, facts: {}, claims: C });
  expect(noFact.status).toBe('MISSING_INPUT');
  expect(noFact.missing).toContain('approved fact: product');
  // A normal draft is claim-clean and for human review only (never sent).
  const ok = O.sampleOfferDraft({ prospect: prospect, facts: fx.facts, claims: C });
  expect(ok.status).toBe('DRAFT_FOR_HUMAN_REVIEW');
  expect(ok.claimFindings).toEqual([]);
  expect(ok.sent).toBe(false);
  expect(ok.text).toMatch(/Draft for owner review/);
});

test('no prospect at all is a clear MISSING_INPUT', () => {
  const d = O.sampleOfferDraft({ prospect: null, facts: O.fixtures().facts, claims: C });
  expect(d.status).toBe('MISSING_INPUT');
  expect(d.missing).toContain('a shortlisted prospect');
  expect(d.capabilities).toEqual({ contact: false, gifting: false, stockAdjust: false });
});
