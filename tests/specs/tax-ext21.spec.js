// Illinois sales-tax rule engine (owner decision #1). Pure, Node-only, synthetic,
// DRAFT ONLY. State 6.25% + confirmed local; live rate PENDING until local is
// confirmed; shipping taxable when bundled/mandatory, exempt when separately
// stated + avoidable; resale exemption only with a valid certificate.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const T = require('../../assets/invoice/he-tax.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('the live rate stays PENDING until a local rate is confirmed', () => {
  const pending = T.computeRate({});
  expect(pending.stateRate).toBe(0.0625);
  expect(pending.rateStatus).toBe('PENDING');
  expect(pending.note).toMatch(/PENDING/);
  const confirmed = T.computeRate({ localRate: 0.0275 });
  expect(confirmed.rate).toBeCloseTo(0.09, 10);
  expect(confirmed.rateStatus).toBe('CONFIRMED');
});

test('shipping is taxable when bundled/mandatory and exempt when separately stated + avoidable', () => {
  expect(T.shippingTaxable({ bundled: true }).taxable).toBe(true);
  expect(T.shippingTaxable({ mandatory: true }).taxable).toBe(true);
  expect(T.shippingTaxable({ separatelyStated: true, avoidable: true }).taxable).toBe(false);
  // unclear defaults to taxable (owner to confirm), never silently exempt.
  expect(T.shippingTaxable({}).taxable).toBe(true);
});

test('resale is exempt only with a valid resale certificate', () => {
  expect(T.resaleExempt({ resale: true }).exempt).toBe(false);
  expect(T.resaleExempt({ resale: true }).needsCertificate).toBe(true);
  expect(T.resaleExempt({ resale: true, resaleCertificate: { valid: true } }).exempt).toBe(true);
  expect(T.resaleExempt({ resale: false }).exempt).toBe(false);
});

test('computeTax includes mandatory shipping in the base and flags the pending rate', () => {
  const r = T.computeTax({ subtotal: 100, orderDiscount: 10, shipping: { amount: 12.5, mandatory: true } });
  expect(r.taxableBase).toBe(102.5);           // (100 - 10) + 12.5 shipping
  expect(r.rateStatus).toBe('PENDING');
  expect(r.tax).toBeCloseTo(6.41, 2);          // 102.5 * 0.0625
  expect(r.label).toBe('SIMULATED');
});

test('computeTax excludes avoidable separately-stated shipping and uses the confirmed rate', () => {
  const r = T.computeTax({ subtotal: 100, orderDiscount: 0, shipping: { amount: 12.5, separatelyStated: true, avoidable: true }, localRate: 0.0275 });
  expect(r.shippingTaxable).toBe(false);
  expect(r.taxableBase).toBe(100);             // shipping excluded
  expect(r.tax).toBeCloseTo(9, 2);             // 100 * 0.09
  expect(r.rateStatus).toBe('CONFIRMED');
});

test('a resale order with a valid certificate is taxed at zero', () => {
  const r = T.computeTax({ subtotal: 500, resale: true, resaleCertificate: { valid: true }, localRate: 0.0275 });
  expect(r.exempt).toBe(true);
  expect(r.taxableBase).toBe(0);
  expect(r.tax).toBe(0);
});
