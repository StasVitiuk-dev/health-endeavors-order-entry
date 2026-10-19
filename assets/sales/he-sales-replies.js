// Sales & Growth — reply classifier (DETERMINISTIC, synthetic replies only).
//
// Classifies an inbound reply into one safe label. UNKNOWN is a first-class
// result: ambiguous text is NEVER forced into INTERESTED. Safety labels
// (UNSUBSCRIBE, BOUNCE, OUT_OF_OFFICE, DECLINED) take precedence over any
// positive reading, so a "no thanks, unsubscribe" is never treated as interest.
//
// Reply text is UNTRUSTED DATA: this classifier only pattern-matches it and
// never follows instructions found inside it (prompt-injection safe by design —
// it cannot act, only label). No AI, no cost. Pure. Dual-mode.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE && root.HE.modules) root.HE.modules.define('he-sales-replies', { api: 1, needs: [] }, function () { return api; });
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LABELS = ['INTERESTED', 'NEEDS_INFORMATION', 'PRICE_QUESTION', 'WHOLESALE_TERMS',
    'SAMPLE_REQUEST', 'FOLLOW_UP_LATER', 'NOT_NOW', 'DECLINED', 'UNSUBSCRIBE',
    'OUT_OF_OFFICE', 'BOUNCE', 'UNKNOWN'];

  // Checked in priority order; first match wins. Safety/suppression first.
  const RULES = [
    ['BOUNCE', /\b(mailer-daemon|delivery (has )?failed|undeliverable|address not found|recipient.*not found|550[ -]5|message blocked)\b/i],
    ['UNSUBSCRIBE', /\b(unsubscribe|stop emailing|remove me|take me off|do not (contact|email)|opt[\s-]?out)\b/i],
    ['OUT_OF_OFFICE', /\b(out of office|auto[\s-]?reply|automatic reply|on leave|away until|on vacation|annual leave)\b/i],
    ['DECLINED', /\b(not interested|no,? thank|no thanks|we'?ll pass|we will pass|not a (good )?fit|decline|already have a supplier)\b/i],
    ['SAMPLE_REQUEST', /\b(sample|tester|try (it|the product)|send (one|a bottle))\b/i],
    ['PRICE_QUESTION', /\b(price|pricing|cost|how much|wholesale rate|per unit|unit cost)\b/i],
    ['WHOLESALE_TERMS', /\b(moq|minimum order|net ?\d+|lead time|payment terms|margin|keystone|case pack|terms)\b/i],
    ['NEEDS_INFORMATION', /\b(more info|tell me more|send (me )?(the )?(info|details|line ?sheet|catalog|catalogue)|a few questions|learn more)\b/i],
    ['FOLLOW_UP_LATER', /\b(circle back|reach out (again|in)|next (month|quarter|year)|after the (holidays|season)|check back|in q[1-4])\b/i],
    ['NOT_NOW', /\b(not (right )?now|not at (this|the) (time|moment)|maybe later|timing is|too busy)\b/i],
    ['INTERESTED', /\b(interested|love to|sounds (great|good|interesting)|happy to (talk|chat)|let'?s (talk|chat|do it|set up)|set up a call|we'?d like to (carry|stock)|yes,? (we|i)('?d| would)? )\b/i],
  ];

  // classify(text) -> { label, confidence, reasons }
  function classify(text) {
    const t = String(text == null ? '' : text);
    if (!t.trim()) return { label: 'UNKNOWN', confidence: 0, reasons: ['empty reply'] };
    const hits = [];
    for (const [label, re] of RULES) { const m = t.match(re); if (m) hits.push({ label, match: m[0] }); }
    if (!hits.length) return { label: 'UNKNOWN', confidence: 0, reasons: ['no confident signal — left UNKNOWN on purpose'] };
    const chosen = hits[0]; // RULES are priority-ordered: safety/suppression first
    // Confidence: 'high' when the single winning family is clear; 'medium' when
    // several different positive intents co-occur (still never UNKNOWN->INTERESTED).
    const positive = hits.filter(h => !['BOUNCE', 'UNSUBSCRIBE', 'OUT_OF_OFFICE', 'DECLINED'].includes(h.label));
    const confidence = (['BOUNCE', 'UNSUBSCRIBE', 'OUT_OF_OFFICE', 'DECLINED'].includes(chosen.label) || positive.length <= 1) ? 'high' : 'medium';
    return { label: chosen.label, confidence, reasons: hits.map(h => h.label + ':"' + h.match + '"') };
  }

  // Which labels mean "never contact again".
  const SUPPRESS = new Set(['UNSUBSCRIBE', 'DECLINED', 'BOUNCE']);
  function suppresses(label) { return SUPPRESS.has(label); }

  return { classify, suppresses, LABELS, SUPPRESS };
}));
