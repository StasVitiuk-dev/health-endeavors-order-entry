// Sales tax rules — DRAFT ONLY, synthetic, no money movement.
//
// Owner decision of Nov 16 (replaces the Nov 14 wording):
//   * LIVE tax settings stay PENDING until the owner has confirmed the
//     applicable Illinois rules. This file holds NO tax rate of its own: every
//     rate comes from a setting the owner confirmed for one named place
//     (rateSetting). There is no built-in state rate and no single rate for all
//     sales.
//   * Unknown tax is never shown as 0 and never guessed. Without a confirmed
//     rate — or when the shipping terms needed to decide are not recorded — the
//     status is PENDING and the tax amount is null ("tax pending").
//   * Shipping: taxed when it is bundled into the price or mandatory; not taxed
//     when it is separately stated AND the buyer could avoid it (for example
//     pickup is offered). Anything else is UNCLEAR, which makes the tax PENDING.
//   * Wholesale resale: exempt only with VERIFIED exemption documentation on
//     file (a certificate number, who verified it, when, and not expired).
//     Otherwise the order is taxed like any other, and says why.
// These are the owner's working rules for staging; they are not tax advice and
// the owner confirms them before anything is issued for real.
//
// Pure. Dual-mode (Node require + browser HE.invoice registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.invoice = root.HE.invoice || {})['he-tax'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_RATE = 0.25;                         // a sanity limit, not a rate
  const cents = (n) => Math.round((Number(n) || 0) * 100);
  const money = (c) => Math.round(c) / 100;
  // Tax in cents, rounded exactly as the database does (Nov 22): the rate is
  // taken to 5 decimals, as stored, and base x rate is rounded half up with
  // whole-number arithmetic. Plain multiplication of decimals was off by a cent
  // in about 6 of a million cases (e.g. $13,625.00 at 13.62% = $1,855.725).
  const taxCents = (baseC, rate) => {
    const r5 = Math.round((Number(rate) || 0) * 100000);
    const b = Math.round(Number(baseC) || 0);
    if (r5 <= 0 || b <= 0 || typeof BigInt !== 'function') return Math.max(0, Math.round(b * r5 / 100000));
    const n = BigInt(b) * BigInt(r5), q = n / BigInt(100000), rem = n % BigInt(100000);
    return Number(rem * BigInt(2) >= BigInt(100000) ? q + BigInt(1) : q);
  };
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  // a real calendar day only (2027-02-30 is not a day)
  const day = (v) => {
    const s = text(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : '';
  };

  // A rate the owner confirmed for one place:
  //   { place, rate, parts:[{ name, rate }], confirmedBy, confirmedAt, reference,
  //     effectiveFrom, effectiveUntil, recheckedAt }
  // effectiveFrom / effectiveUntil (YYYY-MM-DD, optional): the days the rate applies.
  // Illinois rates can change on January 1 and July 1 (IDOR), so a rate is due for a
  // re-check on the first such day after it was confirmed (or last re-checked); from
  // then on a sale dated that day or later stays PENDING until the owner re-checks.
  // `parts` is optional (for example state / county / city); when given, the
  // parts must add up to the rate.
  function checkRateSetting(setting) {
    const s = setting;
    if (!s || typeof s !== 'object') return { ok: false, reason: 'no tax rate has been confirmed for this sale' };
    const rate = typeof s.rate === 'number' ? s.rate : NaN;
    if (!isFinite(rate) || rate < 0 || rate > MAX_RATE) return { ok: false, reason: 'the confirmed rate must be a number between 0% and 25%' };
    if (!text(s.place)) return { ok: false, reason: 'the confirmed rate does not say which place it is for' };
    if (!text(s.confirmedBy) || !text(s.confirmedAt)) return { ok: false, reason: 'the rate does not record who confirmed it and when' };
    if (s.effectiveFrom != null && !day(s.effectiveFrom)) return { ok: false, reason: 'the date the rate starts is not a date (YYYY-MM-DD)' };
    if (s.effectiveUntil != null && !day(s.effectiveUntil)) return { ok: false, reason: 'the date the rate ends is not a date (YYYY-MM-DD)' };
    if (day(s.effectiveFrom) && day(s.effectiveUntil) && day(s.effectiveUntil) < day(s.effectiveFrom)) return { ok: false, reason: 'the rate ends before it starts' };
    if (s.parts != null) {
      if (!Array.isArray(s.parts) || !s.parts.length) return { ok: false, reason: 'the parts of the rate are not a list' };
      let sum = 0;
      for (const p of s.parts) {
        if (!p || !text(p.name) || typeof p.rate !== 'number' || !isFinite(p.rate) || p.rate < 0) return { ok: false, reason: 'each part of the rate needs a name and a rate' };
        sum += p.rate;
      }
      if (Math.abs(sum - rate) > 1e-9) return { ok: false, reason: 'the parts of the rate do not add up to the rate' };
    }
    return { ok: true, reason: null };
  }

  // The first January 1 or July 1 strictly after a day (YYYY-MM-DD).
  function nextChangeDay(d) {
    const y = Number(d.slice(0, 4)), md = d.slice(5);
    if (md < '07-01') return y + '-07-01';
    return (y + 1) + '-01-01';
  }
  // Is the setting usable for a sale on `asOf`? (no date given: no date checks)
  function dateProblem(s, asOf) {
    const on = day(asOf);
    if (!on) return null;
    const pl = text(s.place);
    if (day(s.effectiveFrom) && on < day(s.effectiveFrom)) return 'the confirmed rate for ' + pl + ' starts on ' + day(s.effectiveFrom) + ', after this sale (' + on + ')';
    if (day(s.effectiveUntil) && on > day(s.effectiveUntil)) return 'the confirmed rate for ' + pl + ' ended on ' + day(s.effectiveUntil) + '; confirm the rate that applies now';
    const last = [day(s.recheckedAt), day(s.confirmedAt), day(s.effectiveFrom)].filter(Boolean).sort().pop();
    if (last) {
      const due = nextChangeDay(last);
      if (on >= due) return 'rates can change on January 1 and July 1; re-check the rate for ' + pl + ' (last checked ' + last + ', re-check due ' + due + ')';
    }
    return null;
  }
  function recheckDue(setting) {
    const s = setting || {};
    const last = [day(s.recheckedAt), day(s.confirmedAt), day(s.effectiveFrom)].filter(Boolean).sort().pop();
    return last ? nextChangeDay(last) : null;
  }

  // The rate for one sale: CONFIRMED only from a valid owner-confirmed setting
  // that applies on the sale's date (opts.asOf, when given).
  function computeRate(opts) {
    const o = opts || {};
    const chk = checkRateSetting(o.rateSetting);
    const why = chk.ok ? dateProblem(o.rateSetting, o.asOf) : chk.reason;
    if (why) return { rate: null, rateStatus: 'PENDING', place: null, parts: null, confirmedBy: null, confirmedAt: null, reason: why, note: 'TAX PENDING — ' + why + '.' };
    const s = o.rateSetting;
    return { rate: s.rate, rateStatus: 'CONFIRMED', place: text(s.place), parts: s.parts ? s.parts.map(function (p) { return { name: text(p.name), rate: p.rate }; }) : null,
      confirmedBy: text(s.confirmedBy), confirmedAt: text(s.confirmedAt), reason: null, note: null };
  }

  // Pick the confirmed setting for a place out of several (rates differ by place).
  // With a sale date: the one in effect that day (latest start wins); a setting
  // that starts later is never used for an earlier sale.
  function rateSettingFor(settings, place, asOf) {
    const want = text(place).toLowerCase();
    if (!want || !Array.isArray(settings)) return null;
    const on = day(asOf);
    const fits = settings.filter(s => s && text(s.place).toLowerCase() === want && checkRateSetting(s).ok
      && (!on || ((!day(s.effectiveFrom) || day(s.effectiveFrom) <= on) && (!day(s.effectiveUntil) || day(s.effectiveUntil) >= on))));
    if (!fits.length) {
      // nothing in effect that day: return the first valid one for the place, so the
      // reason ("starts on ...", "ended on ...") reaches the person
      for (const s of settings) if (s && text(s.place).toLowerCase() === want && checkRateSetting(s).ok) return s;
      return null;
    }
    fits.sort((a, b) => (day(b.effectiveFrom) || '').localeCompare(day(a.effectiveFrom) || ''));
    return fits[0];
  }

  // Is the shipping charge part of the taxed amount?
  //   status NONE         no shipping charge
  //          TAXABLE      bundled into the price, or mandatory
  //          NOT_TAXABLE  separately stated AND the buyer could avoid it
  //          UNCLEAR      not recorded — the tax stays pending, nothing is guessed
  function shippingTaxable(shipping) {
    const s = shipping || {};
    if (!(cents(s.amount) > 0) && s.bundled !== true) return { taxable: false, status: 'NONE', reason: 'no shipping charge' };
    if (s.bundled === true) return { taxable: true, status: 'TAXABLE', reason: 'shipping is bundled into the price' };
    if (s.mandatory === true) return { taxable: true, status: 'TAXABLE', reason: 'shipping is mandatory (the buyer cannot avoid it)' };
    if (s.separatelyStated === true && s.avoidable === true) return { taxable: false, status: 'NOT_TAXABLE', reason: 'shipping is separately stated and the buyer could avoid it (for example pickup)' };
    return { taxable: null, status: 'UNCLEAR', reason: 'the shipping terms are not recorded (is it stated separately, and could the buyer avoid it?)' };
  }

  // Resale exemption: only with verified documentation on file.
  //   order.resaleCertificate: { number, verified:true, verifiedBy, verifiedAt, expiresOn }
  //   asOf: the day the sale is judged on (YYYY-MM-DD), for the expiry check.
  function resaleExempt(order, asOf) {
    const o = order || {};
    if (o.resale !== true) return { exempt: false, needsCertificate: false, reason: 'not a resale order' };
    const c = o.resaleCertificate;
    const refuse = function (why) { return { exempt: false, needsCertificate: true, reason: 'resale was claimed but ' + why + ' — taxed like any other order' }; };
    if (!c || typeof c !== 'object') return refuse('no exemption document is on file');
    if (!text(c.number)) return refuse('the exemption document has no certificate number');
    if (c.verified !== true || !text(c.verifiedBy) || !text(c.verifiedAt)) return refuse('the exemption document has not been verified (who checked it, and when)');
    const expires = day(c.expiresOn); const on = day(asOf);
    if (c.expiresOn != null && !expires) return refuse('the expiry date on the exemption document cannot be read');
    if (expires && !on) return refuse('the date of the sale is needed to check the exemption document has not expired');
    if (expires && on && expires < on) return refuse('the exemption document expired on ' + expires);
    return { exempt: true, needsCertificate: false, reason: 'resale exempt — certificate ' + text(c.number) + ' verified by ' + text(c.verifiedBy) + ' on ' + text(c.verifiedAt).slice(0, 10),
      certificateNumber: text(c.number), verifiedBy: text(c.verifiedBy), verifiedAt: text(c.verifiedAt), expiresOn: expires || null };
  }

  // One decision for one sale.
  //   status EXEMPT     verified resale: tax is 0 and says why
  //          CONFIRMED  a confirmed rate and clear shipping terms: tax is a figure
  //          PENDING    anything missing: tax is null, with the reasons
  function decide(input) {
    const i = input || {};
    const exempt = resaleExempt(i, i.asOf);
    const ship = shippingTaxable(i.shipping);
    const rate = computeRate(i);
    if (exempt.exempt) return { status: 'EXEMPT', exempt: exempt, ship: ship, rate: rate, pendingReasons: [] };
    const pendingReasons = [];
    if (rate.rateStatus !== 'CONFIRMED') pendingReasons.push(rate.reason);
    if (ship.status === 'UNCLEAR') pendingReasons.push(ship.reason);
    return { status: pendingReasons.length ? 'PENDING' : 'CONFIRMED', exempt: exempt, ship: ship, rate: rate, pendingReasons: pendingReasons };
  }

  // A draft tax figure for an order.
  // input: { subtotal, orderDiscount, shipping:{ amount, bundled, mandatory,
  //          separatelyStated, avoidable }, rateSetting, resale,
  //          resaleCertificate, asOf }
  function computeTax(input) {
    const i = input || {};
    const d = decide(i);
    const goodsBaseC = Math.max(0, cents(i.subtotal) - cents(i.orderDiscount));
    const shipC = cents(i.shipping && i.shipping.amount);
    let taxableBase = null; let tax = null;
    if (d.status === 'EXEMPT') { taxableBase = 0; tax = 0; }
    else if (d.status === 'CONFIRMED') {
      const baseC = goodsBaseC + (d.ship.taxable ? shipC : 0);
      taxableBase = money(baseC); tax = money(taxCents(baseC, d.rate.rate));
    }
    return {
      status: d.status, rateStatus: d.status, pendingReasons: d.pendingReasons,
      rate: d.status === 'CONFIRMED' ? d.rate.rate : null, place: d.rate.place, parts: d.rate.parts,
      exempt: d.exempt.exempt, exemptReason: d.exempt.reason, needsCertificate: d.exempt.needsCertificate,
      shippingTaxable: d.ship.taxable, shippingStatus: d.ship.status, shippingReason: d.ship.reason,
      taxableBase: taxableBase, tax: tax,
      draft: true, synthetic: true, label: 'SIMULATED',
      note: d.status === 'PENDING' ? 'TAX PENDING — ' + d.pendingReasons.join('; ') + '.' : (d.status === 'EXEMPT' ? d.exempt.reason + '.' : null),
    };
  }

  // The same decision as the plain fields an invoice draft takes (he-invoice
  // computeTotals / draftInvoice), so the invoice's own totals follow the rules.
  function invoiceTaxFields(input) {
    const i = input || {};
    const d = decide(i);
    return {
      taxRate: d.status === 'CONFIRMED' ? d.rate.rate : null,
      taxRateStatus: d.status,
      taxShipping: d.status === 'EXEMPT' ? false : d.ship.taxable,
      taxExempt: d.exempt.exempt,
      taxExemptReason: d.exempt.exempt ? d.exempt.reason : null,
      taxPlace: text(i.place) || d.rate.place || null,
      needsCertificate: d.exempt.needsCertificate,
      certificateProblem: d.exempt.needsCertificate ? d.exempt.reason : null,
      pendingReasons: d.pendingReasons,
      note: d.status === 'PENDING' ? 'TAX PENDING — ' + d.pendingReasons.join('; ') + '.' : null,
    };
  }

  return { MAX_RATE, checkRateSetting, computeRate, rateSettingFor, recheckDue, shippingTaxable, resaleExempt, computeTax, invoiceTaxFields };
}));
