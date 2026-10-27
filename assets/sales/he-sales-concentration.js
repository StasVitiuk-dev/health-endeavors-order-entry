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

  function isKnownAccount(key) { return typeof key === 'string' && key.indexOf('__unknown_') !== 0; }

  // deals: [{ id, account, weightedValue }]. target: optional number the
  // pipeline is meant to cover (only used for the thin-pipeline flag).
  //
  // Correctness guards (Reserve IV Wave A):
  //  - A4: a repeated deal id is the SAME deal listed twice, so it is counted
  //    once (first occurrence wins) and the drop is reported, never silently
  //    doubling the pipeline. Deals with no id cannot be de-duplicated and are
  //    each treated as distinct.
  //  - A5/A8: a deal with no account is NOT given its deal id as a pretend
  //    customer, and two account-less deals are NOT merged into one fictitious
  //    account. Each gets a private synthetic key so it stays a separate
  //    "unknown"; account-level concentration and the single-account flag count
  //    only KNOWN accounts, so the engine never claims a customer that isn't there.
  //  - A6: non-positive / unparseable weighted values are dropped (they are not
  //    "zero demand"), and the count of drops is reported rather than hidden.
  function analyze(deals, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const raw = (deals || []).map(dl => ({ id: (dl && dl.id) || null, accountRaw: dl && dl.account, weightedValue: num(dl && dl.weightedValue) }));
    const droppedNonPositive = raw.filter(r => !(r.weightedValue > 0)).length;
    const positive = raw.filter(r => r.weightedValue > 0);

    // De-duplicate by non-null id (first wins). Null-id rows are all kept.
    const seenIds = new Set();
    let duplicateIdsDropped = 0;
    const rows = [];
    let unknownSeq = 0;
    for (const r of positive) {
      if (r.id != null) {
        if (seenIds.has(r.id)) { duplicateIdsDropped++; continue; }
        seenIds.add(r.id);
      }
      // Known account only when a non-empty account string was supplied; else a
      // private key so unrelated unknowns never merge or borrow the deal id.
      const known = typeof r.accountRaw === 'string' && r.accountRaw.trim() !== '';
      rows.push({ id: r.id, account: known ? r.accountRaw : ('__unknown_' + (unknownSeq++)), accountKnown: known, weightedValue: r.weightedValue });
    }
    const total = rows.reduce((s, r) => s + r.weightedValue, 0);

    const dealVals = rows.map(r => r.weightedValue).sort((a, b) => b - a);
    const byAccount = {};
    for (const r of rows) byAccount[r.account] = (byAccount[r.account] || 0) + r.weightedValue;
    const accountVals = Object.values(byAccount).sort((a, b) => b - a);
    // Rank only KNOWN accounts for the "top account" / dependency claim.
    const knownNames = Object.keys(byAccount).filter(isKnownAccount).sort((a, b) => byAccount[b] - byAccount[a]);
    const unknownAccountDeals = Object.keys(byAccount).filter(k => !isKnownAccount(k)).length;

    const top1 = topShare(dealVals, total, 1);
    const top3 = topShare(dealVals, total, 3);
    const top5 = topShare(dealVals, total, 5);
    const topKnownVal = knownNames.length ? byAccount[knownNames[0]] : 0;
    const topAccountShare = total > 0 ? topKnownVal / total : 0;

    const topDeal = rows.slice().sort((a, b) => (b.weightedValue - a.weightedValue) || String(a.id).localeCompare(String(b.id)))[0] || null;

    const flags = [];
    if (top1 >= o.singleDealShare && rows.length) {
      flags.push({ code: 'SINGLE_DEAL_DEPENDENCY', severity: 'high',
        message: `One deal is ${(top1 * 100).toFixed(0)}% of weighted pipeline`,
        dealId: topDeal && topDeal.id });
    }
    // Only a KNOWN account can trip account dependency — never a fabricated one.
    if (topAccountShare >= o.singleAccountShare && knownNames.length) {
      flags.push({ code: 'SINGLE_ACCOUNT_DEPENDENCY', severity: 'high',
        message: `One account is ${(topAccountShare * 100).toFixed(0)}% of weighted pipeline`,
        account: knownNames[0] });
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
      accountCount: accountVals.length,       // distinct owners (known + each unknown)
      knownAccountCount: knownNames.length,
      unknownAccountDeals,                     // account-less deals, each its own unknown
      duplicateIdsDropped,
      droppedNonPositive,
      top1Share: top1, top3Share: top3, top5Share: top5,
      topAccountShare,                         // share of the top KNOWN account only
      dealHHI: hhi(dealVals),
      accountHHI: hhi(accountVals),            // over distinct owners (unknowns are separate)
      topDeal: topDeal ? { id: topDeal.id, account: topDeal.accountKnown ? topDeal.account : null, weightedValue: topDeal.weightedValue, share: top1 } : null,
      topAccount: knownNames.length ? { account: knownNames[0], weightedValue: topKnownVal, share: topAccountShare } : null,
      flags,
      riskLevel: flags.some(f => f.severity === 'high') ? 'HIGH' : flags.length ? 'MEDIUM' : 'LOW',
      guard: 'Read-only risk view. Weighted value is supplied by the caller; this changes no deal and sends nothing.',
    };
  }

  return { DEFAULTS, hhi, analyze };
}));
