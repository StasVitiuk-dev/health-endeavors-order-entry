// A manager (drafts/62, owner decision of Nov 24) can do everything an employee
// can on the dashboard, and nothing an employee cannot: record deliveries and
// returns, record supplier documents, prepare invoice drafts. Approving stays
// with the owner or an administrator (whether managers should approve deliveries
// or supplier documents is OWNER DECISION REQUIRED; until then they cannot).
// The stores are checked in Node with a made-up database client; every value is
// made up.
const { test, expect } = require('@playwright/test');
const R = require('../../assets/inventory/he-receiving.js');
const RS = require('../../assets/inventory/he-receiving-store.js');
const SD = require('../../assets/suppliers/he-supplier-docs-store.js');
const INV = require('../../assets/invoice/he-invoice-store.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const ID = '00000000-0000-4000-8000-0000000000aa';
// A made-up client that records which database calls were asked for and answers yes.
function client(calls) {
  const q = { select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; }, limit() { return q; }, is() { return q; },
    then(res) { return Promise.resolve({ data: [], error: null }).then(res); } };
  return { from() { return q; }, rpc(name, args) { calls.push(name); return Promise.resolve({ data: { ok: true, id: ID, status: 'received' }, error: null }); },
    storage: { from() { return {}; } } };
}

test('the rules prototype: a manager submits like an employee, and cannot approve', () => {
  const L = R.createLedger({ products: [{ sku: 'SYN-A', available: 5, damaged: 0 }],
    purchaseOrders: [{ id: 'po', number: 'SYN-PO-1', lines: [{ sku: 'SYN-A', ordered: 20 }] }], sales: [] });
  const sub = R.submitReceiving(L, { requestKey: '00000000-0000-4000-8000-000000000001', poId: 'po', lines: [{ sku: 'SYN-A', good: 8 }], by: 'mia', role: 'manager' });
  expect(sub.ok).toBe(true);
  expect(R.approveReceiving(L, { recordId: sub.id, by: 'mia', role: 'manager' }).reason).toMatch(/only the owner or an administrator approves/);
  expect(R.approveReceiving(L, { recordId: sub.id, by: 'ari', role: 'administrator' }).ok).toBe(true);
  expect(R.SUBMIT_ROLES).toContain('manager');
  expect(R.DECIDE_ROLES).toEqual(['owner', 'administrator']);
});

test('deliveries store: a manager is let through to record, and refused before the database to approve', async () => {
  const calls = [];
  const s = RS.createStore({ client: client(calls), enabled: true, role: 'manager' });
  const ap = await s.approve(ID);
  expect(ap.ok).toBe(false);
  expect(ap.message).toBe('Only the owner or an administrator approves, rejects or decides.');
  expect(calls).toEqual([]);
  // someone with no known level is still refused outright
  const v = RS.createStore({ client: client([]), enabled: true, role: 'viewer' });
  expect((await v.approve(ID)).message).toMatch(/Only staff, an administrator or the owner/);
});

test('supplier documents store: a manager records like an employee, and cannot approve', async () => {
  const calls = [];
  const s = SD.createStore({ client: client(calls), enabled: true, role: 'manager' });
  const rec = await s.record({ requestKey: ID, supplierId: ID, kind: 'certificate_of_analysis', subjectKind: 'batch', subjectRef: 'LOT-1' });
  expect(rec.message).not.toMatch(/Only staff, an administrator or the owner/);
  expect(calls).toContain('record_supplier_document');
  const ap = await s.review(ID, 'approved');
  expect(ap.message).toBe('Only the owner or an administrator can approve or reject a supplier document.');
});

test('invoice store: a manager is in the list of people who prepare drafts, like an employee', () => {
  const src = require('fs').readFileSync(require.resolve('../../assets/invoice/he-invoice-store.js'), 'utf8');
  expect(src).toMatch(/ROLES_MAY_DRAFT = new Set\(\['owner', 'administrator', 'manager', 'employee'\]\)/);
  expect(typeof INV.createStore).toBe('function');
});
