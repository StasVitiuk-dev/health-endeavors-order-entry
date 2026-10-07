-- =============================================================================
-- Health Endeavors — READ-ONLY stock reconciliation (Query E)
-- ONE SELECT statement. Changes NOTHING. No customer data: only counts,
-- product SKUs and purchase-order numbers.
--
-- Status: PREPARED (2026-10-07, extension 6), NOT RUN on production. Tested
-- on the local throwaway database with synthetic data, including a planted
-- example of every problem it looks for (local-test/reconciliation_test.sh).
--
-- What it answers: does each product's stock agree with its stock history,
-- and does each received delivery agree with its stock and its expense?
--
-- HOW TO READ THE RESULT
--   * "0" or "none" in a check = nothing found. That is the goal.
--   * A difference between stock and history is NOT automatically an error:
--     stock entered before the history table existed (an opening balance)
--     also shows up here. Compare with what you know, then decide.
--   * Duplicate or missing delivery expenses, and delivery lines that were
--     not fully stocked, ARE worth looking at: they are the problems the
--     race and retry fixes in docs/ops are about.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query):
--   1. Paste this whole file. 2. Click "Run". 3. Export → Download CSV.
--   It only reads. You can stop it at any time; nothing is left half-done.
-- =============================================================================
with buckets as (
  select i.product_id, b.bucket, b.qty
  from inventory i
  cross join lateral (values ('available', i.available), ('reserved', i.reserved), ('damaged', i.damaged),
                             ('sample', i.sample), ('wholesale', i.wholesale), ('promotional', i.promotional),
                             ('returned', i.returned), ('recalled', i.recalled)) as b(bucket, qty)
),
history as (
  select product_id, bucket, sum(change_amount) as qty from inventory_adjustments group by product_id, bucket
),
stock_vs_history as (
  select p.sku, b.bucket, coalesce(b.qty, 0) as stock, coalesce(h.qty, 0) as hist
  from buckets b
  join products p on p.id = b.product_id
  left join history h on h.product_id = b.product_id and h.bucket = b.bucket
  where coalesce(b.qty, 0) <> coalesce(h.qty, 0)
),
received as (
  select po.id, po.po_number,
         round(coalesce((select sum(quantity * unit_cost) from purchase_order_items l where l.purchase_order_id = po.id), 0)
               + coalesce(po.shipping_cost, 0) + coalesce(po.tax, 0), 2) as expected_amount,
         coalesce((select sum(coalesce(quantity_received, 0)) from purchase_order_items l where l.purchase_order_id = po.id), 0) as lines_received,
         coalesce((select sum(change_amount) from inventory_adjustments a
                   where a.reason = 'Delivery received (' || po.po_number || ')'), 0) as stocked,
         (select count(*) from expenses e where e.note = 'Purchase order ' || po.po_number and e.deleted_at is null) as expenses,
         (select sum(amount) from expenses e where e.note = 'Purchase order ' || po.po_number and e.deleted_at is null) as expense_amount
  from purchase_orders po
  where po.status = 'received' and po.deleted_at is null
)
select '1 stock vs history' as section, 'product buckets whose stock differs from the sum of their history' as check_name,
       count(*)::text as result from stock_vs_history
union all select '1 stock vs history', 'first 25 differences (SKU bucket: stock / history)',
       coalesce((select string_agg(sku || ' ' || bucket || ': ' || stock || ' / ' || hist, '; ' order by sku, bucket)
                 from (select * from stock_vs_history order by sku, bucket limit 25) d), 'none')
union all select '1 stock vs history', 'any bucket below zero',
       count(*)::text from buckets where qty < 0
union all select '2 history', 'history rows for a product that no longer exists',
       count(*)::text from inventory_adjustments a where not exists (select 1 from products p where p.id = a.product_id)
union all select '2 history', 'history rows with an unknown bucket name',
       count(*)::text from inventory_adjustments where bucket not in ('available','reserved','damaged','sample','wholesale','promotional','returned','recalled')
union all select '2 history', 'history rows that change nothing (0)',
       count(*)::text from inventory_adjustments where change_amount = 0
union all select '2 history', 'history rows pointing at a lot that no longer exists',
       count(*)::text from inventory_adjustments a where a.lot_id is not null and not exists (select 1 from inventory_lots l where l.id = a.lot_id)
union all select '2 history', 'products with stock but no history at all (opening balance?)',
       count(*)::text from inventory i where (i.available + i.reserved + i.damaged + i.sample + i.wholesale + i.promotional + i.returned + i.recalled) <> 0
         and not exists (select 1 from inventory_adjustments a where a.product_id = i.product_id)
union all select '3 deliveries', 'received orders (not deleted)',
       count(*)::text from received
union all select '3 deliveries', 'received orders: a line not fully received',
       count(*)::text from received r where exists (select 1 from purchase_order_items l where l.purchase_order_id = r.id and coalesce(l.quantity_received, 0) <> l.quantity)
union all select '3 deliveries', 'received orders: units stocked differ from units received (PO numbers)',
       coalesce((select string_agg(po_number || ' (' || stocked || ' stocked / ' || lines_received || ' received)', '; ' order by po_number)
                 from received where stocked <> lines_received), 'none')
union all select '3 deliveries', 'received orders with NO delivery expense (PO numbers)',
       coalesce((select string_agg(po_number, '; ' order by po_number) from received where expenses = 0 and expected_amount > 0), 'none')
union all select '3 deliveries', 'received orders with MORE THAN ONE delivery expense — possible duplicate (PO numbers)',
       coalesce((select string_agg(po_number || ' (' || expenses || ')', '; ' order by po_number) from received where expenses > 1), 'none')
union all select '3 deliveries', 'received orders whose expense differs from lines + shipping + tax (PO numbers)',
       coalesce((select string_agg(po_number || ' (' || expense_amount || ' vs ' || expected_amount || ')', '; ' order by po_number)
                 from received where expenses = 1 and expense_amount <> expected_amount), 'none')
union all select '3 deliveries', 'delivery history rows for an order that is not received',
       count(*)::text from inventory_adjustments a
         where a.reason like 'Delivery received (%)'
           and not exists (select 1 from purchase_orders po where po.status = 'received' and a.reason = 'Delivery received (' || po.po_number || ')')
union all select '4 lots', 'lots with remaining below zero or above received',
       count(*)::text from inventory_lots where quantity_remaining < 0 or quantity_remaining > quantity_received
union all select '4 lots', 'products whose lots hold more than available + recalled (information)',
       count(*)::text from inventory i
         where (select coalesce(sum(quantity_remaining), 0) from inventory_lots l where l.product_id = i.product_id) > i.available + i.recalled;
