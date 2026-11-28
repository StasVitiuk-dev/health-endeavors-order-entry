-- DRAFT (2026-11-28). NOT INSTALLED. ROLLBACK of drafts/78 (Shopify orders saved once).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   79   (ROLLBACK, rolls back 78)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if drafts/78 is not installed
-- @effect:      removes save_shopify_order(); keeps the Shopify line ids and their unique rule if any line has one, removes them if none; no order or line is deleted
-- @postcheck:   the function is gone
-- @rollback:    (this file is the rollback of drafts/78)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
-- Tested only on the local throwaway database (local-test/shopify_orders_test.mjs).
--
-- Removes save_shopify_order(), so the order program can no longer write. It does NOT delete any
-- order or order line. The Shopify line ids (order_items.external_line_id) and their unique rule are
-- kept if any line has one (they say which Shopify line each row is, and stop a line being written
-- twice if the step is installed again); with none, both are removed. If drafts/78 is not installed,
-- it stops and changes nothing. Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_shopify_orders_install'));

do $pre$
begin
  if to_regprocedure('public.save_shopify_order(jsonb)') is null
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'external_line_id') then
    raise exception 'Nothing to undo: drafts/78 (Shopify orders) is not installed.';
  end if;
end $pre$;

drop function if exists public.save_shopify_order(jsonb);

do $keep$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'external_line_id') then
    if exists (select 1 from public.order_items where external_line_id is not null) then
      raise notice 'order_items.external_line_id kept: lines saved from Shopify carry their Shopify line id. No order or line was changed.';
    else
      drop index if exists public.order_items_external_line_key;
      alter table public.order_items drop column external_line_id;
    end if;
  end if;
end $keep$;

commit;
