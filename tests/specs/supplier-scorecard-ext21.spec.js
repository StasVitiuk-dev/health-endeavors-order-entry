// #12/#53 supplier scorecard + document validation. Pure, Node-only, synthetic,
// READ-ONLY. Delivery accuracy is derived from purchase orders (on-time vs late,
// UNKNOWN when a date is missing — never faked). Document status is derived from
// documents linked to the supplier against an explicit required-doc assumption.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const S = require('../../assets/suppliers/he-supplier-scorecard.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('delivery accuracy is derived from POs; missing dates are UNKNOWN, never on-time', () => {
  const fx = S.fixtures();
  const d = S.deliveryScore(fx.supplier, fx.purchaseOrders);
  expect(d.receivedPOs).toBe(3);
  expect(d.onTime).toBe(1);
  expect(d.late).toBe(1);
  expect(d.unknownTiming).toBe(1);        // received but no received_date
  expect(d.onTimeRate).toBe(50);          // 1 of 2 with known timing
  expect(d.onTimeRateBasis).toBe('ACTUAL');
  expect(d.avgDaysLate).toBe(5);
  expect(d.open).toBe(1);                 // the shipped-not-received PO
});

test('a supplier with no received POs reports UNKNOWN, not a fake 100%', () => {
  const fx = S.fixtures();
  const d = S.deliveryScore({ id: 'NOBODY' }, fx.purchaseOrders);
  expect(d.onTimeRate).toBeNull();
  expect(d.onTimeRateBasis).toBe('UNKNOWN');
});

test('document validation flags missing, expired and expiring-soon documents', () => {
  const fx = S.fixtures();
  const docs = S.documentStatus(fx.supplier, fx.documents, null, fx.asOfDate);
  const byType = Object.fromEntries(docs.rows.map(r => [r.type, r.status]));
  expect(byType.insurance).toBe('VALID');
  expect(byType.w9).toBe('EXPIRING_SOON');   // expires in 6 days
  expect(byType.coa).toBe('MISSING');        // no document on file
  expect(docs.flagCount).toBe(2);
  expect(docs.allClear).toBe(false);
  // an expired doc is flagged EXPIRED.
  const expired = S.documentStatus(fx.supplier, [{ supplier_id: 'SUP-1', doc_type: 'insurance', expires_at: '2026-01-01' }], ['insurance'], fx.asOfDate);
  expect(expired.rows[0].status).toBe('EXPIRED');
});

test('the scorecard needs attention on poor delivery or any document flag, with reasons', () => {
  const fx = S.fixtures();
  const sc = S.scorecard(fx.supplier, fx.purchaseOrders, fx.documents, { asOfDate: fx.asOfDate });
  expect(sc.readOnly).toBe(true);
  expect(sc.needsAttention).toBe(true);
  expect(sc.reasons.join(' ')).toMatch(/on-time rate 50%/);
  expect(sc.reasons.join(' ')).toMatch(/coa: MISSING/);
  // a clean supplier (good delivery, all docs valid) needs no attention.
  const clean = S.scorecard(
    { id: 'SUP-9', name: 'Clean Co' },
    [{ id: 'P', supplier_id: 'SUP-9', status: 'received', expected_date: '2026-09-01', received_date: '2026-08-30' }],
    [{ supplier_id: 'SUP-9', doc_type: 'insurance', expires_at: '2027-06-01' }, { supplier_id: 'SUP-9', doc_type: 'w9', expires_at: '2027-06-01' }, { supplier_id: 'SUP-9', doc_type: 'coa', expires_at: '2027-06-01' }],
    { asOfDate: fx.asOfDate });
  expect(clean.needsAttention).toBe(false);
  expect(clean.reasons).toEqual([]);
});

test('the required-doc set is an explicit, overridable assumption, and missing schema fields are documented', () => {
  const fx = S.fixtures();
  // override required types -> only insurance is checked.
  const docs = S.documentStatus(fx.supplier, fx.documents, ['insurance'], fx.asOfDate);
  expect(docs.required).toEqual(['insurance']);
  expect(docs.rows).toHaveLength(1);
  // the schema gaps are named, not hidden.
  expect(S.DEFAULT_REQUIRED_DOCS).toEqual(expect.arrayContaining(['insurance', 'w9', 'coa']));
  expect(S.MISSING_FIELDS.length).toBeGreaterThanOrEqual(3);
  expect(S.MISSING_FIELDS.join(' ')).toMatch(/required_documents/);
});
