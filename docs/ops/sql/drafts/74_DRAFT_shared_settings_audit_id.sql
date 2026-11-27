-- DRAFT (2026-11-27). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   74   (PRODUCTION-CHANGE-DRAFT, step A2 (right after step A: production's audit trigger records new.id, which shared_settings lacked; found Nov 27 when every save was refused))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  50
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if step A's shared_settings table or its audit trigger is missing, or if an id column exists that this file did not add
-- @effect:      adds one column, shared_settings.id (filled in automatically, unique), so production's audit trigger can record each save; the key, rules, guard and set_shared_setting() are unchanged; no other table changes
-- @postcheck:   the column exists and is filled; an owner's save is accepted and lands in audit_log; local-test/shared_settings_audit_id_test.sh passes on a throwaway copy
-- @rollback:    drafts/75
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 75_DRAFT_rollback_shared_settings_audit_id.sql.
-- Tested only on the local throwaway database (local-test/shared_settings_audit_id_test.sh).
--
-- Why: step A (drafts/50) was installed on Nov 27, but every save was refused with
-- 'record "new" has no field "id"'. Step A attaches production's own audit trigger (the one on
-- tasks) to shared_settings, and the owner's read-only look the same night showed what that
-- trigger does: production's audit_trigger_function() writes new.id::text / old.id::text into
-- audit_log.record_id. shared_settings names its rows by key and has no id column, so the audit
-- trigger fails and the whole save is undone (nothing was ever saved). The local test copy's
-- stand-in audit function tolerated a missing id, which is why the tests did not catch it; it is
-- now word for word production's.
--
-- What it adds: one column, shared_settings.id (a random identifier filled in automatically, never
-- typed by anyone), so the audit trigger can write it as the record's identifier. Every save is
-- then recorded in audit_log as step A intended. Nothing else changes: the key stays the setting's
-- name, the rules, the guard and set_shared_setting() are untouched, and no other table changes.
-- The table is empty today (nothing could be saved), so no setting is touched.
-- Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_shared_settings_install'));

do $pre$
declare v_type text; v_note text;
begin
  if to_regclass('public.shared_settings') is null
     or coalesce(obj_description(to_regclass('public.shared_settings'), 'pg_class'), '') <> 'Health Endeavors drafts/50: settings shared by every device' then
    raise exception 'Not installed, nothing was changed: the shared settings table of step A (drafts/50) is not there. Install step A first.';
  end if;
  select format_type(a.atttypid, a.atttypmod), col_description(a.attrelid, a.attnum) into v_type, v_note
    from pg_attribute a where a.attrelid = 'public.shared_settings'::regclass and a.attname = 'id' and not a.attisdropped;
  if found and (v_type <> 'uuid' or coalesce(v_note, '') <> 'Health Endeavors drafts/74: the identifier the audit trigger records') then
    raise exception 'Not installed, nothing was changed: public.shared_settings already has an id column that this file did not add.';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.shared_settings'::regclass and tgname = 'shared_settings_audit') then
    raise exception 'Not installed, nothing was changed: the audit trigger of step A (shared_settings_audit) is missing.';
  end if;
end
$pre$;

alter table public.shared_settings add column if not exists id uuid not null default gen_random_uuid();
comment on column public.shared_settings.id is 'Health Endeavors drafts/74: the identifier the audit trigger records';
create unique index if not exists shared_settings_id_key on public.shared_settings (id);

commit;
