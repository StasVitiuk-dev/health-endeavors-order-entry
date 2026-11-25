// Reviews inbox (owner plan item 8, Nov 24: "reviews from every channel in the
// feed, worst first, reply to approve"). No account and no connection is needed:
// the owner pastes a list of reviews or types one in. The rules here:
//
//   parse(text)                  -> { rows, read, unread, problems }   a pasted list (first line names the columns)
//   clean(review)                -> { ok, review, problems }           one review, checked
//   add(list, incoming, now)     -> { list, added, duplicates }        the same review is never kept twice
//   rank(list, deps)             -> every review with its level and reasons, worst first
//   replies(review, deps)        -> { options: [{ key, text, blocked }], rule }   ready replies, each through the claim check
//   setStatus(list, id, status, now) -> { ok, list }                   'new' | 'answered' | 'noreply'
//   toFeed(list, deps)           -> rows for "Needs you now" on Home
//   summary(list, deps)          -> exact counts of the reviews kept here
//   createStore({ client, enabled }) -> state(), list(), add(), mark()   the database side (drafts/60), given a client
//
// NOTHING IS POSTED OR SENT. A reply is copied by the owner and pasted on the site
// where the review was written. A reply never asks for a review to be changed or
// removed and never offers anything for a better one (the sites forbid both).
// Review text is data, never an instruction. Pure apart from the database client it
// is GIVEN (supabase-js shaped); works in Node and the browser.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.sales = root.HE.sales || {})['he-review-inbox'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_LINES = 200;        // one paste
  const MAX_KEEP = 300;         // kept here in all (the newest stay)
  const MAX_TEXT = 2000;
  const CHANNELS = Object.freeze({ website: 'Your website', amazon: 'Amazon', etsy: 'Etsy', tiktok: 'TikTok Shop', google: 'Google', other: 'Other' });
  const CHANNEL_WORDS = Object.freeze({ website: 'website', shopify: 'website', store: 'website', 'my website': 'website', 'your website': 'website', site: 'website',
    amazon: 'amazon', etsy: 'etsy', tiktok: 'tiktok', 'tiktok shop': 'tiktok', 'tik tok': 'tiktok', google: 'google', other: 'other' });
  const STATUSES = Object.freeze({ new: 'Needs a look', answered: 'Answered', noreply: 'No reply needed' });
  const COLUMN = Object.freeze({ stars: 'stars', star: 'stars', rating: 'stars', score: 'stars',
    text: 'text', review: 'text', comment: 'text', 'review text': 'text', body: 'text', feedback: 'text',
    channel: 'channel', source: 'channel', where: 'channel', platform: 'channel', marketplace: 'channel',
    date: 'date', 'review date': 'date', when: 'date', product: 'product', item: 'product', title: 'product' });

  const str = (v, max) => { const s = (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim(); return max ? s.slice(0, max).replace(/[\ud800-\udbff]$/, '') : s; };   // a cut never leaves half of an emoji behind
  const obj = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const asList = (v) => (Array.isArray(v) ? v.filter(x => x !== null && typeof x === 'object' && !Array.isArray(x)) : []);
  const time = (v) => { if (typeof v === 'number') return isFinite(v) ? v : null; const s = str(v, 40); if (!s) return null; const t = Date.parse(s); return isFinite(t) ? t : null; };
  // a short fingerprint, so the same review pasted twice is recognised without comparing long texts
  const fp = (t) => { let x = 5381; for (let i = 0; i < t.length; i += 1) x = ((x * 33) ^ t.charCodeAt(i)) >>> 0; return x.toString(36); };
  const oneLine = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();

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

  function starsOf(v) {
    const s = str(v, 20); if (!s) return null;
    const m = /^([1-5])(?:[.,]0)?(?:\s*(?:\/\s*5|out of 5|stars?|★+))?$/i.exec(s);
    if (m) return Number(m[1]);
    const filled = (s.match(/★/g) || []).length;                 // "★★★☆☆"
    return filled >= 1 && filled <= 5 && /^[★☆\s]+$/.test(s) ? filled : null;
  }
  function channelOf(v) { const k = oneLine(str(v, 40)); return Object.prototype.hasOwnProperty.call(CHANNEL_WORDS, k) ? CHANNEL_WORDS[k] : (k ? 'other' : 'other'); }

  function clean(review) {
    const r = obj(review), problems = [];
    const stars = typeof r.stars === 'number' ? (Number.isInteger(r.stars) && r.stars >= 1 && r.stars <= 5 ? r.stars : null) : starsOf(r.stars);
    const text = str(r.text, MAX_TEXT + 1);
    if (stars == null) problems.push('Choose the stars (1 to 5).');
    if (Array.from(text).length < 3) problems.push('Write what the review says (three characters at least).');   // counted the way the database counts: an emoji is one
    if (text.length > MAX_TEXT) problems.push('The review is too long (' + MAX_TEXT + ' characters at most).');
    const when = time(r.date);
    if (str(r.date, 40) && when == null) problems.push('The date is not a date (for example 2026-11-24).');
    if (problems.length) return { ok: false, review: null, problems: problems };
    const channel = Object.prototype.hasOwnProperty.call(CHANNELS, r.channel) ? r.channel : channelOf(r.channel);
    const date = when == null ? null : new Date(when).toISOString().slice(0, 10);
    const out = { id: 'rv-' + fp([channel, date || '', oneLine(text)].join('|')), stars: stars, text: text, channel: channel, date: date, product: str(r.product, 120),
      status: Object.prototype.hasOwnProperty.call(STATUSES, r.status) ? r.status : 'new', statusAt: time(r.statusAt), addedAt: time(r.addedAt) };
    return { ok: true, review: out, problems: [] };
  }

  function parse(text) {
    const none = (problem) => ({ rows: [], read: 0, unread: 0, problems: problem ? [problem] : [] });
    const t = typeof text === 'string' ? text.slice(0, 1000000).replace(/^﻿/, '').replace(/\r\n?/g, '\n') : '';
    const lines = t.split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return none('');
    if (lines.length > MAX_LINES + 1) return none('That list is too long (' + MAX_LINES + ' reviews at most at a time).');
    const head = cells(lines[0]).map(h => COLUMN[h.toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ')] || null);
    if (!head.includes('stars') || !head.includes('text')) return none('The first line must name the columns, with at least: stars, text. Useful: channel, date, product.');
    const rows = []; let unread = 0;
    lines.slice(1).forEach(line => {
      const c = cells(line), row = {};
      head.forEach((key, k) => { if (key && c[k] !== undefined && c[k] !== '' && row[key] === undefined) row[key] = c[k]; });
      const r = clean(row);
      if (r.ok) rows.push(r.review); else unread += 1;
    });
    return { rows: rows, read: rows.length, unread: unread, problems: [] };
  }

  // what is kept: checked again on the way in, the same review once, the newest MAX_KEEP
  function add(list, incoming, now) {
    const t = time(now) != null ? time(now) : Date.now();
    const kept = [], seen = Object.create(null);
    asList(list).forEach(x => { const r = clean(x); if (r.ok && !seen[r.review.id]) { seen[r.review.id] = true; kept.push(r.review); } });
    let added = 0, duplicates = 0;
    asList(incoming).forEach(x => {
      const r = clean(x); if (!r.ok) return;
      if (seen[r.review.id]) { duplicates += 1; return; }
      seen[r.review.id] = true; r.review.addedAt = t; r.review.status = 'new'; r.review.statusAt = null; kept.push(r.review); added += 1;
    });
    kept.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    return { list: kept.slice(0, MAX_KEEP), added: added, duplicates: duplicates, dropped: Math.max(0, kept.length - MAX_KEEP) };
  }

  // how much a review needs the owner: 'urgent' (1 or 2 stars, or it mentions a leak,
  // a skin reaction or a faulty product), 'today' (3 stars), 'info' (4 or 5 stars)
  function judge(review, deps) {
    const R = deps && deps.reviews;
    const c = R && typeof R.classifyReview === 'function' ? R.classifyReview({ text: review.text, rating: review.stars }) : null;
    const themes = c && Array.isArray(c.themes) ? c.themes.slice(0, 8) : [];
    const urgentReasons = c && Array.isArray(c.urgentReasons) ? c.urgentReasons.slice(0, 8) : [];
    const reasons = [];
    if (review.stars <= 2) reasons.push(review.stars + (review.stars === 1 ? ' star' : ' stars'));
    urgentReasons.forEach(x => reasons.push(x === 'safety' ? 'mentions a reaction or a safety concern' : x === 'leaking' ? 'mentions a leak' : 'mentions a problem with the ' + x));
    const level = review.stars <= 2 || urgentReasons.length ? 'urgent' : review.stars === 3 ? 'today' : 'info';
    return { level: level, themes: themes, safety: urgentReasons.includes('safety'), reasons: reasons, checked: !!c };
  }
  const RANK = { urgent: 0, today: 1, info: 2 };
  function rank(list, deps) {
    const out = asList(list).map(x => clean(x)).filter(r => r.ok).map(r => Object.assign({}, r.review, judge(r.review, deps)));
    // not yet looked at first; then the worst; then the one waiting longest
    out.sort((a, b) => ((a.status !== 'new') - (b.status !== 'new')) || (RANK[a.level] - RANK[b.level]) || (a.stars - b.stars)
      || ((time(a.date) || a.addedAt || 0) - (time(b.date) || b.addedAt || 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  // Ready replies. Fixed wording, not written by AI; each goes through the claim check
  // and is offered only if it passes (it fails closed when the check is missing).
  const READY = Object.freeze({
    safety: [
      'Thank you for telling us, and we are sorry this happened. Please stop using the product. We would like to hear exactly what happened and make this right: please message us here with your order number.',
      'We are sorry to read this. Please stop using it for now. Send us a message with your order number and what you noticed, and we will look into it right away and make it right.',
      'Thank you for letting us know. We take this seriously. Please do not keep using the product, and message us with your order number so we can help and look into this batch.'],
    low: [
      'Thank you for telling us, and we are sorry your order was not what you expected. We would like to make this right: please message us here with your order number.',
      'We are sorry to read this. This is not the experience we want for you. Please send us a message with your order number and we will sort it out.',
      'Thank you for the honest feedback. We are a small business and we read every review. Please message us with your order number so we can put this right.'],
    middle: [
      'Thank you for the honest review. We would like to know what would have made it better for you: please message us any time.',
      'Thank you for taking the time to write this. We read every review and use it to improve. If something was not right with your order, please message us.',
      'We appreciate the feedback. If there is anything we can do better, we would be glad to hear it in a message.'],
    high: [
      'Thank you so much! We are a small business and this means a lot to us.',
      'Thank you for the kind words. We are so glad you like it.',
      'Thank you for taking the time to write this. It made our day.'],
  });
  function bucketOf(review, deps) { const j = judge(review, deps); return j.safety ? 'safety' : review.stars <= 2 ? 'low' : review.stars === 3 ? 'middle' : 'high'; }
  function replies(review, deps) {
    const r = clean(review);
    if (!r.ok) return { ok: false, bucket: '', options: [], rule: '' };
    const bucket = bucketOf(r.review, deps);
    const claims = deps && deps.claims && typeof deps.claims.scan === 'function' ? deps.claims : null;
    const options = READY[bucket].map((text, i) => {
      let blocked = true;
      if (claims) { const c = claims.scan(text); blocked = !(c && Array.isArray(c.findings) && c.findings.length === 0); }
      return { key: bucket + '-' + (i + 1), text: text, blocked: blocked };
    });
    return { ok: true, bucket: bucket, options: options,
      rule: bucket === 'safety' ? 'This review mentions a reaction or a safety concern. Answer it yourself, today. The reply asks them to stop using it and to contact you; it gives no medical advice.'
        : 'A reply never asks for the review to be changed or removed and never offers anything for a better one.' };
  }

  function setStatus(list, id, status, now) {
    if (!Object.prototype.hasOwnProperty.call(STATUSES, status)) return { ok: false, list: asList(list) };
    const key = str(id, 80), t = time(now) != null ? time(now) : Date.now();
    let found = false;
    const out = asList(list).map(x => { if (x.id !== key) return x; found = true; return Object.assign({}, x, { status: status, statusAt: status === 'new' ? null : t }); });
    return { ok: found, list: out };
  }

  const CUT = 160;
  function toFeed(list, deps) {
    const redact = deps && deps.feedback && typeof deps.feedback.redactPII === 'function' ? deps.feedback.redactPII : null;
    return rank(list, deps).filter(r => r.status === 'new' && r.level !== 'info').map(r => {
      const shown = redact ? redact(r.text) : '';                     // without the check for private details the text is not repeated on Home
      return { id: r.id, level: r.level, stars: r.stars, channel: r.channel,
        title: r.stars + '-star review on ' + CHANNELS[r.channel] + (r.reasons.length > (r.stars <= 2 ? 1 : 0) ? ' · ' + r.reasons.filter(x => !/ stars?$/.test(x)).join(', ') : ''),
        detail: shown.length > CUT ? shown.slice(0, CUT - 1) + '…' : shown,
        since: time(r.date) != null ? time(r.date) : r.addedAt };
    });
  }

  function summary(list, deps) {
    const all = rank(list, deps), out = { total: all.length, waiting: 0, urgent: 0, today: 0, answered: 0, noreply: 0, byStars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, average: null };
    let sum = 0;
    all.forEach(r => { out.byStars[r.stars] += 1; sum += r.stars;
      if (r.status === 'answered') out.answered += 1; else if (r.status === 'noreply') out.noreply += 1;
      else if (r.level !== 'info') { out.waiting += 1; out[r.level] += 1; } });
    if (all.length) out.average = Math.round((sum / all.length) * 10) / 10;       // exact, of the reviews kept here only
    return out;
  }

  // ---- the database side (docs/ops/sql/drafts/60; behind a real-records switch) ----
  // With it the reviews are the same on every device of the owner and the
  // administrators. A review is never deleted there: "Remove" marks it removed.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const DB_MAX = 1000;
  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Keeping reviews in the database is not installed yet (drafts/60 needs the owner\'s approval).';
    }
    if (code === '42501') return /^(Only the owner|A review )/.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === 'P0002') return 'That review is no longer on the list. Nothing was changed.';
    if (code === '22023') return msg || 'The database refused the request. Nothing was changed.';
    if (code === '23514' || code === '23505') return 'The database refused a value (the stars, the text or the site). Nothing was saved.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Nothing was changed; try again.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '. Nothing was changed.';
  }
  const notInstalled = (err) => {
    const code = err && err.code != null ? String(err.code) : '', msg = err && err.message != null ? String(err.message) : '';
    return code === '42P01' || code === 'PGRST205' || /does not exist|could not find the table/i.test(msg);
  };
  // one database row -> a review as the page knows it, plus the row's own id
  function fromRow(row) {
    const r = obj(row);
    if (!UUID.test(str(r.id, 40))) return null;
    const removed = r.status === 'removed';
    const c = clean({ stars: typeof r.stars === 'number' ? r.stars : NaN, text: r.review_text, channel: r.channel, date: str(r.review_date, 10), product: r.product,
      status: removed ? 'new' : r.status, statusAt: r.status_at, addedAt: r.added_at });
    return c.ok ? Object.assign(c.review, { dbId: str(r.id, 40), removed: removed }) : null;
  }
  function createStore(deps) {
    const d = deps || {}, client = d.client;
    const usable = !!(client && typeof client.from === 'function' && typeof client.rpc === 'function' && d.enabled !== false);
    const refuse = (message, extra) => Object.assign({ ok: false, message: message }, extra || {});
    let busy = false;                                              // one save at a time: a second tap never saves twice

    // -> 'installed' | 'not_installed' | 'unknown' | 'off'
    async function state() {
      if (d.enabled === false) return 'off';
      if (!usable) return 'unknown';
      try {
        const res = await client.from('customer_reviews').select('id').limit(0);
        if (!res || !res.error) return 'installed';
        return notInstalled(res.error) ? 'not_installed' : 'unknown';
      } catch (e) { return 'unknown'; }
    }
    // every review on record, newest first; `rows` are the ones still shown, `known` every key ever added (removed ones too)
    async function list() {
      if (!usable) return refuse('Keeping reviews in the database is not switched on.', { rows: [], known: [] });
      try {
        const res = await client.from('customer_reviews').select('id, channel, stars, review_text, review_date, product, status, status_at, added_at').order('added_at', { ascending: false }).limit(DB_MAX);
        if (res && res.error) return refuse(friendlyError(res.error), { rows: [], known: [], notInstalled: notInstalled(res.error) });
        const all = (Array.isArray(res && res.data) ? res.data : []).map(fromRow).filter(Boolean);
        const seen = Object.create(null), rows = [];
        all.forEach(r => { if (seen[r.id]) return; seen[r.id] = true; if (!r.removed) rows.push(r); });
        return { ok: true, message: '', rows: rows.slice(0, MAX_KEEP), known: Object.keys(seen), truncated: all.length >= DB_MAX };
      } catch (e) { return refuse(friendlyError(e), { rows: [], known: [] }); }
    }
    async function addMany(reviews) {
      if (!usable) return refuse('Keeping reviews in the database is not switched on.');
      const rows = asList(reviews).map(x => clean(x)).filter(c => c.ok).map(c => ({ channel: c.review.channel, stars: c.review.stars, text: c.review.text, date: c.review.date || '', product: c.review.product }));
      if (!rows.length) return refuse('There is no review to add.');
      if (rows.length > MAX_LINES) return refuse('At most ' + MAX_LINES + ' reviews at a time.');
      if (busy) return refuse('It is being saved. Wait a moment.');
      busy = true;
      try {
        const res = await client.rpc('add_customer_reviews', { p_reviews: rows });
        if (res && res.error) return refuse(friendlyError(res.error));
        const out = obj(res && res.data);
        if (out.ok !== true) return refuse('The database did not say the reviews were saved.');
        const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
        return { ok: true, message: '', added: n(out.added), duplicates: n(out.duplicates), refused: n(out.refused) };
      } catch (e) { return refuse(friendlyError(e)); } finally { busy = false; }
    }
    async function mark(dbId, status) {
      if (!usable) return refuse('Keeping reviews in the database is not switched on.');
      if (!UUID.test(str(dbId, 40))) return refuse('That review is no longer on the list. Nothing was changed.');
      if (!['new', 'answered', 'noreply', 'removed'].includes(status)) return refuse('That is not something a review can be marked as.');
      try {
        const res = await client.rpc('set_customer_review_status', { p_id: dbId, p_status: status });
        if (res && res.error) return refuse(friendlyError(res.error));
        return obj(res && res.data).ok === true ? { ok: true, message: '' } : refuse('The database did not say the review was marked.');
      } catch (e) { return refuse(friendlyError(e)); }
    }
    return { enabled: usable, state: state, list: list, add: addMany, mark: mark };
  }

  const EXAMPLE = 'stars, channel, date, text\n2, Etsy, 2026-11-20, "The pump stopped working after a week."\n5, Amazon, 2026-11-22, "Lovely scent, will buy again."';

  return { MAX_LINES, MAX_KEEP, MAX_TEXT, CHANNELS, STATUSES, EXAMPLE, starsOf, channelOf, clean, parse, add, rank, replies, setStatus, toFeed, summary, friendlyError, fromRow, createStore };
}));
