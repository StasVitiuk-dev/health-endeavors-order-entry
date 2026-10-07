#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-07, extension 6). Never point this at Supabase.
# Proves Query E (04_READONLY_E_stock_reconciliation.sql) reports nothing on
# consistent data and reports each planted problem. Needs R1 (drafts/10)
# installed locally, used to make a correct delivery.
# Usage: reconciliation_test.sh <psql args>   e.g. -h /var/tmp/hepg -p 5499 -U postgres -d he_real
P="psql $* -qtAX -v ON_ERROR_STOP=0 --set=client_min_messages=warning"
DIR="$(cd "$(dirname "$0")" && pwd)"
QE="$DIR/../04_READONLY_E_stock_reconciliation.sql"
OWN="set role authenticated; set request.jwt.claim.sub to '00000000-0000-4000-8000-000000000001';"
A=a6000000-0000-4000-8000-0000000000a1
PO=a6000000-0000-4000-8000-0000000000b1
PO2=a6000000-0000-4000-8000-0000000000b2
pass=0; failn=0
check() { if [ "$2" = "$3" ]; then echo "  ok   $1"; pass=$((pass+1)); else echo "  FAIL $1 (got '$2', want '$3')"; failn=$((failn+1)); fi; }
q() { $P -c "$1" 2>&1; }
result() { $P -F '|' -f "$QE" | awk -F'|' -v n="$1" '$2 == n { print $3 }'; }

reset() {
  q "delete from inventory_adjustments; delete from expenses; delete from inventory_lots; delete from purchase_orders; delete from purchase_order_items;
     delete from inventory; delete from order_items; delete from returns; delete from orders; delete from recalls; delete from products;
     insert into profiles (id,email,role) values ('00000000-0000-4000-8000-000000000001','recon-owner@example.test','owner') on conflict (id) do update set role='owner';
     insert into suppliers (id,name) values ('99999999-0000-4000-8000-000000000000','RECON supplier') on conflict do nothing;
     insert into products (id,name,sku) values ('$A','RECON A','RECON-A');
     insert into inventory (product_id) values ('$A');
     insert into purchase_orders (id, po_number, status, supplier_id, shipping_cost, tax, expense_category) values ('$PO','RECON-1','shipped','99999999-0000-4000-8000-000000000000',10,2,'ingredients');
     insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('$PO','$A','x',5,3), ('$PO','$A','y',7,1);" >/dev/null
  q "$OWN select receive_purchase_order('$PO')" >/dev/null
}

echo "1 consistent data: nothing reported"
reset
check "query is read-only and runs without error" "$($P -f "$QE" 2>&1 | grep -c ERROR)" 0
check "stock vs history: 0" "$(result 'product buckets whose stock differs from the sum of their history')" 0
check "received orders: 1" "$(result 'received orders (not deleted)')" 1
check "no line short" "$(result 'received orders: a line not fully received')" 0
check "stocked = received" "$(result 'received orders: units stocked differ from units received (PO numbers)')" none
check "has its expense" "$(result 'received orders with NO delivery expense (PO numbers)')" none
check "no duplicate expense" "$(result 'received orders with MORE THAN ONE delivery expense — possible duplicate (PO numbers)')" none
check "expense = lines + shipping + tax (5x3 + 7x1 + 10 + 2 = 34)" "$(result 'received orders whose expense differs from lines + shipping + tax (PO numbers)')" none

echo "2 planted problems"
q "update inventory set available = available + 5 where product_id='$A'" >/dev/null   # stock changed with no history
check "stock changed without history is found" "$(result 'product buckets whose stock differs from the sum of their history')" 1
check "and named (SKU, bucket, stock / history)" "$(result 'first 25 differences (SKU bucket: stock / history)')" "RECON-A available: 17 / 12"
reset
q "insert into expenses (category, amount, expense_date, note) values ('ingredients', 34, current_date, 'Purchase order RECON-1')" >/dev/null   # the retry duplicate
check "a duplicate delivery expense is found" "$(result 'received orders with MORE THAN ONE delivery expense — possible duplicate (PO numbers)')" "RECON-1 (2)"
q "update expenses set deleted_at = now() where ctid = (select ctid from expenses where note='Purchase order RECON-1' limit 1)" >/dev/null
check "a deleted (recycle bin) duplicate no longer counts" "$(result 'received orders with MORE THAN ONE delivery expense — possible duplicate (PO numbers)')" none
reset
q "delete from expenses" >/dev/null
check "a missing delivery expense is found" "$(result 'received orders with NO delivery expense (PO numbers)')" "RECON-1"
reset
q "update expenses set amount = 30" >/dev/null
check "a wrong expense amount is found" "$(result 'received orders whose expense differs from lines + shipping + tax (PO numbers)')" "RECON-1 (30 vs 34.00)"
reset
q "update purchase_order_items set quantity_received = 4 where description='x'" >/dev/null   # the race's footprint
check "a line not fully received is found" "$(result 'received orders: a line not fully received')" 1
check "and stocked vs received differs" "$(result 'received orders: units stocked differ from units received (PO numbers)')" "RECON-1 (12 stocked / 11 received)"
reset
q "insert into purchase_orders (id, po_number, status, supplier_id) values ('$PO2','RECON-2','ordered','99999999-0000-4000-8000-000000000000');
   insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$A','available',3,'Delivery received (RECON-2)');
   update inventory set available = available + 3 where product_id='$A'" >/dev/null
check "stock booked for an order that is not received is found" "$(result 'delivery history rows for an order that is not received')" 1
reset
q "insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$A','available',0,'nothing')" >/dev/null
check "a history row that changes nothing is found" "$(result 'history rows that change nothing (0)')" 1
reset
r=$(q "update inventory set available = -1 where product_id='$A'")
if grep -q 'violates check constraint' <<<"$r"; then echo "  (a negative available bucket is already impossible here: check rule)"; else check "a negative bucket is found" "$(result 'any bucket below zero')" 1; fi
r=$(q "update inventory set recalled = -1 where product_id='$A'")   # recalled has no database rule yet (Query B)
if grep -q 'violates check constraint' <<<"$r"; then echo "  (negative recalled refused too)"; else check "a negative recalled bucket is found" "$(result 'any bucket below zero')" 1; fi
reset
r=$(q "insert into inventory_adjustments (product_id, bucket, change_amount, reason) values (gen_random_uuid(),'available',1,'orphan')")
if grep -q 'foreign key' <<<"$r"; then echo "  (history for a missing product is already impossible: foreign key)"; else check "history for a missing product is found" "$(result 'history rows for a product that no longer exists')" 1; fi

echo "3 read-only proof"
before=$(q "select md5(string_agg(t::text, ',' order by t::text)) from (select * from inventory) t")
$P -f "$QE" >/dev/null 2>&1
check "running the query changed no stock" "$(q "select md5(string_agg(t::text, ',' order by t::text)) from (select * from inventory) t")" "$before"
check "it also runs inside a READ ONLY transaction" "$($P -c "begin transaction read only; $(cat "$QE") rollback;" 2>&1 | grep -c ERROR)" 0

echo "TOTAL: $pass passed, $failn failed"
[ "$failn" -eq 0 ]
