// Money differences — the dashboard side of docs/ops/sql/drafts/42 (Nov 22).
// Reads the open differences (found by the daily Shopify check or saved from the
// Money matching screen), saves new ones, and marks one checked with a note.
// Behind the he_money_issues switch, which is not on the Feature Flags page; it
// does anything only once drafts/42 is installed (the owner has not installed it).
// Owner or administrator only; the database checks again on its own.
//
// Pure apart from the database client it is GIVEN (supabase-js shaped). Holds no
// state except a guard against the same request being sent twice at once.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-money-issues-store'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TABLE = 'money_match_issues';
  const COLUMNS = ['id', 'issue_key', 'source', 'outcome', 'summary', 'expected', 'found', 'occurred_on', 'status', 'created_by', 'created_at', 'checked_by', 'checked_at', 'check_note'];
  const RPC = { save: 'record_money_issue', check: 'mark_money_issue_checked' };
  const SAVE_OUTCOMES = ['MISSING', 'AMOUNT_DIFFERS', 'DOUBLED', 'UNEXPECTED', 'NOT_RECORDED', 'UNKNOWN'];
  const MAX_SAVE = 200, MIN_NOTE = 5, MAX_NOTE = 500;
  const ROLES = new Set(['owner', 'administrator']);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)) {
      return 'The list of money differences is not installed in the database yet (drafts/42 needs the owner\'s approval).';
    }
    if (code === '42501') return /^Only /.test(msg) ? msg : 'You do not have permission to do that. Nothing was changed.';
    if (code === '22023' || code === 'P0002') return msg || 'The database refused the request.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Try again; saving the same difference twice records it once.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '.';
  }

  // One engine item (he-money-match.js) -> the row the database keeps. The key
  // is built from what was found, so saving the same file twice adds nothing.
  function toIssue(it) {
    if (!isObj(it) || !it.needsLook || SAVE_OUTCOMES.indexOf(it.outcome) < 0) return null;
    const source = it.kind === 'card' ? 'card' : it.kind === 'shopify_payout' && !it.bankLine ? 'shopify_payout' : 'bank';
    const line = it.bankLine && isObj(it.bankLine) ? it.bankLine : null;
    const key = [source, it.outcome, it.date || '', it.ref || '', line ? line.cents : '', line ? String(line.description || '').slice(0, 60) : '', it.expected == null ? '' : it.expected].join('|').slice(0, 200);
    const words = { MISSING: 'Missing', AMOUNT_DIFFERS: 'Amount differs', DOUBLED: 'Twice', UNEXPECTED: 'Not explained', NOT_RECORDED: 'Not recorded', UNKNOWN: 'Unclear' };
    const what = [it.ref, it.label].filter(Boolean).join(' · ');
    const summary = (words[it.outcome] + ': ' + (what ? what + ' — ' : '') + String(it.why || '')).slice(0, 300);
    return { issue_key: key, source, outcome: it.outcome, summary,
      expected: Number.isInteger(it.expected) ? it.expected / 100 : null, found: Number.isInteger(it.found) ? it.found / 100 : null,
      occurred_on: /^\d{4}-\d{2}-\d{2}$/.test(String(it.date || '')) ? it.date : null };
  }

  function createStore(options) {
    const o = options || {};
    const client = o.client || null, enabled = o.enabled === true, role = o.role == null ? null : String(o.role);
    const inFlight = new Set();
    const refuse = (message, extra) => Object.assign({ ok: false, message }, extra || {});
    function ready() {
      if (!enabled) return refuse('The list of money differences is off.', { off: true });
      if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') return refuse('No database connection was given.');
      if (role != null && !ROLES.has(role)) return refuse('Money differences are for the owner and administrators only.', { forbidden: true });
      return null;
    }
    async function once(key, fn) {
      if (inFlight.has(key)) return refuse('That request is already being sent. Wait for it to finish.', { busy: true });
      inFlight.add(key);
      try { return await fn(); } catch (e) { return refuse(friendlyError(e), { error: true }); } finally { inFlight.delete(key); }
    }
    async function listOpen() {
      const r = ready(); if (r) return r;
      return once('list', async function () {
        const res = await client.from(TABLE).select(COLUMNS.join(',')).eq('status', 'open').order('created_at', { ascending: true }).limit(MAX_SAVE);
        if (res && res.error) { const m = friendlyError(res.error); return refuse(m, { installed: !/not installed/.test(m) }); }
        const rows = Array.isArray(res && res.data) ? res.data : [];
        return { ok: true, installed: true, issues: rows, truncated: rows.length === MAX_SAVE };
      });
    }
    async function save(items) {
      const r = ready(); if (r) return r;
      const rows = (Array.isArray(items) ? items : []).map(toIssue).filter(Boolean);
      if (!rows.length) return refuse('There is no difference to save.');
      if (rows.length > MAX_SAVE) return refuse('More than ' + MAX_SAVE + ' differences: export a shorter period.');
      return once('save', async function () {
        let added = 0, already = 0;
        for (const x of rows) {
          const res = await client.rpc(RPC.save, { p_issue_key: x.issue_key, p_source: x.source, p_outcome: x.outcome, p_summary: x.summary, p_expected: x.expected, p_found: x.found, p_occurred_on: x.occurred_on });
          if (res && res.error) return refuse(friendlyError(res.error) + (added ? ' (' + added + ' were saved before this one.)' : ''), { added });
          if (res && res.data && res.data.duplicate === true) already++; else added++;
        }
        return { ok: true, added, already, message: added ? added + ' difference' + (added === 1 ? '' : 's') + ' saved for follow-up' + (already ? '; ' + already + ' had been saved before' : '') + '.' : 'All of these had been saved before. Nothing changed.' };
      });
    }
    async function markChecked(id, note) {
      const r = ready(); if (r) return r;
      if (!UUID.test(String(id || ''))) return refuse('That is not a saved difference.');
      const n = note == null ? '' : String(note).trim();
      if (n.length < MIN_NOTE) return refuse('Write what you found (at least ' + MIN_NOTE + ' characters).');
      if (n.length > MAX_NOTE) return refuse('The note is too long (at most ' + MAX_NOTE + ' characters).');
      return once('check:' + id, async function () {
        const res = await client.rpc(RPC.check, { p_id: id, p_note: n });
        if (res && res.error) return refuse(friendlyError(res.error));
        return { ok: true, message: 'Marked checked. It stays on the record with your note.' };
      });
    }
    return { enabled, listOpen, save, markChecked };
  }

  return { TABLE, COLUMNS, RPC, toIssue, friendlyError, createStore };
}));
