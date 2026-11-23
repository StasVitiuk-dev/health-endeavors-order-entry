// Sales & Growth — end-to-end lifecycle simulator (items 30 orchestration trace,
// 69-74 simulators). The whole synthetic lifecycle must produce ZERO external
// side effects, require the owner for every gated step, and let a DNC/unsubscribe
// event suppress everything immediately.
const { test, expect } = require('@playwright/test');
const SIM = require('../../assets/sales/he-sales-simulator.js');
const engine = {
  leads: require('../../assets/sales/he-sales-leads.js'),
  ai: require('../../assets/sales/he-sales-ai.js'),
  claims: require('../../assets/sales/he-sales-claims.js'),
  replies: require('../../assets/sales/he-sales-replies.js'),
  followup: require('../../assets/sales/he-sales-followup.js'),
};

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

test('a full lifecycle run has zero external side effects', () => {
  const r = SIM.run(engine, { ownerApproved: true, replyText: 'We would love to carry this!', product: 'body balm' });
  expect(r.noSideEffects).toBe(true);
  for (const t of r.trace) { expect(t.sent).toBe(false); expect(t.sideEffect).toBe(false); }
  expect(r.trace.find(t => t.step === 'draft').detail).toMatch(/status=DRAFT/);
  expect(r.trace.find(t => t.step === 'contact').detail).toMatch(/SIMULATED/);
  expect(r.guard).toMatch(/nothing was sent/i);
});

test('without owner approval, no contact happens', () => {
  const r = SIM.run(engine, { ownerApproved: false });
  const contact = r.trace.find(t => t.step === 'contact');
  expect(contact.ok).toBe(false);
  expect(contact.detail).toMatch(/not contacted/i);
});

test('a claim in the draft text blocks contact', () => {
  const r = SIM.run(engine, { ownerApproved: true, draftText: 'this balm cures eczema' });
  expect(r.trace.find(t => t.step === 'claim-check').ok).toBe(false);
  expect(r.trace.find(t => t.step === 'contact').ok).toBe(false);
});

test('an unsubscribe reply suppresses the rest of the lifecycle', () => {
  const r = SIM.run(engine, { ownerApproved: true, replyText: 'please unsubscribe me' });
  expect(r.summary.suppressed).toBe(true);
  expect(r.trace.find(t => t.step === 'suppress')).toBeTruthy();
  // nothing after suppression (no sample-decision step)
  expect(r.trace.find(t => t.step === 'sample-decision')).toBeUndefined();
  expect(r.noSideEffects).toBe(true);
});

test('the sample decision is never taken by the simulator itself', () => {
  const r = SIM.run(engine, { ownerApproved: true, replyText: 'thanks' });
  const sample = r.trace.find(t => t.step === 'sample-decision');
  expect(sample.ok).toBe(false); // owner did not approve -> not taken
});

test('inbound events: opt-out suppresses immediately, others are data', () => {
  const r = SIM.ingestEvents([
    { leadId: 'L1', kind: 'website_inquiry' },
    { leadId: 'L2', kind: 'unsubscribe' },
    { leadId: 'L3', kind: 'bounce' },
    { leadId: 'L4', kind: 'reply' },
  ]);
  expect(r.suppressed.sort()).toEqual(['L2', 'L3']);
  expect(r.log.find(e => e.leadId === 'L1').action).toMatch(/data only/);
  expect(r.guard).toMatch(/opt-outs suppress immediately/i);
});
