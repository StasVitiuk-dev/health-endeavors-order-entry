-- DRAFT (2026-10-10, extension 9). NOT INSTALLED. Rollback of
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   26   (ROLLBACK, rolls back 25)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  30
-- @risk:        LOW
-- @precheck:    drafts/30 first if 29 was installed
-- @effect:      unschedules and drops the check, view and its results table (its own history only)
-- @postcheck:   objects absent
-- @rollback:    (this file is the rollback of drafts/25)
-- @@ end metadata @@
-- 25_DRAFT_integrity_check_schedule.sql: unschedules the nightly job and
-- removes the view, the function and the results table (the saved results
-- are lost; export them first if wanted). Changes no business data.

begin;

do $do$
begin
  if to_regclass('cron.job') is not null then
    -- dynamic, so the statement is not even planned where pg_cron is missing
    execute format('select cron.unschedule(jobid) from cron.job where jobname = %L', 'integrity_check_nightly');
  end if;
end $do$;

drop function if exists public.run_integrity_check();
drop view if exists public.integrity_check_f;
drop table if exists public.integrity_check_results;

commit;
