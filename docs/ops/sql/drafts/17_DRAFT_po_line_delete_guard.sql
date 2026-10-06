-- DRAFT (2026-10-06, extension 4). NOT INSTALLED. Needs the owner's approval,
-- like R1–R5 (docs/ops/R1-R5-INSTALL-RUNBOOK.md); install only together with
-- or after R1. Rollback: 18_DRAFT_rollback_po_line_delete_guard.sql.
--
-- Problem (reproduced on the local test database, 10 of 30 runs): removing
-- a purchase-order line while that order is being received can delete the
-- line AFTER its stock was added. The dashboard checks the order's status
-- and then deletes the line in a second request; even a single DELETE with
-- the status in its WHERE clause is not enough, because PostgreSQL re-checks
-- only the deleted row, not the order row it joined. Stock then no longer
-- matches the order's lines.
--
-- EXT5: the same race exists for ADDING a line (it is never received, yet the
-- order ends "Received") and for CHANGING a line's quantity / cost / product
-- (the received quantity no longer matches the stock added). The guard now
-- covers insert, update of those columns, and delete. The name is kept so the
-- rollback file and the runbook stay valid.
--
-- Fix: before a line is deleted, re-read its order's status. A receive locks
-- every line of the order first, so a delete that races it waits for the
-- receive to finish; the re-read (a new query inside a trigger function sees
-- the newest committed data in READ COMMITTED) then sees "received" and
-- refuses. It deliberately takes no lock on the order: locking it here would
-- take the two locks in the opposite order to the receive and can deadlock
-- (seen in the local stress test with FOR SHARE). Lines can only be removed
-- while the order is draft or ordered (the dashboard's PO_EDITABLE). Deleting
-- a whole order (cascade) is unaffected: the order row is already gone.
-- Nothing else changes: no data, no permissions, no other table.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_po_line_guard_install')); -- EXT5: a second copy run at the same time waits instead of failing

do $pre$
begin
  if to_regclass('public.purchase_order_items') is null or to_regclass('public.purchase_orders') is null then
    raise exception 'Install stopped, nothing was changed: purchase_orders / purchase_order_items not found.';
  end if;
end $pre$;

create or replace function public._he_po_line_delete_guard()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_number text;
  v_po uuid;
begin
  -- EXT5: inserts and content edits are guarded too. Only the order's
  -- content counts: the receive itself (R1, or the dashboard today) only
  -- writes quantity_received / landed_unit_cost, which stay allowed.
  if tg_op = 'UPDATE'
     and new.quantity is not distinct from old.quantity
     and new.unit_cost is not distinct from old.unit_cost
     and new.product_id is not distinct from old.product_id
     and new.purchase_order_id is not distinct from old.purchase_order_id then
    return new;
  end if;
  v_po := case when tg_op = 'INSERT' then new.purchase_order_id else old.purchase_order_id end;
  if tg_op = 'INSERT' then
    -- A new row holds no lock a receive could be waiting for, so it may wait
    -- for the order row (a receive in progress holds it) without any risk of
    -- deadlock, and then sees the order's newest status.
    select status, po_number into v_status, v_number from purchase_orders where id = v_po for share;
  else
    -- DELETE / UPDATE already hold this line's row lock. A receive locks the
    -- order and then every line, so waiting for the order here could
    -- deadlock. A plain re-read is enough: a receive in progress holds this
    -- line's lock, so this statement only gets here after the receive has
    -- committed, and a new query inside a trigger sees that commit.
    select status, po_number into v_status, v_number from purchase_orders where id = v_po;
  end if;
  if found and v_status not in ('draft', 'ordered') then
    raise exception 'Purchase order % is "%" now, so its lines can no longer be changed. Nothing was changed — reload the page.', v_number, v_status
      using errcode = '55000', hint = 'po_not_editable';
  end if;
  if tg_op = 'UPDATE' and new.purchase_order_id is distinct from old.purchase_order_id then
    -- moving a line to another order: that order must be editable as well
    select status, po_number into v_status, v_number from purchase_orders where id = new.purchase_order_id for share;
    if found and v_status not in ('draft', 'ordered') then
      raise exception 'Purchase order % is "%" now, so lines can no longer be added to it. Nothing was changed — reload the page.', v_number, v_status
        using errcode = '55000', hint = 'po_not_editable';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists he_po_line_delete_guard on public.purchase_order_items;
create trigger he_po_line_delete_guard
  before insert or update or delete on public.purchase_order_items
  for each row execute function public._he_po_line_delete_guard();

revoke all on function public._he_po_line_delete_guard() from public;
commit;
