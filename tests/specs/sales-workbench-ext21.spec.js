// Outreach workbench engine (owner's Nov 3 brief: the sales workflow runnable
// end to end, with saved state and a reset). Pure, Node-only, synthetic,
// SIMULATED: the "send" is a line in a simulated outbox, never an email.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const W = require('../../assets/sales/he-sales-workbench.js');
const M = n => require('../../assets/sales/he-sales-' + n + '.js');
const D = { import: M('import'), leads: M('leads'), outreach: M('outreach'), ai: M('ai'), claims: M('claims'), approval: M('approval'), replies: M('replies'), nextaction: M('nextaction') };
const OWNER = { role: 'owner', by: 'owner', at: '2026-11-15T15:00:00Z' };
const ADMIN = { role: 'administrator', by: 'admin-1', at: '2026-11-15T15:00:00Z' };

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const imported = () => W.importRows(W.empty(), W.exampleRows(), D, OWNER).state;
const ready = () => { let s = imported(); s = W.draftFor(s, 'S1', D, OWNER).state; return W.approve(s, 'S1', D, OWNER).state; };

test('import: every row checked and scored; a duplicate is marked, not merged; an unusable row says why', () => {
  const r = W.importRows(W.empty(), W.exampleRows(), D, OWNER);
  expect(r.ok).toBe(true);
  expect(r.state.stores.map(s => [s.id, s.status])).toEqual([['S1', 'IMPORTED'], ['S2', 'LIKELY_DUPLICATE'], ['S3', 'IMPORTED'], ['S4', 'IMPORTED'], ['S5', 'NOT_USABLE']]);
  expect(r.state.duplicates).toEqual([['S1', 'S2']]);
  expect(r.state.stores[0].scoring.reasons.length).toBeGreaterThanOrEqual(4);
  expect(r.state.stores[4].problems).toEqual(expect.arrayContaining(['missing business name', 'missing source provenance']));
  expect(r.state.stores[4].scoring).toBeNull();
  expect(W.importRows(W.empty(), [], D, OWNER).message).toMatch(/empty/);
  expect(W.importRows(W.empty(), Array.from({ length: W.MAX_ROWS + 1 }, () => ({ storeName: 'x' })), D, OWNER).message).toMatch(/Nothing was imported/);
});

test('drafting: approved facts only; a duplicate, an unusable row and a weak fit are refused with a reason', () => {
  const s = imported();
  const ok = W.draftFor(s, 'S1', D, OWNER);
  expect(ok.ok).toBe(true);
  expect(ok.state.drafts.S1.factsUsed.map(f => f.fact).sort()).toEqual(['productName', 'senderName']);
  expect(ok.state.drafts.S1.body).toContain('Shea Body Butter');
  expect(ok.state.drafts.S1.body).not.toMatch(/not set|attached/);
  expect(W.draftFor(s, 'S2', D, OWNER).message).toMatch(/duplicate/);
  expect(W.draftFor(s, 'S5', D, OWNER).message).toMatch(/cannot be used/);
  const weak = W.draftFor(s, 'S4', D, OWNER);
  expect(weak.ok).toBe(false);
  expect(weak.message).toMatch(/not qualified for outreach/);
  expect(weak.state.audit[weak.state.audit.length - 1].action).toBe('DRAFT_BLOCKED');   // the refusal is on the record
  const noFacts = W.draftFor(s, 'S1', D, Object.assign({ facts: { productName: { value: 'Shea Body Butter', status: 'PROPOSED' } } }, OWNER));
  expect(noFacts.message).toMatch(/missing approved fact/);
});

test('approval: owner or administrator only; staff are refused', () => {
  const s = W.draftFor(imported(), 'S1', D, OWNER).state;
  expect(W.approve(s, 'S1', D, { role: 'employee' }).message).toMatch(/Only the owner or an administrator/);
  expect(W.approve(s, 'S1', D, ADMIN).ok).toBe(true);
  expect(W.approve(s, 'S9', D, OWNER).message).toMatch(/no draft/i);
});

test('an edit cancels the approval; a health claim cannot be saved; empty or unchanged text is refused', () => {
  const s = ready();
  expect(s.approvals.S1).toBeTruthy();
  const e = W.editDraft(s, 'S1', s.drafts.S1.body + '\nP.S. We are local to Chicago.', D, OWNER);
  expect(e.ok).toBe(true);
  expect(e.message).toMatch(/approval no longer applies/);
  expect(e.state.approvals.S1).toBeUndefined();
  expect(e.state.drafts.S1.version).toBe(2);
  expect(W.simulateSend(e.state, 'S1', D, OWNER).message).toMatch(/has not been approved/);
  expect(W.editDraft(s, 'S1', 'Our butter cures eczema.', D, OWNER).message).toMatch(/health claim/);
  expect(W.editDraft(s, 'S1', '   ', D, OWNER).message).toMatch(/cannot be empty/);
  expect(W.editDraft(s, 'S1', s.drafts.S1.body, D, OWNER).message).toMatch(/Nothing changed/);
  expect(W.editDraft(s, 'S1', 'x'.repeat(W.MAX_BODY + 1), D, OWNER).message).toMatch(/limit is/);
});

test('simulated send: one line in the outbox, never delivered, never twice', () => {
  const s = ready();
  const r = W.simulateSend(s, 'S1', D, OWNER);
  expect(r.ok).toBe(true);
  expect(r.message).toMatch(/No email was sent/);
  expect(r.state.outbox).toEqual([expect.objectContaining({ storeId: 'S1', status: 'SIMULATED_SENT', delivered: false, version: 1 })]);
  expect(W.simulateSend(r.state, 'S1', D, OWNER).message).toMatch(/already sent once/);
  // An approval is checked against the exact text at the moment of sending.
  const tampered = JSON.parse(JSON.stringify(s)); tampered.drafts.S1.body += ' (changed without an edit)';
  expect(W.simulateSend(tampered, 'S1', D, OWNER).message).toMatch(/changed since approval/);
});

test('a reply is read; an opt-out puts the address on the do-not-contact list, which then blocks everything', () => {
  let s = W.simulateSend(ready(), 'S1', D, OWNER).state;
  expect(W.recordReply(s, 'S3', 'hello', D, OWNER).message).toMatch(/has not been contacted/);
  const r = W.recordReply(s, 'S1', 'Please remove me from your list.', D, OWNER);
  expect(r.message).toMatch(/UNSUBSCRIBE.*REVIEW — suppress/);
  s = r.state;
  expect(s.suppressed).toEqual(['buyer@cedarspa.example']);
  expect(s.stores[0].status).toBe('DO NOT CONTACT');
  expect(W.draftFor(s, 'S1', D, OWNER).message).toMatch(/asked not to be contacted/);
  // The do-not-contact list survives a new import of the same list.
  const again = W.importRows(s, W.exampleRows(), D, OWNER).state;
  expect(again.suppressed).toEqual(['buyer@cedarspa.example']);
  expect(W.draftFor(again, 'S1', D, OWNER).message).toMatch(/asked not to be contacted/);
  // An interested reply suggests a real next step instead.
  const t = W.simulateSend(W.approve(W.draftFor(imported(), 'S3', D, OWNER).state, 'S3', D, OWNER).state, 'S3', D, OWNER).state;
  expect(W.recordReply(t, 'S3', 'Sounds great, we would love to carry it.', D, OWNER).message).toMatch(/INTERESTED/);
});

test('saving: a round trip is exact; damaged or old saved data starts empty and says so', () => {
  const s = W.recordReply(W.simulateSend(ready(), 'S1', D, OWNER).state, 'S1', 'Sounds great!', D, OWNER).state;
  const back = W.restore(W.serialize(s));
  expect(back).toMatchObject({ ok: true, restored: true });
  expect(back.state).toEqual(s);
  for (const bad of ['{not json', '[]', 'null', JSON.stringify({ version: 99 }), JSON.stringify(Object.assign({}, s, { stores: 'x' }))]) {
    const r = W.restore(bad);
    expect(r.ok, bad.slice(0, 20)).toBe(false);
    expect(r.state).toEqual(W.empty());
    expect(r.message).toMatch(/starts empty/);
  }
  expect(W.restore(null)).toMatchObject({ ok: true, restored: false });
});

test('no step changes the state it was given, and nothing ever leaves', () => {
  const s = ready(); const before = JSON.stringify(s);
  W.editDraft(s, 'S1', 'Different text.', D, OWNER);
  W.simulateSend(s, 'S1', D, OWNER);
  W.importRows(s, W.exampleRows(), D, OWNER);
  expect(JSON.stringify(s)).toBe(before);
  const end = W.recordReply(W.simulateSend(s, 'S1', D, OWNER).state, 'S1', 'Remove me', D, OWNER).state;
  expect(W.summary(end)).toMatchObject({ simulatedSent: 1, doNotContact: 1, noExternalSideEffects: true });
  expect(end.audit.map(a => a.action)).toEqual(['IMPORTED', 'DRAFTED', 'APPROVED', 'SIMULATED_SEND', 'REPLY']);
});
