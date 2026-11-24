-- DRAFT (2026-11-24). NOT INSTALLED. Rollback of 48_DRAFT_order_parcels.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   49   (ROLLBACK, rolls back 48)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, while any parcel is recorded, unless deleting them was authorized in the session; stops if the table or a function of these names was not created by drafts/48
-- @effect:      drops the two functions, both of the draft's own tables and their three guards; never mentions the agent's shipments table
-- @postcheck:   to_regclass('public.order_parcels') is null; public.shipments unchanged
-- @rollback:    (this file is the rollback of drafts/48)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes this draft's parcels, their diary and their functions. Changes no other
-- table: orders are untouched, and so is the Shipping/Tracking agent's own
-- `shipments` table (this draft never changed it, and this rollback does not
-- mention it).
-- STOPS, and removes nothing, while any parcel is recorded: they are the record
-- of which tracking number went with which order and when it was dropped off.
-- Export them first; deleting them must be authorized in the same session:
--     set he.rollback_delete_order_parcels = 'yes, delete the parcels';
-- Removes only objects carrying this draft's own mark; anything else with the
-- same name is left alone and the rollback stops.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_order_parcels_install'));

do $guard$
declare v_rows bigint := 0;
begin
  if to_regclass('public.order_parcels') is not null then
    if coalesce(obj_description(to_regclass('public.order_parcels'), 'pg_class'), '') <> 'Health Endeavors drafts/48: parcels and drop-off receipts' then
      raise exception 'Rollback stopped: the order_parcels table here was not created by drafts/48. Nothing was removed.';
    end if;
    execute format('lock table %I.%I in access exclusive mode', 'public', 'order_parcels');
    execute format('select count(*) from %I.%I', 'public', 'order_parcels') into v_rows;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('add_order_parcel', 'mark_parcels_dropped_off', 'order_parcels_guard', 'order_parcels_diary', 'order_parcel_events_guard')
                and coalesce(obj_description(p.oid, 'pg_proc'), '') <> 'Health Endeavors drafts/48') then
    raise exception 'Rollback stopped: a function with one of this draft''s names was not created by drafts/48. Nothing was removed.';
  end if;
  if v_rows > 0 and coalesce(current_setting('he.rollback_delete_order_parcels', true), '') <> 'yes, delete the parcels' then
    raise exception 'Rollback stopped: % parcel(s) are recorded. Export them, then authorize deleting them in this session.', v_rows;
  end if;
end
$guard$;

-- the guards refuse deletes row by row; dropping the tables removes the rows without them
drop function if exists public.mark_parcels_dropped_off(text[]);
drop function if exists public.add_order_parcel(uuid, text, text, text);
drop table if exists public.order_parcel_events;
drop table if exists public.order_parcels;
drop function if exists public.order_parcel_events_guard();
drop function if exists public.order_parcels_diary();
drop function if exists public.order_parcels_guard();

commit;
