-- DRAFT (2026-11-26). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   70   (PRODUCTION-CHANGE-DRAFT, step optional (owner, Nov 24: a warning on Home when the newest backup is older than a day; design D5); any time, then one small step in the private backups repository)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if is_owner_or_admin() or the role service_role is missing
-- @effect:      adds one empty table, backup_reports (which job, when it finished, ok or not, size): the owner and administrators can read it; nobody signed in can add, change or delete a line; only the backup job writes, with the service key it already has; no existing table, rule or function changes
-- @postcheck:   the table exists with one reading rule and no writing rule for signed-in people; local-test/backup_reports_test.sh passes on a throwaway copy
-- @rollback:    drafts/71
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 71_DRAFT_rollback_backup_reports.sql.
-- Tested only on the local throwaway database (local-test/backup_reports_test.sh).
--
-- Why (owner, Nov 24): "a warning on Home when the newest backup is older than a day".
-- Today the dashboard cannot see the backup jobs at all, so Home always says "Backups:
-- not verified here" (docs/ops/RECOVERY_AND_BACKUP_READINESS.md §3, design D5).
--
-- What it adds: ONE small table, public.backup_reports. After each run, the nightly
-- backup job and the monthly restore test (both in the private backups repository)
-- write one line: which job, when it finished, whether it succeeded, and (optionally)
-- the size of the backup. Nothing else: no file names, no paths, no errors, no logs,
-- no secret ever goes into this table.
--   * The owner and administrators can READ it (Home shows it, behind the preview
--     switch "Backup status on Home").
--   * Nobody signed in to the dashboard can add, change or delete a line: no rule
--     allows it, and the rights are taken away. Only the backup job writes, with the
--     database's own service key it already uses (kept in that repository's secrets).
--   * A line can never be changed or deleted afterwards, by anyone signed in.
--
-- What it does NOT change: any existing table, rule or function; the backups
-- themselves; the private backups repository (that one small step is the owner's,
-- see RECOVERY_AND_BACKUP_READINESS.md §3a). Installing adds an empty table.
-- Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_backup_reports_install'));

do $pre$
begin
  if to_regprocedure('public.is_owner_or_admin()') is null then
    raise exception 'Install stopped, nothing was changed: function public.is_owner_or_admin() is missing.' using errcode = '42883';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'Install stopped, nothing was changed: the role service_role (the database''s own service key) is missing.' using errcode = '42704';
  end if;
end $pre$;

create table if not exists public.backup_reports (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('nightly_backup', 'restore_test')),
  finished_at timestamptz not null,
  ok boolean not null,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  reported_at timestamptz not null default now()
);
create index if not exists backup_reports_kind_finished_idx on public.backup_reports (kind, finished_at desc);

alter table public.backup_reports enable row level security;
revoke all on public.backup_reports from public, anon, authenticated;
grant select on public.backup_reports to authenticated;
drop policy if exists backup_reports_owner_admin_read on public.backup_reports;
create policy backup_reports_owner_admin_read on public.backup_reports for select to authenticated using (public.is_owner_or_admin());

-- the backup job writes with the service key: it may add a line and read, nothing more
revoke all on public.backup_reports from service_role;
grant select, insert on public.backup_reports to service_role;

comment on table public.backup_reports is
  'One line per finished backup job run (nightly backup, monthly restore test): kind, when, ok, size. Written only by the backup job; read by the owner and administrators (Home). drafts/70.';

commit;
