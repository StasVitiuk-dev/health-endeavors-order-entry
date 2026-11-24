-- DRAFT (2026-11-24). NOT INSTALLED. Rollback of 48_DRAFT_shipments.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   49   (ROLLBACK, rolls back 48)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, while any parcel is recorded, unless deleting them was authorized in the session
-- @effect:      drops the two functions, both tables and their three guards
-- @postcheck:   to_regclass('public.shipments') is null
-- @rollback:    (this file is the rollback of drafts/48)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the parcels, their diary and their functions. Changes no other table;
-- orders are untouched.
-- STOPS, and removes nothing, while any parcel is recorded: they are the record
-- of which tracking number went with which order and when it was dropped off.
-- Export them first; deleting them must be authorized in the same session:
--     set he.rollback_delete_shipments = 'yes, delete the parcels';
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_shipments_install'));

do $guard$
declare v_rows bigint := 0;
begin
  if to_regclass('public.shipments') is not null then
    execute format('lock table %I.%I in access exclusive mode', 'public', 'shipments');
    execute format('select count(*) from %I.%I', 'public', 'shipments') into v_rows;
  end if;
  if v_rows > 0 and coalesce(current_setting('he.rollback_delete_shipments', true), '') <> 'yes, delete the parcels' then
    raise exception 'Rollback stopped: % parcel(s) are recorded. Export them, then authorize deleting them in this session.', v_rows;
  end if;
end
$guard$;

-- the guards refuse deletes row by row; dropping the tables removes the rows without them
drop function if exists public.mark_dropped_off(text[]);
drop function if exists public.add_shipment(uuid, text, text, text);
drop table if exists public.shipment_events;
drop table if exists public.shipments;
drop function if exists public.shipment_events_guard();
drop function if exists public.shipments_diary();
drop function if exists public.shipments_guard();

commit;
