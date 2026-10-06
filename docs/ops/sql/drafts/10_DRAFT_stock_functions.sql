-- =============================================================================
-- DRAFT — DO NOT RUN ON SUPABASE YET.
-- R1–R5 all-or-nothing stock functions for Health Endeavors.
-- 2026-10-05: reconciled with the REAL table shapes from the owner's read-only
-- Query A (columns, statuses, CHECK/UNIQUE constraints, RLS: stock tables are
-- Owner/Administrator only, via the existing public.is_owner_or_admin()).
-- Changes from the first draft: Owner/Administrator check before any stock
-- change; deleted purchase orders refused; non-whole catalogue quantities and
-- lot counts refused instead of silently rounded (PO quantities and lot
-- counts are numeric in the database, stock buckets are integers); SKU matched
-- case-insensitively like the unique index lower(sku); disposition validated.
-- Still DRAFT: Query B (data health) and Query C (agents writing stock) must
-- be reviewed first. Tested only on a local PostgreSQL with a copy of the real
-- table shapes (local-test/01_REAL_SHAPE_…) and synthetic data.
--
-- Design (docs/ops/R1-R5-function-design.md has the full reasoning):
--   * One function call = one transaction: every write happens or none does.
--   * The source row (purchase order / recall / return / stock row) is locked
--     with SELECT … FOR UPDATE, so retries, second tabs and second people
--     queue behind each other instead of double-applying.
--   * Status checks make retries idempotent ("already received" etc.).
--   * Arithmetic happens in the database (no lost updates); below-zero is
--     refused inside the same transaction.
--   * SECURITY INVOKER: runs with the caller's own rights, so existing RLS and
--     audit triggers apply exactly as today. No service key, no new powers.
--   * search_path pinned; EXECUTE granted to `authenticated` only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Layer 1: apply one bucket change + its history row, atomically.
-- Internal helper used by every workflow below (and by adjust_inventory).
-- ---------------------------------------------------------------------------
create or replace function public._he_apply_stock_change(
  p_product_id uuid,
  p_bucket text,
  p_change integer,
  p_reason text,
  p_lot_id uuid default null
) returns integer          -- the bucket's new value
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_new integer;
begin
  if p_bucket not in ('available','reserved','damaged','sample','wholesale','promotional','returned','recalled') then
    raise exception 'Unknown stock bucket "%".', p_bucket using errcode = '22023';
  end if;
  if p_change is null or p_change = 0 then
    raise exception 'A stock change must be a non-zero whole number.' using errcode = '22023';
  end if;
  -- Same rule as the stock tables' row-level security (Query A), checked up
  -- front so the caller gets a clear message instead of a bare RLS refusal.
  if not public.is_owner_or_admin() then
    raise exception 'Only the Owner or an Administrator can change stock.' using errcode = '42501';
  end if;

  -- Lock order everywhere: product, then its stock row. The history row's
  -- foreign key needs a share lock on the product anyway; taking it first means
  -- a concurrent delete_unused_product (product, then stock row) can't deadlock
  -- with this (found by the real-shape stress test, scenario S8).
  perform 1 from products where id = p_product_id for key share;
  if not found then
    raise exception 'That product no longer exists.' using errcode = 'P0002';
  end if;
  -- Make sure the product has a stock row, then lock it.
  insert into inventory (product_id) values (p_product_id) on conflict (product_id) do nothing;
  perform 1 from inventory where product_id = p_product_id for update;

  execute format(
    'update inventory set %1$I = %1$I + $1, updated_at = now(), updated_by = auth.uid()
      where product_id = $2 returning %1$I', p_bucket)
    into v_new using p_change, p_product_id;

  if v_new < 0 then
    -- Raising rolls back the whole calling transaction, including this update.
    raise exception 'That would leave % at % — only % in that bucket right now.',
      initcap(p_bucket), v_new, v_new - p_change
      using errcode = '23514', hint = 'below_zero';
  end if;

  insert into inventory_adjustments (product_id, bucket, change_amount, reason, adjusted_by, lot_id)
  values (p_product_id, p_bucket, p_change, p_reason, auth.uid(), p_lot_id);

  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- R4: manual "Save adjustment".
-- ---------------------------------------------------------------------------
create or replace function public.adjust_inventory(
  p_product_id uuid,
  p_bucket text,
  p_change integer,
  p_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_new integer;
begin
  if not exists (select 1 from products where id = p_product_id) then
    raise exception 'That product no longer exists.' using errcode = 'P0002';
  end if;
  v_new := _he_apply_stock_change(p_product_id, p_bucket, p_change, nullif(trim(p_reason), ''), null);
  return jsonb_build_object('product_id', p_product_id, 'bucket', p_bucket, 'change', p_change, 'new_value', v_new);
end $$;

-- ---------------------------------------------------------------------------
-- R1: purchase order "Receive delivery".
-- p_lots: [{"line_id": "<purchase_order_items.id>", "lot_number": "ABC_12"}, …]
-- p_expense_date: the business date the browser shows (owner decision D-ops-3);
--                 defaults to today in Central time.
-- ---------------------------------------------------------------------------
create or replace function public.receive_purchase_order(
  p_po_id uuid,
  p_lots jsonb default '[]'::jsonb,
  p_expense_date date default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_po purchase_orders%rowtype;
  v_line record;
  v_items_value numeric := 0;
  v_extras numeric;
  v_line_count integer;
  v_lot_number text;
  v_lot_id uuid;
  v_outstanding numeric;
  v_stocked integer := 0;
  v_skipped integer := 0;
  v_total numeric;
  v_expense_id uuid;
  v_vendor text;
begin
  if jsonb_typeof(coalesce(p_lots, '[]'::jsonb)) <> 'array' then
    raise exception 'Lot details must be a list.' using errcode = '22023';
  end if;
  if not public.is_owner_or_admin() then
    raise exception 'Only the Owner or an Administrator can receive a delivery.' using errcode = '42501';
  end if;

  select * into v_po from purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'That purchase order no longer exists.' using errcode = 'P0002';
  end if;
  if v_po.deleted_at is not null then
    raise exception 'Purchase order % was deleted, so it can''t be received.', v_po.po_number using errcode = '55000';
  end if;
  if v_po.status = 'received' then
    return jsonb_build_object('already_received', true, 'po_number', v_po.po_number);
  end if;
  if v_po.status not in ('ordered', 'shipped') then
    raise exception 'Purchase order % is "%" — only ordered or shipped orders can be received.', v_po.po_number, v_po.status
      using errcode = '55000';
  end if;

  -- Lock the lines too, so nothing edits them mid-receive.
  perform 1 from purchase_order_items where purchase_order_id = p_po_id for update;

  -- Stock buckets are whole numbers; purchase-order quantities are numeric.
  -- Refuse (before changing anything) rather than silently round 2.5 to 3.
  if exists (select 1 from purchase_order_items
              where purchase_order_id = p_po_id and product_id is not null
                and (quantity <> trunc(quantity) or quantity_received <> trunc(quantity_received))) then
    raise exception 'A catalogue line on purchase order % has a quantity that is not a whole number. Fix the line first — stock is counted in whole units.', v_po.po_number
      using errcode = '22023', hint = 'non_whole_quantity';
  end if;

  -- Landed unit cost: same formula as the dashboard today (owner-login.html 4542–4553).
  select coalesce(sum(quantity * unit_cost), 0), count(*) into v_items_value, v_line_count
    from purchase_order_items where purchase_order_id = p_po_id;
  v_extras := coalesce(v_po.shipping_cost, 0) + coalesce(v_po.tax, 0);
  update purchase_order_items i
     set landed_unit_cost = round(((i.quantity * i.unit_cost)
           + case when v_items_value > 0 then (i.quantity * i.unit_cost) / v_items_value * v_extras
                  else v_extras / v_line_count end) / i.quantity, 4)
   where i.purchase_order_id = p_po_id and i.quantity > 0;

  for v_line in
    -- Fixed lock order (by product) so two receives touching the same products
    -- can never deadlock each other.
    select * from purchase_order_items where purchase_order_id = p_po_id order by product_id nulls last, id
  loop
    v_outstanding := v_line.quantity - coalesce(v_line.quantity_received, 0);
    continue when v_outstanding <= 0;
    if v_line.product_id is null then v_skipped := v_skipped + 1; continue; end if;

    v_lot_id := null;
    select nullif(trim(e->>'lot_number'), '') into v_lot_number
      from jsonb_array_elements(coalesce(p_lots, '[]'::jsonb)) e
     where e->>'line_id' = v_line.id::text limit 1;
    if v_lot_number is not null then
      if length(v_lot_number) > 100 then
        raise exception 'Lot number is too long.' using errcode = '22001';
      end if;
      -- Exact, case-insensitive match (the dashboard's ilike treated _ and % as wildcards).
      select id into v_lot_id from inventory_lots
       where product_id = v_line.product_id and lower(lot_number) = lower(v_lot_number)
       for update;
      if found then
        update inventory_lots
           set quantity_received = quantity_received + v_outstanding,
               quantity_remaining = quantity_remaining + v_outstanding,
               updated_at = now()
         where id = v_lot_id;
      else
        insert into inventory_lots (product_id, lot_number, purchase_order_id, quantity_received, quantity_remaining, created_by)
        values (v_line.product_id, v_lot_number, p_po_id, v_outstanding, v_outstanding, auth.uid())
        returning id into v_lot_id;
      end if;
    end if;

    perform _he_apply_stock_change(v_line.product_id, 'available', v_outstanding::integer,
                                   'Delivery received (' || v_po.po_number || ')', v_lot_id);
    update purchase_order_items set quantity_received = quantity where id = v_line.id;
    v_stocked := v_stocked + 1;
  end loop;

  v_total := v_items_value + v_extras;
  if v_total > 0 then
    select name into v_vendor from suppliers where id = v_po.supplier_id;
    insert into expenses (category, amount, expense_date, vendor, note)
    values (v_po.expense_category, v_total,
            coalesce(p_expense_date, (now() at time zone 'America/Chicago')::date),
            v_vendor, 'Purchase order ' || v_po.po_number)
    returning id into v_expense_id;
  end if;

  update purchase_orders
     set status = 'received', received_at = now(), received_by = auth.uid(), updated_at = now()
   where id = p_po_id;

  return jsonb_build_object('already_received', false, 'po_number', v_po.po_number,
                            'stocked', v_stocked, 'skipped', v_skipped,
                            'expense_id', v_expense_id, 'expense_total', v_total);
end $$;

-- ---------------------------------------------------------------------------
-- R2: recall "Quarantine stock".
-- quantity_remaining on the lot is deliberately NOT reduced (by design: it
-- means "still physically here, in any bucket").
-- ---------------------------------------------------------------------------
create or replace function public.quarantine_recall(p_recall_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_recall recalls%rowtype;
  v_lot inventory_lots%rowtype;
  v_available integer;
  v_amount integer;
begin
  if not public.is_owner_or_admin() then
    raise exception 'Only the Owner or an Administrator can quarantine stock.' using errcode = '42501';
  end if;
  select * into v_recall from recalls where id = p_recall_id for update;
  if not found then
    raise exception 'That recall no longer exists.' using errcode = 'P0002';
  end if;
  if v_recall.status <> 'initiated' then
    return jsonb_build_object('already_done', true, 'status', v_recall.status,
                              'quantity_quarantined', v_recall.quantity_quarantined);
  end if;

  select * into v_lot from inventory_lots where id = v_recall.lot_id for update;
  if not found then
    raise exception 'The recalled lot no longer exists.' using errcode = 'P0002';
  end if;

  if v_lot.quantity_remaining <> trunc(v_lot.quantity_remaining) then
    raise exception 'Lot % has a remaining count that is not a whole number; fix it before quarantining.', v_lot.lot_number
      using errcode = '22023', hint = 'non_whole_quantity';
  end if;

  insert into inventory (product_id) values (v_lot.product_id) on conflict (product_id) do nothing;
  select available into v_available from inventory where product_id = v_lot.product_id for update;
  v_amount := least(coalesce(v_lot.quantity_remaining, 0), coalesce(v_available, 0));
  if v_amount <= 0 then
    raise exception 'There''s nothing left in Available for this lot to quarantine — check Inventory directly.'
      using errcode = '55000', hint = 'nothing_to_quarantine';
  end if;

  perform _he_apply_stock_change(v_lot.product_id, 'available', -v_amount, 'Recall — quarantined', v_lot.id);
  perform _he_apply_stock_change(v_lot.product_id, 'recalled',   v_amount, 'Recall — quarantined', v_lot.id);

  update recalls set status = 'quarantined', quantity_quarantined = v_amount, updated_at = now()
   where id = p_recall_id;

  return jsonb_build_object('already_done', false, 'quantity_quarantined', v_amount);
end $$;

-- ---------------------------------------------------------------------------
-- R3: return "Mark Received" (optionally restock).
-- Quantity and SKU come from the database (order_items), never from the page.
-- p_quantity: units actually returned; defaults to the whole line
-- (owner decision D-ops-5 — today the whole line is always restocked).
-- ---------------------------------------------------------------------------
create or replace function public.receive_return(
  p_return_id uuid,
  p_disposition text,
  p_quantity integer default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ret returns%rowtype;
  v_item record;
  v_product_id uuid;
  v_bucket text;
  v_qty integer;
  v_restocked boolean := false;
  v_note text := null;
begin
  if p_disposition is null or p_disposition = '' then
    raise exception 'Pick what happens to the stock before marking this Received.' using errcode = '22023';
  end if;
  if p_disposition not in ('restock_available', 'restock_damaged', 'discard') then
    raise exception 'Unknown disposition "%".', p_disposition using errcode = '22023';
  end if;
  -- Restocking changes stock, which only the Owner or an Administrator may do
  -- (Query A). Checked before anything is locked or written, so a refused
  -- restock never leaves the return marked Received. 'discard' stays open to staff.
  if p_disposition <> 'discard' and not public.is_owner_or_admin() then
    raise exception 'Only the Owner or an Administrator can restock a return. Nothing was changed.' using errcode = '42501';
  end if;

  select * into v_ret from returns where id = p_return_id for update;
  if not found then
    raise exception 'That return no longer exists.' using errcode = 'P0002';
  end if;
  if v_ret.status <> 'approved' then
    return jsonb_build_object('already_done', true, 'status', v_ret.status);
  end if;
  -- Defence in depth (finding N13): a stale page can set a finished return
  -- back to 'approved'. If it was already received once, never restock again.
  if v_ret.received_at is not null then
    return jsonb_build_object('already_done', true, 'status', v_ret.status, 'reason', 'received_before');
  end if;

  select oi.sku, oi.quantity, o.order_number into v_item
    from order_items oi left join orders o on o.id = oi.order_id
   where oi.id = v_ret.order_item_id;

  v_qty := coalesce(p_quantity, v_item.quantity, 0);
  if p_quantity is not null and (p_quantity < 1 or p_quantity > coalesce(v_item.quantity, 0)) then
    raise exception 'Returned quantity must be between 1 and % (the quantity on the order line).', coalesce(v_item.quantity, 0)
      using errcode = '22023';
  end if;

  if p_disposition in ('restock_available', 'restock_damaged') and v_qty > 0 then
    if v_item.sku is null or v_item.sku = '' then
      v_note := 'no_sku';
    else
      -- Case-insensitive, like the unique index on lower(sku).
      select id into v_product_id from products where lower(sku) = lower(v_item.sku);
      if v_product_id is null then
        v_note := 'no_product_with_sku';
      else
        v_bucket := case p_disposition when 'restock_available' then 'available' else 'damaged' end;
        perform _he_apply_stock_change(v_product_id, v_bucket, v_qty,
                                       'Return received (order ' || coalesce(v_item.order_number, '?') || ')', null);
        v_restocked := true;
      end if;
    end if;
  end if;

  update returns set status = 'received', disposition = p_disposition, received_at = now(), updated_at = now()
   where id = p_return_id;

  return jsonb_build_object('already_done', false, 'restocked', v_restocked, 'quantity', case when v_restocked then v_qty else 0 end,
                            'note', v_note, 'sku', v_item.sku);
end $$;

-- ---------------------------------------------------------------------------
-- R5: delete a product only if nothing uses it — stock row and product
-- disappear together, or neither does.
-- ---------------------------------------------------------------------------
create or replace function public.delete_unused_product(p_product_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_stock integer;
begin
  perform 1 from products where id = p_product_id for update;
  if not found then
    return jsonb_build_object('deleted', false, 'reason', 'not_found');
  end if;
  select coalesce(available + reserved + damaged + sample + wholesale + promotional + returned + recalled, 0)
    into v_stock from inventory where product_id = p_product_id for update;
  if coalesce(v_stock, 0) <> 0 then
    return jsonb_build_object('deleted', false, 'reason', 'has_stock', 'units', v_stock);
  end if;
  begin
    delete from inventory where product_id = p_product_id;
    delete from products where id = p_product_id;
  exception when foreign_key_violation then
    -- The sub-block is rolled back: the stock row is restored automatically.
    return jsonb_build_object('deleted', false, 'reason', 'in_use');
  end;
  return jsonb_build_object('deleted', true);
end $$;

-- ---------------------------------------------------------------------------
-- Permissions: logged-in staff only; RLS still applies (security invoker).
-- ---------------------------------------------------------------------------
revoke all on function public._he_apply_stock_change(uuid, text, integer, text, uuid) from public, anon;
revoke all on function public.adjust_inventory(uuid, text, integer, text) from public, anon;
revoke all on function public.receive_purchase_order(uuid, jsonb, date) from public, anon;
revoke all on function public.quarantine_recall(uuid) from public, anon;
revoke all on function public.receive_return(uuid, text, integer) from public, anon;
revoke all on function public.delete_unused_product(uuid) from public, anon;
grant execute on function public._he_apply_stock_change(uuid, text, integer, text, uuid) to authenticated;
grant execute on function public.adjust_inventory(uuid, text, integer, text) to authenticated;
grant execute on function public.receive_purchase_order(uuid, jsonb, date) to authenticated;
grant execute on function public.quarantine_recall(uuid) to authenticated;
grant execute on function public.receive_return(uuid, text, integer) to authenticated;
grant execute on function public.delete_unused_product(uuid) to authenticated;
