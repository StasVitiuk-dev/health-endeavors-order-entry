// Printable reports & export manifest — unit tests (Phase 2 item 9). Pure,
// Node-only, synthetic. Date-range selection, MISSING stays UNKNOWN (never
// zero), US-Letter print model (a model, not a rendered PDF), deterministic
// checksum + verification (catches tampering), and a failure→retry export path
// that never double-exports.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RX = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const history = [
  { report_date: '2026-11-05', currency: 'USD', orders_count: 3, revenue: 120.50, new_inquiries_count: 2, tasks_opened_count: 1, incidents_opened_count: 0, ai_calls_count: 10, ai_cost: 0.42, emailed_at: '2026-11-06T06:00:00Z' },
  { report_date: '2026-11-06', currency: 'USD', orders_count: 0, revenue: 0, new_inquiries_count: 1, tasks_opened_count: 0, incidents_opened_count: 0, ai_calls_count: 4, ai_cost: 0.11 },
  { report_date: '2026-11-07', currency: 'USD', orders_count: 5, revenue: null /* MISSING, not zero */, new_inquiries_count: 3, tasks_opened_count: 2, incidents_opened_count: 1, ai_calls_count: 7, ai_cost: 0.33 },
];

test('date-range selection is inclusive and sorted ascending', () => {
  const picked = RX.selectReports(history, { from: '2026-11-06', to: '2026-11-07' });
  expect(picked.map(r => r.report_date)).toEqual(['2026-11-06', '2026-11-07']);
  const all = RX.selectReports(history, {});
  expect(all.length).toBe(3);
});

test('a missing value stays UNKNOWN; a real zero stays 0 (never conflated)', () => {
  const picked = RX.selectReports(history, {});
  const nov6 = picked.find(r => r.report_date === '2026-11-06');
  const nov7 = picked.find(r => r.report_date === '2026-11-07');
  expect(nov6.revenue).toBe(0);          // a measured zero
  expect(nov7.revenue).toBe('UNKNOWN');  // never measured -> not zero
  const sum = RX.dailySummary(picked);
  expect(sum.orders_count).toBe(8);      // 3 + 0 + 5
  expect(sum.missing.revenue).toBe(1);   // one day's revenue is UNKNOWN
});

test('print model is US-Letter and explicitly NOT a rendered PDF', () => {
  const pm = RX.printModel({ history, title: 'Daily report' });
  expect(pm.page.page).toBe('us-letter');
  expect(pm.page.widthPx).toBe(816);
  expect(pm.renderedPdf).toBe(false);
  expect(pm.rows.length).toBe(3);
  expect(pm.note).toMatch(/not a rendered PDF/);
});

test('manifest checksum is deterministic and verification confirms it', () => {
  const m1 = RX.buildManifest({ history, now: '2026-11-08' });
  const m2 = RX.buildManifest({ history, now: '2026-11-08' });
  expect(m1.checksum).toBe(m2.checksum);           // deterministic
  expect(m1.rowCount).toBe(3);
  expect(RX.verifyManifest(m1).ok).toBe(true);
  // tamper with the packaged payload -> verification must fail
  const tampered = JSON.parse(JSON.stringify(m1));
  tampered.payload.reports[0].orders_count = 999;
  expect(RX.verifyManifest(tampered).mismatch).toBe(true);
});

test('export has an explicit failure -> retry path and never double-exports', () => {
  const m = RX.buildManifest({ history });
  const failed = RX.exportAttempt(m, { key: 'exp-1', fail: true });
  expect(failed.status).toBe('failed');
  expect(failed.canRetry).toBe(true);
  expect(failed.attempt).toBe(1);
  const ok = RX.retryExport(failed, { fail: false });
  expect(ok.status).toBe('exported');
  expect(ok.attempt).toBe(2);
  // retrying an already-exported package is a no-op, not a second export
  const again = RX.retryExport(ok, { fail: false });
  expect(again.duplicate).toBe(true);
  expect(again.attempts.length).toBe(ok.attempts.length);
});

// Nov 16 (found by docs/ops/sql/local-test/daily_export_restore_test.js): a row
// read back from an export carries 'UNKNOWN' for a figure never measured. It used
// to be re-read as NaN and written as null, so a restored export with any unknown
// figure could never reproduce its own checksum. UNKNOWN stays UNKNOWN; text that
// is not a number is UNKNOWN too, never null and never 0.
test('a restored export re-verifies: UNKNOWN read back stays UNKNOWN, and the checksum matches', ({}, ti) => {
  test.skip(ti.project.name !== 'desktop', 'Node-only; run once');
  const X = require('../../assets/reports/he-report-export.js');
  const m = X.buildManifest({ history: [{ report_date: '2026-11-15', orders_count: 2, revenue: 65 }, { report_date: '2026-11-16', orders_count: 2, revenue: null }] });
  const readBack = JSON.parse(JSON.stringify(m.payload.reports));   // what a restore hands back
  expect(readBack[1].revenue).toBe('UNKNOWN');
  expect(X.verifyManifest(m, readBack).ok).toBe(true);
  expect(X.selectReports([{ report_date: '2026-11-16', orders_count: 'abc', revenue: 'UNKNOWN' }], {})[0]).toMatchObject({ orders_count: 'UNKNOWN', revenue: 'UNKNOWN' });
  expect(X.selectReports([{ report_date: '2026-11-16', orders_count: 0 }], {})[0].orders_count).toBe(0);
});
