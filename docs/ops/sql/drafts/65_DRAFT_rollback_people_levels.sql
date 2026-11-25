-- DRAFT (2026-11-25). NOT INSTALLED. ROLLBACK of drafts/64 (four levels of account).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   65   (ROLLBACK, rolls back 64)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        MEDIUM
-- @precheck:    stops, changing nothing, if the guard is the one from drafts/64 but its earlier text is not saved, if the saved text does not look like the earlier guard, or if the backup table was not created by drafts/64
-- @effect:      puts the guard back to the exact text saved by drafts/64, with its earlier note; drops the 2 row rules, the functions and the backup table; changes no account
-- @postcheck:   the guard's text is word for word what it was before drafts/64; no people_ function and no profiles_levels rule is left
-- @rollback:    (this file is the rollback of drafts/64)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Puts the guard on the accounts table back to the exact text that drafts/64
-- saved before replacing it, removes the two row rules and the functions of
-- drafts/64, and then removes the small table that kept the saved text.
-- No account is changed and nothing is deleted from the accounts table.
--
-- After it: only the owner can see or change another person's account, as
-- before. An account that was given the level "manager" keeps that word; the
-- database then treats it by its older rules (drafts/63 explains how to check
-- that nobody is a manager).
-- It STOPS, changing nothing, if the saved text is missing or does not look
-- like the guard. The guard stays not callable by name by a visitor (drafts/64
-- took that away; a guard is only ever run by the database itself).
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_people_levels_install'));

do $guard$
declare
  v_guard regprocedure := to_regprocedure('public.guard_profile_privileged_columns()');
  v_ours  boolean := false;
  v_def   text;
  v_note  text;
begin
  if v_guard is not null then
    v_ours := coalesce(obj_description(v_guard::oid, 'pg_proc'), '') = 'Health Endeavors drafts/64: the guard knows four levels';
  end if;
  if to_regclass('public.people_levels_backup') is not null then
    if coalesce(obj_description(to_regclass('public.people_levels_backup'), 'pg_class'), '') <> 'Health Endeavors drafts/64: the guard as it was before, kept for the rollback' then
      raise exception 'Rollback stopped: the table public.people_levels_backup was not created by drafts/64. Nothing was changed.';
    end if;
    execute format('select definition, note from %I.%I where what = %L', 'public', 'people_levels_backup', 'guard_profile_privileged_columns') into v_def, v_note;
  end if;
  if v_ours then
    if v_def is null then
      raise exception 'Rollback stopped: the guard is the one from drafts/64, but its earlier text is not saved. Nothing was changed; show this message before going further.';
    end if;
    if v_def !~* '^\s*create or replace function public\.guard_profile_privileged_columns\(\)\s' or v_def ~* 'drafts/64' then
      raise exception 'Rollback stopped: the saved text is not the earlier guard. Nothing was changed; show this message before going further.';
    end if;
    -- The one statement in the drafts that runs saved text as it is: the text is what the
    -- database itself wrote down (pg_get_functiondef) when drafts/64 was installed, kept in
    -- a table that no signed-in person can read or write, and checked just above.
    execute v_def;
    execute format('comment on function public.guard_profile_privileged_columns() is %L', v_note);
  end if;
end
$guard$;

drop policy if exists profiles_levels_read on public.profiles;
drop policy if exists profiles_levels_change on public.profiles;
drop function if exists public.people_allow(text, uuid, text);
drop function if exists public.people_register(uuid, text, text, text);
drop function if exists public.people_set_details(uuid, text, text);
drop function if exists public.people_set_role(uuid, text);
drop function if exists public.people_set_status(uuid, text);
drop function if exists public.people_actor_role();
drop function if exists public.people_can_manage(text, text, boolean, boolean);
drop function if exists public.people_rank(text);
drop table if exists public.people_levels_backup;

commit;
