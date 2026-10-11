-- =============================================================================
-- Health Endeavors — READ-ONLY daily integrity check (Query F)
-- ONE SELECT statement. Changes NOTHING. No customer data: only counts and
-- record numbers (task / approval ids, order numbers, PO numbers, SKUs,
-- supplier and product names).
--
-- Status: PREPARED (2026-10-07, extension 8), NOT RUN on production. Tested on
-- the local throwaway database with synthetic data, with one planted example
-- of every problem (local-test/integrity_check_test.sh). Companion of Query E
-- (stock vs history, deliveries, orders without items), which it does not
-- repeat.
--
-- What it answers: is any work stuck, is anything probably entered twice,
-- does any record point at the wrong thing, is any value impossible?
-- Thresholds (14 days, 7 days) are suggestions for the owner to change.
--
-- HOW TO READ THE RESULT: one row per check. "0" = nothing found (the goal).
-- A non-zero row is something to LOOK AT, not automatically an error: two
-- suppliers with the same name may be two real companies. Nothing here
-- deletes or changes anything, and nothing should be deleted automatically.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query): paste the whole
-- file, Run, Export → Download CSV. It only reads.
--
-- Later (owner decision): the same query can run on a schedule and feed the
-- dashboard's "Checks: what needs a look" (AUTOMATION_AND_AGENT_ARCHITECTURE.md, D1).
-- =============================================================================
select 'F01 stuck work' as section, 'tasks "in progress" with no change for 14+ days' as check_name,
       count(*) as findings, string_agg(left(id::text, 8), ', ' order by updated_at) as examples
  from (select id, updated_at from tasks where status = 'in_progress' and updated_at < now() - interval '14 days' order by updated_at limit 1000) t
union all
select 'F02 stuck work', 'open tasks more than 7 days past due',
       count(*), string_agg(left(id::text, 8), ', ' order by due_at)
  from (select id, due_at from tasks where status in ('open', 'in_progress') and due_at < now() - interval '7 days' order by due_at limit 1000) t
union all
select 'F03 stuck work', 'approval requests pending for 7+ days',
       count(*), string_agg(left(id::text, 8), ', ' order by created_at)
  from (select id, created_at from approval_requests where status = 'pending' and created_at < now() - interval '7 days' order by created_at limit 1000) t
union all
select 'F04 stuck work', 'recalls still "initiated" (nothing quarantined) after 14+ days',
       count(*), string_agg(left(id::text, 8), ', ')
  from recalls where status = 'initiated' and created_at < now() - interval '14 days'
union all
select 'F05 stuck work', 'purchase orders ordered / shipped, expected 7+ days ago, not received',
       count(*), string_agg(po_number, ', ' order by expected_at)
  from purchase_orders where status in ('ordered', 'shipped') and expected_at < current_date - 7
union all
select 'F06 probable duplicate', 'order numbers used by more than one (not deleted) order',
       count(*), string_agg(order_number, ', ')
  from (select order_number from orders where deleted_at is null and order_number is not null group by order_number having count(*) > 1) d
union all
select 'F07 probable duplicate', 'suppliers with the same name (ignoring case and spaces)',
       count(*), string_agg(nm, ', ')
  from (select lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))) as nm from suppliers group by 1 having count(*) > 1) d
union all
select 'F08 probable duplicate', 'products with the same name (ignoring case and spaces)',
       count(*), string_agg(nm, ', ')
  from (select lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))) as nm from products group by 1 having count(*) > 1) d
union all
select 'F09 probable duplicate', 'expenses with the same date, amount, category and vendor (not deleted)',
       count(*), string_agg(k, ', ')
  from (select expense_date::text || ' ' || amount::text || ' ' || category as k from expenses
         where deleted_at is null group by expense_date, amount, category, lower(btrim(coalesce(vendor, ''))) having count(*) > 1) d
union all
select 'F10 points at the wrong thing', 'returns whose order line belongs to a different order',
       count(*), string_agg(left(r.id::text, 8), ', ')
  from returns r join order_items oi on oi.id = r.order_item_id where oi.order_id <> r.order_id
union all
select 'F11 points at the wrong thing', 'order lines whose SKU matches no product (any case)',
       count(*), string_agg(distinct sku, ', ')
  from order_items oi join orders o on o.id = oi.order_id and o.deleted_at is null
 where oi.sku is not null and btrim(oi.sku) <> ''
   and not exists (select 1 from products p where lower(btrim(p.sku)) = lower(btrim(oi.sku)))
union all
select 'F12 impossible value', 'order totals that are missing or below zero (not deleted)',
       count(*), string_agg(coalesce(order_number, left(id::text, 8)), ', ')
  from orders where deleted_at is null and (total is null or total < 0)
union all
select 'F13 impossible value', 'order totals that differ from subtotal + shipping + tax by more than 1 cent',
       count(*), string_agg(coalesce(order_number, left(id::text, 8)), ', ')
  from orders where deleted_at is null and subtotal is not null and shipping_total is not null and tax_total is not null and total is not null
   and abs(total - (subtotal + shipping_total + tax_total)) > 0.01
union all
select 'F14 impossible value', 'stock buckets below zero',
       count(*), string_agg(p.sku, ', ')
  from inventory i join products p on p.id = i.product_id
 where least(i.available, i.reserved, i.damaged, i.sample, i.wholesale, i.promotional, i.returned, i.recalled) < 0
union all
select 'F15 impossible value', 'refunded returns without a refund date, or refund dates on unrefunded returns',
       count(*), string_agg(left(id::text, 8), ', ')
  from returns where (status = 'refunded' and refunded_at is null) or (status in ('requested', 'approved', 'rejected') and refunded_at is not null)
order by 1, 2;
