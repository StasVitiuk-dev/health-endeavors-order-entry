-- DRAFT (2026-11-26). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   68   (PRODUCTION-CHANGE-DRAFT, step optional hardening (from the owner's second read-only look of Nov 25); any time)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if employee_activity(text, uuid, text, timestamptz, timestamptz, integer, integer), employee_activity_people() or list_my_sessions() is missing
-- @effect:      names pg_temp last in the search path of those three existing functions (public, pg_temp; and auth, public, pg_temp), so a temporary table can never stand in for a real one inside them; their text, rights, raised rights and results are unchanged
-- @postcheck:   the three search paths end with pg_temp; local-test/history_search_path_test.sh passes on a throwaway copy
-- @rollback:    drafts/69
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 69_DRAFT_rollback_history_functions_search_path.sql.
-- Tested only on the local throwaway database (local-test/history_search_path_test.sh).
--
-- Why: the owner's second read-only look (Nov 25) showed three EXISTING production
-- functions that run with raised rights and name only some schemas in their search path:
--   employee_activity(...)          search path: public
--   employee_activity_people()      search path: public
--   list_my_sessions()              search path: auth, public
-- When pg_temp is not named, Postgres looks in the session's temporary schema FIRST for
-- tables. A temporary table called "profiles" could then stand in for the real accounts
-- table inside these functions. Postgres's own guidance for such functions is to name
-- pg_temp LAST. Signed-in people cannot create temporary tables through the dashboard's
-- connection, so this is not exploitable today; it is a small, standard hardening.
--
-- What it changes: ONLY the search path setting of these three functions (pg_temp is
-- added at the end). Not their text, not who may run them, not their raised rights, not
-- what they return. Nothing else.
-- Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_history_search_path_install'));

do $pre$
declare missing text[] := '{}';
begin
  if to_regprocedure('public.employee_activity(text, uuid, text, timestamp with time zone, timestamp with time zone, integer, integer)') is null then
    missing := missing || 'function public.employee_activity(text, uuid, text, timestamptz, timestamptz, integer, integer)'::text;
  end if;
  if to_regprocedure('public.employee_activity_people()') is null then missing := missing || 'function public.employee_activity_people()'::text; end if;
  if to_regprocedure('public.list_my_sessions()') is null then missing := missing || 'function public.list_my_sessions()'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
end $pre$;

alter function public.employee_activity(text, uuid, text, timestamp with time zone, timestamp with time zone, integer, integer) set search_path = public, pg_temp;
alter function public.employee_activity_people() set search_path = public, pg_temp;
alter function public.list_my_sessions() set search_path = auth, public, pg_temp;

commit;
