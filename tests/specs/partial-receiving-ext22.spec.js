// Partial receiving and returns (owner request of Nov 21, decision D-ops-5,
// backlog INV-17): the stock rules of assets/inventory/he-receiving.js, on
// made-up stock. A PROTOTYPE for the owner's review; no real stock is written.
const { test, expect } = require('@playwright/test');
const R = require('../../assets/inventory/he-receiving.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const SKU = 'SYN-HONEY-8OZ', OTHER = 'SYN-SHEA-4OZ';
const owner = { by: 'owner', role: 'owner' };
function fresh() {
  return R.createLedger({
    products: [{ sku: SKU, available: 5, damaged: 0 }, { sku: OTHER, available: 0, damaged: 0 }],
    purchaseOrders: [{ id: 'po', number: 'SYN-PO-020', lines: [{ sku: SKU, ordered: 20 }, { sku: OTHER, ordered: 4 }] }],
    sales: [{ id: 'so', number: 'SYN-1005', lines: [{ sku: SKU, sold: 5 }] }],
  });
}
const K = (n) => 'key-' + n;

test('the worked example: 20 ordered, 8 then 12 received, 3 back to the supplier, a customer returns 2 sellable + 1 damaged', () => {
  const w = R.workedExample();
  const row = (n) => w.steps[n];
  const cols = (s) => [s.poStatus, s.received, s.toCome, s.returnedToSupplier, s.kept, s.available, s.damaged, s.stillReturnable].join('/');
  expect(cols(row(0))).toBe('OPEN/0/20/0/0/5/0/5');
  expect(cols(row(1))).toBe('PARTLY_RECEIVED/8/12/0/8/13/0/5');        // first delivery: 8
  expect(row(1).movements).toEqual([{ bucket: 'available', change: 8, before: 5, after: 13 }]);
  expect(row(2).duplicate).toBe(true); expect(cols(row(2))).toBe(cols(row(1)));   // sent again: nothing changes
  expect(row(3).ok).toBe(false); expect(row(3).reason).toMatch(/only 12 of the 20 ordered are still to come/); expect(cols(row(3))).toBe(cols(row(1)));
  expect(cols(row(4))).toBe('RECEIVED/20/0/0/20/25/0/5');              // second delivery: 12
  expect(cols(row(5))).toBe('RECEIVED/20/0/3/17/22/0/5');              // 3 back to the supplier
  expect(row(5).movements).toEqual([{ bucket: 'available', change: -3, before: 25, after: 22 }]);
  expect(row(6).ok).toBe(false); expect(row(6).reason).toMatch(/only 17 received/);
  expect(row(7).ok).toBe(false); expect(row(7).reason).toMatch(/only the owner or an administrator/);
  expect(cols(row(8))).toBe('RECEIVED/20/0/3/17/24/1/2');              // customer: 2 sellable, 1 damaged
  expect(row(8).movements).toEqual([{ bucket: 'available', change: 2, before: 22, after: 24 }, { bucket: 'damaged', change: 1, before: 0, after: 1 }]);
  expect(row(9).duplicate).toBe(true); expect(cols(row(9))).toBe(cols(row(8)));
  expect(row(10).ok).toBe(false); expect(row(10).reason).toMatch(/only 2 of the 5 sold/);
  // the history holds exactly the four changes; the four refusals are recorded apart, with their reasons
  expect(w.history.map(h => h.kind)).toEqual(['receive', 'receive', 'returnToSupplier', 'customerReturn']);
  expect(w.refusals).toHaveLength(4);
  expect(w.movements).toHaveLength(5);
  expect(w.reconcile).toEqual({ ok: true, problems: [] });
});

test('duplicate submissions: the same key again changes nothing; the same key with other contents is refused', () => {
  const L = fresh();
  const first = R.receive(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 8 }], ...owner });
  expect(first.ok).toBe(true);
  for (let i = 0; i < 5; i++) expect(R.receive(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 8 }], ...owner }).duplicate).toBe(true);
  expect(R.stock(L, SKU).available).toBe(13);
  const other = R.receive(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 9 }], ...owner });
  expect(other.ok).toBe(false); expect(other.reason).toMatch(/already used for a different submission/);
  expect(R.stock(L, SKU).available).toBe(13);
  expect(L.history).toHaveLength(1);
  // no key at all: refused, because a retry could not be recognised
  expect(R.receive(L, { poId: 'po', lines: [{ sku: SKU, good: 1 }], ...owner }).reason).toMatch(/no request key/);
  // a customer-return retry after a lost reply records once
  const cr = { requestKey: K(2), saleId: 'so', sku: SKU, sellable: 1, damaged: 1, reason: 'scent', ...owner };
  expect(R.customerReturn(L, cr).ok).toBe(true);
  expect(R.customerReturn(L, cr).duplicate).toBe(true);
  expect(R.saleStatus(L, 'so').lines[0].stillReturnable).toBe(3);
});

test('over-receiving is refused, and a receipt is all or nothing across its lines', () => {
  const L = fresh();
  expect(R.receive(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 21 }], ...owner }).reason).toMatch(/only 20 of the 20 ordered/);
  // one good line and one over-receiving line: nothing at all is received
  const mixed = R.receive(L, { requestKey: K(2), poId: 'po', lines: [{ sku: SKU, good: 8 }, { sku: OTHER, good: 5 }], ...owner });
  expect(mixed.ok).toBe(false); expect(mixed.reason).toMatch(/only 4 of the 4 ordered/);
  expect(R.stock(L, SKU).available).toBe(5); expect(R.poStatus(L, 'po').lines.map(l => l.received)).toEqual([0, 0]);
  expect(L.movements).toHaveLength(0);
  // received in two parts, then one more is refused
  expect(R.receive(L, { requestKey: K(3), poId: 'po', lines: [{ sku: SKU, good: 15, damaged: 5 }], ...owner }).ok).toBe(true);
  expect(R.receive(L, { requestKey: K(4), poId: 'po', lines: [{ sku: SKU, good: 1 }], ...owner }).reason).toMatch(/only 0 of the 20/);
  // damaged on arrival counts as received and goes to Damaged
  expect(R.stock(L, SKU)).toEqual({ sku: SKU, available: 20, damaged: 5 });
  expect(R.poStatus(L, 'po').lines[0]).toMatchObject({ received: 20, damagedOnArrival: 5, toCome: 0 });
  expect(R.poStatus(L, 'po').status).toBe('PARTLY_RECEIVED');          // the shea line is still open
  // a line not on the order, and the same product twice in one receipt
  expect(R.receive(L, { requestKey: K(5), poId: 'po', lines: [{ sku: 'NOPE', good: 1 }], ...owner }).reason).toMatch(/not on SYN-PO-020/);
  expect(R.receive(L, { requestKey: K(6), poId: 'po', lines: [{ sku: OTHER, good: 1 }, { sku: OTHER, good: 1 }], ...owner }).reason).toMatch(/listed twice/);
});

test('over-returning is refused: to the supplier (received and kept, and what the bucket holds) and from a customer', () => {
  const L = fresh();
  R.receive(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 6, damaged: 2 }], ...owner });
  expect(R.returnToSupplier(L, { requestKey: K(2), poId: 'po', sku: SKU, quantity: 9, from: 'available', reason: 'wrong scent', ...owner }).reason).toMatch(/only 8 received/);
  expect(R.returnToSupplier(L, { requestKey: K(3), poId: 'po', sku: SKU, quantity: 3, from: 'damaged', reason: 'cracked jars', ...owner }).reason).toMatch(/only 2 of SYN-HONEY-8OZ are in Damaged/);
  expect(R.returnToSupplier(L, { requestKey: K(4), poId: 'po', sku: SKU, quantity: 2, from: 'damaged', reason: 'cracked jars', ...owner }).ok).toBe(true);
  expect(R.returnToSupplier(L, { requestKey: K(5), poId: 'po', sku: SKU, quantity: 1, from: 'available', reason: 'no', ...owner }).reason).toMatch(/say why/);
  expect(R.poStatus(L, 'po').lines[0]).toMatchObject({ received: 8, returnedToSupplier: 2, kept: 6, toCome: 12 });   // a return does not reopen the line
  // customer side
  expect(R.customerReturn(L, { requestKey: K(6), saleId: 'so', sku: SKU, sellable: 4, damaged: 2, reason: 'scent', ...owner }).reason).toMatch(/only 5 of the 5 sold/);
  expect(R.customerReturn(L, { requestKey: K(7), saleId: 'so', sku: SKU, sellable: 0, damaged: 0, reason: 'scent', ...owner }).reason).toMatch(/at least one unit/);
  expect(R.customerReturn(L, { requestKey: K(8), saleId: 'so', sku: SKU, sellable: 3, damaged: 2, reason: 'scent', ...owner }).ok).toBe(true);
  expect(R.customerReturn(L, { requestKey: K(9), saleId: 'so', sku: SKU, sellable: 1, reason: 'scent', ...owner }).reason).toMatch(/only 0 of the 5 sold/);
  expect(R.reconcile(L, { [SKU]: { available: 5, damaged: 0 } }).ok).toBe(true);
});

test('only the owner or an administrator changes stock; refusals are recorded and change nothing', () => {
  const L = fresh();
  for (const role of ['employee', 'viewer', '', undefined]) {
    expect(R.receive(L, { requestKey: K('r' + role), poId: 'po', lines: [{ sku: SKU, good: 1 }], by: 'x', role }).reason).toMatch(/only the owner or an administrator/);
  }
  expect(R.receive(L, { requestKey: K('admin'), poId: 'po', lines: [{ sku: SKU, good: 1 }], by: 'admin', role: 'administrator' }).ok).toBe(true);
  expect(L.refusals).toHaveLength(4);
  expect(L.refusals.every(r => /only the owner/.test(r.reason))).toBe(true);
  expect(R.stock(L, SKU).available).toBe(6);
});

test('the history: who, when, what, and one movement per bucket with before and after', () => {
  const L = fresh();
  R.receive(L, { requestKey: K(1), poId: 'po', lines: [{ sku: SKU, good: 7, damaged: 1 }], by: 'owner', role: 'owner', at: '2026-11-21T10:00:00Z', note: 'first pallet' });
  expect(L.history[0]).toMatchObject({ n: 1, kind: 'receive', by: 'owner', at: '2026-11-21T10:00:00Z', note: 'first pallet' });
  expect(L.history[0].what).toBe('SYN-HONEY-8OZ: 8 (1 damaged) received on SYN-PO-020');
  expect(L.movements.map(m => [m.bucket, m.before, m.change, m.after, m.by, m.source.poId])).toEqual([['available', 5, 7, 12, 'owner', 'po'], ['damaged', 0, 1, 1, 'owner', 'po']]);
});

test('bad input is refused with a reason, never thrown, and changes nothing', () => {
  const L = fresh();
  const bad = [null, undefined, 1, 'x', [], {}, { requestKey: K(1) }, { requestKey: K(2), poId: 'po', ...owner },
    { requestKey: K(3), poId: 'po', lines: 'x', ...owner }, { requestKey: K(4), poId: 'po', lines: [null, 3], ...owner },
    { requestKey: K(5), poId: 'po', lines: [{ sku: SKU, good: 2.5 }], ...owner }, { requestKey: K(6), poId: 'po', lines: [{ sku: SKU, good: -3 }], ...owner },
    { requestKey: K(7), poId: 'po', lines: [{ sku: SKU, good: '8' }], ...owner }, { requestKey: K(8), poId: 'po', lines: [{ sku: SKU, good: 1e9 }], ...owner },
    { requestKey: K(9), poId: 'po', lines: [{ sku: SKU, good: NaN }], ...owner }, { requestKey: K(10), poId: 'nope', lines: [{ sku: SKU, good: 1 }], ...owner }];
  for (const b of bad) {
    for (const fn of [R.receive, R.returnToSupplier, R.customerReturn]) {
      let res; expect(() => { res = fn(L, b); }).not.toThrow();
      expect(res.ok).toBe(false); expect(typeof res.reason).toBe('string');
    }
  }
  for (const fn of [R.receive, R.returnToSupplier, R.customerReturn]) { expect(fn(null, {}).ok).toBe(false); expect(fn(undefined).ok).toBe(false); }
  expect(R.createLedger('junk').products).toEqual({});
  expect(R.stock(L, SKU)).toEqual({ sku: SKU, available: 5, damaged: 0 });
  expect(L.movements).toHaveLength(0); expect(L.history).toHaveLength(0);
});

test('nothing in the prototype reaches the database or real stock', () => {
  const src = require('fs').readFileSync(require.resolve('../../assets/inventory/he-receiving.js'), 'utf8');
  expect(src).not.toMatch(/supabase|fetch\(|XMLHttpRequest|localStorage|\.rpc\(|\.from\(/);
  expect(R.workedExample().label).toBe('SIMULATED');
});
