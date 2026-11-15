// The review desk: the manual half of owner decision #3 ("drafts are generated
// automatically; the owner reviews and issues them by hand"), with decisions
// #1 (tax), #2 (terms), #3 (numbering) and #5 (who may act) applied together.
// Pure, Node-only, synthetic. Every desk function returns a new desk; nothing is
// stored, sent or charged.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const I = require('../../assets/invoice/he-invoice.js');
const T = require('../../assets/invoice/he-tax.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const LINES = [{ sku: 'SYN-A', product_name: 'Synthetic item A', quantity: 6, unit_price: 18.5, line_total: 111 }];
const ORDERS = [
  { id: 'SYN-O1', order_number: 'SYN-1', status: 'paid', shipping_total: 9, items: LINES },
  { id: 'SYN-O2', order_number: 'SYN-2', status: 'paid', items: [{ sku: 'SYN-B', quantity: 3, unit_price: null }] },
  { id: 'SYN-O3', order_number: 'SYN-3', status: 'paid', items: LINES },
];
const PENDING = T.invoiceTaxFields({ shipping: { mandatory: true } });
const CONFIRMED = T.invoiceTaxFields({ shipping: { mandatory: true }, localRate: 0.0275 });
const NOW = '2026-11-15T15:00:00Z';
const open = (used) => I.openDesk(I.draftsForOrders(ORDERS, [], { taxFields: PENDING, accountFor: o => ({ id: 'ACCT-' + o.id, creditApproved: o.id === 'SYN-O3' }) }).drafts, { usedNumbers: used || [] });

test('a new desk holds the drafts and nothing is issued', () => {
  const d = open();
  expect(d.items.map(i => i.orderId)).toEqual(['SYN-O1', 'SYN-O2', 'SYN-O3']);
  expect(d).toMatchObject({ issued: [], usedNumbers: [], audit: [], label: 'SIMULATED' });
  expect(I.openDesk(null)).toMatchObject({ items: [], issued: [] });
  expect(I.openDesk([{ draft: { status: 'issued' } }, null, {}]).items).toEqual([]);
});

test('nothing can be issued while the tax rate is pending, whoever asks', () => {
  const d = open();
  for (const role of ['owner', 'administrator']) {
    const r = I.deskIssue(d, 'SYN-O1', { role, now: NOW });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/tax rate is still pending/);
    expect(r.desk).toBe(d);                                   // unchanged
  }
});

test('confirming the rate is owner/administrator only, needs a confirmed rate, and is recorded on each draft', () => {
  const d = open();
  expect(I.deskConfirmTax(d, CONFIRMED, { role: 'staff' }).reason).toMatch(/owner or administrator/);
  expect(I.deskConfirmTax(d, PENDING, { role: 'owner' }).reason).toMatch(/confirmed tax rate/);
  expect(I.deskConfirmTax(d, { taxRateStatus: 'CONFIRMED', taxRate: 0.9 }, { role: 'owner' }).reason).toMatch(/between 0% and 25%/);
  expect(I.deskConfirmTax(d, { taxRateStatus: 'CONFIRMED', taxRate: 'abc' }, { role: 'owner' }).reason).toMatch(/confirmed tax rate/);
  const c = I.deskConfirmTax(d, CONFIRMED, { role: 'owner', by: 'owner', now: NOW });
  expect(c).toMatchObject({ ok: true, changed: 3 });
  const first = c.desk.items[0];
  expect(first.draft).toMatchObject({ taxRateStatus: 'CONFIRMED', tax: 10.8, total: 130.8, orderId: 'SYN-O1' });   // (111 + 9) * 9%
  expect(first.draft.revisions).toHaveLength(1);
  expect(first.draft.revisions[0]).toMatchObject({ reason: 'local tax rate confirmed', by: 'owner' });
  expect(first.checks).toEqual([]);
  expect(c.desk.items[1].checks.join(' ')).toMatch(/no unit price/);      // the other problem is still listed
  expect(c.desk.audit).toEqual([{ action: 'TAX_CONFIRMED', rate: CONFIRMED.taxRate, drafts: 3, by: 'owner', at: NOW }]);
  expect(d.items[0].draft.taxRateStatus).toBe('PENDING');                 // the original desk is untouched
  expect(I.deskConfirmTax(c.desk, CONFIRMED, { role: 'owner' }).reason).toMatch(/no draft is waiting/);
});

test('issuing gives the next number for the business year, the account terms and the due date', () => {
  let d = I.deskConfirmTax(open(['HE-2026-0007']), CONFIRMED, { role: 'owner', now: NOW }).desk;
  const a = I.deskIssue(d, 'SYN-O1', { role: 'administrator', by: 'admin-1', now: NOW });
  expect(a).toMatchObject({ ok: true, number: 'HE-2026-0008' });
  expect(a.invoice).toMatchObject({ status: 'issued', number: 'HE-2026-0008', terms: 'DUE_ON_RECEIPT', dueDate: '2026-11-15', total: 130.8, orderId: 'SYN-O1' });
  d = a.desk;
  expect(d.items.map(i => i.orderId)).toEqual(['SYN-O2', 'SYN-O3']);
  const b = I.deskIssue(d, 'SYN-O3', { role: 'owner', now: NOW });
  expect(b.invoice).toMatchObject({ number: 'HE-2026-0009', terms: 'NET_14', dueDate: '2026-11-29' });
  expect(b.desk.usedNumbers).toEqual(['HE-2026-0007', 'HE-2026-0008', 'HE-2026-0009']);
  expect(b.desk.audit.map(x => x.action)).toEqual(['TAX_CONFIRMED', 'ISSUED', 'ISSUED']);
  // The same order cannot be issued twice, and staff cannot issue at all.
  expect(I.deskIssue(b.desk, 'SYN-O1', { role: 'owner', now: NOW }).reason).toMatch(/no draft for that order/);
  expect(I.deskIssue(d, 'SYN-O3', { role: 'staff', now: NOW }).reason).toMatch(/owner or administrator/);
  expect(I.deskIssue(d, 'SYN-O3', { role: 'owner' }).reason).toMatch(/time of issue is missing/);
});

test('a draft with something still to check is refused until it is fixed', () => {
  const d = I.deskConfirmTax(open(), CONFIRMED, { role: 'owner', now: NOW }).desk;
  const r = I.deskIssue(d, 'SYN-O2', { role: 'owner', now: NOW });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/still has something to check: SYN-B: no unit price/);
  expect(r.desk.issued).toEqual([]);
});

test('the number follows the Central business year: late on Dec 31 Central is still the old year', () => {
  const d = I.deskConfirmTax(open(['HE-2026-0041']), CONFIRMED, { role: 'owner', now: NOW }).desk;
  // 11:30 pm Central on Dec 31, 2026 is already Jan 1, 2027 in UTC.
  expect(I.deskIssue(d, 'SYN-O1', { role: 'owner', now: '2027-01-01T05:30:00Z' }).number).toBe('HE-2026-0042');
  // 12:30 am Central on Jan 1 starts the new year's sequence at 0001.
  expect(I.deskIssue(d, 'SYN-O1', { role: 'owner', now: '2027-01-01T06:30:00Z' }).number).toBe('HE-2027-0001');
});

test('voiding needs a reason, keeps the number on the record, and the number is never reused', () => {
  let d = I.deskConfirmTax(open(), CONFIRMED, { role: 'owner', now: NOW }).desk;
  d = I.deskIssue(d, 'SYN-O1', { role: 'owner', now: NOW }).desk;                       // HE-2026-0001
  expect(I.deskVoid(d, 'HE-2026-0001', { role: 'owner' }).reason).toMatch(/written reason is required/);
  expect(I.deskVoid(d, 'HE-2026-0001', { role: 'staff', reason: 'entered twice' }).reason).toMatch(/owner or administrator/);
  expect(I.deskVoid(d, 'HE-2026-9999', { role: 'owner', reason: 'entered twice' }).reason).toMatch(/no issued invoice/);
  const v = I.deskVoid(d, 'HE-2026-0001', { role: 'administrator', by: 'admin-1', reason: 'entered twice (synthetic)', now: NOW });
  expect(v.ok).toBe(true);
  expect(v.desk.issued[0]).toMatchObject({ number: 'HE-2026-0001', status: 'void' });
  expect(v.desk.usedNumbers).toEqual(['HE-2026-0001']);
  expect(v.desk.audit[v.desk.audit.length - 1]).toMatchObject({ action: 'VOIDED', number: 'HE-2026-0001', by: 'admin-1', reason: 'entered twice (synthetic)' });
  expect(I.deskVoid(v.desk, 'HE-2026-0001', { role: 'owner', reason: 'again please' }).reason).toMatch(/already void/);
  // The next invoice takes 0002 — the voided number is not handed out again.
  expect(I.deskIssue(v.desk, 'SYN-O3', { role: 'owner', now: NOW }).number).toBe('HE-2026-0002');
  expect(d.issued[0].status).toBe('issued');                                             // earlier desk untouched
});

test('odd input never throws', () => {
  for (const bad of [undefined, null, 0, 'x', [], {}]) {
    expect(I.deskConfirmTax(bad, CONFIRMED, { role: 'owner' }).ok).toBe(false);
    expect(I.deskIssue(bad, 'SYN-O1', { role: 'owner', now: NOW }).ok).toBe(false);
    expect(I.deskVoid(bad, 'HE-2026-0001', { role: 'owner', reason: 'entered twice' }).ok).toBe(false);
  }
});
