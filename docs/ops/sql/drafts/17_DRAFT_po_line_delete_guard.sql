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
begin
  select status, po_number into v_status, v_number
    from purchase_orders where id = old.purchase_order_id;
  if found and v_status not in ('draft', 'ordered') then
    raise exception 'Purchase order % is "%" now, so its lines can no longer be removed. Nothing was changed — reload the page.', v_number, v_status
      using errcode = '55000', hint = 'po_not_editable';
  end if;
  return old;
end $$;

drop trigger if exists he_po_line_delete_guard on public.purchase_order_items;
create trigger he_po_line_delete_guard
  before delete on public.purchase_order_items
  for each row execute function public._he_po_line_delete_guard();

revoke all on function public._he_po_line_delete_guard() from public;
commit;
