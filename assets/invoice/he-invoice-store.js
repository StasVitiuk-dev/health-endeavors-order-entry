// Invoice storage adapter — the dashboard side of docs/ops/sql/drafts/32 (Nov 15).
//
// NOT CONNECTED. No screen uses this file yet, and the database tables it talks
// to are a draft the owner has not installed. It exists so that, once drafts/32
// is approved and run, saving, issuing and voiding real invoices needs only a
// small, reviewed wiring step.
//
// Pure apart from the database client it is GIVEN (supabase-js shaped: from(),
// rpc()); it never creates one, never reads keys, and holds no state except a
// guard against the same request being sent twice at once. Every method is OFF
// unless the caller passes enabled: true, and then refuses before calling the
// database. The database enforces every rule again on its own (drafts/32): this
// file only gives plain-English messages earlier and maps the shapes.
//
// Owner decisions of Nov 14 (OWNER_DECISIONS_2026-11-14.md) as they apply here:
//   1 a draft whose tax rate is not CONFIRMED is stored as PENDING and cannot be
//     issued; a resale-exempt draft carries no tax
//   2 terms are due on receipt unless Net 14 is chosen for an account approved
//     for credit
//   3 the number is assigned by the database at issue; this file never sends one
//   5 only the owner or an administrator can issue or void
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.invoice = root.HE.invoice || {})['he-invoice-store'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const TABLE = 'invoices';
  // Every column this file reads or writes. A test checks each one against the
  // CREATE TABLE in drafts/32, so the two cannot drift apart unnoticed.
  const WRITE_COLUMNS = ['order_id', 'account_ref', 'bill_to', 'ship_to', 'status', 'terms', 'currency', 'lines',
    'subtotal', 'order_discount', 'shipping', 'tax_rate', 'tax_rate_status', 'tax_shipping', 'tax_exempt', 'tax', 'total'];
  const READ_COLUMNS = ['id'].concat(WRITE_COLUMNS, ['invoice_number', 'invoice_year', 'invoice_seq', 'issue_date', 'due_date',
    'issued_at', 'issued_by', 'voided_at', 'voided_by', 'void_reason', 'created_at', 'updated_at']);
  const SELECT = READ_COLUMNS.join(',');
  const RPC = {
    issue: { name: 'issue_invoice', params: ['p_invoice_id', 'p_terms', 'p_credit_approved'] },
    void: { name: 'void_invoice', params: ['p_invoice_id', 'p_reason'] },
  };
  const TERMS = ['DUE_ON_RECEIPT', 'NET_14'];
  const ROLES_MAY_ISSUE = new Set(['owner', 'administrator']);
  const ROLES_MAY_DRAFT = new Set(['owner', 'administrator', 'employee']);
  const MAX_LINES = 500;
  const MAX_ADDRESS_BYTES = 4000;     // matches the database check
  const MAX_LIST = 200;
  const MAX_TAX_RATE = 0.25;          // matches the database check
  const MIN_VOID_REASON = 5;          // matches the database check
  const OFF_MESSAGE = 'Invoice storage is off. Nothing was saved. (It needs the owner-approved database step drafts/32 and a reviewed switch.)';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const isUuid = (v) => typeof v === 'string' && UUID.test(v);
  const cents = (v) => Math.round(Number(v) * 100);
  const money = (c) => Math.round(c) / 100;
  const byteLen = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length);

  function moneyField(name, v, problems) {
    const n = Number(v == null ? 0 : v);
    if (!isFinite(n)) { problems.push(name + ' is not a number'); return 0; }
    if (n < 0) { problems.push(name + ' cannot be negative'); return 0; }
    if (n > 9999999999.99) { problems.push(name + ' is too large'); return 0; }
    return money(cents(n));
  }

  function addressField(name, v, problems) {
    if (v == null) return null;
    if (!isObj(v)) { problems.push(name + ' must be a name-and-address record'); return null; }
    let text;
    try { text = JSON.stringify(v); } catch (e) { problems.push(name + ' cannot be saved (' + e.message + ')'); return null; }
    if (byteLen(text) > MAX_ADDRESS_BYTES) { problems.push(name + ' is longer than ' + MAX_ADDRESS_BYTES + ' characters'); return null; }
    return JSON.parse(text);
  }

  // An engine draft (he-invoice.draftInvoice / draftFromOrder / reviseDraft) ->
  // a row for the invoices table. Refuses rather than guessing.
  function toRow(draft) {
    const problems = [];
    if (!isObj(draft)) return { ok: false, row: null, problems: ['no invoice draft was given'] };
    if (draft.status !== 'draft') problems.push('only a draft can be saved (this one is ' + (draft.status == null ? 'missing a status' : draft.status) + ')');
    if (draft.orderId != null && !isUuid(draft.orderId)) problems.push('the order link is not a database order id');
    let accountRef = null;
    if (draft.accountId != null) {
      accountRef = String(draft.accountId);
      if (accountRef.length > 100) problems.push('the account reference is longer than 100 characters');
    }
    const srcLines = Array.isArray(draft.lines) ? draft.lines : null;
    if (!srcLines) problems.push('the lines are missing');
    else if (srcLines.length > MAX_LINES) problems.push('more than ' + MAX_LINES + ' lines');
    const lines = (srcLines || []).slice(0, MAX_LINES).map(function (ln, i) {
      if (!isObj(ln)) { problems.push('line ' + (i + 1) + ' is empty'); return null; }
      const qty = Number(ln.quantity);
      if (!isFinite(qty) || qty < 0) problems.push('line ' + (i + 1) + ': the quantity is not a usable number');
      return {
        sku: ln.sku == null ? null : String(ln.sku), description: ln.description == null ? '' : String(ln.description),
        quantity: isFinite(qty) ? qty : 0,
        unitPrice: moneyField('line ' + (i + 1) + ' price', ln.unitPrice, problems),
        discount: moneyField('line ' + (i + 1) + ' discount', ln.discount, problems),
        lineTotal: moneyField('line ' + (i + 1) + ' total', ln.lineTotal, problems),
        lotNumber: ln.lotNumber == null ? null : String(ln.lotNumber),
      };
    }).filter(Boolean);
    const subtotal = moneyField('subtotal', draft.subtotal, problems);
    const orderDiscount = moneyField('order discount', draft.orderDiscount, problems);
    const shipping = moneyField('shipping', draft.shipping, problems);
    const tax = moneyField('tax', draft.tax, problems);
    const total = moneyField('total', draft.total, problems);
    const rate = Number(draft.taxRate == null ? 0 : draft.taxRate);
    if (!isFinite(rate) || rate < 0 || rate > MAX_TAX_RATE) problems.push('the tax rate must be between 0 and ' + (MAX_TAX_RATE * 100) + '%');
    const taxExempt = draft.taxExempt === true;
    if (taxExempt && tax !== 0) problems.push('a resale-exempt invoice cannot carry tax');
    // Decision 1: only an explicitly CONFIRMED rate is stored as confirmed.
    const taxRateStatus = draft.taxRateStatus === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING';
    if (draft.terms != null && TERMS.indexOf(draft.terms) < 0) problems.push('unknown payment terms: ' + draft.terms);
    const lineSum = lines.reduce(function (s, l) { return s + cents(l.lineTotal); }, 0);
    if (srcLines && lineSum !== cents(subtotal)) problems.push('the lines do not add up to the subtotal');
    const expectC = Math.max(0, cents(subtotal) - cents(orderDiscount)) + cents(tax) + cents(shipping);
    if (expectC !== cents(total)) problems.push('the total does not equal subtotal - discount + tax + shipping');
    const currency = draft.currency == null ? 'USD' : String(draft.currency);
    if (!/^[A-Z]{3}$/.test(currency)) problems.push('the currency must be a three-letter code');
    const row = {
      order_id: draft.orderId == null ? null : draft.orderId, account_ref: accountRef,
      bill_to: addressField('bill-to', draft.billTo, problems), ship_to: addressField('ship-to', draft.shipTo, problems),
      status: 'draft', terms: draft.terms == null ? null : draft.terms, currency: currency, lines: lines,
      subtotal: subtotal, order_discount: orderDiscount, shipping: shipping,
      tax_rate: isFinite(rate) ? Math.round(rate * 100000) / 100000 : 0, tax_rate_status: taxRateStatus,
      tax_shipping: draft.taxShipping === true, tax_exempt: taxExempt, tax: tax, total: total,
    };
    return problems.length ? { ok: false, row: null, problems: problems } : { ok: true, row: row, problems: [] };
  }

  // A stored row -> the engine's invoice shape, so the existing preview and
  // print views can show it. Marked as coming from storage, not simulated.
  function fromRow(row) {
    if (!isObj(row)) return null;
    const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
    const total = num(row.total);
    return {
      id: row.id || null, status: row.status || null, number: row.invoice_number || null,
      orderId: row.order_id || null, accountId: row.account_ref || null,
      billTo: isObj(row.bill_to) ? row.bill_to : null, shipTo: isObj(row.ship_to) ? row.ship_to : null,
      terms: row.terms || null, issueDate: row.issue_date || null, dueDate: row.due_date || null,
      currency: row.currency || 'USD', lines: Array.isArray(row.lines) ? row.lines : [],
      subtotal: num(row.subtotal), orderDiscount: num(row.order_discount), shipping: num(row.shipping),
      taxRate: num(row.tax_rate), taxRateStatus: row.tax_rate_status || 'PENDING',
      taxShipping: row.tax_shipping === true, taxExempt: row.tax_exempt === true, tax: num(row.tax), total: total,
      voidReason: row.void_reason || null, issuedAt: row.issued_at || null, voidedAt: row.voided_at || null,
      paid: 0, balance: total, payments: [], versions: [], corrections: [], revisions: [],
      synthetic: false, storage: 'database',
    };
  }

  // A database or network error -> one plain sentence. The database's own
  // messages (drafts/32) are already plain English, so they are passed on.
  function friendlyError(err) {
    if (err == null) return 'The database did not say what went wrong.';
    const code = err.code != null ? String(err.code) : '';
    const msg = err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Invoice storage is not installed in the database yet (drafts/32 needs the owner\'s approval). Nothing was saved.';
    }
    if (code === '42501') return /^Only the owner|^Only /.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === '23505') return /one_live_per_order/.test(msg) ? 'This order already has an invoice that is not void. Open that one instead.' : 'That would duplicate an existing record. Nothing was changed.';
    if (code === 'PGRST116') return 'That invoice was not found, or it is no longer a draft. Refresh the list.';
    if (code === '23514') return 'A value is outside what the database accepts. Nothing was changed. (' + msg + ')';
    if (code === '22023' || code === 'P0002') return msg || 'The database refused the request.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Nothing was changed; try again.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '.';
  }

  function createStore(options) {
    const o = options || {};
    const client = o.client || null;
    const enabled = o.enabled === true;
    const role = o.role == null ? null : String(o.role);
    const inFlight = new Set();

    function off() { return { ok: false, off: true, message: OFF_MESSAGE }; }
    function refuse(message, extra) { return Object.assign({ ok: false, message: message }, extra || {}); }
    function ready() {
      if (!enabled) return off();
      if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') return refuse('No database connection was given. Nothing was saved.');
      return null;
    }
    async function once(key, fn) {
      if (inFlight.has(key)) return refuse('That request is already being sent. Wait for it to finish.', { busy: true });
      inFlight.add(key);
      try { return await fn(); }
      catch (e) { return refuse(friendlyError(e), { error: true }); }
      finally { inFlight.delete(key); }
    }

    async function probe() {
      const r = ready(); if (r) return r;
      return once('probe', async function () {
        const res = await client.from(TABLE).select('id').limit(1);
        if (res && res.error) {
          const m = friendlyError(res.error);
          return refuse(m, { installed: !/not installed/.test(m) });
        }
        return { ok: true, installed: true, message: 'Invoice storage is installed and readable.' };
      });
    }

    async function list(opts) {
      const r = ready(); if (r) return r;
      const lo = opts || {};
      const limit = Math.max(1, Math.min(MAX_LIST, Math.floor(Number(lo.limit) || 50)));
      return once('list', async function () {
        let q = client.from(TABLE).select(SELECT);
        if (lo.status != null) q = q.eq('status', String(lo.status));
        const res = await q.order('created_at', { ascending: false }).limit(limit);
        if (res && res.error) return refuse(friendlyError(res.error));
        const rows = Array.isArray(res && res.data) ? res.data : [];
        return { ok: true, invoices: rows.map(fromRow).filter(Boolean), truncated: rows.length === limit };
      });
    }

    async function saveDraft(draft) {
      const r = ready(); if (r) return r;
      if (role != null && !ROLES_MAY_DRAFT.has(role)) return refuse('Only staff, an administrator or the owner can prepare an invoice draft.');
      const t = toRow(draft);
      if (!t.ok) return refuse('Not saved: ' + t.problems.join('; ') + '.', { problems: t.problems });
      const id = draft.id == null ? null : draft.id;
      if (id != null && !isUuid(id)) return refuse('Not saved: the invoice id is not a database id.');
      return once(id ? 'save:' + id : 'save:new:' + (t.row.order_id || 'no-order'), async function () {
        const res = id
          ? await client.from(TABLE).update(t.row).eq('id', id).eq('status', 'draft').select(SELECT).single()
          : await client.from(TABLE).insert(t.row).select(SELECT).single();
        if (res && res.error) return refuse(friendlyError(res.error));
        return { ok: true, invoice: fromRow(res && res.data), message: id ? 'Draft updated.' : 'Draft saved. It has no number until it is issued.' };
      });
    }

    async function issue(id, opts) {
      const r = ready(); if (r) return r;
      const io = opts || {};
      if (!isUuid(id)) return refuse('Not issued: that is not a database invoice id.');
      if (role != null && !ROLES_MAY_ISSUE.has(role)) return refuse('Only the owner or an administrator can issue an invoice.');
      const terms = io.terms == null ? null : String(io.terms);
      if (terms != null && TERMS.indexOf(terms) < 0) return refuse('Unknown payment terms ' + terms + '.');
      if (terms === 'NET_14' && io.creditApproved !== true) return refuse('Net 14 is only for an account approved for credit. Confirm the approval or use due on receipt.');
      return once('issue:' + id, async function () {
        const args = {}; args[RPC.issue.params[0]] = id; args[RPC.issue.params[1]] = terms; args[RPC.issue.params[2]] = io.creditApproved === true;
        const res = await client.rpc(RPC.issue.name, args);
        if (res && res.error) return refuse(friendlyError(res.error));
        const d = isObj(res && res.data) ? res.data : {};
        if (d.ok === false) return refuse('Not issued: this invoice is ' + (d.status || 'not a draft') + '.', { status: d.status || null, number: d.invoice_number || null });
        if (!d.invoice_number) return refuse('The database did not return an invoice number. Refresh the list before trying again.');
        return {
          ok: true, alreadyIssued: d.already_issued === true, number: d.invoice_number, status: d.status || 'issued',
          issueDate: d.issue_date || null, dueDate: d.due_date || null, terms: d.terms || null,
          message: d.already_issued === true ? 'Already issued as ' + d.invoice_number + '. Nothing changed.' : 'Issued as ' + d.invoice_number + '.',
        };
      });
    }

    async function voidInvoice(id, reason) {
      const r = ready(); if (r) return r;
      if (!isUuid(id)) return refuse('Not voided: that is not a database invoice id.');
      if (role != null && !ROLES_MAY_ISSUE.has(role)) return refuse('Only the owner or an administrator can void an invoice.');
      const why = reason == null ? '' : String(reason).trim();
      if (why.length < MIN_VOID_REASON) return refuse('A written reason is required to void an invoice (at least ' + MIN_VOID_REASON + ' characters).');
      return once('void:' + id, async function () {
        const args = {}; args[RPC.void.params[0]] = id; args[RPC.void.params[1]] = why;
        const res = await client.rpc(RPC.void.name, args);
        if (res && res.error) return refuse(friendlyError(res.error));
        const d = isObj(res && res.data) ? res.data : {};
        return { ok: true, alreadyVoid: d.already_void === true, number: d.invoice_number || null,
          message: d.already_void === true ? 'Already void. Nothing changed.' : 'Voided. ' + (d.invoice_number || 'The invoice') + ' stays on the record and its number is never reused.' };
      });
    }

    async function removeDraft(id) {
      const r = ready(); if (r) return r;
      if (!isUuid(id)) return refuse('Not removed: that is not a database invoice id.');
      if (role != null && !ROLES_MAY_DRAFT.has(role)) return refuse('Only staff, an administrator or the owner can remove a draft.');
      return once('remove:' + id, async function () {
        const res = await client.from(TABLE).delete().eq('id', id).eq('status', 'draft').select('id');
        if (res && res.error) return refuse(friendlyError(res.error));
        const n = Array.isArray(res && res.data) ? res.data.length : 0;
        if (n === 0) return refuse('Nothing removed: that invoice was not found, or it has been issued (issued and void invoices stay on the record).');
        return { ok: true, message: 'Draft removed.' };
      });
    }

    return { enabled: enabled, probe: probe, list: list, saveDraft: saveDraft, issue: issue, void: voidInvoice, removeDraft: removeDraft };
  }

  return {
    VERSION: VERSION, TABLE: TABLE, WRITE_COLUMNS: WRITE_COLUMNS, READ_COLUMNS: READ_COLUMNS, RPC: RPC, TERMS: TERMS,
    MAX_LINES: MAX_LINES, MAX_ADDRESS_BYTES: MAX_ADDRESS_BYTES, OFF_MESSAGE: OFF_MESSAGE,
    toRow: toRow, fromRow: fromRow, friendlyError: friendlyError, createStore: createStore,
  };
}));
