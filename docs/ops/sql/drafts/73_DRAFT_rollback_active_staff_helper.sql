-- DRAFT (2026-11-27). ROLLBACK of 72_DRAFT_active_staff_helper.sql. Needs the owner's
-- written approval. DO NOT RUN until then.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   73   (ROLLBACK, rolls back 72)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if the function was not created by drafts/72 or a rule still uses it
-- @effect:      removes is_active_staff() again; nothing else changes
-- @postcheck:   the function is gone
-- @rollback:    (this file is the rollback of drafts/72)
-- @@ end metadata @@
-- Tested only on the local throwaway database (local-test/active_staff_helper_test.sh).
--
-- Removes public.is_active_staff() again, but only the one drafts/72 created (it checks its
-- mark), and only while no rule or function uses it: undo the drafts that use it first
-- (they are listed in drafts/72). Nothing else changes. Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_active_staff_install'));

do $pre$
declare users text;
begin
  if to_regprocedure('public.is_active_staff()') is null then
    return;  -- nothing to undo
  end if;
  if coalesce(obj_description(to_regprocedure('public.is_active_staff()'), 'pg_proc'), '') <> 'Health Endeavors drafts/72: an active staff member is signed in' then
    raise exception 'Not undone, nothing was changed: public.is_active_staff() was not created by drafts/72.';
  end if;
  select string_agg(distinct schemaname || '.' || tablename || ' (' || policyname || ')', ', ') into users
    from pg_policies
   where coalesce(qual, '') ilike '%is_active_staff%' or coalesce(with_check, '') ilike '%is_active_staff%';
  if users is not null then
    raise exception 'Not undone, nothing was changed: these rules still use is_active_staff(): %. Undo the drafts that added them first.', users;
  end if;
end $pre$;

drop function if exists public.is_active_staff();

commit;
