-- DRAFT (2026-11-26). NOT INSTALLED. ROLLBACK of drafts/68 (search path of three history functions).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   69   (ROLLBACK, rolls back 68)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if one of the three functions is missing
-- @effect:      puts the three search paths back exactly as the owner's read-only look of Nov 25 showed them (public; public; auth, public); their text is not touched
-- @postcheck:   the three search paths are as before drafts/68
-- @rollback:    (this file is the rollback of drafts/68)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
-- Tested only on the local throwaway database (local-test/history_search_path_test.sh).
--
-- Puts the three functions' search path back exactly as the owner's read-only look of
-- Nov 25 showed it: employee_activity and employee_activity_people "public";
-- list_my_sessions "auth, public". Their text is not touched. Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_history_search_path_install'));

do $pre$
begin
  if to_regprocedure('public.employee_activity(text, uuid, text, timestamp with time zone, timestamp with time zone, integer, integer)') is null
     or to_regprocedure('public.employee_activity_people()') is null
     or to_regprocedure('public.list_my_sessions()') is null then
    raise exception 'Nothing to undo: one of the three functions is missing.';
  end if;
end $pre$;

alter function public.employee_activity(text, uuid, text, timestamp with time zone, timestamp with time zone, integer, integer) set search_path = public;
alter function public.employee_activity_people() set search_path = public;
alter function public.list_my_sessions() set search_path = auth, public;

commit;
