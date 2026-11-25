-- DRAFT (2026-11-25). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   64   (PRODUCTION-CHANGE-DRAFT, step optional (owner's decision of Nov 24: the owner, administrators and managers look after the accounts below their own level; the database part of the New Employee page). Creates no sign-in)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  62
-- @risk:        MEDIUM
-- @precheck:    stops, changing nothing, if the role word manager is missing (drafts/62 first), if auth.uid(), current_role(), is_active_staff(), is_owner_or_admin(), the accounts table with its expected columns, the guard function or its trigger is missing, if signed-in people cannot read and change the accounts table at all, if the guard is already this file's but its earlier text is not saved, or if a people_levels_backup table exists that this file did not create
-- @effect:      saves the text of today's guard on the accounts table in 1 new small table (people_levels_backup, readable by no signed-in person), then replaces that guard, under the same name and trigger, with one that knows four levels; adds 2 row rules on the accounts table (an administrator or a manager reads and changes the accounts of a level below their own); adds people_set_status(), people_set_role(), people_set_details(), people_register() and the question people_allow(), plus three small helpers; an owner account, the emergency account and a person's own level are never changed by them; nobody is made an owner; nothing is deleted; no account is changed by installing
-- @postcheck:   the guard carries this file's mark on the same trigger; the saved text is present once; anon can run none of the functions; local-test/people_levels_test.sh passes on a throwaway copy
-- @rollback:    drafts/65
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 65_DRAFT_rollback_people_levels.sql.
-- Tested only on the local throwaway database (local-test/people_levels_test.sh).
-- Run drafts/62 first (it adds the word "manager" to the list of roles).
--
-- Why (owner, Nov 24): four levels of account, and a "New Employee" page where
-- the owner, administrators and managers create and look after the accounts
-- below their own level.
--     Owner  >  Administrator  >  Manager  >  Employee
-- Today only the owner can see or change another person's account. This file
-- lets each level look after the levels BELOW it, and nothing else:
--   * the owner:          administrators, managers, employees
--   * an administrator:   managers, employees   (never an owner, never another
--                         administrator)
--   * a manager:          employees
--   * an employee:        nobody
-- "Look after" means: see the account, change its name and department, change
-- its level (only to a level below your own), suspend it, remove it (it is
-- switched off and marked removed; nothing is ever deleted) and bring it back.
--
-- What never changes hands here, whoever asks:
--   * an owner account and the emergency account are not changed by these
--     functions at all;
--   * nobody changes their own level or suspends themselves;
--   * nobody is made an owner;
--   * the emergency ("break-glass") mark stays owner-only, as today.
--
-- What it changes in the database
--   1. The guard on the accounts table (it already exists and already stops a
--      non-owner from changing a level) now knows the four levels. Its text as
--      it is today is SAVED in a small table first, so the rollback can put
--      back exactly what was there.
--   2. Two row rules on the accounts table: an administrator or a manager may
--      read and change the accounts below their level. The owner's and
--      everyone's own-row rules that exist today are not touched.
--   3. Five functions the dashboard calls: people_set_status, people_set_role,
--      people_set_details, people_register (switch on an account that was just
--      created) and people_allow (a yes/no question for the helper program
--      that creates sign-ins). Plus two small helpers they use.
-- SECURITY INVOKER throughout (project rule): every function runs with the
-- rights of the person who is signed in; the row rules and the guard decide.
--
-- Honest limits
--   * It creates no sign-in. A sign-in (email and password) can only be made
--     by the provider's own key, which never comes near the dashboard: a small
--     helper program at the provider does that part, in a later step.
--   * The record of who changed which account is the audit log that already
--     exists; this file adds no second log.
--   * The rule is by level. Two administrators have the same rights; neither
--     can change the other.
--   * Before anyone is given the level "manager", check that the database's
--     existing rules treat an unknown level like an employee (a read-only look;
--     see the review guide). This file cannot check that by itself.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_people_levels_install'));

do $pre$
declare
  missing text[] := '{}';
  v_guard regprocedure := to_regprocedure('public.guard_profile_privileged_columns()');
  v_mark  text;
  col     text;
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.current_role()') is null then missing := missing || 'function public.current_role()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regclass('public.profiles') is null then missing := missing || 'table public.profiles'::text;
  else
    foreach col in array array['id', 'role', 'is_active', 'deleted_at', 'is_break_glass', 'display_name', 'department', 'created_at', 'updated_at'] loop
      if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'profiles' and c.column_name = col) then
        missing := missing || ('column profiles.' || col);
      end if;
    end loop;
  end if;
  if to_regtype('public.app_role') is null
     or not exists (select 1 from pg_enum e where e.enumtypid = to_regtype('public.app_role') and e.enumlabel = 'manager') then
    missing := missing || 'the role word "manager" (run drafts/62 first)'::text;
  end if;
  if v_guard is null then missing := missing || 'function public.guard_profile_privileged_columns()'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  if not exists (select 1 from pg_trigger t where t.tgrelid = to_regclass('public.profiles') and t.tgfoid = v_guard::oid and not t.tgisinternal) then
    raise exception 'Not installed: the guard function exists but no trigger on the accounts table uses it. Nothing was changed; show this message before going further.';
  end if;
  if not (has_table_privilege('authenticated', 'public.profiles', 'select') and has_table_privilege('authenticated', 'public.profiles', 'update')) then
    raise exception 'Not installed: signed-in people cannot read or change the accounts table at all in this database, which is not what was expected. Nothing was changed; show this message before going further.';
  end if;
  -- the guard is already this file's, but its earlier text was not kept: the rollback could not put it back
  v_mark := coalesce(obj_description(v_guard::oid, 'pg_proc'), '');
  if v_mark = 'Health Endeavors drafts/64: the guard knows four levels'
     and (to_regclass('public.people_levels_backup') is null) then
    raise exception 'Not installed: the guard is already the one from drafts/64, but the table that keeps its earlier text is missing. Nothing was changed; show this message before going further.';
  end if;
  if to_regclass('public.people_levels_backup') is not null
     and coalesce(obj_description(to_regclass('public.people_levels_backup'), 'pg_class'), '') <> 'Health Endeavors drafts/64: the guard as it was before, kept for the rollback' then
    raise exception 'Not installed: a table public.people_levels_backup already exists and was not created by this file. Nothing was changed; show this message before going further.';
  end if;
end
$pre$;

-- ---------------------------------------------------------------- 1. keep the guard as it is today
create table if not exists public.people_levels_backup (
  what       text primary key check (what = 'guard_profile_privileged_columns'),
  definition text not null,
  note       text,
  saved_at   timestamptz not null default now()
);
comment on table public.people_levels_backup is 'Health Endeavors drafts/64: the guard as it was before, kept for the rollback';
alter table public.people_levels_backup enable row level security;
revoke all on public.people_levels_backup from public, anon, authenticated;

-- saved once: running this file again never replaces the saved text with this file's own guard
insert into public.people_levels_backup (what, definition, note)
select 'guard_profile_privileged_columns',
       pg_get_functiondef(to_regprocedure('public.guard_profile_privileged_columns()')),
       obj_description(to_regprocedure('public.guard_profile_privileged_columns()')::oid, 'pg_proc')
where coalesce(obj_description(to_regprocedure('public.guard_profile_privileged_columns()')::oid, 'pg_proc'), '') <> 'Health Endeavors drafts/64: the guard knows four levels'
on conflict (what) do nothing;

-- ---------------------------------------------------------------- 2. the levels
create or replace function public.people_rank(p_role text) returns integer
language sql
immutable
security invoker
set search_path = public, pg_temp
as $fn$
  select case p_role when 'owner' then 4 when 'administrator' then 3 when 'manager' then 2 when 'employee' then 1 else 0 end
$fn$;

-- May someone of level p_actor look after an account of level p_target?
-- Never your own account, never the emergency account, never an owner, never an
-- account that is not a person's (an agent); and only a level strictly below yours.
create or replace function public.people_can_manage(p_actor text, p_target text, p_same boolean, p_break_glass boolean) returns boolean
language sql
immutable
security invoker
set search_path = public, pg_temp
as $fn$
  select not coalesce(p_same, true)
     and not coalesce(p_break_glass, true)
     and coalesce(p_target, '') in ('administrator', 'manager', 'employee')
     and public.people_rank(p_actor) >= 2
     and public.people_rank(p_actor) > public.people_rank(p_target)
$fn$;

-- The level of the person who is signed in; empty for a visitor or a switched-off account.
create or replace function public.people_actor_role() returns text
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select case when auth.uid() is not null and (public.is_active_staff() or public.is_owner_or_admin())
              then coalesce(public.current_role()::text, '') else '' end
$fn$;

-- ---------------------------------------------------------------- 3. the guard, now with four levels
-- Same name and same trigger as today; only what it allows is widened, and only downwards.
create or replace function public.guard_profile_privileged_columns() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_actor  uuid := auth.uid();
  v_role   text;
  v_self   boolean;
  v_level  boolean;
  v_glass  boolean;
  v_status boolean;
  v_free   text[] := array['display_name', 'department', 'role', 'is_active', 'deleted_at', 'updated_at'];
begin
  if v_actor is null then return new; end if;                 -- as before: the database's own work, with no person signed in
  v_role   := public.people_actor_role();
  if v_role = 'owner' then return new; end if;                -- as before: the owner
  v_self   := (old.id = v_actor);
  v_level  := new.role is distinct from old.role;
  v_glass  := new.is_break_glass is distinct from old.is_break_glass;
  v_status := new.is_active is distinct from old.is_active or new.deleted_at is distinct from old.deleted_at;

  if v_glass then
    raise exception 'Only the owner can change a person''s role or break-glass access. Nothing was changed.' using errcode = '42501';
  end if;
  if v_level and (not public.people_can_manage(v_role, old.role::text, v_self, old.is_break_glass)
                  or not public.people_can_manage(v_role, new.role::text, v_self, new.is_break_glass)) then
    raise exception 'Only someone above that level can change a person''s level, and only to a level below their own. Nothing was changed.' using errcode = '42501';
  end if;
  if v_status and not public.people_can_manage(v_role, old.role::text, v_self, old.is_break_glass) then
    raise exception 'Only someone above that level can suspend, remove or bring back an account. Nothing was changed.' using errcode = '42501';
  end if;
  -- someone else's account: only by a level above it, and only its name, department, level and status
  if not v_self then
    if not public.people_can_manage(v_role, old.role::text, false, old.is_break_glass) then
      raise exception 'That account is not yours to change. Nothing was changed.' using errcode = '42501';
    end if;
    if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
      raise exception 'Only the name, the department, the level and the status of another person''s account can be changed. Nothing was changed.' using errcode = '42501';
    end if;
  end if;
  return new;
end
$fn$;
comment on function public.guard_profile_privileged_columns() is 'Health Endeavors drafts/64: the guard knows four levels';

-- ---------------------------------------------------------------- 4. the dashboard's functions
-- p_status: 'active' (bring back), 'suspended' (switched off for now), 'removed' (switched off and marked removed)
create or replace function public.people_set_status(p_person uuid, p_status text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_role text := public.people_actor_role();
  v      public.profiles%rowtype;
begin
  if v_role = '' then raise exception 'Only a signed-in, active team member can do this.' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('active', 'suspended', 'removed') then
    raise exception 'Choose active, suspended or removed.' using errcode = '22023';
  end if;
  select * into v from public.profiles where id = p_person for update;
  if not found or not public.people_can_manage(v_role, v.role::text, v.id = auth.uid(), v.is_break_glass) then
    raise exception 'That account was not found, or it is not yours to change. Nothing was changed.' using errcode = '42501';
  end if;
  update public.profiles
     set is_active  = (p_status = 'active'),
         deleted_at = case when p_status = 'removed' then coalesce(deleted_at, now()) else null end,
         updated_at = now()
   where id = p_person;
  return jsonb_build_object('ok', true, 'id', p_person, 'status', p_status);
end
$fn$;

create or replace function public.people_set_role(p_person uuid, p_role text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_role text := public.people_actor_role();
  v      public.profiles%rowtype;
begin
  if v_role = '' then raise exception 'Only a signed-in, active team member can do this.' using errcode = '42501'; end if;
  if not public.people_can_manage(v_role, p_role, false, false) then
    raise exception 'You can only give a level below your own (never owner). Nothing was changed.' using errcode = '42501';
  end if;
  select * into v from public.profiles where id = p_person for update;
  if not found or not public.people_can_manage(v_role, v.role::text, v.id = auth.uid(), v.is_break_glass) then
    raise exception 'That account was not found, or it is not yours to change. Nothing was changed.' using errcode = '42501';
  end if;
  if v.role::text = p_role then return jsonb_build_object('ok', true, 'id', p_person, 'role', p_role, 'unchanged', true); end if;
  update public.profiles set role = p_role::public.app_role, updated_at = now() where id = p_person;
  return jsonb_build_object('ok', true, 'id', p_person, 'role', p_role);
end
$fn$;

create or replace function public.people_set_details(p_person uuid, p_display_name text, p_department text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_role text := public.people_actor_role();
  v_name text := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  v_dept text := nullif(btrim(regexp_replace(coalesce(p_department, ''), '\s+', ' ', 'g')), '');
  v      public.profiles%rowtype;
begin
  if v_role = '' then raise exception 'Only a signed-in, active team member can do this.' using errcode = '42501'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'The name must be 2 to 80 characters.' using errcode = '22023'; end if;
  if v_dept is not null and char_length(v_dept) > 80 then raise exception 'The department must be 80 characters at most.' using errcode = '22023'; end if;
  select * into v from public.profiles where id = p_person for update;
  if not found or not public.people_can_manage(v_role, v.role::text, v.id = auth.uid(), v.is_break_glass) then
    raise exception 'That account was not found, or it is not yours to change. Nothing was changed.' using errcode = '42501';
  end if;
  update public.profiles set display_name = v_name, department = v_dept, updated_at = now() where id = p_person;
  return jsonb_build_object('ok', true, 'id', p_person);
end
$fn$;

-- Switch on an account whose sign-in was created a moment ago (by the helper program at
-- the provider). Only a brand-new account: created in the last 15 minutes, still switched
-- off, still at the starting level. An older or suspended account is brought back with
-- people_set_status instead, which keeps its level.
create or replace function public.people_register(p_person uuid, p_role text, p_display_name text, p_department text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_role text := public.people_actor_role();
  v_name text := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  v_dept text := nullif(btrim(regexp_replace(coalesce(p_department, ''), '\s+', ' ', 'g')), '');
  v      public.profiles%rowtype;
begin
  if v_role = '' then raise exception 'Only a signed-in, active team member can do this.' using errcode = '42501'; end if;
  if not public.people_can_manage(v_role, p_role, false, false) then
    raise exception 'You can only create an account of a level below your own (never owner). Nothing was changed.' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'The name must be 2 to 80 characters.' using errcode = '22023'; end if;
  if v_dept is not null and char_length(v_dept) > 80 then raise exception 'The department must be 80 characters at most.' using errcode = '22023'; end if;
  select * into v from public.profiles where id = p_person for update;
  if not found or v.id = auth.uid() or v.is_break_glass or v.role::text <> 'employee' then
    raise exception 'That account was not found, or it is not yours to change. Nothing was changed.' using errcode = '42501';
  end if;
  if v.is_active or v.deleted_at is not null or v.created_at < now() - interval '15 minutes' then
    raise exception 'That is not a brand-new account. Use suspend, remove or bring back instead. Nothing was changed.' using errcode = '42501';
  end if;
  update public.profiles
     set role = p_role::public.app_role, display_name = v_name, department = v_dept, is_active = true, updated_at = now()
   where id = p_person;
  return jsonb_build_object('ok', true, 'id', p_person, 'role', p_role);
end
$fn$;

-- A yes/no question for the helper program, asked with the signed-in person's own sign-in
-- BEFORE it does anything: may this person create an account of that level, or set the
-- password / end the sessions of that account? It changes nothing.
create or replace function public.people_allow(p_action text, p_person uuid, p_role text) returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_role text := public.people_actor_role();
  v      public.profiles%rowtype;
begin
  if v_role = '' then raise exception 'Only a signed-in, active team member can do this.' using errcode = '42501'; end if;
  if p_action = 'create' then
    if not public.people_can_manage(v_role, p_role, false, false) then
      raise exception 'You can only create an account of a level below your own (never owner).' using errcode = '42501';
    end if;
    return jsonb_build_object('ok', true, 'action', 'create', 'role', p_role);
  end if;
  if p_action in ('password', 'sign_out') then
    select * into v from public.profiles where id = p_person;
    if not found or not public.people_can_manage(v_role, v.role::text, v.id = auth.uid(), v.is_break_glass) then
      raise exception 'That account was not found, or it is not yours to change.' using errcode = '42501';
    end if;
    return jsonb_build_object('ok', true, 'action', p_action, 'id', p_person);
  end if;
  raise exception 'Unknown request.' using errcode = '22023';
end
$fn$;

-- ---------------------------------------------------------------- 5. who can see and change which account
-- Two more row rules on the accounts table. The rules that exist today (your own row; the
-- owner) are not touched. A rule only ever ADDS what a person may do, so these add exactly:
-- "an account of a level below yours".
drop policy if exists profiles_levels_read on public.profiles;
create policy profiles_levels_read on public.profiles for select to authenticated
  using (public.people_can_manage(public.people_actor_role(), role::text, id = auth.uid(), false));
drop policy if exists profiles_levels_change on public.profiles;
create policy profiles_levels_change on public.profiles for update to authenticated
  using (public.people_can_manage(public.people_actor_role(), role::text, id = auth.uid(), is_break_glass))
  with check (public.people_can_manage(public.people_actor_role(), role::text, id = auth.uid(), is_break_glass));

revoke all on function public.people_rank(text) from public, anon;
revoke all on function public.people_can_manage(text, text, boolean, boolean) from public, anon;
revoke all on function public.people_actor_role() from public, anon;
revoke all on function public.guard_profile_privileged_columns() from public, anon;
revoke all on function public.people_set_status(uuid, text) from public, anon;
revoke all on function public.people_set_role(uuid, text) from public, anon;
revoke all on function public.people_set_details(uuid, text, text) from public, anon;
revoke all on function public.people_register(uuid, text, text, text) from public, anon;
revoke all on function public.people_allow(text, uuid, text) from public, anon;
grant execute on function public.people_rank(text) to authenticated;
grant execute on function public.people_can_manage(text, text, boolean, boolean) to authenticated;
grant execute on function public.people_actor_role() to authenticated;
grant execute on function public.people_set_status(uuid, text) to authenticated;
grant execute on function public.people_set_role(uuid, text) to authenticated;
grant execute on function public.people_set_details(uuid, text, text) to authenticated;
grant execute on function public.people_register(uuid, text, text, text) to authenticated;
grant execute on function public.people_allow(text, uuid, text) to authenticated;

commit;
