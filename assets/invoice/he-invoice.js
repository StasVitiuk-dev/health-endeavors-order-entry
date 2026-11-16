// Invoices & packing slips — DETERMINISTIC model (Phase 2 item 10, local/synthetic).
//
// Pure: no DOM, no network, no money movement, no sending. Dual-mode. Reuses the
// production invoice CONTRACT shape (an `invoices` row written by Agent #1) but
// never writes to it — this is a draft/preview/print model only. Issued invoices
// are immutable snapshots with a version history; drafts are editable. All
// amounts are integer cents internally to avoid float drift, surfaced as numbers.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.invoice = root.HE.invoice || {})['he-invoice'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATES = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void'];
  const ROLES_MAY_ISSUE = new Set(['owner', 'administrator']);

  const cents = (v) => Math.round((Number(v) || 0) * 100);
  const money = (c) => Math.round(c) / 100;

  // Compute totals from line items + adjustments. Everything in cents, then
  // rounded once. tax is applied to the taxable subtotal after discount.
  // Owner decisions (Nov 14, tightened Nov 16): shipping joins the tax base only
  // when taxShipping is true (bundled / mandatory shipping); a resale-exempt
  // order (taxExempt, status EXEMPT) carries tax 0 and says why; and UNKNOWN TAX
  // IS NEVER SHOWN AS 0. When the status is PENDING, or no rate was supplied at
  // all, tax, taxRate and total are null and totalBeforeTax carries what is
  // known. A caller that really means "no tax" passes taxRate: 0.
  function computeTotals(input) {
    const i = input || {};
    const lines = i.lines || [];
    let subtotalC = 0;
    const lineOut = lines.map(function (ln) {
      const qty = Number(ln.quantity) || 0;
      const unitC = cents(ln.unitPrice);
      const discC = cents(ln.discount);        // per-line absolute discount
      const lineC = Math.max(0, qty * unitC - discC);
      subtotalC += lineC;
      return { sku: ln.sku || null, description: ln.description || '', quantity: qty, unitPrice: money(unitC), discount: money(discC), lineTotal: money(lineC), lotNumber: ln.lotNumber || null };
    });
    const orderDiscC = cents(i.orderDiscount);
    const shippingC = cents(i.shipping);
    const taxableC = Math.max(0, subtotalC - orderDiscC);
    const statusIn = i.taxRateStatus != null ? String(i.taxRateStatus) : null;
    const taxShipping = i.taxShipping === true;
    const taxExempt = i.taxExempt === true || statusIn === 'EXEMPT';
    const rateKnown = i.taxRate != null && i.taxRate !== '' && isFinite(Number(i.taxRate)) && Number(i.taxRate) >= 0;
    const pending = !taxExempt && (statusIn === 'PENDING' || !rateKnown);
    const taxRate = taxExempt ? 0 : (pending ? null : Number(i.taxRate));    // e.g. 0.08
    const beforeTaxC = Math.max(0, taxableC + shippingC);
    const taxBaseC = taxExempt ? 0 : taxableC + (taxShipping ? shippingC : 0);
    const taxC = pending ? null : Math.round(taxBaseC * taxRate);
    const totalC = pending ? null : beforeTaxC + taxC;
    const out = {
      lines: lineOut, currency: i.currency || 'USD',
      subtotal: money(subtotalC), orderDiscount: money(orderDiscC), shipping: money(shippingC),
      taxRate: taxRate, tax: pending ? null : money(taxC), total: pending ? null : money(totalC), _totalC: totalC,
    };
    // Only present when the tax decision fields were supplied or the tax is
    // pending, so totals built the earlier way keep exactly the earlier shape.
    if (taxShipping || taxExempt || statusIn != null || pending) {
      out.taxBase = pending ? null : money(taxBaseC); out.taxShipping = taxShipping; out.taxExempt = taxExempt;
      out.taxRateStatus = taxExempt ? 'EXEMPT' : (pending ? 'PENDING' : (statusIn != null ? statusIn : null));
      out.taxPending = pending; out.totalBeforeTax = money(beforeTaxC);
    }
    return out;
  }

  const TAX_NOTES = ['taxPlace', 'taxExemptReason', 'taxPendingReasons'];
  // A DRAFT invoice (editable). Linked to a store account + order when supplied.
  function draftInvoice(input) {
    const i = input || {};
    const t = computeTotals(i);
    const taxFields = t.taxRateStatus !== undefined ? { taxBase: t.taxBase, taxShipping: t.taxShipping, taxExempt: t.taxExempt, taxRateStatus: t.taxRateStatus, taxPending: t.taxPending, totalBeforeTax: t.totalBeforeTax } : {};
    const taxInput = t.taxRateStatus !== undefined ? { taxShipping: t.taxShipping, taxExempt: t.taxExempt, taxRateStatus: t.taxRateStatus } : {};
    // What the tax decision was based on travels with the draft (shown to the
    // reviewer and printed): the place the rate is for, why it is exempt, or
    // what is still missing.
    TAX_NOTES.forEach(function (k) { if (i[k] != null) { taxFields[k] = i[k]; taxInput[k] = i[k]; } });
    return Object.assign({
      status: 'draft', number: null, accountId: i.accountId || null, orderId: i.orderId || null,
      billTo: i.billTo || null, shipTo: i.shipTo || null, terms: i.terms || null, issueDate: null, dueDate: null,
      currency: t.currency, lines: t.lines, subtotal: t.subtotal, orderDiscount: t.orderDiscount,
      shipping: t.shipping, taxRate: t.taxRate, tax: t.tax, total: t.total,
      // _input keeps the raw adjustment fields so a later revision recomputes
      // from the same basis; it is internal (never surfaced as money).
      _input: Object.assign({ orderDiscount: i.orderDiscount || 0, shipping: i.shipping || 0, taxRate: i.taxRate != null ? i.taxRate : null, currency: t.currency }, taxInput),
      paid: 0, balance: t.total, payments: [], versions: [], corrections: [], revisions: [],
      synthetic: true, label: 'SIMULATED',
    }, taxFields);
  }

  // Edit a DRAFT, preserving history: each revision snapshots the PRIOR totals
  // and lines before recomputing, so the change trail is never lost. Only a
  // draft can be revised (an issued invoice is corrected via void + reissue).
  // Pure: returns a new draft; the input is not mutated.
  function reviseDraft(draft, patch, opts) {
    if (!draft || draft.status !== 'draft') return { ok: false, reason: 'only a draft can be edited (status ' + (draft && draft.status) + ')', invoice: draft };
    const o = opts || {}; const p = patch || {};
    const prevInput = draft._input || {};
    const next = {
      lines: p.lines != null ? p.lines : draft.lines,
      orderDiscount: p.orderDiscount != null ? p.orderDiscount : prevInput.orderDiscount,
      shipping: p.shipping != null ? p.shipping : prevInput.shipping,
      taxRate: p.taxRate != null ? p.taxRate : prevInput.taxRate,
      currency: p.currency != null ? p.currency : draft.currency,
    };
    // The tax decision fields travel with the draft; a revision keeps them
    // unless the patch changes them (e.g. the owner confirms the local rate).
    ['taxShipping', 'taxExempt', 'taxRateStatus'].concat(TAX_NOTES).forEach(function (k) {
      const v = p[k] != null ? p[k] : prevInput[k];
      if (v != null) next[k] = v;
    });
    // Everything a draft is linked to survives a revision.
    ['accountId', 'orderId', 'billTo', 'shipTo', 'terms'].forEach(function (k) { if (draft[k] != null) next[k] = draft[k]; });
    const revised = draftInvoice(next);
    if (draft.orderNumber != null) revised.orderNumber = draft.orderNumber;
    const snapshot = { subtotal: draft.subtotal, orderDiscount: draft.orderDiscount, shipping: draft.shipping, tax: draft.tax, total: draft.total, lines: draft.lines };
    revised.revisions = draft.revisions.concat([{ revision: draft.revisions.length + 1, at: o.now || null, by: o.actor || null, reason: o.reason || null, was: snapshot }]);
    return { ok: true, invoice: revised };
  }

  // PROPOSED default invoice numbering (owner can change prefix / width / reset).
  // Format HE-YYYY-NNNN: a per-year, zero-padded, gap-free sequence. Pure — it
  // only SUGGESTS the next number from the numbers already used; it issues
  // nothing. The owner confirms the scheme (and terms/tax) before any real issue.
  function nextInvoiceNumber(opts) {
    const o = opts || {};
    const prefix = String(o.prefix || 'HE');
    const year = Number(o.year) || new Date().getFullYear();
    const width = Number(o.width) || 4;
    const seen = o.existingNumbers instanceof Set ? o.existingNumbers : new Set(o.existingNumbers || []);
    // Match "<prefix>-<year>-<digits>" by plain string comparison (no pattern is
    // built at run time, so nothing user-supplied can shape a regular expression).
    const head = prefix + '-' + year + '-';
    let max = 0;
    seen.forEach(function (n) {
      const str = String(n);
      if (str.indexOf(head) !== 0) return;
      const tail = str.slice(head.length);
      if (!/^[0-9]{1,12}$/.test(tail)) return;
      const v = parseInt(tail, 10); if (v > max) max = v;
    });
    const sequence = max + 1;
    const padded = String(sequence); const pad = padded.length >= width ? padded : ('0'.repeat(width - padded.length) + padded);
    return { number: prefix + '-' + year + '-' + pad, sequence: sequence, year: year, prefix: prefix, format: prefix + '-YYYY-' + '0'.repeat(width), proposed: true };
  }

  // Collision-safe number sequence (DRAFT model). In production a durable store
  // (a DB sequence / RPC) would atomically hand out the next number so two issues
  // can never grab the same one. This in-memory model mirrors that shape —
  // reserve() claims the next number (counting both committed and in-flight
  // reservations), commit() records a reservation as used, release() frees an
  // abandoned one — and names the missing production write contract.
  const MISSING_SEQUENCE_CONTRACT = 'invoice_number_sequence (atomic reserve+commit RPC) — a durable last-number store; not in the local build (this model is in-memory only).';
  function createNumberSequence(initial) {
    const i = initial || {};
    const used = new Set(i.used || []);
    const reserving = new Set();
    return {
      // Claim the next number without colliding with committed OR in-flight ones.
      reserve: function (opts) {
        const combined = new Set(used); reserving.forEach(function (n) { combined.add(n); });
        const s = nextInvoiceNumber(Object.assign({}, opts || {}, { existingNumbers: combined }));
        reserving.add(s.number);
        return { number: s.number, token: s.number, sequence: s.sequence };
      },
      // Finalize a reservation as used. Idempotent-safe: a double-commit of the
      // same token (a retry) does not advance anything.
      commit: function (token) {
        if (reserving.has(token)) { reserving.delete(token); used.add(token); return { ok: true, number: token }; }
        if (used.has(token)) return { ok: false, duplicate: true, reason: 'already committed', number: token };
        return { ok: false, reason: 'no such reservation', number: token };
      },
      release: function (token) { const had = reserving.delete(token); return { ok: had }; },
      used: function () { return Array.from(used); },
      pending: function () { return Array.from(reserving); },
      contract: MISSING_SEQUENCE_CONTRACT,
    };
  }

  // Issue a draft: assigns a unique number (caller supplies from a sequence),
  // stamps dates, snapshots an immutable issued version, and blocks duplicates.
  // role gates who may issue. existingNumbers guards against a reused number.
  function issue(draft, opts) {
    const o = opts || {};
    if (!ROLES_MAY_ISSUE.has(o.role)) return { ok: false, reason: 'only an owner or administrator may issue an invoice', invoice: draft };
    if (draft.status !== 'draft') return { ok: false, reason: 'only a draft can be issued (already ' + draft.status + ')', invoice: draft };
    const number = String(o.number || '').trim();
    if (!number) return { ok: false, reason: 'an invoice number is required', invoice: draft };
    const seen = o.existingNumbers instanceof Set ? o.existingNumbers : new Set(o.existingNumbers || []);
    if (seen.has(number)) return { ok: false, reason: 'invoice number already used (duplicate blocked): ' + number, invoice: draft };
    // Owner decision #1: the live tax rate stays pending until the local rate
    // and sourcing rule are confirmed, so a draft still carrying a PENDING rate
    // cannot become an official invoice.
    if (draft.taxRateStatus === 'PENDING' || draft.taxPending === true || draft.tax == null || draft.total == null) return { ok: false, reason: 'the tax on this draft is still pending — it cannot be issued until the tax is confirmed', invoice: draft, pendingTax: true };
    // Owner decision #2: payment terms. When the caller names the account (or
    // the terms), the due date follows from the terms: due on receipt unless the
    // account is approved for Net 14. An explicit dueDate still wins. With
    // neither, behaviour is as before (no terms, due date as supplied).
    let terms = draft.terms || null; let dueDate = o.dueDate || null;
    if (o.terms != null || o.account != null) {
      terms = o.terms != null ? String(o.terms) : termsForAccount(o.account);
      if (PAYMENT_TERMS.indexOf(terms) < 0) return { ok: false, reason: 'unknown payment terms: ' + terms, invoice: draft };
      if (terms === 'NET_14' && !(o.account != null && o.account.creditApproved === true)) return { ok: false, reason: 'Net 14 needs an account the owner has approved for credit', invoice: draft };
      // The due date counts from the BUSINESS day of issue (owner decision #4:
      // midnight Central), not the UTC date — an invoice issued at 10 pm Central
      // is issued "today", not tomorrow. The caller may pass issueDay directly.
      if (!dueDate) dueDate = dueDateFor(o.issueDay || businessDay(o.now, o.timeZone), terms);
    }
    const snapshot = JSON.parse(JSON.stringify({ lines: draft.lines, subtotal: draft.subtotal, tax: draft.tax, total: draft.total, currency: draft.currency }));
    const issued = Object.assign({}, draft, {
      status: 'issued', number: number, issueDate: o.now || null, dueDate: dueDate, terms: terms,
      balance: draft.total, paid: 0,
      versions: draft.versions.concat([{ version: draft.versions.length + 1, issuedAt: o.now || null, by: o.actor || o.role, snapshot: snapshot }]),
    });
    return { ok: true, invoice: issued, number: number };
  }

  // Record a (simulated) payment. Never moves money — just represents balance.
  // Over-payment is refused; a dedup key stops a double-apply of the same payment.
  function applyPayment(invoice, payment) {
    const p = payment || {};
    if (!invoice || typeof invoice !== 'object') return { ok: false, reason: 'no invoice', invoice: invoice || null };
    if (invoice.status === 'void') return { ok: false, reason: 'cannot pay a void invoice', invoice: invoice };
    if (invoice.status === 'draft') return { ok: false, reason: 'issue the invoice before recording a payment', invoice: invoice };
    const amtC = cents(p.amount);
    if (amtC <= 0) return { ok: false, reason: 'payment must be positive', invoice: invoice };
    const key = String(p.key || '');
    if (key && invoice.payments.some(function (x) { return x.key === key; })) return { ok: false, reason: 'duplicate payment ignored', invoice: invoice, duplicate: true };
    const paidC = cents(invoice.paid) + amtC;
    const totalC = cents(invoice.total);
    if (paidC > totalC) return { ok: false, reason: 'payment exceeds the balance', invoice: invoice };
    const payments = invoice.payments.concat([{ amount: money(amtC), at: p.at || null, key: key || null }]);
    const balanceC = totalC - paidC;
    const status = balanceC === 0 ? 'paid' : 'partially_paid';
    return { ok: true, invoice: Object.assign({}, invoice, { paid: money(paidC), balance: money(balanceC), payments: payments, status: status }) };
  }

  function voidInvoice(invoice, opts) {
    const o = opts || {};
    if (!ROLES_MAY_ISSUE.has(o.role)) return { ok: false, reason: 'only an owner or administrator may void', invoice: invoice };
    if (invoice.status === 'paid') return { ok: false, reason: 'a paid invoice cannot be voided (issue a credit note)', invoice: invoice };
    const corrections = invoice.corrections.concat([{ action: 'void', at: o.now || null, by: o.actor || o.role, reason: o.reason || null }]);
    return { ok: true, invoice: Object.assign({}, invoice, { status: 'void', corrections: corrections }) };
  }

  // Mark overdue if past due and not fully paid (read-only derivation).
  function withOverdue(invoice, nowISO) {
    if (!invoice || typeof invoice !== 'object') return invoice;
    if (!invoice.dueDate || invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'draft') return invoice;
    const overdue = +new Date(nowISO || Date.now()) > +new Date(invoice.dueDate) && cents(invoice.balance) > 0;
    return overdue ? Object.assign({}, invoice, { status: 'overdue' }) : invoice;
  }

  // Packing slip for a shipment: shipment-allocated LOT numbers per line, prices
  // OPTIONAL (hidden by default). Distinct from an invoice and from a carrier
  // label. Never a payment document.
  function packingSlip(input) {
    const i = input || {};
    const showPrices = i.showPrices === true;
    const lines = (i.allocations || []).map(function (a) {
      const base = { sku: a.sku || null, description: a.description || '', quantity: Number(a.quantity) || 0, lotNumber: a.lotNumber || null };
      if (showPrices) base.unitPrice = money(cents(a.unitPrice));
      return base;
    });
    return {
      kind: 'packing_slip', orderId: i.orderId || null, shipmentId: i.shipmentId || null,
      shipTo: i.shipTo || null, showPrices: showPrices, lines: lines,
      note: 'Packing slip — not an invoice and not a carrier label.', synthetic: true,
    };
  }

  // A credit note against an already-issued invoice (the proper way to reverse a
  // PAID invoice, which cannot be voided). Owner/administrator only. It REFERENCES
  // the invoice and never mutates it; amount defaults to the full total and a
  // partial credit is allowed up to the total. Synthetic — no money moves.
  function creditNote(invoice, opts) {
    const o = opts || {};
    if (!ROLES_MAY_ISSUE.has(o.role)) return { ok: false, reason: 'only an owner or administrator may issue a credit note' };
    const st = invoice && invoice.status;
    if (['issued', 'partially_paid', 'paid', 'overdue'].indexOf(st) === -1) return { ok: false, reason: 'a credit note applies to an issued invoice (status ' + st + ')' };
    const totalC = cents(invoice.total);
    const amountC = o.amount == null ? totalC : cents(o.amount);
    if (amountC <= 0) return { ok: false, reason: 'credit amount must be positive' };
    if (amountC > totalC) return { ok: false, reason: 'credit cannot exceed the invoice total' };
    return {
      ok: true,
      creditNote: {
        kind: 'credit_note', number: o.number || null, invoiceNumber: invoice.number || null,
        amount: money(amountC), currency: invoice.currency || 'USD', full: amountC === totalC,
        reason: o.reason || null, issuedBy: o.actor || o.role, issuedAt: o.now || null,
        synthetic: true, label: 'SIMULATED',
        note: 'Credit note — references the invoice; it does not modify or re-open it, and moves no money.',
      },
    };
  }

  // US-Letter print MODELS (not rendered PDFs). They paginate line items across
  // pages, repeat the column headings on every page, and put totals on the last
  // page only. A renderer consumes this; this module writes no file.
  const US_LETTER = Object.freeze({ page: 'us-letter', widthPx: 816, heightPx: 1056, marginPx: 48, rowsPerPage: 22 });
  function paginate(items, perPage) {
    // A page size that is not a whole number above zero would never advance the
    // loop below (it hung the page), so anything else falls back to the default.
    const per = (Number.isInteger(perPage) && perPage > 0) ? perPage : US_LETTER.rowsPerPage; const pages = [];
    const list = Array.isArray(items) ? items : [];
    for (let i = 0; i < list.length; i += per) pages.push(list.slice(i, i + per));
    if (!pages.length) pages.push([]);
    return pages;
  }
  // Invoice header block for print/preview. Business name defaults to the known
  // store name; address + remit are PLACEHOLDERS the owner fills in — never
  // invented. `placeholder` is true until every field has been supplied.
  const BUSINESS_HEADER = Object.freeze({
    businessName: 'Health Endeavors',
    addressLines: Object.freeze(['[Business address — owner to confirm]']),
    remitTo: '[Remit-to / payment instructions — owner to confirm]',
  });
  function invoiceHeader(opts) {
    const o = opts || {};
    const businessName = o.businessName || BUSINESS_HEADER.businessName;
    const addressLines = o.addressLines || BUSINESS_HEADER.addressLines.slice();
    const remitTo = o.remitTo || BUSINESS_HEADER.remitTo;
    return {
      businessName: businessName, addressLines: addressLines, remitTo: remitTo,
      billTo: o.billTo || null, number: o.number || null,
      issueDate: o.issueDate || null, dueDate: o.dueDate || null,
      placeholder: !(o.businessName && o.addressLines && o.remitTo),
    };
  }

  // Tax is pending when the draft says so, or when it carries no tax figure.
  function taxIsPending(inv) {
    const v = inv || {};
    return v.taxRateStatus === 'PENDING' || v.taxPending === true || v.tax == null || v.total == null;
  }
  // The totals block, line by line, as shown on screen and on paper. An amount
  // of null is printed as its `text` (never as 0.00).
  function totalsLines(inv) {
    const v = inv || {}; const out = [];
    const pct = function (r) { return (Math.round(Number(r) * 100000) / 1000) + '%'; };
    out.push({ key: 'subtotal', label: 'Subtotal', amount: v.subtotal == null ? null : v.subtotal });
    if (Number(v.orderDiscount) > 0) out.push({ key: 'discount', label: 'Order discount', amount: -Number(v.orderDiscount) });
    out.push({ key: 'shipping', label: 'Shipping', amount: v.shipping == null ? 0 : v.shipping });
    if (v.taxExempt === true || v.taxRateStatus === 'EXEMPT') {
      out.push({ key: 'tax', label: 'Tax', amount: 0, text: v.taxExemptReason || 'resale exempt' });
      out.push({ key: 'total', label: 'Total', amount: v.total });
    } else if (taxIsPending(v)) {
      const why = Array.isArray(v.taxPendingReasons) && v.taxPendingReasons.length ? v.taxPendingReasons.join('; ') : 'not confirmed yet';
      out.push({ key: 'tax', label: 'Tax', amount: null, text: 'PENDING — ' + why });
      out.push({ key: 'totalBeforeTax', label: 'Total before tax', amount: v.totalBeforeTax != null ? v.totalBeforeTax : null });
      out.push({ key: 'total', label: 'Total', amount: null, text: 'PENDING — tax not confirmed' });
    } else {
      out.push({ key: 'tax', label: 'Tax (' + pct(v.taxRate) + (v.taxPlace ? ', ' + v.taxPlace : '') + (v.taxShipping ? ', shipping taxed' : '') + ')', amount: v.tax });
      out.push({ key: 'total', label: 'Total', amount: v.total });
    }
    return out;
  }
  function invoicePrint(invoice, opts) {
    const inv = invoice || {}; const o = opts || {};
    const per = o.rowsPerPage || US_LETTER.rowsPerPage;
    const pages = paginate(inv.lines, per);
    const headings = ['Item', 'Qty', 'Unit', 'Disc', 'Line'];
    return {
      kind: 'invoice_print', label: 'SIMULATED', renderedPdf: false, page: US_LETTER,
      header: invoiceHeader({ number: inv.number, issueDate: inv.issueDate, dueDate: inv.dueDate, billTo: inv.billTo, businessName: o.businessName, addressLines: o.addressLines, remitTo: o.remitTo }),
      number: inv.number || null, status: inv.status || 'draft',
      pageCount: pages.length,
      pages: pages.map(function (rows, i) {
        return { pageNo: i + 1, totalPages: pages.length, headings: headings, repeatHeadings: true, rows: rows, showTotals: i === pages.length - 1 };
      }),
      totals: { subtotal: inv.subtotal, orderDiscount: inv.orderDiscount, shipping: inv.shipping, tax: inv.tax, total: inv.total, currency: inv.currency || 'USD' },
      totalsLines: totalsLines(inv),
      taxPending: taxIsPending(inv),
      // A draft, and above all a draft whose tax is pending, must never be
      // mistaken for a final invoice on paper.
      watermark: inv.status === 'void' ? 'VOID' : (taxIsPending(inv) ? 'DRAFT — TAX PENDING, NOT A FINAL INVOICE' : (!inv.status || inv.status === 'draft' ? 'DRAFT — NOT ISSUED' : null)),
      billTo: inv.billTo || null, shipTo: inv.shipTo || null, terms: inv.terms || null, issueDate: inv.issueDate || null, dueDate: inv.dueDate || null,
      note: 'Invoice print model only — not a rendered PDF and nothing is sent.',
    };
  }
  function packingSlipPrint(slip, opts) {
    const s = slip || {}; const o = opts || {};
    const per = o.rowsPerPage || (US_LETTER.rowsPerPage + 4); // no totals block, a few more rows fit
    const pages = paginate(s.lines, per);
    const headings = s.showPrices ? ['Item', 'Qty', 'Lot', 'Unit'] : ['Item', 'Qty', 'Lot'];
    return {
      kind: 'packing_slip_print', label: 'SIMULATED', renderedPdf: false, page: US_LETTER,
      showPrices: s.showPrices === true, pageCount: pages.length,
      pages: pages.map(function (rows, i) {
        return { pageNo: i + 1, totalPages: pages.length, headings: headings, repeatHeadings: true, rows: rows };
      }),
      note: 'Packing slip — not an invoice and not a carrier label.',
    };
  }

  // Owner decision #3 — "generate drafts automatically; the owner reviews and
  // issues them by hand". Builds a DRAFT invoice from an order and its lines
  // (shapes as in the orders / order_items tables). It never issues, never
  // assigns a number and never changes the order. Anything about the order that
  // does not add up is listed in `checks` for the reviewer instead of being
  // silently corrected.
  //   order: { id, order_number, currency, shipping_total, total, status, deleted_at }
  //   items: [{ sku, product_name, quantity, unit_price, line_total }]
  //   opts:  { account:{ id, creditApproved }, taxFields (from he-tax.invoiceTaxFields) }
  function draftFromOrder(order, items, opts) {
    const o = opts || {}; const ord = order || {};
    const status = String(ord.status || '').toLowerCase();
    if (!ord.id) return { ok: false, reason: 'the order has no id' };
    if (ord.deleted_at) return { ok: false, reason: 'the order was deleted' };
    if (status.indexOf('cancel') !== -1) return { ok: false, reason: 'the order was cancelled' };
    if (status.indexOf('refund') !== -1 && status.indexOf('partial') === -1) return { ok: false, reason: 'the order was fully refunded' };
    const rows = (items || []).filter(function (it) { return it && Number(it.quantity) > 0; });
    if (!rows.length) return { ok: false, reason: 'the order has no lines to invoice' };
    const checks = [];
    const lines = rows.map(function (it, idx) {
      const qty = Number(it.quantity);
      const label = it.sku || it.product_name || ('line ' + (idx + 1));
      if (it.unit_price == null || !isFinite(Number(it.unit_price))) { checks.push(label + ': no unit price on the order line — set it before issuing'); return { sku: it.sku || null, description: it.product_name || '', quantity: qty, unitPrice: 0, discount: 0 }; }
      const grossC = qty * cents(it.unit_price);
      let discC = 0;
      if (it.line_total != null && isFinite(Number(it.line_total))) {
        const lineC = cents(it.line_total);
        if (lineC < grossC) discC = grossC - lineC;                       // the order line carried a discount
        else if (lineC > grossC) checks.push(label + ': the order line total is more than quantity x price — check the line');
      }
      return { sku: it.sku || null, description: it.product_name || '', quantity: qty, unitPrice: money(cents(it.unit_price)), discount: money(discC) };
    });
    const acct = o.account || null;
    const tf = o.taxFields || null;
    const input = { lines: lines, shipping: ord.shipping_total || 0, currency: ord.currency || 'USD',
      accountId: acct && acct.id != null ? acct.id : null, orderId: ord.id, terms: termsForAccount(acct) };
    if (tf) {
      input.taxRate = tf.taxRate; input.taxRateStatus = tf.taxRateStatus; input.taxShipping = tf.taxShipping; input.taxExempt = tf.taxExempt;
      if (tf.taxPlace != null) input.taxPlace = tf.taxPlace;
      if (tf.taxExemptReason != null) input.taxExemptReason = tf.taxExemptReason;
      if (Array.isArray(tf.pendingReasons) && tf.pendingReasons.length) input.taxPendingReasons = tf.pendingReasons.slice();
    } else {
      // No tax rule at all: the tax is unknown, so it is pending — never 0.
      input.taxRate = null; input.taxRateStatus = 'PENDING'; input.taxPendingReasons = ['no tax rule was supplied for this order'];
    }
    const draft = draftInvoice(input);
    draft.orderNumber = ord.order_number || null;
    if (draft.taxRateStatus === 'PENDING') checks.push(PENDING_TAX_CHECK);
    if (tf && tf.needsCertificate) checks.push(tf.certificateProblem || 'resale was claimed but no verified exemption document is on file — taxed like any other order');
    // The order's own stored total is compared before tax (the order may have been
    // taxed under a different rule); a difference is reported, never "fixed".
    if (ord.subtotal != null && isFinite(Number(ord.subtotal)) && cents(ord.subtotal) !== cents(draft.subtotal)) {
      checks.push('the order subtotal (' + money(cents(ord.subtotal)).toFixed(2) + ') differs from the lines (' + Number(draft.subtotal).toFixed(2) + ')');
    }
    return { ok: true, draft: draft, checks: checks, needsReview: checks.length > 0 };
  }

  // One draft per order, and only for orders that do not already have an
  // invoice or a draft. Running it again creates nothing new (idempotent).
  //   existing: invoices/drafts already made ({ orderId, status }); a VOID
  //   invoice does not count, so a voided order can be drafted again.
  function draftsForOrders(orders, existing, opts) {
    const o = opts || {};
    const have = new Set((Array.isArray(existing) ? existing : []).filter(function (x) { return x && x.orderId != null && x.status !== 'void'; }).map(function (x) { return String(x.orderId); }));
    const itemsFor = typeof o.itemsFor === 'function' ? o.itemsFor : function (ord) { return ord.items || ord.order_items || []; };
    const accountFor = typeof o.accountFor === 'function' ? o.accountFor : function () { return null; };
    const taxFor = typeof o.taxFieldsFor === 'function' ? o.taxFieldsFor : function () { return o.taxFields || null; };
    const drafts = []; const skipped = [];
    (Array.isArray(orders) ? orders : []).forEach(function (ord) {
      if (!ord || ord.id == null) { skipped.push({ orderId: null, reason: 'the order has no id' }); return; }
      const key = String(ord.id);
      if (have.has(key)) { skipped.push({ orderId: ord.id, reason: 'already has an invoice or a draft' }); return; }
      const acct = accountFor(ord);
      const r = draftFromOrder(ord, itemsFor(ord), { account: acct, taxFields: taxFor(ord, acct) });
      if (!r.ok) { skipped.push({ orderId: ord.id, reason: r.reason }); return; }
      have.add(key);
      r.account = acct;                 // kept with the draft so issuing can apply the account's terms
      drafts.push(r);
    });
    return { drafts: drafts, skipped: skipped, created: drafts.length, needReview: drafts.filter(function (d) { return d.needsReview; }).length,
      issued: 0, note: 'Drafts only — nothing is issued or numbered until the owner or an administrator issues it.' };
  }

  // ---- Review desk: the manual half of owner decision #3 --------------------
  // Drafts are generated automatically (draftsForOrders); a person then reviews
  // and issues each one. The desk is that step as pure data: every function
  // returns a NEW desk and never changes the one it was given. SIMULATED — a
  // number is only reserved inside the desk object, nothing is stored, sent or
  // charged. Who may act follows ROLES_MAY_ISSUE (owner, administrator).
  const PENDING_TAX_CHECK = 'the tax is still pending — this draft cannot be issued until the tax is confirmed for it';
  function openDesk(generated, opts) {
    const o = opts || {};
    const items = (Array.isArray(generated) ? generated : []).filter(function (g) { return g && g.draft && g.draft.status === 'draft'; })
      .map(function (g) { return { orderId: g.draft.orderId, draft: g.draft, checks: (g.checks || []).slice(), account: g.account || null }; });
    return { items: items, issued: [], usedNumbers: (Array.isArray(o.usedNumbers) ? o.usedNumbers : []).slice(), audit: [], synthetic: true, label: 'SIMULATED' };
  }
  // Record a confirmed tax decision on the drafts that are waiting for one.
  // There is no single rate for every sale: `taxFields` is either
  //   * a function (item) -> the fields he-tax.invoiceTaxFields gives for THAT
  //     draft (its own place, shipping terms and exemption), or
  //   * one set of fields, applied only to pending drafts for the same place
  //     (taxPlace); a draft with no place recorded is left pending.
  // A draft only leaves PENDING when its own fields come back CONFIRMED (or
  // EXEMPT); everything else stays pending and keeps saying why.
  function deskConfirmTax(desk, taxFields, who) {
    const w = who || {};
    if (!desk || !Array.isArray(desk.items)) return { ok: false, reason: 'no desk', desk: desk || null };
    if (!ROLES_MAY_ISSUE.has(w.role)) return { ok: false, reason: 'only an owner or administrator may confirm the tax rate', desk: desk };
    const perDraft = typeof taxFields === 'function';
    const one = perDraft ? null : (taxFields || {});
    const usable = function (tf) {
      if (!tf) return false;
      if (tf.taxRateStatus === 'EXEMPT') return tf.taxExempt === true;
      return tf.taxRateStatus === 'CONFIRMED' && typeof tf.taxRate === 'number' && isFinite(tf.taxRate) && tf.taxRate >= 0 && tf.taxRate <= 0.25 && typeof tf.taxShipping === 'boolean';
    };
    if (!perDraft && !usable(one)) return { ok: false, reason: 'a confirmed tax rate between 0% and 25% is required', desk: desk };
    const samePlace = function (a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); };
    let changed = 0; const places = [];
    const items = desk.items.map(function (it) {
      if (it.draft.taxRateStatus !== 'PENDING') return it;
      let tf = null;
      if (perDraft) { try { tf = taxFields(it); } catch (e) { tf = null; } }
      else if (it.draft.taxPlace != null && one.taxPlace != null && samePlace(it.draft.taxPlace, one.taxPlace)) tf = one;
      if (!usable(tf)) {
        // Still pending — but say what is missing NOW (for example the rate is
        // confirmed and only the shipping terms are left), not what was missing before.
        if (perDraft && tf && tf.taxRateStatus === 'PENDING' && Array.isArray(tf.pendingReasons) && tf.pendingReasons.length
            && JSON.stringify(tf.pendingReasons) !== JSON.stringify(it.draft.taxPendingReasons || [])) {
          const reasons = tf.pendingReasons.slice();
          return Object.assign({}, it, { draft: Object.assign({}, it.draft, { taxPendingReasons: reasons, _input: Object.assign({}, it.draft._input, { taxPendingReasons: reasons }) }) });
        }
        return it;
      }
      const patch = { taxRate: tf.taxRateStatus === 'EXEMPT' ? 0 : tf.taxRate, taxRateStatus: tf.taxRateStatus, taxShipping: tf.taxShipping === true, taxExempt: tf.taxExempt === true, taxPendingReasons: [] };
      if (tf.taxPlace != null) patch.taxPlace = tf.taxPlace;
      if (tf.taxExemptReason != null) patch.taxExemptReason = tf.taxExemptReason;
      const r = reviseDraft(it.draft, patch, { now: w.now || null, actor: w.by || w.role, reason: tf.taxRateStatus === 'EXEMPT' ? 'resale exemption verified' : 'tax rate confirmed' + (tf.taxPlace ? ' for ' + tf.taxPlace : '') });
      if (!r.ok || r.invoice.taxRateStatus === 'PENDING') return it;
      changed += 1;
      if (tf.taxPlace && places.indexOf(tf.taxPlace) < 0) places.push(tf.taxPlace);
      return Object.assign({}, it, { draft: r.invoice, checks: it.checks.filter(function (c) { return c !== PENDING_TAX_CHECK; }) });
    });
    if (!changed) return { ok: false, reason: 'no waiting draft matches this tax decision', desk: desk };
    return { ok: true, changed: changed, stillPending: items.filter(function (it) { return it.draft.taxRateStatus === 'PENDING'; }).length,
      desk: Object.assign({}, desk, { items: items,
        audit: desk.audit.concat([{ action: 'TAX_CONFIRMED', rate: perDraft ? null : (one.taxRateStatus === 'EXEMPT' ? 0 : one.taxRate), places: places, drafts: changed, by: w.by || w.role, at: w.now || null }]) }) };
  }
  // Issue one draft: the next free number for the business year of issue, the
  // terms and due date for its account, and the invoice moves to the issued list.
  // A draft with anything still to check is refused — the reviewer fixes it first.
  function deskIssue(desk, orderId, who) {
    const w = who || {};
    if (!desk || !Array.isArray(desk.items)) return { ok: false, reason: 'no desk', desk: desk || null };
    const it = desk.items.find(function (x) { return String(x.orderId) === String(orderId); });
    if (!it) return { ok: false, reason: 'no draft for that order', desk: desk };
    if (!ROLES_MAY_ISSUE.has(w.role)) return { ok: false, reason: 'only an owner or administrator may issue an invoice', desk: desk };
    if (it.checks.length) return { ok: false, reason: 'this draft still has something to check: ' + it.checks.join('; '), desk: desk };
    const day = businessDay(w.now, w.timeZone);
    if (!day) return { ok: false, reason: 'the time of issue is missing', desk: desk };
    const next = nextInvoiceNumber({ year: Number(day.slice(0, 4)), existingNumbers: desk.usedNumbers });
    const account = it.account || { id: it.draft.accountId, creditApproved: it.draft.terms === 'NET_14' };
    const r = issue(it.draft, { role: w.role, actor: w.by || w.role, number: next.number, existingNumbers: desk.usedNumbers, now: w.now, timeZone: w.timeZone, account: account });
    if (!r.ok) return { ok: false, reason: r.reason, desk: desk };
    return { ok: true, number: next.number, invoice: r.invoice, desk: Object.assign({}, desk, {
      items: desk.items.filter(function (x) { return x !== it; }),
      issued: desk.issued.concat([r.invoice]),
      usedNumbers: desk.usedNumbers.concat([next.number]),
      audit: desk.audit.concat([{ action: 'ISSUED', number: next.number, orderId: it.orderId, by: w.by || w.role, at: w.now || null }]) }) };
  }
  // Void an issued invoice. Its number stays used and stays on the record.
  function deskVoid(desk, number, who) {
    const w = who || {};
    if (!desk || !Array.isArray(desk.issued)) return { ok: false, reason: 'no desk', desk: desk || null };
    const inv = desk.issued.find(function (x) { return x.number === number; });
    if (!inv) return { ok: false, reason: 'no issued invoice with that number', desk: desk };
    if (inv.status === 'void') return { ok: false, reason: 'already void', desk: desk };
    const reason = String(w.reason || '').trim();
    if (reason.length < 5) return { ok: false, reason: 'a written reason is required to void an invoice', desk: desk };
    const r = voidInvoice(inv, { role: w.role, actor: w.by || w.role, now: w.now || null, reason: reason });
    if (!r.ok) return { ok: false, reason: r.reason, desk: desk };
    return { ok: true, desk: Object.assign({}, desk, {
      issued: desk.issued.map(function (x) { return x === inv ? r.invoice : x; }),
      audit: desk.audit.concat([{ action: 'VOIDED', number: number, by: w.by || w.role, at: w.now || null, reason: reason }]) }) };
  }

  // The calendar day of an instant in the business time zone (default
  // America/Chicago, daylight saving handled by the platform). Falls back to the
  // UTC date only if the zone is not supported. null for a missing/invalid time.
  function businessDay(at, timeZone) {
    if (!at) return null;
    const d = new Date(at);
    if (isNaN(d.getTime())) return null;
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }

  // Owner decision #2 — payment terms. New wholesale buyers are DUE ON RECEIPT;
  // Net 14 applies only to an account the owner has approved for credit.
  const PAYMENT_TERMS = ['DUE_ON_RECEIPT', 'NET_14'];
  function termsForAccount(account) {
    const a = account || {};
    return (a.creditApproved === true) ? 'NET_14' : 'DUE_ON_RECEIPT';
  }
  // Due date from an issue date + terms. Due-on-receipt is the issue date; Net 14
  // is +14 days. Pure date math on an ISO date (YYYY-MM-DD).
  function dueDateFor(issueDate, terms) {
    if (!issueDate) return null;
    const base = new Date(issueDate + (issueDate.length === 10 ? 'T00:00:00Z' : ''));
    if (isNaN(base.getTime())) return null;
    const days = terms === 'NET_14' ? 14 : 0;
    return new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);
  }

  return { STATES, ROLES_MAY_ISSUE, PAYMENT_TERMS, US_LETTER, BUSINESS_HEADER, MISSING_SEQUENCE_CONTRACT, computeTotals, draftInvoice, reviseDraft, nextInvoiceNumber, createNumberSequence, invoiceHeader, issue, applyPayment, voidInvoice, creditNote, withOverdue, packingSlip, paginate, invoicePrint, totalsLines, taxIsPending, packingSlipPrint, termsForAccount, dueDateFor, businessDay, draftFromOrder, draftsForOrders, openDesk, deskConfirmTax, deskIssue, deskVoid };
}));
