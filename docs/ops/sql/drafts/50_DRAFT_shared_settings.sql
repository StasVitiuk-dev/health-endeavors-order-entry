-- DRAFT (2026-11-24). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   50   (PRODUCTION-CHANGE-DRAFT, step optional (owner request of Nov 24: settings typed once are the same on every phone and computer; first use: the Real profit estimates))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if a shared_settings table exists that this file did not create (it checks its own mark); stops if auth.uid(), current_role(), is_active_staff(), is_owner_or_admin(), the tasks or audit_log table, or the audit trigger on tasks is missing
-- @effect:      1 new table shared_settings (one row per setting: key, a small JSON value, who may read it, who saved it last and when); set_shared_setting() saves or replaces a setting; settings never deleted, keys never renamed; only the owner writes; the owner and administrators read all, active staff only settings marked for staff; production's audit trigger attached; no existing table changes
-- @postcheck:   the table present and empty; anon cannot read it; local-test/shared_settings_test.sh passes on a throwaway copy
-- @rollback:    drafts/51
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 51_DRAFT_rollback_shared_settings.sql.
-- Tested only on the local throwaway database (local-test/shared_settings_test.sh).
--
-- Why (owner, Nov 24: "I need everything to be updated everywhere right away ...
-- a bunch of phones and the computer at the same time"): settings the owner types
-- once must be the same on every device, so they cannot live in one browser.
--   * shared_settings   one row per setting: a short key ("profit_estimates"),
--     its value (a small JSON object), who may read it ("owner_admin" or
--     "staff"), who saved it last and when.
--   * set_shared_setting(key, value, audience)   the owner saves a setting; saving
--     the same key again replaces its value (the previous value stays in
--     audit_log with who and when).
--   * A setting is never deleted from the dashboard; a value is replaced.
--
-- First use: the fee, postage and packaging estimates of "Real profit".
-- Holds settings only: never passwords, keys, tokens or customer details
-- (values are limited to a small JSON object; the dashboard decides what it saves).
--
-- Who can see and do what: only the owner saves; the owner and administrators
-- read every setting; active staff read only settings marked for staff; visitors
-- nothing. SECURITY INVOKER throughout (project rule). Production's own audit
-- trigger (the one on `tasks`) is attached, so every change lands in audit_log.
--
-- Honest limits
--   * Another device sees a new value when it next loads the page that uses it.
--   * It refuses to install over a table called shared_settings that it did not
--     create itself (it checks its own mark), and changes no existing table.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_shared_settings_install'));

do $pre$
declare
  missing text[] := '{}';
  v_tg record;
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.current_role()') is null then missing := missing || 'function public.current_role()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regclass('public.tasks') is null then missing := missing || 'table public.tasks (its audit trigger is reused)'::text; end if;
  if to_regclass('public.audit_log') is null then missing := missing || 'table public.audit_log'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  if to_regclass('public.shared_settings') is not null
     and coalesce(obj_description(to_regclass('public.shared_settings'), 'pg_class'), '') <> 'Health Endeavors drafts/50: settings shared by every device' then
    raise exception 'Not installed: a table public.shared_settings already exists and was not created by this file. Nothing was changed; show this message before going further.';
  end if;
  select t.tgtype into v_tg from pg_trigger t
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  if not found then
    raise exception 'Not installed: the audit trigger on public.tasks was not found, so shared settings could not be audited the same way.';
  end if;
  if (v_tg.tgtype & 1) = 0 or (v_tg.tgtype & 2) <> 0 or (v_tg.tgtype & 4) = 0 or (v_tg.tgtype & 8) = 0 or (v_tg.tgtype & 16) = 0 then
    raise exception 'Not installed: the audit trigger on public.tasks is not an AFTER INSERT OR UPDATE OR DELETE row trigger (type %); it cannot be reused as is.', v_tg.tgtype;
  end if;
end
$pre$;

create table if not exists public.shared_settings (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,59}$'),
  value      jsonb not null check (jsonb_typeof(value) = 'object' and length(value::text) <= 8000),
  audience   text not null default 'owner_admin' check (audience in ('owner_admin', 'staff')),
  updated_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now()
);
comment on table public.shared_settings is 'Health Endeavors drafts/50: settings shared by every device';

-- Only the owner saves. A setting is replaced, never deleted; its key never changes.
create or replace function public.shared_settings_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'A shared setting stays on the record; save a new value instead.' using errcode = '42501';
  end if;
  if coalesce(public.current_role(), '') <> 'owner' then
    raise exception 'Only the owner can change a shared setting.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.key is distinct from old.key then
    raise exception 'The name of a setting cannot change; save it under the new name instead.' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end
$fn$;
drop trigger if exists shared_settings_guard on public.shared_settings;
create trigger shared_settings_guard before insert or update or delete on public.shared_settings
  for each row execute function public.shared_settings_guard();

-- ---------------------------------------------------------------- the owner saves a setting
create or replace function public.set_shared_setting(p_key text, p_value jsonb, p_audience text default 'owner_admin') returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v public.shared_settings%rowtype;
begin
  if coalesce(public.current_role(), '') <> 'owner' then
    raise exception 'Only the owner can change a shared setting.' using errcode = '42501';
  end if;
  if p_value is null then raise exception 'A setting needs a value.' using errcode = '22023'; end if;
  insert into public.shared_settings (key, value, audience)
    values (btrim(coalesce(p_key, '')), p_value, coalesce(p_audience, 'owner_admin'))
    on conflict (key) do update set value = excluded.value, audience = excluded.audience
    returning * into v;
  return jsonb_build_object('ok', true, 'key', v.key, 'updated_at', v.updated_at);
end
$fn$;

-- ---------------------------------------------------------------- audit: production's own audit trigger
-- Dynamic only because the function's name is read from production at install time.
do $audit$
declare
  v_nsp text;
  v_fn  text;
begin
  select n.nspname, p.proname into v_nsp, v_fn
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  execute format('drop trigger if exists %I on public.%I', 'shared_settings_audit', 'shared_settings');
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function %I.%I()',
                 'shared_settings_audit', 'shared_settings', v_nsp, v_fn);
end $audit$;

-- ---------------------------------------------------------------- who can see and do what
alter table public.shared_settings enable row level security;
revoke all on public.shared_settings from public, anon;
grant select, insert, update on public.shared_settings to authenticated;
drop policy if exists shared_settings_read on public.shared_settings;
create policy shared_settings_read on public.shared_settings for select to authenticated
  using (public.is_owner_or_admin() or (audience = 'staff' and public.is_active_staff()));
drop policy if exists shared_settings_owner_add on public.shared_settings;
create policy shared_settings_owner_add on public.shared_settings for insert to authenticated with check (coalesce(public.current_role(), '') = 'owner');
drop policy if exists shared_settings_owner_change on public.shared_settings;
create policy shared_settings_owner_change on public.shared_settings for update to authenticated
  using (coalesce(public.current_role(), '') = 'owner') with check (coalesce(public.current_role(), '') = 'owner');

revoke all on function public.set_shared_setting(text, jsonb, text) from public, anon;
revoke all on function public.shared_settings_guard() from public, anon;
grant execute on function public.set_shared_setting(text, jsonb, text) to authenticated;

commit;
