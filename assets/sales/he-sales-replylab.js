// Sales & Growth — REPLY TRIAGE LAB (pure, local, advisory).
//
// Takes a batch of inbound replies, runs each through the existing reply
// classifier, and turns the results into an owner triage view: a confidence
// distribution, a label histogram, a human-review queue (lowest confidence
// first), and a suppression-review bucket (opt-out/declined/bounce). The point
// is to surface what the classifier is UNSURE about so a human looks there
// first — it never acts on a classification. Nothing is sent, suppressed, or
// replied to automatically; a suppression still needs the owner to confirm.
//
// The classifier is injected (so this stays pure and testable) or taken from
// the HE.sales namespace in the browser. It expects `classify(text) ->
// { label, confidence, reasons }` and `suppresses(label) -> bool`, matching
// he-sales-replies.
//
// Pure. Deterministic. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-replylab'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Lower rank = less certain = reviewed first. The classifier reports 0 for
  // UNKNOWN and the strings 'medium'/'high' otherwise.
  const CONF_RANK = { 0: 0, '0': 0, low: 1, medium: 2, high: 3 };
  function confRank(c) { return CONF_RANK[c] == null ? 1 : CONF_RANK[c]; }
  function confName(c) { return (c === 0 || c === '0') ? 'unknown' : String(c); }

  // Resolve the classifier: explicit injection wins; else the browser namespace.
  function resolveClassifier(injected) {
    if (injected && typeof injected.classify === 'function') return injected;
    const g = (typeof globalThis !== 'undefined' ? globalThis : this);
    const ns = g && g.HE && g.HE.sales && g.HE.sales['he-sales-replies'];
    if (ns && typeof ns.classify === 'function') return ns;
    throw new Error('reply triage: no classifier available');
  }

  // replies: [{ id, text }]. Returns the triage view.
  function triage(replies, classifier) {
    const clf = resolveClassifier(classifier);
    const rows = (replies || []).map(r => {
      const res = clf.classify((r && r.text) || '');
      const suppress = typeof clf.suppresses === 'function' ? !!clf.suppresses(res.label) : false;
      const rank = confRank(res.confidence);
      // Needs a human when unclassified, or confident-but-not-high, or a
      // suppression (which the owner must confirm, never auto-apply).
      const needsHuman = res.label === 'UNKNOWN' || rank < 3 || suppress;
      return { id: (r && r.id) || null, label: res.label,
        confidence: confName(res.confidence), confRank: rank,
        reasons: res.reasons || [], suppress, needsHuman };
    });

    const confidence = { high: 0, medium: 0, low: 0, unknown: 0 };
    const labels = {};
    for (const row of rows) {
      confidence[row.confidence] = (confidence[row.confidence] || 0) + 1;
      labels[row.label] = (labels[row.label] || 0) + 1;
    }

    // Review queue: least-certain first, stable by id. Suppressions are listed
    // in their own bucket as well (an owner must confirm every suppression).
    const reviewQueue = rows.filter(r => r.needsHuman && !r.suppress)
      .sort((a, b) => (a.confRank - b.confRank) || String(a.id).localeCompare(String(b.id)));
    const suppressReview = rows.filter(r => r.suppress);
    const autoClear = rows.filter(r => !r.needsHuman);

    return {
      rows, count: rows.length,
      confidence, labels,
      reviewQueue, reviewCount: reviewQueue.length,
      suppressReview, suppressCount: suppressReview.length,
      autoClearCount: autoClear.length,
      // The share the classifier was NOT highly confident about — a calibration
      // signal for the owner (high = trust it less, review more).
      uncertainShare: rows.length ? (rows.filter(r => r.confRank < 3).length / rows.length) : 0,
      noAutoAction: true, // this engine never acts on any classification
      guard: 'Triage only. Nothing is suppressed, sent, or replied to automatically; the owner confirms every suppression.',
    };
  }

  return { CONF_RANK, confRank, confName, triage };
}));
