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
  function invoicePrint(invoice, opts) {
    const inv = invoice || {}; const o = opts || {};
    const per = o.rowsPerPage || US_LETTER.rowsPerPage;
    const pages = paginate(inv.lines, per);
    const headings = ['Item', 'Qty', 'Unit', 'Disc', 'Line'];
    return {
      kind: 'invoice_print', label: 'SIMULATED', renderedPdf: false, page: US_LETTER,
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

  return { STATES, ROLES_MAY_ISSUE, US_LETTER, computeTotals, draftInvoice, reviseDraft, issue, applyPayment, voidInvoice, withOverdue, packingSlip, paginate, invoicePrint, packingSlipPrint };
}));
