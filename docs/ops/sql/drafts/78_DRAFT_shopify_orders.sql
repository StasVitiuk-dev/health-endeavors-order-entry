-- DRAFT (2026-11-28). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   78   (PRODUCTION-CHANGE-DRAFT, step Shopify orders saved once (R9 path B only: a new read-only order program; not used if today's import is kept))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        MEDIUM
-- @precheck:    stops, changing nothing, if orders or order_items differ from the shape Query A reported, if the unique rule on orders(channel, external_order_id) is missing, if the service key may not read, add and change orders and order lines, or if an order_items.external_line_id column exists that this file did not create
-- @effect:      adds order_items.external_line_id (Shopify's line id) with a unique rule per order, and save_shopify_order(order) for the program only (the service key): writes each order once by Shopify's order id and each line once by Shopify's line id; never rewrites a line whose stock was taken; never brings back a deleted order; no customer details
-- @postcheck:   local-test/shopify_orders_test.mjs passes on a throwaway copy; in production: the function exists, visitors and signed-in people cannot run it
-- @rollback:    drafts/79
-- @@ end metadata @@
-- written approval. DO NOT RUN until then. Only for R9 path B (docs/ops/R9_SHOPIFY_ORDERS_DESIGN.md):
-- if the owner keeps today's order import (path A), this file is never used.
-- Rollback: 79_DRAFT_rollback_shopify_orders.sql.
-- Tested only on the local throwaway database (local-test/shopify_orders_test.mjs).
--
-- Why (launch promise 2, "every order lands on the dashboard"): a new program
-- (docs/ops/edge-drafts/shopify-orders-sync) reads Shopify's orders with a read-only key and hands
-- each one to save_shopify_order() below, which writes it ONCE:
--   * the order by Shopify's order id (orders is already unique on channel + external_order_id);
--   * each line by Shopify's line id: a new column order_items.external_line_id and a unique rule on
--     (order_id, external_line_id), so a line can never be written twice (order_items has no unique
--     rule today, Query A).
-- Running it twice, or a second program run at the same moment, changes nothing.
--
-- What it keeps safe:
--   * all or nothing per order: the order and its lines are written together, or not at all;
--   * a line whose stock was already taken (drafts/76, if installed) is never changed by a later
--     Shopify edit: it is "held" and named in the answer, for the owner to look at;
--   * an order deleted on the dashboard is never brought back;
--   * no customer details: no name, email, address or card (the program asks Shopify for none);
--   * only the database's own service key can call it (the program); nobody signed in, no visitor.
--
-- Shapes it relies on (the owner's Query A of Oct 5): orders(channel, external_order_id, order_number,
-- status, currency, subtotal, shipping_total, tax_total, total, placed_at, source, deleted_at,
-- updated_at) with the unique index on (channel, external_order_id); order_items(order_id, sku,
-- product_name, quantity, unit_price, line_total). The precheck stops the install, changing nothing,
-- if production differs. Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_shopify_orders_install'));

do $pre$
declare
  missing text[] := '{}';
  req record;
begin
  for req in
    select * from (values
      ('orders', array['id','channel','external_order_id','order_number','status','currency','subtotal','shipping_total','tax_total','total','placed_at','source','deleted_at','updated_at']),
      ('order_items', array['id','order_id','sku','product_name','quantity','unit_price','line_total'])
    ) as t(tbl, cols)
  loop
    if to_regclass('public.' || req.tbl) is null then
      missing := missing || ('table public.' || req.tbl);
    else
      missing := missing || array(
        select 'column ' || req.tbl || '.' || c from unnest(req.cols) c
        where not exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = req.tbl and column_name = c));
    end if;
  end loop;
  if to_regclass('public.orders') is not null and not exists (
       select 1 from pg_index i where i.indrelid = 'public.orders'::regclass and i.indisunique
          and pg_get_indexdef(i.indexrelid) ~* '\(channel, external_order_id\)') then
    missing := missing || 'unique index on orders(channel, external_order_id)'::text;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    missing := missing || 'the role service_role (the database''s own service key)'::text;
  elsif to_regclass('public.orders') is not null and to_regclass('public.order_items') is not null
        and not (has_table_privilege('service_role', 'public.orders', 'SELECT, INSERT, UPDATE')
                 and has_table_privilege('service_role', 'public.order_items', 'SELECT, INSERT, UPDATE')) then
    missing := missing || 'the service key''s right to read, add and change orders and order lines (Supabase gives it by default)'::text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'external_line_id')
     and coalesce(col_description('public.order_items'::regclass,
           (select attnum from pg_attribute where attrelid = 'public.order_items'::regclass and attname = 'external_line_id')), '')
         <> 'Health Endeavors drafts/78: the Shopify line id' then
    missing := missing || 'a column order_items.external_line_id that this file did not create'::text;
  end if;
  if array_length(missing, 1) > 0 then
    raise exception 'Install stopped, nothing was changed. This database is missing or differs: %', array_to_string(missing, '; ')
      using errcode = '42P01', hint = 'The step was written for the shape Query A reported. Send this message to the session.';
  end if;
end $pre$;

alter table public.order_items add column if not exists external_line_id text;
comment on column public.order_items.external_line_id is 'Health Endeavors drafts/78: the Shopify line id';
create unique index if not exists order_items_external_line_key on public.order_items (order_id, external_line_id);

create or replace function public.save_shopify_order(p_order jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ext text := p_order ->> 'external_order_id';
  v_id uuid;
  v_created boolean := false;
  v_deleted timestamptz;
  v_moves boolean := to_regclass('public.order_stock_moves') is not null;
  v_added integer := 0;
  v_changed integer := 0;
  v_held text[] := '{}';
  v_line jsonb;
  v_old record;
  v_status text := lower(coalesce(nullif(btrim(p_order ->> 'status'), ''), 'pending'));
begin
  if v_ext is null or v_ext !~ '^gid://shopify/Order/[0-9]{1,20}$' then
    raise exception 'Not a Shopify order id: %', left(coalesce(v_ext, '(none)'), 60) using errcode = '22023';
  end if;
  if jsonb_typeof(p_order -> 'lines') is distinct from 'array' or jsonb_array_length(p_order -> 'lines') > 250 then
    raise exception 'Order %: its lines are missing or too many.', v_ext using errcode = '22023';
  end if;
  if v_status !~ '^[a-z_]{1,30}$' then
    raise exception 'Order %: unreadable status.', v_ext using errcode = '22023';
  end if;
  -- one save per Shopify order at a time (two runs at the same moment wait for each other)
  perform pg_advisory_xact_lock(hashtext('health_endeavors_shopify_order:' || v_ext));

  select id, deleted_at into v_id, v_deleted from orders where channel = 'shopify' and external_order_id = v_ext for update;
  if v_id is not null and v_deleted is not null then
    return jsonb_build_object('order', p_order ->> 'order_number', 'skipped', 'deleted_on_the_dashboard');
  end if;
  if v_id is null then
    insert into orders (channel, external_order_id, order_number, status, currency, subtotal, shipping_total, tax_total, total, placed_at, source)
    values ('shopify', v_ext, left(p_order ->> 'order_number', 40), v_status, coalesce(p_order ->> 'currency', 'USD'),
            (p_order ->> 'subtotal')::numeric, (p_order ->> 'shipping_total')::numeric, (p_order ->> 'tax_total')::numeric,
            (p_order ->> 'total')::numeric, (p_order ->> 'placed_at')::timestamptz, 'shopify')
    on conflict (channel, external_order_id) do nothing
    returning id into v_id;
    if v_id is null then   -- written at this very moment by another run: use that row
      select id into v_id from orders where channel = 'shopify' and external_order_id = v_ext;
    else
      v_created := true;
    end if;
  else
    update orders set status = v_status, currency = coalesce(p_order ->> 'currency', currency),
           subtotal = (p_order ->> 'subtotal')::numeric, shipping_total = (p_order ->> 'shipping_total')::numeric,
           tax_total = (p_order ->> 'tax_total')::numeric, total = (p_order ->> 'total')::numeric, updated_at = now()
     where id = v_id
       and (status, currency, subtotal, shipping_total, tax_total, total) is distinct from
           (v_status, coalesce(p_order ->> 'currency', currency), (p_order ->> 'subtotal')::numeric, (p_order ->> 'shipping_total')::numeric,
            (p_order ->> 'tax_total')::numeric, (p_order ->> 'total')::numeric);
  end if;

  -- and the same per-order lock as drafts/76, so a stock move and a Shopify edit never pass each other unseen
  perform pg_advisory_xact_lock(hashtext('health_endeavors_order_stock:' || v_id::text));

  for v_line in select * from jsonb_array_elements(p_order -> 'lines')
  loop
    if (v_line ->> 'external_line_id') !~ '^gid://shopify/LineItem/[0-9]{1,20}$' or (v_line ->> 'quantity')::integer < 0 then
      raise exception 'Order %: a line has no Shopify line id or a negative quantity. Nothing was saved.', v_ext using errcode = '22023';
    end if;
    select id, sku, product_name, quantity, unit_price, line_total into v_old
      from order_items where order_id = v_id and external_line_id = v_line ->> 'external_line_id';
    if v_old.id is null then
      insert into order_items (order_id, external_line_id, sku, product_name, quantity, unit_price, line_total)
      values (v_id, v_line ->> 'external_line_id', nullif(btrim(v_line ->> 'sku'), ''), left(v_line ->> 'product_name', 200),
              (v_line ->> 'quantity')::integer, (v_line ->> 'unit_price')::numeric, (v_line ->> 'line_total')::numeric)
      on conflict (order_id, external_line_id) do nothing;
      if found then v_added := v_added + 1; end if;
    elsif (v_old.sku, v_old.product_name, v_old.quantity, v_old.unit_price, v_old.line_total) is distinct from
          (nullif(btrim(v_line ->> 'sku'), ''), left(v_line ->> 'product_name', 200), (v_line ->> 'quantity')::integer,
           (v_line ->> 'unit_price')::numeric, (v_line ->> 'line_total')::numeric) then
      if v_moves and exists (select 1 from order_stock_moves m where m.order_item_id = v_old.id) then
        v_held := v_held || coalesce(v_old.sku, '(no SKU)');   -- stock already moved for this line: never rewrite it
      else
        update order_items set sku = nullif(btrim(v_line ->> 'sku'), ''), product_name = left(v_line ->> 'product_name', 200),
               quantity = (v_line ->> 'quantity')::integer, unit_price = (v_line ->> 'unit_price')::numeric,
               line_total = (v_line ->> 'line_total')::numeric
         where id = v_old.id;
        v_changed := v_changed + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('order', p_order ->> 'order_number', 'created', v_created,
                            'lines_added', v_added, 'lines_changed', v_changed, 'lines_held', to_jsonb(v_held));
end $$;

-- Only the program (the database's own service key) calls it; nobody signed in, no visitor (FIX 3 rule).
-- Supabase gives every new function to the service key by itself, so nothing is granted here; the check
-- below makes sure of it, and undoes the whole step if the service key could not run it.
revoke all on function public.save_shopify_order(jsonb) from public, anon, authenticated;

do $post$
begin
  if not has_function_privilege('service_role', 'public.save_shopify_order(jsonb)', 'execute') then
    raise exception 'Install stopped, nothing was changed: the service key would not be allowed to run save_shopify_order. Send this message to the session.'
      using errcode = '42501';
  end if;
  if has_function_privilege('anon', 'public.save_shopify_order(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.save_shopify_order(jsonb)', 'execute') then
    raise exception 'Install stopped, nothing was changed: visitors or signed-in people could still run save_shopify_order.' using errcode = '42501';
  end if;
end $post$;

commit;
