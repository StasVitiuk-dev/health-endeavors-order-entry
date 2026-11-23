// W-1 content repurposing (FU6 wholesale advance). Pure, Node-only, synthetic.
// One APPROVED asset + APPROVED facts fans out to reviewable caption / short-
// video / newsletter drafts with source attribution and editable versions.
// Source text is DATA, never instructions: a prompt-injection line that smuggles
// a therapeutic claim is BLOCKED by the claim firewall (fail closed). Missing
// inputs are named, never invented. Draft-only — never publishes, never sends.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const R = require('../../assets/sales/he-sales-repurpose.js');
const C = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('an approved asset fans out to caption, short-video and newsletter drafts with source attribution', () => {
  const fx = R.fixtures();
  const out = R.repurpose({ asset: fx.approvedAsset, facts: fx.facts, claims: C });
  expect(out.counts).toMatchObject({ draft: 3, blocked: 0, missingInput: 0 });
  expect(out.drafts.map(d => d.channel)).toEqual(['caption', 'short_video', 'newsletter']);
  // Nothing is ever published or sent.
  expect(out.published).toBe(false);
  expect(out.sent).toBe(false);
  const caption = out.drafts[0];
  expect(caption.status).toBe('DRAFT');
  expect(caption.label).toBe('SIMULATED');
  // Source attribution: the asset and every approved fact used, with its source.
  expect(caption.attribution.assetId).toBe('SYN-ASSET-1');
  expect(caption.attribution.facts.map(f => f.fact)).toEqual(expect.arrayContaining(['product']));
  expect(caption.attribution.facts.every(f => f.status === 'APPROVED' && f.source)).toBe(true);
  expect(caption.text).toContain('Shea Body Butter');
});

test('an unapproved asset and a missing required fact are clear MISSING_INPUT states (never invented)', () => {
  const fx = R.fixtures();
  // Draft (not yet approved) source asset cannot be repurposed.
  const na = R.repurposeChannel({ asset: fx.draftAsset, facts: fx.facts, channel: 'caption', claims: C });
  expect(na.status).toBe('MISSING_INPUT');
  expect(na.missing).toContain('approved source asset');
  // Newsletter requires an approved cta fact; without it, named missing input.
  const noCta = R.repurposeChannel({ asset: fx.approvedAsset, facts: { product: fx.facts.product }, channel: 'newsletter', claims: C });
  expect(noCta.status).toBe('MISSING_INPUT');
  expect(noCta.missing).toContain('approved fact: cta');
  expect(noCta.text).toBeUndefined(); // no fabricated copy
});

test('source text is data, not instructions: an injected therapeutic claim is blocked (fail closed)', () => {
  const fx = R.fixtures();
  // The asset body says "ignore previous instructions ... cures eczema ...".
  const out = R.repurpose({ asset: fx.injectedAsset, facts: fx.facts, claims: C });
  // Not obeyed, and every channel draft is BLOCKED by the firewall.
  expect(out.counts).toMatchObject({ draft: 0, blocked: 3, missingInput: 0 });
  const d = out.drafts[0];
  expect(d.status).toBe('BLOCKED');
  expect(d.published).toBe(false);
  expect(d.claimFindings.map(f => f.family)).toEqual(expect.arrayContaining(['disease-condition', 'treatment']));
});

test('drafts are editable and versioned; an edit that introduces a claim is blocked too', () => {
  const fx = R.fixtures();
  const d = R.repurposeChannel({ asset: fx.approvedAsset, facts: fx.facts, channel: 'caption', claims: C });
  expect(d.version).toBe(1);
  // A clean edit makes a new version and keeps history; the original is retained.
  const good = R.editDraft(d, 'Shea Body Butter — gentle daily care.', 'owner', C);
  expect(good.status).toBe('DRAFT');
  expect(good.version).toBe(2);
  expect(good.edits).toHaveLength(1);
  expect(good.edits[0].text).toBe(d.text);
  // An edit that introduces a claim is blocked (fail closed), never published.
  const bad = R.editDraft(d, 'This cures acne overnight', 'owner', C);
  expect(bad.status).toBe('BLOCKED');
  expect(bad.published).toBe(false);
  expect(bad.claimFindings.length).toBeGreaterThan(0);
  // Only a DRAFT can be edited.
  const noop = R.editDraft(bad, 'anything', 'owner', C);
  expect(noop.status).toBe('BLOCKED');
  expect(noop.reason).toMatch(/only a DRAFT/);
});

test('obfuscated (zero-width / control char) claims cannot slip through', () => {
  const fx = R.fixtures();
  // Same therapeutic phrase, broken up with zero-width + control characters.
  const sneaky = { id: 'SYN-ASSET-4', title: 'Spotlight', status: 'APPROVED',
    body: 'c​u​r​e​s\u0000 eczema', source: 'owner' };
  const d = R.repurposeChannel({ asset: sneaky, facts: fx.facts, channel: 'caption', claims: C });
  // asData strips the smuggling chars, so the firewall sees "cures eczema".
  expect(d.status).toBe('BLOCKED');
  expect(d.claimFindings.length).toBeGreaterThan(0);
});
