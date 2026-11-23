// Reserve IV — NEXT-BEST-ACTION v2. Deterministic, safety-gated single next
// step per lead. Pure, no side effects. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const N = require('../../assets/sales/he-sales-nextaction.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('a declined / DNC / opt-out lead can only be told to STOP', () => {
  expect(N.recommend({ state: 'DECLINED' }).action).toMatch(/STOP/);
  expect(N.recommend({ state: 'DO_NOT_CONTACT' }).action).toMatch(/STOP/);
  expect(N.recommend({ state: 'QUALIFIED', dnc: true }).action).toMatch(/STOP/);
  expect(N.recommend({ state: 'INTERESTED', optOut: true }).action).toMatch(/STOP/);
  // and never an external side effect
  expect(N.recommend({ state: 'DO_NOT_CONTACT' }).externalSideEffect).toBe(false);
});

test('finished stages have no next step', () => {
  for (const s of ['CUSTOMER', 'LOST', 'NOT_A_FIT']) {
    expect(N.recommend({ state: s }).action).toMatch(/NONE/);
  }
});

test('an opt-out / complaint reply routes to suppression review, not a follow-up', () => {
  const r = N.recommend({ state: 'CONTACTED', hasReply: true, replyLabel: 'OPT_OUT' });
  expect(r.action).toMatch(/suppress/i);
  expect(r.ownerDecisionRequired).toBe(true);
  const c = N.recommend({ state: 'CONTACTED', hasReply: true, replyLabel: 'COMPLAINT' });
  expect(c.action).toMatch(/suppress/i);
});

test('an unknown reply routes to a human read with low confidence', () => {
  const r = N.recommend({ state: 'REPLIED', hasReply: true, replyLabel: 'UNKNOWN' });
  expect(r.action).toMatch(/read reply/i);
  expect(r.confidence).toBe('LOW');
  expect(r.ownerDecisionRequired).toBe(true);
});

test('stage drives the step: qualified -> draft, drafted -> approve (not send), approved -> send by hand', () => {
  expect(N.recommend({ state: 'QUALIFIED' }).action).toMatch(/DRAFT OUTREACH/);
  const drafted = N.recommend({ state: 'OUTREACH_DRAFTED' });
  expect(drafted.action).toMatch(/APPROVE/);
  expect(drafted.action).not.toMatch(/\bSEND\b/); // approve is not send
  expect(drafted.ownerDecisionRequired).toBe(true);
  const approved = N.recommend({ state: 'OWNER_APPROVED' });
  expect(approved.action).toMatch(/BY HAND/);
});

test('contacted: wait when fresh, draft a follow-up once it has aged', () => {
  expect(N.recommend({ state: 'CONTACTED', daysInStage: 1 }).action).toMatch(/WAIT/);
  const aged = N.recommend({ state: 'CONTACTED', daysInStage: 6 });
  expect(aged.action).toMatch(/FOLLOW-UP/);
  expect(aged.alternatives).toContain('WAIT');
});

test('interested: sample path only when eligible, else wholesale discussion', () => {
  expect(N.recommend({ state: 'INTERESTED', sampleEligible: true }).action).toMatch(/SAMPLE/);
  expect(N.recommend({ state: 'INTERESTED', sampleEligible: false }).action).toMatch(/WHOLESALE/);
});

test('sample stages never ship automatically', () => {
  expect(N.recommend({ state: 'SAMPLE_CONSIDERATION' }).action).toMatch(/DECIDE/);
  expect(N.recommend({ state: 'SAMPLE_APPROVED' }).action).toMatch(/BY HAND/);
});

test('recommendAll is deterministic, counts owner decisions, no side effects', () => {
  const leads = [
    { id: 'a', state: 'QUALIFIED' },
    { id: 'b', state: 'OUTREACH_DRAFTED' },
    { id: 'c', state: 'DO_NOT_CONTACT' },
  ];
  const r1 = N.recommendAll(leads);
  const r2 = N.recommendAll(leads);
  expect(r1.rows.map(x => x.action)).toEqual(r2.rows.map(x => x.action));
  expect(r1.count).toBe(3);
  expect(r1.ownerDecisions).toBeGreaterThanOrEqual(1);
  expect(r1.noExternalSideEffects).toBe(true);
  expect(r1.guard).toMatch(/ships nothing/i);
});

test('empty / unknown input is safe', () => {
  expect(N.recommendAll([]).count).toBe(0);
  expect(N.recommend({}).action).toBeTruthy(); // defaults to NEW -> QUALIFY
  expect(N.recommend(null).externalSideEffect).toBe(false);
});
