// Sales & Growth — sample safety system.
//
// Sample inventory is limited and precious. This module makes it IMPOSSIBLE for
// code/AI to give samples away:
//   * eligibility() — only serious stages (sample consideration, wholesale
//     discussion, existing customer) may even be requested; cold/contacted/mild
//     interest cannot;
//   * the sample state machine forbids SENT before an owner APPROVED it;
//   * approve() REQUIRES an owner actor (no owner actor → throws);
//   * a configurable MONTHLY BUDGET caps approvals; going over needs an explicit,
//     audited owner override;
//   * candidateScore() is advisory only and never approves anything.
// The monthly budget default here is a SYNTHETIC placeholder (not a production
// decision); the owner sets the real number later. ROI always separates ACTUAL /
// ESTIMATED / UNKNOWN and never invents a missing cost.
//
// Deterministic (no AI, no cost). Pure. Dual-mode (Node require + browser registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE && root.HE.modules) root.HE.modules.define('he-sales-samples', { api: 1, needs: [] }, function () { return api; });
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // SYNTHETIC placeholder only — NOT a production inventory or budget decision.
  const SYNTHETIC_MONTHLY_BUDGET = 8; // within the 5–10 planning range

  const SAMPLE_STATES = ['NOT_REQUESTED', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED',
    'SENT', 'RECEIVED', 'FOLLOW_UP_DUE', 'CONVERTED', 'NO_ORDER'];
  const SAMPLE_NEXT = {
    NOT_REQUESTED: ['REQUESTED'],
    REQUESTED: ['UNDER_REVIEW', 'DECLINED'],
    UNDER_REVIEW: ['APPROVED', 'DECLINED'],
    APPROVED: ['SENT', 'DECLINED'],         // may still be cancelled before it ships
    SENT: ['RECEIVED', 'NO_ORDER'],
    RECEIVED: ['FOLLOW_UP_DUE', 'CONVERTED', 'NO_ORDER'],
    FOLLOW_UP_DUE: ['CONVERTED', 'NO_ORDER'],
    DECLINED: [], CONVERTED: [], NO_ORDER: [],
  };

  // Pipeline stages from which a sample MAY be requested. Everything else cannot.
  const ELIGIBLE_PIPELINE = new Set(['SAMPLE_CONSIDERATION', 'WHOLESALE_DISCUSSION', 'CUSTOMER']);

  function eligibility(pipelineState) {
    const eligible = ELIGIBLE_PIPELINE.has(pipelineState);
    return { eligible, reason: eligible ? 'serious stage (' + pipelineState + ')'
      : 'not a serious stage yet (' + (pipelineState || 'unknown') + ') — no sample' };
  }

  // Advisory candidate score (0..100). Never approves; just ranks who is worth a
  // closer look if the owner has budget. Confidence reflects how much is known.
  function candidateScore(signals) {
    const s = signals || {};
    const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
    const unit = v => Math.max(0, Math.min(1, num(v, 0)));
    const parts = [];
    let score = 0, known = 0, total = 0;
    const add = (label, pts, present) => { total++; if (present) { known++; score += pts; } parts.push(label + ': +' + (present ? pts : 0)); };
    add('store fit', Math.round(unit(s.storeFit) * 25), s.storeFit != null);
    add('lead score', Math.round((num(s.leadScore, 0) / 100) * 20), s.leadScore != null);
    add('reply quality', Math.round(unit(s.replyQuality) * 15), s.replyQuality != null);
    add('buyer seriousness', Math.round(unit(s.seriousness) * 20), s.seriousness != null);
    add('wholesale terms discussed', s.termsDiscussion ? 10 : 0, s.termsDiscussion != null);
    add('explicitly requested a sample', s.explicitlyRequested ? 5 : 0, s.explicitlyRequested != null);
    add('prior purchase history', s.priorPurchases ? 5 : 0, s.priorPurchases != null);
    if (score > 100) score = 100;
    const band = score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low';
    const confidence = total ? Math.round((known / total) * 100) / 100 : 0;
    return { score, band, confidence, reasons: parts };
  }

  function createSampleBook(opts) {
    const monthlyBudget = (opts && typeof opts.monthlyBudget === 'number') ? opts.monthlyBudget : SYNTHETIC_MONTHLY_BUDGET;
    const rec = new Map();   // key -> { state, history, month, cost:{unit,ship,pack}, revenue }
    const approvedByMonth = {}; // monthKey -> count of approvals
    const get = key => rec.get(key) || { state: 'NOT_REQUESTED', history: [], cost: {}, revenue: null, month: null };

    function moveTo(key, to, meta) {
      const r = get(key);
      if (!(SAMPLE_NEXT[r.state] && SAMPLE_NEXT[r.state].includes(to))) {
        throw new Error('he-sales-samples: refused ' + r.state + ' -> ' + to + ' for ' + key);
      }
      const next = Object.assign({}, r, { state: to, history: r.history.concat([[r.state, to, (meta && meta.reason) || '', (meta && meta.actor) || 'system']]).slice(-100) });
      rec.set(key, next);
      return next;
    }

    return {
      SAMPLE_STATES, SAMPLE_NEXT, monthlyBudget,
      state: key => get(key).state,
      history: key => get(key).history.slice(),
      eligibility, candidateScore,

      // Request a sample — blocked unless the lead is at a serious pipeline stage.
      request(key, ctx) {
        const e = eligibility(ctx && ctx.pipelineState);
        if (!e.eligible) throw new Error('he-sales-samples: cannot request a sample — ' + e.reason);
        return moveTo(key, 'REQUESTED', { reason: e.reason, actor: (ctx && ctx.actor) || 'system' }).state;
      },
      review(key) { return moveTo(key, 'UNDER_REVIEW', { reason: 'owner reviewing' }).state; },

      // Owner approval: needs an owner actor AND must fit the monthly budget (or an
      // explicit, audited owner override). Never callable by code alone.
      approve(key, approval) {
        const a = approval || {};
        if (!a.owner || !String(a.owner).trim()) throw new Error('he-sales-samples: sample approval requires an owner actor');
        const month = a.monthKey || new Date().toISOString().slice(0, 7);
        const used = approvedByMonth[month] || 0;
        if (used + 1 > monthlyBudget) {
          if (!(a.override === true && a.overrideReason)) {
            throw new Error('he-sales-samples: monthly sample budget (' + monthlyBudget + ') reached for ' + month
              + ' — an explicit owner override with a reason is required');
          }
        }
        const r = moveTo(key, 'APPROVED', { reason: a.override ? 'owner override: ' + a.overrideReason : 'owner approved', actor: a.owner });
        approvedByMonth[month] = used + 1;
        r.month = month;
        if (a.unitCost != null || a.shipCost != null || a.packCost != null) r.cost = { unit: a.unitCost, ship: a.shipCost, pack: a.packCost };
        rec.set(key, r);
        return r.state;
      },
      decline(key, meta) { return moveTo(key, 'DECLINED', { reason: (meta && meta.reason) || 'declined', actor: (meta && meta.owner) || 'owner' }).state; },
      markSent(key) { return moveTo(key, 'SENT', { reason: 'shipped (recorded, not performed here)' }).state; },
      markReceived(key) { return moveTo(key, 'RECEIVED', { reason: 'received' }).state; },
      markFollowUpDue(key) { return moveTo(key, 'FOLLOW_UP_DUE', { reason: 'follow-up due' }).state; },
      markConverted(key, meta) { const r = moveTo(key, 'CONVERTED', { reason: 'became a wholesale order' }); if (meta && meta.revenue != null) { r.revenue = meta.revenue; rec.set(key, r); } return r.state; },
      markNoOrder(key) { return moveTo(key, 'NO_ORDER', { reason: 'no order' }).state; },

      budgetStatus(monthKey) {
        const month = monthKey || new Date().toISOString().slice(0, 7);
        const approved = approvedByMonth[month] || 0;
        return { month, budget: monthlyBudget, approved, remaining: Math.max(0, monthlyBudget - approved), overBudget: approved > monthlyBudget };
      },

      // ROI for a month. Separates ACTUAL (we have the numbers), from UNKNOWN
      // (we do not). Never invents a missing cost or revenue.
      roi(monthKey) {
        const month = monthKey || new Date().toISOString().slice(0, 7);
        let approved = 0, sent = 0, converted = 0, actualCost = 0, actualRevenue = 0, unknownCost = 0, unknownRevenue = 0;
        for (const r of rec.values()) {
          if (r.month !== month) continue;
          approved++;
          if (['SENT', 'RECEIVED', 'FOLLOW_UP_DUE', 'CONVERTED', 'NO_ORDER'].includes(r.state)) sent++;
          const c = r.cost || {};
          const known = [c.unit, c.ship, c.pack].filter(x => typeof x === 'number' && isFinite(x));
          if (known.length) actualCost += known.reduce((a, b) => a + b, 0); else unknownCost++;
          if (r.state === 'CONVERTED') { converted++; if (typeof r.revenue === 'number') actualRevenue += r.revenue; else unknownRevenue++; }
        }
        return {
          month, approved, sent, converted,
          conversionRate: sent ? Math.round((converted / sent) * 100) / 100 : null, // null = not enough data, never a fake 0
          actualCost, unknownCostRecords: unknownCost,
          actualRevenue, unknownRevenueRecords: unknownRevenue,
          costBasis: unknownCost ? 'PARTIAL/UNKNOWN' : 'ACTUAL',
        };
      },
    };
  }

  return { createSampleBook, candidateScore, eligibility, SAMPLE_STATES, SAMPLE_NEXT, ELIGIBLE_PIPELINE, SYNTHETIC_MONTHLY_BUDGET };
}));
