// Invoice money-math properties (hardening). Pure, Node-only, synthetic,
// deterministic (a seeded pseudo-random walk — no real randomness, so runs are
// reproducible). Across many generated invoices it checks the invariants that
// matter for money: integer-cent rounding (no float drift), totals never
// negative, the total reconciles from its parts, and tax rounds to <= half a
// cent of the exact value. These pin he-invoice against accidental float bugs.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// Deterministic LCG so the "random" cases are identical every run.
function lcg(seed) { let s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const centsOf = (v) => Math.round(v * 100);
const isCentExact = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;

test('500 generated invoices: integer-cent rounding, non-negative, reconciling total', () => {
  const rnd = lcg(20261109);
  for (let n = 0; n < 500; n++) {
    const lineCount = 1 + Math.floor(rnd() * 6);
    const lines = [];
    for (let i = 0; i < lineCount; i++) {
      lines.push({
        sku: 'S' + i,
        quantity: Math.floor(rnd() * 40),                 // 0..39, incl 0
        unitPrice: Math.round(rnd() * 5000) / 100,         // 0..50.00, cent-aligned
        discount: Math.round(rnd() * 300) / 100,           // 0..3.00 per-line
      });
    }
    const input = {
      lines,
      orderDiscount: Math.round(rnd() * 1000) / 100,       // 0..10.00
      shipping: Math.round(rnd() * 2500) / 100,            // 0..25.00
      taxRate: [0, 0.0725, 0.08, 0.0825, 0.1][Math.floor(rnd() * 5)],
    };
    const d = INV.draftInvoice(input);

    // every surfaced money value is an exact number of cents (no float drift)
    for (const l of d.lines) { expect(isCentExact(l.unitPrice)).toBe(true); expect(isCentExact(l.lineTotal)).toBe(true); }
    expect(isCentExact(d.subtotal)).toBe(true);
    expect(isCentExact(d.tax)).toBe(true);
    expect(isCentExact(d.total)).toBe(true);

    // nothing goes negative
    expect(d.subtotal).toBeGreaterThanOrEqual(0);
    expect(d.total).toBeGreaterThanOrEqual(0);
    expect(d.balance).toBe(d.total);

    // the total reconciles from its parts (all in cents to avoid float compare)
    const taxableC = Math.max(0, centsOf(d.subtotal) - centsOf(d.orderDiscount));
    const expectTotalC = Math.max(0, taxableC + centsOf(d.tax) + centsOf(d.shipping));
    expect(centsOf(d.total)).toBe(expectTotalC);

    // tax is the exact taxable*rate rounded to the nearest cent
    expect(centsOf(d.tax)).toBe(Math.round(taxableC * d.taxRate));
  }
});

test('a revision recomputes to the same totals as a fresh draft of the revised input', () => {
  const baseInput = { lines: [{ sku: 'A', quantity: 3, unitPrice: 9.99, discount: 1 }], orderDiscount: 2, shipping: 5, taxRate: 0.0825 };
  const d0 = INV.draftInvoice(baseInput);
  const revisedInput = { lines: [{ sku: 'A', quantity: 7, unitPrice: 9.99, discount: 1 }], orderDiscount: 2, shipping: 5, taxRate: 0.0825 };
  const revised = INV.reviseDraft(d0, revisedInput).invoice;
  const fresh = INV.draftInvoice(revisedInput);
  expect(revised.subtotal).toBe(fresh.subtotal);
  expect(revised.tax).toBe(fresh.tax);
  expect(revised.total).toBe(fresh.total);
});
