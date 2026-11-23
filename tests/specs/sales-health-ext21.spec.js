// #25 Service Health model. Pure, Node-only, synthetic. From a job's own signals
// (enabled/paused/lastRun/lastSuccess/lastError) derive an honest STATE and the
// NEXT OPERATOR ACTION. A missing signal never reads as healthy. Read-only.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const A = require('../../assets/sales/he-sales-agents.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

const NOW = '2026-11-13T12:00:00Z';

test('each synthetic failure state maps to a distinct state and a next operator action', () => {
  const fx = A.healthFixtures();
  const rows = A.healthRows(fx.jobs, fx.now, fx.staleAfterHours);
  const byName = Object.fromEntries(rows.map(r => [r.name, r]));
  expect(byName['Nightly integrity check'].state).toBe('OK');
  expect(byName['Daily report roll-up'].state).toBe('STALE');
  expect(byName['Tracking sync (simulated)'].state).toBe('ERROR');
  expect(byName['Reorder point scan'].state).toBe('NEVER_RUN');
  expect(byName['Review digest'].state).toBe('PAUSED');
  expect(byName['Creator scout'].state).toBe('OFF');
  // Every row carries a next operator action, and the ones needing attention are non-trivial.
  for (const r of rows) expect(typeof r.nextAction).toBe('string');
  expect(byName['Tracking sync (simulated)'].nextAction).toMatch(/Review the last error/);
  expect(byName['Daily report roll-up'].nextAction).toMatch(/scheduler/);
});

test('an error is unresolved until a later success clears it', () => {
  // lastError present, no success after it -> ERROR.
  const errored = A.jobHealth({ name: 'j', enabled: true, mode: 'READ_ONLY', lastRun: '2026-11-13T11:00:00Z', lastSuccess: '2026-11-12T00:00:00Z', lastError: 'boom' }, NOW, 24);
  expect(errored.state).toBe('ERROR');
  // a success after the error -> OK (recovered).
  const recovered = A.jobHealth({ name: 'j', enabled: true, mode: 'READ_ONLY', lastRun: '2026-11-13T11:00:00Z', lastSuccess: '2026-11-13T11:00:00Z', lastError: 'boom', lastErrorAt: '2026-11-10T00:00:00Z' }, NOW, 24);
  expect(recovered.state).toBe('OK');
});

test('staleness is measured against an explicit threshold', () => {
  const job = { name: 'j', enabled: true, mode: 'READ_ONLY', lastRun: '2026-11-12T00:00:00Z', lastSuccess: '2026-11-12T00:00:00Z' }; // 36h before NOW
  expect(A.jobHealth(job, NOW, 24).state).toBe('STALE');   // > 24h
  expect(A.jobHealth(job, NOW, 48).state).toBe('OK');      // within 48h
});

test('paused and off are distinct from a failure and advise no remediation', () => {
  const paused = A.jobHealth({ name: 'p', enabled: true, mode: 'READ_ONLY', paused: true }, NOW, 24);
  expect(paused.state).toBe('PAUSED');
  expect(paused.nextAction).toMatch(/Resume/);
  const off = A.jobHealth({ name: 'o', enabled: false, mode: 'OFF' }, NOW, 24);
  expect(off.state).toBe('OFF');
  expect(off.nextAction).toMatch(/No action needed/);
});

test('the summary counts states and names the first action to take', () => {
  const fx = A.healthFixtures();
  const s = A.healthSummary(fx.jobs, fx.now, fx.staleAfterHours);
  expect(s.total).toBe(6);
  expect(s.counts.STALE + s.counts.ERROR).toBe(s.needsAttention);
  expect(s.needsAttention).toBeGreaterThanOrEqual(2);
  expect(typeof s.firstAction).toBe('string');
  // The default advisory agent roster is all OFF, so it needs no attention.
  const off = A.healthSummary(undefined, NOW, 24);
  expect(off.needsAttention).toBe(0);
});
