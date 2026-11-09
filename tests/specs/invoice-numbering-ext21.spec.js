// Proposed invoice numbering HE-YYYY-NNNN (owner decision O1). Pure, Node-only,
// synthetic. A per-year, zero-padded, gap-free sequence suggested from the
// numbers already used; it issues nothing. The owner can change prefix/width/
// reset and must confirm terms + tax before any real issue.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const INV = require('../../assets/invoice/he-invoice.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('first number of a year, then a gap-free increment', () => {
  const first = INV.nextInvoiceNumber({ year: 2026, existingNumbers: new Set() });
  expect(first.number).toBe('HE-2026-0001');
  expect(first.sequence).toBe(1);
  expect(first.proposed).toBe(true);
  const second = INV.nextInvoiceNumber({ year: 2026, existingNumbers: new Set(['HE-2026-0001']) });
  expect(second.number).toBe('HE-2026-0002');
});

test('sequence continues past the highest used number (not just count)', () => {
  const used = new Set(['HE-2026-0001', 'HE-2026-0002', 'HE-2026-0007']); // 3,4,5,6 were voided/skipped
  const next = INV.nextInvoiceNumber({ year: 2026, existingNumbers: used });
  expect(next.number).toBe('HE-2026-0008'); // continues after the max, never reuses
});

test('the sequence resets per year', () => {
  const used = new Set(['HE-2026-0041', 'HE-2026-0042']);
  // a new year starts at 0001 regardless of last year's count
  expect(INV.nextInvoiceNumber({ year: 2027, existingNumbers: used }).number).toBe('HE-2027-0001');
});

test('the suggested number is actually usable by issue() and is unique', () => {
  const seen = new Set(['HE-2026-0001']);
  const suggestion = INV.nextInvoiceNumber({ year: 2026, existingNumbers: seen });
  expect(suggestion.number).toBe('HE-2026-0002');
  const draft = INV.draftInvoice({ lines: [{ quantity: 1, unitPrice: 10 }], taxRate: 0 });
  const r = INV.issue(draft, { role: 'owner', number: suggestion.number, existingNumbers: seen });
  expect(r.ok).toBe(true);
  seen.add(suggestion.number);
  // the next suggestion moves on; the used one is blocked
  expect(INV.nextInvoiceNumber({ year: 2026, existingNumbers: seen }).number).toBe('HE-2026-0003');
  expect(INV.issue(draft, { role: 'owner', number: 'HE-2026-0002', existingNumbers: seen }).ok).toBe(false);
});

test('the owner can override prefix and width (proposal, not a lock-in)', () => {
  const n = INV.nextInvoiceNumber({ prefix: 'INV', width: 5, year: 2026, existingNumbers: new Set() });
  expect(n.number).toBe('INV-2026-00001');
  expect(n.format).toBe('INV-YYYY-00000');
});
