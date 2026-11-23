// Two-role handoff: staff prepares, owner approves (wave-2 item 5). Pure,
// Node-only, synthetic. A restricted operator prepares an outreach draft (an
// append-only audit trail records SUGGESTION + REVIEW); the owner approves
// (APPROVAL recorded with the approved fingerprint). The audit trail is
// append-only so it survives a re-read ("refresh"); and if the record changes
// between prepare and approve, the stale approval is invalidated and must be
// re-reviewed. Nothing is sent.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const A = require('../../assets/sales/he-sales-approval.js');
const AUD = require('../../assets/sales/he-sales-audit.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

function draft(bodyExtra) {
  return {
    kind: 'wholesale', recipient: 'buyer@syntheticstore.test', subject: 'Intro',
    body: 'Hi — Sea Foam samples attached.' + (bodyExtra || ''),
    attachments: [], productFacts: { productName: 'Sea Foam', source: 'facts v1' }, commercialTerms: { moq: 12 },
  };
}

test('staff prepares and owner approves; the audit trail records the handoff in order', () => {
  const trail = AUD.createTrail();
  const lead = 'SYN-lead-1';
  const d = draft();
  // restricted operator prepares
  trail.record('SUGGESTION', { leadId: lead, by: 'staff', at: '2026-11-08T09:00:00Z' });
  trail.record('REVIEW', { leadId: lead, by: 'staff', at: '2026-11-08T09:05:00Z', fingerprint: A.fingerprint(d) });
  // owner approves the exact prepared draft
  const appr = A.approve(d, 'owner', '2026-11-08T10:00:00Z');
  expect(appr.status).toBe('APPROVED');
  trail.record('APPROVAL', { leadId: lead, by: 'owner', at: '2026-11-08T10:00:00Z', fingerprint: appr.fingerprint });

  const counts = trail.summary().counts;
  expect(counts.SUGGESTION).toBe(1);
  expect(counts.REVIEW).toBe(1);
  expect(counts.APPROVAL).toBe(1);
  expect(trail.lifecycleOrderOk(lead)).toBe(true);     // SUGGESTION -> REVIEW -> APPROVAL
  expect(trail.summary().noExternalSideEffects).toBe(true);
  // the approval is bound to exactly what staff prepared
  expect(A.check(appr, d).valid).toBe(true);
});

test('the audit trail is append-only and survives a re-read (refresh)', () => {
  const trail = AUD.createTrail();
  const lead = 'SYN-lead-2';
  trail.record('SUGGESTION', { leadId: lead, by: 'staff' });
  trail.record('REVIEW', { leadId: lead, by: 'staff' });
  const before = trail.forLead(lead).length;
  // "refresh" = read the trail again; the entries are still all there, in order
  const after = trail.forLead(lead);
  expect(after.length).toBe(before);
  expect(after.map(e => e.stage)).toEqual(['SUGGESTION', 'REVIEW']);
  // entries are frozen (append-only; a reader cannot mutate the record)
  expect(Object.isFrozen(after[0])).toBe(true);
});

test('if the record changes between prepare and approve, the stale approval is invalidated', () => {
  const lead = 'SYN-lead-3';
  const prepared = draft();                 // what staff reviewed
  const appr = A.approve(prepared, 'owner', '2026-11-08T10:00:00Z');
  expect(A.check(appr, prepared).valid).toBe(true);
  // between the owner's approval and the send, the draft is edited (price added)
  const changed = draft(' We can also pay for a shelf feature.');
  const re = A.check(appr, changed);
  expect(re.valid).toBe(false);
  expect(re.invalidated).toBe(true);        // must go back to review
  // exactly which field changed is reportable for the audit note
  expect(A.changedFields(prepared, changed)).toContain('body');
});
