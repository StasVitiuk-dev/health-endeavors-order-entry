// Reserve IV — WAVE H: the decision engines must agree about the SAME lead.
// One canonical synthetic dataset is fed through priority, progression,
// concentration, next-action, and reply-triage, and this spec checks the
// journey is coherent (H1-H8): consistent identity + account, aging/progression
// agree, next-action respects stage and suppression, replies route correctly,
// and nothing acts. Pure Node, reuses existing engines/fixtures. Desktop-only.
const { test, expect } = require('@playwright/test');
const P = require('../../assets/sales/he-sales-priority.js');
const PR = require('../../assets/sales/he-sales-progression.js');
const C = require('../../assets/sales/he-sales-concentration.js');
const N = require('../../assets/sales/he-sales-nextaction.js');
const R = require('../../assets/sales/he-sales-replies.js');
const LAB = require('../../assets/sales/he-sales-replylab.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const ASOF = '2026-10-20T00:00:00Z';
const d = n => new Date(Date.parse(ASOF) - n * 86400000).toISOString();

// Canonical shared records: each carries everything the five engines read, so
// identity/account/value/stage/dates come from ONE source of truth.
const LEADS = [
  { id: 'SYN-1', account: 'Big Spa Group', state: 'INTERESTED', createdAt: d(40), enteredStateAt: d(12), weightedValue: 60, factors: { value: 0.9, fit: 0.8, urgency: 0.5, momentum: 0.6, effort: 0.3, risk: 0.2 }, sampleEligible: true },
  { id: 'SYN-2', account: 'Corner Wellness', state: 'CONTACTED', createdAt: d(20), enteredStateAt: d(6), weightedValue: 18, factors: { value: 0.5, fit: 0.6, urgency: 0.4, momentum: 0.3, effort: 0.6, risk: 0.4 } },
  { id: 'SYN-3', account: 'Gone Co', state: 'DO_NOT_CONTACT', createdAt: d(80), enteredStateAt: d(50), weightedValue: 22, factors: { value: 0.7, fit: 0.5, urgency: 0.2, momentum: 0.1, effort: 0.7, risk: 0.9 }, dnc: true },
];

test('H1/H2: every lead appears in the ranking exactly once with a traceable explanation', () => {
  const r = P.rank(LEADS, P.DEFAULT_WEIGHTS);
  expect(r.count).toBe(3);
  const ids = r.ranked.map(x => x.leadId).sort();
  expect(ids).toEqual(['SYN-1', 'SYN-2', 'SYN-3']);
  for (const row of r.ranked) {
    expect(row.explain).toBeTruthy();
    // the top contribution factor is one of the real factor keys
    expect(P.FACTOR_KEYS).toContain(row.top[0]);
  }
});

test('H3: progression aging uses the same records; ages are consistent and ordered', () => {
  const a = PR.analyze(LEADS, { asOf: ASOF });
  const byId = Object.fromEntries(a.rows.map(r => [r.leadId, r]));
  expect(Object.keys(byId).sort()).toEqual(['SYN-1', 'SYN-2', 'SYN-3']);
  // SYN-1 created 40d ago, SYN-2 20d ago -> SYN-1 older
  expect(byId['SYN-1'].ageDays).toBeGreaterThan(byId['SYN-2'].ageDays);
  // DO_NOT_CONTACT is terminal -> DONE, never stalled
  expect(byId['SYN-3'].agingBucket).toBe('DONE');
  expect(byId['SYN-3'].stalled).toBe(false);
});

test('H4: concentration uses the same account identities and value sum (no phantom accounts)', () => {
  const c = C.analyze(LEADS);
  expect(c.total).toBe(60 + 18 + 22);
  expect(c.dealCount).toBe(3);
  // every known account is one of the leads' real accounts
  const accounts = LEADS.map(l => l.account);
  expect(accounts).toContain(c.topAccount.account);
  expect(c.knownAccountCount).toBe(3);
  expect(c.unknownAccountDeals).toBe(0);
});

test('H5/H8: next-action respects stage and suppression consistently with the records', () => {
  const rec = N.recommendAll(LEADS);
  const byId = Object.fromEntries(rec.rows.map(r => [r.leadId, r]));
  // DNC lead -> STOP everywhere; never an outreach recommendation
  expect(byId['SYN-3'].action).toMatch(/STOP/);
  expect(byId['SYN-3'].action).not.toMatch(/DRAFT|FOLLOW|SEND/);
  // INTERESTED + sample-eligible -> a sample/ wholesale step, owner-gated
  expect(byId['SYN-1'].action).toMatch(/SAMPLE|WHOLESALE/);
  expect(byId['SYN-1'].ownerDecisionRequired).toBe(true);
  expect(rec.noExternalSideEffects).toBe(true);
});

test('H6: a reply for a real lead routes to the matching review bucket', () => {
  const t = LAB.triage([
    { id: 'SYN-2', text: 'What is your wholesale pricing?' },
    { id: 'SYN-3', text: 'unsubscribe me please' },
  ], R);
  const suppressIds = t.suppressReview.map(r => r.id);
  expect(suppressIds).toContain('SYN-3');        // opt-out -> suppression review
  expect(t.reviewCount + t.suppressCount + t.autoClearCount).toBe(2);
  expect(t.noAutoAction).toBe(true);
});

test('H7/H8: a suppressed lead is consistent across ranking, progression and next-action', () => {
  // SYN-3 is DNC: terminal in progression, STOP in next-action, and still
  // rankable as data (priority sorts a list) but never recommended for outreach.
  const rec = N.recommendAll(LEADS);
  const na = Object.fromEntries(rec.rows.map(r => [r.leadId, r.action]));
  const prog = Object.fromEntries(PR.analyze(LEADS, { asOf: ASOF }).rows.map(r => [r.leadId, r]));
  expect(na['SYN-3']).toMatch(/STOP/);
  expect(prog['SYN-3'].terminal).toBe(true);
  // identity is stable: the same id is used by every engine, none invented
  const idsP = P.rank(LEADS, P.DEFAULT_WEIGHTS).ranked.map(x => x.leadId).sort();
  const idsPr = PR.analyze(LEADS, { asOf: ASOF }).rows.map(r => r.leadId).sort();
  expect(idsP).toEqual(idsPr);
});
