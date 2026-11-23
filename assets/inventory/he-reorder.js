// Inventory reorder & cash flow — DETERMINISTIC engine (Phase 2, local/synthetic).
//
// Pure: no DOM, no network, no purchasing. Dual-mode (Node + browser registry).
// Given per-SKU / per-component stock (on-hand, reserved, damaged, in-transit),
// open POs, lead time, sales velocity and confirmed sample usage, it computes
// available stock, days of cover, a runout window, a draft reorder quantity and
// the cash required — with an explicit distinction between ZERO activity (known
// zero) and UNKNOWN demand (no history → fall back to a manual threshold), and a
// scenario range. It only ever RECOMMENDS: nothing here places a purchase order.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.inventory = root.HE.inventory || {})['he-reorder'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY = 86400000;
  const num = (v) => (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);

  // Stock a reorder decision can actually rely on. Damaged is excluded; reserved
  // and confirmed sample usage are subtracted; in-transit (open PO) is reported
  // separately as incoming, not counted as available now.
  function availability(item) {
    const i = item || {};
    const onHand = num(i.onHand);
    const reserved = num(i.reserved) || 0;
    const damaged = num(i.damaged) || 0;
    const sampleReserved = num(i.sampleReserved) || 0; // confirmed sample allocation
    const incoming = num(i.inTransit) || 0;            // open PO quantity en route
    if (onHand == null) return { available: null, incoming: incoming, note: 'on-hand unknown' };
    const available = Math.max(0, onHand - reserved - sampleReserved); // damaged already not on-hand-sellable
    return { available: available, incoming: incoming, onHand: onHand, reserved: reserved, damaged: damaged, sampleReserved: sampleReserved };
  }

  // Days of cover. Distinguishes:
  //   velocity null/undefined  -> UNKNOWN (no demand history)
  //   velocity === 0           -> ZERO activity (cover is effectively infinite)
  //   velocity > 0             -> available / velocity
  function daysOfCover(available, velocityPerDay) {
    if (available == null) return { days: null, basis: 'UNKNOWN', note: 'on-hand unknown' };
    const v = num(velocityPerDay);
    if (v == null) return { days: null, basis: 'UNKNOWN', note: 'no demand history' };
    if (v === 0) return { days: Infinity, basis: 'ZERO_ACTIVITY', note: 'no recent movement' };
    return { days: available / v, basis: 'ESTIMATED', note: null };
  }

  function runoutDate(available, velocityPerDay, nowMs) {
    const c = daysOfCover(available, velocityPerDay);
    if (c.days == null || c.days === Infinity) return null;
    const base = nowMs != null ? +new Date(nowMs) : Date.now();
    const when = base + c.days * DAY;
    // Beyond the range a date can hold (or an invalid "now") there is no date to give.
    if (!isFinite(when) || Math.abs(when) > 8.64e15) return null;
    return new Date(when).toISOString().slice(0, 10);
  }

  function roundToPack(qty, packSize, moq) {
    let q = Math.max(0, Math.ceil(qty));
    const pack = num(packSize);
    if (pack && pack > 0) q = Math.ceil(q / pack) * pack;
    const min = num(moq);
    if (min && q > 0 && q < min) q = min;
    return q;
  }

  // Draft a reorder proposal for one SKU or packaging component. Never purchases.
  // Returns a labelled recommendation with its assumptions, or a 'none' decision.
  function reorderProposal(item, opts) {
    const i = item || {}; const o = opts || {};
    const key = String(i.sku || i.id || i.name || 'unknown');
    const avail = availability(i);
    const velocity = num(i.velocityPerDay);
    const leadTime = num(i.leadTimeDays);
    const targetDays = num(o.targetCoverDays) != null ? num(o.targetCoverDays) : 30; // cover to hold past lead time
    const safetyDays = num(o.safetyDays) != null ? num(o.safetyDays) : 7;
    const unitCost = num(i.unitCost);
    const cover = daysOfCover(avail.available, velocity);
    const reasons = [];
    const base = {
      key: key, kind: i.kind || 'finished', label: 'SIMULATED',
      onHand: avail.onHand == null ? null : avail.onHand, available: avail.available, incoming: avail.incoming,
      damaged: avail.damaged, reserved: avail.reserved, sampleReserved: avail.sampleReserved,
      velocityPerDay: velocity, leadTimeDays: leadTime,
      daysOfCover: cover.days === Infinity ? 'infinite' : (cover.days == null ? null : Math.round(cover.days * 10) / 10),
      coverBasis: cover.basis, runoutDate: runoutDate(avail.available, velocity, o.now),
      sparse: false, reasons: reasons,
    };

    // No on-hand number: cannot decide. Flag, do not guess.
    if (avail.available == null) {
      reasons.push('on-hand unknown — cannot compute a reorder; enter a count');
      return Object.assign(base, { decision: 'needs_data', sparse: true, quantity: 0, cash: null });
    }

    // UNKNOWN demand (no history): fall back to a manual reorder threshold.
    if (cover.basis === 'UNKNOWN') {
      base.sparse = true;
      const threshold = num(i.reorderThreshold);
      if (threshold == null) { reasons.push('no demand history and no manual threshold set — owner decision'); return Object.assign(base, { decision: 'needs_data', quantity: 0, cash: null }); }
      if (avail.available + avail.incoming > threshold) { reasons.push('above manual threshold (' + (avail.available + avail.incoming) + ' > ' + threshold + ')'); return Object.assign(base, { decision: 'none', quantity: 0, cash: 0 }); }
      const qty = roundToPack((threshold * 2) - avail.available - avail.incoming, i.packSize, i.moq);
      reasons.push('no demand history — using manual threshold ' + threshold);
      return Object.assign(base, { decision: 'reorder_manual', quantity: qty, cash: unitCost == null ? null : Math.round(qty * unitCost * 100) / 100, cashLabel: unitCost == null ? 'UNKNOWN' : 'ESTIMATED' });
    }

    // ZERO activity (known): nothing is moving — no reorder (unless below a hard
    // manual threshold the owner set for a brand-new product).
    if (cover.basis === 'ZERO_ACTIVITY') {
      reasons.push('no recent movement — not reordering on velocity');
      return Object.assign(base, { decision: 'none', quantity: 0, cash: 0 });
    }

    // Normal velocity-driven decision.
    const needDays = (leadTime == null ? 0 : leadTime) + safetyDays;
    if (cover.days > needDays) { reasons.push('cover ' + Math.round(cover.days) + 'd exceeds lead+safety ' + needDays + 'd'); return Object.assign(base, { decision: 'none', quantity: 0, cash: 0 }); }
    // Order enough to reach (lead + safety + target) days of cover, net of incoming.
    const targetUnits = velocity * ((leadTime || 0) + safetyDays + targetDays);
    const qty = roundToPack(targetUnits - avail.available - avail.incoming, i.packSize, i.moq);
    reasons.push('cover ' + Math.round(cover.days) + 'd below lead+safety ' + needDays + 'd');
    // Scenario range: demand ±50% (or provided low/high velocity) -> qty & cash range.
    const vLow = num(o.velocityLow) != null ? num(o.velocityLow) : velocity * 0.5;
    const vHigh = num(o.velocityHigh) != null ? num(o.velocityHigh) : velocity * 1.5;
    const qLow = roundToPack(vLow * ((leadTime || 0) + safetyDays + targetDays) - avail.available - avail.incoming, i.packSize, i.moq);
    const qHigh = roundToPack(vHigh * ((leadTime || 0) + safetyDays + targetDays) - avail.available - avail.incoming, i.packSize, i.moq);
    const cash = unitCost == null ? null : Math.round(qty * unitCost * 100) / 100;
    return Object.assign(base, {
      decision: 'reorder', quantity: qty,
      quantityRange: [Math.min(qLow, qHigh), Math.max(qLow, qHigh)],
      cash: cash, cashLabel: unitCost == null ? 'UNKNOWN' : 'ESTIMATED',
      cashRange: unitCost == null ? null : [Math.round(Math.min(qLow, qHigh) * unitCost * 100) / 100, Math.round(Math.max(qLow, qHigh) * unitCost * 100) / 100],
    });
  }

  // Build proposals for many items, then DEDUPE repeated suggestions for the same
  // key (keep the first; mark later ones as duplicates so they are not re-queued).
  function buildProposals(items, opts) {
    const seen = new Set();
    const out = [];
    (Array.isArray(items) ? items : []).forEach(function (it) {
      const p = reorderProposal(it, opts);
      if (seen.has(p.key)) { p.duplicate = true; } else { seen.add(p.key); p.duplicate = false; }
      out.push(p);
    });
    return out;
  }

  // Only the actionable, non-duplicate reorder/needs-data proposals, with a cash
  // total for the ones that have a cost. Cash is a PLANNING figure, not accounting.
  function reorderPlan(items, opts) {
    const all = buildProposals(items, opts);
    const actionable = all.filter(function (p) { return !p.duplicate && (p.decision === 'reorder' || p.decision === 'reorder_manual'); });
    const cashKnown = actionable.filter(function (p) { return p.cash != null; });
    const cashTotal = cashKnown.reduce(function (s, p) { return s + p.cash; }, 0);
    const cashUnknown = actionable.length - cashKnown.length;
    return { proposals: all, actionable: actionable, cashTotal: Math.round(cashTotal * 100) / 100, cashUnknownCount: cashUnknown, note: 'SIMULATED planning only — no purchase is placed.' };
  }

  // Read-only projection of a confirmed sample handoff against stock. Returns a
  // NEW item with on-hand reduced by the units handed over (floored at 0) — it
  // does NOT write anything. The actual decrement on a real sample handoff needs
  // a production inventory write contract (a safe stock function, e.g.
  // adjust_inventory / R4) that does not exist in this local build; until then
  // this is a fixture-backed read used to SHOW the forecast impact only.
  function projectConsumption(item, units) {
    const i = item || {}; const u = num(units) || 0;
    const onHand = num(i.onHand);
    if (onHand == null) return Object.assign({}, i); // unknown on-hand: nothing to project
    return Object.assign({}, i, { onHand: Math.max(0, onHand - u) });
  }
  // Project a PARTIAL receipt of an open PO: move up to `units` from inTransit
  // into onHand. Read-only projection (same missing R4 write contract as
  // projectConsumption). Never receives more than is actually in transit; if
  // on-hand is unknown it still reduces inTransit but cannot invent a count.
  function receivePartial(item, units) {
    const i = item || {}; const u = Math.max(0, num(units) || 0);
    const inTransit = num(i.inTransit) || 0;
    const recv = Math.min(u, inTransit);
    const onHand = num(i.onHand);
    const base = { inTransit: Math.max(0, inTransit - recv) };
    if (onHand == null) return Object.assign({}, i, base); // unknown on-hand: reduce PO, no count
    return Object.assign({}, i, base, { onHand: onHand + recv });
  }
  // The missing safe write contract, named so callers can surface it.
  const MISSING_WRITE_CONTRACT = 'adjust_inventory (R4) — a safe sample-consumption decrement to production inventory; not available in the local build (projection is read-only).';

  return { availability, daysOfCover, runoutDate, roundToPack, reorderProposal, buildProposals, reorderPlan, projectConsumption, receivePartial, MISSING_WRITE_CONTRACT };
}));
