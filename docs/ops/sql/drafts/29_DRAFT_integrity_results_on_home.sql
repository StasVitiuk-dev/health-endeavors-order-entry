-- DRAFT (2026-10-11, extension 10). NOT INSTALLED. PRODUCTION CHANGE: needs the
-- owner's approval. Rollback: 30_DRAFT_rollback_integrity_results_on_home.sql.
-- Tested only on the local throwaway database (local-test/integrity_home_test.sh).
--
-- What it is: lets the owner and administrators SEE the nightly integrity
-- check (drafts/25) on Home, with an honest "when did it last run":
--   * table   public.integrity_check_runs: one row per attempt (started,
--             finished, ok / failed, the error text if it failed), so Home can
--             show "last attempt" and "last success" separately
--   * column  integrity_check_results.run_id: which attempt a result belongs to
--   * function run_integrity_check() replaced: records the attempt first, and
--             a failure is recorded instead of disappearing (it still changes
--             no business data, and still keeps 90 nights)
--   * read rules: owner/administrator may READ both tables (is_owner_or_admin()),
--             nobody may write them except the job itself; staff and anon see nothing
--   * switch  integrity_results_home, OFF: the Home card stays "not set up"
--             until the owner turns it on (the page first checks the tables
--             can be read)
-- ORDER: drafts/25 first; this file stops (changes nothing) if it is missing.
-- Changes no business table or row. Running it twice changes nothing.

begin;

do $$
begin
  if to_regclass('public.integrity_check_results') is null or to_regprocedure('public.run_integrity_check()') is null then
    raise exception 'Install stopped, nothing was changed: install drafts/25 (nightly integrity check) first.' using errcode = '42P01';
  end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then
    raise exception 'Install stopped, nothing was changed: function public.is_owner_or_admin() is missing.' using errcode = '42883';
  end if;
  if to_regclass('public.feature_flags') is null then
    raise exception 'Install stopped, nothing was changed: table public.feature_flags is missing.' using errcode = '42P01';
  end if;
end $$;

create table if not exists public.integrity_check_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'failed')),
  checks integer,
  error text
);
alter table public.integrity_check_results add column if not exists run_id bigint references public.integrity_check_runs (id) on delete cascade;
create index if not exists integrity_check_runs_started_idx on public.integrity_check_runs (started_at desc);
create index if not exists integrity_check_results_run_idx on public.integrity_check_results (run_id);

create or replace function public.run_integrity_check() returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_run bigint; n integer := 0;
begin
  insert into public.integrity_check_runs default values returning id into v_run;
  begin
    insert into public.integrity_check_results (run_id, run_at, section, check_name, found, examples)
    select v_run, now(), section, check_name, findings, examples from public.integrity_check_f;
    get diagnostics n = row_count;
    update public.integrity_check_runs set status = 'ok', finished_at = clock_timestamp(), checks = n where id = v_run;
  exception when others then
    -- the half-written results are undone; the failed attempt stays visible
    update public.integrity_check_runs set status = 'failed', finished_at = clock_timestamp(), error = left(sqlerrm, 500) where id = v_run;
  end;
  -- keep 90 nights (results of an old run go with it)
  delete from public.integrity_check_runs where started_at < now() - interval '90 days';
  delete from public.integrity_check_results where run_at < now() - interval '90 days';
  return n;
end $$;
revoke all on function public.run_integrity_check() from public, anon, authenticated;

alter table public.integrity_check_runs enable row level security;
revoke all on public.integrity_check_runs from public, anon, authenticated;
grant select on public.integrity_check_runs, public.integrity_check_results to authenticated;
drop policy if exists integrity_runs_owner_admin_read on public.integrity_check_runs;
create policy integrity_runs_owner_admin_read on public.integrity_check_runs for select to authenticated using (public.is_owner_or_admin());
drop policy if exists integrity_results_owner_admin_read on public.integrity_check_results;
create policy integrity_results_owner_admin_read on public.integrity_check_results for select to authenticated using (public.is_owner_or_admin());

insert into public.feature_flags (flag_key, label, description, enabled)
select 'integrity_results_home', 'Nightly integrity check on Home',
       'Shows the latest nightly integrity check (drafts/25 + 29) on Home: pass / warning / problem per check, with when it last ran. Read-only.', false
 where not exists (select 1 from public.feature_flags where flag_key = 'integrity_results_home');

commit;

-- Verification (read-only):
-- select flag_key, enabled from public.feature_flags where flag_key = 'integrity_results_home';          -- 1 row, false
-- select policyname, cmd, roles from pg_policies where tablename in ('integrity_check_runs', 'integrity_check_results');  -- 2 rows, SELECT, {authenticated}
-- select started_at, status, checks, error from public.integrity_check_runs order by started_at desc limit 3;
