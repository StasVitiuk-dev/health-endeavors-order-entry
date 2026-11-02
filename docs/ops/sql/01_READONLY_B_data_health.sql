-- =============================================================================
-- Health Endeavors — READ-ONLY data-health check (Query B)
-- ONE SELECT statement: counts only, no customer data, changes NOTHING.
--
-- Every output column has its own name (section, check_name, result), so the
-- Supabase results grid and its CSV export keep all three columns. (Query A
-- left two columns unnamed and the export merged them.)
--
-- Written against the real table shapes from Query A (2026-10-05) and tested
-- on a local copy of those shapes. If it still stops with an error, send me
-- the exact error message.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query):
--   1. Paste this whole file. 2. Click "Run".
--   3. Export → Download CSV (or select all rows and copy) and send it back.
-- =============================================================================
select '1 stock' as section, 'inventory: rows with any negative bucket' as check_name, count(*)::text as result
    from inventory where least(available, reserved, damaged, sample, wholesale, promotional, returned, recalled) < 0
  union all select '1 stock', 'inventory: rows with recalled < 0 (recalled has no database rule yet)',
    count(*)::text from inventory where recalled < 0
  union all select '1 stock', 'inventory: rows whose product no longer exists',
    count(*)::text from inventory i where not exists (select 1 from products p where p.id = i.product_id)
  union all select '1 stock', 'products: rows with no inventory row',
    count(*)::text from products p where not exists (select 1 from inventory i where i.product_id = p.id)
  union all select '1 stock', 'inventory_adjustments: total rows',
    count(*)::text from inventory_adjustments
  union all select '2 lots', 'inventory_lots: lot numbers containing _ or % (wildcard bug exposure)',
    count(*)::text from inventory_lots where lot_number like '%\_%' escape '\' or lot_number like '%\%%' escape '\'
  union all select '2 lots', 'inventory_lots: quantity_remaining < 0 or > quantity_received',
    count(*)::text from inventory_lots where quantity_remaining < 0 or quantity_remaining > quantity_received
  union all select '2 lots', 'inventory_lots: quantities that are not whole numbers',
    count(*)::text from inventory_lots where quantity_received <> trunc(quantity_received) or quantity_remaining <> trunc(quantity_remaining)
  union all select '3 purchasing', 'purchase_orders: count by status (not deleted)',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from purchase_orders where deleted_at is null group by status) d), 'none')
  union all select '3 purchasing', 'purchase_orders: deleted (deleted_at set), by status',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from purchase_orders where deleted_at is not null group by status) d), 'none')
  union all select '3 purchasing', 'purchase_orders: received but a catalogue line not fully received',
    count(*)::text from purchase_orders po where po.status = 'received' and exists
    (select 1 from purchase_order_items i where i.purchase_order_id = po.id and i.product_id is not null and i.quantity_received < i.quantity)
  union all select '3 purchasing', 'purchase_orders: cancelled but stock was received (Cancel-after-Receive)',
    count(*)::text from purchase_orders po where po.status = 'cancelled' and exists
    (select 1 from purchase_order_items i where i.purchase_order_id = po.id and i.quantity_received > 0)
  union all select '3 purchasing', 'purchase_order_items: catalogue lines with a non-whole quantity',
    count(*)::text from purchase_order_items where product_id is not null and quantity <> trunc(quantity)
  union all select '3 purchasing', 'expenses: purchase-order notes logged more than once (possible R1 duplicates)',
    coalesce((select string_agg(note || ' x' || n, ' | ' order by note)
              from (select note, count(*) n from expenses where note like 'Purchase order %' and deleted_at is null group by note having count(*) > 1) d), 'none')
  union all select '4 recalls', 'recalls: count by status',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from recalls group by status) d), 'none')
  union all select '5 returns', 'returns: count by status',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from returns group by status) d), 'none')
  union all select '5 returns', 'returns: refund_amount recorded (count, sum)',
    count(refund_amount)::text || ', ' || coalesce(sum(refund_amount), 0)::text from returns
  union all select '5 returns', 'returns: refund_amount above the order line value',
    count(*)::text from returns r join order_items oi on oi.id = r.order_item_id
    where r.refund_amount is not null and r.refund_amount > coalesce(oi.line_total, oi.quantity * oi.unit_price)
  union all select '6 orders', 'orders: count by status (not deleted) — the words Accounting/Tax classify',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from orders where deleted_at is null group by status) d), 'none')
  union all select '6 orders', 'orders: count by source (not deleted)',
    coalesce((select string_agg(source || '=' || n, ', ' order by source)
              from (select source, count(*) n from orders where deleted_at is null group by source) d), 'none')
  union all select '7 approvals', 'approval_requests: count by status',
    coalesce((select string_agg(status || '=' || n, ', ' order by status)
              from (select status, count(*) n from approval_requests group by status) d), 'none')
  union all select '8 documents', 'documents: count by related_type (database allows supplier, general or empty)',
    coalesce((select string_agg(coalesce(related_type, '(none)') || '=' || n, ', ' order by related_type)
              from (select related_type, count(*) n from documents group by related_type) d), 'none')
order by 1, 2;
