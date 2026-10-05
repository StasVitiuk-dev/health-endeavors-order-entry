#!/bin/bash
# LOCAL TEST ONLY — never point this at Supabase. Heavier, repeatable stress
# tests for the DRAFT stock functions (docs/ops/sql/drafts/10_…), on a
# throwaway local PostgreSQL with the guessed schema. Each scenario starts
# from a clean slate and checks an invariant; the whole set can be looped.
#
# Usage: stress_test.sh <runs> <psql connection args...>
#   e.g. stress_test.sh 10 -h /var/tmp/hepg -p 5499 -U postgres -d he_guess
# Output: one line per check, then a per-run summary with timings and the
# number of deadlock errors seen (must be 0).

RUNS=${1:-1}; shift
PSQL="psql $* -qtA -v ON_ERROR_STOP=1"
ERR=/tmp/he_stress_err.log
A=11111111-1111-4111-8111-111111111111
B=22222222-2222-4222-8222-222222222222
C=33333333-3333-4333-8333-333333333333

call() { $PSQL -c "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000$((RANDOM%9+1))',false); $1" >/dev/null 2>>"$ERR"; }
q() { $PSQL -c "$1"; }
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); [ -n "$VERBOSE" ] && echo "PASS  $1 ($2)"; else fail=$((fail+1)); echo "FAIL  $1: expected $3, got $2"; fi; }

reset() {
  $PSQL <<SQL
delete from inventory_adjustments; delete from expenses; delete from recalls; delete from returns; delete from order_items; delete from orders;
delete from purchase_order_items; delete from inventory_lots; delete from purchase_orders; delete from inventory; delete from products; delete from suppliers;
insert into products (id, name, sku) values ('$A','STRESS A','S-A'), ('$B','STRESS B','S-B'), ('$C','STRESS C','S-C');
insert into inventory (product_id, available) values ('$A', 1000), ('$B', 1000), ('$C', 1000);
SQL
}
# history must explain every bucket: start + sum(history) = current, per product/bucket
history_consistent() {
  q "select count(*) from (
       select i.product_id, b.bucket, (case b.bucket when 'available' then i.available when 'damaged' then i.damaged when 'recalled' then i.recalled when 'sample' then i.sample else 0 end) as now,
              (case b.bucket when 'available' then 1000 else 0 end) + coalesce((select sum(change_amount) from inventory_adjustments a where a.product_id=i.product_id and a.bucket=b.bucket),0) as expected
         from inventory i cross join (values ('available'),('damaged'),('recalled'),('sample')) b(bucket)) x where now <> expected"
}

run_once() {
  : > "$ERR"
  local t0=$(date +%s%N)

  # S1. 120 simultaneous mixed adjustments across 3 products and 2 buckets
  reset
  for i in $(seq 120); do
    p=$([ $((i%3)) = 0 ] && echo $A || ([ $((i%3)) = 1 ] && echo $B || echo $C))
    bucket=$([ $((i%2)) = 0 ] && echo available || echo sample)
    amt=$([ $((i%4)) = 0 ] && echo -3 || echo 2)
    [ $bucket = sample ] && amt=1
    call "select adjust_inventory('$p','$bucket',$amt,'s1');" &
  done; wait
  check "S1 120 mixed adjustments: history explains every bucket" "$(history_consistent)" 0
  check "S1 120 adjustments all recorded" "$(q "select count(*) from inventory_adjustments where reason='s1'")" 120

  # S2. below-zero race: 50 simultaneous -1 on 20 units
  reset; q "update inventory set damaged = 20 where product_id='$A'"
  q "insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$A','damaged',20,'seed')"
  for i in $(seq 50); do call "select adjust_inventory('$A','damaged',-1,'s2');" & done; wait
  check "S2 below-zero race: ends at exactly 0" "$(q "select damaged from inventory where product_id='$A'")" 0
  check "S2 below-zero race: exactly 20 succeeded" "$(q "select count(*) from inventory_adjustments where reason='s2'")" 20

  # S3. the same PO received 5× in a row (retries) then 25× at once
  reset
  q "insert into purchase_orders (id, po_number, status) values ('aaaaaaaa-0000-4000-8000-000000000001','S3','shipped')"
  q "insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) values ('aaaaaaaa-0000-4000-8000-000000000001','$A',40,2), ('aaaaaaaa-0000-4000-8000-000000000001','$B',10,5)"
  for i in $(seq 5); do call "select receive_purchase_order('aaaaaaaa-0000-4000-8000-000000000001');"; done
  for i in $(seq 25); do call "select receive_purchase_order('aaaaaaaa-0000-4000-8000-000000000001');" & done; wait
  check "S3 retries + 25 at once: A added once" "$(q "select available from inventory where product_id='$A'")" 1040
  check "S3 retries + 25 at once: B added once" "$(q "select available from inventory where product_id='$B'")" 1010
  check "S3 exactly one expense for the PO" "$(q "select count(*) from expenses where note='Purchase order S3'")" 1
  check "S3 expense amount = lines + shipping + tax" "$(q "select amount::numeric(10,2) from expenses where note='Purchase order S3'")" "130.00"

  # S4. 30 overlapping 3-product POs with lines in every product order, all at once
  reset
  q "insert into purchase_orders (id, po_number, status) select ('bbbbbbbb-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'S4-'||g, 'shipped' from generate_series(1,30) g"
  q "insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost)
       select ('bbbbbbbb-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid,
              (array['$A','$B','$C']::uuid[])[1 + ((g + k) % 3)], 1, 1
         from generate_series(1,30) g, generate_series(0,2) k
        order by g, case when g % 2 = 0 then -k else k end"
  local dl_before=$(grep -c deadlock "$ERR")
  for g in $(seq 30); do call "select receive_purchase_order(('bbbbbbbb-0000-4000-8000-' || lpad('$g',12,'0'))::uuid);" & done; wait
  check "S4 30 overlapping POs: all received" "$(q "select count(*) from purchase_orders where po_number like 'S4-%' and status='received'")" 30
  check "S4 no deadlock" "$(( $(grep -c deadlock "$ERR") - dl_before ))" 0
  check "S4 each product +30" "$(q "select string_agg(available::text, ',' order by product_id) from inventory")" "1030,1030,1030"
  check "S4 one expense per PO" "$(q "select count(*) from expenses where note like 'Purchase order S4-%'")" 30

  # S5. failure after the first product rolls everything back
  reset
  q "insert into purchase_orders (id, po_number, status) values ('cccccccc-0000-4000-8000-000000000001','S5','shipped')"
  q "insert into purchase_order_items (id, purchase_order_id, product_id, quantity, unit_cost) values
       ('cccccccc-1111-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','$A',7,1),
       ('cccccccc-1111-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000001','$C',9,1)"
  call "select receive_purchase_order('cccccccc-0000-4000-8000-000000000001', '[{\"line_id\":\"cccccccc-1111-4000-8000-000000000002\",\"lot_number\":\"$(printf 'X%.0s' $(seq 101))\"}]'::jsonb);"
  check "S5 failure on the last line: first product unchanged" "$(q "select available from inventory where product_id='$A'")" 1000
  check "S5 no history, no expense, PO still shipped" "$(q "select (select count(*) from inventory_adjustments)||'/'||(select count(*) from expenses)||'/'||(select status from purchase_orders where po_number='S5')")" "0/0/shipped"

  # S6. lot matching: literal and case-insensitive, never wildcard
  reset
  q "insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('dddddddd-0000-4000-8000-000000000001','$A','AB1',5,5)"
  q "insert into purchase_orders (id, po_number, status) values ('dddddddd-1111-4000-8000-000000000001','S6a','shipped'), ('dddddddd-1111-4000-8000-000000000002','S6b','shipped')"
  q "insert into purchase_order_items (id, purchase_order_id, product_id, quantity, unit_cost) values
       ('dddddddd-2222-4000-8000-000000000001','dddddddd-1111-4000-8000-000000000001','$A',3,1),
       ('dddddddd-2222-4000-8000-000000000002','dddddddd-1111-4000-8000-000000000002','$A',4,1)"
  call "select receive_purchase_order('dddddddd-1111-4000-8000-000000000001', '[{\"line_id\":\"dddddddd-2222-4000-8000-000000000001\",\"lot_number\":\"A_1\"}]'::jsonb);"
  call "select receive_purchase_order('dddddddd-1111-4000-8000-000000000002', '[{\"line_id\":\"dddddddd-2222-4000-8000-000000000002\",\"lot_number\":\"ab1\"}]'::jsonb);"
  check "S6 'A_1' made its own lot (no wildcard match on AB1)" "$(q "select quantity_remaining from inventory_lots where lot_number='A_1'")" 3
  check "S6 'ab1' matched AB1 (case-insensitive)" "$(q "select quantity_remaining from inventory_lots where lot_number='AB1'")" 9

  # S7. overlaps on the same product: recall + receive + return at once
  reset
  q "insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('eeeeeeee-0000-4000-8000-000000000001','$B','L7',50,50)"
  q "insert into recalls (id, lot_id, status) values ('eeeeeeee-1111-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001','initiated')"
  q "insert into purchase_orders (id, po_number, status) values ('eeeeeeee-2222-4000-8000-000000000001','S7','shipped')"
  q "insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) values ('eeeeeeee-2222-4000-8000-000000000001','$B',25,1)"
  q "insert into orders (id, order_number) values ('eeeeeeee-3333-4000-8000-000000000001','S7-O')"
  q "insert into order_items (id, order_id, sku, quantity) values ('eeeeeeee-4444-4000-8000-000000000001','eeeeeeee-3333-4000-8000-000000000001','S-B',4)"
  q "insert into returns (id, order_id, order_item_id, status) values ('eeeeeeee-5555-4000-8000-000000000001','eeeeeeee-3333-4000-8000-000000000001','eeeeeeee-4444-4000-8000-000000000001','approved')"
  for i in $(seq 8); do
    call "select quarantine_recall('eeeeeeee-1111-4000-8000-000000000001');" &
    call "select receive_purchase_order('eeeeeeee-2222-4000-8000-000000000001');" &
    call "select receive_return('eeeeeeee-5555-4000-8000-000000000001','restock_available');" &
    call "select adjust_inventory('$B','available',1,'s7');" &
  done; wait
  check "S7 recall+receive+return+8 adjustments overlap: history explains every bucket" "$(history_consistent)" 0
  check "S7 recall quarantined once (50)" "$(q "select recalled from inventory where product_id='$B'")" 50
  check "S7 B.available = 1000 + 25 received + 4 returned + 8 adjusted - 50 recalled" "$(q "select available from inventory where product_id='$B'")" 987

  # S8. product delete racing a stock change: never silent stock loss, no orphans
  reset
  q "update inventory set available = 0 where product_id='$C'"
  call "select delete_unused_product('$C');" & call "select adjust_inventory('$C','available',5,'s8');" & wait
  exists=$(q "select count(*) from products where id='$C'")
  if [ "$exists" = 1 ]; then
    check "S8 product kept: its stock matches its history" "$(q "select available - coalesce((select sum(change_amount) from inventory_adjustments where product_id='$C' and bucket='available'),0) from inventory where product_id='$C'")" 0
  else
    check "S8 product deleted: the adjustment did not land anywhere" "$(q "select count(*) from inventory_adjustments where product_id='$C'")" 0
  fi
  check "S8 no orphaned stock rows" "$(q "select count(*) from inventory i where not exists (select 1 from products p where p.id=i.product_id)")" 0

  # S9. quantity boundaries
  reset
  q "insert into orders (id, order_number) values ('ffffffff-0000-4000-8000-000000000001','S9')"
  q "insert into order_items (id, order_id, sku, quantity) values ('ffffffff-1111-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','S-A',3)"
  q "insert into returns (id, order_id, order_item_id, status) values ('ffffffff-2222-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','ffffffff-1111-4000-8000-000000000001','approved')"
  call "select receive_return('ffffffff-2222-4000-8000-000000000001','restock_available',0);"
  call "select receive_return('ffffffff-2222-4000-8000-000000000001','restock_available',-1);"
  call "select receive_return('ffffffff-2222-4000-8000-000000000001','restock_available',4);"
  call "select adjust_inventory('$A','available',2147483647,'s9-overflow');"
  call "select adjust_inventory('$A','available',0,'s9-zero');"
  call "select adjust_inventory('$A','not_a_bucket',1,'s9-bucket');"
  check "S9 bad return quantities refused, return still approved" "$(q "select status from returns where id='ffffffff-2222-4000-8000-000000000001'")" approved
  check "S9 overflow / zero / unknown bucket refused, stock unchanged" "$(q "select available||'/'||(select count(*) from inventory_adjustments) from inventory where product_id='$A'")" "1000/0"

  local t1=$(date +%s%N)
  echo "run $1: $pass passed, $fail failed, deadlocks seen: $(grep -c deadlock "$ERR"), $(( (t1 - t0) / 1000000 )) ms"
}

total_fail=0
for r in $(seq "$RUNS"); do pass=0; fail=0; run_once "$r"; total_fail=$((total_fail + fail)); done
echo "TOTAL: $RUNS run(s), failed checks: $total_fail"
exit $([ $total_fail = 0 ] && echo 0 || echo 1)
