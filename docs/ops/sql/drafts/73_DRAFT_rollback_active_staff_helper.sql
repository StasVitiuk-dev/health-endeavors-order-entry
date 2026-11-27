-- DRAFT (2026-11-27). ROLLBACK of 72_DRAFT_active_staff_helper.sql. Needs the owner's
-- written approval. DO NOT RUN until then.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   73   (ROLLBACK, rolls back 72)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if a function was not created by drafts/72 or a rule or function still uses them
-- @effect:      removes is_active_staff() and active_role() again; nothing else changes
-- @postcheck:   both functions are gone
-- @rollback:    (this file is the rollback of drafts/72)
-- @@ end metadata @@
-- Tested only on the local throwaway database (local-test/active_staff_helper_test.sh).
--
-- Removes public.is_active_staff() and public.active_role() again, but only the ones drafts/72 created (it checks its
-- mark), and only while no rule or function uses it: undo the drafts that use it first
-- (they are listed in drafts/72). Nothing else changes. Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_active_staff_install'));

do $pre$
declare users text;
begin
  if to_regprocedure('public.is_active_staff()') is not null
     and coalesce(obj_description(to_regprocedure('public.is_active_staff()'), 'pg_proc'), '') <> 'Health Endeavors drafts/72: an active staff member is signed in' then
    raise exception 'Not undone, nothing was changed: public.is_active_staff() was not created by drafts/72.';
  end if;
  if to_regprocedure('public.active_role()') is not null
     and coalesce(obj_description(to_regprocedure('public.active_role()'), 'pg_proc'), '') <> 'Health Endeavors drafts/72: the role of a switched-on account' then
    raise exception 'Not undone, nothing was changed: public.active_role() was not created by drafts/72.';
  end if;
  select string_agg(distinct schemaname || '.' || tablename || ' (' || policyname || ')', ', ') into users
    from pg_policies
   where coalesce(qual, '') ~* '(is_active_staff|active_role)\(' or coalesce(with_check, '') ~* '(is_active_staff|active_role)\(';
  if users is not null then
    raise exception 'Not undone, nothing was changed: these rules still use is_active_staff() or active_role(): %. Undo the drafts that added them first.', users;
  end if;
  select string_agg(distinct p.proname, ', ') into users
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname not in ('is_active_staff', 'active_role')
     and p.prosrc ~* '(is_active_staff|active_role)\(';
  if users is not null then
    raise exception 'Not undone, nothing was changed: these functions still use is_active_staff() or active_role(): %. Undo the drafts that added them first.', users;
  end if;
end $pre$;

drop function if exists public.active_role();
drop function if exists public.is_active_staff();

commit;
