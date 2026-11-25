-- DRAFT (2026-11-24). NOT INSTALLED. ROLLBACK of drafts/50 (shared settings).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   51   (ROLLBACK, rolls back 50)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, while any setting is saved, unless deleting them was authorized in the session; stops if the table was not created by drafts/50
-- @effect:      drops the function, the table and its guard
-- @postcheck:   to_regclass('public.shared_settings') is null
-- @rollback:    (this file is the rollback of drafts/50)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the shared settings table and its functions. Changes no other table.
-- After it, the dashboard keeps such settings in each browser again, as before.
-- STOPS, and removes nothing, while any setting is saved: those are the values
-- the owner typed. Note them first; deleting them must be authorized in the same
-- session:
--     set he.rollback_delete_shared_settings = 'yes, delete the shared settings';
-- It also refuses to touch a table called shared_settings that drafts/50 did not
-- create. Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_shared_settings_install'));

do $guard$
declare v_rows bigint := 0;
begin
  if to_regclass('public.shared_settings') is not null then
    if coalesce(obj_description(to_regclass('public.shared_settings'), 'pg_class'), '') <> 'Health Endeavors drafts/50: settings shared by every device' then
      raise exception 'Rollback stopped: the table public.shared_settings was not created by drafts/50. Nothing was removed.';
    end if;
    execute format('lock table %I.%I in access exclusive mode', 'public', 'shared_settings');
    execute format('select count(*) from %I.%I', 'public', 'shared_settings') into v_rows;
  end if;
  if v_rows > 0 and coalesce(current_setting('he.rollback_delete_shared_settings', true), '') <> 'yes, delete the shared settings' then
    raise exception 'Rollback stopped: % shared setting(s) are saved. Note them, then authorize deleting them in this session.', v_rows;
  end if;
end
$guard$;

-- the guard refuses deletes row by row; dropping the table removes the rows without it
drop function if exists public.set_shared_setting(text, jsonb, text, timestamptz, boolean);
drop function if exists public.set_shared_setting(text, jsonb, text);   -- the earlier shape of this draft, if it was ever installed
drop table if exists public.shared_settings;
drop function if exists public.shared_settings_guard();

commit;
