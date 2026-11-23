// Duplicate import across refresh + two tabs (wave-2 item 1). Pure, Node-only,
// synthetic. The highest-risk local write path here is the wholesale lead
// import, and it is confirm-gated preview only (needsConfirmation, never an
// auto-merge). This pins that a row's identity keys are STABLE across re-import
// (so a refresh or a second tab produces the same identity), that a duplicate
// import CONVERGES — the repeats cluster together for owner review rather than
// double-writing — and that the duplicate cluster carries an actionable reason
// (the "stale / already-present record" message).
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const IMP = require('../../assets/sales/he-sales-import.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const storeA = { storeName: 'SYNTHETIC Bright Market', email: 'buyer@brightmarket.test', website: 'brightmarket.test', city: 'Portland', source: 'owner list', sourceDate: '2026-11-01' };
const storeA_again = { storeName: '  SYNTHETIC   Bright  Market ', email: 'BUYER@brightmarket.test', city: 'portland', source: 'directory', sourceDate: '2026-11-03' }; // same store, messier spacing/case
const storeB = { storeName: 'SYNTHETIC Coast Co', email: 'hi@coast.test', website: 'coast.test', city: 'Astoria', source: 'owner list', sourceDate: '2026-11-02' };

test('a row identity key is stable across re-import (refresh / second tab)', () => {
  const first = IMP.prepareRow(storeA).normalized;
  const refreshed = IMP.prepareRow(storeA).normalized;      // same raw, imported again
  expect(refreshed.nameKey).toBe(first.nameKey);
  expect(refreshed.email).toBe(first.email);
  expect(refreshed.domain).toBe(first.domain);
  // even a messier copy of the SAME store normalizes to the same strong keys
  const messy = IMP.prepareRow(storeA_again).normalized;
  expect(messy.nameKey).toBe(first.nameKey);                // name normalized identically
  expect(messy.email).toBe(first.email);                    // email case-folded identically
});

test('a duplicate import converges: repeats cluster for review, never silently merged', () => {
  // a file re-imported on top of itself (two tabs, same rows)
  const preview = IMP.importPreview([storeA, storeB, storeA_again]);
  expect(preview.needsConfirmation).toBe(true);             // no write without owner confirm
  // Bright Market appears twice -> exactly one duplicate cluster of size 2
  expect(preview.duplicates.length).toBe(1);
  expect(preview.duplicates[0].members.length).toBe(2);
  // the cluster carries an actionable reason (the "already present" message)
  expect(preview.duplicates[0].reasons.length).toBeGreaterThan(0);
  expect(preview.duplicates[0].reasons.join(' ')).toMatch(/same email|same domain|same name/);
  // the two distinct stores are NOT clustered together
  const brightIdx = preview.prepared.findIndex(p => p.normalized.nameKey.includes('bright'));
  const coastIdx = preview.prepared.findIndex(p => p.normalized.nameKey.includes('coast'));
  expect(preview.duplicates[0].members).toContain(brightIdx);
  expect(preview.duplicates[0].members).not.toContain(coastIdx);
});

test('two tabs importing overlapping sets: the overlap is detected, the new row is kept', () => {
  // tab A imported [A]; tab B imports [A, B] -> B's preview flags A as a repeat
  const combined = IMP.importPreview([storeA, storeA_again, storeB]);
  expect(combined.count).toBe(3);
  // one duplicate cluster (the two Bright Market rows); Coast Co stands alone
  const dupMembers = combined.duplicates.flatMap(d => d.members);
  expect(dupMembers.length).toBe(2);
  const coastIdx = combined.prepared.findIndex(p => p.normalized.nameKey.includes('coast'));
  expect(dupMembers).not.toContain(coastIdx);               // the genuinely new row is preserved
});
