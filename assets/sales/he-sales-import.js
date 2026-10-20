// Sales & Growth — lead import, normalization and duplicate detection.
//
// The owner may paste a list of prospect stores. This prepares a safe local
// preview: it normalizes names/domains/emails, preserves the raw imported
// values and source, validates structure, lists missing fields, and flags LIKELY
// duplicates for review. It NEVER invents missing contact details and NEVER
// silently merges uncertain records — duplicates are only flagged.
//
// Deterministic, no AI, no network. Pure. Dual-mode.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-sales-import'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

  function normalizeName(name) {
    return String(name == null ? '' : name).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/\b(the|inc|llc|ltd|co|company|corp|boutique|shop|store)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }
  function normalizeDomain(urlOrEmail) {
    let s = String(urlOrEmail == null ? '' : urlOrEmail).trim().toLowerCase();
    if (!s) return '';
    if (s.includes('@')) s = s.split('@').pop();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[\/?#]/)[0].trim();
    return DOMAIN_RE.test(s) ? s : '';
  }
  function normalizeEmail(email) {
    const s = String(email == null ? '' : email).trim().toLowerCase();
    return EMAIL_RE.test(s) ? s : '';
  }
  function normalizePhone(phone) { return String(phone == null ? '' : phone).replace(/[^0-9]/g, ''); }

  // Validate and normalize one raw row; keep the raw values verbatim.
  function prepareRow(raw) {
    const r = raw || {};
    const normalized = {
      storeName: String(r.storeName || '').trim(),
      nameKey: normalizeName(r.storeName),
      email: normalizeEmail(r.email),
      domain: normalizeDomain(r.website || r.email),
      phone: normalizePhone(r.phone),
      city: String(r.city || '').trim(),
      state: String(r.state || '').trim(),
    };
    const problems = [];
    if (!normalized.storeName) problems.push('missing business name');
    if (r.email && !normalized.email) problems.push('email is malformed');
    if (r.website && !normalizeDomain(r.website)) problems.push('website is malformed');
    if (!normalized.email && !normalized.domain) problems.push('no email and no website — not reachable');
    if (!r.source) problems.push('missing source provenance');
    return { raw: r, normalized, problems };
  }

  // Build a duplicate graph over prepared rows. Two rows are LIKELY duplicates
  // when they share any strong key: same email, same domain, same phone, or same
  // normalized name + same city. Returns clusters (size>1) for owner review; it
  // never merges.
  function duplicateGraph(prepared) {
    const n = prepared.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const union = (a, b) => { parent[find(a)] = find(b); };
    const reasons = {};
    const index = (key, map, i, why) => { if (!key) return; if (map.has(key)) { union(map.get(key), i); (reasons[[Math.min(i, map.get(key)), Math.max(i, map.get(key))].join('-')] = why); } else map.set(key, i); };
    const byEmail = new Map(), byDomain = new Map(), byPhone = new Map(), byNameCity = new Map();
    prepared.forEach((p, i) => {
      index(p.normalized.email, byEmail, i, 'same email');
      index(p.normalized.domain, byDomain, i, 'same domain');
      index(p.normalized.phone && p.normalized.phone.length >= 7 ? p.normalized.phone : '', byPhone, i, 'same phone');
      index(p.normalized.nameKey && p.normalized.city ? p.normalized.nameKey + '|' + p.normalized.city.toLowerCase() : '', byNameCity, i, 'same name + city');
    });
    const clusters = {};
    for (let i = 0; i < n; i++) { const root = find(i); (clusters[root] = clusters[root] || []).push(i); }
    return Object.values(clusters).filter(c => c.length > 1).map(members => ({ members, reasons: Object.entries(reasons).filter(([k]) => { const [a, b] = k.split('-').map(Number); return members.includes(a) && members.includes(b); }).map(([, v]) => v) }));
  }

  // Full preview for the owner: prepared rows, duplicate clusters, and a warning count.
  function importPreview(rawRows) {
    const prepared = (rawRows || []).map(prepareRow);
    const duplicates = duplicateGraph(prepared);
    const warnings = prepared.reduce((a, p) => a + p.problems.length, 0);
    return { count: prepared.length, prepared, duplicates, warnings, needsConfirmation: true };
  }

  return { normalizeName, normalizeDomain, normalizeEmail, normalizePhone, prepareRow, duplicateGraph, importPreview, EMAIL_RE };
}));
