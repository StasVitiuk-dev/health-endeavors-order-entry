-- DRAFT (2026-11-24). NOT INSTALLED. ROLLBACK of drafts/52 (order costs).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   53   (ROLLBACK, rolls back 52)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, removing nothing, while any order's costs are saved, unless deleting them was authorized in the session; stops if the table was not created by drafts/52
-- @effect:      drops the function, the table and its guard; orders untouched
-- @postcheck:   to_regclass('public.order_costs') is null
-- @rollback:    (this file is the rollback of drafts/52)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the order costs table and its functions. Changes no other table; orders
-- are untouched. After it, Real profit uses the estimates for every order again.
-- STOPS, and removes nothing, while any order's real costs are saved. Export them
-- first; deleting them must be authorized in the same session:
--     set he.rollback_delete_order_costs = 'yes, delete the order costs';
-- It also refuses to touch a table called order_costs that drafts/52 did not
-- create. Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_order_costs_install'));

do $guard$
declare v_rows bigint := 0;
begin
  if to_regclass('public.order_costs') is not null then
    if coalesce(obj_description(to_regclass('public.order_costs'), 'pg_class'), '') <> 'Health Endeavors drafts/52: the real fee and postage of each order' then
      raise exception 'Rollback stopped: the table public.order_costs was not created by drafts/52. Nothing was removed.';
    end if;
    execute format('lock table %I.%I in access exclusive mode', 'public', 'order_costs');
    execute format('select count(*) from %I.%I', 'public', 'order_costs') into v_rows;
  end if;
  if v_rows > 0 and coalesce(current_setting('he.rollback_delete_order_costs', true), '') <> 'yes, delete the order costs' then
    raise exception 'Rollback stopped: the real costs of % order(s) are saved. Export them, then authorize deleting them in this session.', v_rows;
  end if;
end
$guard$;

-- the guard refuses deletes row by row; dropping the table removes the rows without it
drop function if exists public.set_order_costs(jsonb);
drop table if exists public.order_costs;
drop function if exists public.order_costs_guard();

commit;
