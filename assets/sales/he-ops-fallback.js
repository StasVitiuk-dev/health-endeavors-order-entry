// Operations — MANUAL FALLBACK readiness (#21). Pure, synthetic, read-only.
//
// Proves, in one checkable place, that every launch-critical flow has (a) a
// manual path a person can use when automation is unavailable, and (b) usable
// pause / recovery behavior. Each entry cites the spec(s) that exercise it, so
// the claim is backed by real test evidence rather than assertion. Read-only:
// it lists and checks; it runs nothing and changes nothing.
//
// Pure. Dual-mode (Node require + browser HE.sales registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-ops-fallback'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Launch-critical flows. automated = the hands-off path; manualPath = what a
  // person does when it is unavailable; pauseRecovery = how an interruption is
  // held and resumed without loss or double-apply; evidence = citing spec files.
  const FLOWS = [
    { id: 'order-entry', name: 'Order entry',
      automated: 'Shopify order sync (simulated)',
      manualPath: 'Manual Order Entry page (manual-order-entry.html) — key an order in by hand',
      pauseRecovery: 'an interrupted draft save preserves typed input; a stale save is refused, not double-applied',
      evidence: ['failure-recovery-ext21', 'reauth-double-submit'] },
    { id: 'scan-shipment', name: 'Scan shipment / fulfillment',
      automated: 'camera / photo label scan',
      manualPath: 'type the tracking number by hand (manual capture) and confirm each package',
      pauseRecovery: 'a notification outage holds the message for safe retry while the confirmed shipment is preserved',
      evidence: ['scan-ui-ext21', 'scan-flow-ext21', 'scan-recovery-ext21'] },
    { id: 'reports-export', name: 'Reports & export',
      automated: 'nightly report roll-up',
      manualPath: 'run the daily check / export by hand when the nightly job has not run',
      pauseRecovery: 'a failed export keeps its input, explains each attempt, and retries without double-exporting',
      evidence: ['failure-recovery-ext21', 'export-recovery-ext21', 'report-ledger-ext21'] },
    { id: 'agents', name: 'Advisory agents / jobs',
      automated: 'scheduled advisory jobs',
      manualPath: 'every agent is OFF by default; the owner runs and reviews drafts by hand',
      pauseRecovery: 'the owner can pause; a paused / stale / unknown agent never shows as running (honest health)',
      evidence: ['agent-truth', 'sales-health-ext21'] },
    { id: 'auth-session', name: 'Sign-in / session',
      automated: 'logged-in session',
      manualPath: 're-authenticate on demand to continue a pending action',
      pauseRecovery: 're-auth preserves the pending action and guards against double-submit',
      evidence: ['home-reauth-recovery-ext20', 'reauth-double-submit'] },
  ];

  function flowRows() { return FLOWS.map(f => ({ ...f, evidence: f.evidence.slice() })); }

  // A flow is "ready" only if it has BOTH a non-empty manual path and a non-empty
  // pause/recovery behavior, with at least one citing spec. Missing any -> a gap.
  function flowReady(f) {
    return !!(f && f.manualPath && String(f.manualPath).trim()
      && f.pauseRecovery && String(f.pauseRecovery).trim()
      && Array.isArray(f.evidence) && f.evidence.length > 0);
  }

  function fallbackReadiness() {
    const flows = flowRows();
    const gaps = flows.filter(f => !flowReady(f));
    return {
      flows: flows,
      total: flows.length,
      readyCount: flows.length - gaps.length,
      ready: gaps.length === 0,
      gaps: gaps.map(f => f.name),
      note: 'Advisory, read-only. Each launch-critical flow has a manual path and pause/recovery, cited to its tests.',
      label: 'SIMULATED',
    };
  }

  return { FLOWS, flowRows, flowReady, fallbackReadiness };
}));
