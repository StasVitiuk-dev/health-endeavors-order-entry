-- DRAFT (2026-11-22). NOT INSTALLED. Rollback of 44_DRAFT_staff_read_purchase_orders.sql.
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   45   (ROLLBACK, rolls back 44)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    none (removing two read rules only)
-- @effect:      drops the two staff read rules; staff no longer see purchase orders
-- @postcheck:   a staff account sees no purchase order
-- @rollback:    (this file is the rollback of drafts/44)
-- @@ end metadata @@
-- Needs the owner's written approval. DO NOT RUN until then.
--
-- Removes the two read-only staff rules: staff no longer see purchase orders
-- (as before). Changes no data and no other rule. Safe to run twice.
-- Note: with drafts/40 installed, staff then cannot submit receiving records;
-- records already submitted stay as they are.
begin;
drop policy if exists staff_read_purchase_order_items on public.purchase_order_items;
drop policy if exists staff_read_purchase_orders on public.purchase_orders;
commit;
