-- DRAFT rollback for 10_DRAFT_stock_functions.sql. Removes the functions only;
-- no table or data is touched. Run this only if the functions must be removed
-- AFTER the dashboard has been switched back to its old code path (revert the
-- dashboard PR first, or the buttons would call missing functions).
-- Run as one transaction: all functions disappear together, or none do.
begin;
drop function if exists public.delete_unused_product(uuid);
drop function if exists public.receive_return(uuid, text, integer);
drop function if exists public.quarantine_recall(uuid);
drop function if exists public.receive_purchase_order(uuid, jsonb, date);
drop function if exists public.adjust_inventory(uuid, text, integer, text, integer);
drop function if exists public._he_apply_stock_change(uuid, text, integer, text, uuid, integer);
-- Earlier draft signatures (never installed; harmless if absent).
drop function if exists public.adjust_inventory(uuid, text, integer, text);
drop function if exists public._he_apply_stock_change(uuid, text, integer, text, uuid);
commit;
