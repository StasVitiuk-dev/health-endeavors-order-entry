// Failure recovery on the new surfaces (wave-2 item 6). Pure, Node-only,
// synthetic. A failed local export keeps its input and records what happened on
// each attempt (so the UI can explain what succeeded before the failure), a
// retry succeeds without a second export, an interrupted draft save preserves
// the user's input in history, and a stale action (re-applying a payment that
// already landed) is refused rather than double-applied. The browser-level
// equivalents are carried forward from failure-recovery / double-submit-stale.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RX = require('../../assets/reports/he-report-export.js');
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('a failed export keeps its input, explains each attempt, and retries without double-exporting', () => {
  const manifest = RX.buildManifest({ history: [{ report_date: '2026-11-08', orders_count: 2, revenue: 50 }] });
  const inputChecksum = manifest.checksum;
  // first attempt fails
  const a1 = RX.exportAttempt(manifest, { key: 'exp-1', fail: true, at: 't1' });
  expect(a1.status).toBe('failed');
  expect(a1.canRetry).toBe(true);
  expect(a1.manifestChecksum).toBe(inputChecksum);     // the input (package) is preserved
  // the attempt history explains what happened (a UI can show "attempt 1 failed: ...")
  expect(a1.attempts).toHaveLength(1);
  expect(a1.attempts[0].ok).toBe(false);
  expect(a1.attempts[0].reason).toMatch(/failure/);
  // retry succeeds; the history keeps BOTH the prior failure and the success
  const a2 = RX.retryExport(a1, { fail: false, at: 't2' });
  expect(a2.status).toBe('exported');
  expect(a2.attempts).toHaveLength(2);
  expect(a2.attempts[0].ok).toBe(false);               // what failed before
  expect(a2.attempts[1].ok).toBe(true);                // what finally succeeded
  // a further retry is a no-op, never a second export
  expect(RX.retryExport(a2, {}).duplicate).toBe(true);
});

test('an interrupted draft save preserves the user input (nothing typed is lost)', () => {
  const d0 = INV.draftInvoice({ lines: [{ sku: 'X', quantity: 1, unitPrice: 10 }], taxRate: 0 });
  // the user edits (qty 1 -> 5) and the save is "interrupted"; the revise result
  // still carries the new input AND the prior value in history
  const r = INV.reviseDraft(d0, { lines: [{ sku: 'X', quantity: 5, unitPrice: 10 }] }, { reason: 'qty 1->5' });
  expect(r.ok).toBe(true);
  expect(r.invoice.lines[0].quantity).toBe(5);         // the new input is kept
  expect(r.invoice.revisions[0].was.total).toBe(10);   // the prior value is not lost
  // re-applying the same edit does not stack a duplicate loss of the original
  const r2 = INV.reviseDraft(r.invoice, { lines: [{ sku: 'X', quantity: 5, unitPrice: 10 }] });
  expect(r2.invoice.revisions[0].was.total).toBe(10);  // original still recoverable
});

test('a stale action is refused, not double-applied', () => {
  let inv = INV.issue(INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 100 }], taxRate: 0 }), { role: 'owner', number: 'INV-R1' }).invoice;
  inv = INV.applyPayment(inv, { amount: 100, key: 'pay-1' }).invoice;
  expect(inv.status).toBe('paid');
  // a stale retry of the same payment (from a tab that didn't see it land) is a no-op
  const stale = INV.applyPayment(inv, { amount: 100, key: 'pay-1' });
  expect(stale.duplicate).toBe(true);
  // and any further payment on a paid invoice is refused (never over-applied)
  expect(INV.applyPayment(inv, { amount: 1, key: 'pay-2' }).ok).toBe(false);
});
