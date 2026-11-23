// #17 intake protections + #72 export watermarking. Pure, Node-only, synthetic.
// Intake: a per-submitter sliding-window cap + cooldown, graceful rejection with
// a retry-after, a missing id cannot bypass. Export: a traceable label bound to
// the manifest content, verifiable, tamper-evident. Nothing is sent or altered.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const G = require('../../assets/intake/he-intake-guard.js');
const L = require('../../assets/reports/he-export-label.js');
const RX = require('../../assets/reports/he-report-export.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('#17 intake: the window cap refuses over-limit submissions gracefully (no crash, a retry-after)', () => {
  const lim = G.createIntakeLimiter({ windowMs: 60000, maxPerWindow: 3 });
  const base = 1000;
  expect(lim.check('buyer@x.test', base).allowed).toBe(true);
  expect(lim.check('buyer@x.test', base + 100).allowed).toBe(true);
  expect(lim.check('buyer@x.test', base + 200).allowed).toBe(true);
  const over = lim.check('buyer@x.test', base + 300);
  expect(over.allowed).toBe(false);
  expect(over.reason).toMatch(/too many/);
  expect(over.retryAfterMs).toBeGreaterThan(0);
  // the window slides: once the oldest hit ages out, a submission is allowed again.
  expect(lim.check('buyer@x.test', base + 61000).allowed).toBe(true);
});

test('#17 intake: a missing / blank submitter id cannot bypass the limit', () => {
  expect(G.keyOf('')).toBe('anonymous');
  expect(G.keyOf(null)).toBe('anonymous');
  const lim = G.createIntakeLimiter({ windowMs: 60000, maxPerWindow: 2 });
  lim.check('', 0); lim.check(null, 1);
  expect(lim.check(undefined, 2).allowed).toBe(false); // all collapse to one bucket
});

test('#17 intake: a cooldown spaces out rapid submissions, then clears', () => {
  const lim = G.createIntakeLimiter({ maxPerWindow: 100, cooldownMs: 5000 });
  expect(lim.check('a', 0).allowed).toBe(true);
  const soon = lim.check('a', 1000);
  expect(soon.allowed).toBe(false);
  expect(soon.reason).toMatch(/cooldown/);
  expect(lim.check('a', 6000).allowed).toBe(true);
});

test('#17 intake: a dry-run check never consumes the budget', () => {
  const lim = G.createIntakeLimiter({ windowMs: 60000, maxPerWindow: 1 });
  expect(lim.check('a', 0, { dryRun: true }).allowed).toBe(true);
  expect(lim.countFor('a', 0)).toBe(0);           // nothing recorded
  expect(lim.check('a', 1).allowed).toBe(true);   // the real budget is intact
});

test('#72 export: a manifest gets a traceable watermark bound to its content', () => {
  const m = RX.buildManifest({ history: [{ report_date: '2026-11-13', orders_count: 5, revenue: 150 }], from: '2026-11-13', to: '2026-11-13' });
  const lab = L.labelExport(m, { exportedBy: 'owner', at: '2026-11-14T10:00:00Z', purpose: 'owner review', classification: 'CONFIDENTIAL' });
  expect(lab.watermark).toContain('CONFIDENTIAL');
  expect(lab.watermark).toContain(lab.traceId);
  expect(lab.watermark).toContain('owner');
  expect(lab.manifestChecksum).toBe(m.checksum);
  // deterministic: same inputs -> same trace id.
  const lab2 = L.labelExport(m, { exportedBy: 'owner', at: '2026-11-14T10:00:00Z', purpose: 'owner review', classification: 'CONFIDENTIAL' });
  expect(lab2.traceId).toBe(lab.traceId);
});

test('#72 export: verifyLabel confirms a match and detects tampering', () => {
  const m = RX.buildManifest({ history: [{ report_date: '2026-11-13', orders_count: 5, revenue: 150 }], from: '2026-11-13', to: '2026-11-13' });
  const lab = L.labelExport(m, { exportedBy: 'owner', at: '2026-11-14T10:00:00Z' });
  expect(L.verifyLabel(lab, m).ok).toBe(true);
  // a different manifest (content changed) fails verification.
  const m2 = RX.buildManifest({ history: [{ report_date: '2026-11-13', orders_count: 9, revenue: 999 }], from: '2026-11-13', to: '2026-11-13' });
  expect(L.verifyLabel(lab, m2).ok).toBe(false);
  // an altered trace id fails verification.
  expect(L.verifyLabel({ ...lab, traceId: 'deadbeef' }, m).reason).toMatch(/trace id altered/);
});
