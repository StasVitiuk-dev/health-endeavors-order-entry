-- PRODUCTION CHANGE - DO NOT RUN WITHOUT THE OWNER'S APPROVAL (rollback; tested locally only).
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   18   (ROLLBACK, rolls back 17)
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    none needed
-- @effect:      drops the trigger and its function
-- @postcheck:   trigger absent
-- @rollback:    (this file is the rollback of drafts/17)
-- @@ end metadata @@
-- DRAFT rollback for 17_DRAFT_po_line_delete_guard.sql. Removes the trigger
-- and its function only; no data is touched. One transaction.
begin;
select pg_advisory_xact_lock(hashtext('health_endeavors_po_line_guard_install')); -- EXT5: a second copy run at the same time waits instead of failing
drop trigger if exists he_po_line_delete_guard on public.purchase_order_items;
drop function if exists public._he_po_line_delete_guard();
commit;
