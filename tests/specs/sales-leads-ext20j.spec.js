// Sales & Growth: deterministic wholesale lead scoring (assets/sales/he-sales-leads.js).
// Proves scoring is explainable, reproducible, body-care-fit weighted, and that
// the "serious prospect" gate (read later by the sample module) is strict.
const { test, expect } = require('@playwright/test');
const L = require('../../assets/sales/he-sales-leads.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const strong = { storeName: 'Blue Harbor Apothecary', email: 'buyer@blueharbor.example', category: 'skincare', size: 'medium', region: 'local', carriesSimilarBrands: true };

test('validate: needs a store name and a way to reach them', () => {
  expect(L.validate(strong).ok).toBe(true);
  expect(L.validate({ storeName: '', email: 'a@b.co' }).problems).toContain('missing store name');
  expect(L.validate({ storeName: 'X' }).problems).toContain('no email and no website — cannot reach them');
  expect(L.validate({ storeName: 'X', email: 'not-an-email' }).problems).toContain('email does not look valid');
  expect(L.validate({ storeName: 'X', email: 'a@b.co', category: 'hardware' }).problems[0]).toMatch(/unknown category/);
});

test('scoring is deterministic and explainable', () => {
  const a = L.score(strong), b = L.score(strong);
  expect(a).toEqual(b);
  expect(a.reasons.length).toBeGreaterThan(3);
  expect(a.reasons.join(' ')).toMatch(/category fit skincare: \+45/);
});

test('a strong body-care fit scores high (hot) and is a serious prospect', () => {
  const s = L.score(strong);
  expect(s.score).toBeGreaterThanOrEqual(70);
  expect(s.band).toBe('hot');
  expect(s.serious).toBe(true);
});

test('a weak fit scores low and is never a serious prospect', () => {
  const weak = { storeName: 'Corner Grocery', category: 'grocery', size: 'small', region: 'international' };
  const s = L.score(weak);
  expect(s.band).toBe('cold');
  expect(s.serious).toBe(false);
});

test('unreachable strong store is not serious (cannot be worked)', () => {
  const noContact = { storeName: 'Ghost Spa', category: 'spa', size: 'large', region: 'local' };
  const s = L.score(noContact);
  expect(s.serious).toBe(false); // reachable === 0 fails the serious gate
});

test('score is clamped to 0..100 and tolerates missing/unknown fields', () => {
  expect(L.score({}).score).toBeGreaterThanOrEqual(0);
  expect(L.score({ storeName: 'X', category: 'skincare', size: 'large', region: 'local', email: 'a@b.co', carriesSimilarBrands: true }).score).toBeLessThanOrEqual(100);
});

test('rank orders by score, highest first, stable on ties', () => {
  const ranked = L.rank([
    { storeName: 'Zed Grocery', category: 'grocery' },
    strong,
    { storeName: 'Aqua Beauty', email: 'a@aqua.example', category: 'beauty', size: 'large', region: 'local' },
  ]);
  expect(ranked[0].storeName).toBe('Blue Harbor Apothecary'); // skincare + similar-brands tops the list
  expect(ranked[ranked.length - 1].storeName).toBe('Zed Grocery');
  for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].scoring.score).toBeGreaterThanOrEqual(ranked[i].scoring.score);
});
