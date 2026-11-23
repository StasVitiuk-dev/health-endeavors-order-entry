// Business-day boundary audit: midnight + DST (wave-2 item 4). Pure, Node-only,
// synthetic, fixed times. The report model assigns each event to a business day
// via a FIXED UTC offset (businessDate(at, offsetHours)). This spec pins that
// behaviour precisely and DOCUMENTS the one place it is inconsistent: across a
// daylight-saving transition a fixed offset misassigns the near-midnight hour.
// That is a missing-policy gap (fixed offset vs IANA zone), recorded here and in
// docs/ops/NOV7_DAY_BOUNDARY_POLICY.md — not silently papered over.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RX = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('midnight boundary: a fixed offset assigns the near-midnight hour deterministically', () => {
  // 2026-01-15 23:30 at UTC-8 (winter / PST) is 2026-01-16T07:30Z.
  expect(RX.businessDate('2026-01-16T07:30:00Z', -8)).toBe('2026-01-15'); // still the 15th locally
  // one hour later crosses local midnight -> the 16th
  expect(RX.businessDate('2026-01-16T08:30:00Z', -8)).toBe('2026-01-16');
});

test('the SAME convention is used for report rows and the export (one basis)', () => {
  const events = [{ type: 'order', at: '2026-01-16T07:30:00Z', amount: 40 }];
  const rows = RX.summarizeLedger(events, { offsetHours: -8 });
  expect(rows[0].report_date).toBe('2026-01-15');
  // the export packages exactly that business date (export naming == report row)
  const m = RX.buildManifest({ history: rows });
  expect(m.coverage.from).toBe('2026-01-15');
  expect(m.payload.reports[0].report_date).toBe('2026-01-15');
});

test('DST GAP (recorded, not fixed): a fixed offset misassigns the near-midnight hour in summer', () => {
  // Summer in US Pacific is PDT = UTC-7. An order at 2026-07-16T07:30Z is, in
  // real Pacific wall-clock, 2026-07-16 00:30 (the 16th). But a FIXED -8 gives:
  expect(RX.businessDate('2026-07-16T07:30:00Z', -8)).toBe('2026-07-15'); // WRONG day under DST
  // and the DST-correct offset (-7) would give the 16th:
  expect(RX.businessDate('2026-07-16T07:30:00Z', -7)).toBe('2026-07-16');
  // => the model cannot be both correct in winter and summer with ONE fixed
  // offset. Picking the convention (fixed offset vs an IANA zone that tracks
  // DST) is an OWNER policy decision, recorded in NOV7_DAY_BOUNDARY_POLICY.md.
  expect(RX.businessDate('2026-07-16T07:30:00Z', -8)).not.toBe(RX.businessDate('2026-07-16T07:30:00Z', -7));
});
