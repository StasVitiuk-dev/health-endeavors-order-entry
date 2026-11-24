// Customer emails — the rules behind email campaigns for people who ordered (owner,
// Nov 24: "email marketing agents for regular customers who order with us ... not only
// stores"). Five kinds: a welcome after a first order, time to reorder, something new,
// a hello to people who have not ordered for a while, and "how was it?" a while after
// an order. Only orders the business took itself are used. The owner approves the
// wording once; the page shows exactly who would get it.
//
// NOTHING HERE SENDS. Approved never means sent (assets/sales/he-sales-approval.js).
// Only people who ordered are ever chosen; anyone on the "do not email" list is left out.
//
//   KINDS, templates(kind)             -> three ready texts to start from
//   ownOrders(orders, channelOf)       -> { ok, own, marketplace, unknown }   marketplace buyers are never used
//   whoText(kind, days)                -> who an email goes to, in words
//   audience(kind, clients, opts)      -> { ok, reason, rule, chosen, skipped, notFit }
//        clients: rows of he-day-pack clientList(); opts: { nowMs, days, unsubscribed: [emails] }
//   wordingDraft / checkWording / approveWording / stillApproved   as for store campaigns
//   render(text, client, opts)         -> { ok, subject, body, problems }
//
// deps = { claims: he-sales-claims, approval: he-sales-approval }. Pure. Dual-mode.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-customer-campaign'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY = 86400000;
  const MAX_AUDIENCE = 20000;
  const FIELDS = Object.freeze(['name']);
  const EMAIL = /^[^\s@<>(),;:"']+@[^\s@<>(),;:"']+\.[a-z]{2,}$/i;
  const KINDS = Object.freeze({
    welcome: Object.freeze({ key: 'welcome', name: 'Welcome', days: 14, min: 1, max: 60, who: 'People whose first and only order was in the last {days} days.' }),
    reorder: Object.freeze({ key: 'reorder', name: 'Time to reorder', days: 30, min: 7, max: 119, who: 'People whose last order was at least {days} days ago, and less than 120 days ago.' }),
    newProduct: Object.freeze({ key: 'newProduct', name: 'Something new', days: null, who: 'Everyone who has ordered at least once.' }),
    winBack: Object.freeze({ key: 'winBack', name: 'We miss you', days: 120, min: 60, max: 730, who: 'People who have not ordered for {days} days or more.' }),
    review: Object.freeze({ key: 'review', name: 'How was it?', days: 10, min: 3, max: 60, who: 'People whose last order was {days} to {to} days ago.' }) });
  const REVIEW_WINDOW = 21;                                // "how was it" is asked once, in the three weeks after the chosen day
  // Only orders the business took itself are used. Buyers on Amazon, Etsy and TikTok Shop are those
  // sites' customers; their seller rules do not allow marketing email to them (to be re-checked
  // against each site's current rules before any real sending). An unknown channel is left out too.
  const OWN_CHANNELS = Object.freeze(['shopify', 'wholesale', 'manual']);
  const MARKETPLACES = Object.freeze(['amazon', 'etsy', 'tiktok']);
  const WINBACK_FROM = 120;

  const str = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/\r\n?/g, '\n').trim().slice(0, max || 4000);
  const num = (v) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return isFinite(n) ? n : null; };
  const obj = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const kindOf = (k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(KINDS, k) ? KINDS[k] : null);

  const T = (key, name, subject, body) => Object.freeze({ key: key, name: name, subject: subject, body: body });
  const READY = Object.freeze({
    welcome: [
      T('thanks', 'A thank you', 'Thank you for your first order', 'Hi {name},\n\nThank you for your first order with us. We are a small business and every order matters to us.\n\nIf anything about your order is not right, just reply to this email and we will sort it out.\n\nThank you again.'),
      T('short', 'Short', 'Welcome, {name}', 'Hi {name},\n\nWelcome, and thank you for ordering from us. Reply to this email any time you have a question; a person reads every reply.'),
      T('ask', 'Asks what they think', 'A quick hello from us', 'Hi {name},\n\nA quick hello and a thank you for your order. We would love to hear what you think once you have tried it; just reply to this email.')],
    reorder: [
      T('low', 'Running low?', 'Running low?', 'Hi {name},\n\nIt has been a little while since your last order, so you may be running low. If you would like more, our shop is open.\n\nThank you for being a customer.'),
      T('short', 'Short', 'Time for more, {name}?', 'Hi {name},\n\nJust a short note: if you are close to the end of your last order, you can order again any time in our shop.'),
      T('ask', 'Asks how it went', 'Still enjoying it?', 'Hi {name},\n\nWe hope you are still enjoying your order. If you are close to the end of it, you can order again any time in our shop. And if something was not right, reply and tell us.')],
    newProduct: [
      T('first', 'First to know', 'You are the first to know', 'Hi {name},\n\nWe have made something new and wanted our customers to hear about it first. Have a look in our shop when you have a minute.\n\nThank you for being a customer.'),
      T('short', 'Short', 'New in our shop', 'Hi {name},\n\nThere is something new in our shop. We think you will like it; have a look when you have a minute.'),
      T('story', 'Room for your story', 'Something new from us', 'Hi {name},\n\nWe have been working on something new, and it is ready.\n\n[Write one or two sentences here: what it is and why you made it.]\n\nYou can find it in our shop. Thank you for being a customer.')],
    winBack: [
      T('miss', 'We miss you', 'We miss you, {name}', 'Hi {name},\n\nIt has been a while since your last order and we wanted to say hello. If you would like to order again, our shop is open.\n\nIf something was not right last time, please reply and tell us; we read every reply.'),
      T('short', 'Short', 'A hello from us', 'Hi {name},\n\nA short hello from us. It has been a while, and we would be glad to see you in our shop again.'),
      T('ask', 'Asks why', 'It has been a while', 'Hi {name},\n\nIt has been a while since you ordered from us. Was something not right? Reply to this email and tell us; it helps a small business a lot.\n\nAnd if you would simply like to order again, our shop is open.')],
    review: [
      T('ask', 'Asks how it went', 'How was your order?', 'Hi {name},\n\nYour order should have reached you by now, and we would love to know how it went. Just reply to this email with a line or two; a person reads every reply.\n\nThank you for ordering from us.'),
      T('short', 'Short', 'A quick question, {name}', 'Hi {name},\n\nOne quick question: how do you like your order so far? Reply to this email and tell us, good or bad. It helps a small business a lot.'),
      T('share', 'Asks for a few words', 'Would you share a few words?', 'Hi {name},\n\nIf you have a minute, would you share a few honest words about your order? You can reply to this email, or leave a review in our shop.\n\nGood or bad, we read all of it. Thank you.')] });
  function ownOrders(orders, channelOf) {
    if (typeof channelOf !== 'function') return { ok: false, own: [], marketplace: 0, unknown: 0 };   // without the channel nothing is used
    const own = []; let marketplace = 0, unknown = 0;
    (Array.isArray(orders) ? orders : []).forEach(o => {
      if (!o || typeof o !== 'object') return;
      let ch; try { ch = channelOf(o); } catch (e) { ch = 'other'; }
      if (OWN_CHANNELS.includes(ch)) own.push(o); else if (MARKETPLACES.includes(ch)) marketplace += 1; else unknown += 1;
    });
    return { ok: true, own: own, marketplace: marketplace, unknown: unknown };
  }
  // who an email goes to, in words
  function whoText(kind, days) {
    const k = kindOf(kind); if (!k) return '';
    const d = days == null || days === '' ? k.days : days;
    const n = num(d);
    return k.who.replace('{days}', String(d == null ? '' : d)).replace('{to}', n == null ? '…' : String(n + REVIEW_WINDOW));
  }
  function templates(kind) { const k = kindOf(kind); return k ? READY[k.key].slice() : []; }

  // who would get it: only people with at least one order that counts, an email address, and not on the "do not email" list
  function audience(kind, clients, opts) {
    const k = kindOf(kind), o = obj(opts);
    const none = (reason) => ({ ok: false, reason: reason, rule: '', days: null, chosen: [], skipped: [], notFit: 0 });
    if (!k) return none('Choose which email.');
    let days = null;
    if (k.days != null) {
      const d = o.days == null || o.days === '' ? k.days : num(o.days);
      if (d == null || !Number.isInteger(d) || d < k.min || d > k.max) return none('Type a whole number of days, from ' + k.min + ' to ' + k.max + '.');
      days = d;
    }
    const now = typeof o.nowMs === 'number' && isFinite(o.nowMs) && Math.abs(o.nowMs) < 8.0e15 ? o.nowMs : Date.now();
    const off = Object.create(null);
    (Array.isArray(o.unsubscribed) ? o.unsubscribed : []).slice(0, 100000).forEach(e => { const t = str(e, 254).toLowerCase(); if (t) off[t] = true; });
    const chosen = [], skipped = [], seen = Object.create(null); let notFit = 0;
    (Array.isArray(clients) ? clients : []).slice(0, MAX_AUDIENCE).forEach(c => {
      if (!c || typeof c !== 'object') return;
      const name = str(c.name, 120), email = str(c.email, 254).toLowerCase(), label = name || email || '(no name)';
      const skip = (why) => skipped.push({ name: label, why: why });
      const orders = Number.isInteger(c.orders) && c.orders > 0 ? c.orders : 0;
      if (!orders) return skip('no order that counts (only cancelled or refunded)');
      if (!email) return skip('no email address on the order');
      if (!EMAIL.test(email)) return skip('no usable email address');
      if (off[email]) return skip('asked not to be emailed');
      if (seen[email]) return skip('same email address as another customer');
      const last = typeof c.last === 'string' ? Date.parse(c.last) : NaN, first = typeof c.first === 'string' ? Date.parse(c.first) : NaN;
      if (isNaN(last)) return skip('no date on the order');
      const since = Math.max(0, Math.floor((now - last) / DAY)), sinceFirst = isNaN(first) ? since : Math.max(0, Math.floor((now - first) / DAY));
      const fits = k.key === 'welcome' ? orders === 1 && sinceFirst <= days
        : k.key === 'reorder' ? since >= days && since < WINBACK_FROM
          : k.key === 'winBack' ? since >= days
            : k.key === 'review' ? since >= days && since <= days + REVIEW_WINDOW : true;
      if (!fits) { notFit += 1; return; }
      seen[email] = true;
      chosen.push({ name: name, email: email, orders: orders, last: c.last, daysSince: since });
    });
    chosen.sort((a, b) => a.daysSince - b.daysSince || (a.name || a.email).toLowerCase().localeCompare((b.name || b.email).toLowerCase()) || a.email.localeCompare(b.email));
    return { ok: true, reason: '', rule: whoText(k.key, days), days: days, chosen: chosen, skipped: skipped, notFit: notFit };
  }

  function wordingDraft(text) {
    const t = obj(text);
    return { kind: 'customer-campaign', recipient: null, subject: str(t.subject, 200), body: str(t.body, 4000), attachments: [], productFacts: null, commercialTerms: null };
  }
  function checkWording(text, deps) {
    const d = wordingDraft(text), problems = [];
    if (d.subject.length < 5) problems.push('Write a subject (at least 5 characters).');
    if (d.subject.length > 120) problems.push('The subject is too long (120 characters at most).');
    if (d.subject.indexOf('\n') !== -1) problems.push('The subject must be one line.');
    if (d.body.length < 40) problems.push('The email is too short (at least 40 characters).');
    if (d.body.length > 2000) problems.push('The email is too long (2,000 characters at most). Short emails are read and are less likely to be marked as spam.');
    const all = d.subject + '\n' + d.body;
    const used = [...all.matchAll(/\{([^{}\n]{0,40})\}/g)].map(m => m[1].trim().toLowerCase());
    const unknown = [...new Set(used.filter(f => !FIELDS.includes(f)))];
    if (unknown.length) problems.push('Only {name} can be filled in for each customer. Not known: ' + unknown.map(f => '{' + f + '}').join(', ') + '.');
    if (all.indexOf('[') !== -1 && all.indexOf(']') > all.indexOf('[')) problems.push('A part in [square brackets] is still waiting for your own words.');
    const claims = deps && deps.claims && typeof deps.claims.scan === 'function' ? deps.claims.scan(all) : null;
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
  function stillApproved(approval, text, deps) {
    const c = checkWording(text, deps);
    if (!c.ok) return { valid: false, reason: c.problems.join(' ') };
    if (!deps || !deps.approval || typeof deps.approval.check !== 'function') return { valid: false, reason: 'Approvals are not available here.' };
    const r = deps.approval.check(approval, c.draft);
    return { valid: r.valid === true, reason: r.valid === true ? '' : (r.invalidated ? 'The wording changed after you approved it. Read it again and approve the new wording.' : 'This wording is not approved yet.') };
  }

  // the first name when the order has a plain one; otherwise a neutral greeting
  function firstName(name) {
    const first = str(name, 120).split(' ')[0] || '';
    return /^[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ'\-]{1,29}$/.test(first) ? first.charAt(0).toUpperCase() + first.slice(1) : 'there';
  }
  // one customer's email as it would go out, with the two lines the law asks for
  function render(text, client, opts) {
    const d = wordingDraft(text), c = obj(client), o = obj(opts), problems = [];
    const address = str(o.postalAddress, 300);
    if (!address) problems.push('Add the business postal address before any real sending (marketing email must carry it).');
    const name = firstName(c.name);
    const fill = (t) => t.replace(/\{([^{}\n]{0,40})\}/g, (all, f) => (f.trim().toLowerCase() === 'name' ? name : all));
    const body = fill(d.body) + '\n\n' + 'You are getting this email because you ordered from us. To stop these emails, reply "unsubscribe" and we will take you off the list.' + (address ? '\n' + address : '');
    return { ok: problems.length === 0, subject: fill(d.subject), body: body, problems: problems };
  }

  return { KINDS, WINBACK_FROM, REVIEW_WINDOW, OWN_CHANNELS, MARKETPLACES, ownOrders, whoText, templates, audience, wordingDraft, checkWording, approveWording, stillApproved, firstName, render };
}));
