-- DRAFT rollback for 17_DRAFT_po_line_delete_guard.sql. Removes the trigger
-- and its function only; no data is touched. One transaction.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_po_line_guard_install')); -- EXT5: a second copy run at the same time waits instead of failing
drop trigger if exists he_po_line_delete_guard on public.purchase_order_items;
drop function if exists public._he_po_line_delete_guard();
commit;
