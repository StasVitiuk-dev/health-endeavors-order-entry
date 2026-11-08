// Export recovery drill (wave-1 item 5). Pure, Node-only, synthetic. A clean
// package opens; a missing entry file and a bad checksum are each rejected
// before anything is applied; an unsupported schema version is refused up front
// so a newer package never half-applies. The manifest records its schema
// version and coverage, and names automatic Mac sync as a SEPARATE component.
// No real file, backup or sync is touched.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const RX = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const history = [
  { report_date: '2026-11-05', currency: 'USD', orders_count: 3, revenue: 120.5, ai_calls_count: 10, ai_cost: 0.42 },
  { report_date: '2026-11-06', currency: 'USD', orders_count: 0, revenue: 0, ai_calls_count: 4, ai_cost: 0.11 },
  { report_date: '2026-11-07', currency: 'USD', orders_count: 5, revenue: null, ai_calls_count: 7, ai_cost: 0.33 },
];

test('manifest records schema version + coverage and names the Mac-sync dependency', () => {
  const m = RX.buildManifest({ history, now: '2026-11-08' });
  expect(m.schemaVersion).toBe(RX.SCHEMA_VERSION);
  expect(m.coverage.days).toBe(3);
  expect(m.coverage.from).toBe('2026-11-05');
  expect(m.coverage.to).toBe('2026-11-07');
  expect(m.macSync.automatic).toBe(false);
  expect(m.macSync.dependency).toMatch(/separate native background component/);
  expect(m.macSync.dependency).toMatch(/existing backups are untouched/);
});

test('a clean package opens and reports its coverage', () => {
  const pkg = RX.packageOf(RX.buildManifest({ history }));
  const r = RX.openPackage(pkg);
  expect(r.ok).toBe(true);
  expect(r.applied).toBe(true);
  expect(r.coverage.days).toBe(3);
});

test('a missing entry file is rejected before anything is applied', () => {
  const pkg = RX.packageOf(RX.buildManifest({ history }));
  const present = pkg.entries.filter(n => n !== 'summary.json'); // one file missing
  const r = RX.openPackage(pkg, { present });
  expect(r.ok).toBe(false);
  expect(r.stage).toBe('files');
  expect(r.applied).toBe(false);
  expect(r.reason).toMatch(/missing file/);
});

test('a bad checksum is rejected (package altered) with nothing applied', () => {
  const pkg = RX.packageOf(RX.buildManifest({ history }));
  pkg.payload.reports[0].orders_count = 999; // tamper after packaging
  const r = RX.openPackage(pkg);
  expect(r.ok).toBe(false);
  expect(r.stage).toBe('checksum');
  expect(r.applied).toBe(false);
});

test('an unsupported schema version is refused up front (no partial restore)', () => {
  const pkg = RX.packageOf(RX.buildManifest({ history }));
  pkg.schemaVersion = 99; // from a newer build
  const r = RX.openPackage(pkg);
  expect(r.ok).toBe(false);
  expect(r.stage).toBe('schema');
  expect(r.applied).toBe(false);
  expect(r.reason).toMatch(/unsupported schema version/);
});
