-- DRAFT (2026-10-11, extension 10). NOT INSTALLED. Rollback of
-- 29_DRAFT_integrity_results_on_home.sql: removes the Home switch (refuses,
-- changing nothing, while it is ON), the two read rules, the run log and the
-- run_id column, and puts back drafts/25's function. The saved nightly
-- results stay (drafts/26 removes them). Changes no business data.
-- ORDER: run this BEFORE drafts/26 if both are rolled back.

begin;

do $$
begin
  if to_regclass('public.integrity_check_results') is null then
    raise exception 'Rollback stopped, nothing was changed: drafts/25 is already removed (run drafts/30 before drafts/26).' using errcode = '42P01';
  end if;
  if exists (select 1 from public.feature_flags where flag_key = 'integrity_results_home' and enabled is true) then
    raise exception 'Rollback stopped, nothing was changed: the integrity_results_home switch is still on. Turn it off on Feature Switches first.' using errcode = '55000';
  end if;
end $$;

drop policy if exists integrity_results_owner_admin_read on public.integrity_check_results;
revoke all on public.integrity_check_results from public, anon, authenticated;
alter table public.integrity_check_results drop column if exists run_id;

-- drafts/25's version of the function
create or replace function public.run_integrity_check() returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into public.integrity_check_results (section, check_name, found, examples)
  select section, check_name, findings, examples from public.integrity_check_f;
  get diagnostics n = row_count;
  delete from public.integrity_check_results where run_at < now() - interval '90 days';
  return n;
end $$;
revoke all on function public.run_integrity_check() from public, anon, authenticated;

drop table if exists public.integrity_check_runs;
delete from public.feature_flags where flag_key = 'integrity_results_home';

commit;
