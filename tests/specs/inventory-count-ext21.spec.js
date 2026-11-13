// #54/#55 cycle count + adjustment approval. Pure, Node-only, synthetic.
// Draft count -> discrepancy review -> owner-approved adjustment -> audit.
// Advisory/draft-only: an approved adjustment names the safe write (R4) and is
// never applied to real stock. Canceled and duplicate submissions are refused.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const I = require('../../assets/inventory/he-inventory-count.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

function counted() {
  const c = I.startCount(I.fixtures());
  I.recordCount(c, 'HE-HONEY-8OZ', 38); // short 2
  I.recordCount(c, 'HE-VEGAN-8OZ', 25); // match
  I.recordCount(c, 'HE-SHEA-4OZ', 15);  // over 3
  return c;
}

test('a completed count surfaces discrepancies with direction and delta', () => {
  const c = counted();
  const d = I.discrepancies(c);
  expect(d).toHaveLength(2); // the matching line is not a discrepancy
  expect(d.find(x => x.sku === 'HE-HONEY-8OZ')).toMatchObject({ delta: -2, direction: 'SHORT' });
  expect(d.find(x => x.sku === 'HE-SHEA-4OZ')).toMatchObject({ delta: 3, direction: 'OVER' });
});

test('an incomplete count cannot be submitted', () => {
  const c = I.startCount(I.fixtures());
  I.recordCount(c, 'HE-HONEY-8OZ', 38);
  const r = I.submitForApproval(c);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/incomplete/);
  expect(c.status).toBe('DRAFT');
});

test('owner-approved adjustment is advisory (never applied) and names the safe write', () => {
  const c = counted();
  expect(I.submitForApproval(c, 'staff', '2026-11-13T10:00:00Z').ok).toBe(true);
  expect(c.status).toBe('PENDING_APPROVAL');
  // staff cannot approve a stock adjustment.
  expect(I.approveAdjustment(c, { role: 'staff' }).ok).toBe(false);
  const ap = I.approveAdjustment(c, { role: 'owner', by: 'owner', at: '2026-11-13T11:00:00Z' });
  expect(ap.ok).toBe(true);
  expect(c.status).toBe('APPROVED');
  expect(ap.adjustments).toHaveLength(2);
  expect(ap.adjustments.every(a => a.applied === false)).toBe(true);     // never written
  expect(ap.adjustments[0].writeContract).toMatch(/adjust_inventory \(R4\)/);
});

test('a duplicate submit and a duplicate approve are refused, not double-applied', () => {
  const c = counted();
  I.submitForApproval(c, 'staff', 't');
  const dupSubmit = I.submitForApproval(c);
  expect(dupSubmit.ok).toBe(false);
  expect(dupSubmit.duplicate).toBe(true);
  I.approveAdjustment(c, { role: 'owner' });
  const dupApprove = I.approveAdjustment(c, { role: 'owner' });
  expect(dupApprove.ok).toBe(false);
  expect(dupApprove.duplicate).toBe(true);
});

test('a canceled count is terminal: it cannot be submitted, approved, or re-canceled', () => {
  const c = counted();
  expect(I.cancelCount(c, 'staff', 't', 'recount needed').ok).toBe(true);
  expect(c.status).toBe('CANCELED');
  expect(I.submitForApproval(c).ok).toBe(false);
  expect(I.approveAdjustment(c, { role: 'owner' }).reason).toMatch(/canceled/);
  expect(I.cancelCount(c).duplicate).toBe(true);
  // An approved count cannot be canceled either.
  const c2 = counted();
  I.submitForApproval(c2, 'staff', 't');
  I.approveAdjustment(c2, { role: 'owner' });
  expect(I.cancelCount(c2).reason).toMatch(/cannot cancel an approved/);
});

test('every state transition is recorded in the audit trail', () => {
  const c = counted();
  I.submitForApproval(c, 'staff', 't');
  I.approveAdjustment(c, { role: 'owner', by: 'owner' });
  const actions = c.audit.map(a => a.action);
  expect(actions).toEqual(['STARTED', 'COUNTED', 'COUNTED', 'COUNTED', 'SUBMITTED', 'APPROVED']);
  expect(c.audit[c.audit.length - 1].actor).toBe('owner');
});
