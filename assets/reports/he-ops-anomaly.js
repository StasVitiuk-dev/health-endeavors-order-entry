// #26 Operations watch — ADVISORY, synthetic-safe, read-only. The sales-side
// detector (he-sales-anomaly) watches outreach figures; this one watches the
// things the business runs on: daily figures, stock and orders. It only RAISES
// flags for a person to look at. It never pauses anything, never changes stock,
// an order or money, and never decides that something is wrong on its own.
//
// Daily figures   revenue-drop, revenue-spike, orders-stopped, missing-day,
//                 revenue-not-measured
// Stock           negative-stock, reserved-over-stock
// Orders          order-total-not-positive, possible-duplicate-order,
//                 unusually-large-order
//
// The thresholds are STARTING VALUES, not tuned on real data (calibrated:false).
// Tuning them is the owner's call once real history exists. An unknown figure is
// never treated as 0: it is skipped for the comparison and reported as a gap.
//
// Review states (same rule as the sales incidents): acknowledging a flag does
// NOT resolve it; a flag is resolved only when a later scan no longer finds it.
//
// Pure. Deterministic. Dual-mode (Node require + browser HE.reports registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-ops-anomaly'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SEVERITY = ['CRITICAL', 'WARNING', 'INFO'];
  const DEFAULTS = Object.freeze({
    minHistoryDays: 3,          // days of known history needed before comparing
    revenueDropRatio: 0.5,      // latest day below 50% of the recent average
    revenueSpikeRatio: 3,       // latest day above 3x the recent average
    ordersStoppedMinAvg: 2,     // "no orders today" only matters if ~2+/day is normal
    largeOrderRatio: 4,         // an order above 4x the typical (median) order
    largeOrderMinOthers: 4,     // ...needs at least 4 other orders to compare with
    duplicateWindowMinutes: 10, // same customer + same total within 10 minutes
  });
  const GUARD = 'Advisory only — nothing is paused, changed or corrected automatically.';
  const NEXT_ACTION = {
    'revenue-drop': 'Open the day\'s orders and check nothing failed to record.',
    'revenue-spike': 'Check the day\'s orders for a double entry before trusting the total.',
    'orders-stopped': 'Check the store and the order intake are working.',
    'missing-day': 'Check the nightly report ran; rerun it for the missing day.',
    'revenue-not-measured': 'Find the order with no amount; the day\'s revenue is unknown until it is fixed.',
    'negative-stock': 'Count this item; stock cannot be below zero.',
    'reserved-over-stock': 'More is promised than is on the shelf — check open orders for this item.',
    'order-total-not-positive': 'Open the order and check its lines and discounts.',
    'possible-duplicate-order': 'Check with the customer before shipping both.',
    'unusually-large-order': 'Confirm the quantities with the customer; this may simply be a good order.',
  };

  const known = (v) => v !== null && v !== undefined && v !== '' && v !== 'UNKNOWN' && isFinite(Number(v));
  const round2 = (n) => Math.round(n * 100) / 100;
  function mean(xs) { return xs.length ? xs.reduce(function (s, x) { return s + x; }, 0) / xs.length : null; }
  function median(xs) { if (!xs.length) return null; const a = xs.slice().sort(function (x, y) { return x - y; }); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function flag(kind, severity, subject, detail, value, baseline) {
    return { key: kind + '|' + subject, kind: kind, severity: severity, subject: String(subject), detail: detail,
      value: value == null ? null : round2(Number(value)), baseline: baseline == null ? null : round2(Number(baseline)),
      nextAction: NEXT_ACTION[kind] || 'Review by hand.' };
  }
  const dayNum = (iso) => { const t = Date.parse(String(iso).slice(0, 10) + 'T00:00:00Z'); return isFinite(t) ? Math.round(t / 86400000) : null; };

  function scanDaily(rows, o, out) {
    const days = (rows || []).filter(function (r) { return r && dayNum(r.report_date) != null; })
      .slice().sort(function (a, b) { return a.report_date < b.report_date ? -1 : a.report_date > b.report_date ? 1 : 0; });
    if (!days.length) return;
    // gaps between the first and last saved day
    for (let i = 1; i < days.length; i++) {
      const gap = dayNum(days[i].report_date) - dayNum(days[i - 1].report_date);
      for (let g = 1; g < gap; g++) {
        const missing = new Date((dayNum(days[i - 1].report_date) + g) * 86400000).toISOString().slice(0, 10);
        out.push(flag('missing-day', 'WARNING', missing, 'no saved report for ' + missing + ' (between ' + days[i - 1].report_date + ' and ' + days[i].report_date + ')', null, null));
      }
    }
    days.forEach(function (r) {
      if (!known(r.revenue) && Number(r.orders_count) > 0) out.push(flag('revenue-not-measured', 'WARNING', r.report_date, r.orders_count + ' order(s) on ' + r.report_date + ' but the revenue was not measured (shown as unknown, not $0)', null, null));
    });
    const latest = days[days.length - 1];
    const prior = days.slice(0, -1);
    const priorRev = prior.filter(function (r) { return known(r.revenue); }).map(function (r) { return Number(r.revenue); });
    if (known(latest.revenue) && priorRev.length >= o.minHistoryDays) {
      const avg = mean(priorRev); const rev = Number(latest.revenue);
      if (avg > 0 && rev < avg * o.revenueDropRatio) out.push(flag('revenue-drop', 'WARNING', latest.report_date, 'revenue on ' + latest.report_date + ' is ' + Math.round((rev / avg) * 100) + '% of the recent daily average', rev, avg));
      if (avg > 0 && rev > avg * o.revenueSpikeRatio) out.push(flag('revenue-spike', 'INFO', latest.report_date, 'revenue on ' + latest.report_date + ' is ' + round2(rev / avg) + 'x the recent daily average', rev, avg));
    }
    const priorOrders = prior.filter(function (r) { return known(r.orders_count); }).map(function (r) { return Number(r.orders_count); });
    if (known(latest.orders_count) && Number(latest.orders_count) === 0 && priorOrders.length >= o.minHistoryDays) {
      const avgO = mean(priorOrders);
      if (avgO >= o.ordersStoppedMinAvg) out.push(flag('orders-stopped', 'WARNING', latest.report_date, 'no orders on ' + latest.report_date + '; the recent average is ' + round2(avgO) + ' a day', 0, avgO));
    }
  }

  function scanStock(stock, out) {
    (stock || []).forEach(function (s) {
      if (!s || !s.sku) return;
      if (known(s.onHand) && Number(s.onHand) < 0) out.push(flag('negative-stock', 'CRITICAL', s.sku, s.sku + ' shows ' + Number(s.onHand) + ' on hand', s.onHand, 0));
      if (known(s.onHand) && known(s.reserved) && Number(s.onHand) >= 0 && Number(s.reserved) > Number(s.onHand)) {
        out.push(flag('reserved-over-stock', 'WARNING', s.sku, s.sku + ': ' + Number(s.reserved) + ' reserved but only ' + Number(s.onHand) + ' on hand', s.reserved, s.onHand));
      }
    });
  }

  function scanOrders(orders, o, out) {
    const list = (orders || []).filter(function (x) { return x && x.id != null && x.status !== 'cancelled' && x.status !== 'canceled'; });
    list.forEach(function (x) {
      if (known(x.total) && Number(x.total) <= 0 && Number(x.itemsCount || 0) > 0) out.push(flag('order-total-not-positive', 'WARNING', x.id, 'order ' + x.id + ' has ' + x.itemsCount + ' item(s) but a total of ' + Number(x.total), x.total, null));
    });
    // same customer + same total within the window (possible double submit)
    const sorted = list.filter(function (x) { return x.customer && known(x.total) && isFinite(Date.parse(x.at)); })
      .slice().sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at) || (String(a.id) < String(b.id) ? -1 : 1); });
    for (let i = 1; i < sorted.length; i++) {
      for (let j = i - 1; j >= 0; j--) {
        const mins = (Date.parse(sorted[i].at) - Date.parse(sorted[j].at)) / 60000;
        if (mins > o.duplicateWindowMinutes) break;
        if (String(sorted[i].customer) === String(sorted[j].customer) && Number(sorted[i].total) === Number(sorted[j].total)) {
          out.push(flag('possible-duplicate-order', 'WARNING', sorted[i].id, 'order ' + sorted[i].id + ' matches order ' + sorted[j].id + ' (same customer, same total, ' + Math.round(mins) + ' min apart)', sorted[i].total, null));
          break;
        }
      }
    }
    const totals = list.filter(function (x) { return known(x.total) && Number(x.total) > 0; });
    totals.forEach(function (x) {
      const others = totals.filter(function (y) { return y !== x; }).map(function (y) { return Number(y.total); });
      if (others.length < o.largeOrderMinOthers) return;
      const med = median(others);
      if (med > 0 && Number(x.total) > med * o.largeOrderRatio) out.push(flag('unusually-large-order', 'INFO', x.id, 'order ' + x.id + ' is ' + round2(Number(x.total) / med) + 'x the typical order', x.total, med));
    });
  }

  // input: { daily:[{report_date, orders_count, revenue}], stock:[{sku,onHand,reserved}],
  //          orders:[{id, customer, total, itemsCount, at, status}] }
  function scan(input, opts) {
    const i = input || {}; const o = Object.assign({}, DEFAULTS, opts || {});
    const out = [];
    scanDaily(i.daily, o, out); scanStock(i.stock, out); scanOrders(i.orders, o, out);
    out.sort(function (a, b) { return SEVERITY.indexOf(a.severity) - SEVERITY.indexOf(b.severity) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); });
    const bySeverity = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    out.forEach(function (f) { bySeverity[f.severity] += 1; });
    return { flags: out, total: out.length, bySeverity: bySeverity, thresholds: o, calibrated: false,
      calibrationNote: 'Thresholds are starting values, not tuned on real history.', advisory: true, guard: GUARD };
  }

  // ---- review states -------------------------------------------------------
  // Carry a previous review list forward over a new scan: a flag still found
  // keeps its acknowledgement; a flag no longer found becomes RESOLVED; a new
  // flag starts OPEN. Pure.
  function review(previousItems, flags) {
    const prev = new Map(); (previousItems || []).forEach(function (p) { prev.set(p.key, p); });
    const now = new Set(); const items = [];
    (flags || []).forEach(function (f) {
      now.add(f.key);
      const p = prev.get(f.key);
      items.push(Object.assign({}, f, { state: p && p.state === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'OPEN', acknowledged: p && p.state === 'ACKNOWLEDGED' ? p.acknowledged : null, resolvedBecause: null }));
    });
    (previousItems || []).forEach(function (p) {
      if (now.has(p.key) || p.state === 'RESOLVED') return;
      items.push(Object.assign({}, p, { state: 'RESOLVED', resolvedBecause: 'no longer found on the latest check' }));
    });
    return items;
  }
  // Acknowledge = "a person has seen this". It does not resolve the flag.
  function acknowledge(items, key, opts) {
    const o = opts || {};
    const it = (items || []).find(function (x) { return x.key === key; });
    if (!it) return { ok: false, reason: 'no such flag', items: items };
    if (it.state === 'RESOLVED') return { ok: false, reason: 'already resolved', items: items };
    if (it.state === 'ACKNOWLEDGED') return { ok: false, reason: 'already acknowledged', items: items };
    const ack = { by: String(o.by || 'unknown'), at: o.at || null };
    return { ok: true, items: items.map(function (x) { return x.key === key ? Object.assign({}, x, { state: 'ACKNOWLEDGED', acknowledged: ack }) : x; }) };
  }
  function summary(items) {
    const c = { OPEN: 0, ACKNOWLEDGED: 0, RESOLVED: 0 };
    (items || []).forEach(function (x) { c[x.state] = (c[x.state] || 0) + 1; });
    return { open: c.OPEN, acknowledged: c.ACKNOWLEDGED, resolved: c.RESOLVED, stillPresent: c.OPEN + c.ACKNOWLEDGED };
  }

  function fixtures() {
    return {
      daily: [
        { report_date: '2026-11-08', orders_count: 6, revenue: 310 },
        { report_date: '2026-11-09', orders_count: 5, revenue: 280 },
        { report_date: '2026-11-10', orders_count: 7, revenue: 350 },
        // 2026-11-11 missing
        { report_date: '2026-11-12', orders_count: 4, revenue: null },   // orders but revenue not measured
        { report_date: '2026-11-13', orders_count: 2, revenue: 95 },     // well under the recent average
      ],
      stock: [
        { sku: 'SYN-HONEY-8OZ', onHand: 40, reserved: 12 },
        { sku: 'SYN-VEGAN-8OZ', onHand: -3, reserved: 0 },               // impossible
        { sku: 'SYN-SHEA-4OZ', onHand: 5, reserved: 9 },                 // promised more than on the shelf
      ],
      orders: [
        { id: 'SYN-1001', customer: 'SYN-C1', total: 37, itemsCount: 2, at: '2026-11-13T15:00:00Z' },
        { id: 'SYN-1002', customer: 'SYN-C2', total: 55.5, itemsCount: 3, at: '2026-11-13T15:20:00Z' },
        { id: 'SYN-1003', customer: 'SYN-C2', total: 55.5, itemsCount: 3, at: '2026-11-13T15:24:00Z' }, // 4 min later, same customer + total
        { id: 'SYN-1004', customer: 'SYN-C3', total: 0, itemsCount: 1, at: '2026-11-13T16:00:00Z' },    // items but no total
        { id: 'SYN-1005', customer: 'SYN-C4', total: 42, itemsCount: 2, at: '2026-11-13T17:00:00Z' },
        { id: 'SYN-1006', customer: 'SYN-C5', total: 480, itemsCount: 24, at: '2026-11-13T18:00:00Z' }, // far above typical
      ],
    };
  }

  return { SEVERITY, DEFAULTS, GUARD, NEXT_ACTION, scan, review, acknowledge, summary, fixtures };
}));
