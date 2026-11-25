// Confirmed sales tax rates — the dashboard side of docs/ops/sql/drafts/46 (Nov 23).
// Lists the rates the owner confirmed, confirms a new one (set_tax_rate: the rate
// in force ends the day before the new one starts) and records "re-checked today,
// still correct" (recheck_tax_rate). Each stored rate becomes the setting the tax
// rules (he-tax.js) use, so an invoice can only ever use a rate the owner
// confirmed, from its start day, and stays TAX PENDING once a re-check is due.
// Behind the he_tax_rates switch (OFF, not on Feature Flags: it writes real
// records once drafts/46 is installed). The owner and administrators write (owner
// decision, Nov 24); everyone may read; the
// database checks again on its own.
//
// Privacy: `place` is a short name ("Ships from: Illinois"), never a street
// address. Anything that looks like one is refused before it is sent.
//
// Pure apart from the database client it is GIVEN (supabase-js shaped).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.invoice = root.HE.invoice || {})['he-tax-rate-store'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TABLE = 'tax_rates';
  const COLUMNS = ['id', 'place', 'rate', 'effective_from', 'effective_until', 'source', 'note', 'confirmed_by', 'confirmed_at', 'rechecked_at', 'rechecked_by'];
  const RPC = { set: 'set_tax_rate', recheck: 'recheck_tax_rate' };
  const MAX_LIST = 200;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const text = (v) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
  // a real calendar day only: 2027-02-30 is refused (Date would roll it over to March 2)
  const day = (v) => {
    const s = text(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : '';
  };
  // a house number followed by a street word, or a ZIP code: an address, not a place name
  const STREET = /\b\d{1,6}\s+([a-z]+\s+){0,3}(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|way|place|pl|circle|cir|parkway|pkwy|terrace|ter|highway|hwy|apt|apartment|suite|unit)\b/i;
  const ZIP = /\b\d{5}(-\d{4})?\b/;

  function looksLikeAddress(place) {
    const p = text(place).slice(0, 200);
    return STREET.test(p) || ZIP.test(p);
  }

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'Saved tax rates are not installed in the database yet (drafts/46 needs the owner\'s approval).';
    }
    if (code === '42501') return /^Only /.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === '23P01' || code === '22023' || code === 'P0002') return msg || 'The database refused the request.';
    if (code === '23514') return 'The database refused a value that is out of range (a rate between 0% and 25%, a place of 2 to 80 characters, a source of at least 3 characters).';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Try again: confirming the same rate twice records it once.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '.';
  }

  // a stored row -> the setting he-tax.js understands
  function toSetting(row) {
    if (!row || typeof row !== 'object') return null;
    const rate = Number(row.rate);
    if (!isFinite(rate)) return null;
    return { place: text(row.place), rate: rate, confirmedBy: text(row.confirmed_by) || 'owner', confirmedAt: text(row.confirmed_at),
      effectiveFrom: day(row.effective_from) || undefined, effectiveUntil: day(row.effective_until) || undefined,
      recheckedAt: day(row.rechecked_at) || undefined, reference: text(row.source) };
  }

  // Where a rate stands on `today` (YYYY-MM-DD): IN_FORCE, RECHECK_DUE (in force,
  // but a January 1 / July 1 passed since it was last checked), STARTS_LATER, ENDED.
  function standing(row, today, taxMod) {
    const t = day(today);
    const from = day(row && row.effective_from), until = day(row && row.effective_until);
    if (!t || !from) return { state: 'UNKNOWN', due: null };
    if (until && until < t) return { state: 'ENDED', due: null };
    if (from > t) return { state: 'STARTS_LATER', due: null };
    const s = toSetting(row);
    const due = taxMod && typeof taxMod.recheckDue === 'function' ? taxMod.recheckDue(s) : null;
    return { state: due && due <= t ? 'RECHECK_DUE' : 'IN_FORCE', due: due };
  }

  // the form -> the values set_tax_rate takes, or the reasons it cannot be sent
  function checkForm(f) {
    const i = f || {};
    const place = text(i.place), source = text(i.source), note = text(i.note);
    const problems = [];
    if (place.length < 2 || place.length > 80) problems.push('Name the place in 2 to 80 characters, for example "Ships from: Illinois".');
    else if (looksLikeAddress(place)) problems.push('That looks like a street address or a ZIP code. Use a short name for the place instead (the address stays private).');
    const raw = text(i.ratePercent).replace(/%$/, '').trim();
    let rate = null;
    if (!/^\d{1,2}(\.\d{1,3})?$/.test(raw)) problems.push('Type the full rate as a percent with at most 3 decimals, for example 8.75.');
    else {
      const pct = Number(raw);
      if (pct > 25) problems.push('A rate above 25% is not a sales tax rate. Check the number.');
      else rate = Math.round(pct * 1000) / 100000;          // 8.75 -> 0.0875, exactly
    }
    const from = day(i.from);
    if (!from) problems.push('Choose the day the rate starts.');
    if (source.length < 3 || source.length > 200) problems.push('Say where the rate comes from, for example "IDOR Tax Rate Finder".');
    if (note.length > 300) problems.push('The note is too long (at most 300 characters).');
    return problems.length ? { ok: false, problems: problems } : { ok: true, values: { p_place: place, p_rate: rate, p_from: from, p_source: source, p_note: note || null } };
  }

  // 0.0875 -> "8.75" (no trailing zeros; no regular expression on the number)
  function pctText(rate) {
    let t = (Math.round(Number(rate) * 100000) / 1000).toFixed(3);
    while (t.endsWith('0')) t = t.slice(0, -1);
    if (t.endsWith('.')) t = t.slice(0, -1);
    return t;
  }

  function createStore(options) {
    const o = options || {};
    const client = o.client || null, enabled = o.enabled === true, role = o.role == null ? null : String(o.role);
    const inFlight = new Set();
    const refuse = (message, extra) => Object.assign({ ok: false, message: message }, extra || {});
    function ready(write) {
      if (!enabled) return refuse('Saved tax rates are off.', { off: true });
      if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') return refuse('No database connection was given.');
      if (write && role !== 'owner' && role !== 'administrator') return refuse('Only the owner or an administrator can confirm or re-check a tax rate.', { forbidden: true });
      return null;
    }
    async function once(key, fn) {
      if (inFlight.has(key)) return refuse('That request is already being sent. Wait for it to finish.', { busy: true });
      inFlight.add(key);
      try { return await fn(); } catch (e) { return refuse(friendlyError(e), { error: true }); } finally { inFlight.delete(key); }
    }
    async function list() {
      const r = ready(false); if (r) return r;
      return once('list', async function () {
        const res = await client.from(TABLE).select(COLUMNS.join(',')).order('place', { ascending: true }).order('effective_from', { ascending: false }).limit(MAX_LIST);
        if (res && res.error) { const m = friendlyError(res.error); return refuse(m, { installed: !/not installed/.test(m) }); }
        const rows = Array.isArray(res && res.data) ? res.data : [];
        return { ok: true, installed: true, rates: rows, settings: rows.map(toSetting).filter(Boolean), truncated: rows.length === MAX_LIST };
      });
    }
    async function confirm(form) {
      const r = ready(true); if (r) return r;
      const c = checkForm(form);
      if (!c.ok) return refuse(c.problems.join(' '), { problems: c.problems });
      return once('confirm', async function () {
        const res = await client.rpc(RPC.set, c.values);
        if (res && res.error) return refuse(friendlyError(res.error));
        const d = (res && res.data) || {};
        return { ok: true, duplicate: d.duplicate === true, ended: d.ended || null,
          message: d.duplicate === true ? 'That rate was already confirmed. Nothing changed.'
            : 'Confirmed ' + pctText(c.values.p_rate) + '% for ' + c.values.p_place + ' from ' + c.values.p_from + '.' + (d.ended ? ' The previous rate ends the day before.' : '') };
      });
    }
    async function recheck(id) {
      const r = ready(true); if (r) return r;
      if (!UUID.test(String(id || ''))) return refuse('That is not a saved tax rate.');
      return once('recheck:' + id, async function () {
        const res = await client.rpc(RPC.recheck, { p_id: id });
        if (res && res.error) return refuse(friendlyError(res.error));
        return { ok: true, message: 'Recorded: re-checked today, still correct.' };
      });
    }
    return { enabled: enabled, list: list, confirm: confirm, recheck: recheck };
  }

  return { TABLE, COLUMNS, RPC, pctText, looksLikeAddress, friendlyError, toSetting, standing, checkForm, createStore };
}));
