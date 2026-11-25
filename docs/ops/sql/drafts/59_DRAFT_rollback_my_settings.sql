-- DRAFT (2026-11-24). NOT INSTALLED. ROLLBACK of drafts/58 (one person's settings).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   59   (ROLLBACK, rolls back 58)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, while any setting is saved, unless deleting them was authorized in the session; stops if the table was not created by drafts/58
-- @effect:      drops the function (both its shapes), the table and its guard
-- @postcheck:   to_regclass('public.my_settings') is null
-- @rollback:    (this file is the rollback of drafts/58)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the my_settings table and its functions. Changes no other table.
-- After it, the dashboard keeps such choices in each browser again, as before.
-- STOPS, and removes nothing, while any setting is saved, unless deleting them
-- is authorized in the same session (they are view preferences only):
--     set he.rollback_delete_my_settings = 'yes, delete the personal settings';
-- It also refuses to touch a table called my_settings that drafts/58 did not
-- create. Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_my_settings_install'));

do $guard$
declare v_rows bigint := 0;
begin
  if to_regclass('public.my_settings') is not null then
    if coalesce(obj_description(to_regclass('public.my_settings'), 'pg_class'), '') <> 'Health Endeavors drafts/58: one person''s settings on every device' then
      raise exception 'Rollback stopped: the table public.my_settings was not created by drafts/58. Nothing was removed.';
    end if;
    execute format('lock table %I.%I in access exclusive mode', 'public', 'my_settings');
    execute format('select count(*) from %I.%I', 'public', 'my_settings') into v_rows;
  end if;
  if v_rows > 0 and coalesce(current_setting('he.rollback_delete_my_settings', true), '') <> 'yes, delete the personal settings' then
    raise exception 'Rollback stopped: % personal setting(s) are saved. Authorize deleting them in this session.', v_rows;
  end if;
end
$guard$;

-- the guard refuses deletes row by row; dropping the table removes the rows without it
drop function if exists public.set_my_setting(text, jsonb, timestamptz, boolean);
drop function if exists public.set_my_setting(text, jsonb);   -- the earlier shape of this draft, if it was ever installed
drop table if exists public.my_settings;
drop function if exists public.my_settings_guard();

commit;
