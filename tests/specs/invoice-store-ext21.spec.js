// Invoice storage adapter (assets/invoice/he-invoice-store.js), the dashboard
// side of docs/ops/sql/drafts/32. Pure, Node-only, synthetic. The database
// client is a stand-in that records every call; nothing reaches a network.
// The adapter is NOT connected to any screen and is OFF unless enabled.
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const S = require('../../assets/invoice/he-invoice-store.js');
const I = require('../../assets/invoice/he-invoice.js');
const T = require('../../assets/invoice/he-tax.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const SQL = fs.readFileSync(path.join(__dirname, '../../docs/ops/sql/drafts/32_DRAFT_invoices.sql'), 'utf8');
const OID = '00000000-0000-4000-8000-00000000c001';
const IID = '00000000-0000-4000-8000-0000000000f1';
const ITEMS = [
  { sku: 'SYN-A', product_name: 'Synthetic item A', quantity: 10, unit_price: 18.5, line_total: 180 },
  { sku: 'SYN-B', product_name: 'Synthetic item B', quantity: 4, unit_price: 18.5, line_total: 74 },
];
const ORDER = { id: OID, order_number: 'SYN-1001', currency: 'USD', shipping_total: 12.5, status: 'paid' };
const CONFIRMED = T.invoiceTaxFields({ shipping: { mandatory: true }, localRate: 0.0275 });
const PENDING = T.invoiceTaxFields({ shipping: { mandatory: true } });
const draft = (tf, extra) => Object.assign(I.draftFromOrder(ORDER, ITEMS, { account: { id: 'SYN-ACCT-1' }, taxFields: tf || CONFIRMED }).draft,
  { billTo: { name: 'SYN Cedar Spa', city: 'Chicago', state: 'IL' } }, extra || {});

// A stand-in for the supabase-js client: records the chain, answers from a queue.
function fakeClient(answers) {
  const calls = [];
  const queue = (answers || []).slice();
  const next = () => Promise.resolve(queue.length ? queue.shift() : { data: null, error: null });
  function chain(table) {
    const call = { table: table, ops: [] };
    calls.push(call);
    const b = {};
    ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single'].forEach(function (op) {
      b[op] = function () { call.ops.push([op].concat(Array.from(arguments))); return b; };
    });
    b.then = function (res, rej) { return next().then(res, rej); };
    return b;
  }
  return {
    calls: calls,
    from: function (t) { return chain(t); },
    rpc: function (name, args) { calls.push({ rpc: name, args: args }); return next(); },
  };
}
// A client that fails the test if anything at all is touched.
const untouchable = new Proxy({}, { get: (_, k) => { throw new Error('the database client was touched: ' + String(k)); } });

test('contract: every column and function the adapter uses exists in drafts/32, with the same parameter names', () => {
  const table = SQL.slice(SQL.indexOf('create table if not exists public.invoices ('), SQL.indexOf('create unique index'));
  const cols = new Set(Array.from(table.matchAll(/^\s{2}([a-z_]+)\s+(?:uuid|text|integer|numeric|jsonb|date|timestamptz|boolean)\b/gm)).map(m => m[1]));
  for (const c of S.READ_COLUMNS) expect(cols.has(c), 'column ' + c).toBe(true);
  for (const c of S.WRITE_COLUMNS) expect(S.READ_COLUMNS).toContain(c);
  // The adapter never writes a column the database assigns itself.
  for (const c of ['id', 'invoice_number', 'invoice_year', 'invoice_seq', 'issue_date', 'due_date', 'issued_at', 'issued_by', 'voided_at', 'voided_by', 'void_reason', 'created_by'])
    expect(S.WRITE_COLUMNS).not.toContain(c);
  for (const k of ['issue', 'void']) {
    const m = SQL.match(new RegExp('create or replace function public\\.' + S.RPC[k].name + '\\(([^)]*)\\)'));
    expect(m, S.RPC[k].name).not.toBeNull();
    expect(m[1].split(',').map(p => p.trim().split(/\s+/)[0])).toEqual(S.RPC[k].params);
  }
  // The limits the adapter checks early are the database's own.
  expect(SQL).toContain('octet_length(bill_to::text) <= ' + S.MAX_ADDRESS_BYTES);
  expect(SQL).toContain('tax_rate <= 0.25');
  expect(SQL).toMatch(/length\(btrim\(void_reason\)\) >= 5/);
});

test('a draft from an order becomes a row: amounts, tax choices, who is billed — and never a number', () => {
  const r = S.toRow(draft());
  expect(r.ok).toBe(true);
  expect(Object.keys(r.row).sort()).toEqual(S.WRITE_COLUMNS.slice().sort());
  expect(r.row).toMatchObject({ order_id: OID, account_ref: 'SYN-ACCT-1', status: 'draft', terms: 'DUE_ON_RECEIPT', currency: 'USD',
    subtotal: 254, shipping: 12.5, tax_rate_status: 'CONFIRMED', tax_shipping: true, tax_exempt: false, bill_to: { name: 'SYN Cedar Spa', city: 'Chicago', state: 'IL' } });
  expect(r.row.total).toBe(r.row.subtotal - r.row.order_discount + r.row.tax + r.row.shipping);
  expect(r.row.lines.map(l => [l.sku, l.quantity, l.lineTotal])).toEqual([['SYN-A', 10, 180], ['SYN-B', 4, 74]]);
  // Decision 1: a pending rate, or no status at all, is stored as PENDING.
  expect(S.toRow(draft(PENDING)).row.tax_rate_status).toBe('PENDING');
  const noStatus = draft(); delete noStatus.taxRateStatus;
  expect(S.toRow(noStatus).row.tax_rate_status).toBe('PENDING');
  // Read back, it prints the same as the engine's draft.
  const back = S.fromRow(Object.assign({ id: IID, invoice_number: null }, r.row));
  const d = draft();
  for (const k of ['subtotal', 'orderDiscount', 'shipping', 'tax', 'total', 'taxRate', 'terms', 'currency', 'billTo', 'orderId', 'accountId', 'taxShipping', 'taxExempt', 'taxRateStatus'])
    expect(back[k], k).toEqual(d[k]);
  expect(back).toMatchObject({ id: IID, storage: 'database', synthetic: false, number: null });
});

test('a row is refused, with every reason, rather than stored wrong', () => {
  const bad = (extra) => S.toRow(draft(CONFIRMED, extra)).problems.join(' | ');
  expect(bad({ status: 'issued' })).toMatch(/only a draft can be saved/);
  expect(bad({ orderId: 'SYN-O1' })).toMatch(/not a database order id/);
  expect(bad({ total: 1 })).toMatch(/total does not equal/);
  expect(bad({ subtotal: 999, total: 999 + 12.5 + draft().tax })).toMatch(/lines do not add up/);
  expect(bad({ taxExempt: true })).toMatch(/resale-exempt invoice cannot carry tax/);
  expect(bad({ terms: 'NET_90' })).toMatch(/unknown payment terms/);
  expect(bad({ taxRate: 0.5 })).toMatch(/tax rate must be between/);
  expect(bad({ shipping: -1 })).toMatch(/shipping cannot be negative/);
  expect(bad({ tax: NaN })).toMatch(/tax is not a number/);
  expect(bad({ currency: 'dollars' })).toMatch(/three-letter code/);
  expect(bad({ billTo: 'SYN Cedar Spa, Chicago' })).toMatch(/bill-to must be a name-and-address record/);
  expect(bad({ shipTo: { note: 'x'.repeat(S.MAX_ADDRESS_BYTES) } })).toMatch(/ship-to is longer than/);
  expect(bad({ accountId: 'a'.repeat(101) })).toMatch(/account reference is longer/);
  expect(bad({ lines: [null] })).toMatch(/line 1 is empty/);
  expect(bad({ lines: undefined })).toMatch(/lines are missing/);
  // Malformed input never throws.
  for (const v of [null, undefined, 0, 'x', [], { lines: 'x' }, { status: 'draft', lines: [{ quantity: 'many' }] }]) {
    expect(() => S.toRow(v)).not.toThrow();
    expect(S.toRow(v).ok).toBe(false);
  }
  for (const v of [null, 'x', [], {}]) expect(() => S.fromRow(v)).not.toThrow();
  for (const v of [null, {}, { code: 42 }, { message: 12 }]) expect(typeof S.friendlyError(v)).toBe('string');
});

test('off unless enabled: every method refuses without touching the database', async () => {
  for (const store of [S.createStore(), S.createStore({ client: untouchable }), S.createStore({ client: untouchable, enabled: 'yes' })]) {
    expect(store.enabled).toBe(false);
    for (const r of [await store.probe(), await store.list(), await store.saveDraft(draft()), await store.issue(IID), await store.void(IID, 'entered twice'), await store.removeDraft(IID)]) {
      expect(r).toMatchObject({ ok: false, off: true });
      expect(r.message).toMatch(/Invoice storage is off\. Nothing was saved/);
    }
  }
  expect((await S.createStore({ enabled: true }).probe()).message).toMatch(/No database connection/);
});

test('save, issue, void and remove send exactly the expected requests', async () => {
  const c = fakeClient([
    { data: Object.assign({ id: IID }, S.toRow(draft()).row), error: null },
    { data: Object.assign({ id: IID }, S.toRow(draft()).row), error: null },
    { data: { ok: true, already_issued: false, status: 'issued', invoice_number: 'HE-2026-0001', issue_date: '2026-11-15', due_date: '2026-11-15', terms: 'DUE_ON_RECEIPT' }, error: null },
    { data: { ok: true, already_issued: true, status: 'issued', invoice_number: 'HE-2026-0001' }, error: null },
    { data: { ok: true, already_void: false, invoice_number: 'HE-2026-0001' }, error: null },
    { data: [{ id: IID }], error: null },
    { data: [], error: null },
  ]);
  const store = S.createStore({ client: c, enabled: true, role: 'owner' });
  const saved = await store.saveDraft(draft());
  expect(saved).toMatchObject({ ok: true, message: expect.stringMatching(/no number until it is issued/) });
  expect(saved.invoice.id).toBe(IID);
  expect(c.calls[0].table).toBe('invoices');
  expect(c.calls[0].ops[0][0]).toBe('insert');
  expect(c.calls[0].ops[0][1]).not.toHaveProperty('invoice_number');
  const upd = await store.saveDraft(Object.assign(draft(), { id: IID }));
  expect(upd.ok).toBe(true);
  expect(c.calls[1].ops.slice(0, 3).map(o => o.slice(0, 1)[0])).toEqual(['update', 'eq', 'eq']);
  expect(c.calls[1].ops.slice(1, 3)).toEqual([['eq', 'id', IID], ['eq', 'status', 'draft']]);   // never touches a non-draft
  const iss = await store.issue(IID);
  expect(iss).toMatchObject({ ok: true, alreadyIssued: false, number: 'HE-2026-0001', message: 'Issued as HE-2026-0001.' });
  expect(c.calls[2]).toEqual({ rpc: 'issue_invoice', args: { p_invoice_id: IID, p_terms: null, p_credit_approved: false } });
  expect((await store.issue(IID)).message).toBe('Already issued as HE-2026-0001. Nothing changed.');
  const v = await store.void(IID, '  Entered twice (synthetic)  ');
  expect(v.message).toMatch(/stays on the record and its number is never reused/);
  expect(c.calls[4]).toEqual({ rpc: 'void_invoice', args: { p_invoice_id: IID, p_reason: 'Entered twice (synthetic)' } });
  expect((await store.removeDraft(IID)).ok).toBe(true);
  expect(c.calls[5].ops).toEqual([['delete'], ['eq', 'id', IID], ['eq', 'status', 'draft'], ['select', 'id']]);
  expect((await store.removeDraft(IID)).message).toMatch(/issued and void invoices stay on the record/);
});

test('decisions 2 and 5 are checked before asking the database; the database is still the final word', async () => {
  const c = fakeClient();
  const staff = S.createStore({ client: c, enabled: true, role: 'employee' });
  expect((await staff.issue(IID)).message).toMatch(/Only the owner or an administrator can issue/);
  expect((await staff.void(IID, 'entered twice')).message).toMatch(/Only the owner or an administrator can void/);
  const owner = S.createStore({ client: c, enabled: true, role: 'owner' });
  expect((await owner.issue(IID, { terms: 'NET_14' })).message).toMatch(/Net 14 is only for an account approved for credit/);
  expect((await owner.issue(IID, { terms: 'NET_90', creditApproved: true })).message).toMatch(/Unknown payment terms/);
  expect((await owner.void(IID, 'oops')).message).toMatch(/written reason is required/);
  expect((await owner.issue('HE-2026-0001')).message).toMatch(/not a database invoice id/);
  expect((await S.createStore({ client: c, enabled: true, role: 'customer' }).saveDraft(draft())).message).toMatch(/Only staff/);
  expect(c.calls).toEqual([]);                        // none of these reached the database
  // A role the page does not know is left to the database to decide.
  const unknown = S.createStore({ client: fakeClient([{ data: null, error: { code: '42501', message: 'Only the owner or an administrator can issue an invoice.' } }]), enabled: true });
  expect((await unknown.issue(IID)).message).toBe('Only the owner or an administrator can issue an invoice.');
});

test('database and network errors become one plain sentence; nothing is retried behind your back', async () => {
  const say = async (error, fn) => fn(S.createStore({ client: fakeClient([{ data: null, error: error }]), enabled: true, role: 'owner' }));
  expect((await say({ code: '42P01', message: 'relation "public.invoices" does not exist' }, s => s.probe()))).toMatchObject({ ok: false, installed: false, message: expect.stringMatching(/not installed in the database yet/) });
  expect((await say({ code: 'PGRST202', message: 'Could not find the function public.issue_invoice' }, s => s.issue(IID))).message).toMatch(/not installed/);
  expect((await say({ code: '23505', message: 'duplicate key value violates unique constraint "invoices_one_live_per_order"' }, s => s.saveDraft(draft()))).message).toMatch(/already has an invoice that is not void/);
  expect((await say({ code: '22023', message: 'The tax rate on this draft is still pending. Confirm the local rate before issuing.' }, s => s.issue(IID))).message).toMatch(/still pending/);
  expect((await say({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, s => s.saveDraft(Object.assign(draft(), { id: IID })))).message).toMatch(/no longer a draft/);
  expect((await say({ code: '23514', message: 'violates check constraint' }, s => s.saveDraft(draft()))).message).toMatch(/outside what the database accepts/);
  const net = S.createStore({ client: { from: () => { throw new TypeError('Failed to fetch'); }, rpc: () => Promise.reject(new TypeError('Failed to fetch')) }, enabled: true, role: 'owner' });
  expect((await net.issue(IID)).message).toBe('Could not reach the database. Nothing was changed; try again.');
  expect((await net.list()).message).toMatch(/Could not reach/);
  // A void result says so, and a missing number is not reported as success.
  const odd = S.createStore({ client: fakeClient([{ data: { ok: false, already_issued: true, status: 'void', invoice_number: 'HE-2026-0004' } }, { data: { ok: true } }]), enabled: true, role: 'owner' });
  expect((await odd.issue(IID)).message).toBe('Not issued: this invoice is void.');
  expect((await odd.issue(IID)).message).toMatch(/did not return an invoice number/);
});

test('a double click sends one request, and the list is bounded', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const calls = [];
  const slow = { from: () => ({}), rpc: (name, args) => { calls.push(name); return gate.then(() => ({ data: { ok: true, already_issued: false, status: 'issued', invoice_number: 'HE-2026-0002' } })); } };
  const store = S.createStore({ client: slow, enabled: true, role: 'administrator' });
  const first = store.issue(IID);
  const second = await store.issue(IID);
  expect(second).toMatchObject({ ok: false, busy: true });
  release();
  expect((await first).number).toBe('HE-2026-0002');
  expect(calls).toEqual(['issue_invoice']);
  expect((await store.issue(IID)).ok).toBe(true);     // free again once the first finished
  const c = fakeClient([{ data: [{ id: IID, status: 'issued', invoice_number: 'HE-2026-0001', total: '130.80', bill_to: 'not an object' }], error: null }]);
  const listed = await S.createStore({ client: c, enabled: true }).list({ limit: 10000, status: 'issued' });
  expect(listed.invoices[0]).toMatchObject({ number: 'HE-2026-0001', total: 130.8, billTo: null });
  expect(c.calls[0].ops).toContainEqual(['limit', 200]);
  expect(c.calls[0].ops).toContainEqual(['eq', 'status', 'issued']);
});
