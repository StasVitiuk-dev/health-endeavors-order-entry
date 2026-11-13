// Inventory — CYCLE COUNT + ADJUSTMENT APPROVAL journey (#54/#55). Pure,
// synthetic, advisory. A draft physical count → discrepancy review → owner-
// approved adjustment → audit trail. ADVISORY ONLY: an approved adjustment is a
// DRAFT that NAMES the missing safe production write (adjust_inventory, R4); it
// never writes real stock. Canceled and duplicate submissions are refused, not
// double-applied.
//
// State machine: DRAFT -> PENDING_APPROVAL -> APPROVED
//                 DRAFT / PENDING_APPROVAL -> CANCELED
// Illegal transitions are refused with a reason; every transition is audited.
//
// Pure. Dual-mode (Node require + browser HE.inventory registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.inventory = root.HE.inventory || {})['he-inventory-count'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANCELED'];
  const MISSING_WRITE_CONTRACT = 'adjust_inventory (R4) — a safe audited stock adjustment; not in the local build (this count journey is advisory/draft-only).';

  const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };
  const nowOr = (iso) => iso || null;

  function audit(count, action, actor, atISO, detail) {
    count.audit.push({ action: action, actor: actor || null, at: nowOr(atISO), detail: detail || null });
  }

  // Start a draft count from the system's believed quantities.
  function startCount(req) {
    const r = req || {};
    const lines = (r.lines || []).map(l => ({ sku: l.sku, systemQty: num(l.systemQty), countedQty: null }));
    const count = {
      id: r.countId || null, location: r.location || null, status: 'DRAFT',
      lines: lines, audit: [], synthetic: true, label: 'SIMULATED',
      contract: MISSING_WRITE_CONTRACT,
    };
    audit(count, 'STARTED', r.by, r.at, (r.location || '') + ' · ' + lines.length + ' lines');
    return count;
  }

  // Record a physical count for one SKU. Only on a DRAFT.
  function recordCount(count, sku, countedQty, by, atISO) {
    if (!count || count.status !== 'DRAFT') return { ok: false, reason: 'can only record on a DRAFT count', count: count };
    const line = count.lines.find(l => l.sku === sku);
    if (!line) return { ok: false, reason: 'unknown sku: ' + sku, count: count };
    line.countedQty = num(countedQty);
    audit(count, 'COUNTED', by, atISO, sku + ' = ' + line.countedQty);
    return { ok: true, count: count };
  }

  // Lines where the physical count differs from the system quantity.
  function discrepancies(count) {
    return (count.lines || []).filter(l => l.countedQty != null && l.systemQty != null && l.countedQty !== l.systemQty)
      .map(l => ({ sku: l.sku, systemQty: l.systemQty, countedQty: l.countedQty,
        delta: l.countedQty - l.systemQty, direction: l.countedQty > l.systemQty ? 'OVER' : 'SHORT' }));
  }
  // Lines not yet physically counted (block submission).
  function uncounted(count) { return (count.lines || []).filter(l => l.countedQty == null).map(l => l.sku); }

  // Submit a completed count for owner approval. Idempotent: a second submit of an
  // already-submitted (or approved/canceled) count is refused, never re-queued.
  function submitForApproval(count, by, atISO) {
    if (!count) return { ok: false, reason: 'no count' };
    if (count.status === 'PENDING_APPROVAL') return { ok: false, reason: 'already submitted (no double-submit)', duplicate: true, count: count };
    if (count.status !== 'DRAFT') return { ok: false, reason: 'cannot submit a ' + count.status + ' count', count: count };
    const missing = uncounted(count);
    if (missing.length) return { ok: false, reason: 'count incomplete: ' + missing.join(', '), count: count };
    count.status = 'PENDING_APPROVAL';
    audit(count, 'SUBMITTED', by, atISO, discrepancies(count).length + ' discrepancies');
    return { ok: true, count: count };
  }

  // Owner-gated approval -> produces advisory adjustment entries (never a real
  // stock write; the safe write is NAMED). Idempotent and refuses a canceled count.
  function approveAdjustment(count, req) {
    const r = req || {};
    if (!count) return { ok: false, reason: 'no count' };
    if (r.role !== 'owner') return { ok: false, reason: 'only the owner may approve a stock adjustment', count: count };
    if (count.status === 'APPROVED') return { ok: false, reason: 'already approved (no double-apply)', duplicate: true, count: count };
    if (count.status === 'CANCELED') return { ok: false, reason: 'cannot approve a canceled count', count: count };
    if (count.status !== 'PENDING_APPROVAL') return { ok: false, reason: 'must be submitted for approval first', count: count };
    const adjustments = discrepancies(count).map(d => ({ sku: d.sku, from: d.systemQty, to: d.countedQty, delta: d.delta,
      applied: false, writeContract: MISSING_WRITE_CONTRACT }));
    count.status = 'APPROVED';
    count.adjustments = adjustments;
    audit(count, 'APPROVED', r.by || 'owner', r.at, adjustments.length + ' adjustments (advisory; not written)');
    return { ok: true, count: count, adjustments: adjustments };
  }

  // Cancel a draft or pending count. A canceled count is terminal.
  function cancelCount(count, by, atISO, reason) {
    if (!count) return { ok: false, reason: 'no count' };
    if (count.status === 'CANCELED') return { ok: false, reason: 'already canceled', duplicate: true, count: count };
    if (count.status === 'APPROVED') return { ok: false, reason: 'cannot cancel an approved count', count: count };
    count.status = 'CANCELED';
    audit(count, 'CANCELED', by, atISO, reason || null);
    return { ok: true, count: count };
  }

  function fixtures() {
    return {
      countId: 'CC-2026-11-13', location: 'Main shelf', by: 'staff', at: '2026-11-13T09:00:00Z',
      lines: [
        { sku: 'HE-HONEY-8OZ', systemQty: 40 },
        { sku: 'HE-VEGAN-8OZ', systemQty: 25 },
        { sku: 'HE-SHEA-4OZ', systemQty: 12 },
      ],
    };
  }

  return { STATES, MISSING_WRITE_CONTRACT, startCount, recordCount, discrepancies, uncounted, submitForApproval, approveAdjustment, cancelCount, fixtures };
}));
