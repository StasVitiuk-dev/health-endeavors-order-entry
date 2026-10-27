// Sales & Growth — RETENTION analysis (pure, deterministic, synthetic/local only).
//
// Classifies wholesale customers into retention segments from their order
// history, suggests reorder/win-back/review candidates, and reports average
// reorder interval with a confidence label. It never messages anyone: it only
// produces advisory segments and candidate lists for the owner to act on by
// hand. Insufficient history yields UNKNOWN, never a fabricated number.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-retention'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SEGMENTS = ['NEW', 'REPEAT', 'VIP', 'AT_RISK', 'INACTIVE', 'LOST', 'UNKNOWN'];
  const DAY = 86400000;

  function days(from, to) {
    const a = Date.parse(from), b = Date.parse(to);
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.round((b - a) / DAY);
  }

  // Average gap between consecutive orders, or null when there are < 2 orders
  // or any date is unparseable (we never invent an interval).
  function reorderInterval(orderDates) {
    const ds = (orderDates || []).map(Date.parse).filter(isFinite).sort((a, b) => a - b);
    if (ds.length < 2) return { avgDays: null, confidence: 'UNKNOWN', orders: ds.length };
    let sum = 0;
    for (let i = 1; i < ds.length; i++) sum += (ds[i] - ds[i - 1]) / DAY;
    const avg = sum / (ds.length - 1);
    // Confidence grows with the number of intervals observed.
    const confidence = ds.length >= 5 ? 'HIGH' : ds.length >= 3 ? 'MEDIUM' : 'LOW';
    return { avgDays: Math.round(avg), confidence, orders: ds.length };
  }

  // Classify one customer. `asOf` lets tests pin "today". Thresholds are relative
  // to that customer's own reorder rhythm when known, else sensible defaults.
  function classify(customer, asOf) {
    const c = customer || {};
    const now = asOf || new Date().toISOString();
    const dates = (c.orderDates || []).slice().sort();
    const orders = dates.length;
    if (orders === 0) return { id: c.id, segment: 'UNKNOWN', reason: 'no order history', sinceLastDays: null };
    const last = dates[dates.length - 1];
    const sinceLast = days(last, now);
    const ri = reorderInterval(dates);
    // Expected gap: the customer's own interval (if known) or a 90-day default.
    const expected = ri.avgDays || 90;
    const vip = orders >= 4 || (c.lifetimeValue != null && c.lifetimeValue >= (c.vipThreshold || 2000));
    let segment, reason;
    if (orders === 1) { segment = 'NEW'; reason = 'one order so far'; }
    else if (sinceLast != null && sinceLast > expected * 4) { segment = 'LOST'; reason = `no order in ${sinceLast}d (expected ~${expected}d)`; }
    else if (sinceLast != null && sinceLast > expected * 2) { segment = 'INACTIVE'; reason = `${sinceLast}d since last order (expected ~${expected}d)`; }
    else if (sinceLast != null && sinceLast > expected * 1.25) { segment = 'AT_RISK'; reason = `overdue vs ~${expected}d rhythm`; }
    else if (vip) { segment = 'VIP'; reason = `${orders} orders, strong value`; }
    else { segment = 'REPEAT'; reason = `${orders} orders, on rhythm`; }
    // E4 (Reserve IV Wave E): suppression/eligibility applies to every proposed
    // lifecycle action. A DNC/opt-out customer may still be segmented (e.g. still
    // INACTIVE) but must never be proposed for contact. The flag is carried here
    // and honored by analyze() below.
    const suppressed = !!(c.suppressed || c.dnc || c.optOut);
    return { id: c.id, storeName: c.storeName, segment, reason, orders, sinceLastDays: sinceLast,
      reorderIntervalDays: ri.avgDays, reorderConfidence: ri.confidence, vip, suppressed };
  }

  function analyze(customers, asOf) {
    const rows = (customers || []).map(c => classify(c, asOf));
    const counts = {};
    for (const s of SEGMENTS) counts[s] = 0;
    for (const r of rows) counts[r.segment] = (counts[r.segment] || 0) + 1;
    // Candidate lists (advisory; owner messages by hand, nothing is sent).
    // E4: a suppressed (DNC/opt-out) customer is never proposed for contact —
    // excluded from every actionable list and surfaced separately so the owner
    // can still see them without a contact suggestion.
    const actionable = r => !r.suppressed;
    const reorderCandidates = rows.filter(r => actionable(r) && (r.segment === 'AT_RISK' || (r.segment === 'REPEAT' && r.sinceLastDays != null && r.reorderIntervalDays && r.sinceLastDays >= r.reorderIntervalDays)));
    const winBack = rows.filter(r => actionable(r) && (r.segment === 'INACTIVE' || r.segment === 'LOST'));
    const vips = rows.filter(r => r.segment === 'VIP'); // a status list, not a contact action
    const reviewRequest = rows.filter(r => actionable(r) && r.orders >= 2 && r.sinceLastDays != null && r.sinceLastDays <= 30);
    const suppressedCandidates = rows.filter(r => r.suppressed);
    const known = rows.filter(r => r.reorderIntervalDays != null).map(r => r.reorderIntervalDays);
    const avgInterval = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
    return { rows, counts, avgReorderIntervalDays: avgInterval,
      avgReorderConfidence: known.length >= 5 ? 'MEDIUM' : known.length ? 'LOW' : 'UNKNOWN',
      reorderCandidates, winBack, vips, reviewRequest, suppressedCandidates,
      guard: 'Advisory only. No customer is messaged; the owner reaches out by hand. Suppressed (DNC/opt-out) customers are never proposed for contact.' };
  }

  // Synthetic customers for the page/tests (clearly fake; no real buyers).
  function fixtures(seed) {
    let s = (seed || 7) >>> 0 || 1;
    const r = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
    const base = Date.parse('2026-10-19T00:00:00Z');
    const mk = (i, nOrders, gapDays, lv) => {
      const dates = [];
      for (let k = nOrders - 1; k >= 0; k--) dates.push(new Date(base - Math.round((k * gapDays + r() * 5) * DAY)).toISOString().slice(0, 10));
      return { id: 'SYNC-' + (200 + i), storeName: ['Cedar Day Spa', 'Bloom Beauty Bar', 'Tide Mercantile', 'Fern Apothecary', 'Willow Wellness', 'Stone Boutique'][i % 6] + ' #' + i,
        orderDates: dates, lifetimeValue: lv, synthetic: true };
    };
    return [mk(1, 1, 0, 300), mk(2, 3, 40, 900), mk(3, 6, 35, 3200), mk(4, 2, 200, 500), mk(5, 4, 300, 1400), mk(6, 0, 0, 0)];
  }

  return { SEGMENTS, days, reorderInterval, classify, analyze, fixtures };
}));
