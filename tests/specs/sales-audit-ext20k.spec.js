// Reserve IV — WAVE H9: audit trail distinguishes suggestion / review /
// approval / simulated outcome, is append-only, and never records an external
// action. Integrates with the approval fingerprint. Pure, deterministic.
// Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const AU = require('../../assets/sales/he-sales-audit.js');
const AP = require('../../assets/sales/he-sales-approval.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('records each lifecycle stage with its own type and a default actor', () => {
  const t = AU.createTrail();
  const s = t.record('SUGGESTION', { leadId: 'L1', detail: 'next step: draft outreach' });
  const r = t.record('REVIEW', { leadId: 'L1', actor: 'owner', detail: 'looked at reply' });
  const a = t.record('APPROVAL', { leadId: 'L1', fingerprint: 'deadbeef', at: '2026-10-20T00:00:00Z' });
  const o = t.record('SIMULATED_OUTCOME', { leadId: 'L1', detail: 'SIMULATED: would contact by hand' });
  expect([s.stage, r.stage, a.stage, o.stage]).toEqual(['SUGGESTION', 'REVIEW', 'APPROVAL', 'SIMULATED_OUTCOME']);
  expect(s.actor).toBe('engine');   // default for a suggestion
  expect(a.actor).toBe('owner');    // default for an approval
  expect(a.fingerprint).toBe('deadbeef');
  expect(t.summary().counts).toEqual({ SUGGESTION: 1, REVIEW: 1, APPROVAL: 1, SIMULATED_OUTCOME: 1 });
});

test('no entry is ever an external side effect', () => {
  const t = AU.createTrail();
  for (const st of AU.STAGES) t.record(st, { leadId: 'L1' });
  expect(t.summary().noExternalSideEffects).toBe(true);
  expect(t.all().every(e => e.externalSideEffect === false)).toBe(true);
  expect(t.guard).toMatch(/never a real send/i);
});

test('the trail is append-only: entries are frozen and sequence is monotonic', () => {
  const t = AU.createTrail();
  const e0 = t.record('SUGGESTION', { leadId: 'L1' });
  const e1 = t.record('REVIEW', { leadId: 'L1' });
  expect(e1.seq).toBe(e0.seq + 1);
  // frozen: mutation attempts do not take (strict mode would throw; either way
  // the stored value is unchanged)
  try { e0.stage = 'APPROVAL'; } catch (err) { /* frozen in strict mode */ }
  expect(t.all()[0].stage).toBe('SUGGESTION');
  // no edit/delete API is exposed
  expect(typeof t.delete).toBe('undefined');
  expect(typeof t.update).toBe('undefined');
});

test('unknown stage throws (never a silent mislabel)', () => {
  const t = AU.createTrail();
  expect(() => t.record('SENT', { leadId: 'L1' })).toThrow(/unknown stage/);
});

test('lifecycleOrderOk: coherent journeys pass, backwards evidence fails', () => {
  const ok = AU.createTrail();
  ok.record('SUGGESTION', { leadId: 'L1' });
  ok.record('REVIEW', { leadId: 'L1' });
  ok.record('APPROVAL', { leadId: 'L1' });
  ok.record('SIMULATED_OUTCOME', { leadId: 'L1' });
  expect(ok.lifecycleOrderOk('L1')).toBe(true);

  const bad = AU.createTrail();
  bad.record('APPROVAL', { leadId: 'L2' });     // approval before any suggestion/review
  bad.record('SUGGESTION', { leadId: 'L2' });
  expect(bad.lifecycleOrderOk('L2')).toBe(false);

  // repeated same-stage entries are allowed
  const rep = AU.createTrail();
  rep.record('SUGGESTION', { leadId: 'L3' });
  rep.record('SUGGESTION', { leadId: 'L3' });
  expect(rep.lifecycleOrderOk('L3')).toBe(true);
});

test('forLead isolates one lead\'s evidence', () => {
  const t = AU.createTrail();
  t.record('SUGGESTION', { leadId: 'A' });
  t.record('SUGGESTION', { leadId: 'B' });
  t.record('REVIEW', { leadId: 'A' });
  expect(t.forLead('A').length).toBe(2);
  expect(t.forLead('B').length).toBe(1);
});

test('integrates with the approval fingerprint end-to-end (H workflow)', () => {
  const draft = { kind: 'intro', recipient: 'x@test', subject: 'Hi', body: 'body', attachments: [], productFacts: {}, commercialTerms: {} };
  const approval = AP.approve(draft, 'owner', '2026-10-20T00:00:00Z');
  const t = AU.createTrail();
  t.record('SUGGESTION', { leadId: 'L1', detail: 'draft outreach' });
  t.record('REVIEW', { leadId: 'L1', actor: 'owner' });
  const a = t.record('APPROVAL', { leadId: 'L1', fingerprint: approval.fingerprint, at: approval.approvedAt });
  // the approval entry carries the exact fingerprint, so a later edit to the
  // draft is detectable against the audit record
  expect(a.fingerprint).toBe(AP.fingerprint(draft));
  const edited = Object.assign({}, draft, { body: 'changed' });
  expect(AP.fingerprint(edited)).not.toBe(a.fingerprint);
  expect(t.lifecycleOrderOk('L1')).toBe(true);
});
