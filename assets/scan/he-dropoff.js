// Drop-off receipt (owner request, Nov 23: "100 parcels at UPS: scan the receipt
// and every order updates"). Finds every tracking number in text read from a
// carrier receipt (pasted from the iPhone's Live Text, typed, or read from
// barcodes), and turns the database's answer (drafts/48, mark_dropped_off) into
// plain words.
//
// Receipts print numbers in groups ("1Z 999 AA1 01 2345 6784") and next to other
// numbers (quantities, ZIP codes, prices). So neighbouring groups on a line are
// joined and tried, and a number is accepted only when the carrier's own check
// digit is right (UPS, USPS); a FedEx number has no public check digit, so it is
// accepted only as a whole group on a line that says FedEx, and marked "check this
// one". Overlapping finds
// keep the longest. A USPS barcode's "420 + ZIP" routing prefix is removed.
//
// Pure. Dual-mode (Node require + browser HE.scan registry). Uses he-scan.js for
// carrier rules when it is given (the browser passes it; tests require it).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.scan = root.HE.scan || {})['he-dropoff'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_TEXT = 200000;       // characters read from one paste
  const MAX_LINES = 5000;
  const MAX_GROUPS = 12;         // groups joined into one candidate
  const MAX_FOUND = 500;         // the database takes at most 500 at a time
  const ALNUM = /^[0-9A-Z]+$/;

  function groupsOf(line) {
    // split on anything that is not a letter or digit; keep only letter/digit groups
    const out = [];
    let cur = '';
    for (const ch of line) {
      const c = ch.toUpperCase();
      if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z')) cur += c;
      else if (cur) { out.push(cur); cur = ''; }
    }
    if (cur) out.push(cur);
    return out;
  }

  // the candidate strings to try for one joined run (the run itself, and the run
  // without a USPS "420 + 5 or 9 digit ZIP" routing prefix)
  function variants(s) {
    const v = [s];
    if (s.length >= 28 && s.startsWith('420') && /^[0-9]+$/.test(s)) { v.push(s.slice(8)); if (s.length >= 32) v.push(s.slice(12)); }
    return v;
  }

  // eng: he-scan.js (normalizeTracking, detectCarrier, validateTracking)
  function extractTrackings(text, eng) {
    if (!eng || typeof eng.detectCarrier !== 'function' || typeof eng.validateTracking !== 'function') return { found: [], unsure: [], truncated: false };
    const raw = (text == null ? '' : String(text)).slice(0, MAX_TEXT);
    const lines = raw.split(/\r?\n/).slice(0, MAX_LINES);
    const spans = [];   // { line, from, to, tracking, carrier, confidence }
    lines.forEach((line, li) => {
      const g = groupsOf(line);
      // a number with no public check digit (FedEx) counts only on a line that names FedEx
      const saysFedex = g.some(x => x === 'FEDEX' || x === 'FDX');
      for (let i = 0; i < g.length; i++) {
        let joined = '';
        for (let j = i; j < g.length && j < i + MAX_GROUPS; j++) {
          joined += g[j];
          if (joined.length > 40) break;
          if (joined.length < 10 || !ALNUM.test(joined)) continue;
          for (const cand of variants(joined)) {
            const carrier = eng.detectCarrier(cand);
            if (!carrier) continue;
            const v = eng.validateTracking(cand, carrier);
            if (!v.valid) continue;
            // a format-only number (FedEx) counts only as one whole group
            if (v.confidence !== 'checkdigit' && (i !== j || !saysFedex)) continue;
            spans.push({ line: li, from: i, to: j, tracking: cand, carrier: carrier, confidence: v.confidence });
          }
        }
      }
    });
    // keep the longest non-overlapping finds on each line (a part of a number can
    // pass a check digit by chance; the whole number wins)
    spans.sort((a, b) => (a.line - b.line) || ((b.to - b.from) - (a.to - a.from)) || (b.tracking.length - a.tracking.length) || (a.from - b.from));
    const taken = new Set(), chosen = [];
    for (const s of spans) {
      let free = true;
      for (let k = s.from; k <= s.to; k++) if (taken.has(s.line + ':' + k)) { free = false; break; }
      if (!free) continue;
      for (let k = s.from; k <= s.to; k++) taken.add(s.line + ':' + k);
      chosen.push(s);
    }
    chosen.sort((a, b) => (a.line - b.line) || (a.from - b.from));
    const seen = new Set(), found = [], unsure = [];
    for (const s of chosen) {
      if (seen.has(s.tracking)) continue;
      seen.add(s.tracking);
      (s.confidence === 'checkdigit' ? found : unsure).push({ tracking: s.tracking, carrier: s.carrier, confidence: s.confidence });
    }
    const all = found.length + unsure.length;
    return { found: found.slice(0, MAX_FOUND), unsure: unsure.slice(0, Math.max(0, MAX_FOUND - found.length)), truncated: all > MAX_FOUND || raw.length < (text == null ? 0 : String(text).length) };
  }

  // barcodes read from a photo: each is one value; the same rules apply
  function fromBarcodes(values, eng) {
    const list = Array.isArray(values) ? values.map(v => (v == null ? '' : String(v))).filter(Boolean) : [];
    return extractTrackings(list.join('\n'), eng);
  }

  // the database's answer -> plain words, grouped
  const WORD = {
    marked: 'Marked dropped off',
    already: 'Already dropped off or further along',
    not_found: 'Not on any order yet',
    not_marked: 'Not marked (cancelled or returned)',
    ambiguous: 'On two carriers; check it by hand',
  };
  function summarize(results, ordersById) {
    const rows = (Array.isArray(results) ? results : []).filter(r => r && typeof r === 'object' && r.tracking).map(r => {
      const o = ordersById && r.order_id ? ordersById[r.order_id] : null;
      return { tracking: String(r.tracking), result: WORD[r.result] ? r.result : 'ambiguous', word: WORD[r.result] || WORD.ambiguous,
        orderId: r.order_id || null, order: o ? (o.order_number || '') : '', status: r.status || null };
    });
    const count = (k) => rows.filter(r => r.result === k).length;
    const counts = { marked: count('marked'), already: count('already'), not_found: count('not_found'), not_marked: count('not_marked'), ambiguous: count('ambiguous') };
    const parts = [];
    if (counts.marked) parts.push(counts.marked + (counts.marked === 1 ? ' parcel' : ' parcels') + ' marked dropped off');
    if (counts.already) parts.push(counts.already + ' already done');
    if (counts.not_found) parts.push(counts.not_found + ' not on any order yet');
    if (counts.not_marked) parts.push(counts.not_marked + ' not marked (cancelled or returned)');
    if (counts.ambiguous) parts.push(counts.ambiguous + ' to check by hand');
    return { rows: rows, counts: counts, sentence: parts.length ? parts.join(', ') + '.' : 'No tracking numbers were checked.' };
  }

  // ---- the database (drafts/48), through the client it is GIVEN (supabase-js shaped)
  const CARRIERS = ['ups', 'usps', 'fedex', 'dhl', 'other'];
  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Parcels are not installed in the database yet (drafts/48 needs the owner\'s approval).';
    }
    if (code === '42501') return /^Only /.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === '23505' || code === 'P0002' || code === '22023') return msg || 'The database refused the request.';
    if (code === '23514') return 'The database refused a value (a carrier it does not know, or a tracking number with nothing in it).';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Try again: marking the same receipt twice changes nothing the second time.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '.';
  }
  function createStore(options) {
    const o = options || {};
    const client = o.client || null, enabled = o.enabled === true;
    const inFlight = new Set();
    const refuse = (message, extra) => Object.assign({ ok: false, message: message }, extra || {});
    function ready() {
      if (!enabled) return refuse('Drop-off receipts are off.', { off: true });
      if (!client || typeof client.rpc !== 'function') return refuse('No database connection was given.');
      return null;
    }
    async function once(key, fn) {
      if (inFlight.has(key)) return refuse('That request is already being sent. Wait for it to finish.', { busy: true });
      inFlight.add(key);
      try { return await fn(); } catch (e) { return refuse(friendlyError(e), { error: true }); } finally { inFlight.delete(key); }
    }
    async function markDroppedOff(trackings) {
      const r = ready(); if (r) return r;
      const list = [...new Set((Array.isArray(trackings) ? trackings : []).map(t => String(t == null ? '' : t).toUpperCase().replace(/[^0-9A-Z]/g, '')).filter(Boolean))];
      if (!list.length) return refuse('Choose at least one tracking number.');
      if (list.length > MAX_FOUND) return refuse('At most ' + MAX_FOUND + ' tracking numbers at a time.');
      return once('mark', async function () {
        const res = await client.rpc('mark_dropped_off', { p_trackings: list });
        if (res && res.error) return refuse(friendlyError(res.error), { installed: !/not installed/.test(friendlyError(res.error)) });
        const d = (res && res.data) || {};
        return { ok: true, results: Array.isArray(d.results) ? d.results : [] };
      });
    }
    async function attach(orderId, carrier, tracking) {
      const r = ready(); if (r) return r;
      const c = String(carrier || '').toLowerCase();
      const t = String(tracking == null ? '' : tracking).toUpperCase().replace(/[^0-9A-Z]/g, '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(orderId || ''))) return refuse('Choose the order this parcel belongs to.');
      if (!CARRIERS.includes(c)) return refuse('Choose the carrier.');
      if (t.length < 8 || t.length > 40) return refuse('That is not a tracking number.');
      return once('attach:' + t, async function () {
        const res = await client.rpc('add_shipment', { p_order_id: orderId, p_carrier: c, p_tracking: t, p_source: 'typed' });
        if (res && res.error) return refuse(friendlyError(res.error));
        const d = (res && res.data) || {};
        return { ok: true, duplicate: d.duplicate === true, id: d.id || null };
      });
    }
    // every parcel not delivered or cancelled (oldest change first), for the delivery watch
    async function listOpen() {
      const r = ready(); if (r) return r;
      if (typeof client.from !== 'function') return refuse('No database connection was given.');
      return once('listOpen', async function () {
        const res = await client.from('shipments').select('id, order_id, carrier, tracking_number, status, status_at, created_at')
          .not('status', 'in', '(delivered,cancelled)').order('status_at', { ascending: true }).limit(500);
        if (res && res.error) return refuse(friendlyError(res.error), { installed: !/not installed/.test(friendlyError(res.error)) });
        const rows = Array.isArray(res && res.data) ? res.data : [];
        return { ok: true, parcels: rows, truncated: rows.length === 500 };
      });
    }
    return { enabled: enabled, markDroppedOff: markDroppedOff, attach: attach, listOpen: listOpen };
  }

  return { MAX_FOUND, WORD, CARRIERS, groupsOf, extractTrackings, fromBarcodes, summarize, friendlyError, createStore };
}));
