-- LOCAL TEST ONLY (2026-10-06, extension 4, workstream AL). Read-only
-- data-integrity invariants for the stock and purchasing tables, used by
-- stress_test.sh after its busiest scenarios. One row per broken rule; no
-- rows = all hold. (Written for the local real-shape schema. It is NOT a
-- query for production: "stock = sum of history" only holds on a database
-- whose history starts at zero, like the test one.)
select 'negative stock bucket' as rule, product_id::text as id from inventory
 where available < 0 or reserved < 0 or damaged < 0 or sample < 0 or wholesale < 0 or promotional < 0 or returned < 0 or recalled < 0
union all
select 'stock row without a product', i.product_id::text from inventory i where not exists (select 1 from products p where p.id = i.product_id)
union all
select 'history row without a product', a.product_id::text from inventory_adjustments a where not exists (select 1 from products p where p.id = a.product_id)
union all
select 'lot remaining above received or below zero', id::text from inventory_lots where quantity_remaining > quantity_received or quantity_remaining < 0
union all
select 'received order with an unreceived catalogue line', i.id::text from purchase_order_items i join purchase_orders o on o.id = i.purchase_order_id
 where o.status = 'received' and i.product_id is not null and coalesce(i.quantity_received, 0) <> i.quantity
union all
select 'line received on an order that is not received', i.id::text from purchase_order_items i join purchase_orders o on o.id = i.purchase_order_id
 where o.status <> 'received' and coalesce(i.quantity_received, 0) > 0
union all
select 'received order without exactly one expense', o.id::text from purchase_orders o
 where o.status = 'received' and (select count(*) from expenses e where e.note = 'Purchase order ' || o.po_number) <> 1
   and exists (select 1 from purchase_order_items i where i.purchase_order_id = o.id and i.quantity * coalesce(i.unit_cost, 0) > 0)
union all
select 'expense not in whole cents', id::text from expenses where amount <> round(amount, 2)
union all
select 'quarantined recall with nothing quarantined', id::text from recalls where status = 'quarantined' and coalesce(quantity_quarantined, 0) <= 0
union all
select 'restocked return without a history row', r.id::text from returns r
 where r.status = 'received' and r.disposition like 'restock%'
   and not exists (select 1 from inventory_adjustments a where a.reason like 'Return received%')
union all
select 'stock not explained by history (test databases only)', i.product_id::text from inventory i
 where i.available <> coalesce((select sum(change_amount) from inventory_adjustments a where a.product_id = i.product_id and a.bucket = 'available'), 0)
   and current_setting('he.invariants_history_baseline', true) = 'zero';
