-- DRAFT (2026-11-22). NOT INSTALLED. PRODUCTION CHANGE: needs the owner's
-- @@ metadata (generated from docs/ops/sql/MANIFEST.json by `npm run sql:headers`; do not edit by hand) @@
-- @migration:   44   (PRODUCTION-CHANGE-DRAFT, step optional (owner decision of Nov 22: all employees see purchase orders; needed before staff record deliveries with drafts/40))
-- @environment: production only after the owner's written approval; tested on the local throwaway database
-- @depends-on:  none
-- @risk:        LOW
-- @precheck:    stops if is_active_staff(), purchase_orders or purchase_order_items is missing, or row-level security is off on either table
-- @effect:      two read-only row rules: active staff see purchase orders that are not deleted, and their lines (including unit costs); no write rule added; no data changed
-- @postcheck:   a staff account sees purchase orders and cannot change them; local-test/staff_read_purchase_orders_test.sh passes on a throwaway copy
-- @rollback:    drafts/45
-- @@ end metadata @@
-- written approval. DO NOT RUN until then.
-- Rollback: 45_DRAFT_rollback_staff_read_purchase_orders.sql.
-- Tested only on the local throwaway database (local-test/staff_read_purchase_orders_test.sh).
--
-- Why (owner decision of Nov 22): "allow all employees to do that stuff, since
-- it's basically why I'm hiring them" — staff record deliveries and returns
-- against purchase orders (drafts/40), and a staff member can only submit for a
-- purchase order they can see.
--
-- What it does: two READ-ONLY row rules. Active staff may SEE purchase orders
-- that are not deleted, and their lines. Nothing else changes:
--   * staff still cannot add, change or delete a purchase order or a line
--     (no write rule is added; the existing owner/administrator rules stay)
--   * stock still changes only when the owner approves (drafts/40)
--   * a deactivated account sees nothing
-- What staff will see, deliberately: supplier, order number, dates, status,
-- payment status, notes, and every line's product, quantity, quantity received
-- and UNIT COST (also landed cost, shipping and tax on the order). Hiding the
-- costs from staff is possible but is a separate change (a cost-free view).
-- Safe to run twice.
begin;

do $pre$
declare missing text[] := '{}';
begin
  if to_regprocedure('public.is_active_staff()') is null then missing := missing || 'function public.is_active_staff()'::text; end if;
  if to_regclass('public.purchase_orders') is null then missing := missing || 'table public.purchase_orders'::text; end if;
  if to_regclass('public.purchase_order_items') is null then missing := missing || 'table public.purchase_order_items'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not installed: this database is missing %', array_to_string(missing, ', ');
  end if;
  if not exists (select 1 from pg_class where oid = 'public.purchase_orders'::regclass and relrowsecurity)
     or not exists (select 1 from pg_class where oid = 'public.purchase_order_items'::regclass and relrowsecurity) then
    raise exception 'Not installed: row-level security is not on for purchase orders; that must be fixed first.';
  end if;
end
$pre$;

drop policy if exists staff_read_purchase_orders on public.purchase_orders;
create policy staff_read_purchase_orders on public.purchase_orders for select to authenticated using (public.is_active_staff() and deleted_at is null);
drop policy if exists staff_read_purchase_order_items on public.purchase_order_items;
create policy staff_read_purchase_order_items on public.purchase_order_items for select to authenticated using (public.is_active_staff() and exists (select 1 from public.purchase_orders po where po.id = purchase_order_items.purchase_order_id and po.deleted_at is null));

commit;
