// Invoice storage adapter — the dashboard side of docs/ops/sql/drafts/32 (Nov 15).
//
// Saving, issuing and voiding are NOT CONNECTED to a screen yet. Payments
// (Nov 22) are connected to the "Invoice payments" section on Accounting, behind
// a switch that is not on the Feature Flags page and that does anything only
// once the database has drafts/32 installed (the owner has not installed it).
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
    'subtotal', 'order_discount', 'shipping', 'tax_rate', 'tax_rate_status', 'tax_place', 'tax_shipping', 'tax_exempt', 'tax_exempt_reason', 'tax', 'total'];
  const READ_COLUMNS = ['id'].concat(WRITE_COLUMNS, ['invoice_number', 'invoice_year', 'invoice_seq', 'issue_date', 'due_date',
    'issued_at', 'issued_by', 'voided_at', 'voided_by', 'void_reason', 'created_at', 'updated_at',
    'amount_paid', 'credit_approved', 'credit_approved_by', 'credit_approved_at']);
  const SELECT = READ_COLUMNS.join(',');
  // Payments (drafts/32, Nov 22): recorded and reversed only through the two
  // functions; the rows are never edited or deleted.
  const PAYMENT_TABLE = 'invoice_payments';
  const PAYMENT_COLUMNS = ['id', 'request_key', 'invoice_id', 'kind', 'amount', 'received_on', 'method', 'reference', 'note', 'reverses', 'recorded_by', 'recorded_at'];
  const PAYMENT_METHODS = ['check', 'ach', 'card', 'cash', 'wire', 'other'];
  const MAX_REFERENCE = 120, MAX_NOTE = 500, MIN_REVERSE_REASON = 5;
  const RPC = {
    issue: { name: 'issue_invoice', params: ['p_invoice_id', 'p_terms', 'p_credit_approved'] },
    void: { name: 'void_invoice', params: ['p_invoice_id', 'p_reason'] },
    pay: { name: 'record_invoice_payment', params: ['p_request_key', 'p_invoice_id', 'p_amount', 'p_received_on', 'p_method', 'p_reference', 'p_note'] },
    reverse: { name: 'reverse_invoice_payment', params: ['p_request_key', 'p_payment_id', 'p_reason'] },
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
    // Decision 1 (Nov 16): unknown tax is never stored as 0. Only an explicitly
    // CONFIRMED rate (with its place) or a documented EXEMPT order carries
    // figures; everything else is stored PENDING with no rate, tax or total.
    const taxExempt = draft.taxExempt === true || draft.taxRateStatus === 'EXEMPT';
    const taxRateStatus = taxExempt ? 'EXEMPT' : (draft.taxRateStatus === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING');
    const pending = taxRateStatus === 'PENDING';
    const tax = pending ? null : moneyField('tax', draft.tax, problems);
    const total = pending ? null : moneyField('total', draft.total, problems);
    let rate = null;
    if (taxExempt) rate = 0;
    else if (!pending) {
      rate = typeof draft.taxRate === 'number' ? draft.taxRate : NaN;
      if (!isFinite(rate) || rate < 0 || rate > MAX_TAX_RATE) problems.push('a confirmed tax rate must be between 0 and ' + (MAX_TAX_RATE * 100) + '%');
    }
    const taxPlace = draft.taxPlace == null ? null : String(draft.taxPlace).trim().slice(0, 200);
    const taxExemptReason = draft.taxExemptReason == null ? null : String(draft.taxExemptReason).trim().slice(0, 500);
    if (taxRateStatus === 'CONFIRMED' && !taxPlace) problems.push('a confirmed tax rate must say which place it is for');
    if (taxExempt && tax !== 0) problems.push('a resale-exempt invoice cannot carry tax');
    if (taxExempt && !(taxExemptReason && taxExemptReason.length >= 5)) problems.push('a resale-exempt invoice must record the verified exemption document');
    if (draft.terms != null && TERMS.indexOf(draft.terms) < 0) problems.push('unknown payment terms: ' + draft.terms);
    const lineSum = lines.reduce(function (s, l) { return s + cents(l.lineTotal); }, 0);
    if (srcLines && lineSum !== cents(subtotal)) problems.push('the lines do not add up to the subtotal');
    if (!pending) {
      const expectC = Math.max(0, cents(subtotal) - cents(orderDiscount)) + cents(tax) + cents(shipping);
      if (expectC !== cents(total)) problems.push('the total does not equal subtotal - discount + tax + shipping');
    }
    const currency = draft.currency == null ? 'USD' : String(draft.currency);
    if (!/^[A-Z]{3}$/.test(currency)) problems.push('the currency must be a three-letter code');
    const row = {
      order_id: draft.orderId == null ? null : draft.orderId, account_ref: accountRef,
      bill_to: addressField('bill-to', draft.billTo, problems), ship_to: addressField('ship-to', draft.shipTo, problems),
      status: 'draft', terms: draft.terms == null ? null : draft.terms, currency: currency, lines: lines,
      subtotal: subtotal, order_discount: orderDiscount, shipping: shipping,
      tax_rate: rate == null || !isFinite(rate) ? null : Math.round(rate * 100000) / 100000, tax_rate_status: taxRateStatus,
      tax_place: taxPlace || null, tax_shipping: !taxExempt && draft.taxShipping === true, tax_exempt: taxExempt,
      tax_exempt_reason: taxExempt ? taxExemptReason : null, tax: tax, total: total,
    };
    return problems.length ? { ok: false, row: null, problems: problems } : { ok: true, row: row, problems: [] };
  }

  // A stored row -> the engine's invoice shape, so the existing preview and
  // print views can show it. Marked as coming from storage, not simulated.
  function fromRow(row) {
    if (!isObj(row)) return null;
    const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
    const pending = (row.tax_rate_status || 'PENDING') === 'PENDING' || row.tax == null || row.total == null;
    const total = pending ? null : num(row.total);
    const beforeTax = Math.round((Math.max(0, num(row.subtotal) - num(row.order_discount)) + num(row.shipping)) * 100) / 100;
    return {
      id: row.id || null, status: row.status || null, number: row.invoice_number || null,
      orderId: row.order_id || null, accountId: row.account_ref || null,
      billTo: isObj(row.bill_to) ? row.bill_to : null, shipTo: isObj(row.ship_to) ? row.ship_to : null,
      terms: row.terms || null, issueDate: row.issue_date || null, dueDate: row.due_date || null,
      currency: row.currency || 'USD', lines: Array.isArray(row.lines) ? row.lines : [],
      subtotal: num(row.subtotal), orderDiscount: num(row.order_discount), shipping: num(row.shipping),
      taxRate: pending ? null : num(row.tax_rate), taxRateStatus: pending ? 'PENDING' : row.tax_rate_status,
      taxPlace: row.tax_place || null, taxExemptReason: row.tax_exempt_reason || null,
      taxShipping: row.tax_shipping === true, taxExempt: row.tax_exempt === true, tax: pending ? null : num(row.tax), total: total,
      taxPending: pending, totalBeforeTax: beforeTax,
      voidReason: row.void_reason || null, issuedAt: row.issued_at || null, voidedAt: row.voided_at || null,
      paid: num(row.amount_paid), balance: total == null ? null : Math.round((total - num(row.amount_paid)) * 100) / 100,
      creditApproved: row.credit_approved === true, payments: [], versions: [], corrections: [], revisions: [],
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

  // Stored payment rows -> what the screen shows: each payment with whether (and
  // why) it was reversed; reversals are not listed on their own.
  function paymentsView(rows) {
    const list = (Array.isArray(rows) ? rows : []).filter(isObj);
    const reversalOf = {};
    list.forEach(function (x) { if (x.kind === 'reversal' && x.reverses) reversalOf[x.reverses] = x; });
    return list.filter(function (x) { return x.kind === 'payment'; }).map(function (x) {
      const rv = reversalOf[x.id] || null;
      return { id: x.id, amount: Number(x.amount) || 0, receivedOn: x.received_on || null, method: x.method || null, reference: x.reference || null,
        note: x.note || null, recordedBy: x.recorded_by || null, recordedAt: x.recorded_at || null,
        reversed: !!rv, reversal: rv ? { reason: rv.note || null, recordedBy: rv.recorded_by || null, recordedAt: rv.recorded_at || null } : null };
    });
  }

  // A payment or reversal sent with a request key whose reply never came back:
  // the database may or may not have recorded it, and pressing again is safe.
  function keyedError(err, what) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message) : '';
    if (!code && /fetch|network|timeout|failed|aborted/i.test(msg)) {
      return 'Could not reach the database, so the page cannot tell whether the ' + what + ' was recorded. Press the button again: it is recorded at most once.';
    }
    return friendlyError(err);
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

    // ---- payments (owner or administrator; the database checks again) ----
    async function listPayments(invoiceId) {
      const r = ready(); if (r) return r;
      if (!isUuid(invoiceId)) return refuse('That is not a database invoice id.');
      if (role != null && !ROLES_MAY_ISSUE.has(role)) return refuse('Payments are visible to the owner and administrators only.', { forbidden: true });
      return once('payments:' + invoiceId, async function () {
        const res = await client.from(PAYMENT_TABLE).select(PAYMENT_COLUMNS.join(',')).eq('invoice_id', invoiceId).order('recorded_at', { ascending: true }).limit(MAX_LIST);
        if (res && res.error) return refuse(friendlyError(res.error));
        const rows = Array.isArray(res && res.data) ? res.data : [];
        return { ok: true, payments: paymentsView(rows) };
      });
    }

    // p: { requestKey, invoiceId, amount, receivedOn (YYYY-MM-DD), method, reference, note, balance? }
    async function recordPayment(p) {
      const r = ready(); if (r) return r;
      const q = isObj(p) ? p : {};
      if (role != null && !ROLES_MAY_ISSUE.has(role)) return refuse('Only the owner or an administrator can record payments.');
      if (!isUuid(q.requestKey)) return refuse('The page gave this payment no request key, so a retry could not be recognised. Nothing was recorded.');
      if (!isUuid(q.invoiceId)) return refuse('Not recorded: that is not a database invoice id.');
      const raw = typeof q.amount === 'string' ? q.amount.trim().replace(/^\$/, '').replace(/,/g, '') : q.amount;
      const amount = typeof raw === 'string' ? (/^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw) : NaN) : Number(raw);
      if (!isFinite(amount) || amount <= 0) return refuse('Enter the amount received in dollars and cents, more than $0.00 (for example 125.50).');
      if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return refuse('Enter the amount in dollars and cents (for example 125.50).');
      if (q.balance != null && isFinite(Number(q.balance)) && cents(amount) > cents(q.balance)) return refuse('That is more than is still owed ($' + money(cents(q.balance)).toFixed(2) + '). Nothing was recorded.');
      const day = q.receivedOn == null || q.receivedOn === '' ? null : String(q.receivedOn);
      if (day != null && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return refuse('Enter the date received as a date.');
      const method = q.method == null || q.method === '' ? null : String(q.method);
      if (method != null && PAYMENT_METHODS.indexOf(method) < 0) return refuse('Choose how it was paid from the list.');
      const ref = q.reference == null ? '' : String(q.reference).trim();
      if (ref.length > MAX_REFERENCE) return refuse('The reference is too long (at most ' + MAX_REFERENCE + ' characters).');
      const note = q.note == null ? '' : String(q.note).trim();
      if (note.length > MAX_NOTE) return refuse('The note is too long (at most ' + MAX_NOTE + ' characters).');
      return once('pay:' + q.invoiceId, async function () {
        const v = [q.requestKey, q.invoiceId, money(cents(amount)), day, method, ref || null, note || null];
        const args = {}; RPC.pay.params.forEach(function (k, i) { args[k] = v[i]; });
        const res = await client.rpc(RPC.pay.name, args);
        if (res && res.error) return refuse(keyedError(res.error, 'payment'), { retry: true });
        const d = isObj(res && res.data) ? res.data : {};
        return { ok: true, duplicate: d.duplicate === true, paymentId: d.payment_id || null, status: d.status || null, amountPaid: d.amount_paid == null ? null : Number(d.amount_paid),
          message: d.duplicate === true ? 'Already recorded. Nothing changed.' : 'Payment of $' + money(cents(amount)).toFixed(2) + ' recorded.' };
      });
    }

    // p: { requestKey, paymentId, reason }
    async function reversePayment(p) {
      const r = ready(); if (r) return r;
      const q = isObj(p) ? p : {};
      if (role != null && !ROLES_MAY_ISSUE.has(role)) return refuse('Only the owner or an administrator can reverse a payment.');
      if (!isUuid(q.requestKey)) return refuse('The page gave this reversal no request key, so a retry could not be recognised. Nothing was changed.');
      if (!isUuid(q.paymentId)) return refuse('Not reversed: that is not a recorded payment.');
      const why = q.reason == null ? '' : String(q.reason).trim();
      if (why.length < MIN_REVERSE_REASON) return refuse('A written reason is required to reverse a payment (at least ' + MIN_REVERSE_REASON + ' characters).');
      if (why.length > MAX_NOTE) return refuse('The reason is too long (at most ' + MAX_NOTE + ' characters).');
      return once('reverse:' + q.paymentId, async function () {
        const v = [q.requestKey, q.paymentId, why];
        const args = {}; RPC.reverse.params.forEach(function (k, i) { args[k] = v[i]; });
        const res = await client.rpc(RPC.reverse.name, args);
        if (res && res.error) return refuse(keyedError(res.error, 'reversal'), { retry: true });
        const d = isObj(res && res.data) ? res.data : {};
        return { ok: true, duplicate: d.duplicate === true, status: d.status || null, amountPaid: d.amount_paid == null ? null : Number(d.amount_paid),
          message: d.duplicate === true ? 'Already reversed. Nothing changed.' : 'Payment reversed. The original stays on the record.' };
      });
    }

    return { enabled: enabled, probe: probe, list: list, saveDraft: saveDraft, issue: issue, void: voidInvoice, removeDraft: removeDraft,
      listPayments: listPayments, recordPayment: recordPayment, reversePayment: reversePayment };
  }

  return {
    VERSION: VERSION, TABLE: TABLE, WRITE_COLUMNS: WRITE_COLUMNS, READ_COLUMNS: READ_COLUMNS, RPC: RPC, TERMS: TERMS,
    PAYMENT_TABLE: PAYMENT_TABLE, PAYMENT_COLUMNS: PAYMENT_COLUMNS, PAYMENT_METHODS: PAYMENT_METHODS, paymentsView: paymentsView,
    MAX_LINES: MAX_LINES, MAX_ADDRESS_BYTES: MAX_ADDRESS_BYTES, OFF_MESSAGE: OFF_MESSAGE,
    toRow: toRow, fromRow: fromRow, friendlyError: friendlyError, createStore: createStore,
  };
}));
