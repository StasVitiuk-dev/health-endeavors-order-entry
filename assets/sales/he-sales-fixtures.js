// Sales & Growth — synthetic fixture kit (NO real business/customer data).
//
// Deterministic, seeded fake stores/replies/samples so every sales page can be
// built and tested without touching production. Everything here is clearly fake
// (example.com domains, invented names) and must always be labelled SIMULATED /
// SYNTHETIC in the UI. Body-care / skincare prospects only.
//
// Pure. Dual-mode (Node require + browser registry).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE && root.HE.modules) root.HE.modules.define('he-sales-fixtures', { api: 1, needs: [] }, function () { return api; });
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Tiny deterministic PRNG so fixtures are identical across runs/machines.
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; }; }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  const CATS = ['skincare', 'body-care', 'beauty', 'spa', 'salon', 'boutique', 'wellness', 'gift', 'pharmacy', 'grocery'];
  const SIZES = ['small', 'medium', 'large', 'unknown'];
  const REGIONS = ['local', 'domestic', 'international', 'unknown'];
  const CITIES = [['Austin', 'TX'], ['Portland', 'OR'], ['Asheville', 'NC'], ['Santa Fe', 'NM'], ['Burlington', 'VT'], ['Reno', 'NV']];
  const NOUNS = ['Harbor', 'Fern', 'Cedar', 'Tide', 'Bloom', 'Stone', 'Willow', 'Lumen', 'Marigold', 'Driftwood'];
  const SUFFIX = ['Apothecary', 'Skincare Co', 'Beauty Bar', 'Day Spa', 'Boutique', 'Wellness', 'Gift Shop', 'Mercantile'];
  const SOURCES = ['manual', 'referral', 'event', 'search', 'social', 'other'];

  // Generate `n` synthetic leads deterministically from a seed.
  function leads(n, seed) {
    const r = rng(seed || 20261019);
    const out = [];
    for (let i = 0; i < (n || 12); i++) {
      const noun = pick(r, NOUNS), suf = pick(r, SUFFIX);
      const name = noun + ' ' + suf;
      const slug = (noun + suf).toLowerCase().replace(/[^a-z]/g, '');
      const [city, state] = pick(r, CITIES);
      const hasEmail = r() > 0.15;
      out.push({
        id: 'SYN-' + String(1000 + i),
        storeName: name,
        contactName: r() > 0.5 ? pick(r, ['Jordan', 'Sam', 'Riley', 'Casey', 'Avery']) : '',
        category: pick(r, CATS), size: pick(r, SIZES), region: pick(r, REGIONS),
        city, state, source: pick(r, SOURCES),
        website: slug + '.example.com',
        email: hasEmail ? 'buyer@' + slug + '.example.com' : '',
        carriesSimilarBrands: r() > 0.5,
        synthetic: true,
      });
    }
    return out;
  }

  // A spread of synthetic replies, including the safety labels and ambiguous text.
  function replies() {
    return [
      { text: 'We would love to carry this — can we set up a call?', expect: 'INTERESTED' },
      { text: 'What is your wholesale pricing per unit?', expect: 'PRICE_QUESTION' },
      { text: 'What is your MOQ and lead time?', expect: 'WHOLESALE_TERMS' },
      { text: 'Could you send a sample/tester?', expect: 'SAMPLE_REQUEST' },
      { text: 'Send the line sheet and a few details please.', expect: 'NEEDS_INFORMATION' },
      { text: 'Please circle back next quarter.', expect: 'FOLLOW_UP_LATER' },
      { text: 'Not interested, thanks.', expect: 'DECLINED' },
      { text: 'Please unsubscribe me.', expect: 'UNSUBSCRIBE' },
      { text: 'Automatic reply: out of office until Monday.', expect: 'OUT_OF_OFFICE' },
      { text: 'Mailer-daemon: delivery has failed, address not found.', expect: 'BOUNCE' },
      { text: 'Thanks for your email.', expect: 'UNKNOWN' },
    ];
  }

  // A few bad-fit / malformed / edge rows for import + data-quality testing.
  function messyImportRows() {
    return [
      { storeName: 'Fern Apothecary', email: 'buyer@fernapothecary.example.com', website: 'fernapothecary.example.com', city: 'Austin', source: 'web' },
      { storeName: 'Fern  Apothecary', website: 'https://www.fernapothecary.example.com', city: 'Austin', source: 'web' }, // dup domain
      { storeName: '', email: 'x@y', source: '' },                                                                           // malformed + missing
      { storeName: 'Corner Grocery', website: 'not a url', city: 'Reno', source: 'event' },                                  // malformed url
      { storeName: 'Tide Gift Shop', email: 'hi@tidegift.example.com', city: 'Portland', source: 'referral' },
    ];
  }

  return { leads, replies, messyImportRows, rng };
}));
