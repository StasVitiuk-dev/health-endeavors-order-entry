-- DRAFT (2026-11-27). ROLLBACK of 74_DRAFT_shared_settings_audit_id.sql. Needs the owner's
-- written approval. DO NOT RUN until then.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   75   (ROLLBACK, rolls back 74)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if the id column was not added by drafts/74
-- @effect:      removes shared_settings.id again; saves are refused by the audit trigger again; saved settings stay
-- @postcheck:   the column is gone
-- @rollback:    (this file is the rollback of drafts/74)
-- @@ end metadata @@
-- Tested only on the local throwaway database (local-test/shared_settings_audit_id_test.sh).
--
-- Removes the id column drafts/74 added to shared_settings, but only if drafts/74 added it (it
-- checks its mark). Afterwards every save of a shared setting is refused again by the audit
-- trigger (as before drafts/74), so turn "Settings shared by every device" off first. The saved
-- settings themselves stay. Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_shared_settings_install'));

do $pre$
declare v_note text;
begin
  if to_regclass('public.shared_settings') is null then return; end if;
  select col_description(a.attrelid, a.attnum) into v_note
    from pg_attribute a where a.attrelid = 'public.shared_settings'::regclass and a.attname = 'id' and not a.attisdropped;
  if found and coalesce(v_note, '') <> 'Health Endeavors drafts/74: the identifier the audit trigger records' then
    raise exception 'Nothing was changed: the id column on public.shared_settings was not added by drafts/74.';
  end if;
end
$pre$;

drop index if exists public.shared_settings_id_key;
do $undo$
begin
  if to_regclass('public.shared_settings') is not null then
    alter table public.shared_settings drop column if exists id;
  end if;
end
$undo$;

commit;
