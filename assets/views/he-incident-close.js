// Close an incident with a note — the rules behind the "Record what was done"
// button on the Incidents page (owner, Nov 24: an incident could be seen but not
// commented on or closed). The owner or an administrator writes what was done,
// and either keeps the incident open or closes it. Nothing is ever deleted: the
// incident stays in the database with its note, and the database's own history
// (the audit log) records the change.
//
//   canClose(role)                    -> true for the owner and administrators
//   check({ done, ended })            -> { ok, reason, done, ended }
//   patch(mode, checked, nowIso)      -> the columns to change ('note' | 'close')
//   friendlyError(err)                -> one plain sentence
//
// Uses only columns the production table already has (read-only shape check,
// Nov 23): status, actions_taken, resolution, closed_at, updated_at. No database
// step is needed. Pure: no page, no database.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.views = root.HE.views || {})['he-incident-close'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_CHARS = 2000;
  const MIN_CHARS = 3;
  // the production rule allows: open, investigating, escalated, resolved, closed
  const CLOSED_STATUS = 'closed';
  const CLOSED_WORDS = Object.freeze(['resolved', 'closed']);
  const text = (v) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')).replace(/\r\n?/g, '\n').trim();

  function canClose(role) { return role === 'owner' || role === 'administrator'; }

  function check(form) {
    const f = form !== null && typeof form === 'object' ? form : {};
    const done = text(f.done), ended = text(f.ended);
    if (done.length < MIN_CHARS) return { ok: false, reason: 'Write what was done first (a few words are enough).', done: done, ended: ended };
    if (done.length > MAX_CHARS) return { ok: false, reason: 'What was done is too long (' + MAX_CHARS + ' characters at most).', done: done, ended: ended };
    if (ended.length > MAX_CHARS) return { ok: false, reason: 'How it ended is too long (' + MAX_CHARS + ' characters at most).', done: done, ended: ended };
    return { ok: true, reason: '', done: done, ended: ended };
  }

  // The columns to change. An empty "how it ended" never erases an earlier one.
  function patch(mode, checked, nowIso) {
    const c = checked !== null && typeof checked === 'object' ? checked : {};
    const now = typeof nowIso === 'string' && nowIso ? nowIso : new Date().toISOString();
    const out = { actions_taken: text(c.done), updated_at: now };
    if (text(c.ended)) out.resolution = text(c.ended);
    if (mode === 'close') { out.status = CLOSED_STATUS; out.closed_at = now; }
    return out;
  }

  function friendlyError(err) {
    const code = err && err.code != null ? String(err.code) : '';
    const msg = err && err.message != null ? String(err.message).slice(0, 300) : '';
    if (code === '42501') return 'You do not have permission to change this incident. Nothing was changed.';
    if (code === '23514') return 'The database refused the change (a value is not allowed). Nothing was changed.';
    if (!code && /fetch|network|timeout|failed/i.test(msg)) return 'Could not reach the database. Nothing was changed; try again.';
    return 'The database refused: ' + (msg || code || 'no reason given') + '. Nothing was changed.';
  }

  return { MAX_CHARS, MIN_CHARS, CLOSED_STATUS, CLOSED_WORDS, canClose, check, patch, friendlyError };
}));
