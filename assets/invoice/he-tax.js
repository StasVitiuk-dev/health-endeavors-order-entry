// Sales tax rule engine (Illinois) — DRAFT ONLY, synthetic, no money movement.
// Encodes the owner's recorded decision (OWNER_DECISIONS_2026-11-14.md):
//   * Illinois STATE rate is 6.25%. Local taxes may increase it, so the LIVE
//     combined rate stays PENDING until the local rate + sourcing are confirmed:
//     computeRate reports rateStatus PENDING unless a localRate is supplied.
//   * Shipping is taxable when BUNDLED / MANDATORY; EXEMPT when SEPARATELY STATED
//     and the buyer could avoid it (e.g. pickup available).
//   * A resale order needs a VALID resale certificate before the exemption
//     applies; otherwise it is taxed as normal.
// Produces a taxable base + rate for the invoice to consume. It never issues,
// never moves money, and the owner confirms the live rate before any real issue.
//
// Pure. Dual-mode (Node require + browser HE.invoice registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.invoice = root.HE.invoice || {})['he-tax'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const IL_STATE_RATE = 0.0625; // Illinois state sales tax rate (6.25%)
  const cents = (n) => Math.round((Number(n) || 0) * 100);
  const money = (c) => Math.round(c) / 100;

  // The applicable rate. Without a confirmed local component the LIVE rate is
  // PENDING (we expose the state rate so a draft can still show a figure, clearly
  // labelled). localRate is the confirmed local add-on (e.g. 0.0275 for 2.75%).
  function computeRate(opts) {
    const o = opts || {};
    const hasLocal = o.localRate != null && isFinite(Number(o.localRate));
    const local = hasLocal ? Number(o.localRate) : 0;
    const combined = IL_STATE_RATE + local;
    return {
      stateRate: IL_STATE_RATE,
      localRate: hasLocal ? local : null,
      rate: combined,
      rateStatus: hasLocal ? 'CONFIRMED' : 'PENDING',
      note: hasLocal ? null : 'LIVE RATE PENDING — owner must confirm the local rate + sourcing before issuing.',
    };
  }

  // Is the shipping charge part of the taxable base?
  //   bundled OR mandatory                         -> taxable
  //   separately stated AND avoidable (pickup etc.) -> exempt
  function shippingTaxable(shipping) {
    const s = shipping || {};
    if (s.bundled === true || s.mandatory === true) return { taxable: true, reason: 'shipping is bundled/mandatory' };
    if (s.separatelyStated === true && s.avoidable === true) return { taxable: false, reason: 'separately stated and avoidable (e.g. pickup)' };
    // Default to taxable when unclear — safer to over-collect a draft figure and
    // let the owner confirm than to under-state tax.
    return { taxable: true, reason: 'shipping taxability unclear — defaulted to taxable (owner to confirm)' };
  }

  // Resale exemption: applies only with a valid resale certificate on file.
  function resaleExempt(order) {
    const o = order || {};
    if (o.resale !== true) return { exempt: false, reason: 'not a resale order' };
    if (o.resaleCertificate && o.resaleCertificate.valid === true) return { exempt: true, reason: 'valid resale certificate on file' };
    return { exempt: false, reason: 'resale claimed but no valid resale certificate — taxed as normal', needsCertificate: true };
  }

  // Compute a draft tax figure for an order.
  // input: { subtotal, orderDiscount, shipping:{amount, bundled, mandatory,
  //          separatelyStated, avoidable}, localRate, resale, resaleCertificate }
  function computeTax(input) {
    const i = input || {};
    const rate = computeRate(i);
    const exempt = resaleExempt(i);
    const shipAmt = (i.shipping && i.shipping.amount) || 0;
    const shipTax = shippingTaxable(i.shipping);
    const goodsBaseC = Math.max(0, cents(i.subtotal) - cents(i.orderDiscount));
    const shipBaseC = shipTax.taxable ? cents(shipAmt) : 0;
    const taxableBaseC = exempt.exempt ? 0 : (goodsBaseC + shipBaseC);
    const taxC = Math.round(taxableBaseC * rate.rate);
    return {
      rate: rate.rate, rateStatus: rate.rateStatus, stateRate: rate.stateRate, localRate: rate.localRate,
      exempt: exempt.exempt, exemptReason: exempt.reason, needsCertificate: !!exempt.needsCertificate,
      shippingTaxable: shipTax.taxable, shippingReason: shipTax.reason,
      taxableBase: money(taxableBaseC), tax: money(taxC),
      draft: true, synthetic: true, label: 'SIMULATED',
      note: rate.note || (exempt.exempt ? 'Resale-exempt (certificate on file).' : null),
    };
  }

  // The same decision expressed as the plain fields an invoice draft takes
  // (he-invoice computeTotals / draftInvoice), so the invoice's own totals
  // follow the rules instead of a side calculation. Pure data, no dependency.
  function invoiceTaxFields(input) {
    const i = input || {};
    const rate = computeRate(i);
    const exempt = resaleExempt(i);
    const ship = shippingTaxable(i.shipping);
    return {
      taxRate: rate.rate, taxRateStatus: rate.rateStatus,
      taxShipping: ship.taxable, taxExempt: exempt.exempt,
      needsCertificate: !!exempt.needsCertificate,
      note: rate.note || null,
    };
  }

  return { IL_STATE_RATE, computeRate, shippingTaxable, resaleExempt, computeTax, invoiceTaxFields };
}));
