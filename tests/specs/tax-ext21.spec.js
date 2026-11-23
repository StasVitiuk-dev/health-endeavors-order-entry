// Sales tax rules (owner decision of Nov 16, replacing the Nov 14 wording).
// Pure, Node-only, synthetic, DRAFT ONLY.
//   * No tax rate is built in: every rate comes from a setting the owner
//     confirmed for one named place. Different places can have different rates.
//   * Unknown tax is never 0 and never guessed: it is PENDING, with no figure.
//   * Shipping: separately stated + optional -> not taxed; mandatory or bundled
//     -> taxed; terms not recorded -> the tax is pending.
//   * Wholesale resale is exempt only with VERIFIED exemption documentation.
// The rates used here are made-up test numbers, not real Illinois rates.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const fs = require('fs');
const path = require('path');
const T = require('../../assets/invoice/he-tax.js');
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const PLACE_A = { place: 'Example City A, IL', rate: 0.0875, confirmedBy: 'owner', confirmedAt: '2026-11-16T15:00:00Z' };
const PLACE_B = { place: 'Example City B, IL', rate: 0.1025, parts: [{ name: 'State', rate: 0.07 }, { name: 'Local', rate: 0.0325 }], confirmedBy: 'owner', confirmedAt: '2026-11-16T15:00:00Z' };
const CERT = { number: 'SYN-RESALE-0001', verified: true, verifiedBy: 'owner', verifiedAt: '2026-11-01', expiresOn: '2027-11-01' };
const LINES = [{ sku: 'SYN-A', quantity: 10, unitPrice: 10 }];           // 100.00 of goods

test('no tax rate is built into the code: nothing is exported or written as a rate', () => {
  expect(Object.keys(T).filter(k => /RATE/.test(k) && k !== 'MAX_RATE')).toEqual([]);
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'invoice', 'he-tax.js'), 'utf8');
  const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  // The only decimal number in the code is the 25% sanity limit.
  expect((code.match(/\b0\.\d+\b/g) || []).filter(n => n !== '0.25')).toEqual([]);
  expect(T.computeRate({}).rate).toBeNull();
});

test('without a confirmed rate the tax is PENDING and has no figure (never 0, never a guess)', () => {
  const r = T.computeTax({ subtotal: 100, orderDiscount: 10, shipping: { amount: 12.5, mandatory: true } });
  expect(r.status).toBe('PENDING');
  expect(r.tax).toBeNull();
  expect(r.rate).toBeNull();
  expect(r.taxableBase).toBeNull();
  expect(r.note).toMatch(/TAX PENDING/);
  expect(r.pendingReasons.join(' ')).toMatch(/no tax rate has been confirmed/);
});

test('a rate counts only when the owner confirmed it for a named place', () => {
  expect(T.checkRateSetting(PLACE_A).ok).toBe(true);
  expect(T.checkRateSetting(PLACE_B).ok).toBe(true);
  const bad = [
    null, {}, { rate: 0.08 },
    { place: 'X', rate: 0.08 },                                                   // nobody confirmed it
    { place: 'X', rate: 0.08, confirmedBy: 'owner' },                             // no date
    { place: '', rate: 0.08, confirmedBy: 'owner', confirmedAt: '2026-11-16' },   // no place
    { place: 'X', rate: '0.08', confirmedBy: 'owner', confirmedAt: '2026-11-16' },// text, not a number
    { place: 'X', rate: 0.3, confirmedBy: 'owner', confirmedAt: '2026-11-16' },   // over the sanity limit
    { place: 'X', rate: -0.01, confirmedBy: 'owner', confirmedAt: '2026-11-16' },
    { place: 'X', rate: NaN, confirmedBy: 'owner', confirmedAt: '2026-11-16' },
    { place: 'X', rate: 0.1, parts: [{ name: 'State', rate: 0.07 }], confirmedBy: 'owner', confirmedAt: '2026-11-16' }, // parts do not add up
  ];
  for (const s of bad) {
    expect(T.checkRateSetting(s).ok, JSON.stringify(s)).toBe(false);
    expect(T.computeRate({ rateSetting: s }).rateStatus).toBe('PENDING');
    expect(T.computeTax({ subtotal: 100, rateSetting: s }).tax).toBeNull();
  }
});

test('rates differ by place: each place has its own confirmed rate, and an unknown place stays pending', () => {
  const settings = [PLACE_A, PLACE_B];
  expect(T.rateSettingFor(settings, 'example city a, il')).toBe(PLACE_A);
  expect(T.rateSettingFor(settings, 'Example City B, IL')).toBe(PLACE_B);
  expect(T.rateSettingFor(settings, 'Somewhere Else, IL')).toBeNull();
  expect(T.rateSettingFor(settings, '')).toBeNull();
  const a = T.computeTax({ subtotal: 100, rateSetting: T.rateSettingFor(settings, PLACE_A.place) });
  const b = T.computeTax({ subtotal: 100, rateSetting: T.rateSettingFor(settings, PLACE_B.place) });
  const c = T.computeTax({ subtotal: 100, rateSetting: T.rateSettingFor(settings, 'Somewhere Else, IL') });
  expect([a.tax, b.tax, c.tax]).toEqual([8.75, 10.25, null]);
  expect(b.parts).toEqual([{ name: 'State', rate: 0.07 }, { name: 'Local', rate: 0.0325 }]);
});

// ---- the three cases the owner asked to be tested separately ----

test('CASE 1 — shipping stated separately and optional (pickup offered): shipping is not taxed', () => {
  const shipping = { amount: 12.5, separatelyStated: true, avoidable: true };
  const r = T.computeTax({ subtotal: 100, shipping, rateSetting: PLACE_A });
  expect(r.status).toBe('CONFIRMED');
  expect(r.shippingStatus).toBe('NOT_TAXABLE');
  expect(r.taxableBase).toBe(100);
  expect(r.tax).toBe(8.75);
  const d = INV.draftInvoice(Object.assign({ lines: LINES, shipping: 12.5 }, T.invoiceTaxFields({ shipping, rateSetting: PLACE_A })));
  expect([d.tax, d.total, d.taxShipping, d.taxRateStatus]).toEqual([8.75, 121.25, false, 'CONFIRMED']);
});

test('CASE 2 — mandatory shipping: shipping is taxed (and so is shipping bundled into the price)', () => {
  const shipping = { amount: 12.5, mandatory: true };
  const r = T.computeTax({ subtotal: 100, shipping, rateSetting: PLACE_A });
  expect(r.shippingStatus).toBe('TAXABLE');
  expect(r.taxableBase).toBe(112.5);
  expect(r.tax).toBe(9.84);                              // 112.50 x 8.75% = 9.84375
  const d = INV.draftInvoice(Object.assign({ lines: LINES, shipping: 12.5 }, T.invoiceTaxFields({ shipping, rateSetting: PLACE_A })));
  expect([d.tax, d.total, d.taxShipping]).toEqual([9.84, 122.34, true]);
  expect(T.shippingTaxable({ amount: 5, bundled: true }).status).toBe('TAXABLE');
  // Separately stated but NOT avoidable is not the optional case.
  expect(T.shippingTaxable({ amount: 5, separatelyStated: true, mandatory: true }).status).toBe('TAXABLE');
});

test('CASE 3 — wholesale resale with verified exemption documentation: tax is 0 and says why', () => {
  const r = T.computeTax({ subtotal: 500, shipping: { amount: 12.5, mandatory: true }, resale: true, resaleCertificate: CERT, asOf: '2026-11-16', rateSetting: PLACE_A });
  expect(r.status).toBe('EXEMPT');
  expect(r.tax).toBe(0);
  expect(r.taxableBase).toBe(0);
  expect(r.exemptReason).toContain('SYN-RESALE-0001');
  expect(r.exemptReason).toContain('verified by owner');
  // The exemption does not depend on a rate having been confirmed.
  const f = T.invoiceTaxFields({ shipping: { amount: 12.5, mandatory: true }, resale: true, resaleCertificate: CERT, asOf: '2026-11-16' });
  expect(f.taxRateStatus).toBe('EXEMPT');
  const d = INV.draftInvoice(Object.assign({ lines: LINES, shipping: 12.5 }, f));
  expect([d.tax, d.total, d.taxRateStatus, d.taxExempt]).toEqual([0, 112.5, 'EXEMPT', true]);
  expect(d.taxExemptReason).toContain('SYN-RESALE-0001');
});

test('resale without verified documentation is NOT exempt, and says which piece is missing', () => {
  const cases = [
    [undefined, /no exemption document is on file/],
    [{ verified: true, verifiedBy: 'owner', verifiedAt: '2026-11-01' }, /no certificate number/],
    [{ number: 'SYN-1' }, /has not been verified/],
    [{ number: 'SYN-1', verified: true }, /has not been verified/],                       // who and when are missing
    [{ number: 'SYN-1', valid: true }, /has not been verified/],                          // the old "valid" flag is not enough
    [{ number: 'SYN-1', verified: 'yes', verifiedBy: 'owner', verifiedAt: '2026-11-01' }, /has not been verified/],
    [Object.assign({}, CERT, { expiresOn: '2026-11-15' }), /expired on 2026-11-15/],
    [Object.assign({}, CERT, { expiresOn: 'soon' }), /expiry date .* cannot be read/],
  ];
  for (const [cert, why] of cases) {
    const x = T.resaleExempt({ resale: true, resaleCertificate: cert }, '2026-11-16');
    expect(x.exempt, JSON.stringify(cert)).toBe(false);
    expect(x.needsCertificate).toBe(true);
    expect(x.reason).toMatch(why);
    // Taxed like any other order: with a confirmed rate there is a real figure.
    expect(T.computeTax({ subtotal: 100, resale: true, resaleCertificate: cert, asOf: '2026-11-16', rateSetting: PLACE_A }).tax).toBe(8.75);
  }
  // An expiry date cannot be checked without the date of the sale.
  expect(T.resaleExempt({ resale: true, resaleCertificate: CERT }).exempt).toBe(false);
  // Valid on its last day.
  expect(T.resaleExempt({ resale: true, resaleCertificate: CERT }, '2027-11-01').exempt).toBe(true);
  expect(T.resaleExempt({ resale: false, resaleCertificate: CERT }, '2026-11-16').exempt).toBe(false);
});

test('shipping terms that were never recorded keep the tax pending, even with a confirmed rate', () => {
  const r = T.computeTax({ subtotal: 100, shipping: { amount: 12.5 }, rateSetting: PLACE_A });
  expect(r.status).toBe('PENDING');
  expect(r.tax).toBeNull();
  expect(r.pendingReasons.join(' ')).toMatch(/shipping terms are not recorded/);
  // No shipping charge: nothing to decide.
  expect(T.computeTax({ subtotal: 100, shipping: { amount: 0 }, rateSetting: PLACE_A }).tax).toBe(8.75);
  expect(T.computeTax({ subtotal: 100, rateSetting: PLACE_A }).tax).toBe(8.75);
});

test('a draft invoice with pending tax shows no tax figure and no total, and cannot be issued', () => {
  const d = INV.draftInvoice(Object.assign({ lines: LINES, shipping: 12.5, orderDiscount: 10 }, { taxRate: null, taxRateStatus: 'PENDING', taxPendingReasons: ['no tax rate has been confirmed for this sale'] }));
  expect(d.tax).toBeNull();
  expect(d.total).toBeNull();
  expect(d.taxRate).toBeNull();
  expect(d.taxPending).toBe(true);
  expect(d.totalBeforeTax).toBe(102.5);
  const lines = INV.totalsLines(d);
  expect(lines.map(l => l.key)).toEqual(['subtotal', 'discount', 'shipping', 'tax', 'totalBeforeTax', 'total']);
  expect(lines.find(l => l.key === 'tax')).toEqual({ key: 'tax', label: 'Tax', amount: null, text: 'PENDING — no tax rate has been confirmed for this sale' });
  expect(lines.find(l => l.key === 'total').amount).toBeNull();
  expect(lines.find(l => l.key === 'total').text).toMatch(/PENDING/);
  const r = INV.issue(d, { role: 'owner', number: 'HE-2026-0001', now: '2026-11-16T12:00:00Z', account: {} });
  expect(r.ok).toBe(false);
  expect(r.pendingTax).toBe(true);
  // On paper it is marked so it cannot pass for a final invoice.
  const print = INV.invoicePrint(d);
  expect(print.taxPending).toBe(true);
  expect(print.watermark).toMatch(/TAX PENDING/);
});

test('an invoice built with no tax information at all is pending, not zero', () => {
  const d = INV.draftInvoice({ lines: LINES, shipping: 5 });
  expect([d.tax, d.total, d.taxRateStatus, d.totalBeforeTax]).toEqual([null, null, 'PENDING', 105]);
  const t = INV.computeTotals({ lines: LINES });
  expect([t.tax, t.total, t.taxPending]).toEqual([null, null, true]);
  // Rubbish in the rate is unknown too.
  for (const bad of ['', 'abc', NaN, -0.05, undefined, null]) expect(INV.computeTotals({ lines: LINES, taxRate: bad }).tax, String(bad)).toBeNull();
  // "No tax" has to be said on purpose.
  expect(INV.computeTotals({ lines: LINES, taxRate: 0 }).total).toBe(100);
});

test('a draft made from an order with no tax rule is pending and tells the reviewer', () => {
  const r = INV.draftFromOrder({ id: 'SYN-1', order_number: 'SYN-1', status: 'paid', shipping_total: 5 }, [{ sku: 'SYN-A', quantity: 2, unit_price: 10 }], {});
  expect(r.ok).toBe(true);
  expect([r.draft.tax, r.draft.total, r.draft.taxRateStatus]).toEqual([null, null, 'PENDING']);
  expect(r.checks.join(' ')).toMatch(/tax is still pending/);
  expect(r.draft.taxPendingReasons).toEqual(['no tax rule was supplied for this order']);
});

// Nov 23 (owner: "I don't want to charge too little or too much"): Illinois rates can change on
// January 1 and July 1 (IDOR). A confirmed rate carries the day it starts, and it is used only
// for sales on or after that day; after the next January 1 / July 1 it must be re-checked.
const DATED = { place: 'Example City A, IL', rate: 0.0875, confirmedBy: 'owner', confirmedAt: '2026-11-24T15:00:00Z', effectiveFrom: '2026-07-01' };

test('a dated rate applies only from its start day, and never to an earlier sale', () => {
  expect(T.computeRate({ rateSetting: DATED, asOf: '2026-12-01' }).rateStatus).toBe('CONFIRMED');
  const early = T.computeRate({ rateSetting: DATED, asOf: '2026-06-30' });
  expect(early.rateStatus).toBe('PENDING');
  expect(early.reason).toMatch(/starts on 2026-07-01/);
  const ended = T.computeRate({ rateSetting: Object.assign({}, DATED, { effectiveUntil: '2026-12-31' }), asOf: '2027-01-01' });
  expect(ended.rateStatus).toBe('PENDING');
  expect(ended.reason).toMatch(/ended on 2026-12-31/);
  expect(T.checkRateSetting(Object.assign({}, DATED, { effectiveFrom: 'next week' })).ok).toBe(false);
  expect(T.checkRateSetting(Object.assign({}, DATED, { effectiveUntil: '2026-01-01' })).reason).toMatch(/ends before it starts/);
});

test('after January 1 or July 1 the rate must be re-checked before it is used again', () => {
  expect(T.recheckDue(DATED)).toBe('2027-01-01');
  expect(T.recheckDue(Object.assign({}, DATED, { confirmedAt: '2026-03-02' , effectiveFrom: '2026-01-01' }))).toBe('2026-07-01');
  const due = T.computeTax({ subtotal: 100, shipping: { amount: 0 }, rateSetting: DATED, asOf: '2027-01-01' });
  expect(due.status).toBe('PENDING');
  expect(due.tax).toBeNull();
  expect(due.note).toMatch(/re-check the rate for Example City A, IL \(last checked 2026-11-24, re-check due 2027-01-01\)/);
  // re-checked on Jan 2: usable again until July 1
  const again = Object.assign({}, DATED, { recheckedAt: '2027-01-02' });
  expect(T.computeTax({ subtotal: 100, shipping: { amount: 0 }, rateSetting: again, asOf: '2027-03-01' }).tax).toBe(8.75);
  expect(T.computeTax({ subtotal: 100, shipping: { amount: 0 }, rateSetting: again, asOf: '2027-07-01' }).status).toBe('PENDING');
  // no sale date given: the date rules cannot be applied and nothing changes (earlier behaviour)
  expect(T.computeRate({ rateSetting: DATED }).rateStatus).toBe('CONFIRMED');
});

test('two rates for one place: the one in effect on the sale day is used', () => {
  const old = Object.assign({}, DATED, { rate: 0.08, effectiveFrom: '2026-01-01', effectiveUntil: '2026-06-30', confirmedAt: '2026-01-02' });
  const cur = DATED;
  expect(T.rateSettingFor([old, cur], 'example city a, il', '2026-03-01').rate).toBe(0.08);
  expect(T.rateSettingFor([old, cur], 'Example City A, IL', '2026-08-01').rate).toBe(0.0875);
  // nothing in effect: a setting still comes back so its reason reaches the person
  const r = T.computeRate({ rateSetting: T.rateSettingFor([cur], 'Example City A, IL', '2025-12-01'), asOf: '2025-12-01' });
  expect(r.reason).toMatch(/starts on 2026-07-01/);
});
