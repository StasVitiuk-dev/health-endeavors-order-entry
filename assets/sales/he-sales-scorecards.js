// Sales & Growth — AGENT SCORECARDS, run history & failure analysis (pure, local).
//
// Turns a list of synthetic agent-run records into per-agent scorecards
// (correctness, unsafe-output rate, UNKNOWN rate, owner-edit rate, approval
// rate, avg cost, avg latency), groups failures by cause, and reports simple
// trends across periods. Advisory reporting only.
//
// A run record (all synthetic): { agent, at, result: 'ok'|'fail', failure?,
//   unsafe?, unknown?, ownerEdited?, approved?, cost?, latencyMs?, provider?, model? }
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-scorecards'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FAILURE_KINDS = ['timeout', 'malformed', 'unsafe-output', 'budget-block', 'stale-response', 'permission-block', 'unknown'];

  function rate(n, d) { return d ? +(n / d).toFixed(3) : null; }
  function avg(xs) { const a = (xs || []).filter(x => typeof x === 'number'); return a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(4) : null; }

  // Per-agent scorecard from run records.
  function scorecards(runs) {
    const byAgent = {};
    for (const r of (runs || [])) (byAgent[r.agent] || (byAgent[r.agent] = [])).push(r);
    return Object.entries(byAgent).map(([agent, rs]) => {
      const n = rs.length;
      const ok = rs.filter(r => r.result === 'ok').length;
      return {
        agent, runs: n,
        correctness: rate(ok, n), correctnessLabel: n ? 'MEASURED' : 'UNKNOWN',
        unsafeRate: rate(rs.filter(r => r.unsafe).length, n),
        unknownRate: rate(rs.filter(r => r.unknown).length, n),
        ownerEditRate: rate(rs.filter(r => r.ownerEdited).length, n),
        approvalRate: rate(rs.filter(r => r.approved).length, n),
        avgCost: avg(rs.map(r => r.cost)),
        avgLatencyMs: avg(rs.map(r => r.latencyMs)),
      };
    }).sort((a, b) => (b.runs - a.runs));
  }

  // Group failures by cause across all runs.
  function failureAnalysis(runs) {
    const byKind = {}; for (const k of FAILURE_KINDS) byKind[k] = 0;
    for (const r of (runs || [])) if (r.result === 'fail') { const k = FAILURE_KINDS.includes(r.failure) ? r.failure : 'unknown'; byKind[k]++; }
    const total = Object.values(byKind).reduce((a, b) => a + b, 0);
    return { byKind, total, top: FAILURE_KINDS.slice().sort((a, b) => byKind[b] - byKind[a])[0] };
  }

  // Trend of a metric across labelled periods. Each period: { label, runs }.
  // metric is one of the scorecard rate fields; returns per-period values + direction.
  function trend(periods, agent, metric) {
    const vals = (periods || []).map(p => {
      const cards = scorecards((p.runs || []).filter(r => !agent || r.agent === agent));
      const total = cards.reduce((s, c) => s + (c[metric] != null ? c[metric] * c.runs : 0), 0);
      const runs = cards.reduce((s, c) => s + c.runs, 0);
      return { label: p.label, value: runs ? +(total / runs).toFixed(3) : null };
    });
    const known = vals.filter(v => v.value != null);
    let direction = 'UNKNOWN';
    if (known.length >= 2) {
      const d = known[known.length - 1].value - known[0].value;
      direction = Math.abs(d) < 0.01 ? 'FLAT' : d > 0 ? 'UP' : 'DOWN';
    }
    return { metric, agent: agent || 'ALL', points: vals, direction };
  }

  return { FAILURE_KINDS, rate, avg, scorecards, failureAnalysis, trend };
}));
