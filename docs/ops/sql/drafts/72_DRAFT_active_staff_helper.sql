-- DRAFT (2026-11-27). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   72   (PRODUCTION-CHANGE-DRAFT, step 0 (before step A and every draft that uses is_active_staff(); found missing in production on Nov 27))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if auth.uid() or profiles (id, role, is_active, deleted_at) is missing, if no rule lets a signed-in person read their own account row, or if an is_active_staff() exists that this file did not create
-- @effect:      adds one function, is_active_staff(): true when the signed-in person's account is active, not removed, and owner, administrator, manager or employee (an AI agent account is not staff); runs with the caller's rights and reads only their own account row; no table, rule, account or existing function changes
-- @postcheck:   the function exists, runs with the caller's rights, visitors cannot run it; local-test/active_staff_helper_test.sh passes on a throwaway copy
-- @rollback:    drafts/73
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 73_DRAFT_rollback_active_staff_helper.sql.
-- Tested only on the local throwaway database (local-test/active_staff_helper_test.sh).
--
-- Why: on Nov 27 step A (drafts/50) stopped safely, changing nothing, with "this database is
-- missing function public.is_active_staff()". The owner's read-only look the same night listed
-- production's helper functions: current_role() and is_owner_or_admin() exist,
-- is_active_staff() does not. Eleven waiting drafts (32, 34, 36, 40, 44, 46, 48, 50, 54, 58, 64)
-- use it for "any active staff member", so each of them would stop the same way.
--
-- What it adds: ONE small function, public.is_active_staff(): true when the signed-in person
-- has an account row that is active, not removed, and whose role is owner, administrator,
-- manager (once that role exists) or employee. An AI agent account is not staff. Built like
-- production's own is_owner_or_admin() (same table, same columns), but it runs with the
-- caller's rights (project rule): it reads only the caller's own account row, which every
-- signed-in person may read. If that row cannot be read, the answer is "no" (fails closed).
--
-- What it does NOT change: any table, rule, account or existing function. Until another draft
-- uses it, nothing calls it.
-- Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_active_staff_install'));

do $pre$
begin
  if to_regprocedure('auth.uid()') is null then
    raise exception 'Not installed, nothing was changed: function auth.uid() is missing.';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'Not installed, nothing was changed: table public.profiles is missing.';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name in ('id', 'role', 'is_active', 'deleted_at')) <> 4 then
    raise exception 'Not installed, nothing was changed: public.profiles does not have the columns id, role, is_active and deleted_at.';
  end if;
  -- the function runs with the caller's rights, so a signed-in person must be able to read
  -- their own account row; without such a rule it would always answer "no"
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'profiles' and cmd in ('SELECT', 'ALL')
                    and ('authenticated'::name = any(roles) or 'public'::name = any(roles))
                    and (qual ilike '%auth.uid()%' or btrim(qual) = 'true')) then
    raise exception 'Not installed, nothing was changed: no rule lets a signed-in person read their own account row.';
  end if;
  if to_regprocedure('public.is_active_staff()') is not null
     and coalesce(obj_description(to_regprocedure('public.is_active_staff()'), 'pg_proc'), '') <> 'Health Endeavors drafts/72: an active staff member is signed in' then
    raise exception 'Not installed, nothing was changed: a function public.is_active_staff() already exists and was not created by this file.';
  end if;
end $pre$;

create or replace function public.is_active_staff() returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.is_active = true
       and p.deleted_at is null
       and p.role::text in ('owner', 'administrator', 'manager', 'employee')
  );
$fn$;
comment on function public.is_active_staff() is 'Health Endeavors drafts/72: an active staff member is signed in';

revoke all on function public.is_active_staff() from public, anon;
grant execute on function public.is_active_staff() to authenticated;

commit;
