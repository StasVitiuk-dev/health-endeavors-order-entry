-- DRAFT (2026-10-10, extension 9). NOT INSTALLED. Rollback of
-- 25_DRAFT_integrity_check_schedule.sql: unschedules the nightly job and
-- removes the view, the function and the results table (the saved results
-- are lost; export them first if wanted). Changes no business data.

begin;

do $do$
begin
  if to_regclass('cron.job') is not null then
    -- dynamic, so the statement is not even planned where pg_cron is missing
    execute 'select cron.unschedule(jobid) from cron.job where jobname = ''integrity_check_nightly''';
  end if;
end $do$;

drop function if exists public.run_integrity_check();
drop view if exists public.integrity_check_f;
drop table if exists public.integrity_check_results;

commit;
