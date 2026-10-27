// Sales & Growth: claim firewall (assets/sales/he-sales-claims.js).
// Proves prohibited therapeutic/medical claim families are blocked (including
// simple obfuscation) and that safe cosmetic body-care copy passes clean.
const { test, expect } = require('@playwright/test');
const C = require('../../assets/sales/he-sales-claims.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const PROHIBITED = [
  'This cream treats eczema and psoriasis.',
  'Clinically proven to cure acne.',
  'Our anti-inflammatory balm reduces inflammation.',
  'Fast pain relief for arthritis.',
  'Antibacterial formula kills bacteria.',
  'FDA-approved, dermatologist-recommended, medical-grade.',
  'Helps with wound healing and infection.',
  'Prevents aging and wrinkles.',
];

const SAFE = [
  'A rich, deeply moisturising body cream with a fresh ocean scent.',
  'Softens and smooths skin; part of a calming evening ritual.',
  'Made in small batches. Cruelty-free. Gentle on everyday skin.',
  'Our Sea Foam lotion leaves skin feeling hydrated and soft.',
  'Would you be open to carrying our body-care line at wholesale?',
];

test('every prohibited claim is blocked, with a family named', () => {
  for (const t of PROHIBITED) {
    const r = C.scan(t);
    expect(r.ok, t).toBe(false);
    expect(r.findings.length, t).toBeGreaterThan(0);
  }
});

test('safe cosmetic body-care copy passes clean (no false positives)', () => {
  for (const t of SAFE) {
    const r = C.scan(t);
    expect(r.ok, t + ' -> ' + JSON.stringify(r.findings)).toBe(true);
  }
});

test('assertClean throws on a claim and names the content location', () => {
  expect(() => C.assertClean('treats eczema', 'outreach draft')).toThrow(/blocked outreach draft/);
  expect(C.assertClean('A gentle daily moisturiser.', 'newsletter')).toBe(true);
});

test('catches zero-width and letter-spacing obfuscation of hard tokens', () => {
  expect(C.scan('e c z e m a relief').ok).toBe(false);
  expect(C.scan('c-a-n-c-e-r support').ok).toBe(false);
  expect(C.scan('ecz​ema cream').ok).toBe(false);
});

test('scan tolerates empty/null/odd input without throwing', () => {
  for (const v of [null, undefined, '', 0, {}, []]) expect(C.scan(v).ok).toBe(true);
});
