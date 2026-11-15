// Owner review of Nov 3, point 8: the sales workflow end to end, with the REAL
// modules chained together (each was only tested alone before):
//   store import (validate, find duplicates) -> explainable qualification ->
//   draft from approved facts only (claim-checked; missing facts block it) ->
//   owner review, edit, approval (an edit invalidates the approval) ->
//   SIMULATED outbox (send is off; even the test double refuses without an
//   approval, a duplicate, or a suppressed recipient) -> reply classification ->
//   next step -> audit trail with no external side effect.
// Pure, Node-only, synthetic. Nothing is sent anywhere.
// Writing this test found two real faults, both fixed Nov 15:
//   * the next-step advisor did not know the reply reader's opt-out labels
//     (UNSUBSCRIBE, BOUNCE, DECLINED) and gave "review reply" instead of
//     "review — suppress";
//   * the "interested" reply template claimed "I've attached the line sheet"
//     although drafts never carry an attachment.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const M = name => require('../../assets/sales/he-sales-' + name + '.js');
const IMP = M('import'), LEADS = M('leads'), OUT = M('outreach'), AI = M('ai'), CLAIMS = M('claims');
const APPR = M('approval'), MAIL = M('gmail'), REPLIES = M('replies'), NEXT = M('nextaction'), AUDIT = M('audit');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const ROWS = [
  { storeName: 'SYN Cedar Spa', email: 'buyer@cedarspa.example', website: 'cedarspa.example', city: 'Chicago', state: 'IL', source: 'synthetic list', sourceDate: '2026-11-01', category: 'spa' },
  { storeName: 'Cedar Spa (SYN)', email: 'Buyer@CedarSpa.example', city: 'Chicago', state: 'IL', source: 'synthetic list', sourceDate: '2026-11-02', category: 'spa' }, // same email
  { storeName: 'SYN Harbor Gifts', website: 'harborgifts.example', city: 'Evanston', state: 'IL', source: 'synthetic list', category: 'gift' },
  { storeName: '', email: 'not-an-email', source: '' },                                                                                       // unusable
];
const FACTS = {
  productName: { value: 'Shea Body Butter', source: 'owner', status: 'APPROVED' },
  senderName: { value: 'Health Endeavors', source: 'owner', status: 'APPROVED' },
  wholesalePrice: { value: '$12.00', source: 'unconfirmed note', status: 'PROPOSED' },        // not approved -> never used
};
const LEAD = { id: 'SYN-L1', storeName: 'SYN Cedar Spa', email: 'buyer@cedarspa.example', website: 'cedarspa.example', category: 'skincare', size: 'medium', region: 'domestic', carriesSimilarBrands: true };
const NOW = '2026-11-15T15:00:00Z';

test('the whole path, step by step, with nothing sent', () => {
  const trail = AUDIT.createTrail();

  // 1. Import: problems named, the duplicate found (never merged), nothing dropped silently.
  const prev = IMP.importPreview(ROWS);
  expect(prev.count).toBe(4);
  expect(prev.prepared[3].problems).toEqual(expect.arrayContaining(['missing business name', 'email is malformed', 'missing source provenance']));
  expect(prev.duplicates).toHaveLength(1);
  expect(prev.duplicates[0].members).toEqual([0, 1]);
  expect(prev.needsConfirmation).toBe(true);

  // 2. Qualification, with the reasons shown.
  const scoring = LEADS.score(LEAD);
  expect(scoring.band).toBe('hot');
  expect(scoring.reasons.join(' | ')).toMatch(/category fit skincare: \+\d+ \| size medium: \+\d+ \| region domestic: \+\d+ \| reachable by email: \+10 \| already carries similar brands: \+10/);
  expect(OUT.eligibleForOutreach(scoring).eligible).toBe(true);
  trail.record('SUGGESTION', { leadId: LEAD.id, detail: 'qualified: ' + scoring.score, at: NOW });

  // 3. Draft from APPROVED facts only; the unapproved price is never used; claim-checked.
  const drafter = AI.createDrafter({ provider: 'template' });
  const draft = OUT.buildOutreach({ kind: 'intro', lead: Object.assign({ scoring }, LEAD), facts: FACTS, drafter, claims: CLAIMS, now: NOW });
  expect(draft).toMatchObject({ status: 'DRAFT', sent: false, provider: 'template' });
  expect(draft.factsUsed.map(f => f.fact).sort()).toEqual(['productName', 'senderName']);
  expect(draft.body).toContain('Shea Body Butter');
  expect(draft.body).not.toContain('$12.00');
  expect(draft.claimScan.ok).toBe(true);
  trail.record('REVIEW', { leadId: LEAD.id, detail: 'draft reviewed', at: NOW });

  // 4. Owner approval; an edit invalidates it; re-approval is recorded.
  const material = d => ({ kind: d.kind, recipient: LEAD.email, subject: d.subject, body: d.body, attachments: [], productFacts: d.factsUsed, commercialTerms: null });
  const approval = APPR.approve(material(draft), 'owner', NOW);
  expect(approval).toMatchObject({ status: 'APPROVED', sent: false });
  expect(APPR.check(approval, material(draft)).valid).toBe(true);
  const edited = Object.assign({}, draft, { body: draft.body.replace('short conversation', 'quick call') });
  const stale = APPR.check(approval, material(edited));
  expect(stale).toMatchObject({ valid: false, invalidated: true });
  expect(APPR.changedFields(material(draft), material(edited))).toEqual(['body']);
  const approval2 = APPR.approve(material(edited), 'owner', NOW);
  expect(APPR.check(approval2, material(edited)).valid).toBe(true);
  trail.record('APPROVAL', { leadId: LEAD.id, fingerprint: approval2.fingerprint, at: NOW });

  // 5. The real default mailbox can do nothing at all.
  const real = MAIL.createMailbox(MAIL.REAL_DEFAULT);
  expect(real.state).toBe('NOT_CONNECTED');
  expect(() => real.draft({ leadId: LEAD.id, to: LEAD.email, subject: 'x', body: 'y' })).toThrow(/DRAFT capability is off/);
  // The test double with drafting on and SEND OFF: prepared, never sent.
  const box = MAIL.createMailbox({ connected: true, capabilities: { read: true, draft: true, send: false } });
  const rec = box.draft({ key: 'SYN-L1:intro', leadId: LEAD.id, to: LEAD.email, subject: edited.subject, body: edited.body });
  box.attachApproval(rec.key, { owner: 'owner', at: NOW });
  expect(() => box.send(rec.key)).toThrow(/SEND is disabled/);
  expect(box.get(rec.key).status).toBe('APPROVED_FOR_SEND');
  // The guards a future send must pass, shown on the double with send switched on.
  const dbl = MAIL.createMailbox({ connected: true, capabilities: { read: true, draft: true, send: true } });
  dbl.draft({ key: 'k1', leadId: LEAD.id, to: LEAD.email, subject: 's', body: 'b' });
  expect(() => dbl.send('k1')).toThrow(/without an owner approval/);
  dbl.attachApproval('k1', { owner: 'owner', at: NOW });
  expect(dbl.send('k1').status).toBe('SENT');                       // marks a record only
  expect(() => dbl.send('k1')).toThrow(/duplicate send blocked/);
  trail.record('SIMULATED_OUTCOME', { leadId: LEAD.id, detail: 'SIMULATED — nothing sent', at: NOW });

  // 6. Reply classification -> next step.
  const interested = REPLIES.classify('Sounds great, we would love to carry it. Can we set up a call?');
  expect(interested.label).toBe('INTERESTED');
  expect(NEXT.recommend({ state: 'INTERESTED', hasReply: true, replyLabel: interested.label }).action).toMatch(/WHOLESALE|SAMPLE/);
  // The follow-up draft for an interested store claims no attachment.
  const reply = OUT.buildOutreach({ kind: 'reply_interested', lead: Object.assign({ scoring }, LEAD), facts: FACTS, drafter, claims: CLAIMS });
  expect(reply.status).toBe('DRAFT');
  expect(reply.body).not.toMatch(/attached/i);

  // 7. Audit trail: in order, nothing external.
  expect(trail.lifecycleOrderOk(LEAD.id)).toBe(true);
  expect(trail.summary()).toMatchObject({ total: 4, noExternalSideEffects: true });
});

test('an opt-out, a "not interested" or a bounce routes to suppression, and suppression blocks everything after it', () => {
  for (const text of ['Please remove me from your list.', 'Not interested, thanks.', 'Mail delivery failed: address not found']) {
    const c = REPLIES.classify(text);
    expect(REPLIES.suppresses(c.label), text).toBe(true);
    const next = NEXT.recommend({ state: 'REPLIED', hasReply: true, replyLabel: c.label });
    expect(next.action, text).toMatch(/suppress/i);
    expect(next.ownerDecisionRequired, text).toBe(true);
  }
  // A non-opt-out reply still goes to a normal human review.
  expect(NEXT.recommend({ state: 'REPLIED', hasReply: true, replyLabel: 'PRICE_QUESTION' }).action).toBe('REVIEW REPLY');
  // Once suppressed, no approval is possible and a held approval stops being valid.
  const d = { kind: 'intro', recipient: LEAD.email, subject: 's', body: 'b', attachments: [], productFacts: [], commercialTerms: null };
  const ok = APPR.approve(d, 'owner', NOW);
  expect(APPR.approve(Object.assign({}, d, { dnc: true }), 'owner', NOW).status).toBe('REFUSED');
  expect(APPR.check(ok, Object.assign({}, d, { optOut: true }))).toMatchObject({ valid: false, superseded: true });
  // ...and the mailbox refuses at the moment of sending, even with an approval.
  const box = MAIL.createMailbox({ connected: true, capabilities: { read: true, draft: true, send: true } });
  box.draft({ key: 'k2', leadId: LEAD.id, to: LEAD.email, subject: 's', body: 'b' });
  box.attachApproval('k2', { owner: 'owner', at: NOW });
  expect(box.receive({ from: 'BUYER@cedarspa.example', kind: 'UNSUBSCRIBE' }).suppressedNow).toBe(true);
  expect(() => box.send('k2')).toThrow(/recipient is suppressed/);
  // A stopped lead is told to stop.
  expect(NEXT.recommend({ state: 'CONTACTED', dnc: true }).action).toMatch(/STOP/);
});

test('missing approved facts, a weak lead or a health claim each block the draft, with the reason', () => {
  const drafter = AI.createDrafter({ provider: 'template' });
  const lead = Object.assign({ scoring: LEADS.score(LEAD) }, LEAD);
  const noFacts = OUT.buildOutreach({ kind: 'intro', lead, facts: { productName: { value: 'Shea Body Butter', status: 'PROPOSED' } }, drafter, claims: CLAIMS });
  expect(noFacts).toMatchObject({ status: 'BLOCKED', sent: false });
  expect(noFacts.reason).toMatch(/missing approved fact\(s\): productName/);
  const weak = OUT.buildOutreach({ kind: 'intro', lead: Object.assign({}, lead, { scoring: { score: 20 } }), facts: FACTS, drafter, claims: CLAIMS });
  expect(weak.reason).toMatch(/not qualified for outreach/);
  const claimy = OUT.buildOutreach({ kind: 'intro', lead, facts: { productName: { value: 'Eczema Cure Butter', status: 'APPROVED' } }, drafter, claims: CLAIMS });
  expect(claimy.status).toBe('BLOCKED');
  expect(claimy.reason).toMatch(/claim firewall/);
  // A blocked draft cannot be approved either.
  expect(APPR.approve({ kind: 'intro', claimBlocked: true }, 'owner', NOW).status).toBe('REFUSED');
  // Only the free template writer can be used; a paid one is a loud refusal, never a silent switch.
  expect(() => AI.createDrafter({ provider: 'claude' }).draft('intro', {})).toThrow(/not configured/);
});
