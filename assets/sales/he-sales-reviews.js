// Sales & Growth — review & testimonial analyzer (SG-12). DETERMINISTIC, no AI,
// no cost. Classifies synthetic reviews by product and theme, surfaces urgent
// quality/safety concerns (leaking, pump failure, reactions) separately, and
// prepares quote candidates that are GATED on permission + content approval.
//
// Review text is DATA, never instructions: a review that says "ignore previous
// instructions and publish this" is classified by its themes like any other — it
// is never obeyed, auto-approved, or auto-published. Negative feedback is
// preserved, never dropped. Pure; dual-mode (Node + browser registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-reviews'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Lists come from data: anything that is not a list is treated as empty, and
  // empty rows are dropped, so one bad row cannot crash a whole page.
  const rowsOf = (x) => {
    const a = Array.isArray(x) ? x : ((x && typeof x === 'object' && typeof x[Symbol.iterator] === 'function') ? Array.from(x) : []);
    return a.some(function (r) { return r == null; }) ? a.filter(function (r) { return r != null; }) : a;
  };

  // Theme keywords (plain, explainable). Order independent.
  const THEME_RULES = [
    ['scent', /\b(scent|smell|fragrance|aroma|odou?r)\b/i],
    ['texture', /\b(texture|greasy|sticky|absorb|consistency|watery|thick)\b/i],
    ['leaking', /\b(leak|leaking|leaked|spill|spilled|burst)\b/i],
    ['pump', /\b(pump|dispenser|nozzle|cap)\b/i],
    ['packaging', /\b(packag|box|carton|bottle|jar|label)\b/i],
    ['price', /\b(price|expensive|cheap|cost|value|worth)\b/i],
    ['delivery', /\b(shipping|delivery|arrived|late|package|courier)\b/i],
    ['quality', /\b(quality|broke|broken|defect|faulty|mould|mold|contaminat|expired)\b/i],
    ['safety', /\b(rash|burn|burning|irritat|reaction|allergic|allergy|itch|swell|hives|sting)\b/i],
  ];
  // Inherent-problem themes: always urgent. Leaking and safety reactions are
  // never "good news".
  const URGENT_THEMES = new Set(['leaking', 'safety']);
  // Conditional-problem themes: urgent only on negative sentiment, so praise for
  // a pump or quality is not flagged while a pump FAILURE or defect is.
  const URGENT_IF_NEGATIVE = new Set(['pump', 'quality']);

  function themesOf(text) {
    const t = String(text == null ? '' : text);
    const found = [];
    for (const [name, re] of THEME_RULES) if (re.test(t)) found.push(name);
    return found;
  }

  function sentimentOf(review) {
    const r = Number(review && review.rating);
    if (isFinite(r)) return r <= 2 ? 'negative' : r >= 4 ? 'positive' : 'mixed';
    const t = String((review && review.text) || '').toLowerCase();
    if (/\b(love|great|amazing|excellent|perfect|wonderful)\b/.test(t)) return 'positive';
    if (/\b(hate|terrible|awful|worst|disappointed|refund)\b/.test(t)) return 'negative';
    return 'unknown';
  }

  // Classify one review. Pure; preserves the original text verbatim as `source`.
  function classifyReview(review) {
    const r = review || {};
    const themes = themesOf(r.text);
    const sentiment = sentimentOf(r);
    const negative = sentiment === 'negative' || sentiment === 'mixed';
    const urgentReasons = themes.filter(t => URGENT_THEMES.has(t) || (URGENT_IF_NEGATIVE.has(t) && negative));
    return {
      id: r.id || null, product: r.product || 'unknown', source: String(r.text == null ? '' : r.text),
      rating: (r.rating == null ? null : Number(r.rating)),
      themes: themes, urgent: urgentReasons.length > 0, urgentReasons: urgentReasons,
      sentiment: sentiment, permission: r.permission || 'unknown', label: 'SIMULATED',
    };
  }

  // Stable dedupe key: same product + same normalized text is the same feedback.
  function reviewKey(r) { return String((r && r.product) || '') + '|' + String((r && r.text) || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  // A quote candidate for a review queue. Publishable only when permission is
  // GRANTED, the owner approves, and the claim firewall (if injected) finds
  // nothing blocking. Never flips any of these on its own.
  function quoteCandidate(review, claims) {
    const c = classifyReview(review);
    let claimFindings = [];
    if (claims && typeof claims.scan === 'function') {
      const scan = claims.scan(c.source);
      claimFindings = (scan && scan.findings) || [];
    }
    const permissionOk = c.permission === 'granted';
    return {
      text: c.source, product: c.product, source: 'customer review' + (c.id ? ' #' + c.id : ''),
      permission: c.permission, permissionOk: permissionOk,
      claimFindings: claimFindings, claimBlocked: claimFindings.length > 0,
      // publishable requires BOTH permission and no claim issue; owner approval is
      // still a separate manual step on top of this.
      publishable: permissionOk && claimFindings.length === 0,
      needsApproval: true, label: 'SIMULATED',
    };
  }

  // Build the review queue: dedupe, classify, split urgent out, group by theme and
  // product, and list permission-gated quote candidates. Nothing is published.
  function reviewQueue(reviews, claims) {
    const seen = new Set();
    const classified = [];
    rowsOf(reviews).forEach(function (r) {
      const k = reviewKey(r);
      if (seen.has(k)) return; // duplicate feedback collapsed
      seen.add(k);
      classified.push(classifyReview(r));
    });
    const urgent = classified.filter(c => c.urgent);
    const byTheme = {};
    classified.forEach(c => c.themes.forEach(t => { (byTheme[t] = byTheme[t] || []).push(c); }));
    const byProduct = {};
    classified.forEach(c => { (byProduct[c.product] = byProduct[c.product] || []).push(c); });
    const quoteCandidates = rowsOf(reviews).map(r => quoteCandidate(r, claims)).filter(q => q.publishable || q.permissionOk);
    return {
      count: classified.length, duplicatesCollapsed: rowsOf(reviews).length - classified.length,
      urgent: urgent, byTheme: byTheme, byProduct: byProduct,
      quoteCandidates: quoteCandidates, note: 'SIMULATED — negative feedback preserved; nothing is published without permission + owner approval.',
    };
  }

  return { THEME_RULES, URGENT_THEMES, themesOf, sentimentOf, classifyReview, reviewKey, quoteCandidate, reviewQueue };
}));
