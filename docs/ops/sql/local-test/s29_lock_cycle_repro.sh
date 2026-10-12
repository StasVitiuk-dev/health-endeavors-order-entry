#!/bin/bash
# EXT16 (INT-4): deterministic reproduction of the stress test's rare S29
# deadlock (GitHub CI 0722ae6, run 3 of 5: 8 deadlocks). LOCAL THROWAWAY
# DATABASE ONLY: it deletes every product, order and stock row first.
#
# The lock cycle, forced step by step:
#   S1 adds a delivery line for the product and has not committed yet.
#   S2 delete_unused_product: its "is it in use?" checks cannot see S1's line,
#      so it goes on and waits for the product (S1 holds a key-share lock).
#   S4 holds the product's stock row for a moment (stands in for "the delete
#      is a little slower"; in the real race it is just timing).
#   S1 commits: S2 locks the product, then waits for the stock row (S4).
#   S3 receive_purchase_order locks the order and its line, then waits for the
#      product (S2).
#   S4 commits: S2 deletes the product; the foreign-key check must lock S3's
#      line, and S3 waits for S2 -> deadlock. PostgreSQL cancels one call; its
#      transaction is rolled back, so no data is damaged.
# Prints "RESULT: DEADLOCK" with drafts/10 as of EXT16. Fix (EXT17): repeat the
# in-use checks after locking the product.
# Usage: s29_lock_cycle_repro.sh <psql connection args...> -d <database with drafts/10 installed>
PSQL="psql $* -qtA -v ON_ERROR_STOP=1"
P=a2900000-6666-4000-8000-000000000001; PO=a2900000-0000-4000-8000-000000000001
AS="set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);"
$PSQL >/dev/null <<SQL
insert into profiles (id, email, role) values ('00000000-0000-4000-8000-000000000001','o@example.test','owner') on conflict (id) do update set role='owner';
delete from inventory_adjustments; delete from expenses; delete from inventory_lots; delete from purchase_order_items; delete from purchase_orders; delete from inventory; delete from products; delete from suppliers;
insert into suppliers (id, name) values ('99999999-0000-4000-8000-000000000000','sup');
insert into products (id, name, sku) values ('$P','S29','S29'); insert into inventory (product_id) values ('$P');
insert into purchase_orders (id, po_number, status, supplier_id) values ('$PO','S29','shipped','99999999-0000-4000-8000-000000000000');
SQL
D=$(mktemp -d)
# S1 (t=0..2): the delivery line, not yet committed
$PSQL > $D/s1 2>&1 <<SQL &
begin; $AS insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('$PO','$P','x',1,1); select pg_sleep(2); commit;
SQL
sleep 0.5
# S2 (t=0.5): delete: its reference checks cannot see the uncommitted line; then waits for the product
$PSQL > $D/s2 2>&1 <<SQL &
$AS select delete_unused_product('$P');
SQL
sleep 0.5
# S4 (t=1..4): stands in for "the delete is a moment slower": holds the stock row
$PSQL > $D/s4 2>&1 <<SQL &
begin; select 1 from inventory where product_id='$P' for update; select pg_sleep(3); commit;
SQL
sleep 2
# S3 (t=3): the receive: locks the order and its line, then asks for the product
$PSQL > $D/s3 2>&1 <<SQL &
$AS select receive_purchase_order('$PO');
SQL
wait
for s in s2 s3; do echo "--- $s: $(tr '\n' ' ' < $D/$s | cut -c1-300)"; done
grep -l deadlock $D/s2 $D/s3 >/dev/null && echo RESULT: DEADLOCK || echo RESULT: no deadlock
rm -rf $D
