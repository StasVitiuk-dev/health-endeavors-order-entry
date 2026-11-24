-- DRAFT (2026-11-24). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   54   (PRODUCTION-CHANGE-DRAFT, step optional (owner decision of Nov 24: the batch is on a printed sticker; scanning it when packing keeps which batch went into which order, so a batch problem gives one list of orders))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops, changing nothing, if an order_batches table or a function with one of this draft's names exists that this file did not create (it checks its own marks); stops if auth.uid(), is_active_staff(), is_owner_or_admin(), the orders, inventory_lots (with id, lot_number, product_id), products, tasks or audit_log table, or the audit trigger on tasks is missing
-- @effect:      1 new table order_batches (one live row per order and batch: the order, the batch number as scanned, the matching batch in stock and its product when exactly one is visible, how many bottles, who and when; void fields); record_order_batch() adds bottles (the same batch on the same order adds to its count) and answers whether the number matched stock (one, none, several, or unchecked where the person may not read stock batches); void_order_batch() marks a wrong scan void with a reason (owner and administrators, once); nothing is deleted
-- @postcheck:   the table present and empty; anon cannot read it; local-test/order_batches_test.sh passes on a throwaway copy
-- @rollback:    drafts/55
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 55_DRAFT_rollback_order_batches.sql.
-- Tested only on the local throwaway database (local-test/order_batches_test.sh).
--
-- Why (owner, Nov 24): the barcode printed on a bottle says which product it is,
-- not which batch, so each bottle gets a batch sticker (PR #57). This step keeps,
-- for every order, WHICH BATCH went into the parcel, by scanning that sticker when
-- packing. With it, a problem with one batch gives one list: every order (and so
-- every customer) that got it. That list is the heart of a recall.
--   * order_batches   one row per order and batch: the order, the batch number as
--     it was read from the sticker, the matching batch in stock when there is
--     exactly one (and its product), how many bottles, who recorded it and when.
--     A wrong scan is never deleted: the owner or an administrator marks it
--     "void" with a reason, and it stays on the record.
--   * record_order_batch(order, batch number, how many, source)   one bottle or
--     several. The same batch on the same order again adds to its count. A batch
--     number that matches nothing in stock is still kept (it is what was on the
--     bottle) and the answer says so, so the screen can warn. Where the person
--     packing may not read the batches in stock, the answer says "unchecked"
--     instead, and the link is filled in the next time someone who can see the
--     batch records it.
--   * void_order_batch(row, reason)   owner and administrators only, once.
--
-- Who can see and do what: every active team member (packing is staff work),
-- administrators and the owner read these rows and record batches; only the owner
-- and administrators void. A deactivated account and visitors nothing. Nothing is
-- deleted. SECURITY INVOKER throughout (project rule). Production's own audit
-- trigger (the one on `tasks`) is attached, so every change also lands in
-- audit_log with who and when.
--
-- Honest limits
--   * It records what the packer scanned. It does not lower stock per batch and
--     does not check that the batch still has bottles left.
--   * Whether packers (employees) may read `inventory_lots` in production is not
--     known. In the local copy only the owner and administrators can, so a
--     packer's scan is saved "unchecked". The recall list does not depend on the
--     link: it goes by the batch number that was scanned.
--   * Batch numbers are not unique across products in `inventory_lots`. When the
--     same number exists for two products, the row keeps the number but is linked
--     to neither, and the answer says "several".
--   * No existing table changes; orders, inventory_lots and products are only read
--     (two links point at them; neither stops a lot or product from being removed).
-- Safe to run twice.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_order_batches_install'));

do $pre$
declare
  missing text[] := '{}';
  v_tg record;
begin
  if to_regprocedure('auth.uid()') is null then missing := missing || 'function auth.uid()'::text; end if;
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regprocedure('public.is_owner_or_admin()') is null then missing := missing || 'function public.is_owner_or_admin()'::text; end if;
  if to_regclass('public.orders') is null then missing := missing || 'table public.orders'::text; end if;
  if to_regclass('public.inventory_lots') is null then missing := missing || 'table public.inventory_lots'::text; end if;
  if to_regclass('public.products') is null then missing := missing || 'table public.products'::text; end if;
  if to_regclass('public.tasks') is null then missing := missing || 'table public.tasks (its audit trigger is reused)'::text; end if;
  if to_regclass('public.audit_log') is null then missing := missing || 'table public.audit_log'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  select array_agg(c) into missing from unnest(array['id', 'lot_number', 'product_id']) c
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'inventory_lots' and column_name = c);
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: public.inventory_lots has no column %. Nothing was changed. Send this message to the session.', array_to_string(missing, ', ');
  end if;
  if to_regclass('public.order_batches') is not null
     and coalesce(obj_description(to_regclass('public.order_batches'), 'pg_class'), '') <> 'Health Endeavors drafts/54: the batch that went into each order' then
    raise exception 'Not installed: a table public.order_batches already exists and was not created by this file. Nothing was changed; show this message before going further.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('record_order_batch', 'void_order_batch', 'order_batches_guard')
                and coalesce(obj_description(p.oid, 'pg_proc'), '') <> 'Health Endeavors drafts/54') then
    raise exception 'Not installed: a function with one of this draft''s names already exists that this draft did not create. Nothing was changed; show this message before going further.';
  end if;
  select t.tgtype into v_tg from pg_trigger t
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  if not found then
    raise exception 'Not installed: the audit trigger on public.tasks was not found, so order batches could not be audited the same way.';
  end if;
  if (v_tg.tgtype & 1) = 0 or (v_tg.tgtype & 2) <> 0 or (v_tg.tgtype & 4) = 0 or (v_tg.tgtype & 8) = 0 or (v_tg.tgtype & 16) = 0 then
    raise exception 'Not installed: the audit trigger on public.tasks is not an AFTER INSERT OR UPDATE OR DELETE row trigger (type %); it cannot be reused as is.', v_tg.tgtype;
  end if;
end
$pre$;

create table if not exists public.order_batches (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id),
  lot_number   text not null check (lot_number ~ '^[\x20-\x7e]{1,24}$' and lot_number = btrim(lot_number)),
  lot_id       uuid references public.inventory_lots(id) on delete set null,
  product_id   uuid references public.products(id) on delete set null,
  quantity     integer not null default 1 check (quantity between 1 and 10000),
  source       text not null default 'scan' check (source in ('scan', 'typed')),
  recorded_by  uuid not null default auth.uid(),
  recorded_at  timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid,
  void_reason  text check (void_reason is null or char_length(void_reason) between 3 and 300),
  constraint order_batches_void_together check ((voided_at is null) = (voided_by is null) and (voided_at is null) = (void_reason is null))
);
comment on table public.order_batches is 'Health Endeavors drafts/54: the batch that went into each order';
-- one live row per order and batch (the count goes up instead); voided rows do not count
create unique index if not exists order_batches_one_per_order on public.order_batches (order_id, lower(lot_number)) where voided_at is null;
create index if not exists order_batches_by_lot on public.order_batches (lower(lot_number)) where voided_at is null;

-- Nothing is deleted; a row only ever gains bottles, loses a link whose target was
-- removed, or is voided once by the owner or an administrator.
create or replace function public.order_batches_guard() returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'A recorded batch stays on the record; void it with a reason instead.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.lot_number := btrim(coalesce(new.lot_number, ''));
    new.recorded_by := auth.uid(); new.recorded_at := now();
    new.voided_at := null; new.voided_by := null; new.void_reason := null;
    return new;
  end if;
  if new.id is distinct from old.id or new.order_id is distinct from old.order_id or new.lot_number is distinct from old.lot_number
     or new.source is distinct from old.source or new.recorded_by is distinct from old.recorded_by or new.recorded_at is distinct from old.recorded_at then
    raise exception 'The order, the batch number and who recorded it cannot be changed; void the row and record the right one.' using errcode = '42501';
  end if;
  -- a link may be set once (a row recorded without it) or dropped (the batch or
  -- product it pointed at was removed), never re-pointed
  if (old.lot_id is not null and new.lot_id is not null and new.lot_id is distinct from old.lot_id)
     or (old.product_id is not null and new.product_id is not null and new.product_id is distinct from old.product_id) then
    raise exception 'The batch a row is linked to cannot be changed; void the row and record the right one.' using errcode = '42501';
  end if;
  if old.voided_at is not null then
    if new.voided_at is distinct from old.voided_at or new.voided_by is distinct from old.voided_by
       or new.void_reason is distinct from old.void_reason or new.quantity is distinct from old.quantity then
      raise exception 'A voided row is final.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.voided_at is not null then
    if not coalesce(public.is_owner_or_admin(), false) then
      raise exception 'Only the owner and administrators can void a recorded batch.' using errcode = '42501';
    end if;
    if new.quantity is distinct from old.quantity then
      raise exception 'Void the row as it is; do not change its count at the same time.' using errcode = '42501';
    end if;
    new.voided_at := now(); new.voided_by := auth.uid();
    return new;
  end if;
  if new.quantity < old.quantity then
    raise exception 'The count of a recorded batch only goes up; void the row and record the right count.' using errcode = '42501';
  end if;
  return new;
end
$fn$;
drop trigger if exists order_batches_guard on public.order_batches;
create trigger order_batches_guard before insert or update or delete on public.order_batches
  for each row execute function public.order_batches_guard();

-- ---------------------------------------------------------------- record the batch of a bottle (or several)
create or replace function public.record_order_batch(p_order_id uuid, p_lot_number text, p_quantity integer default 1, p_source text default 'scan') returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_lot text := btrim(coalesce(p_lot_number, ''));
  v_qty integer := coalesce(p_quantity, 1);
  v_n integer;
  v_lot_id uuid;
  v_product uuid;
  v_row public.order_batches%rowtype;
  v_matched text;
begin
  if not (coalesce(public.is_active_staff(), false) or coalesce(public.is_owner_or_admin(), false)) then
    raise exception 'Only an active team member can record a batch.' using errcode = '42501';
  end if;
  if v_lot = '' or v_lot !~ '^[\x20-\x7e]{1,24}$' then
    raise exception 'That is not a batch number (1 to 24 plain characters).' using errcode = '22023';
  end if;
  if v_qty < 1 or v_qty > 10000 then
    raise exception 'The number of bottles must be between 1 and 10000.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.orders where id = p_order_id and deleted_at is null) then
    raise exception 'That order does not exist (or was deleted).' using errcode = 'P0002';
  end if;
  select count(*), min(l.id::text)::uuid, min(l.product_id::text)::uuid into v_n, v_lot_id, v_product
    from public.inventory_lots l where lower(btrim(l.lot_number)) = lower(v_lot);
  -- The lookup follows the stock table's own rules for the person signed in
  -- (SECURITY INVOKER). Where packers may not read the batches in stock, "nothing
  -- found" does not mean "no such batch": the answer then says "unchecked".
  if v_n = 1 then v_matched := 'one';
  elsif v_n = 0 then
    v_matched := case when coalesce(public.is_owner_or_admin(), false) then 'none' else 'unchecked' end;
    v_lot_id := null; v_product := null;
  else v_matched := 'several'; v_lot_id := null; v_product := null;
  end if;
  -- one row per order and batch: two people scanning the same bottle type wait for each other
  perform pg_advisory_xact_lock(hashtext('health_endeavors_order_batch:' || p_order_id::text || ':' || lower(v_lot)));
  select * into v_row from public.order_batches where order_id = p_order_id and lower(lot_number) = lower(v_lot) and voided_at is null for update;
  if found then
    if v_row.quantity + v_qty > 10000 then
      raise exception 'That would be more than 10000 bottles of one batch on one order.' using errcode = '22023';
    end if;
    -- a row first recorded without its link gets it from whoever can see the batch in stock
    update public.order_batches
       set quantity = quantity + v_qty,
           lot_id = coalesce(lot_id, v_lot_id),
           product_id = coalesce(product_id, v_product)
     where id = v_row.id returning * into v_row;
  else
    insert into public.order_batches (order_id, lot_number, lot_id, product_id, quantity, source)
      values (p_order_id, v_lot, v_lot_id, v_product, v_qty, case when p_source = 'typed' then 'typed' else 'scan' end)
      returning * into v_row;
  end if;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'lot_number', v_row.lot_number, 'quantity', v_row.quantity, 'matched', v_matched, 'product_id', v_row.product_id);
end
$fn$;

-- ---------------------------------------------------------------- void a wrong scan (owner and administrators)
create or replace function public.void_order_batch(p_id uuid, p_reason text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_row public.order_batches%rowtype;
begin
  if not coalesce(public.is_owner_or_admin(), false) then
    raise exception 'Only the owner and administrators can void a recorded batch.' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 300 then
    raise exception 'Say why in a few words (3 to 300 characters).' using errcode = '22023';
  end if;
  select * into v_row from public.order_batches where id = p_id for update;
  if not found then
    raise exception 'That row does not exist.' using errcode = 'P0002';
  end if;
  if v_row.voided_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'id', v_row.id);
  end if;
  update public.order_batches set voided_at = now(), voided_by = auth.uid(), void_reason = v_reason where id = p_id returning * into v_row;
  return jsonb_build_object('ok', true, 'already', false, 'id', v_row.id);
end
$fn$;

comment on function public.record_order_batch(uuid, text, integer, text) is 'Health Endeavors drafts/54';
comment on function public.void_order_batch(uuid, text) is 'Health Endeavors drafts/54';
comment on function public.order_batches_guard() is 'Health Endeavors drafts/54';

-- ---------------------------------------------------------------- audit: production's own audit trigger
-- Dynamic only because the function's name is read from production at install time.
do $audit$
declare
  v_nsp text;
  v_fn  text;
begin
  select n.nspname, p.proname into v_nsp, v_fn
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
   where t.tgrelid = 'public.tasks'::regclass and not t.tgisinternal and lower(t.tgname) like '%audit%' limit 1;
  execute format('drop trigger if exists %I on public.%I', 'order_batches_audit', 'order_batches');
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function %I.%I()',
                 'order_batches_audit', 'order_batches', v_nsp, v_fn);
end $audit$;

-- ---------------------------------------------------------------- who can see and do what
alter table public.order_batches enable row level security;
revoke all on public.order_batches from public, anon;
grant select, insert, update on public.order_batches to authenticated;
drop policy if exists order_batches_read on public.order_batches;
create policy order_batches_read on public.order_batches for select to authenticated using (public.is_active_staff() or public.is_owner_or_admin());
drop policy if exists order_batches_team_add on public.order_batches;
create policy order_batches_team_add on public.order_batches for insert to authenticated with check (public.is_active_staff() or public.is_owner_or_admin());
drop policy if exists order_batches_team_change on public.order_batches;
create policy order_batches_team_change on public.order_batches for update to authenticated
  using (public.is_active_staff() or public.is_owner_or_admin()) with check (public.is_active_staff() or public.is_owner_or_admin());

revoke all on function public.record_order_batch(uuid, text, integer, text) from public, anon;
revoke all on function public.void_order_batch(uuid, text) from public, anon;
revoke all on function public.order_batches_guard() from public, anon;
grant execute on function public.record_order_batch(uuid, text, integer, text) to authenticated;
grant execute on function public.void_order_batch(uuid, text) to authenticated;

commit;
