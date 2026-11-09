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
    const taxRate = Number(i.taxRate) || 0;    // e.g. 0.08
    const taxC = Math.round(taxableC * taxRate);
    const totalC = Math.max(0, taxableC + taxC + shippingC);
    return {
      lines: lineOut, currency: i.currency || 'USD',
      subtotal: money(subtotalC), orderDiscount: money(orderDiscC), shipping: money(shippingC),
      taxRate: taxRate, tax: money(taxC), total: money(totalC), _totalC: totalC,
    };
  }

  // A DRAFT invoice (editable). Linked to a store account + order when supplied.
  function draftInvoice(input) {
    const i = input || {};
    const t = computeTotals(i);
    return {
      status: 'draft', number: null, accountId: i.accountId || null, orderId: i.orderId || null,
      billTo: i.billTo || null, shipTo: i.shipTo || null, terms: i.terms || null, issueDate: null, dueDate: null,
      currency: t.currency, lines: t.lines, subtotal: t.subtotal, orderDiscount: t.orderDiscount,
      shipping: t.shipping, taxRate: t.taxRate, tax: t.tax, total: t.total,
      // _input keeps the raw adjustment fields so a later revision recomputes
      // from the same basis; it is internal (never surfaced as money).
      _input: { orderDiscount: i.orderDiscount || 0, shipping: i.shipping || 0, taxRate: i.taxRate || 0, currency: t.currency },
      paid: 0, balance: t.total, payments: [], versions: [], corrections: [], revisions: [],
      synthetic: true, label: 'SIMULATED',
    };
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
    const revised = draftInvoice(next);
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
    const re = new RegExp('^' + prefix + '-' + year + '-(\\d+)$');
    let max = 0;
    seen.forEach(function (n) { const m = re.exec(String(n)); if (m) { const v = parseInt(m[1], 10); if (v > max) max = v; } });
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
    const snapshot = JSON.parse(JSON.stringify({ lines: draft.lines, subtotal: draft.subtotal, tax: draft.tax, total: draft.total, currency: draft.currency }));
    const issued = Object.assign({}, draft, {
      status: 'issued', number: number, issueDate: o.now || null, dueDate: o.dueDate || null,
      balance: draft.total, paid: 0,
      versions: draft.versions.concat([{ version: draft.versions.length + 1, issuedAt: o.now || null, by: o.actor || o.role, snapshot: snapshot }]),
    });
    return { ok: true, invoice: issued, number: number };
  }

  // Record a (simulated) payment. Never moves money — just represents balance.
  // Over-payment is refused; a dedup key stops a double-apply of the same payment.
  function applyPayment(invoice, payment) {
    const p = payment || {};
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
    const per = perPage || US_LETTER.rowsPerPage; const pages = [];
    for (let i = 0; i < (items || []).length; i += per) pages.push(items.slice(i, i + per));
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

  return { STATES, ROLES_MAY_ISSUE, US_LETTER, BUSINESS_HEADER, MISSING_SEQUENCE_CONTRACT, computeTotals, draftInvoice, reviseDraft, nextInvoiceNumber, createNumberSequence, invoiceHeader, issue, applyPayment, voidInvoice, creditNote, withOverdue, packingSlip, paginate, invoicePrint, packingSlipPrint };
}));
