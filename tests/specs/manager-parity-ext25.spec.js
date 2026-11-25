// A manager (drafts/62, owner decision of Nov 24) can do everything an employee
// can on the dashboard, and nothing an employee cannot: record deliveries and
// returns, record supplier documents, prepare invoice drafts. Owner decision of
// Nov 25: a manager also approves or rejects SUPPLIER DOCUMENTS someone else
// recorded, and opens their files; nothing else about them. Approving deliveries
// and returns stays with the owner or an administrator until drafts/40 is changed
// for it (it needs a separate decision on how a manager may change stock).
// The stores are checked in Node with a made-up database client; every value is
// made up.
const { test, expect } = require('@playwright/test');
const R = require('../../assets/inventory/he-receiving.js');
const RS = require('../../assets/inventory/he-receiving-store.js');
const SD = require('../../assets/suppliers/he-supplier-docs-store.js');
const SDR = require('../../assets/suppliers/he-supplier-docs.js');
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

test('the rules prototype: a manager submits like an employee, and decides a record someone ELSE submitted (Nov 25)', () => {
  const L = R.createLedger({ products: [{ sku: 'SYN-A', available: 5, damaged: 0 }],
    purchaseOrders: [{ id: 'po', number: 'SYN-PO-1', lines: [{ sku: 'SYN-A', ordered: 20 }] }], sales: [] });
  const sub = R.submitReceiving(L, { requestKey: '00000000-0000-4000-8000-000000000001', poId: 'po', lines: [{ sku: 'SYN-A', good: 8 }], by: 'mia', role: 'manager' });
  expect(sub.ok).toBe(true);
  // never their own record: a second person decides it
  expect(R.approveReceiving(L, { recordId: sub.id, by: 'mia', role: 'manager' }).reason).toMatch(/not for a record they submitted/);
  // another manager may
  expect(R.approveReceiving(L, { recordId: sub.id, by: 'max', role: 'manager' }).ok).toBe(true);
  // an employee still may not decide; surplus and corrections stay with the owner or an administrator
  const sub2 = R.submitReceiving(L, { requestKey: '00000000-0000-4000-8000-000000000002', poId: 'po', lines: [{ sku: 'SYN-A', good: 2 }], by: 'eve', role: 'employee' });
  expect(R.approveReceiving(L, { recordId: sub2.id, by: 'sam', role: 'employee' }).ok).toBe(false);
  expect(R.SUBMIT_ROLES).toContain('manager');
  expect(R.DECIDE_ROLES).toEqual(['owner', 'administrator']);
});

test('deliveries store: a manager is let through to approve, reject and decide returns (the database checks "not their own"); surplus and corrections are refused before the database', async () => {
  const calls = [];
  const s = RS.createStore({ client: client(calls), enabled: true, role: 'manager' });
  await s.approve(ID);
  expect(calls).toContain('approve_receiving_record');
  await s.reject(ID, 'Counted the wrong box');
  expect(calls).toContain('reject_receiving_record');
  await s.decideSupplierReturn(ID, 'approved');
  expect(calls).toContain('decide_supplier_return');
  const before = calls.length;
  expect((await s.decideSurplus(ID, 'kept')).message).toBe('Only the owner or an administrator approves, rejects or decides.');
  expect(calls.length).toBe(before);
  // an employee is still refused before the database
  const ecalls = [];
  const e = RS.createStore({ client: client(ecalls), enabled: true, role: 'employee' });
  expect((await e.approve(ID)).message).toBe('Only the owner, an administrator or a manager approves, rejects or decides.');
  expect(ecalls).toEqual([]);
  // someone with no known level is still refused outright
  const v = RS.createStore({ client: client([]), enabled: true, role: 'viewer' });
  expect((await v.approve(ID)).message).toMatch(/Only staff, an administrator or the owner|Only the owner, an administrator or a manager/);
});

test('supplier documents store: a manager records like an employee, and is let through to approve (Nov 25)', async () => {
  const calls = [];
  const s = SD.createStore({ client: client(calls), enabled: true, role: 'manager' });
  const rec = await s.record({ requestKey: ID, supplierId: ID, kind: 'certificate_of_analysis', subjectKind: 'batch', subjectRef: 'LOT-1' });
  expect(rec.message).not.toMatch(/Only staff, an administrator or the owner/);
  expect(calls).toContain('record_supplier_document');
  const ap = await s.review(ID, 'approved');
  expect(ap.message || '').not.toMatch(/can approve or reject/);
  expect(calls).toContain('review_supplier_document');   // the database decides "not their own document"
  // the rest stays with the owner or an administrator
  expect((await s.setTypeActive('batch_record', false)).message).toMatch(/Only the owner or an administrator can change the supplier document checklist/);
  // an employee is still refused before the database
  const ecalls = [];
  const e = SD.createStore({ client: client(ecalls), enabled: true, role: 'employee' });
  expect((await e.review(ID, 'approved')).message).toBe('Only the owner, an administrator or a manager can approve or reject a supplier document.');
  expect(ecalls).toEqual([]);
});

test('supplier documents rules: a manager reviews a document someone else recorded, never their own', () => {
  const doc = { status: 'received', recordedBy: 'eve', kind: 'certificate_of_analysis' };
  const ok = SDR.reviewDocument(doc, 'approved', { role: 'manager', by: 'mia', at: '2026-11-25' });
  expect(ok.ok).toBe(true);
  expect(ok.document.reviewedBy).toBe('mia');
  const own = SDR.reviewDocument(Object.assign({}, doc, { recordedBy: 'mia' }), 'approved', { role: 'manager', by: 'mia', at: '2026-11-25' });
  expect(own.ok).toBe(false);
  expect(own.reason).toMatch(/does not review a document they recorded/);
  // the owner or an administrator may review their own; an employee never
  expect(SDR.reviewDocument(Object.assign({}, doc, { recordedBy: 'ann' }), 'approved', { role: 'administrator', by: 'ann', at: '2026-11-25' }).ok).toBe(true);
  expect(SDR.reviewDocument(doc, 'approved', { role: 'employee', by: 'sam', at: '2026-11-25' }).ok).toBe(false);
});

test('invoice store: a manager is in the list of people who prepare drafts, like an employee', () => {
  const src = require('fs').readFileSync(require.resolve('../../assets/invoice/he-invoice-store.js'), 'utf8');
  expect(src).toMatch(/ROLES_MAY_DRAFT = new Set\(\['owner', 'administrator', 'manager', 'employee'\]\)/);
  expect(typeof INV.createStore).toBe('function');
});
