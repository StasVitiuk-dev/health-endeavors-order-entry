// Sales & Growth — CREATOR sample-offer draft (pure, synthetic, draft-only).
//
// Builds on he-sales-creator (shortlist + deterministic fit) and adds the W-4
// piece it does not cover: a SAMPLE OFFER DRAFT for a human to review. The draft
// carries the prospect's source and fit evidence, leaves missing engagement
// metrics UNKNOWN (never invented), and runs the claim firewall on its wording.
//
// Hard safety — three capabilities stay DISABLED and are named, not implied:
//   * contact: false    — nothing is ever sent; this is a draft for the owner.
//   * gifting: false    — no free product is promised or committed.
//   * stockAdjust: false — no stock is moved (the safe write adjust_inventory R4
//                          is not in the local build; a gift would need it).
// Fixtures only. Nothing is contacted, gifted, written to stock, or sent.
//
// Pure. Dual-mode (Node require + browser HE.sales registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-creatoroffer'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DISABLED = { contact: false, gifting: false, stockAdjust: false };
  const DISABLED_NOTE = 'contact, gifting and stock-adjustment are DISABLED; a real gift would need adjust_inventory (R4), which is not in the local build.';

  function asData(text) {
    const s = String(text == null ? '' : text);
    let out = '';
    for (const ch of s) { const c = ch.codePointAt(0);
      out += (c < 0x20 || c === 0x7f || (c >= 0x200b && c <= 0x200f) || c === 0x2028 || c === 0x2029 || c === 0xfeff) ? ' ' : ch; }
    return out.replace(/[ \t]+/g, ' ').trim();
  }

  function approvedFacts(facts) {
    const values = {}; const used = [];
    for (const [k, f] of Object.entries(facts || {})) {
      if (f && f.status === 'APPROVED' && f.value != null) { values[k] = f.value; used.push({ fact: k, value: String(f.value), source: f.source || 'unknown', status: 'APPROVED' }); }
    }
    return { values, used };
  }

  // Draft a sample offer for one prospect (a he-sales-creator.prospect() record).
  // Never throws on bad input — returns a typed record. Never sends.
  function sampleOfferDraft(req) {
    const r = req || {};
    const p = r.prospect || null;
    const claims = r.claims;
    if (!claims || typeof claims.scan !== 'function') throw new Error('he-sales-creatoroffer: inject he-sales-claims');
    const base = { capabilities: { ...DISABLED }, disabledNote: DISABLED_NOTE, published: false, sent: false, synthetic: true, label: 'SIMULATED' };

    if (!p || !p.id) return { ...base, status: 'MISSING_INPUT', missing: ['a shortlisted prospect'] };
    // Only a non-weak fit is worth drafting an offer for; weak stays NOT_ELIGIBLE.
    if (p.band === 'weak') return { ...base, status: 'NOT_ELIGIBLE', reason: 'weak fit — not shortlisted for an offer', prospectId: p.id };

    const { values, used } = approvedFacts(r.facts);
    if (values.product == null) return { ...base, status: 'MISSING_INPUT', missing: ['approved fact: product'], prospectId: p.id };

    const product = asData(values.product);
    // A DRAFT of what the OWNER could send by hand after review — not sent here.
    const text = 'Hi ' + asData(p.name || 'there') + ' — we think ' + product + ' is a fit for your audience. '
      + 'If you are open to it, we would love to arrange a sample for you to try. (Draft for owner review.)';
    const scan = claims.scan(text);
    const evidence = {
      source: p.source || null, sourceDate: p.sourceDate || null,
      fitBand: p.band, fitReasons: p.reasons || [],
      // Engagement / reach stay UNKNOWN unless the shortlist carried real evidence.
      engagement: (p.engagement == null ? 'UNKNOWN' : p.engagement),
      reach: (p.reach == null ? 'UNKNOWN' : p.reach),
    };
    if (!scan.ok) return { ...base, status: 'BLOCKED', prospectId: p.id, text: text, claimFindings: scan.findings, evidence: evidence, factsUsed: used, reason: 'prohibited claim in offer wording (fail closed)' };
    return { ...base, status: 'DRAFT_FOR_HUMAN_REVIEW', prospectId: p.id, name: p.name || null, text: text, claimFindings: [], evidence: evidence, factsUsed: used, version: 1 };
  }

  // Shortlist creators (via he-sales-creator) and attach a sample-offer draft to
  // each. creatorApi = he-sales-creator (injected so this stays pure).
  function shortlistWithOffers(creators, facts, claims, creatorApi) {
    if (!creatorApi || typeof creatorApi.rank !== 'function') throw new Error('he-sales-creatoroffer: inject he-sales-creator');
    const ranked = creatorApi.rank(creators);
    const rows = ranked.map(p => ({ prospect: p, offer: sampleOfferDraft({ prospect: p, facts: facts, claims: claims }) }));
    return {
      shortlist: rows,
      counts: {
        drafted: rows.filter(x => x.offer.status === 'DRAFT_FOR_HUMAN_REVIEW').length,
        notEligible: rows.filter(x => x.offer.status === 'NOT_ELIGIBLE').length,
        blocked: rows.filter(x => x.offer.status === 'BLOCKED').length,
        unknownEngagement: rows.filter(x => x.offer.evidence && x.offer.evidence.engagement === 'UNKNOWN').length,
      },
      capabilities: { ...DISABLED }, disabledNote: DISABLED_NOTE,
      published: false, sent: false, synthetic: true, label: 'SIMULATED',
    };
  }

  // RAW creators (not pre-ranked) + approved facts. he-sales-creator.rank() turns
  // these into prospects; one carries verified engagement, one leaves it missing.
  function fixtures() {
    return {
      creators: [
        { id: 'CR-1', name: 'cleanskinco', platform: 'instagram', niche: 'clean skincare', audienceType: 'boutique-owners', publicUrl: 'instagram.example.com/cleanskinco', engagementBand: 'high', source: 'hashtag #cleanbeauty', sourceDate: '2026-11-01' },
        { id: 'CR-2', name: 'boutiquebuyer', platform: 'tiktok', niche: 'beauty retail', audienceType: 'boutique-owners', publicUrl: 'tiktok.example.com/boutiquebuyer', source: 'referral' }, // no engagementBand -> UNKNOWN
        { id: 'CR-3', name: 'randomfood', platform: 'youtube', niche: 'cooking', audienceType: 'consumers' }, // weak fit
      ],
      facts: { product: { value: 'Shea Body Butter', source: 'catalog', status: 'APPROVED' } },
    };
  }

  return { DISABLED, DISABLED_NOTE, asData, approvedFacts, sampleOfferDraft, shortlistWithOffers, fixtures };
}));
