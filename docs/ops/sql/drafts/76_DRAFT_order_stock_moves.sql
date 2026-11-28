-- DRAFT (2026-11-28). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   76   (PRODUCTION-CHANGE-DRAFT, step order stock (launch promise 2: an order takes its bottles off the stock count exactly once, and gives them back once when cancelled; needed under both options of the one-stock-count decision))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        MEDIUM
-- @precheck:    stops, changing nothing, if orders, order_items, products, inventory or inventory_adjustments differ from the shape Query A reported, if is_owner_or_admin() or the unique indexes on inventory(product_id) and products(lower(sku)) are missing, or if an order_stock_moves table exists that this file did not create
-- @effect:      adds the record table order_stock_moves (one row per order line and kind, never updated or deleted) and take_order_stock / give_back_order_stock (owner or active administrator; all or nothing; lines matched to products by SKU); nothing calls them yet, so no stock changes until a page or the Shopify step does
-- @postcheck:   local-test/order_stock_moves_test.sh passes on a throwaway copy; in production: the table and the three functions exist, visitors cannot run them
-- @rollback:    drafts/77
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 77_DRAFT_rollback_order_stock_moves.sql.
-- Tested only on the local throwaway database (local-test/order_stock_moves_test.sh).
--
-- Why (launch promise 2, "stock goes down by exactly the amount sold"): today no order, on any
-- channel, lowers the dashboard's stock count (ONE_STOCK_COUNT_DECISION_2026-11-24.md). This step
-- lets an order take its bottles off the count exactly once, and give them back once if the order
-- is cancelled, with a record of every move. The Nov 24 decision page lists it as the part that
-- can be built before the owner's choice of which count is the selling count: it is needed under
-- both options.
--
-- What it adds (nothing runs by itself; nothing calls these yet):
--   * table public.order_stock_moves: one row per order line and kind ('take' or 'give_back'),
--     unique, so the same line can never be taken (or given back) twice;
--   * take_order_stock(order id): for every line of the order, finds the product by its SKU
--     (capital letters ignored, as products' unique SKU index does) and lowers "available" by the
--     line's quantity, writing one history row per line in inventory_adjustments;
--   * give_back_order_stock(order id): puts back what that order took, once.
-- Both are all or nothing: if any line has no product with that SKU, or any product would go below
-- zero, the whole order is refused, nothing changes, and the message names the lines.
-- Who: the owner or an active administrator (the same rule as every stock change today). Visitors
-- and other staff cannot call them. The automatic Shopify path (R9) is a later, separate step.
--
-- Shapes it relies on (the owner's Query A of Oct 5, `local-test/01_REAL_SHAPE_…`): order_items has
-- order_id, sku and quantity but no product link, so lines match products by SKU; products.sku is
-- unique ignoring case; inventory has one row per product with "available" never below zero. The
-- precheck below stops the install, changing nothing, if production differs.
-- Safe to run twice.

begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_order_stock_install'));

do $pre$
declare
  missing text[] := '{}';
  req record;
begin
  for req in
    select * from (values
      ('orders', array['id','order_number','deleted_at']),
      ('order_items', array['id','order_id','sku','product_name','quantity']),
      ('products', array['id','sku']),
      ('inventory', array['product_id','available','updated_at','updated_by']),
      ('inventory_adjustments', array['product_id','bucket','change_amount','reason','adjusted_by'])
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
  missing := missing || array(
    select 'type of ' || t.tbl || '.' || t.col || ' is ' || c.data_type || ', expected ' || t.typ
      from (values ('order_items','quantity','integer'), ('order_items','id','uuid'), ('orders','id','uuid'),
                   ('products','id','uuid'), ('inventory','available','integer'),
                   ('inventory_adjustments','change_amount','integer')) as t(tbl, col, typ)
      join information_schema.columns c on c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = t.col
     where c.data_type <> t.typ);
  if to_regprocedure('public.is_owner_or_admin()') is null then
    missing := missing || 'function public.is_owner_or_admin()'::text;
  end if;
  if to_regclass('public.inventory') is not null and not exists (
       select 1 from pg_index i where i.indrelid = 'public.inventory'::regclass and i.indisunique
          and pg_get_indexdef(i.indexrelid) ~* '\(product_id\)') then
    missing := missing || 'unique index on inventory(product_id)'::text;
  end if;
  if to_regclass('public.products') is not null and not exists (
       select 1 from pg_index i where i.indrelid = 'public.products'::regclass and i.indisunique
          and pg_get_indexdef(i.indexrelid) ~* '\(lower\(\(?sku\)?\)\)') then
    missing := missing || 'unique index on products(lower(sku))'::text;
  end if;
  if to_regclass('public.order_stock_moves') is not null
     and coalesce(obj_description(to_regclass('public.order_stock_moves'), 'pg_class'), '') <> 'Health Endeavors drafts/76: stock taken and given back per order line' then
    missing := missing || 'a table public.order_stock_moves that this file did not create'::text;
  end if;
  if array_length(missing, 1) > 0 then
    raise exception 'Install stopped, nothing was changed. This database is missing or differs: %', array_to_string(missing, '; ')
      using errcode = '42P01', hint = 'The functions were written for the shape Query A reported. Send this message to the session.';
  end if;
end $pre$;

create table if not exists public.order_stock_moves (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,            -- no foreign key on purpose: orders and their lines keep today's delete behaviour
  order_item_id uuid not null,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  kind text not null check (kind in ('take', 'give_back')),
  moved_by uuid,
  moved_at timestamptz not null default now(),
  constraint order_stock_moves_once unique (order_item_id, kind)
);
comment on table public.order_stock_moves is 'Health Endeavors drafts/76: stock taken and given back per order line';
create index if not exists order_stock_moves_order_idx on public.order_stock_moves (order_id);

alter table public.order_stock_moves enable row level security;
revoke all on public.order_stock_moves from public, anon, authenticated;
grant select, insert on public.order_stock_moves to authenticated;   -- never update or delete: the record stays
drop policy if exists order_stock_moves_read on public.order_stock_moves;
create policy order_stock_moves_read on public.order_stock_moves for select to authenticated using (public.is_owner_or_admin());
drop policy if exists order_stock_moves_write on public.order_stock_moves;
create policy order_stock_moves_write on public.order_stock_moves for insert to authenticated with check (public.is_owner_or_admin() and moved_by is not distinct from auth.uid());

-- One function for both directions; the two public names below are what a page calls.
create or replace function public._he_order_stock(p_order_id uuid, p_kind text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_number text;
  v_unmatched text;
  v_short text[] := '{}';
  v_done integer := 0;
  v_skipped integer := 0;
  v_avail integer;
  v_change integer;
  v_new uuid;
  r record;
begin
  if p_kind not in ('take', 'give_back') then
    raise exception 'Unknown stock move "%".', p_kind using errcode = '22023';
  end if;
  if not public.is_owner_or_admin() then
    raise exception 'Only the Owner or an Administrator can change stock.' using errcode = '42501';
  end if;
  -- One order at a time: a second press, or a second device, waits here and then finds the lines done.
  perform pg_advisory_xact_lock(hashtext('health_endeavors_order_stock:' || p_order_id::text));

  -- A deleted order never takes stock, but can still give back what it took (a duplicate removed
  -- after its stock was taken must not keep those bottles off the count for good).
  select coalesce(o.order_number, o.id::text) into v_number
    from orders o where o.id = p_order_id and (o.deleted_at is null or p_kind = 'give_back');
  if not found then
    raise exception 'That order does not exist or was deleted. Nothing was changed.' using errcode = 'P0002';
  end if;

  if p_kind = 'take' then
    -- Every line with a quantity must match exactly one product by SKU, or nothing happens.
    select string_agg(coalesce(nullif(oi.sku, ''), '(no SKU)') || ' — ' || coalesce(oi.product_name, 'unnamed line'), '; ' order by oi.id)
      into v_unmatched
      from order_items oi
     where oi.order_id = p_order_id and oi.quantity > 0
       and not exists (select 1 from products p where oi.sku is not null and lower(p.sku) = lower(oi.sku));
    if v_unmatched is not null then
      raise exception 'Order %: no product has the SKU of these lines: %. Nothing was changed. Add the SKU to the product (or correct the order line) and try again.', v_number, v_unmatched
        using errcode = '22023', hint = 'unmatched_sku';
    end if;
  else
    -- A line can come back to the shelf only one way: as a cancelled order here, or as a customer
    -- return inspected under drafts/40. If any line of this order already has a return recorded,
    -- giving the order back would count those bottles twice, so nothing happens.
    if to_regclass('public.customer_return_inspections') is not null then
      select string_agg(distinct coalesce(nullif(oi.sku, ''), '(no SKU)'), ', ')
        into v_unmatched
        from customer_return_inspections c
        join order_items oi on oi.id = c.order_item_id
       where oi.order_id = p_order_id and c.status <> 'cancelled';
      if v_unmatched is not null then
        raise exception 'Order %: a customer return is already recorded for %. Nothing was changed. Returned bottles come back through the return inspection, never twice.', v_number, v_unmatched
          using errcode = '23514', hint = 'already_returned';
      end if;
    end if;
  end if;

  -- Lines in product order: two orders that share products always lock them in the same order,
  -- so they cannot wait for each other forever.
  -- Giving back uses the product and quantity recorded when the stock was taken, so a SKU or line
  -- changed in between cannot send the bottles to the wrong product.
  for r in
    select * from (
      select oi.id as item_id, oi.sku, p.id as product_id, oi.quantity as qty
        from order_items oi
        join products p on lower(p.sku) = lower(oi.sku)
       where p_kind = 'take' and oi.order_id = p_order_id and oi.quantity > 0
      union all
      select t.order_item_id, coalesce(pr.sku, t.product_id::text), t.product_id, t.quantity
        from order_stock_moves t
        left join products pr on pr.id = t.product_id
       where p_kind = 'give_back' and t.order_id = p_order_id and t.kind = 'take'
    ) lines
     order by product_id, item_id
  loop
    insert into order_stock_moves (order_id, order_item_id, product_id, quantity, kind, moved_by)
    values (p_order_id, r.item_id, r.product_id, r.qty, p_kind, auth.uid())
    on conflict on constraint order_stock_moves_once do nothing
    returning id into v_new;
    if v_new is null then
      v_skipped := v_skipped + 1;   -- this line was already taken (or already given back)
      continue;
    end if;
    v_new := null;

    perform 1 from products where id = r.product_id for key share;   -- same lock order as drafts/10
    insert into inventory (product_id) values (r.product_id) on conflict (product_id) do nothing;
    select available into v_avail from inventory where product_id = r.product_id for update;
    v_change := case when p_kind = 'take' then -r.qty else r.qty end;
    if v_avail + v_change < 0 then
      v_short := v_short || (r.sku || ': needs ' || r.qty || ', has ' || v_avail);
      continue;   -- collect every short line, then refuse the whole order below
    end if;
    update inventory set available = available + v_change, updated_at = now(), updated_by = auth.uid()
     where product_id = r.product_id;
    insert into inventory_adjustments (product_id, bucket, change_amount, reason, adjusted_by)
    values (r.product_id, 'available', v_change,
            case when p_kind = 'take' then 'Order ' || v_number || ': taken off stock'
                 else 'Order ' || v_number || ': given back to stock (cancelled)' end,
            auth.uid());
    v_done := v_done + 1;
  end loop;

  if array_length(v_short, 1) > 0 then
    raise exception 'Order %: not enough in stock for %. Nothing was changed. Count the shelf and correct the stock first.', v_number, array_to_string(v_short, '; ')
      using errcode = '23514', hint = 'below_zero';
  end if;

  return jsonb_build_object('order', v_number, 'kind', p_kind, 'lines_changed', v_done, 'lines_already_done', v_skipped);
end $$;

create or replace function public.take_order_stock(p_order_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$ select public._he_order_stock(p_order_id, 'take') $$;

create or replace function public.give_back_order_stock(p_order_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$ select public._he_order_stock(p_order_id, 'give_back') $$;

-- The owner check is inside _he_order_stock; visitors are named, not only "public" (FIX 3 rule).
revoke all on function public._he_order_stock(uuid, text) from public, anon;
revoke all on function public.take_order_stock(uuid) from public, anon;
revoke all on function public.give_back_order_stock(uuid) from public, anon;
grant execute on function public._he_order_stock(uuid, text) to authenticated;
grant execute on function public.take_order_stock(uuid) to authenticated;
grant execute on function public.give_back_order_stock(uuid) to authenticated;

commit;
