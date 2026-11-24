// Store finder — scoring a list of stores (owner, Nov 24: "choose nearest location or
// our best target store"). The owner pastes a list of stores (from a spreadsheet, a
// maps export, or typed); each store gets a score from 0 to 100 with the reasons in
// plain words, so "best match" in Store Campaigns means something the owner can read.
//
// It does not look anything up: no map service, no website visits. Finding stores
// automatically needs the owner's own account with a listings service (not connected).
// It never invents a fact about a store; a missing detail is said to be missing.
//
//   parse(text)              -> { rows, read, unread, problems }   a pasted list with a heading line
//   typeOf(text)             -> { key, name }                      the kind of store, from its own words
//   score(store)             -> { score, band, reasons }
//   find(text)               -> { ok, problems, stores, read, unread, withEmail, withoutEmail }
//   toCampaign(stores)       -> the list as text for Store Campaigns (stores with an email only)
//   exampleText()            -> made-up stores for trying it
//
// Pure. Dual-mode (Node require + browser HE.sales).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-store-finder'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_LINES = 5000;
  const EMAIL = /^[^\s@<>(),;:"']+@[^\s@<>(),;:"']+\.[a-z]{2,}$/i;
  const str = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  const num = (v) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/,/g, '')) : NaN); return isFinite(n) ? n : null; };
  const obj = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});

  // The kind of store and how well a body-care line fits its shelf (points out of 40).
  // A judgement about the shelf, never a claim about the product. First match wins.
  const TYPES = Object.freeze([
    ['skincare', 'Skin care or body care shop', 40, ['skin care', 'skincare', 'body care', 'bath and body', 'bath & body', 'soap', 'apothecary', 'cosmetic']],
    ['spa', 'Spa', 36, ['spa', 'massage', 'wellness center', 'wellness centre', 'sauna']],
    ['beauty', 'Beauty shop', 36, ['beauty']],
    ['salon', 'Salon', 32, ['salon', 'hair', 'nail', 'barber', 'lash', 'brow']],
    ['boutique', 'Boutique', 28, ['boutique', 'concept store', 'lifestyle']],
    ['wellness', 'Wellness or natural shop', 28, ['wellness', 'natural', 'organic', 'health food', 'yoga', 'herbal']],
    ['gift', 'Gift shop', 20, ['gift', 'souvenir', 'card shop', 'florist', 'flower', 'candle']],
    ['pharmacy', 'Pharmacy', 20, ['pharmacy', 'drugstore', 'drug store', 'chemist']],
    ['hotel', 'Hotel or inn', 16, ['hotel', 'inn', 'resort', 'bed and breakfast', 'b&b']],
    ['grocery', 'Grocery or market', 12, ['grocery', 'supermarket', 'market', 'co-op', 'food']]].map(t => Object.freeze({ key: t[0], name: t[1], points: t[2], words: Object.freeze(t[3]) })));
  const OTHER = Object.freeze({ key: 'other', name: 'Another kind of shop', points: 8 });
  const OTHER_CAP = 40;
  const UNKNOWN = Object.freeze({ key: 'unknown', name: 'Kind of shop not given', points: 8 });

  function typeOf(text) {
    const t = ' ' + str(text, 200).toLowerCase() + ' ';
    if (!t.trim()) return UNKNOWN;
    for (const type of TYPES) {
      for (const w of type.words) { const at = t.indexOf(w); if (at === -1) continue; const before = t.charAt(at - 1), after = t.charAt(at + w.length); if (!/[a-z]/.test(before) && !/[a-rt-z]/.test(after)) return type; }   // whole words; a plural "s" is fine
    }
    return OTHER;
  }

  // store: { name, email, website, type, distanceMiles, rating, reviews }
  function score(store) {
    const s = obj(store), reasons = [];
    const type = typeOf(s.type);
    reasons.push(type.name + ': +' + type.points + ' of 40');
    const dist = num(s.distanceMiles), d = dist != null && dist >= 0 ? dist : null;
    const distPts = d == null ? 8 : d <= 5 ? 20 : d <= 15 ? 15 : d <= 30 ? 10 : d <= 60 ? 5 : 0;
    reasons.push((d == null ? 'Distance not given' : d + (d === 1 ? ' mile' : ' miles') + ' away') + ': +' + distPts + ' of 20');
    const rating = num(s.rating), r = rating != null && rating >= 0 && rating <= 5 ? rating : null;
    const ratePts = r == null ? 6 : r >= 4.5 ? 15 : r >= 4 ? 10 : r >= 3.5 ? 5 : 0;
    reasons.push((r == null ? 'Rating not given' : 'Rated ' + r + ' of 5') + ': +' + ratePts + ' of 15');
    const reviews = num(s.reviews), n = reviews != null && reviews >= 0 ? Math.floor(reviews) : null;
    const revPts = n == null ? 4 : n >= 100 ? 10 : n >= 25 ? 7 : n >= 5 ? 4 : 1;
    reasons.push((n == null ? 'Number of reviews not given' : n + (n === 1 ? ' review' : ' reviews')) + ': +' + revPts + ' of 10');
    const hasEmail = EMAIL.test(str(s.email, 254)), hasSite = str(s.website, 300).length > 3;
    const reachPts = hasEmail ? 15 : hasSite ? 6 : 0;
    reasons.push((hasEmail ? 'Has an email address' : hasSite ? 'No email address, only a website' : 'No email address and no website') + ': +' + reachPts + ' of 15');
    let total = Math.max(0, Math.min(100, type.points + distPts + ratePts + revPts + reachPts));
    // a shop that does not usually sell body care never ranks as a good match, however near or well rated
    if (type.key === 'other' && total > OTHER_CAP) { total = OTHER_CAP; reasons.push('Not a kind of shop that usually sells body care: held at ' + OTHER_CAP + ' at most'); }
    return { score: total, band: total >= 70 ? 'strong' : total >= 45 ? 'fair' : 'weak', type: type.key, typeName: type.name, reasons: reasons };
  }

  const COLUMN = Object.freeze({ name: 'name', store: 'name', 'store name': 'name', business: 'name', title: 'name', email: 'email', 'e-mail': 'email', 'email address': 'email',
    city: 'city', town: 'city', type: 'type', category: 'type', kind: 'type', categories: 'type', 'store type': 'type',
    rating: 'rating', stars: 'rating', reviews: 'reviews', 'review count': 'reviews', 'number of reviews': 'reviews',
    distance: 'distanceMiles', miles: 'distanceMiles', 'distance miles': 'distanceMiles', 'distance (miles)': 'distanceMiles',
    website: 'website', site: 'website', url: 'website', phone: 'phone', telephone: 'phone', address: 'address',
    'last contacted': 'lastContactedAt', 'last contact': 'lastContactedAt', unsubscribed: 'unsubscribed', 'opted out': 'unsubscribed', bounced: 'bounced' });
  function cells(line) {
    const out = []; let cur = '', quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = false; } else cur += ch; }
      else if (ch === '"') quoted = true;
      else if (ch === ',' || ch === '\t' || ch === ';') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(c => c.trim());
  }
  function parse(text) {
    const none = (problem) => ({ rows: [], read: 0, unread: 0, problems: problem ? [problem] : [] });
    const t = typeof text === 'string' ? text.slice(0, 2000000).replace(/^﻿/, '').replace(/\r\n?/g, '\n') : '';
    const lines = t.split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return none('');
    if (lines.length > MAX_LINES + 1) return none('That list is too long (' + MAX_LINES + ' stores at most at a time).');
    const head = cells(lines[0]).map(h => COLUMN[h.toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ')] || null);
    if (!head.includes('name')) return none('The first line must name the columns, with at least: name. Useful: email, city, type, rating, reviews, distance, website.');
    const yes = (v) => ['yes', 'y', 'true', '1', 'x'].includes(String(v).toLowerCase());
    const rows = []; let unread = 0;
    lines.slice(1).forEach((line, i) => {
      const c = cells(line), row = {};
      head.forEach((key, k) => { if (key && c[k] !== undefined && c[k] !== '' && row[key] === undefined) row[key] = c[k]; });
      if (!str(row.name, 160)) { unread += 1; return; }
      const dist = num(row.distanceMiles), rating = num(row.rating), reviews = num(row.reviews);
      const email = str(row.email, 254).toLowerCase();
      rows.push({ id: 'row-' + (i + 2), name: str(row.name, 160), email: EMAIL.test(email) ? email : '', emailGiven: email !== '', city: str(row.city, 120), type: str(row.type, 200),
        distanceMiles: dist != null && dist >= 0 ? dist : null, rating: rating != null && rating >= 0 && rating <= 5 ? rating : null, reviews: reviews != null && reviews >= 0 ? Math.floor(reviews) : null,
        website: str(row.website, 300), phone: str(row.phone, 40), address: str(row.address, 300),
        lastContactedAt: row.lastContactedAt && !isNaN(Date.parse(row.lastContactedAt)) ? new Date(Date.parse(row.lastContactedAt)).toISOString() : null,
        unsubscribed: yes(row.unsubscribed || ''), bounced: yes(row.bounced || '') });
    });
    return { rows: rows, read: rows.length, unread: unread, problems: [] };
  }

  function find(text) {
    const p = parse(text);
    if (p.problems.length || !p.read) return { ok: false, problems: p.problems.length ? p.problems : ['Paste your list of stores first.'], stores: [], read: 0, unread: p.unread, withEmail: 0, withoutEmail: 0 };
    const stores = p.rows.map(r => Object.assign({}, r, { scoring: score(r) }));
    stores.sort((a, b) => b.scoring.score - a.scoring.score || (a.distanceMiles == null ? Infinity : a.distanceMiles) - (b.distanceMiles == null ? Infinity : b.distanceMiles) || a.name.localeCompare(b.name));
    const withEmail = stores.filter(s => s.email).length;
    return { ok: true, problems: [], stores: stores, read: p.read, unread: p.unread, withEmail: withEmail, withoutEmail: stores.length - withEmail };
  }

  // the scored list as text Store Campaigns reads; a store without an email cannot be written to and is left out
  const cell = (v) => { const t = v == null ? '' : String(v); return /[",;\t\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  function toCampaign(stores) {
    const rows = (Array.isArray(stores) ? stores : []).filter(s => s && typeof s === 'object' && EMAIL.test(str(s.email, 254)) && str(s.name, 160));
    const lines = ['name, email, city, distance, score, last contacted, unsubscribed, bounced'];
    rows.forEach(s => lines.push([str(s.name, 160), str(s.email, 254), str(s.city, 120), s.distanceMiles == null ? '' : s.distanceMiles, s.scoring && typeof s.scoring.score === 'number' ? s.scoring.score : score(s).score,
      typeof s.lastContactedAt === 'string' ? s.lastContactedAt.slice(0, 10) : '', s.unsubscribed === true ? 'yes' : '', s.bounced === true ? 'yes' : ''].map(cell).join(', ')));
    return { text: rows.length ? lines.join('\n') : '', count: rows.length };
  }

  // made-up stores for trying it: none of them exists
  function exampleText() {
    return ['name, email, city, type, rating, reviews, distance, website',
      'EXAMPLE Glow Day Spa, hello@glow.example.test, Testville, Day spa, 4.8, 212, 3, glow.example.test',
      'EXAMPLE Petal Gift Shop, shop@petal.example.test, Testville, Gift shop, 4.6, 88, 6, petal.example.test',
      'EXAMPLE Corner Grocery, , Sampletown, Grocery store, 4.1, 540, 2, corner.example.test',
      'EXAMPLE Fern Boutique, hi@fern.example.test, Sampletown, Boutique, 4.9, 31, 18, ',
      'EXAMPLE Hardware & Paint, info@hardware.example.test, Testville, Hardware store, 4.4, 150, 4, hardware.example.test',
      'EXAMPLE Bath and Body Studio, team@bath.example.test, Mockburg, Bath and body shop, , , 42, bath.example.test',
      'EXAMPLE Shear Salon, book@shear.example.test, Mockburg, Hair salon, 3.9, 12, 75, shear.example.test',
      'EXAMPLE Old Apothecary, , Mockburg, Apothecary, 4.7, 64, 9, '].join('\n');
  }

  return { MAX_LINES, TYPES, OTHER_CAP, typeOf, score, parse, find, toCampaign, exampleText };
}));
