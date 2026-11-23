// Partial receiving and returns (decision D-ops-5, backlog INV-17): the stock
// rules of assets/inventory/he-receiving.js, revised to the owner's rules of
// Nov 22, on made-up stock. A PROTOTYPE for the owner's review; no real stock is
// written. The same rules in the database: drafts/40 and
// local-test/partial_receiving_test.sh.
const { test, expect } = require('@playwright/test');
const R = require('../../assets/inventory/he-receiving.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const SKU = 'SYN-HONEY-8OZ', OTHER = 'SYN-SHEA-4OZ';
const owner = { by: 'owner', role: 'owner' }, staff = { by: 'sam', role: 'employee' }, admin = { by: 'ari', role: 'administrator' };
function fresh(extra) {
  return R.createLedger({
    products: [{ sku: SKU, available: 5, damaged: 0 }, { sku: OTHER, available: 0, damaged: 0 }],
    purchaseOrders: [{ id: 'po', number: 'SYN-PO-020', lines: [{ sku: SKU, ordered: 20 }, { sku: OTHER, ordered: 4 }] },
      { id: 'po-private', number: 'SYN-PO-099', staffMaySee: false, lines: [{ sku: SKU, ordered: 10 }] }],
    sales: [{ id: 'so', number: 'SYN-1005', lines: [{ sku: SKU, sold: 5 }] }],
    ...(extra || {}),
  });
}
const K = (n) => 'key-' + n;
const START = { [SKU]: { available: 5, damaged: 0 } };
// submit as staff, approve as the owner
function receive(L, key, lines, poId) {
  const s = R.submitReceiving(L, { requestKey: key, poId: poId || 'po', lines: lines, ...staff });
  return s.ok ? R.approveReceiving(L, { recordId: s.id, ...owner }) : s;
}

test('the worked example: every step, the remaining quantity and the stock movement', () => {
  const w = R.workedExample();
  const cols = (s) => [s.poStatus, s.received, s.toCome, s.rejected, s.returnedToSupplier, s.awaitingInspection, s.waiting, s.available, s.damaged].join('/');
  const expected = [
    'OPEN/0/20/0/0/0/0/5/0',            // 0 start
    'OPEN/0/20/0/0/0/1/5/0',            // 1 staff submit 8: waiting, stock unchanged
    'OPEN/0/20/0/0/0/1/5/0',            // 2 same again
    'OPEN/0/20/0/0/0/1/5/0',            // 3 staff try to approve
    'PARTLY_RECEIVED/8/12/0/0/0/0/13/0',  // 4 owner approves
    'PARTLY_RECEIVED/8/12/0/0/0/1/13/0',  // 5 staff submit 9 good, 1 damaged, 2 rejected
    'PARTLY_RECEIVED/18/2/2/0/0/0/22/1',  // 6 approved: the 2 rejected are still to come
    'PARTLY_RECEIVED/18/2/2/0/0/0/22/1',  // 7 5 more good refused
    'PARTLY_RECEIVED/18/2/2/0/0/1/22/1',  // 8 2 good + 3 surplus submitted
    'RECEIVED/20/0/2/0/0/1/24/1',         // 9 approved: surplus waits
    'RECEIVED/20/0/2/0/0/0/27/1',         // 10 surplus kept
    'RECEIVED/20/0/2/0/0/1/27/1',         // 11 return 3, no replacement, submitted
    'RECEIVED/20/0/2/3/0/0/24/1',         // 12 approved: the order stays complete
    'RECEIVED/20/0/2/3/0/1/24/1',         // 13 return 1 damaged, replacement expected
    'PARTLY_RECEIVED/19/1/2/4/0/0/24/0',  // 14 approved: 1 to come again
    'PARTLY_RECEIVED/19/1/2/4/0/1/24/0',  // 15 18 more asked
    'PARTLY_RECEIVED/19/1/2/4/0/1/24/0',  // 16 approval refused
    'PARTLY_RECEIVED/19/1/2/4/0/0/24/0',  // 17 rejected
    'PARTLY_RECEIVED/19/1/2/4/3/1/24/0',  // 18 customer returns 3: awaiting inspection
    'PARTLY_RECEIVED/19/1/2/4/3/1/24/0',  // 19 same again
    'PARTLY_RECEIVED/19/1/2/4/0/0/26/1',  // 20 inspected: 2 restocked, 1 damaged
    'PARTLY_RECEIVED/19/1/2/4/2/1/26/1',  // 21 the other 2, opened and used
    'PARTLY_RECEIVED/19/1/2/4/2/1/26/1',  // 22 restocking them refused
    'PARTLY_RECEIVED/19/1/2/4/0/0/26/3',  // 23 unsuitable: to Damaged
    'PARTLY_RECEIVED/19/1/2/4/0/0/26/3',  // 24 1 more refused
    'PARTLY_RECEIVED/19/1/2/4/0/0/23/3',  // 25 correction of the kept surplus
    'PARTLY_RECEIVED/19/1/2/4/0/0/23/3',  // 26 a second correction refused
  ];
  expect(w.steps.map(cols)).toEqual(expected);
  const s = w.steps;
  expect(s[1].movements).toEqual([]);                                   // staff submission: no stock change
  expect(s[2].duplicate).toBe(true);
  expect(s[3].reason).toMatch(/only the owner approves stock changes/);
  expect(s[4].movements).toEqual([{ bucket: 'available', change: 8, before: 5, after: 13 }]);
  expect(s[6].movements).toEqual([{ bucket: 'available', change: 9, before: 13, after: 22 }, { bucket: 'damaged', change: 1, before: 0, after: 1 }]);
  expect(s[7].reason).toMatch(/only 2 of SYN-HONEY-8OZ are still to come .* enter the rest as surplus/);
  expect(s[9].movements).toEqual([{ bucket: 'available', change: 2, before: 22, after: 24 }]);   // surplus not in stock yet
  expect(s[10].movements).toEqual([{ bucket: 'available', change: 3, before: 24, after: 27 }]);
  expect(s[14].movements).toEqual([{ bucket: 'damaged', change: -1, before: 1, after: 0 }]);
  expect(s[16].reason).toMatch(/only 16 of SYN-HONEY-8OZ received on SYN-PO-020 can still go back/);
  expect(s[18].movements).toEqual([]);                                  // awaiting inspection: not for sale
  expect(s[20].movements).toEqual([{ bucket: 'available', change: 2, before: 24, after: 26 }, { bucket: 'damaged', change: 1, before: 0, after: 1 }]);
  expect(s[22].reason).toMatch(/opened or used skincare cannot be restocked/);
  expect(s[23].movements).toEqual([{ bucket: 'damaged', change: 2, before: 1, after: 3 }]);
  expect(s[24].reason).toMatch(/only 0 of the 5 sold/);
  expect(s[25].movements).toEqual([{ bucket: 'available', change: -3, before: 26, after: 23 }]);
  expect(s[26].reason).toMatch(/already corrected/);
  expect(w.refusals).toHaveLength(6);
  expect(w.movements).toHaveLength(11);
  expect(w.history).toHaveLength(18);
  expect(w.waiting).toBe(0);
  expect(w.corrections).toHaveLength(1);
  expect(w.reconcile).toEqual({ ok: true, problems: [] });
});

test('rule 5: staff submit for purchase orders they may see; stock changes only on the owner\'s approval', () => {
  const L = fresh();
  const sub = R.submitReceiving(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 8 }], ...staff });
  expect(sub.ok).toBe(true);
  expect(R.stock(L, SKU)).toEqual({ sku: SKU, available: 5, damaged: 0 });
  expect(R.poStatus(L, 'po').lines[0].received).toBe(0);
  expect(R.waiting(L).receiving).toHaveLength(1);
  // a purchase order staff may not see: refused, with the hand-off
  expect(R.submitReceiving(L, { requestKey: K(2), poId: 'po-private', lines: [{ sku: SKU, good: 1 }], ...staff }).reason).toMatch(/only for purchase orders you are allowed to see; hand it to the owner/);
  // an administrator may submit, but neither staff nor an administrator approves
  const adm = R.submitReceiving(L, { requestKey: K(3), poId: 'po-private', lines: [{ sku: SKU, good: 1 }], ...admin });
  expect(adm.ok).toBe(true);
  for (const who of [staff, admin, { by: 'v', role: 'viewer' }, { by: 'x' }]) {
    expect(R.approveReceiving(L, { recordId: sub.id, ...who }).reason).toMatch(/only the owner approves/);
  }
  expect(R.submitReceiving(L, { requestKey: K(4), poId: 'po', lines: [{ sku: SKU, good: 1 }], by: 'v', role: 'viewer' }).reason).toMatch(/only staff, an administrator or the owner/);
  expect(R.stock(L, SKU).available).toBe(5);
  // the owner approves: now, and only now, stock moves; who asked and who approved are both kept
  const ap = R.approveReceiving(L, { recordId: sub.id, ...owner });
  expect(ap.movements.map(m => [m.bucket, m.change, m.requestedBy, m.approvedBy])).toEqual([['available', 8, 'sam', 'owner']]);
  // approved ten times: one movement
  for (let i = 0; i < 10; i++) expect(R.approveReceiving(L, { recordId: sub.id, ...owner }).duplicate).toBe(true);
  expect(L.movements).toHaveLength(1);
  // reject needs a reason; cancel by the submitter or the owner only
  expect(R.rejectReceiving(L, { recordId: adm.id, ...owner }).reason).toMatch(/say why/);
  expect(R.cancelReceiving(L, { recordId: adm.id, ...staff }).reason).toMatch(/only the person who submitted it, or the owner/);
  expect(R.cancelReceiving(L, { recordId: adm.id, ...admin }).ok).toBe(true);
  expect(R.approveReceiving(L, { recordId: adm.id, ...owner }).reason).toMatch(/already cancelled/);
});

test('approvals re-check what is still to come: two records for 7 on 10 outstanding cannot both be approved', () => {
  const L = R.createLedger({ products: [{ sku: SKU }], purchaseOrders: [{ id: 'p', number: 'P', lines: [{ sku: SKU, ordered: 10 }] }] });
  const a = R.submitReceiving(L, { requestKey: K('a'), poId: 'p', lines: [{ sku: SKU, good: 7 }], ...staff });
  const b = R.submitReceiving(L, { requestKey: K('b'), poId: 'p', lines: [{ sku: SKU, good: 7 }], by: 'kim', role: 'employee' });
  expect(a.ok && b.ok).toBe(true);
  expect(R.approveReceiving(L, { recordId: a.id, ...owner }).ok).toBe(true);
  expect(R.approveReceiving(L, { recordId: b.id, ...owner }).reason).toMatch(/only 3 of SYN-HONEY-8OZ are still to come now; nothing was approved/);
  expect(R.poStatus(L, 'p').lines[0]).toMatchObject({ received: 7, toCome: 3 });
  expect(R.stock(L, SKU).available).toBe(7);
});

test('rules 1 and 2: surplus is logged for the owner, and rejected units stay outstanding', () => {
  const L = fresh();
  // surplus before the line is complete is refused; good beyond what is to come is refused
  expect(R.submitReceiving(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 5, surplus: 1 }], ...staff }).reason).toMatch(/surplus is what arrived beyond the 20 still to come/);
  expect(R.submitReceiving(L, { requestKey: K(2), poId: 'po', lines: [{ sku: SKU, good: 21 }], ...staff }).reason).toMatch(/only 20 .* enter the rest as surplus/);
  // rejected without a reason is refused
  expect(R.submitReceiving(L, { requestKey: K(3), poId: 'po', lines: [{ sku: SKU, good: 15, rejected: 5 }], ...staff }).reason).toMatch(/say why the 5 units/);
  receive(L, K(4), [{ sku: SKU, good: 15, rejected: 5, rejectReason: 'Crushed boxes' }]);
  expect(R.poStatus(L, 'po').lines[0]).toMatchObject({ received: 15, rejected: 5, toCome: 5 });
  expect(R.stock(L, SKU).available).toBe(20);
  // the replacements arrive with 2 extra: received 5, 2 wait for the owner, not in stock
  receive(L, K(5), [{ sku: SKU, good: 5, surplus: 2 }]);
  expect(R.stock(L, SKU).available).toBe(25);
  const w = R.waiting(L);
  expect(w.surplus).toHaveLength(1); expect(w.surplus[0]).toMatchObject({ sku: SKU, quantity: 2, status: 'waiting' });
  expect(R.decideSurplus(L, { surplusId: w.surplus[0].id, decision: 'kept', ...staff }).reason).toMatch(/only the owner decides on surplus/);
  expect(R.decideSurplus(L, { surplusId: w.surplus[0].id, decision: 'maybe', ...owner }).reason).toMatch(/kept or returned/);
  // returned: no stock change; kept: Available
  expect(R.decideSurplus(L, { surplusId: w.surplus[0].id, decision: 'returned', ...owner }).movements).toEqual([]);
  expect(R.decideSurplus(L, { surplusId: w.surplus[0].id, decision: 'kept', ...owner }).reason).toMatch(/already returned/);
  expect(R.stock(L, SKU).available).toBe(25);
  // a receipt is all or nothing across its lines
  const mixed = R.submitReceiving(L, { requestKey: K(6), poId: 'po', lines: [{ sku: OTHER, good: 2 }, { sku: OTHER + 'X', good: 1 }], ...staff });
  expect(mixed.ok).toBe(false); expect(R.waiting(L).receiving).toHaveLength(0);
  expect(R.submitReceiving(L, { requestKey: K(7), poId: 'po', lines: [{ sku: OTHER, good: 1 }, { sku: OTHER, good: 1 }], ...staff }).reason).toMatch(/listed twice/);
  expect(R.reconcile(L, START).ok).toBe(true);
});

test('rule 3: damaged goods we keep go to Damaged and count as received', () => {
  const L = fresh();
  const ap = receive(L, K(1), [{ sku: SKU, good: 6, damaged: 2 }]);
  expect(ap.movements.map(m => [m.bucket, m.change])).toEqual([['available', 6], ['damaged', 2]]);
  expect(R.stock(L, SKU)).toEqual({ sku: SKU, available: 11, damaged: 2 });
  expect(R.poStatus(L, 'po').lines[0]).toMatchObject({ received: 8, damagedKept: 2, toCome: 12 });
});

test('rule 4: a supplier return reopens the outstanding quantity only when a replacement is expected', () => {
  const L = fresh();
  receive(L, K(1), [{ sku: SKU, good: 18, damaged: 2 }]);
  const ret = (key, qty, from, repl) => {
    const s = R.submitSupplierReturn(L, { requestKey: key, poId: 'po', sku: SKU, quantity: qty, from: from, reason: 'Wrong scent', replacementExpected: repl, ...staff });
    return s.ok ? R.decideSupplierReturn(L, { returnId: s.id, decision: 'approved', ...owner }) : s;
  };
  expect(ret(K(2), 3, 'available', false).ok).toBe(true);
  expect(R.poStatus(L, 'po').lines[0]).toMatchObject({ received: 20, toCome: 0, returnedToSupplier: 3 });
  expect(R.poStatus(L, 'po').lines[0].toCome).toBe(0);
  expect(ret(K(3), 2, 'damaged', true).ok).toBe(true);
  expect(R.poStatus(L, 'po').lines[0]).toMatchObject({ received: 18, toCome: 2, returnedToSupplier: 5, replacementsExpected: 2 });
  expect(R.stock(L, SKU)).toEqual({ sku: SKU, available: 20, damaged: 0 });
  // over the limit: received and kept, and what the bucket holds
  expect(ret(K(4), 16, 'available', false).reason).toMatch(/only 15 of SYN-HONEY-8OZ received on SYN-PO-020 can still go back/);
  expect(ret(K(5), 1, 'damaged', false).reason).toMatch(/only 0 of SYN-HONEY-8OZ are in Damaged stock/);
  // the replacements can now be received against the same order
  expect(receive(L, K(6), [{ sku: SKU, good: 2 }]).ok).toBe(true);
  expect(R.poStatus(L, 'po').lines[0]).toMatchObject({ received: 20, toCome: 0 });
  // submissions need a reason and a bucket; only the owner decides
  expect(R.submitSupplierReturn(L, { requestKey: K(7), poId: 'po', sku: SKU, quantity: 1, from: 'shelf', reason: 'Wrong scent', ...staff }).reason).toMatch(/Available or Damaged/);
  expect(R.submitSupplierReturn(L, { requestKey: K(8), poId: 'po', sku: SKU, quantity: 1, reason: 'no', ...staff }).reason).toMatch(/say why/);
  const s = R.submitSupplierReturn(L, { requestKey: K(9), poId: 'po', sku: SKU, quantity: 1, reason: 'Wrong scent', ...staff });
  expect(R.decideSupplierReturn(L, { returnId: s.id, decision: 'approved', ...admin }).reason).toMatch(/only the owner/);
  expect(R.reconcile(L, START).ok).toBe(true);
});

test('rule 6: customer returns wait for inspection; opened or used skincare is never restocked', () => {
  const L = fresh();
  const rec = R.recordCustomerReturn(L, { requestKey: K(1), saleId: 'so', sku: SKU, quantity: 3, reason: 'Scent', ...staff });
  expect(rec.ok).toBe(true); expect(rec.movements).toEqual([]);
  expect(R.stock(L, SKU).available).toBe(5);                            // not available for resale
  expect(R.saleStatus(L, 'so').lines[0]).toMatchObject({ awaitingInspection: 3, stillReturnable: 2 });
  const d = (x) => R.decideCustomerReturn(L, { inspectionId: rec.id, ...owner, ...x });
  expect(d({ restock: 3, ...staff }).reason).toMatch(/only the owner decides/);
  expect(d({ restock: 3 }).reason).toMatch(/whether the product was opened/);
  expect(d({ restock: 1, unsuitable: 2, opened: true, used: false }).reason).toMatch(/opened or used skincare cannot be restocked/);
  expect(d({ restock: 1, unsuitable: 0, opened: false, used: true }).reason).toMatch(/cannot be restocked/);
  expect(d({ restock: 1, damaged: 1, opened: false, used: false }).reason).toMatch(/every returned unit needs an outcome: 3 units came back/);
  expect(d({ restock: 1.5, damaged: 1.5, opened: false, used: false }).reason).toMatch(/whole units/);
  const ok = d({ restock: 1, damaged: 1, unsuitable: 1, opened: false, used: false });
  expect(ok.movements.map(m => [m.bucket, m.change])).toEqual([['available', 1], ['damaged', 2]]);
  expect(d({ restock: 0, unsuitable: 3, opened: true, used: true }).duplicate).toBe(true);
  expect(R.saleStatus(L, 'so').lines[0]).toMatchObject({ awaitingInspection: 0, restocked: 1, damaged: 1, unsuitable: 1, stillReturnable: 2 });
  // over-returning, and a retry
  expect(R.recordCustomerReturn(L, { requestKey: K(2), saleId: 'so', sku: SKU, quantity: 3, reason: 'Scent', ...staff }).reason).toMatch(/only 2 of the 5 sold/);
  const again = { requestKey: K(3), saleId: 'so', sku: SKU, quantity: 2, reason: 'Opened', ...staff };
  expect(R.recordCustomerReturn(L, again).ok).toBe(true);
  expect(R.recordCustomerReturn(L, again).duplicate).toBe(true);
  expect(R.saleStatus(L, 'so').lines[0].stillReturnable).toBe(0);
  expect(R.reconcile(L, START).ok).toBe(true);
});

test('rule 7: a correction is a linked reversing movement with a reason and approver, once', () => {
  const L = fresh();
  receive(L, K(1), [{ sku: SKU, good: 8 }]);
  const m = L.movements[0];
  expect(R.correctMovement(L, { requestKey: K(2), movementN: m.n, reason: 'Counted twice', ...admin }).reason).toMatch(/only the owner can correct/);
  expect(R.correctMovement(L, { requestKey: K(3), movementN: m.n, reason: 'no', ...owner }).reason).toMatch(/say why/);
  expect(R.correctMovement(L, { requestKey: K(4), movementN: 99, reason: 'Counted twice', ...owner }).reason).toMatch(/no such stock movement/);
  const c = R.correctMovement(L, { requestKey: K(5), movementN: m.n, reason: 'Counted twice', at: '2026-11-22T10:00:00Z', ...owner });
  expect(c.movements).toEqual([expect.objectContaining({ bucket: 'available', change: -8, before: 13, after: 5, corrects: m.n, approvedBy: 'owner' })]);
  expect(c.movements[0].why).toBe('correction of movement 1: Counted twice');
  // the original stays as it was; the delivery is outstanding again
  expect(L.movements[0]).toMatchObject({ change: 8, before: 5, after: 13 });
  expect(R.poStatus(L, 'po').lines[0]).toMatchObject({ received: 0, toCome: 20 });
  expect(L.corrections).toEqual([expect.objectContaining({ movementN: 1, reason: 'Counted twice', by: 'owner' })]);
  // once only; a correction is not corrected again; the same request again changes nothing
  expect(R.correctMovement(L, { requestKey: K(6), movementN: m.n, reason: 'Counted twice', ...owner }).reason).toMatch(/already corrected/);
  expect(R.correctMovement(L, { requestKey: K(7), movementN: 2, reason: 'Undo the undo', ...owner }).reason).toMatch(/a correction is not corrected again/);
  expect(R.correctMovement(L, { requestKey: K(5), movementN: m.n, reason: 'Counted twice', ...owner }).duplicate).toBe(true);
  // never below zero
  const L2 = fresh();
  receive(L2, K(1), [{ sku: SKU, good: 8 }]);
  const s = R.submitSupplierReturn(L2, { requestKey: K(2), poId: 'po', sku: SKU, quantity: 8, reason: 'Whole lot wrong', ...staff });
  R.decideSupplierReturn(L2, { returnId: s.id, decision: 'approved', ...owner });
  expect(R.stock(L2, SKU).available).toBe(5);
  // 13 - 8 = 5 available; reversing the +8 receipt would leave -3
  expect(R.correctMovement(L2, { requestKey: K(3), movementN: 1, reason: 'Counted twice', ...owner }).reason).toMatch(/would go below zero/);
  expect(R.reconcile(L, START).ok).toBe(true); expect(R.reconcile(L2, START).ok).toBe(true);
});

test('duplicate submissions: the same key again changes nothing; the same key with other contents is refused', () => {
  const L = fresh();
  const one = { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 8 }], ...staff };
  const first = R.submitReceiving(L, one);
  for (let i = 0; i < 5; i++) expect(R.submitReceiving(L, one)).toMatchObject({ ok: true, duplicate: true, id: first.id });
  expect(R.waiting(L).receiving).toHaveLength(1);
  expect(R.submitReceiving(L, { ...one, lines: [{ sku: SKU, good: 9 }] }).reason).toMatch(/already used for a different submission/);
  expect(R.submitReceiving(L, { poId: 'po', lines: [{ sku: SKU, good: 1 }], ...staff }).reason).toMatch(/no request key/);
  expect(L.history).toHaveLength(1);
});

test('the history: who, when, what; movements keep who asked and who approved', () => {
  const L = fresh();
  const s = R.submitReceiving(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 7, damaged: 1 }], by: 'sam', role: 'employee', at: '2026-11-22T10:00:00Z', note: 'first pallet' });
  R.approveReceiving(L, { recordId: s.id, by: 'owner', role: 'owner', at: '2026-11-22T11:00:00Z' });
  expect(L.history[0]).toMatchObject({ n: 1, kind: 'submitReceiving', by: 'sam', at: '2026-11-22T10:00:00Z', note: 'first pallet' });
  expect(L.history[0].what).toMatch(/SYN-HONEY-8OZ: 7 good, 1 damaged, kept \(waiting for the owner; no stock changed\)/);
  expect(L.history[1]).toMatchObject({ n: 2, kind: 'approveReceiving', by: 'owner', at: '2026-11-22T11:00:00Z' });
  expect(L.movements.map(m => [m.bucket, m.before, m.change, m.after, m.requestedBy, m.approvedBy, m.source.poId, m.source.kind]))
    .toEqual([['available', 5, 7, 12, 'sam', 'owner', 'po', 'receipt'], ['damaged', 0, 1, 1, 'sam', 'owner', 'po', 'receipt']]);
});

test('bad input is refused with a reason, never thrown, and changes nothing', () => {
  const L = fresh();
  const bad = [null, undefined, 1, 'x', [], {}, { requestKey: K(1) }, { requestKey: K(2), poId: 'po', ...owner },
    { requestKey: K(3), poId: 'po', lines: 'x', ...owner }, { requestKey: K(4), poId: 'po', lines: [null, 3], ...owner },
    { requestKey: K(5), poId: 'po', lines: [{ sku: SKU, good: 2.5 }], ...owner }, { requestKey: K(6), poId: 'po', lines: [{ sku: SKU, good: -3 }], ...owner },
    { requestKey: K(7), poId: 'po', lines: [{ sku: SKU, good: '8' }], ...owner }, { requestKey: K(8), poId: 'po', lines: [{ sku: SKU, good: 1e9 }], ...owner },
    { requestKey: K(9), poId: 'po', lines: [{ sku: SKU, good: NaN }], ...owner }, { requestKey: K(10), poId: 'nope', lines: [{ sku: SKU, good: 1 }], ...owner },
    { requestKey: K(11), recordId: 'nope', surplusId: 'nope', returnId: 'nope', inspectionId: 'nope', movementN: 'x', ...owner }];
  const fns = [R.submitReceiving, R.approveReceiving, R.rejectReceiving, R.cancelReceiving, R.decideSurplus, R.submitSupplierReturn,
    R.decideSupplierReturn, R.recordCustomerReturn, R.decideCustomerReturn, R.correctMovement];
  for (const b of bad) {
    for (const fn of fns) {
      let res; expect(() => { res = fn(L, b); }).not.toThrow();
      expect(res.ok).toBe(false); expect(typeof res.reason).toBe('string');
    }
  }
  for (const fn of fns) { expect(fn(null, {}).ok).toBe(false); expect(fn(undefined).ok).toBe(false); }
  expect(R.createLedger('junk').products).toEqual({});
  expect(R.waiting(null).total).toBe(0);
  expect(R.stock(L, SKU)).toEqual({ sku: SKU, available: 5, damaged: 0 });
  expect(L.movements).toHaveLength(0); expect(L.history).toHaveLength(0);
});

test('nothing in the prototype reaches the database or real stock', () => {
  const src = require('fs').readFileSync(require.resolve('../../assets/inventory/he-receiving.js'), 'utf8');
  expect(src).not.toMatch(/supabase|fetch\(|XMLHttpRequest|localStorage|\.rpc\(|\.from\(/);
  expect(R.workedExample().label).toBe('SIMULATED');
});
