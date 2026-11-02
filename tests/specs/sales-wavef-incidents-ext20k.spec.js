// Reserve IV — WAVE F: incident classification & recovery. Composes the existing
// anomaly detector. F1 only real anomalies become incidents; F2 duplicates
// collapse; F3 each incident names capability/evidence/mode/next-action; F5 a
// disconnected provider is never healthy; F6 acknowledge != resolved.
// Pure, deterministic. Node-only (desktop project).
const { test, expect } = require('@playwright/test');
const INC = require('../../assets/sales/he-sales-incidents.js');
const AN = require('../../assets/sales/he-sales-anomaly.js');

test.beforeEach(({}, ti) => { test.skip(ti.project.name !== 'desktop', 'Node-only; run once'); });

const flag = (kind, severity, value, baseline) => ({ kind, severity, detail: 'd', value, baseline });

test('F1: only CRITICAL/WARNING flags become incidents; INFO does not', () => {
  const r = INC.fromFlags([flag('dnc-spike', 'CRITICAL', 10, 2), flag('note', 'INFO', 1, 1)]);
  expect(r.total).toBe(1);
  expect(r.incidents[0].kind).toBe('dnc-spike');
  expect(INC.isIncidentFlag({ severity: 'INFO' })).toBe(false);
  expect(INC.isIncidentFlag({ severity: 'CRITICAL' })).toBe(true);
});

test('F2: repeated identical flags collapse into one incident with an occurrence count', () => {
  const r = INC.fromFlags([
    flag('ai-cost-spike', 'WARNING', 4, 1),
    flag('ai-cost-spike', 'WARNING', 5, 1),
    flag('ai-cost-spike', 'WARNING', 6, 1),
  ]);
  expect(r.total).toBe(1);
  expect(r.incidents[0].occurrences).toBe(3);
});

test('F3: each incident names capability, evidence, advisory mode, and a safe next action', () => {
  const r = INC.fromFlags([flag('dnc-spike', 'CRITICAL', 10, 2)]);
  const i = r.incidents[0];
  expect(i.capability).toMatch(/opt-out|dnc/i);
  expect(i.evidence.value).toBe(10);
  expect(i.evidence.baseline).toBe(2);
  expect(i.mode).toBe('ADVISORY');
  expect(i.nextAction).toMatch(/pause outreach|review opt-outs/i);
  expect(i.externalSideEffect).toBe(false);
  expect(r.guard).toMatch(/nothing is paused/i);
});

test('incidents sort critical-first, deterministically', () => {
  const r = INC.fromFlags([flag('ai-cost-spike', 'WARNING', 4, 1), flag('dnc-spike', 'CRITICAL', 9, 2)]);
  expect(r.incidents.map(i => i.kind)).toEqual(['dnc-spike', 'ai-cost-spike']);
  expect(r.critical).toBe(1);
});

test('F6: acknowledge records acknowledgement but never resolves', () => {
  const r = INC.fromFlags([flag('bounce-spike', 'WARNING', 0.2, 0.05)]);
  const ack = INC.acknowledge(r.incidents[0], '2026-10-27T00:00:00Z');
  expect(ack.acknowledged).toBe(true);
  expect(ack.acknowledgedAt).toBe('2026-10-27T00:00:00Z');
  expect(ack.resolved).toBe(false); // acknowledgement is not resolution
});

test('F6: reconcile resolves an incident only when its flag is gone next scan', () => {
  const open = INC.fromFlags([flag('bounce-spike', 'WARNING', 0.2, 0.05), flag('dnc-spike', 'CRITICAL', 9, 2)]).incidents;
  // next scan: bounce cleared, dnc still firing
  const next = [flag('dnc-spike', 'CRITICAL', 8, 2)];
  const rec = INC.reconcile(open, next);
  const byKind = Object.fromEntries(rec.map(i => [i.kind, i]));
  expect(byKind['bounce-spike'].resolved).toBe(true);   // gone -> resolved
  expect(byKind['dnc-spike'].resolved).toBe(false);     // still firing -> open
  expect(byKind['dnc-spike'].stillOpen).toBe(true);
});

test('F5: a disconnected provider is never reported healthy or monitored', () => {
  expect(INC.providerHealth({ connected: false }).status).toBe('DISCONNECTED');
  expect(INC.providerHealth({ connected: false }).monitored).toBe(false);
  expect(INC.providerHealth({ connected: true, lastError: 'timeout' }).status).toBe('ERROR');
  expect(INC.providerHealth({ connected: true }).status).toBe('UNKNOWN'); // never checked
  expect(INC.providerHealth({ connected: true, lastCheckAt: '2026-10-27' }).status).toBe('OK');
});

test('integrates with the real anomaly scan output', () => {
  const scan = AN.scan({ dncToday: 12, dncBaseline: 2, aiCostToday: 5, aiCostBaseline: 1, approvalBacklog: 40 });
  const r = INC.fromFlags(scan.anomalies);
  expect(r.total).toBeGreaterThan(0);
  // every incident came from an incident-severity flag
  for (const i of r.incidents) expect(['CRITICAL', 'WARNING']).toContain(i.severity);
});

test('empty / validation-only input yields no incidents', () => {
  expect(INC.fromFlags([]).total).toBe(0);
  expect(INC.fromFlags([flag('x', 'INFO', 1, 1)]).total).toBe(0);
});
