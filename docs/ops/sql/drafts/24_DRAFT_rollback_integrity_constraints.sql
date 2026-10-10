-- DRAFT (2026-10-10, extension 9). NOT INSTALLED. Rollback of
-- 23_DRAFT_integrity_constraints.sql: removes the four rules. Changes no data.
-- Safe to run twice (IF EXISTS).

begin;

alter table public.inventory drop constraint if exists inventory_recalled_check;
alter table public.inventory_lots drop constraint if exists inventory_lots_remaining_range_check;
alter table public.purchase_order_items drop constraint if exists purchase_order_items_received_range_check;
alter table public.returns drop constraint if exists returns_refund_amount_check;

commit;

-- Verification (read-only), expected: 0 rows.
-- select conname from pg_constraint
--  where conname in ('inventory_recalled_check', 'inventory_lots_remaining_range_check',
--                    'purchase_order_items_received_range_check', 'returns_refund_amount_check');
