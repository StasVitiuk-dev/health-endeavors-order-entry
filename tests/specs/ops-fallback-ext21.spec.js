// #21 Manual fallback readiness. Pure, Node-only, synthetic. Proves every
// launch-critical flow has a manual path and pause/recovery behavior, each
// cited to a spec that exists. Read-only — lists and checks, runs nothing.
const base = require('@playwright/test');
const test = base.test;
const expect = base.expect;
const fs = require('fs');
const path = require('path');
const F = require('../../assets/sales/he-ops-fallback.js');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'desktop', 'Node-only; run once'); });

test('every launch-critical flow has a manual path, pause/recovery, and cited evidence', () => {
  const r = F.fallbackReadiness();
  expect(r.ready).toBe(true);
  expect(r.gaps).toEqual([]);
  expect(r.readyCount).toBe(r.total);
  // The launch-critical set is covered.
  const ids = r.flows.map(f => f.id);
  for (const id of ['order-entry', 'scan-shipment', 'reports-export', 'agents', 'auth-session']) {
    expect(ids).toContain(id);
  }
  for (const f of r.flows) {
    expect(f.manualPath && f.manualPath.trim().length).toBeTruthy();
    expect(f.pauseRecovery && f.pauseRecovery.trim().length).toBeTruthy();
    expect(f.evidence.length).toBeGreaterThan(0);
  }
});

test('a flow missing a manual path or pause/recovery is reported as a gap', () => {
  expect(F.flowReady({ name: 'x', manualPath: '', pauseRecovery: 'y', evidence: ['z'] })).toBe(false);
  expect(F.flowReady({ name: 'x', manualPath: 'm', pauseRecovery: '', evidence: ['z'] })).toBe(false);
  expect(F.flowReady({ name: 'x', manualPath: 'm', pauseRecovery: 'p', evidence: [] })).toBe(false);
  expect(F.flowReady({ name: 'x', manualPath: 'm', pauseRecovery: 'p', evidence: ['z'] })).toBe(true);
});

test('every cited evidence spec file actually exists (claims are backed by real tests)', () => {
  const specDir = path.join(__dirname);
  for (const f of F.flowRows()) {
    for (const ev of f.evidence) {
      const p = path.join(specDir, ev + '.spec.js');
      expect(fs.existsSync(p), `${f.id} cites ${ev} which must exist`).toBe(true);
    }
  }
});
