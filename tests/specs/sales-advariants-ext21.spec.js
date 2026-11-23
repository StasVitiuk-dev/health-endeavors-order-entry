// W-2 ad variants (FU6). Pure, Node-only, synthetic. Reuses the content draft
// model + he-sales-approval version binding. One APPROVED asset + APPROVED facts
// fans out to ad hooks / headlines / creative briefs, each reviewed by variant.
// Approval binds to the exact wording AND the source facts: editing the variant,
// or changing an approved fact, invalidates it. Source text is DATA (injection
// where used is blocked, never obeyed). No campaigns, no spend, never sent.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const V = require('../../assets/sales/he-sales-advariants.js');
const A = require('../../assets/sales/he-sales-approval.js');
const C = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('an approved asset fans out to hook/headline/creative-brief variants; no campaign, no spend', () => {
  const fx = V.fixtures();
  const out = V.adVariants({ asset: fx.approvedAsset, facts: fx.facts, claims: C });
  expect(out.counts).toMatchObject({ draft: 3, blocked: 0, missingInput: 0 });
  expect(out.variants.map(v => v.variantType)).toEqual(['hook', 'headline', 'creative_brief']);
  expect(out.campaign).toBe(false);
  expect(out.spend).toBe(0);
  expect(out.sent).toBe(false);
  const hook = out.variants[0];
  expect(hook.status).toBe('DRAFT');
  expect(hook.attribution.facts.map(f => f.fact)).toContain('product');
});

test('review by variant: approval binds to the exact wording and invalidates on edit', () => {
  const fx = V.fixtures();
  const hook = V.adVariant({ asset: fx.approvedAsset, facts: fx.facts, variantType: 'hook', claims: C });
  const appr = A.approve(hook, 'owner', '2026-11-09T00:00:00Z');
  expect(appr.status).toBe('APPROVED');
  expect(appr.sent).toBe(false);
  expect(A.check(appr, hook).valid).toBe(true);
  // Editing the approved variant's wording re-opens review.
  const edited = V.editVariant(hook, 'Meet Shea Body Butter — boutique favourite.', 'owner', C);
  expect(edited.version).toBe(2);
  const after = A.check(appr, edited);
  expect(after.valid).toBe(false);
  expect(after.invalidated).toBe(true);
});

test('approval invalidates if the approved source FACT changes', () => {
  const fx = V.fixtures();
  const headline = V.adVariant({ asset: fx.approvedAsset, facts: fx.facts, variantType: 'headline', claims: C });
  const appr = A.approve(headline, 'owner', '2026-11-09T00:00:00Z');
  expect(A.check(appr, headline).valid).toBe(true);
  // Rebuild the same variant after the approved product fact was changed.
  const changedFacts = { ...fx.facts, product: { value: 'Shea Butter (reformulated)', source: 'catalog', status: 'APPROVED' } };
  const rebuilt = V.adVariant({ asset: fx.approvedAsset, facts: changedFacts, variantType: 'headline', claims: C });
  expect(A.check(appr, rebuilt).valid).toBe(false);
});

test('source text is data: an injected claim is blocked where the source is used, and never obeyed', () => {
  const fx = V.fixtures();
  const out = V.adVariants({ asset: fx.injectedAsset, facts: fx.facts, claims: C });
  // The creative brief incorporates the source body and is BLOCKED by the
  // firewall; the hook/headline templates do not quote the body, so they stay
  // clean DRAFTs — and none of them emits the therapeutic terms.
  expect(out.counts.blocked).toBeGreaterThanOrEqual(1);
  const brief = out.variants.find(v => v.variantType === 'creative_brief');
  expect(brief.status).toBe('BLOCKED');
  expect(brief.published).toBe(false);
  for (const v of out.variants) {
    if (v.status === 'DRAFT') expect(v.body.toLowerCase()).not.toMatch(/eczema|dermatitis|cure|treat/);
  }
});

test('a missing required fact is a clear MISSING_INPUT (never invented)', () => {
  const fx = V.fixtures();
  // Creative brief requires an approved audience fact.
  const nb = V.adVariant({ asset: fx.approvedAsset, facts: { product: fx.facts.product }, variantType: 'creative_brief', claims: C });
  expect(nb.status).toBe('MISSING_INPUT');
  expect(nb.missing).toContain('approved fact: audience');
  expect(nb.body).toBeUndefined();
});
