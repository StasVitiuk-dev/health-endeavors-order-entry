// Sales & Growth — AGENT BENCHMARK harness + gold sets (pure, synthetic).
//
// Gold (expected-answer) test sets for the deterministic advisory logic, a runner
// that scores a function against a gold set, and a regression check that fails
// when accuracy drops below a synthetic baseline. The "providers" compared are
// the deterministic baseline and fake providers — no credentials, no network.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-benchmark'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Gold sets. Each case: { input, expect }. Kept small but meaningful.
  const GOLD = {
    reply: [
      { input: 'We would love to carry this — can we set up a call?', expect: 'INTERESTED' },
      { input: 'What is your wholesale pricing per unit?', expect: 'PRICE_QUESTION' },
      { input: 'Please unsubscribe me.', expect: 'UNSUBSCRIBE' },
      { input: 'Mailer-daemon: delivery has failed, address not found.', expect: 'BOUNCE' },
      { input: 'Not interested, thanks.', expect: 'DECLINED' },
      { input: 'Thanks for your email.', expect: 'UNKNOWN' },
    ],
    claim: [
      { input: 'cold-pressed shea body balm, small batch', expect: 'SAFE' },
      { input: 'this balm cures eczema', expect: 'UNSAFE' },
      { input: 'reduces inflammation and treats rosacea', expect: 'UNSAFE' },
      { input: 'rich, nourishing hand cream for dry skin', expect: 'SAFE' },
    ],
    leadBand: [
      { input: { storeName: 'A', category: 'skincare', carriesSimilarBrands: true, email: 'a@a.example.com', website: 'a.example.com', region: 'domestic', size: 'medium' }, expect: 'serious' },
      { input: { storeName: 'B', category: 'grocery', region: 'unknown', size: 'unknown' }, expect: 'weak' },
    ],
  };

  // Run a scorer over a gold set. `scorer(input) -> label`. `labelFor` maps the
  // scorer's raw result to a comparable label (defaults to identity).
  function runSuite(cases, scorer, labelFor) {
    const lf = labelFor || (x => x);
    const results = (cases || []).map(c => {
      let got;
      try { got = lf(scorer(c.input)); } catch (e) { got = 'ERROR'; }
      return { input: c.input, expected: c.expect, got, pass: got === c.expect };
    });
    const passed = results.filter(r => r.pass).length;
    const accuracy = results.length ? +(passed / results.length).toFixed(3) : null;
    return { results, passed, total: results.length, accuracy,
      accuracyLabel: results.length ? 'MEASURED' : 'UNKNOWN' };
  }

  // Regression gate: accuracy must be >= baseline (0..1). Returns pass + message.
  function regression(accuracy, baseline) {
    if (accuracy == null) return { pass: false, reason: 'no cases measured (UNKNOWN)' };
    const ok = accuracy >= baseline;
    return { pass: ok, accuracy, baseline, reason: ok ? 'at or above baseline' : `below baseline (${accuracy} < ${baseline})` };
  }

  return { GOLD, runSuite, regression };
}));
