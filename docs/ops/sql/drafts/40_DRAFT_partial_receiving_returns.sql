-- DRAFT (2026-11-22). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   40   (PRODUCTION-CHANGE-DRAFT, step optional (after the owner's D-ops-5 decisions; needed before partial deliveries and inspected customer returns are used))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        MEDIUM
-- @precheck:    stops if auth.uid(), current_role(), is_active_staff(), is_owner_or_admin() or the purchase_orders, purchase_order_items, inventory, inventory_adjustments, returns, order_items or products table is missing
-- @effect:      6 new tables (receiving records and lines, supplier returns, customer return inspections, stock movements, stock corrections); staff submit, the owner or an administrator approves before any stock changes (owner decision of Nov 24); surplus logged for the owner; rejected units stay outstanding; damaged kept go to Damaged; supplier returns reopen the outstanding quantity only when a replacement is expected; customer returns wait for inspection, opened or used never restocked; corrections are linked reversing movements with reason and approver; request keys and row locks against retries and simultaneous approvals; on approval only: inventory buckets, purchase_order_items.quantity_received, purchase_orders.status, inventory_adjustments
-- @postcheck:   the six tables present and empty; anon cannot read them; local-test/partial_receiving_test.sh passes on a throwaway copy
-- @rollback:    drafts/41
-- @@ end metadata @@
-- written approval, and the owner's D-ops-5 decisions first. DO NOT RUN until then.
-- Rollback: 41_DRAFT_rollback_partial_receiving_returns.sql.
-- Tested only on the local throwaway database (local-test/partial_receiving_test.sh).
--
-- Why: the owner's preferred rules of Nov 22 for partial deliveries and returns
-- (decision D-ops-5, backlog INV-17), for staging:
--   1 surplus deliveries are logged separately for the owner's review (not in stock)
--   2 rejected deliveries are recorded separately and stay outstanding
--   3 damaged goods we keep go into the Damaged bucket
--   4 a return to the supplier reopens the outstanding quantity only when a
--     replacement is expected
--   5 staff submit receiving records for purchase orders they can see; the owner
--     approves before any stock changes
--   6 customer returns wait in "awaiting inspection"; the owner decides; opened or
--     used skincare can never be restocked
--   7 corrections are linked stock movements with a reason and the approver
--
-- What it adds (no existing table changes shape):
--   * receiving_records, receiving_record_lines   a delivery as submitted, and its decision
--   * supplier_returns                            units sent back to a supplier
--   * customer_return_inspections                 customer returns waiting for, and after, inspection
--   * stock_movements                             every stock change: bucket, change, why, who asked, who approved
--   * stock_corrections                           a linked correction of one movement
--   * functions: submit_receiving_record, approve_receiving_record, reject_receiving_record,
--     cancel_receiving_record, decide_receiving_surplus, submit_supplier_return,
--     decide_supplier_return, record_customer_return, decide_customer_return,
--     correct_stock_movement
-- What it changes in existing tables, only when the owner approves something:
--   * inventory buckets (available, damaged) by the approved amounts
--   * purchase_order_items.quantity_received; purchase_orders.status becomes
--     'received' when every line is complete (and 'ordered' again if a
--     replacement reopens a completed order)
--   * inventory_adjustments gets one row per movement, so the existing history
--     screen shows it
--
-- Stock never changes on a submission; only on the owner's approval. Every
-- request carries a request key, so a retry or a double click records once;
-- approvals lock the rows they change, so simultaneous approvals cannot count
-- the same units twice or receive more than is outstanding.
--
-- Honest limits
--   * SECURITY INVOKER throughout (project rule). The owner approves; the
--     owner's own permissions on inventory and purchase orders apply.
--   * The dashboard's existing whole-order receive and whole-line return
--     (drafts/10) are not changed; switching the screens over is a later step.
--   * "Unsuitable" (opened or used) units go to the Damaged bucket: the stock
--     table has no separate bucket for them. The inspection record keeps
--     "unsuitable" as its own outcome.
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_partial_receiving_install'));

do $pre$
declare missing text[] := '{}';
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.current_role()') is null then missing := missing || 'function public.current_role()'::text; end if;
  if to_regprocedure('public.active_role()') is null then missing := missing || 'function public.active_role() (install step 0, drafts/72, first)'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regclass('public.purchase_orders') is null then missing := missing || 'table public.purchase_orders'::text; end if;
  if to_regclass('public.purchase_order_items') is null then missing := missing || 'table public.purchase_order_items'::text; end if;
  if to_regclass('public.inventory') is null then missing := missing || 'table public.inventory'::text; end if;
  if to_regclass('public.inventory_adjustments') is null then missing := missing || 'table public.inventory_adjustments'::text; end if;
  if to_regclass('public.returns') is null then missing := missing || 'table public.returns'::text; end if;
  if to_regclass('public.order_items') is null then missing := missing || 'table public.order_items'::text; end if;
  if to_regclass('public.products') is null then missing := missing || 'table public.products'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
end $pre$;

-- ---------------------------------------------------------------- tables
create table if not exists public.receiving_records (
  id               uuid primary key default gen_random_uuid(),
  request_key      uuid not null unique,
  purchase_order_id uuid not null references public.purchase_orders(id),
  status           text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'cancelled')),
  note             text check (note is null or length(note) <= 500),
  submitted_by     uuid default auth.uid(),
  submitted_at     timestamptz not null default now(),
  decided_by       uuid,
  decided_at       timestamptz,
  decision_note    text check (decision_note is null or length(decision_note) <= 500)
);

create table if not exists public.receiving_record_lines (
  id               uuid primary key default gen_random_uuid(),
  record_id        uuid not null references public.receiving_records(id),
  po_item_id       uuid not null references public.purchase_order_items(id),
  good             integer not null default 0 check (good between 0 and 1000000),
  damaged          integer not null default 0 check (damaged between 0 and 1000000),
  rejected         integer not null default 0 check (rejected between 0 and 1000000),
  rejected_reason  text check (rejected_reason is null or length(rejected_reason) <= 300),
  surplus          integer not null default 0 check (surplus between 0 and 1000000),
  surplus_status   text not null default 'none' check (surplus_status in ('none', 'waiting', 'kept', 'returned')),
  surplus_decided_by uuid,
  surplus_decided_at timestamptz,
  surplus_note     text check (surplus_note is null or length(surplus_note) <= 300),
  constraint receiving_record_lines_something check (good + damaged + rejected + surplus > 0),
  constraint receiving_record_lines_reject_reason check (rejected = 0 or (rejected_reason is not null and length(btrim(rejected_reason)) >= 5)),
  constraint receiving_record_lines_surplus_status check ((surplus = 0) = (surplus_status = 'none')),
  constraint receiving_record_lines_one_per_item unique (record_id, po_item_id)
);

create table if not exists public.supplier_returns (
  id               uuid primary key default gen_random_uuid(),
  request_key      uuid not null unique,
  po_item_id       uuid not null references public.purchase_order_items(id),
  quantity         integer not null check (quantity between 1 and 1000000),
  from_bucket      text not null check (from_bucket in ('available', 'damaged')),
  reason           text not null check (length(btrim(reason)) >= 5 and length(reason) <= 300),
  replacement_expected boolean not null default false,
  status           text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'cancelled')),
  submitted_by     uuid default auth.uid(),
  submitted_at     timestamptz not null default now(),
  decided_by       uuid,
  decided_at       timestamptz,
  decision_note    text check (decision_note is null or length(decision_note) <= 500)
);

create table if not exists public.customer_return_inspections (
  id               uuid primary key default gen_random_uuid(),
  request_key      uuid not null unique,
  return_id        uuid references public.returns(id),
  order_item_id    uuid not null references public.order_items(id),
  quantity         integer not null check (quantity between 1 and 100000),
  status           text not null default 'awaiting_inspection' check (status in ('awaiting_inspection', 'decided', 'cancelled')),
  received_by      uuid default auth.uid(),
  received_at      timestamptz not null default now(),
  opened           boolean,
  used             boolean,
  restock          integer check (restock is null or restock >= 0),
  damaged          integer check (damaged is null or damaged >= 0),
  unsuitable       integer check (unsuitable is null or unsuitable >= 0),
  decided_by       uuid,
  decided_at       timestamptz,
  decision_note    text check (decision_note is null or length(decision_note) <= 500),
  -- a decision accounts for every unit; opened or used skincare is never restocked
  constraint customer_return_decided_complete check (
    status <> 'decided' or (restock is not null and damaged is not null and unsuitable is not null
      and opened is not null and used is not null and restock + damaged + unsuitable = quantity and decided_by is not null)),
  constraint customer_return_opened_never_restocked check (restock is null or restock = 0 or (opened is false and used is false))
);

create table if not exists public.stock_movements (
  id               bigint generated always as identity primary key,
  product_id       uuid not null,
  bucket           text not null check (bucket in ('available', 'damaged')),
  change           integer not null check (change <> 0),
  reason           text not null check (length(btrim(reason)) >= 5),
  source_kind      text not null check (source_kind in ('receipt', 'surplus_kept', 'supplier_return', 'customer_return', 'correction')),
  source_id        uuid,
  po_item_id       uuid,
  corrects         bigint unique references public.stock_movements(id),
  requested_by     uuid,
  approved_by      uuid,
  at               timestamptz not null default now(),
  constraint stock_movements_correction_links check ((source_kind = 'correction') = (corrects is not null))
);
create index if not exists stock_movements_by_product on public.stock_movements (product_id, id);

create table if not exists public.stock_corrections (
  id               uuid primary key default gen_random_uuid(),
  request_key      uuid not null unique,
  movement_id      bigint not null unique references public.stock_movements(id),
  reason           text not null check (length(btrim(reason)) >= 5 and length(reason) <= 300),
  corrected_by     uuid default auth.uid(),
  corrected_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers
-- The person who decides (the name is kept for the rollback): the owner, or an administrator
-- (owner decision of Nov 24: an administrator is "almost like owner" and needs no approval from
-- the owner; changed before this draft was installed; who decided stays on every record).
create or replace function public.stock_is_owner() returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(public.active_role() in ('owner', 'administrator'), false)
$fn$;

-- Who may approve or reject a delivery or a return to the supplier, and decide a customer
-- return. Today exactly the same as stock_is_owner(): the owner or an administrator. They are
-- separate on purpose (Nov 25): the owner decided a manager approves deliveries and returns
-- too, and the optional later step drafts/66 widens ONLY these two, so corrections, surplus
-- decisions and the stock history stay with the owner and administrators.
--   stock_may_decide()            may this person decide at all (checked first, in the functions)
--   stock_can_decide(submitted)   may this person decide THIS record (checked by the guards)
create or replace function public.stock_may_decide() returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select public.stock_is_owner()
$fn$;

create or replace function public.stock_can_decide(p_submitted_by uuid) returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select public.stock_is_owner()
$fn$;

-- What is still to come on a purchase-order line (ordered - received).
create or replace function public.po_item_outstanding(p_item uuid) returns integer
language sql
stable
security invoker
set search_path = public, pg_temp
as $fn$
  select greatest(0, coalesce(quantity, 0) - coalesce(quantity_received, 0))::integer from public.purchase_order_items where id = p_item
$fn$;

-- ---------------------------------------------------------------- stock movements: written by the database only
-- A movement is checked, applied to the inventory bucket, and copied to
-- inventory_adjustments, in one step. Nobody can write, change or delete one by hand.
create or replace function public.stock_movements_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_now integer;
  v_after integer;
begin
  if tg_op <> 'INSERT' then
    raise exception 'A stock movement cannot be changed or deleted. Record a correction instead.' using errcode = '42501';
  end if;
  if pg_trigger_depth() < 2 then
    raise exception 'Stock movements are written by the database only, when the owner or an administrator approves.' using errcode = '42501';
  end if;
  new.approved_by := auth.uid();
  new.at := now();
  -- the bucket name comes from the fixed list checked above (available, damaged);
  -- the row is locked first, so two movements on one product take turns
  execute format('select %I from public.inventory where product_id = $1 for update', new.bucket) using new.product_id into v_now;
  if v_now is null then
    raise exception 'This product has no stock row yet; add it on the Inventory page first.' using errcode = 'P0002';
  end if;
  if v_now + new.change < 0 then
    raise exception 'Only % unit(s) are in % stock; this would take it below zero. Nothing was changed.', v_now, new.bucket using errcode = '22023';
  end if;
  execute format('update public.inventory set %1$I = %1$I + $1, updated_at = now(), updated_by = $2 where product_id = $3 returning %1$I', new.bucket)
    using new.change, auth.uid(), new.product_id into v_after;
  insert into public.inventory_adjustments (product_id, bucket, change_amount, reason, adjusted_by)
    values (new.product_id, new.bucket, new.change, left(new.reason, 500), auth.uid());
  return new;
end
$fn$;

drop trigger if exists stock_movements_guard on public.stock_movements;
create trigger stock_movements_guard before insert or update or delete on public.stock_movements
  for each row execute function public.stock_movements_guard();

-- ---------------------------------------------------------------- receiving: submission
create or replace function public.receiving_records_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'A receiving record stays on the record; cancel it instead.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'submitted' then
      raise exception 'A receiving record starts as submitted; the owner or an administrator approves it.' using errcode = '22023';
    end if;
    new.submitted_by := auth.uid(); new.submitted_at := now();
    new.decided_by := null; new.decided_at := null; new.decision_note := null;
    return new;
  end if;
  if new.request_key is distinct from old.request_key or new.purchase_order_id is distinct from old.purchase_order_id
     or new.submitted_by is distinct from old.submitted_by or new.submitted_at is distinct from old.submitted_at or new.note is distinct from old.note then
    raise exception 'What was submitted cannot be changed; cancel it and submit again.' using errcode = '22023';
  end if;
  if new.status = old.status then
    if new.decided_by is distinct from old.decided_by or new.decided_at is distinct from old.decided_at or new.decision_note is distinct from old.decision_note then
      raise exception 'A decision is recorded once.' using errcode = '22023';
    end if;
    return new;
  end if;
  if old.status <> 'submitted' then
    raise exception 'This receiving record was already %.', old.status using errcode = '22023';
  end if;
  if new.status in ('approved', 'rejected') then
    if not public.stock_can_decide(old.submitted_by) then
      raise exception 'Only the owner or an administrator can approve or reject a delivery.' using errcode = '42501';
    end if;
    if new.status = 'rejected' and (new.decision_note is null or length(btrim(new.decision_note)) < 5) then
      raise exception 'Say why the delivery record is rejected.' using errcode = '22023';
    end if;
  elsif new.status = 'cancelled' then
    if not (old.submitted_by = auth.uid() or public.stock_is_owner()) then
      raise exception 'Only the person who submitted it, or the owner, can cancel it.' using errcode = '42501';
    end if;
  end if;
  new.decided_by := auth.uid(); new.decided_at := now();
  return new;
end
$fn$;

drop trigger if exists receiving_records_guard on public.receiving_records;
create trigger receiving_records_guard before insert or update or delete on public.receiving_records
  for each row execute function public.receiving_records_guard();

create or replace function public.receiving_record_lines_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_rec public.receiving_records%rowtype;
  v_po uuid;
  v_out integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'A receiving line stays on the record.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    -- only the owner's surplus decision may change a line, and only once
    if new.good is distinct from old.good or new.damaged is distinct from old.damaged or new.rejected is distinct from old.rejected
       or new.surplus is distinct from old.surplus or new.rejected_reason is distinct from old.rejected_reason
       or new.record_id is distinct from old.record_id or new.po_item_id is distinct from old.po_item_id then
      raise exception 'What was submitted cannot be changed.' using errcode = '22023';
    end if;
    if new.surplus_status is distinct from old.surplus_status then
      if not public.stock_is_owner() then
        raise exception 'Only the owner or an administrator decides about a surplus.' using errcode = '42501';
      end if;
      if old.surplus_status <> 'waiting' or new.surplus_status not in ('kept', 'returned') then
        raise exception 'The surplus was already decided (%).', old.surplus_status using errcode = '22023';
      end if;
      select * into v_rec from public.receiving_records where id = new.record_id;
      if v_rec.status <> 'approved' then
        raise exception 'Decide the surplus after the delivery itself has been approved.' using errcode = '22023';
      end if;
      new.surplus_decided_by := auth.uid(); new.surplus_decided_at := now();
    elsif new.surplus_decided_by is distinct from old.surplus_decided_by or new.surplus_decided_at is distinct from old.surplus_decided_at then
      raise exception 'A surplus decision is recorded by the database.' using errcode = '22023';
    end if;
    return new;
  end if;
  select * into v_rec from public.receiving_records where id = new.record_id;
  if not found or v_rec.status <> 'submitted' then
    raise exception 'Lines can only be added to a receiving record that is still submitted.' using errcode = '22023';
  end if;
  if v_rec.submitted_by is distinct from auth.uid() then
    raise exception 'Only the person who submitted the record adds its lines.' using errcode = '42501';
  end if;
  select purchase_order_id into v_po from public.purchase_order_items where id = new.po_item_id;
  if v_po is distinct from v_rec.purchase_order_id then
    raise exception 'That line is not on this purchase order.' using errcode = '22023';
  end if;
  v_out := public.po_item_outstanding(new.po_item_id);
  if new.good + new.damaged > v_out then
    raise exception 'Only % unit(s) are still to come on that line; enter the rest as surplus for the owner or an administrator to review.', v_out using errcode = '22023';
  end if;
  if new.surplus > 0 and new.good + new.damaged < v_out then
    raise exception 'Surplus is what arrived beyond the % unit(s) still to come.', v_out using errcode = '22023';
  end if;
  new.surplus_status := case when new.surplus > 0 then 'waiting' else 'none' end;
  new.surplus_decided_by := null; new.surplus_decided_at := null; new.surplus_note := null;
  return new;
end
$fn$;

drop trigger if exists receiving_record_lines_guard on public.receiving_record_lines;
create trigger receiving_record_lines_guard before insert or update or delete on public.receiving_record_lines
  for each row execute function public.receiving_record_lines_guard();

-- ---------------------------------------------------------------- receiving: the owner's approval moves stock
create or replace function public.receiving_records_apply() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_line record;
  v_out integer;
  v_lines integer := 0;
  v_po_done boolean;
begin
  if not (old.status = 'submitted' and new.status = 'approved') then
    return null;
  end if;
  -- lock the order's lines, so two approvals cannot receive the same units twice
  perform 1 from public.purchase_order_items where purchase_order_id = new.purchase_order_id order by id for update;
  for v_line in
    select l.*, i.product_id, i.quantity as ordered from public.receiving_record_lines l
      join public.purchase_order_items i on i.id = l.po_item_id where l.record_id = new.id order by l.po_item_id
  loop
    v_lines := v_lines + 1;
    v_out := public.po_item_outstanding(v_line.po_item_id);
    if v_line.good + v_line.damaged > v_out then
      raise exception 'Not approved: only % unit(s) are still to come on a line of this order (another delivery was approved meanwhile). Nothing was changed.', v_out using errcode = '22023';
    end if;
    if v_line.good + v_line.damaged > 0 then
      update public.purchase_order_items set quantity_received = coalesce(quantity_received, 0) + v_line.good + v_line.damaged where id = v_line.po_item_id;
    end if;
    if v_line.good > 0 then
      insert into public.stock_movements (product_id, bucket, change, reason, source_kind, source_id, po_item_id, requested_by)
        values (v_line.product_id, 'available', v_line.good, 'Delivery received (good)', 'receipt', new.id, v_line.po_item_id, new.submitted_by);
    end if;
    if v_line.damaged > 0 then
      insert into public.stock_movements (product_id, bucket, change, reason, source_kind, source_id, po_item_id, requested_by)
        values (v_line.product_id, 'damaged', v_line.damaged, 'Delivery received damaged (kept)', 'receipt', new.id, v_line.po_item_id, new.submitted_by);
    end if;
  end loop;
  if v_lines = 0 then
    raise exception 'Not approved: this receiving record has no lines.' using errcode = '22023';
  end if;
  select bool_and(coalesce(quantity_received, 0) >= quantity) into v_po_done from public.purchase_order_items where purchase_order_id = new.purchase_order_id;
  if v_po_done then
    update public.purchase_orders set status = 'received', received_at = coalesce(received_at, now()), received_by = coalesce(received_by, auth.uid()), updated_at = now()
     where id = new.purchase_order_id and status in ('ordered', 'shipped');
  end if;
  return null;
end
$fn$;

drop trigger if exists receiving_records_apply on public.receiving_records;
create trigger receiving_records_apply after update on public.receiving_records
  for each row execute function public.receiving_records_apply();

-- the owner keeps a surplus: it goes into Available stock (returned: nothing moves)
create or replace function public.receiving_surplus_apply() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_product uuid;
  v_by uuid;
begin
  if old.surplus_status = 'waiting' and new.surplus_status = 'kept' then
    select i.product_id into v_product from public.purchase_order_items i where i.id = new.po_item_id;
    select submitted_by into v_by from public.receiving_records where id = new.record_id;
    insert into public.stock_movements (product_id, bucket, change, reason, source_kind, source_id, po_item_id, requested_by)
      values (v_product, 'available', new.surplus, 'Surplus delivery kept by the owner' || coalesce(': ' || new.surplus_note, ''), 'surplus_kept', new.record_id, new.po_item_id, v_by);
  end if;
  return null;
end
$fn$;

drop trigger if exists receiving_surplus_apply on public.receiving_record_lines;
create trigger receiving_surplus_apply after update on public.receiving_record_lines
  for each row execute function public.receiving_surplus_apply();

-- ---------------------------------------------------------------- returns to the supplier
create or replace function public.supplier_returns_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_kept integer;
  v_item record;
begin
  if tg_op = 'DELETE' then
    raise exception 'A supplier return stays on the record; cancel it instead.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'submitted' then
      raise exception 'A supplier return starts as submitted; the owner or an administrator approves it.' using errcode = '22023';
    end if;
    new.submitted_by := auth.uid(); new.submitted_at := now();
    new.decided_by := null; new.decided_at := null; new.decision_note := null;
    return new;
  end if;
  if new.request_key is distinct from old.request_key or new.po_item_id is distinct from old.po_item_id or new.quantity is distinct from old.quantity
     or new.from_bucket is distinct from old.from_bucket or new.reason is distinct from old.reason
     or new.replacement_expected is distinct from old.replacement_expected or new.submitted_by is distinct from old.submitted_by then
    raise exception 'What was submitted cannot be changed; cancel it and submit again.' using errcode = '22023';
  end if;
  if new.status = old.status then return new; end if;
  if old.status <> 'submitted' then
    raise exception 'This supplier return was already %.', old.status using errcode = '22023';
  end if;
  if new.status in ('approved', 'rejected') and not public.stock_can_decide(old.submitted_by) then
    raise exception 'Only the owner or an administrator can approve or reject a return to the supplier.' using errcode = '42501';
  end if;
  if new.status = 'cancelled' and not (old.submitted_by = auth.uid() or public.stock_is_owner()) then
    raise exception 'Only the person who submitted it, or the owner, can cancel it.' using errcode = '42501';
  end if;
  if new.status = 'approved' then
    select * into v_item from public.purchase_order_items where id = new.po_item_id for update;
    -- received and kept on that line = received - what already went back without a replacement
    select coalesce(v_item.quantity_received, 0) - coalesce(sum(quantity), 0) into v_kept
      from public.supplier_returns where po_item_id = new.po_item_id and status = 'approved' and not replacement_expected and id <> new.id;
    if new.quantity > v_kept then
      raise exception 'Only % unit(s) received on that line can still go back to the supplier.', v_kept using errcode = '22023';
    end if;
  end if;
  new.decided_by := auth.uid(); new.decided_at := now();
  return new;
end
$fn$;

drop trigger if exists supplier_returns_guard on public.supplier_returns;
create trigger supplier_returns_guard before insert or update or delete on public.supplier_returns
  for each row execute function public.supplier_returns_guard();

create or replace function public.supplier_returns_apply() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_item record;
begin
  if not (old.status = 'submitted' and new.status = 'approved') then return null; end if;
  select * into v_item from public.purchase_order_items where id = new.po_item_id;
  insert into public.stock_movements (product_id, bucket, change, reason, source_kind, source_id, po_item_id, requested_by)
    values (v_item.product_id, new.from_bucket, -new.quantity,
            'Returned to the supplier' || case when new.replacement_expected then ' (replacement expected)' else '' end || ': ' || new.reason,
            'supplier_return', new.id, new.po_item_id, new.submitted_by);
  -- a replacement is expected: those units are outstanding again
  if new.replacement_expected then
    update public.purchase_order_items set quantity_received = coalesce(quantity_received, 0) - new.quantity where id = new.po_item_id;
    update public.purchase_orders set status = 'ordered', updated_at = now() where id = v_item.purchase_order_id and status = 'received';
  end if;
  return null;
end
$fn$;

drop trigger if exists supplier_returns_apply on public.supplier_returns;
create trigger supplier_returns_apply after update on public.supplier_returns
  for each row execute function public.supplier_returns_apply();

-- ---------------------------------------------------------------- customer returns: inspection first
create or replace function public.customer_return_inspections_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_sold integer;
  v_back integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'A customer return stays on the record; cancel it instead.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'awaiting_inspection';
    new.received_by := auth.uid(); new.received_at := now();
    new.opened := null; new.used := null; new.restock := null; new.damaged := null; new.unsuitable := null;
    new.decided_by := null; new.decided_at := null; new.decision_note := null;
    -- never more back than was sold and not yet returned on that order line
    -- one return at a time per order line (a lock that needs no edit right on order_items)
    perform pg_advisory_xact_lock(hashtext('customer_return:' || new.order_item_id::text));
    select quantity into v_sold from public.order_items where id = new.order_item_id;
    select coalesce(sum(quantity), 0) into v_back from public.customer_return_inspections where order_item_id = new.order_item_id and status <> 'cancelled';
    if new.quantity > coalesce(v_sold, 0) - v_back then
      raise exception 'Only % unit(s) of that order line have not been returned yet.', greatest(coalesce(v_sold, 0) - v_back, 0) using errcode = '22023';
    end if;
    return new;
  end if;
  if new.request_key is distinct from old.request_key or new.order_item_id is distinct from old.order_item_id or new.quantity is distinct from old.quantity
     or new.return_id is distinct from old.return_id or new.received_by is distinct from old.received_by or new.received_at is distinct from old.received_at then
    raise exception 'What was received cannot be changed; cancel it and record it again.' using errcode = '22023';
  end if;
  if old.status <> 'awaiting_inspection' then
    raise exception 'This customer return was already %.', old.status using errcode = '22023';
  end if;
  if new.status = 'decided' then
    if not public.stock_can_decide(old.received_by) then
      raise exception 'Only the owner or an administrator decides what happens to returned units.' using errcode = '42501';
    end if;
  elsif new.status = 'cancelled' then
    if not (old.received_by = auth.uid() or public.stock_is_owner()) then
      raise exception 'Only the person who recorded it, or the owner, can cancel it.' using errcode = '42501';
    end if;
  else
    raise exception 'A customer return waits for inspection until the owner or an administrator decides.' using errcode = '22023';
  end if;
  new.decided_by := auth.uid(); new.decided_at := now();
  return new;
end
$fn$;

drop trigger if exists customer_return_inspections_guard on public.customer_return_inspections;
create trigger customer_return_inspections_guard before insert or update or delete on public.customer_return_inspections
  for each row execute function public.customer_return_inspections_guard();

create or replace function public.customer_return_inspections_apply() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_product uuid;
  v_sku text;
begin
  if not (old.status = 'awaiting_inspection' and new.status = 'decided') then return null; end if;
  -- drafts/76 (if installed): a line already given back as a cancelled order cannot also come
  -- back as a return, or its bottles would be counted twice. The same per-order lock as drafts/76,
  -- so a give-back and this decision never pass each other unseen.
  if to_regclass('public.order_stock_moves') is not null then
    perform pg_advisory_xact_lock(hashtext('health_endeavors_order_stock:' || (select oi.order_id::text from public.order_items oi where oi.id = new.order_item_id)));
    if exists (select 1 from public.order_stock_moves m where m.order_item_id = new.order_item_id and m.kind = 'give_back') then
      raise exception 'That order line was already given back to stock when its order was cancelled; nothing was changed. Cancel this return instead.' using errcode = '23514';
    end if;
  end if;
  select oi.sku into v_sku from public.order_items oi where oi.id = new.order_item_id;
  select p.id into v_product from public.products p where lower(p.sku) = lower(v_sku);
  if v_product is null and new.restock + new.damaged + new.unsuitable > 0 then
    raise exception 'No product with the SKU % on that order line; nothing was changed.', coalesce(v_sku, '(none)') using errcode = 'P0002';
  end if;
  if new.restock > 0 then
    insert into public.stock_movements (product_id, bucket, change, reason, source_kind, source_id, requested_by)
      values (v_product, 'available', new.restock, 'Customer return inspected: sellable, restocked', 'customer_return', new.id, new.received_by);
  end if;
  if new.damaged > 0 then
    insert into public.stock_movements (product_id, bucket, change, reason, source_kind, source_id, requested_by)
      values (v_product, 'damaged', new.damaged, 'Customer return inspected: damaged', 'customer_return', new.id, new.received_by);
  end if;
  if new.unsuitable > 0 then
    insert into public.stock_movements (product_id, bucket, change, reason, source_kind, source_id, requested_by)
      values (v_product, 'damaged', new.unsuitable, 'Customer return inspected: unsuitable (opened or used), never resold', 'customer_return', new.id, new.received_by);
  end if;
  return null;
end
$fn$;

drop trigger if exists customer_return_inspections_apply on public.customer_return_inspections;
create trigger customer_return_inspections_apply after update on public.customer_return_inspections
  for each row execute function public.customer_return_inspections_apply();

-- ---------------------------------------------------------------- corrections: linked, with reason and approver
create or replace function public.stock_corrections_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op <> 'INSERT' then
    raise exception 'A correction stays on the record.' using errcode = '42501';
  end if;
  if not public.stock_is_owner() then
    raise exception 'Only the owner or an administrator can correct a stock movement.' using errcode = '42501';
  end if;
  if exists (select 1 from public.stock_movements where id = new.movement_id and source_kind = 'correction') then
    raise exception 'A correction is not corrected again; correct the original movement only once, then submit the right figure.' using errcode = '22023';
  end if;
  new.corrected_by := auth.uid(); new.corrected_at := now();
  return new;
end
$fn$;

drop trigger if exists stock_corrections_guard on public.stock_corrections;
create trigger stock_corrections_guard before insert or update or delete on public.stock_corrections
  for each row execute function public.stock_corrections_guard();

create or replace function public.stock_corrections_apply() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_m public.stock_movements%rowtype;
begin
  -- (a movement can be corrected only once: stock_corrections.movement_id is unique)
  select * into v_m from public.stock_movements where id = new.movement_id;
  insert into public.stock_movements (product_id, bucket, change, reason, source_kind, source_id, po_item_id, corrects, requested_by)
    values (v_m.product_id, v_m.bucket, -v_m.change, 'Correction of movement ' || v_m.id || ': ' || new.reason, 'correction', new.id, v_m.po_item_id, v_m.id, auth.uid());
  -- a corrected delivery is no longer received on its purchase-order line
  if v_m.source_kind = 'receipt' and v_m.po_item_id is not null then
    update public.purchase_order_items set quantity_received = coalesce(quantity_received, 0) - v_m.change where id = v_m.po_item_id;
    update public.purchase_orders set status = 'ordered', updated_at = now()
     where id = (select purchase_order_id from public.purchase_order_items where id = v_m.po_item_id) and status = 'received';
  end if;
  return null;
end
$fn$;

drop trigger if exists stock_corrections_apply on public.stock_corrections;
create trigger stock_corrections_apply after insert on public.stock_corrections
  for each row execute function public.stock_corrections_apply();

-- ---------------------------------------------------------------- functions the page calls
-- Submit a delivery: p_lines = [{"po_item_id": "...", "good": 8, "damaged": 0, "rejected": 0,
-- "rejected_reason": null, "surplus": 0}]. Sent again with the same key: nothing more is recorded.
create or replace function public.submit_receiving_record(p_request_key uuid, p_purchase_order_id uuid, p_lines jsonb, p_note text default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.receiving_records%rowtype;
  v_line jsonb;
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can submit a delivery.' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required, so that a retry cannot submit twice.' using errcode = '22023';
  end if;
  select * into v from public.receiving_records where request_key = p_request_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v.id, 'status', v.status);
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A delivery needs at least one line.' using errcode = '22023';
  end if;
  insert into public.receiving_records (request_key, purchase_order_id, note) values (p_request_key, p_purchase_order_id, nullif(btrim(p_note), '')) returning * into v;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    insert into public.receiving_record_lines (record_id, po_item_id, good, damaged, rejected, rejected_reason, surplus)
      values (v.id, (v_line->>'po_item_id')::uuid, coalesce((v_line->>'good')::integer, 0), coalesce((v_line->>'damaged')::integer, 0),
              coalesce((v_line->>'rejected')::integer, 0), nullif(btrim(v_line->>'rejected_reason'), ''), coalesce((v_line->>'surplus')::integer, 0));
  end loop;
  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v.id, 'status', v.status);
end
$fn$;

create or replace function public.approve_receiving_record(p_id uuid, p_note text default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.receiving_records%rowtype;
begin
  if not public.stock_may_decide() then
    raise exception 'Only the owner or an administrator can approve or reject a delivery.' using errcode = '42501';
  end if;
  select * into v from public.receiving_records where id = p_id for update;
  if not found then raise exception 'No such receiving record.' using errcode = 'P0002'; end if;
  if v.status <> 'submitted' then
    return jsonb_build_object('ok', v.status = 'approved', 'already_decided', true, 'status', v.status);
  end if;
  update public.receiving_records set status = 'approved', decision_note = nullif(btrim(p_note), '') where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'status', v.status);
end
$fn$;

create or replace function public.reject_receiving_record(p_id uuid, p_reason text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.receiving_records%rowtype;
begin
  if not public.stock_may_decide() then
    raise exception 'Only the owner or an administrator can approve or reject a delivery.' using errcode = '42501';
  end if;
  select * into v from public.receiving_records where id = p_id for update;
  if not found then raise exception 'No such receiving record.' using errcode = 'P0002'; end if;
  if v.status <> 'submitted' then
    return jsonb_build_object('ok', v.status = 'rejected', 'already_decided', true, 'status', v.status);
  end if;
  update public.receiving_records set status = 'rejected', decision_note = btrim(p_reason) where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'status', v.status);
end
$fn$;

create or replace function public.cancel_receiving_record(p_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.receiving_records%rowtype;
begin
  select * into v from public.receiving_records where id = p_id for update;
  if not found then raise exception 'No such receiving record.' using errcode = 'P0002'; end if;
  if v.status <> 'submitted' then
    return jsonb_build_object('ok', v.status = 'cancelled', 'already_decided', true, 'status', v.status);
  end if;
  update public.receiving_records set status = 'cancelled' where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'status', v.status);
end
$fn$;

create or replace function public.decide_receiving_surplus(p_line_id uuid, p_decision text, p_note text default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.receiving_record_lines%rowtype;
begin
  if not public.stock_is_owner() then
    raise exception 'Only the owner or an administrator decides about a surplus.' using errcode = '42501';
  end if;
  if p_decision not in ('kept', 'returned') then
    raise exception 'A surplus is either kept or returned.' using errcode = '22023';
  end if;
  select * into v from public.receiving_record_lines where id = p_line_id for update;
  if not found then raise exception 'No such receiving line.' using errcode = 'P0002'; end if;
  if v.surplus_status <> 'waiting' then
    return jsonb_build_object('ok', v.surplus_status = p_decision, 'already_decided', true, 'surplus_status', v.surplus_status);
  end if;
  update public.receiving_record_lines set surplus_status = p_decision, surplus_note = nullif(btrim(p_note), '') where id = p_line_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'surplus_status', v.surplus_status);
end
$fn$;

create or replace function public.submit_supplier_return(p_request_key uuid, p_po_item_id uuid, p_quantity integer, p_from_bucket text, p_reason text, p_replacement_expected boolean default false) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.supplier_returns%rowtype;
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can submit a return to the supplier.' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required, so that a retry cannot submit twice.' using errcode = '22023';
  end if;
  select * into v from public.supplier_returns where request_key = p_request_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v.id, 'status', v.status);
  end if;
  insert into public.supplier_returns (request_key, po_item_id, quantity, from_bucket, reason, replacement_expected)
    values (p_request_key, p_po_item_id, p_quantity, p_from_bucket, btrim(p_reason), coalesce(p_replacement_expected, false)) returning * into v;
  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v.id, 'status', v.status);
end
$fn$;

create or replace function public.decide_supplier_return(p_id uuid, p_decision text, p_note text default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.supplier_returns%rowtype;
begin
  if not public.stock_may_decide() then
    raise exception 'Only the owner or an administrator can approve or reject a return to the supplier.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'A return to the supplier is approved or rejected.' using errcode = '22023';
  end if;
  select * into v from public.supplier_returns where id = p_id for update;
  if not found then raise exception 'No such supplier return.' using errcode = 'P0002'; end if;
  if v.status <> 'submitted' then
    return jsonb_build_object('ok', v.status = p_decision, 'already_decided', true, 'status', v.status);
  end if;
  update public.supplier_returns set status = p_decision, decision_note = nullif(btrim(p_note), '') where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'status', v.status);
end
$fn$;

create or replace function public.record_customer_return(p_request_key uuid, p_order_item_id uuid, p_quantity integer, p_return_id uuid default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.customer_return_inspections%rowtype;
begin
  if not public.is_active_staff() then
    raise exception 'Only active staff can record a customer return.' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required, so that a retry cannot record twice.' using errcode = '22023';
  end if;
  select * into v from public.customer_return_inspections where request_key = p_request_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v.id, 'status', v.status);
  end if;
  insert into public.customer_return_inspections (request_key, order_item_id, quantity, return_id)
    values (p_request_key, p_order_item_id, p_quantity, p_return_id) returning * into v;
  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v.id, 'status', v.status);
end
$fn$;

create or replace function public.decide_customer_return(p_id uuid, p_restock integer, p_damaged integer, p_unsuitable integer,
  p_opened boolean, p_used boolean, p_note text default null) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.customer_return_inspections%rowtype;
begin
  if not public.stock_may_decide() then
    raise exception 'Only the owner or an administrator decides what happens to returned units.' using errcode = '42501';
  end if;
  if p_opened is null or p_used is null then
    raise exception 'Say whether the product was opened and whether it was used.' using errcode = '22023';
  end if;
  if coalesce(p_restock, 0) > 0 and (p_opened or p_used) then
    raise exception 'Opened or used skincare cannot be restocked; record it as unsuitable or damaged.' using errcode = '22023';
  end if;
  select * into v from public.customer_return_inspections where id = p_id for update;
  if not found then raise exception 'No such customer return.' using errcode = 'P0002'; end if;
  if v.status <> 'awaiting_inspection' then
    return jsonb_build_object('ok', v.status = 'decided', 'already_decided', true, 'status', v.status);
  end if;
  if coalesce(p_restock, 0) + coalesce(p_damaged, 0) + coalesce(p_unsuitable, 0) <> v.quantity then
    raise exception 'Every returned unit needs an outcome: % unit(s) came back.', v.quantity using errcode = '22023';
  end if;
  update public.customer_return_inspections
     set status = 'decided', restock = coalesce(p_restock, 0), damaged = coalesce(p_damaged, 0), unsuitable = coalesce(p_unsuitable, 0),
         opened = p_opened, used = p_used, decision_note = nullif(btrim(p_note), '')
   where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'already_decided', false, 'status', v.status);
end
$fn$;

create or replace function public.correct_stock_movement(p_request_key uuid, p_movement_id bigint, p_reason text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v public.stock_corrections%rowtype;
  v_new bigint;
begin
  if not public.stock_is_owner() then
    raise exception 'Only the owner or an administrator can correct a stock movement.' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required, so that a retry cannot correct twice.' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'Say why the movement is corrected.' using errcode = '22023';
  end if;
  select * into v from public.stock_corrections where request_key = p_request_key;
  if found then
    select id into v_new from public.stock_movements where corrects = v.movement_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'correction_movement', v_new);
  end if;
  if exists (select 1 from public.stock_corrections where movement_id = p_movement_id) then
    raise exception 'That movement has already been corrected.' using errcode = '22023';
  end if;
  insert into public.stock_corrections (request_key, movement_id, reason) values (p_request_key, p_movement_id, btrim(p_reason)) returning * into v;
  select id into v_new from public.stock_movements where corrects = p_movement_id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'correction_movement', v_new);
end
$fn$;

-- ---------------------------------------------------------------- permissions
alter table public.receiving_records enable row level security;
alter table public.receiving_record_lines enable row level security;
alter table public.supplier_returns enable row level security;
alter table public.customer_return_inspections enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_corrections enable row level security;
revoke all on public.receiving_records, public.receiving_record_lines, public.supplier_returns, public.customer_return_inspections,
  public.stock_movements, public.stock_corrections from public, anon;
grant select, insert, update on public.receiving_records, public.receiving_record_lines, public.supplier_returns, public.customer_return_inspections to authenticated;
grant select, insert on public.stock_movements, public.stock_corrections to authenticated;

-- staff submit for purchase orders they can see (the purchase orders' own rules decide)
drop policy if exists receiving_records_read on public.receiving_records;
create policy receiving_records_read on public.receiving_records for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin());
drop policy if exists receiving_records_submit on public.receiving_records;
create policy receiving_records_submit on public.receiving_records for insert to authenticated with check (public.is_active_staff() and status = 'submitted' and exists (select 1 from public.purchase_orders po where po.id = receiving_records.purchase_order_id));
drop policy if exists receiving_records_decide on public.receiving_records;
create policy receiving_records_decide on public.receiving_records for update to authenticated using (submitted_by = auth.uid() or public.stock_is_owner()) with check (submitted_by = auth.uid() or public.stock_is_owner());
drop policy if exists receiving_record_lines_read on public.receiving_record_lines;
create policy receiving_record_lines_read on public.receiving_record_lines for select to authenticated using (exists (select 1 from public.receiving_records r where r.id = receiving_record_lines.record_id));
drop policy if exists receiving_record_lines_add on public.receiving_record_lines;
create policy receiving_record_lines_add on public.receiving_record_lines for insert to authenticated with check (public.is_active_staff() and exists (select 1 from public.receiving_records r where r.id = receiving_record_lines.record_id));
drop policy if exists receiving_record_lines_surplus on public.receiving_record_lines;
create policy receiving_record_lines_surplus on public.receiving_record_lines for update to authenticated using (public.stock_is_owner()) with check (public.stock_is_owner());
drop policy if exists supplier_returns_read on public.supplier_returns;
create policy supplier_returns_read on public.supplier_returns for select to authenticated using (submitted_by = auth.uid() or public.is_owner_or_admin());
drop policy if exists supplier_returns_submit on public.supplier_returns;
create policy supplier_returns_submit on public.supplier_returns for insert to authenticated with check (public.is_active_staff() and status = 'submitted' and exists (select 1 from public.purchase_order_items i where i.id = supplier_returns.po_item_id));
drop policy if exists supplier_returns_decide on public.supplier_returns;
create policy supplier_returns_decide on public.supplier_returns for update to authenticated using (submitted_by = auth.uid() or public.stock_is_owner()) with check (submitted_by = auth.uid() or public.stock_is_owner());
drop policy if exists customer_return_inspections_read on public.customer_return_inspections;
create policy customer_return_inspections_read on public.customer_return_inspections for select to authenticated using (public.is_active_staff());
drop policy if exists customer_return_inspections_record on public.customer_return_inspections;
create policy customer_return_inspections_record on public.customer_return_inspections for insert to authenticated with check (public.is_active_staff() and status = 'awaiting_inspection');
drop policy if exists customer_return_inspections_decide on public.customer_return_inspections;
create policy customer_return_inspections_decide on public.customer_return_inspections for update to authenticated using (received_by = auth.uid() or public.stock_is_owner()) with check (received_by = auth.uid() or public.stock_is_owner());
drop policy if exists stock_movements_read on public.stock_movements;
create policy stock_movements_read on public.stock_movements for select to authenticated using (public.is_owner_or_admin());
drop policy if exists stock_movements_trigger_insert on public.stock_movements;
create policy stock_movements_trigger_insert on public.stock_movements for insert to authenticated with check (public.is_active_staff());
drop policy if exists stock_corrections_read on public.stock_corrections;
create policy stock_corrections_read on public.stock_corrections for select to authenticated using (public.is_owner_or_admin());
drop policy if exists stock_corrections_owner on public.stock_corrections;
create policy stock_corrections_owner on public.stock_corrections for insert to authenticated with check (public.stock_is_owner());

revoke all on function public.stock_is_owner() from public, anon;
revoke all on function public.stock_may_decide() from public, anon;
revoke all on function public.stock_can_decide(uuid) from public, anon;
revoke all on function public.po_item_outstanding(uuid) from public, anon;
revoke all on function public.stock_movements_guard() from public, anon;
revoke all on function public.receiving_records_guard() from public, anon;
revoke all on function public.receiving_record_lines_guard() from public, anon;
revoke all on function public.receiving_records_apply() from public, anon;
revoke all on function public.receiving_surplus_apply() from public, anon;
revoke all on function public.supplier_returns_guard() from public, anon;
revoke all on function public.supplier_returns_apply() from public, anon;
revoke all on function public.customer_return_inspections_guard() from public, anon;
revoke all on function public.customer_return_inspections_apply() from public, anon;
revoke all on function public.stock_corrections_guard() from public, anon;
revoke all on function public.stock_corrections_apply() from public, anon;
revoke all on function public.submit_receiving_record(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.approve_receiving_record(uuid, text) from public, anon;
revoke all on function public.reject_receiving_record(uuid, text) from public, anon;
revoke all on function public.cancel_receiving_record(uuid) from public, anon;
revoke all on function public.decide_receiving_surplus(uuid, text, text) from public, anon;
revoke all on function public.submit_supplier_return(uuid, uuid, integer, text, text, boolean) from public, anon;
revoke all on function public.decide_supplier_return(uuid, text, text) from public, anon;
revoke all on function public.record_customer_return(uuid, uuid, integer, uuid) from public, anon;
revoke all on function public.decide_customer_return(uuid, integer, integer, integer, boolean, boolean, text) from public, anon;
revoke all on function public.correct_stock_movement(uuid, bigint, text) from public, anon;
grant execute on function public.stock_is_owner() to authenticated;
grant execute on function public.stock_may_decide() to authenticated;
grant execute on function public.stock_can_decide(uuid) to authenticated;
grant execute on function public.po_item_outstanding(uuid) to authenticated;
grant execute on function public.submit_receiving_record(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.approve_receiving_record(uuid, text) to authenticated;
grant execute on function public.reject_receiving_record(uuid, text) to authenticated;
grant execute on function public.cancel_receiving_record(uuid) to authenticated;
grant execute on function public.decide_receiving_surplus(uuid, text, text) to authenticated;
grant execute on function public.submit_supplier_return(uuid, uuid, integer, text, text, boolean) to authenticated;
grant execute on function public.decide_supplier_return(uuid, text, text) to authenticated;
grant execute on function public.record_customer_return(uuid, uuid, integer, uuid) to authenticated;
grant execute on function public.decide_customer_return(uuid, integer, integer, integer, boolean, boolean, text) to authenticated;
grant execute on function public.correct_stock_movement(uuid, bigint, text) to authenticated;

commit;
