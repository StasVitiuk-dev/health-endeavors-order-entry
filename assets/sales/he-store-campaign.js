// Store campaigns — the rules behind "approve the wording once, then choose how
// many stores" (owner, Nov 24). The owner reads one email text and approves it;
// the approval covers that exact wording, not each single send. Then the owner
// chooses how many stores it goes to and which first: the nearest, or the best
// match. A slow start and a stop rule keep the sending address out of spam.
//
// NOTHING HERE SENDS. Approved never means sent (assets/sales/he-sales-approval.js).
// This file only decides who would get it, in which order, and on which day.
//
//   wordingDraft(text)                 -> the part of a campaign an approval covers
//   checkWording(text, deps)           -> { ok, problems, findings }
//   approveWording(text, who, at, deps)-> approval record, or REFUSED with the reason
//   stillApproved(approval, text, deps)-> { valid, reason }
//   pick(stores, opts)                 -> { chosen, skipped }   opts: { count, order, nowMs, restDays }
//   plan(n, opts)                      -> [{ day, count }]      slow start, weekdays only
//   guard(counts)                      -> { stop, why }         bounces / complaints
//   render(text, store, opts)          -> { ok, subject, body, problems }
//   parseStores(csvText)               -> { rows, read, unread, problems }   a pasted list with a heading line
//   exampleStores()                    -> made-up stores for trying the page
//
// deps = { claims: he-sales-claims, approval: he-sales-approval }. Pure. Dual-mode.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-store-campaign'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_COUNT = 500;
  const REST_DAYS = 90;                                   // a store is not written to again sooner than this
  const LADDER = Object.freeze([20, 40, 60, 80, 100]);    // emails a day in week 1, 2, 3, 4, then 100
  const FIELDS = Object.freeze(['store', 'city']);        // what may be filled in per store: {store}, {city}
  const STOP = Object.freeze({ minSent: 20, bounceRate: 0.05, complaints: 2 });
  const EMAIL = /^[^\s@<>(),;:"']+@[^\s@<>(),;:"']+\.[a-z]{2,}$/i;
  const str = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/\r\n?/g, '\n').trim().slice(0, max || 4000);
  const num = (v) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return isFinite(n) ? n : null; };
  const obj = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});

  function wordingDraft(text) {
    const t = obj(text);
    // recipients are deliberately not part of it: the owner approves the wording once
    return { kind: 'store-campaign', recipient: null, subject: str(t.subject, 200), body: str(t.body, 4000), attachments: [], productFacts: null, commercialTerms: null };
  }

  function checkWording(text, deps) {
    const d = wordingDraft(text), problems = [];
    if (d.subject.length < 5) problems.push('Write a subject (at least 5 characters).');
    if (d.subject.length > 120) problems.push('The subject is too long (120 characters at most).');
    if (/\n/.test(d.subject)) problems.push('The subject must be one line.');
    if (d.body.length < 40) problems.push('The email is too short (at least 40 characters).');
    if (d.body.length > 2000) problems.push('The email is too long (2,000 characters at most). Short emails are read and are less likely to be marked as spam.');
    const used = [...(d.subject + '\n' + d.body).matchAll(/\{([^{}\n]{0,40})\}/g)].map(m => m[1].trim().toLowerCase());
    const unknown = [...new Set(used.filter(f => !FIELDS.includes(f)))];
    if (unknown.length) problems.push('Only {store} and {city} can be filled in for each store. Not known: ' + unknown.map(f => '{' + f + '}').join(', ') + '.');
    const claims = deps && deps.claims && typeof deps.claims.scan === 'function' ? deps.claims.scan(d.subject + '\n' + d.body) : null;
    if (!claims) problems.push('The wording check is not available, so this text cannot be approved.');      // fail closed
    const findings = claims && Array.isArray(claims.findings) ? claims.findings : [];
    if (findings.length) problems.push('The wording check flagged a health or medical claim: ' + findings.map(f => '"' + f.match + '"').join(', ') + '. Remove it; a body-care product may not claim to treat anything.');
    return { ok: problems.length === 0, problems: problems, findings: findings, draft: d };
  }

  function approveWording(text, who, atIso, deps) {
    const c = checkWording(text, deps);
    if (!c.ok) return { status: 'REFUSED', sent: false, reason: c.problems.join(' ') };
    if (!deps || !deps.approval || typeof deps.approval.approve !== 'function') return { status: 'REFUSED', sent: false, reason: 'Approvals are not available here.' };
    return deps.approval.approve(c.draft, str(who, 120) || null, str(atIso, 40) || null);
  }

  // an edit of even one letter needs a new approval
  function stillApproved(approval, text, deps) {
    const c = checkWording(text, deps);
    if (!c.ok) return { valid: false, reason: c.problems.join(' ') };
    if (!deps || !deps.approval || typeof deps.approval.check !== 'function') return { valid: false, reason: 'Approvals are not available here.' };
    const r = deps.approval.check(approval, c.draft);
    return { valid: r.valid === true, reason: r.valid === true ? '' : (r.invalidated ? 'The wording changed after you approved it. Read it again and approve the new wording.' : 'This wording is not approved yet.') };
  }

  // stores: [{ id, name, email, city, distanceMiles, score, lastContactedAt, unsubscribed, bounced }]
  function pick(stores, opts) {
    const o = obj(opts);
    const want = Math.floor(num(o.count) == null ? NaN : num(o.count));
    const order = o.order === 'best' ? 'best' : 'nearest';
    const now = typeof o.nowMs === 'number' && isFinite(o.nowMs) ? o.nowMs : Date.now();
    const rest = (num(o.restDays) != null && num(o.restDays) >= 0 ? num(o.restDays) : REST_DAYS) * 86400000;
    if (!(want >= 1 && want <= MAX_COUNT)) return { ok: false, reason: 'Choose how many stores (1 to ' + MAX_COUNT + ').', chosen: [], skipped: [], order: order };
    const ready = [], skipped = [], seen = Object.create(null);
    (Array.isArray(stores) ? stores : []).slice(0, 20000).forEach(s => {
      if (!s || typeof s !== 'object') return;
      const name = str(s.name, 160) || '(no name)', email = str(s.email, 254).toLowerCase();
      const skip = (why) => skipped.push({ name: name, why: why });
      if (!EMAIL.test(email)) return skip('no usable email address');
      if (s.unsubscribed === true) return skip('asked not to be written to');
      if (s.bounced === true) return skip('an earlier email came back');
      if (seen[email]) return skip('same email address as another store');
      const last = typeof s.lastContactedAt === 'string' ? Date.parse(s.lastContactedAt) : NaN;
      if (!isNaN(last) && now - last < rest) return skip('written to in the last ' + Math.round(rest / 86400000) + ' days');
      seen[email] = true;
      const dist = num(s.distanceMiles), score = num(s.score);
      ready.push({ id: s.id == null ? null : s.id, name: name, email: email, city: str(s.city, 120), distanceMiles: dist != null && dist >= 0 ? dist : null, score: score });
    });
    const by = order === 'best'
      ? (a, b) => (b.score == null ? -Infinity : b.score) - (a.score == null ? -Infinity : a.score)
      : (a, b) => (a.distanceMiles == null ? Infinity : a.distanceMiles) - (b.distanceMiles == null ? Infinity : b.distanceMiles);
    ready.sort((a, b) => by(a, b) || a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
    const unknown = ready.filter(s => (order === 'best' ? s.score : s.distanceMiles) == null).length;
    return { ok: true, reason: '', order: order, chosen: ready.slice(0, want), left: Math.max(0, ready.length - want), short: Math.max(0, want - ready.length),
      skipped: skipped, unknownOrder: unknown };
  }

  // n emails spread over working days: 20 a day in the first week, then 40, 60, 80, and 100 from the fifth week
  function plan(n, opts) {
    const o = obj(opts), total = Math.floor(num(n) == null ? NaN : num(n));
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(o.startDay, 10));
    if (!(total >= 1 && total <= MAX_COUNT) || !m) return [];
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
    if (isNaN(d) || d.getUTCDate() !== Number(m[3])) return [];
    const out = []; let left = total, workdays = 0;
    for (let guard = 0; left > 0 && guard < 2000; guard += 1) {
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) {
        const cap = LADDER[Math.min(LADDER.length - 1, Math.floor(workdays / 5))];
        const today = Math.min(cap, left);
        out.push({ day: d.toISOString().slice(0, 10), count: today });
        left -= today; workdays += 1;
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  // the stop rule: too many emails coming back, or people marking them as spam
  function guard(counts) {
    const c = obj(counts), sent = Math.max(0, num(c.sent) || 0), bounced = Math.max(0, num(c.bounced) || 0), complaints = Math.max(0, num(c.complaints) || 0);
    if (complaints >= STOP.complaints) return { stop: true, why: complaints + ' people marked the email as spam. The campaign stops until you look at it.' };
    if (sent >= STOP.minSent && bounced / sent > STOP.bounceRate) return { stop: true, why: bounced + ' of ' + sent + ' emails came back (more than ' + Math.round(STOP.bounceRate * 100) + '%). The list needs cleaning before more are sent.' };
    return { stop: false, why: '' };
  }

  // one store's email as it would go out: fields filled in, and the two lines the law asks for
  function render(text, store, opts) {
    const d = wordingDraft(text), s = obj(store), o = obj(opts), problems = [];
    const address = str(o.postalAddress, 300);
    if (!address) problems.push('Add the business postal address before any real sending (marketing email must carry it).');
    const values = { store: str(s.name, 160), city: str(s.city, 120) };
    const fill = (t) => t.replace(/\{([^{}\n]{0,40})\}/g, (all, f) => { const k = f.trim().toLowerCase(); if (!FIELDS.includes(k)) return all; if (!values[k]) problems.push('This store has no ' + k + ' to fill in.'); return values[k]; });
    const body = fill(d.body) + '\n\n' + 'If you would rather not hear from us, reply "no thanks" and we will not write again.' + (address ? '\n' + address : '');
    return { ok: problems.length === 0, subject: fill(d.subject), body: body, problems: [...new Set(problems)] };
  }

  // A pasted list: the first line names the columns. Needed: name, email. Optional: city,
  // distance (miles), score, last contacted (a date), unsubscribed, bounced (yes/no).
  const MAX_LINES = 5000;
  const COLUMN = Object.freeze({ name: 'name', store: 'name', 'store name': 'name', email: 'email', 'e-mail': 'email', city: 'city', town: 'city',
    distance: 'distanceMiles', miles: 'distanceMiles', 'distance miles': 'distanceMiles', 'distance (miles)': 'distanceMiles', score: 'score',
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
  function parseStores(csvText) {
    const none = (problem) => ({ rows: [], read: 0, unread: 0, problems: problem ? [problem] : [] });
    const text = typeof csvText === 'string' ? csvText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n') : '';
    const lines = text.split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return none('');
    if (lines.length > MAX_LINES + 1) return none('That list is too long (' + MAX_LINES + ' stores at most at a time).');
    const head = cells(lines[0]).map(h => COLUMN[h.toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ')] || null);
    if (!head.includes('name') || !head.includes('email')) return none('The first line must name the columns, with at least: name, email. Optional: city, distance, score, last contacted, unsubscribed, bounced.');
    const yes = (v) => /^(yes|y|true|1|x)$/i.test(v);
    const rows = []; let unread = 0;
    lines.slice(1).forEach((line, i) => {
      const c = cells(line), row = { id: 'row-' + (i + 2) };
      head.forEach((key, k) => { if (key && c[k] !== undefined && c[k] !== '') row[key] = c[k]; });
      if (!row.name || !row.email) { unread += 1; return; }
      const dist = num(row.distanceMiles), score = num(row.score);
      rows.push({ id: row.id, name: str(row.name, 160), email: str(row.email, 254), city: str(row.city, 120),
        distanceMiles: dist != null && dist >= 0 ? dist : null, score: score,
        lastContactedAt: row.lastContactedAt && !isNaN(Date.parse(row.lastContactedAt)) ? new Date(Date.parse(row.lastContactedAt)).toISOString() : null,
        unsubscribed: yes(row.unsubscribed || ''), bounced: yes(row.bounced || '') });
    });
    return { rows: rows, read: rows.length, unread: unread, problems: [] };
  }

  // made-up stores for trying the page: none of them exists
  function exampleStores() {
    const cities = ['Reno', 'Sparks', 'Carson City', 'Truckee', 'Fernley', 'Minden'];
    return Array.from({ length: 12 }, (x, i) => ({ id: 'example-' + (i + 1), name: 'EXAMPLE Store ' + String(i + 1).padStart(2, '0'), email: 'example' + (i + 1) + '@example.test',
      city: cities[i % cities.length], distanceMiles: 2 + i * 4, score: 95 - ((i * 7) % 40), lastContactedAt: i === 9 ? new Date(Date.now() - 20 * 86400000).toISOString() : null,
      unsubscribed: i === 10, bounced: i === 11 }));
  }

  return { MAX_COUNT, REST_DAYS, LADDER, FIELDS, STOP, MAX_LINES, wordingDraft, checkWording, approveWording, stillApproved, pick, plan, guard, render, parseStores, exampleStores };
}));
