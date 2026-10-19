// Sales & Growth — wholesale lead model + DETERMINISTIC lead scoring.
//
// Scoring uses plain, explainable rules (no AI, no cost, reproducible). Every
// score comes with the reasons that produced it, so the owner can see WHY a store
// ranks where it does and nothing is a black box. The product is BODY-CARE /
// SKINCARE, so category fit is the strongest signal.
//
// Pure: no DOM, no network. Dual-mode (Node require + browser registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE && root.HE.modules) root.HE.modules.define('he-sales-leads', { api: 1, needs: [] }, function () { return api; });
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CATEGORIES = ['skincare', 'body-care', 'beauty', 'spa', 'salon', 'boutique', 'wellness', 'gift', 'pharmacy', 'grocery', 'other'];
  // Category fit for a body-care / skincare line (0..1). Not a claim about the
  // product — a judgement about how well the store's shelf matches it.
  const CATEGORY_FIT = {
    skincare: 1, 'body-care': 1, beauty: 0.9, spa: 0.9, salon: 0.8, boutique: 0.7,
    wellness: 0.7, gift: 0.5, pharmacy: 0.5, grocery: 0.3, other: 0.2,
  };
  const SIZES = ['unknown', 'small', 'medium', 'large'];
  const SIZE_WEIGHT = { unknown: 0.4, small: 0.5, medium: 0.8, large: 1 };
  const REGIONS = ['local', 'domestic', 'international', 'unknown'];
  const REGION_WEIGHT = { local: 1, domestic: 0.8, international: 0.4, unknown: 0.5 };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // A lead is valid enough to work when it has a store name and a plausible email
  // OR website. Scoring tolerates missing fields (they just score lower).
  function validate(lead) {
    const problems = [];
    const l = lead || {};
    if (!l.storeName || !String(l.storeName).trim()) problems.push('missing store name');
    if (l.email && !EMAIL_RE.test(String(l.email))) problems.push('email does not look valid');
    if (!l.email && !l.website) problems.push('no email and no website — cannot reach them');
    if (l.category && !CATEGORIES.includes(l.category)) problems.push('unknown category "' + l.category + '"');
    if (l.size && !SIZES.includes(l.size)) problems.push('unknown size "' + l.size + '"');
    if (l.region && !REGIONS.includes(l.region)) problems.push('unknown region "' + l.region + '"');
    return { ok: problems.length === 0, problems };
  }

  // score(lead) → { score: 0..100, band: cold|warm|hot, serious: bool, reasons: [] }
  // Weights are deliberately simple and sum-explainable. `serious` is the gate the
  // sample module reads — it never means "send a sample", only "worth a closer
  // look if the owner wants to".
  function score(lead) {
    const l = lead || {};
    const reasons = [];
    const fit = CATEGORY_FIT[l.category] != null ? CATEGORY_FIT[l.category] : CATEGORY_FIT.other;
    const size = SIZE_WEIGHT[l.size] != null ? SIZE_WEIGHT[l.size] : SIZE_WEIGHT.unknown;
    const region = REGION_WEIGHT[l.region] != null ? REGION_WEIGHT[l.region] : REGION_WEIGHT.unknown;

    // Weighted components out of 100: fit 45, size 20, region 15, reachability 10,
    // existing-stockist signal 10.
    const fitPts = Math.round(fit * 45);
    const sizePts = Math.round(size * 20);
    const regionPts = Math.round(region * 15);
    const reachable = (l.email && EMAIL_RE.test(String(l.email))) ? 10 : (l.website ? 5 : 0);
    const stockistPts = l.carriesSimilarBrands ? 10 : 0;

    reasons.push(`category fit ${l.category || 'other'}: +${fitPts}`);
    reasons.push(`size ${l.size || 'unknown'}: +${sizePts}`);
    reasons.push(`region ${l.region || 'unknown'}: +${regionPts}`);
    reasons.push(reachable === 10 ? 'reachable by email: +10' : reachable === 5 ? 'website only: +5' : 'no direct contact: +0');
    if (stockistPts) reasons.push('already carries similar brands: +10');

    let s = fitPts + sizePts + regionPts + reachable + stockistPts;
    if (s > 100) s = 100; if (s < 0) s = 0;
    const band = s >= 70 ? 'hot' : s >= 45 ? 'warm' : 'cold';
    // A store is a "serious prospect" only when it is a strong category fit AND
    // reachable AND not tiny. This is intentionally strict.
    const serious = s >= 70 && fit >= 0.8 && reachable >= 5;
    return { score: s, band, serious, reasons };
  }

  // Rank a list of leads by score (highest first), stable on ties by store name.
  function rank(leads) {
    return (leads || []).map(l => Object.assign({}, l, { scoring: score(l) }))
      .sort((a, b) => b.scoring.score - a.scoring.score || String(a.storeName).localeCompare(String(b.storeName)));
  }

  return { validate, score, rank, CATEGORIES, SIZES, REGIONS, CATEGORY_FIT, EMAIL_RE };
}));
