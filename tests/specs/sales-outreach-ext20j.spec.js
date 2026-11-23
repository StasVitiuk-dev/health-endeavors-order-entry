// Sales & Growth: outreach draft builder (assets/sales/he-sales-outreach.js).
// Proves the qualification gate, approved-fact-only provenance, claim-firewall
// fail-closed behaviour, and that every draft is DRAFT/never sent.
const { test, expect } = require('@playwright/test');
const O = require('../../assets/sales/he-sales-outreach.js');
const AI = require('../../assets/sales/he-sales-ai.js');
const C = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const drafter = AI.createDrafter();
const hotLead = { id: 'L1', storeName: 'Blue Harbor Apothecary', contactName: 'Jordan', scoring: { score: 90 } };
const coldLead = { id: 'L2', storeName: 'Corner Grocery', scoring: { score: 20 } };
const approvedFacts = { productName: { value: 'our Sea Foam body-care line', source: 'owner', status: 'APPROVED' } };

test('qualification gate: a low-score lead is not eligible unless the owner overrides', () => {
  expect(O.eligibleForOutreach({ score: 20 }).eligible).toBe(false);
  expect(O.eligibleForOutreach({ score: 70 }).eligible).toBe(true);
  expect(O.eligibleForOutreach({ score: 20 }, { ownerOverride: true, overrideReason: 'referral' }).eligible).toBe(true);
});

test('a qualified lead with an approved product fact produces a DRAFT (never sent)', () => {
  const d = O.buildOutreach({ kind: 'intro', lead: hotLead, facts: approvedFacts, drafter, claims: C });
  expect(d.status).toBe('DRAFT');
  expect(d.sent).toBe(false);
  expect(d.approvalState).toBe('DRAFT');
  expect(d.subject).toContain('Blue Harbor Apothecary');
  expect(d.factsUsed).toEqual([{ fact: 'productName', value: 'our Sea Foam body-care line', source: 'owner', status: 'APPROVED' }]);
});

test('a low-quality lead is blocked before any draft is generated', () => {
  const d = O.buildOutreach({ kind: 'intro', lead: coldLead, facts: approvedFacts, drafter, claims: C });
  expect(d.status).toBe('BLOCKED');
  expect(d.reason).toMatch(/not qualified/);
});

test('missing/unapproved facts block the draft (no inventing)', () => {
  const unapproved = { productName: { value: 'X', source: 'history', status: 'HISTORICAL' } };
  const d = O.buildOutreach({ kind: 'intro', lead: hotLead, facts: unapproved, drafter, claims: C });
  expect(d.status).toBe('BLOCKED');
  expect(d.reason).toMatch(/missing approved fact\(s\): productName/);
});

test('claim firewall fails closed: a drafter that emits a claim is blocked', () => {
  const badDrafter = { providerName: 'rogue', available: true, draft: () => ({ subject: 'Cures eczema fast', body: 'treats psoriasis', provider: 'rogue', status: 'DRAFT', sent: false }) };
  const d = O.buildOutreach({ kind: 'intro', lead: hotLead, facts: approvedFacts, drafter: badDrafter, claims: C });
  expect(d.status).toBe('BLOCKED');
  expect(d.reason).toMatch(/claim firewall/);
  expect(d.claimFindings.length).toBeGreaterThan(0);
});

test('a drafter and the claim firewall are both required', () => {
  expect(() => O.buildOutreach({ kind: 'intro', lead: hotLead, facts: approvedFacts, claims: C })).toThrow(/drafter is required/);
  expect(() => O.buildOutreach({ kind: 'intro', lead: hotLead, facts: approvedFacts, drafter })).toThrow(/claim firewall is required/);
});
