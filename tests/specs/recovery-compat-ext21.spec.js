// Recovery with older/supported fixtures (wave-2 item 3). Pure, Node-only,
// synthetic. Opening a supported-schema package preserves each record's
// identity and data (report_date as the row id, counts, status fields); a
// package whose identity was altered fails the checksum before anything is
// applied; and an unsupported schema version (older-incompatible or newer) is
// refused up front, never a partial restore. No real file is touched.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RX = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

// A fixture "written by a prior build" at the supported schema version, with a
// per-row id and status beyond the core metrics.
const fixture = [
  { report_date: '2026-10-01', currency: 'USD', orders_count: 4, revenue: 210.75, status: 'emailed', emailed_at: '2026-10-02' },
  { report_date: '2026-10-02', currency: 'USD', orders_count: 2, revenue: 88.00, status: 'saved' },
];

test('a supported-schema package opens and every record keeps its id, data and status', () => {
  const manifest = RX.buildManifest({ history: fixture });
  expect(manifest.schemaVersion).toBe(RX.SCHEMA_VERSION);
  const pkg = RX.packageOf(manifest);
  const r = RX.openPackage(pkg);
  expect(r.ok).toBe(true);
  expect(r.applied).toBe(true);
  // identity + data are retained row-for-row (report_date is the record id)
  const rows = pkg.payload.reports;
  expect(rows.map(x => x.report_date)).toEqual(['2026-10-01', '2026-10-02']);
  expect(rows[0].orders_count).toBe(4);
  expect(rows[0].revenue).toBe(210.75);
  expect(rows[0].emailed).toBe(true);        // emailed_at normalized to the emailed flag (status retained)
  expect(r.coverage.days).toBe(2);
});

test("a record's identity cannot be altered unnoticed (checksum covers it)", () => {
  const pkg = RX.packageOf(RX.buildManifest({ history: fixture }));
  // change a report_date (the record id) after packaging
  pkg.payload.reports[0].report_date = '2025-01-01';
  const r = RX.openPackage(pkg);
  expect(r.ok).toBe(false);
  expect(r.stage).toBe('checksum');
  expect(r.applied).toBe(false);             // nothing restored from a tampered package
});

test('an unsupported schema version is refused before any partial restore', () => {
  // older, incompatible
  const older = RX.packageOf(RX.buildManifest({ history: fixture })); older.schemaVersion = 0;
  const r0 = RX.openPackage(older);
  expect(r0.ok).toBe(false); expect(r0.stage).toBe('schema'); expect(r0.applied).toBe(false);
  // newer than this build understands
  const newer = RX.packageOf(RX.buildManifest({ history: fixture })); newer.schemaVersion = RX.SCHEMA_VERSION + 1;
  const r9 = RX.openPackage(newer);
  expect(r9.ok).toBe(false); expect(r9.stage).toBe('schema'); expect(r9.applied).toBe(false);
});
