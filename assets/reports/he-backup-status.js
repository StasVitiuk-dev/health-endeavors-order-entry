// Backup status on Home (owner, Nov 24: "a warning on Home when the newest backup is older
// than a day"; design D5, docs/ops/RECOVERY_AND_BACKUP_READINESS.md §3a).
// The nightly backup job and the monthly restore test write one line each run into
// public.backup_reports (docs/ops/sql/drafts/70): kind, finished_at, ok, size_bytes. This file
// turns the newest lines into the one backups line of Home's checks. Pure: no page, no database.
//
//   judge(rows, nowMs) -> { state, level, title, why, action, nightly, restore }
//     state: 'ok' | 'stale' | 'failed' | 'restore' | 'none' | 'unknown'
//     level: the level Home's checks use: 'critical' (top, urgent), 'action', 'info'
//   notInstalled()     -> the line when the table is not there yet (database step 19)
//   read(client)       -> Promise of the line: reads the newest reports with the page's own
//                         signed-in client (reading only), then judge(); a missing table gives
//                         notInstalled(), any other failure judge(null) ("could not check")
//
// Rules (the owner's: "older than a day"):
//   * the newest nightly backup failed                      -> critical
//   * the newest nightly backup is older than 26 hours      -> critical (a day, plus slack for
//     a job that starts a little late; the exact age is shown)
//   * no nightly backup has reported yet                    -> action
//   * the newest restore test failed, or is older than 35
//     days (a monthly test, plus slack), or none reported   -> action (backups themselves fine)
//   * otherwise                                             -> info: last night's backup succeeded
// A line that cannot be read says so ('unknown'); it is never shown as "all good".
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.HE) { (root.HE.reports = root.HE.reports || {})['he-backup-status'] = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HOUR = 3600000, DAY = 24 * HOUR;
  const NIGHTLY_MAX_MS = 26 * HOUR, RESTORE_MAX_MS = 35 * DAY, MAX_ROWS = 1000;
  const CHECKLIST = 'Owner: do the 2-minute backup look (docs/ops/PRODUCTION_READONLY_VERIFICATION_EXT10.md, V1).';
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const ms = (v) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return isFinite(t) ? t : null; };
  const nowOf = (n) => (typeof n === 'number' && isFinite(n) && Math.abs(n) < 8.0e15 ? n : Date.now());

  // "3 hours ago", "2 days ago" (never "0 minutes": under an hour reads "less than an hour ago")
  function ago(t, now) {
    const d = Math.max(0, now - t);
    if (d < HOUR) return 'less than an hour ago';
    if (d < 48 * HOUR) { const h = Math.floor(d / HOUR); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
    const days = Math.floor(d / DAY); return days + ' days ago';
  }

  function newest(rows, kind) {
    let best = null;
    rows.forEach(r => {
      if (!isObj(r) || r.kind !== kind || typeof r.ok !== 'boolean') return;
      const t = ms(r.finished_at); if (t == null) return;
      if (!best || t > best.at) best = { at: t, ok: r.ok };
    });
    return best;
  }

  function judge(rows, nowMs) {
    const now = nowOf(nowMs);
    if (!Array.isArray(rows)) {
      return { state: 'unknown', level: 'unknown', nightly: null, restore: null, title: 'Backups: could not check',
        why: 'The backup reports could not be read just now, so the dashboard cannot say whether the backups are fine. Not the same as "all good".',
        action: 'Press "Check again". If it stays like this: ' + CHECKLIST };
    }
    const list = rows.slice(0, MAX_ROWS);
    const nightly = newest(list, 'nightly_backup'), restore = newest(list, 'restore_test');
    const base = { nightly: nightly, restore: restore };
    // the restore test, said the same way in every state
    const restoreWords = !restore ? 'No monthly restore test has reported yet.'
      : !restore.ok ? 'The last restore test FAILED (' + ago(restore.at, now) + ').'
      : now - restore.at > RESTORE_MAX_MS ? 'The last restore test succeeded, but ' + ago(restore.at, now) + ' (more than a month).'
      : 'The last restore test succeeded ' + ago(restore.at, now) + '.';
    const restoreBad = !restore || !restore.ok || now - restore.at > RESTORE_MAX_MS;
    if (!nightly) {
      return Object.assign(base, { state: 'none', level: 'action', title: 'Backups: no backup has reported yet',
        why: 'No nightly backup has reported to the dashboard yet. Either the report step of the backup job is not set up yet, or no backup has run since it was. ' + restoreWords,
        action: CHECKLIST });
    }
    if (!nightly.ok) {
      return Object.assign(base, { state: 'failed', level: 'critical', title: 'Backups: the last nightly backup FAILED',
        why: 'The nightly backup reported a failure ' + ago(nightly.at, now) + '. Until a backup succeeds, the newest safe copy is older. ' + restoreWords,
        action: 'Open the backups repository on GitHub, look at the last run, and run it again. Report only "green/red, date" here; never paste logs.' });
    }
    if (now - nightly.at > NIGHTLY_MAX_MS) {
      return Object.assign(base, { state: 'stale', level: 'critical', title: 'Backups: the newest backup is older than a day',
        why: 'The newest backup that reported succeeded ' + ago(nightly.at, now) + '. The nightly job has not reported since: it may not have run. ' + restoreWords,
        action: 'Open the backups repository on GitHub and check that the nightly job ran. Report only "green/red, date" here; never paste logs.' });
    }
    if (restoreBad) {
      return Object.assign(base, { state: 'restore', level: 'action', title: 'Backups: the restore test needs a look',
        why: 'Last night\'s backup succeeded (' + ago(nightly.at, now) + '). ' + restoreWords + ' A backup that has not been restored recently is not proven to work.',
        action: 'Run the monthly restore test in the backups repository, or check why it failed.' });
    }
    return Object.assign(base, { state: 'ok', level: 'info', title: 'Backups: last night\'s backup succeeded',
      why: 'The nightly backup succeeded ' + ago(nightly.at, now) + '. ' + restoreWords,
      action: 'Nothing to do.' });
  }

  // database step 19 (drafts/70) not installed: the same honest line as before it existed
  function notInstalled() {
    return { state: 'unknown', level: 'info', nightly: null, restore: null, title: 'Backups: not verified here',
      why: 'Backup status on Home is on, but its database step (step 19, drafts/70) is not installed yet, so the dashboard still cannot see the backup jobs. Status: UNKNOWN until you check them.',
      action: CHECKLIST };
  }

  // the table is not there yet: PostgREST 'PGRST205' (not in its schema cache) or Postgres '42P01'
  function isMissingTable(err) {
    if (!isObj(err)) return false;
    if (err.code === '42P01' || err.code === 'PGRST205') return true;
    const msg = String(err.message || '');
    return /backup_reports/.test(msg) && /(does not exist|schema cache|could not find)/i.test(msg);
  }
  async function read(client, nowMs) {
    try {
      const r = await client.from('backup_reports').select('kind, finished_at, ok').order('finished_at', { ascending: false }).limit(200);
      if (r && r.error) return isMissingTable(r.error) ? notInstalled() : judge(null, nowMs);
      return judge(r && Array.isArray(r.data) ? r.data : null, nowMs);
    } catch (e) { return isMissingTable(e) ? notInstalled() : judge(null, nowMs); }
  }

  return { NIGHTLY_MAX_MS, RESTORE_MAX_MS, MAX_ROWS, judge, notInstalled, isMissingTable, read, ago };
}));
