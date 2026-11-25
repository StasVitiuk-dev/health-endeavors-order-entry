-- DRAFT (2026-11-24). NOT INSTALLED. Rollback of 54_DRAFT_order_batches.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   55   (ROLLBACK, rolls back 54)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, while any batch is recorded, unless deleting them was authorized in the session; stops if the table or a function of these names was not created by drafts/54
-- @effect:      drops the two functions, the table and its guard; orders, inventory_lots and products untouched
-- @postcheck:   to_regclass('public.order_batches') is null
-- @rollback:    (this file is the rollback of drafts/54)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the record of which batch went into which order, and its functions.
-- Changes no other table: orders, inventory_lots and products are untouched.
-- STOPS, and removes nothing, while any batch is recorded: those rows are what a
-- recall is traced with. Export them first; deleting them must be authorized in
-- the same session:
--     set he.rollback_delete_order_batches = 'yes, delete the recorded batches';
-- Removes only objects carrying this draft's own mark; anything else with the
-- same name is left alone and the rollback stops.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_order_batches_install'));

do $guard$
declare v_rows bigint := 0;
begin
  if to_regclass('public.order_batches') is not null then
    if coalesce(obj_description(to_regclass('public.order_batches'), 'pg_class'), '') <> 'Health Endeavors drafts/54: the batch that went into each order' then
      raise exception 'Rollback stopped: the order_batches table here was not created by drafts/54. Nothing was removed.';
    end if;
    execute format('lock table %I.%I in access exclusive mode', 'public', 'order_batches');
    execute format('select count(*) from %I.%I', 'public', 'order_batches') into v_rows;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('record_order_batch', 'void_order_batch', 'order_batches_guard')
                and coalesce(obj_description(p.oid, 'pg_proc'), '') <> 'Health Endeavors drafts/54') then
    raise exception 'Rollback stopped: a function with one of this draft''s names was not created by drafts/54. Nothing was removed.';
  end if;
  if v_rows > 0 and coalesce(current_setting('he.rollback_delete_order_batches', true), '') <> 'yes, delete the recorded batches' then
    raise exception 'Rollback stopped: % recorded batch row(s) exist. Export them, then authorize deleting them in this session.', v_rows;
  end if;
end
$guard$;

-- the guard refuses deletes row by row; dropping the table removes the rows without it
drop function if exists public.void_order_batch(uuid, text);
drop function if exists public.record_order_batch(uuid, text, integer, text);
drop table if exists public.order_batches;
drop function if exists public.order_batches_guard();

commit;
