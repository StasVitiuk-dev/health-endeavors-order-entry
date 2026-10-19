// Sales & Growth — claim firewall for all outreach and content.
//
// Health Endeavors is a BODY-CARE / SKINCARE brand, not a supplement or drug.
// Every draft (outreach, replies, line sheets, SEO, blog, FAQ, newsletter,
// social, creator, review requests, website copy) must pass through this
// deterministic firewall before it can be marked READY. It fails CLOSED: if it
// finds a prohibited therapeutic/medical claim, the content is blocked.
//
// Deterministic (no AI, no cost). Catches plain matches and simple obfuscation
// (zero-width characters, and letters spaced out like "e c z e m a"). It is a
// safety net, not a substitute for owner/legal review of real published copy.
//
// Pure. Dual-mode (Node require + browser registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE && root.HE.modules) root.HE.modules.define('he-sales-claims', { api: 1, needs: [] }, function () { return api; });
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Prohibited claim families. Each pattern is matched case-insensitively against
  // normalized text. Kept specific to claim language so safe cosmetic copy
  // (moisturises, softens, scent, ritual) is never flagged.
  const FAMILIES = [
    ['disease-condition', /\b(eczema|psoriasis|dermatitis|rosacea|acne|arthritis|cancer|tumou?r|infection|fungal|eczematous)\b/],
    ['treatment', /\b(treats?|treating|treatment of|cures?|curing|heals?|healing|remed(y|ies)|therapeutic|therapy)\b/],
    ['inflammation', /\b(anti[-\s]?inflammator(y|ies)|reduces? inflammation|inflammation)\b/],
    ['pain', /\b(pain relief|relieves? pain|analgesic|soothes? pain)\b/],
    ['wound', /\b(wound healing|heals? wounds?|heals? cuts?|antiseptic)\b/],
    ['antimicrobial', /\b(antibacterial|antimicrobial|antiviral|kills? (germs|bacteria|viruses))\b/],
    ['drug-regulatory', /\b(fda[-\s]?approved|clinically proven|dermatologist[-\s]?(recommended|tested)|pharmaceutical|medical[-\s]?grade)\b/],
    ['prevent', /\b(prevents?|prevention of) (disease|infection|illness|aging|wrinkles)\b/],
  ];

  // High-severity single tokens also checked against a de-spaced copy, to catch
  // letter-spacing obfuscation like "e c z e m a" or "c-a-n-c-e-r".
  const HARD_TOKENS = ['eczema', 'psoriasis', 'cancer', 'arthritis', 'dermatitis'];

  function normalize(text) {
    return String(text == null ? '' : text)
      .replace(/[​-‏‪-‮﻿]/g, '') // zero-width / bidi controls
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }
  // Collapse single-character separators so "e c z e m a" -> "eczema".
  function deSpace(norm) { return norm.replace(/[\s._\-*]+/g, ''); }

  // scan(text) -> { ok, findings: [{family, match}] }
  function scan(text) {
    const norm = normalize(text);
    const squashed = deSpace(norm);
    const findings = [];
    for (const [family, re] of FAMILIES) {
      const m = norm.match(re);
      if (m) findings.push({ family, match: m[0].trim() });
    }
    for (const tok of HARD_TOKENS) {
      if (squashed.includes(tok) && !findings.some(f => f.match.replace(/\s/g, '') === tok)) {
        findings.push({ family: 'disease-condition', match: tok + ' (obfuscated)' });
      }
    }
    return { ok: findings.length === 0, findings };
  }

  // Throws on any prohibited claim — use before marking content READY (fail closed).
  function assertClean(text, where) {
    const r = scan(text);
    if (!r.ok) {
      throw new Error('he-sales-claims: blocked ' + (where || 'content')
        + ' — prohibited claim(s): ' + r.findings.map(f => f.family + ':"' + f.match + '"').join(', '));
    }
    return true;
  }

  return { scan, assertClean, normalize, deSpace, FAMILIES, HARD_TOKENS };
}));
