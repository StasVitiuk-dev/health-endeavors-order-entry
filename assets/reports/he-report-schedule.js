// #70/#71 Scheduled reports + versioning. Pure, synthetic, local. Models the
// locally-buildable part of report scheduling without any real provider:
//   * daily report generation checked against an expected schedule (which days
//     ran, which were missed);
//   * IMMUTABLE report versions — a generated report is frozen and keyed by date
//     and version; a rerun never overwrites, it appends a new version with its
//     own content checksum, so history is preserved and auditable;
//   * SIMULATED delivery states (queued / held / sent / failed) with safe retry —
//     nothing is actually emailed; a real email provider is a named dependency.
//
// Pure. Dual-mode (Node require + browser HE.reports registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-report-schedule'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DELIVERY_STATES = ['QUEUED', 'HELD', 'SENT', 'FAILED'];
  // Legal simulated delivery transitions. SENT is terminal-successful; HELD and
  // FAILED can return to QUEUED for a safe retry. No real send ever happens.
  const DELIVERY_NEXT = { QUEUED: ['SENT', 'HELD', 'FAILED'], HELD: ['QUEUED'], FAILED: ['QUEUED'], SENT: [] };
  const DELIVERY_DEPENDENCY = 'business email provider — not connected in the local build (delivery is simulated only).';

  // Deterministic content checksum (FNV-1a over canonical JSON), so a rerun that
  // changes the numbers gets a different checksum and an identical one does not.
  function canonical(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  function checksumOf(rows) {
    const s = canonical(rows || []);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function freezeDeep(o) {
    if (o && typeof o === 'object') { Object.keys(o).forEach(k => freezeDeep(o[k])); Object.freeze(o); }
    return o;
  }

  function createReportBook() {
    const byDate = {}; // reportDate -> [version records]

    function generate(reportDate, rows, atISO) {
      if (!reportDate) return { ok: false, reason: 'reportDate is required' };
      const list = byDate[reportDate] || (byDate[reportDate] = []);
      const version = list.length + 1;
      const rec = freezeDeep({
        reportDate: reportDate, version: version, rows: (rows || []).map(r => ({ ...r })),
        checksum: checksumOf(rows), generatedAt: atISO || null,
        rerun: version > 1, immutable: true, synthetic: true, label: 'SIMULATED',
      });
      list.push(rec);
      return { ok: true, version: rec, isRerun: rec.rerun };
    }
    return {
      generate: generate,
      versions: function (reportDate) { return (byDate[reportDate] || []).slice(); },
      latest: function (reportDate) { const l = byDate[reportDate] || []; return l.length ? l[l.length - 1] : null; },
      allDates: function () { return Object.keys(byDate).sort(); },
      // Which expected dates ran and which were missed (scheduling check).
      scheduleStatus: function (expectedDates) {
        const expected = (expectedDates || []).slice().sort();
        const present = expected.filter(d => (byDate[d] || []).length > 0);
        const missing = expected.filter(d => !(byDate[d] || []).length);
        return { expected: expected, present: present, missing: missing, complete: missing.length === 0 };
      },
    };
  }

  // --- Simulated delivery (no real email ever leaves) ---
  function canDeliveryTransition(from, to) { return (DELIVERY_NEXT[from] || []).indexOf(to) !== -1; }
  function queueDelivery(version, channel, atISO) {
    if (!version || !version.reportDate) return { ok: false, reason: 'a report version is required' };
    return {
      reportDate: version.reportDate, version: version.version, checksum: version.checksum,
      channel: channel || 'email', state: 'QUEUED', queuedAt: atISO || null,
      delivered: false, sent: false, real: false, dependency: DELIVERY_DEPENDENCY,
      history: ['QUEUED'], synthetic: true, label: 'SIMULATED',
    };
  }
  function applyDelivery(record, to, atISO) {
    if (!record) return { ok: false, reason: 'no delivery record' };
    if (DELIVERY_STATES.indexOf(to) === -1) return { ok: false, reason: 'unknown delivery state: ' + to };
    if (!canDeliveryTransition(record.state, to)) return { ok: false, reason: 'illegal transition ' + record.state + ' -> ' + to, state: record.state };
    const next = { ...record, state: to, history: record.history.concat([to]) };
    // SENT here means SIMULATED sent — delivered/sent/real stay false by design.
    if (to === 'SENT') { next.simulatedSentAt = atISO || null; next.note = 'simulated — no email provider connected'; }
    return { ok: true, record: next };
  }

  function scheduleFixtures() {
    return {
      expected: ['2026-11-11', '2026-11-12', '2026-11-13'],
      day11: [{ report_date: '2026-11-11', orders_count: 3, revenue: 100 }],
      day13: [{ report_date: '2026-11-13', orders_count: 5, revenue: 150 }],
      day13v2: [{ report_date: '2026-11-13', orders_count: 6, revenue: 180 }], // a corrected rerun
    };
  }

  return { DELIVERY_STATES, DELIVERY_NEXT, DELIVERY_DEPENDENCY, checksumOf, createReportBook, canDeliveryTransition, queueDelivery, applyDelivery, scheduleFixtures };
}));
