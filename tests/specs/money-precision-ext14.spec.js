// EXT14 money precision audit (docs/ops/ENGINEERING_REPORT_EXT14.md §money).
// The pages add money in ordinary JavaScript numbers (binary floating point)
// and round to whole cents only when showing it (fmtMoney) — on screen and in
// the CSV exports alike. This is exact as long as the rounding error collected
// while adding stays below half a cent. These tests prove where that holds:
//   * a worst-case bound (every addition off by half a unit in the last place)
//   * seeded random ledgers, compared with an exact whole-cent sum
//   * adversarial amounts (0.1 / 0.2 / 0.3 patterns, refunds that cancel)
// and pin the limit, so a business far larger than today's is flagged.
const base = require('@playwright/test');
const { load } = require('../helpers/extract-source');
const test = base.test, expect = base.expect;
test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });
const H = load(['fmtMoney']);

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const exact = cents => H.fmtMoney(cents / 100, 'USD'); // the exact sum, formatted the same way
// Largest possible accumulated error after n additions with running totals up to T:
// each addition is off by at most half an ulp of T.
const ulp = x => { const e = Math.floor(Math.log2(Math.abs(x) || 1)); return 2 ** (e - 52); };
const worstError = (n, T) => n * ulp(T) / 2;

test('worst-case bound: provably exact at today\'s scale and far beyond', () => {
  // [orders, largest running total in dollars] → safe if the worst error < half a cent
  for (const [n, T] of [[10000, 1e6], [100000, 1e7], [250000, 5e7]]) expect(worstError(n, T), `${n} orders, $${T}`).toBeLessThan(0.005);
  // Where the guarantee ends (recorded, not a bug at this business's size):
  expect(worstError(1e6, 1e8)).toBeGreaterThan(0.005);
});

for (const seed of [1, 2, 3, 4, 5]) {
  test(`seed ${seed}: 200,000 random sales and refunds add up to the exact cent`, () => {
    const r = rng(seed);
    let f = 0, c = 0;
    for (let i = 0; i < 200000; i++) {
      const cents = Math.floor(r() * 50000) * (r() < 0.07 ? -1 : 1); // up to $500, some refunds
      f += Number((cents / 100).toFixed(2)); // as the page receives it: a decimal string turned into a number
      c += cents;
    }
    expect(H.fmtMoney(f, 'USD')).toBe(exact(c));
  });
}

test('adversarial amounts: 0.10 + 0.20 patterns, and refunds that cancel to exactly zero', () => {
  let f = 0;
  for (let i = 0; i < 1000000; i++) f += [0.1, 0.2, 0.3, 0.01, 0.07][i % 5];
  expect(H.fmtMoney(f, 'USD')).toBe(exact(1000000 / 5 * 68));
  let z = 0;
  for (let i = 0; i < 10000; i++) z += 19.99;
  for (let i = 0; i < 10000; i++) z -= 19.99;
  expect(H.fmtMoney(z, 'USD')).toBe('$0.00'); // never "-$0.00"
  expect(H.fmtMoney(0.1 + 0.2 - 0.3, 'USD')).toBe('$0.00');
});

test('half-cent amounts round away from zero, as the currency formatter does', () => {
  expect(H.fmtMoney(2.675, 'USD')).toBe('$2.68');   // 2.675 is 2.67499999… in binary
  expect(H.fmtMoney(-2.675, 'USD')).toBe('-$2.68');
  expect(H.fmtMoney(1.005, 'USD')).toBe('$1.01');
});
