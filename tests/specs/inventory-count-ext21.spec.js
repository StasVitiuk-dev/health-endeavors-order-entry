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
  expect(I.submitForApproval(c, 'staff', '2026-11-13T10:00:00Z', 'Counted the main shelf').ok).toBe(true);
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
  I.submitForApproval(c, 'staff', 't', 'Counted the main shelf');
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
  I.submitForApproval(c2, 'staff', 't', 'Counted the main shelf');
  I.approveAdjustment(c2, { role: 'owner' });
  expect(I.cancelCount(c2).reason).toMatch(/cannot cancel an approved/);
});

test('every state transition is recorded in the audit trail', () => {
  const c = counted();
  I.submitForApproval(c, 'staff', 't', 'Counted the main shelf');
  I.approveAdjustment(c, { role: 'owner', by: 'owner' });
  const actions = c.audit.map(a => a.action);
  expect(actions).toEqual(['STARTED', 'COUNTED', 'COUNTED', 'COUNTED', 'SUBMITTED', 'APPROVED']);
  expect(c.audit[c.audit.length - 1].actor).toBe('owner');
});

// ---- owner decision of Nov 16 ----

test('a proposal needs a written reason, and keeps who proposed it and when', () => {
  const c = counted();
  for (const bad of [undefined, null, '', '   ', 'ok', 42, {}]) {
    const r = I.submitForApproval(c, 'staff', '2026-11-16T09:00:00Z', bad);
    expect(r.ok, String(bad)).toBe(false);
    expect(r.reason).toMatch(/written reason is required/);
    expect(c.status).toBe('DRAFT');
  }
  expect(I.submitForApproval(c, 'staff-anna', '2026-11-16T09:00:00Z', '  Counted the main shelf  ').ok).toBe(true);
  expect(c).toMatchObject({ status: 'PENDING_APPROVAL', reason: 'Counted the main shelf', submittedBy: 'staff-anna', submittedAt: '2026-11-16T09:00:00Z' });
});

test('the owner or an administrator approves (owner decision of Nov 24); staff and anyone else are refused, and may still propose', () => {
  const c = counted();
  expect(I.submitForApproval(c, 'staff-anna', '2026-11-16T09:00:00Z', 'Counted the main shelf').ok).toBe(true);
  for (const role of ['staff', 'employee', 'manager', 'viewer', '', null, undefined, 'OWNER', 'Administrator']) {
    const r = I.approveAdjustment(c, { role, by: 'someone', at: '2026-11-16T10:00:00Z' });
    expect(r.ok, String(role)).toBe(false);
    expect(r.reason).toMatch(/only the owner or an administrator may approve/);
  }
  expect(I.approveAdjustment(c, { role: 'staff' }).reason).toMatch(/staff may propose one/);
  expect(c.status).toBe('PENDING_APPROVAL');
  expect(c.adjustments).toBeUndefined();
});

test('the approved record keeps original count, requested count, reason, submitter, approver and timestamps', () => {
  const c = counted();
  I.submitForApproval(c, 'staff-anna', '2026-11-16T09:00:00Z', 'Counted the main shelf');
  const ap = I.approveAdjustment(c, { role: 'owner', by: 'owner-stas', at: '2026-11-16T10:30:00Z' });
  expect(ap.ok).toBe(true);
  expect(ap.adjustments.find(a => a.sku === 'HE-HONEY-8OZ')).toMatchObject({
    originalCount: 40, requestedCount: 38, delta: -2, reason: 'Counted the main shelf',
    submittedBy: 'staff-anna', submittedAt: '2026-11-16T09:00:00Z', approvedBy: 'owner-stas', approvedAt: '2026-11-16T10:30:00Z', applied: false });
  expect(c).toMatchObject({ approvedBy: 'owner-stas', approvedAt: '2026-11-16T10:30:00Z' });
});

test('an administrator approves without the owner, also their own proposal (owner decision of Nov 24)', () => {
  const own = counted();
  I.submitForApproval(own, 'admin-2', '2026-11-16T09:00:00Z', 'Counted the main shelf');
  const self = I.approveAdjustment(own, { role: 'administrator', by: 'admin-2', at: '2026-11-16T10:00:00Z' });
  expect(self.ok).toBe(true);
  expect(self.adjustments[0].approvedBy).toBe('admin-2');
  const other = counted();
  I.submitForApproval(other, 'staff-anna', '2026-11-16T09:00:00Z', 'Counted the main shelf');
  const ap = I.approveAdjustment(other, { role: 'administrator', by: 'admin-2', at: '2026-11-16T10:00:00Z' });
  expect(ap.ok).toBe(true);
  expect(ap.adjustments[0].approvedBy).toBe('admin-2');
  expect(I.approveAdjustment(other, { role: 'owner', by: 'owner' }).duplicate).toBe(true);   // decided once
  // The owner may approve the owner's own proposal.
  const mine = counted();
  I.submitForApproval(mine, 'owner', '2026-11-16T09:00:00Z', 'Counted the main shelf');
  expect(I.approveAdjustment(mine, { role: 'owner', by: 'owner' }).ok).toBe(true);
});

test('the database draft enforces the same rule (names checked against drafts/34)', () => {
  const sql = require('fs').readFileSync(require('path').join(__dirname, '../../docs/ops/sql/drafts/34_DRAFT_stock_count_adjustments.sql'), 'utf8');
  for (const col of ['original_count', 'requested_count', 'reason', 'submitted_by', 'submitted_at', 'decided_by', 'decided_at']) expect(sql, col).toContain(col);
  expect(sql).toContain("Only the owner or an administrator can approve a stock-count adjustment.");
  expect(sql).toContain("public.active_role() in ('owner', 'administrator')");
  expect(sql).not.toMatch(/security\s+definer/i);
});
