-- DRAFT (2026-11-28). NOT INSTALLED. ROLLBACK of drafts/76 (stock taken and given back per order).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   77   (ROLLBACK, rolls back 76)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if drafts/76 is not installed
-- @effect:      removes the three functions; keeps order_stock_moves if it holds any move (history), drops it if empty; no stock number changes
-- @postcheck:   the functions are gone
-- @rollback:    (this file is the rollback of drafts/76)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
-- Tested only on the local throwaway database (local-test/order_stock_moves_test.sh).
--
-- Removes the three functions of drafts/76, so no order can take or give back stock any more.
-- It does NOT change any stock number: bottles already taken off by an order stay taken off,
-- and the history rows in inventory_adjustments stay. The record table order_stock_moves is
-- removed only when it is empty; if it holds moves, it is kept (read-only history) and the
-- message says so, because deleting it would lose which orders already took their stock.
-- If drafts/76 is not installed, it stops and changes nothing. Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_order_stock_install'));

do $pre$
begin
  if to_regclass('public.order_stock_moves') is null
     and to_regprocedure('public._he_order_stock(uuid, text)') is null then
    raise exception 'Nothing to undo: drafts/76 (stock per order) is not installed.';
  end if;
end $pre$;

drop function if exists public.take_order_stock(uuid);
drop function if exists public.give_back_order_stock(uuid);
drop function if exists public._he_order_stock(uuid, text);

do $keep$
begin
  if to_regclass('public.order_stock_moves') is not null then
    if exists (select 1 from public.order_stock_moves) then
      raise notice 'order_stock_moves kept: it records stock already taken or given back by orders. Stock numbers were not changed.';
    else
      drop table public.order_stock_moves;
    end if;
  end if;
end $keep$;

commit;
