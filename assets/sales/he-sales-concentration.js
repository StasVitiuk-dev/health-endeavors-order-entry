// Sales & Growth — PIPELINE CONCENTRATION & QUALITY RISK (pure, local, advisory).
//
// Answers "how fragile is the pipeline?". If most of the (weighted) pipeline
// rides on one deal or one account, a single loss wipes out the quarter. This
// module measures that concentration several ways and raises plain-English
// risk flags the owner can act on:
//   * top-1 / top-3 / top-5 share of weighted value;
//   * a Herfindahl-Hirschman Index (HHI) over deals and over accounts
//     (0 = perfectly spread, 1 = everything in one);
//   * single-deal and single-account dependency flags;
//   * a thin-pipeline flag when too few active deals back the target.
//
// It reads a snapshot and reports. It ranks and flags; it never changes a deal,
// contacts anyone, or writes anything. "Weighted value" is whatever the caller
// supplies (e.g. value x probability) — this module does not invent revenue.
//
// Pure. Deterministic. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-concentration'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULTS = {
    singleDealShare: 0.35,     // one deal >35% of weighted pipeline -> risk
    singleAccountShare: 0.50,  // one account >50% -> risk
    minActiveDeals: 5,         // fewer than this backing the target -> thin
  };

  function num(v) { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; }

  // Herfindahl-Hirschman Index over a list of shares that sum to 1.
  // Returns 0..1 (sum of squared shares). Empty -> 0.
  function hhi(values) {
    const total = values.reduce((s, v) => s + v, 0);
    if (total <= 0) return 0;
    return values.reduce((s, v) => { const share = v / total; return s + share * share; }, 0);
  }

  function topShare(sortedDesc, total, n) {
    if (total <= 0) return 0;
    return sortedDesc.slice(0, n).reduce((s, v) => s + v, 0) / total;
  }

  // deals: [{ id, account, weightedValue }]. target: optional number the
  // pipeline is meant to cover (only used for the thin-pipeline flag).
  function analyze(deals, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const rows = (deals || []).map(dl => ({ id: dl.id || null, account: dl.account || dl.id || null, weightedValue: num(dl.weightedValue) }))
      .filter(r => r.weightedValue > 0);
    const total = rows.reduce((s, r) => s + r.weightedValue, 0);

    const dealVals = rows.map(r => r.weightedValue).sort((a, b) => b - a);
    const byAccount = {};
    for (const r of rows) byAccount[r.account] = (byAccount[r.account] || 0) + r.weightedValue;
    const accountVals = Object.values(byAccount).sort((a, b) => b - a);
    const accountNames = Object.keys(byAccount).sort((a, b) => byAccount[b] - byAccount[a]);

    const top1 = topShare(dealVals, total, 1);
    const top3 = topShare(dealVals, total, 3);
    const top5 = topShare(dealVals, total, 5);
    const topAccountShare = topShare(accountVals, total, 1);

    const topDeal = rows.slice().sort((a, b) => b.weightedValue - a.weightedValue)[0] || null;

    const flags = [];
    if (top1 >= o.singleDealShare && rows.length) {
      flags.push({ code: 'SINGLE_DEAL_DEPENDENCY', severity: 'high',
        message: `One deal is ${(top1 * 100).toFixed(0)}% of weighted pipeline`,
        dealId: topDeal && topDeal.id });
    }
    if (topAccountShare >= o.singleAccountShare && accountVals.length) {
      flags.push({ code: 'SINGLE_ACCOUNT_DEPENDENCY', severity: 'high',
        message: `One account is ${(topAccountShare * 100).toFixed(0)}% of weighted pipeline`,
        account: accountNames[0] });
    }
    if (rows.length > 0 && rows.length < o.minActiveDeals) {
      flags.push({ code: 'THIN_PIPELINE', severity: 'medium',
        message: `Only ${rows.length} active weighted deal(s); fewer than ${o.minActiveDeals}` });
    }
    if (rows.length === 0) {
      flags.push({ code: 'EMPTY_PIPELINE', severity: 'medium', message: 'No active weighted deals' });
    }

    return {
      total,
      dealCount: rows.length,
      accountCount: accountVals.length,
      top1Share: top1, top3Share: top3, top5Share: top5,
      topAccountShare,
      dealHHI: hhi(dealVals),
      accountHHI: hhi(accountVals),
      topDeal: topDeal ? { id: topDeal.id, account: topDeal.account, weightedValue: topDeal.weightedValue, share: top1 } : null,
      topAccount: accountNames.length ? { account: accountNames[0], weightedValue: accountVals[0], share: topAccountShare } : null,
      flags,
      riskLevel: flags.some(f => f.severity === 'high') ? 'HIGH' : flags.length ? 'MEDIUM' : 'LOW',
      guard: 'Read-only risk view. Weighted value is supplied by the caller; this changes no deal and sends nothing.',
    };
  }

  return { DEFAULTS, hhi, analyze };
}));
