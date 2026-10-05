-- =============================================================================
-- Health Endeavors — READ-ONLY data-health check (Query B of 2)
-- ONE SELECT statement: counts only, no customer data, changes NOTHING.
-- Run after Query A. If it stops with an error such as
--   column "deleted_at" does not exist
-- just send me that exact error message: it tells me what the real schema is.
-- =============================================================================
select '11 health', 'inventory: rows with any negative bucket', count(*)::text
    from inventory where least(available, reserved, damaged, sample, wholesale, promotional, returned, recalled) < 0
  union all select '11 health', 'inventory: rows whose product no longer exists',
    count(*)::text from inventory i where not exists (select 1 from products p where p.id = i.product_id)
  union all select '11 health', 'products: rows with no inventory row',
    count(*)::text from products p where not exists (select 1 from inventory i where i.product_id = p.id)
  union all select '11 health', 'inventory_lots: case-insensitive duplicate lot numbers per product',
    count(*)::text from (select product_id, lower(lot_number) from inventory_lots group by 1,2 having count(*) > 1) d
  union all select '11 health', 'inventory_lots: lot numbers containing _ or % (wildcard bug exposure)',
    count(*)::text from inventory_lots where lot_number like '%\_%' escape '\' or lot_number like '%\%%' escape '\'
  union all select '11 health', 'inventory_lots: quantity_remaining < 0 or > quantity_received',
    count(*)::text from inventory_lots where quantity_remaining < 0 or quantity_remaining > quantity_received
  union all select '11 health', 'expenses: purchase-order notes logged more than once (possible R1 duplicates)',
    coalesce(string_agg(note || ' ×' || n, '; '), 'none') from
    (select note, count(*) n from expenses where note like 'Purchase order %' and deleted_at is null group by note having count(*) > 1) d
  union all select '11 health', 'purchase_orders: count by status',
    coalesce(string_agg(status || '=' || n, ', '), 'none') from (select status, count(*) n from purchase_orders group by status) d
  union all select '11 health', 'purchase_orders: received but a line not fully received',
    count(*)::text from purchase_orders po where po.status = 'received' and exists
    (select 1 from purchase_order_items i where i.purchase_order_id = po.id and coalesce(i.quantity_received,0) < i.quantity and i.product_id is not null)
  union all select '11 health', 'purchase_orders: cancelled but stock was received (Cancel-after-Receive)',
    count(*)::text from purchase_orders po where po.status = 'cancelled' and exists
    (select 1 from purchase_order_items i where i.purchase_order_id = po.id and coalesce(i.quantity_received,0) > 0)
  union all select '11 health', 'recalls: count by status',
    coalesce(string_agg(status || '=' || n, ', '), 'none') from (select status, count(*) n from recalls group by status) d
  union all select '11 health', 'returns: count by status',
    coalesce(string_agg(status || '=' || n, ', '), 'none') from (select status, count(*) n from returns group by status) d
  union all select '11 health', 'returns: refund_amount recorded (count, sum)',
    count(refund_amount)::text || ', ' || coalesce(sum(refund_amount),0)::text from returns
  union all select '11 health', 'approval_requests: count by status',
    coalesce(string_agg(status || '=' || n, ', '), 'none') from (select status, count(*) n from approval_requests group by status) d
  union all select '11 health', 'inventory_adjustments: total rows', count(*)::text from inventory_adjustments
order by 1, 2;
