// Sales & Growth — FORECAST + revenue/order/inventory scenarios (pure, synthetic).
//
// Weighted pipeline value and revenue scenarios, every number labelled ESTIMATE /
// SIMULATION / NOT_GUARANTEED. Inventory-constrained scenarios report SAFE /
// REVIEW / NOT_ENOUGH_DATA / OVERCOMMITTED but never reserve or write stock.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-forecast'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Default close-probability per pipeline stage (synthetic, owner-tunable).
  const DEFAULT_PROB = {
    NEW: 0.02, QUALIFIED: 0.08, READY_FOR_OUTREACH: 0.1, CONTACTED: 0.12, REPLIED: 0.2,
    INTERESTED: 0.35, SAMPLE_CONSIDERATION: 0.4, SAMPLE_SENT: 0.5, WHOLESALE_DISCUSSION: 0.6,
    OWNER_APPROVED: 0.3, CUSTOMER: 1, LOST: 0, DECLINED: 0, DO_NOT_CONTACT: 0,
  };

  // Weighted pipeline: sum(count * value * prob). Also splits high-confidence
  // (prob >= 0.4) vs speculative. value is a synthetic average first-order value.
  function weightedPipeline(stageCounts, opts) {
    const o = opts || {};
    const value = o.avgFirstOrder == null ? 300 : o.avgFirstOrder; // synthetic $
    const prob = Object.assign({}, DEFAULT_PROB, o.prob || {});
    let weighted = 0, high = 0, spec = 0, raw = 0;
    for (const [stage, count] of Object.entries(stageCounts || {})) {
      const p = prob[stage] == null ? 0 : prob[stage];
      const w = count * value * p;
      weighted += w; raw += count * value;
      if (p >= 0.4) high += w; else if (p > 0) spec += w;
    }
    return { weighted: Math.round(weighted), highConfidence: Math.round(high),
      speculative: Math.round(spec), rawIfAllClosed: Math.round(raw),
      valueAssumption: value, label: 'ESTIMATE', note: 'NOT_GUARANTEED' };
  }

  // Revenue scenario from top-of-funnel assumptions. Everything synthetic.
  function revenueScenario(inputs) {
    const i = inputs || {};
    const leads = Math.max(0, i.leadVolume || 0);
    const replyRate = i.replyRate == null ? 0.15 : i.replyRate;
    const interestRate = i.interestRate == null ? 0.25 : i.interestRate;
    const convRate = i.conversionRate == null ? 0.2 : i.conversionRate;
    const firstOrder = i.avgFirstOrder == null ? 300 : i.avgFirstOrder;
    const repeat = i.repeatOrders == null ? 1 : i.repeatOrders; // additional orders in horizon
    const replies = Math.round(leads * replyRate);
    const interested = Math.round(replies * interestRate);
    const customers = Math.round(interested * convRate);
    const gross = Math.round(customers * firstOrder * (1 + repeat));
    const sampleDemand = Math.round(interested * 0.5);
    const ownerReviewItems = replies + Math.round(leads * 0.4); // replies + follow-ups
    const aiCost = +(leads * 0.01).toFixed(2); // synthetic per-draft
    return { leads, replies, interested, customers, grossSales: gross, sampleDemand,
      ownerReviewItems, aiCost, label: 'SIMULATION', note: 'NOT_GUARANTEED' };
  }

  function orderSizeScenarios(opts) {
    const unit = (opts && opts.unitPrice) || 12; // synthetic wholesale unit $
    const defs = [['small', 24], ['medium', 72], ['large', 240], ['multi_location', 600]];
    return defs.map(([size, units]) => ({ size, units, grossValue: units * unit, label: 'SIMULATION' }));
  }

  // Inventory-constrained scenario. No reservation or write — advisory status only.
  function inventoryConstrained(inputs) {
    const i = inputs || {};
    const { available, retailReserve, sampleReserve, wholesaleDemand } = i;
    if (available == null || wholesaleDemand == null) return { status: 'NOT_ENOUGH_DATA', reason: 'available stock or wholesale demand unknown', freeForWholesale: null };
    const free = available - (retailReserve || 0) - (sampleReserve || 0);
    let status, reason;
    if (free < 0) { status = 'OVERCOMMITTED'; reason = 'reserves already exceed available stock'; }
    else if (wholesaleDemand > free) { status = 'REVIEW'; reason = `demand ${wholesaleDemand} exceeds free-for-wholesale ${free}`; }
    else { status = 'SAFE'; reason = `demand ${wholesaleDemand} fits free-for-wholesale ${free}`; }
    return { status, reason, freeForWholesale: free, note: 'Advisory only — no stock is reserved or written.' };
  }

  return { DEFAULT_PROB, weightedPipeline, revenueScenario, orderSizeScenarios, inventoryConstrained };
}));
