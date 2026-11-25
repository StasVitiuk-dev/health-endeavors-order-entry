-- DRAFT (2026-11-24). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   58   (PRODUCTION-CHANGE-DRAFT, step optional (owner rule of Nov 24: the same on every phone and computer; this one for the small choices that belong to one person, first use: what a person set aside until tomorrow on Home))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if a my_settings table exists that this file did not create (it checks its own mark); stops if auth.uid(), is_active_staff() or is_owner_or_admin() is missing
-- @effect:      1 new table my_settings (one row per person and setting: the person, a short key, a small JSON value, when it was saved); set_my_setting() saves or replaces the signed-in person's own setting, and refuses with a conflict when the page passes the version it read and another of this person's devices saved in between (two devices never erase each other's additions); each active person reads and writes only their own rows, the owner included; never deleted, keys never renamed; at most 40 settings per person; not audited on purpose (view preferences, not business records); no existing table changes
-- @postcheck:   the table present and empty; anon cannot read it; local-test/my_settings_test.sh passes on a throwaway copy
-- @rollback:    drafts/59
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 59_DRAFT_rollback_my_settings.sql.
-- Tested only on the local throwaway database (local-test/my_settings_test.sh).
--
-- Why (owner, Nov 24: "everything the same on every phone and computer, nothing
-- kept in only one browser"): drafts/50 keeps the settings the OWNER chooses for
-- everyone. Some small choices belong to one person only, for example what that
-- person set aside until tomorrow on Home. Those must follow that person to every
-- device too, without anyone else seeing or changing them.
--   * my_settings   one row per person and setting: the person, a short key
--     ("feed_snooze"), a small JSON value, and when it was saved.
--   * set_my_setting(key, value)   a signed-in, active person saves their own
--     setting; saving the same key again replaces its value. With the version the
--     page read, it refuses with "conflict" if another of this person's devices
--     saved in between, so two devices never erase each other's additions.
--
-- Who can see and do what: every active team member, administrator and the owner
-- reads and saves ONLY their own rows. Nobody reads another person's row, the
-- owner included. Visitors and deactivated accounts: nothing. A row is never
-- deleted from the dashboard; at most 40 settings per person.
-- SECURITY INVOKER throughout (project rule).
--
-- Not audited on purpose: these are view preferences of one person (what is set
-- aside on Home), not business records, and they change many times a day. The
-- audit log stays for business records.
--
-- Honest limits
--   * Holds preferences only: never passwords, keys, tokens or customer details
--     (values are limited to a small JSON object; the dashboard decides what it
--     saves).
--   * Another device sees a new value when it next loads the page that uses it.
--   * It refuses to install over a table called my_settings that it did not
--     create itself (it checks its own mark), and changes no existing table.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_my_settings_install'));

do $pre$
declare
  missing text[] := '{}';
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  if to_regclass('public.my_settings') is not null
     and coalesce(obj_description(to_regclass('public.my_settings'), 'pg_class'), '') <> 'Health Endeavors drafts/58: one person''s settings on every device' then
    raise exception 'Not installed: a table public.my_settings already exists and was not created by this file. Nothing was changed; show this message before going further.';
  end if;
end
$pre$;

create table if not exists public.my_settings (
  user_id    uuid not null default auth.uid(),
  key        text not null check (key ~ '^[a-z][a-z0-9_]{1,59}$'),
  value      jsonb not null check (jsonb_typeof(value) = 'object' and length(value::text) <= 8000),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
comment on table public.my_settings is 'Health Endeavors drafts/58: one person''s settings on every device';

-- A person saves only their own settings; a setting is replaced, never deleted.
create or replace function public.my_settings_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v_count integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'A setting stays on the record; save a new value instead.' using errcode = '42501';
  end if;
  if auth.uid() is null or not (public.is_active_staff() or public.is_owner_or_admin()) then
    raise exception 'Only a signed-in, active team member can save their own settings.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.key is distinct from old.key or old.user_id is distinct from auth.uid()) then
    raise exception 'A setting belongs to one person and keeps its name.' using errcode = '42501';
  end if;
  -- a new setting counts against the limit; saving an existing one again (which arrives here as an insert first) does not
  if tg_op = 'INSERT' and not exists (select 1 from public.my_settings where user_id = auth.uid() and key = new.key) then
    select count(*) into v_count from public.my_settings where user_id = auth.uid();
    if v_count >= 40 then
      raise exception 'At most 40 settings per person.' using errcode = '23514';
    end if;
  end if;
  new.user_id := auth.uid();          -- always the person who is signed in, whatever was typed
  new.updated_at := now();
  return new;
end
$fn$;
drop trigger if exists my_settings_guard on public.my_settings;
create trigger my_settings_guard before insert or update or delete on public.my_settings
  for each row execute function public.my_settings_guard();

-- ---------------------------------------------------------------- a person saves their own setting
-- Two of this person's devices saving the same setting at the same moment (owner queue of
-- Nov 25, task 7, the same check as drafts/50): a page that read the setting first passes
-- the time of the version it read (p_expected_updated_at), or p_expect_new when there was
-- none. The save then happens only if nothing was saved in between; otherwise nothing
-- changes and the answer says "conflict", so the page reads again, joins its change to the
-- newer value and saves again. Without either, the save replaces the value as before. The
-- check is in the database, inside one statement, so it holds even when two saves arrive at
-- the same instant.
drop function if exists public.set_my_setting(text, jsonb);
create or replace function public.set_my_setting(p_key text, p_value jsonb,
  p_expected_updated_at timestamptz default null, p_expect_new boolean default false) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v public.my_settings%rowtype; k text := btrim(coalesce(p_key, ''));
begin
  if auth.uid() is null or not (public.is_active_staff() or public.is_owner_or_admin()) then
    raise exception 'Only a signed-in, active team member can save their own settings.' using errcode = '42501';
  end if;
  if p_value is null then raise exception 'A setting needs a value.' using errcode = '22023'; end if;
  if coalesce(p_expect_new, false) then
    insert into public.my_settings (user_id, key, value)
      values (auth.uid(), k, p_value)
      on conflict (user_id, key) do nothing
      returning * into v;
    if not found then
      return jsonb_build_object('ok', false, 'conflict', true, 'key', k,
        'updated_at', (select m.updated_at from public.my_settings m where m.user_id = auth.uid() and m.key = k));
    end if;
  elsif p_expected_updated_at is not null then
    update public.my_settings set value = p_value
      where user_id = auth.uid() and key = k and updated_at = p_expected_updated_at
      returning * into v;
    if not found then
      return jsonb_build_object('ok', false, 'conflict', true, 'key', k,
        'updated_at', (select m.updated_at from public.my_settings m where m.user_id = auth.uid() and m.key = k));
    end if;
  else
    insert into public.my_settings (user_id, key, value)
      values (auth.uid(), k, p_value)
      on conflict (user_id, key) do update set value = excluded.value
      returning * into v;
  end if;
  return jsonb_build_object('ok', true, 'key', v.key, 'updated_at', v.updated_at);
end
$fn$;

-- ---------------------------------------------------------------- who can see and do what
alter table public.my_settings enable row level security;
revoke all on public.my_settings from public, anon;
grant select, insert, update on public.my_settings to authenticated;
drop policy if exists my_settings_own_read on public.my_settings;
create policy my_settings_own_read on public.my_settings for select to authenticated
  using (user_id = auth.uid() and (public.is_active_staff() or public.is_owner_or_admin()));
drop policy if exists my_settings_own_add on public.my_settings;
create policy my_settings_own_add on public.my_settings for insert to authenticated
  with check (user_id = auth.uid() and (public.is_active_staff() or public.is_owner_or_admin()));
drop policy if exists my_settings_own_change on public.my_settings;
create policy my_settings_own_change on public.my_settings for update to authenticated
  using (user_id = auth.uid() and (public.is_active_staff() or public.is_owner_or_admin()))
  with check (user_id = auth.uid() and (public.is_active_staff() or public.is_owner_or_admin()));

revoke all on function public.set_my_setting(text, jsonb, timestamptz, boolean) from public, anon;
revoke all on function public.my_settings_guard() from public, anon;
grant execute on function public.set_my_setting(text, jsonb, timestamptz, boolean) to authenticated;

commit;
