// Sales & Growth — INCIDENT CLASSIFICATION & RECOVERY (pure, local, advisory).
//
// Turns anomaly flags (from he-sales-anomaly.scan) into an owner incident view,
// without building a parallel monitoring platform — it composes the existing
// detector. Reserve IV Wave F:
//   F1  only a real anomaly (CRITICAL/WARNING) becomes an incident; an INFO
//       notice or an ordinary input-validation error does not.
//   F2  repeated identical flags (same kind) collapse to ONE incident with an
//       occurrence count — no duplicate incident noise.
//   F3  each incident names the affected capability, the evidence (value vs
//       baseline), the current mode (always ADVISORY here — nothing is paused
//       automatically), and a safe next action.
//   F5  a disconnected provider is reported DISCONNECTED/UNKNOWN, never healthy
//       or "actively monitored".
//   F6  acknowledging an incident does NOT resolve it; an incident is resolved
//       only when its underlying flag is gone on a later scan.
//
// Pure. Deterministic. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-incidents'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // A flag kind becomes an incident only at these severities (F1).
  const INCIDENT_SEVERITIES = new Set(['CRITICAL', 'WARNING']);

  // The owner-facing capability each anomaly kind affects, and a safe next step.
  // Every next action is something the OWNER does by hand; nothing here acts.
  const KIND_INFO = {
    'reply-rate-collapse': { capability: 'Outreach replies', nextAction: 'Review recent outreach quality and targeting by hand' },
    'bounce-spike': { capability: 'Email deliverability', nextAction: 'Check the lead list for bad addresses before any further outreach' },
    'dnc-spike': { capability: 'Opt-out / DNC', nextAction: 'Pause outreach and review opt-outs; confirm suppression is applied' },
    'sample-conversion-decline': { capability: 'Samples', nextAction: 'Review sample targeting and follow-up on the Sample Operating System page' },
    'ai-cost-spike': { capability: 'AI spend', nextAction: 'Open AI Cost Center; consider the global AI pause' },
    'follow-up-backlog': { capability: 'Follow-ups', nextAction: 'Work the Reply & Follow-up Center queue' },
    'owner-approval-backlog': { capability: 'Owner approvals', nextAction: 'Clear the Sales Approvals queue' },
    'bad-lead-source': { capability: 'Lead sources', nextAction: 'Review Lead Source Quality and pause the weak source' },
  };
  function infoFor(kind) { return KIND_INFO[kind] || { capability: kind, nextAction: 'Review by hand' }; }

  // Build incidents from a list of anomaly flags (scan().anomalies). Dedups by
  // kind (F2); keeps only incident-severity flags (F1).
  function fromFlags(flags) {
    const byKind = new Map();
    for (const f of (flags || [])) {
      if (!f || !INCIDENT_SEVERITIES.has(f.severity)) continue; // F1
      const prev = byKind.get(f.kind);
      if (prev) { prev.occurrences += 1; continue; }            // F2: collapse
      const info = infoFor(f.kind);
      byKind.set(f.kind, {
        kind: f.kind, severity: f.severity,
        capability: info.capability,
        evidence: { value: f.value == null ? null : f.value, baseline: f.baseline == null ? null : f.baseline, detail: f.detail || '' },
        mode: 'ADVISORY',            // nothing is paused/changed automatically
        nextAction: info.nextAction,
        occurrences: 1,
        acknowledged: false,
        resolved: false,
        externalSideEffect: false,
      });
    }
    const incidents = [...byKind.values()];
    const order = { CRITICAL: 0, WARNING: 1 };
    incidents.sort((a, b) => (order[a.severity] - order[b.severity]) || a.kind.localeCompare(b.kind));
    return { incidents, total: incidents.length,
      critical: incidents.filter(i => i.severity === 'CRITICAL').length,
      guard: 'Advisory incidents only. Nothing is paused, sent, or changed automatically; every next action is the owner’s.' };
  }

  // An ordinary input-validation error is NOT an incident (F1).
  function isIncidentFlag(flag) { return !!(flag && INCIDENT_SEVERITIES.has(flag.severity)); }

  // F6: acknowledging records that the owner has seen it — it does NOT resolve.
  function acknowledge(incident, atISO) {
    return Object.assign({}, incident, { acknowledged: true, acknowledgedAt: atISO || null, resolved: incident ? !!incident.resolved : false });
  }

  // F6: reconcile open incidents against the current scan. An incident is
  // resolved ONLY when its kind is absent from the current flags (the condition
  // cleared) — acknowledgement alone never resolves it.
  function reconcile(openIncidents, currentFlags) {
    const live = new Set((currentFlags || []).filter(isIncidentFlag).map(f => f.kind));
    return (openIncidents || []).map(i => Object.assign({}, i, { resolved: !live.has(i.kind), stillOpen: live.has(i.kind) }));
  }

  // F5: provider health is honest — a provider that is not connected is never
  // "healthy" or "monitored".
  function providerHealth(state) {
    const s = state || {};
    if (!s.connected) return { status: 'DISCONNECTED', monitored: false, note: 'Provider not connected; nothing is being monitored.' };
    if (s.lastError) return { status: 'ERROR', monitored: true, note: String(s.lastError).slice(0, 120) };
    if (!s.lastCheckAt) return { status: 'UNKNOWN', monitored: false, note: 'Connected but never checked.' };
    return { status: 'OK', monitored: true, note: 'Connected and checked.' };
  }

  return { INCIDENT_SEVERITIES, KIND_INFO, infoFor, fromFlags, isIncidentFlag, acknowledge, reconcile, providerHealth };
}));
