// Sales & Growth — CREATOR prospects + ROI + safety (pure, synthetic, advisory).
//
// Models skincare/body-care content creators as prospects (platform, audience,
// fit, public URL, score, status, sample consideration, draft) and a synthetic
// ROI view. Hard safety: NO auto-contact, NO payment promise, NO free-product
// promise, NO medical claim, NO usage-rights assumption. Advisory only.
//
// Pure. Dual-mode (Node require + browser HE.sales namespace).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-creator'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'pinterest', 'blog', 'other'];
  const SAFETY = Object.freeze({
    autoContact: false, paymentPromise: false, freeProductPromise: false,
    medicalClaim: false, usageRightsAssumed: false,
  });

  // Deterministic fit score 0..100 from public, non-sensitive signals only.
  function fit(c) {
    let s = 0; const r = [];
    if (/skin|body|beauty|clean|wellness/i.test(c.niche || '')) { s += 40; r.push('on-niche'); } else r.push('niche unclear');
    if (c.audienceType === 'wholesale-buyers' || c.audienceType === 'boutique-owners') { s += 25; r.push('audience = buyers'); }
    else if (c.audienceType === 'consumers') { s += 10; r.push('audience = consumers'); }
    if (c.publicUrl) { s += 10; r.push('has public profile'); } else r.push('no public URL (UNKNOWN reach)');
    if (c.engagementBand === 'high') { s += 25; r.push('high engagement'); } else if (c.engagementBand === 'medium') s += 12;
    return { score: Math.min(100, s), reasons: r, band: s >= 70 ? 'strong' : s >= 40 ? 'possible' : 'weak' };
  }

  function prospect(c) {
    const f = fit(c || {});
    return { id: c.id, name: c.name, platform: PLATFORMS.includes(c.platform) ? c.platform : 'other',
      audienceType: c.audienceType || 'unknown', niche: c.niche || 'unknown', publicUrl: c.publicUrl || null,
      score: f.score, band: f.band, reasons: f.reasons, status: 'IDENTIFIED',
      sampleConsideration: f.band === 'strong' ? 'FLAGGED_FOR_OWNER' : 'not yet',
      outreachDraft: null, safety: SAFETY, synthetic: true };
  }

  function rank(creators) { return (creators || []).map(prospect).sort((a, b) => b.score - a.score); }

  // ROI view: separates ACTUAL from UNKNOWN; attribution for creators is usually
  // UNKNOWN and must be shown as such, never fabricated.
  function roi(data) {
    const d = data || {};
    const sampleCost = d.sampleCost == null ? null : d.sampleCost;
    const orders = d.attributedOrders == null ? null : d.attributedOrders;
    return { sampleCost, sampleCostLabel: sampleCost == null ? 'UNKNOWN' : 'ESTIMATED',
      traffic: d.traffic == null ? null : d.traffic, trafficLabel: d.traffic == null ? 'UNKNOWN' : 'ESTIMATED',
      attributedOrders: orders, attribution: 'UNKNOWN (creator attribution is rarely exact)',
      conversion: (orders != null && d.traffic) ? +(orders / d.traffic).toFixed(4) : null,
      note: 'Advisory. No creator is contacted and no product/payment is promised.' };
  }

  function fixtures() {
    return rank([
      { id: 'CR-1', name: 'cleanskinco', platform: 'instagram', niche: 'clean skincare', audienceType: 'consumers', publicUrl: 'instagram.example.com/cleanskinco', engagementBand: 'high' },
      { id: 'CR-2', name: 'boutiquebuyer', platform: 'tiktok', niche: 'beauty retail', audienceType: 'boutique-owners', publicUrl: 'tiktok.example.com/boutiquebuyer', engagementBand: 'medium' },
      { id: 'CR-3', name: 'randomfood', platform: 'youtube', niche: 'cooking', audienceType: 'consumers', engagementBand: 'low' },
    ]);
  }

  return { PLATFORMS, SAFETY, fit, prospect, rank, roi, fixtures };
}));
