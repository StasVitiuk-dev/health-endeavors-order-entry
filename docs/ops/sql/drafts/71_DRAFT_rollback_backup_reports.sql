-- DRAFT (2026-11-26). NOT INSTALLED. ROLLBACK of drafts/70 (backup reports for Home).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   71   (ROLLBACK, rolls back 70)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if backup_reports is not there
-- @effect:      removes backup_reports again (it only held 'this job finished, ok or not' lines; the backups themselves are not touched); turn the backup job's report step off first
-- @postcheck:   backup_reports is gone; Home says 'Backups: not verified here' again
-- @rollback:    (this file is the rollback of drafts/70)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
-- Tested only on the local throwaway database (local-test/backup_reports_test.sh).
--
-- Removes the table public.backup_reports again. It only ever held "this backup job
-- finished at this time, ok or not" lines: no business or customer data, and the
-- backups themselves are not touched. Turn the private backups repository's report
-- step off FIRST (RECOVERY_AND_BACKUP_READINESS.md §3a), or its next run fails to
-- write its line (the backup itself still runs). Home goes back to "Backups: not
-- verified here". If the table is not there, it stops and changes nothing. Safe to
-- run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_backup_reports_install'));

do $pre$
begin
  if to_regclass('public.backup_reports') is null then
    raise exception 'Nothing to undo: drafts/70 (backup reports) is not installed.';
  end if;
end $pre$;

drop table if exists public.backup_reports;

commit;
