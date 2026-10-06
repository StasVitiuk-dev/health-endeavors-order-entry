#!/bin/bash
# LOCAL TEST ONLY — never point this at Supabase. Heavier, repeatable stress
# tests for the DRAFT stock functions (docs/ops/sql/drafts/10_…), on a
# throwaway local PostgreSQL with the REAL table shapes from Query A
# (local-test/01_REAL_SHAPE_schema_for_local_tests.sql; since 2026-10-05).
# The parallel sessions act as owner profiles (stock is Owner/Admin only). Each scenario starts
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
# as a specific profile (e.g. the employee …0e1)
call_as() { $PSQL -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" >/dev/null 2>>"$ERR"; }
EMP=00000000-0000-4000-8000-0000000000e1
q() { $PSQL -c "$1"; }
# Test-only: lets S19 hold a receive open long enough to kill its connection.
$PSQL <<'SQL'
create or replace function public._stress_sleep() returns trigger language plpgsql as $f$
begin if current_setting('stress.sleep', true) = '1' then perform pg_sleep(3); end if; return new; end $f$;
drop trigger if exists _stress_sleep on public.expenses;
create trigger _stress_sleep before insert on public.expenses for each row execute function public._stress_sleep();
SQL
trap "$PSQL -c 'drop trigger if exists _stress_sleep on public.expenses; drop function if exists public._stress_sleep(); drop trigger if exists he_po_line_delete_guard on public.purchase_order_items; drop function if exists public._he_po_line_delete_guard();' >/dev/null" EXIT
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); [ -n "$VERBOSE" ] && echo "PASS  $1 ($2)"; else fail=$((fail+1)); echo "FAIL  $1: expected $3, got $2"; fi; }

reset() {
  $PSQL <<SQL
delete from inventory_adjustments; delete from expenses; delete from recalls; delete from returns; delete from order_items; delete from orders;
delete from inventory_lots; delete from purchase_orders; delete from purchase_order_items; delete from inventory; delete from products; delete from suppliers;
delete from audit_log;
insert into profiles (id, email, role) select ('00000000-0000-4000-8000-00000000000' || g)::uuid, 'stress' || g || '@example.test', 'owner'
  from generate_series(1, 9) g on conflict (id) do nothing;
insert into profiles (id, email, role) values ('$EMP', 'stress-employee@example.test', 'employee') on conflict (id) do nothing;
insert into suppliers (id, name) values ('99999999-0000-4000-8000-000000000000', 'STRESS supplier');
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

DL_LAST=0; DL_PREV=""
dl_mark() { local now=$(grep -c deadlock "$ERR"); if [ -n "$DL_PREV" ] && [ "$now" -gt "$DL_LAST" ]; then echo "  (deadlock during $DL_PREV: $((now - DL_LAST)))"; fi; DL_LAST=$now; DL_PREV="$1"; }
run_once() {
  : > "$ERR"; DL_LAST=0; DL_PREV=""
  local t0=$(date +%s%N)

  dl_mark "S1"
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

  dl_mark "S2"
  # S2. below-zero race: 50 simultaneous -1 on 20 units
  reset; q "update inventory set damaged = 20 where product_id='$A'"
  q "insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$A','damaged',20,'seed')"
  for i in $(seq 50); do call "select adjust_inventory('$A','damaged',-1,'s2');" & done; wait
  check "S2 below-zero race: ends at exactly 0" "$(q "select damaged from inventory where product_id='$A'")" 0
  check "S2 below-zero race: exactly 20 succeeded" "$(q "select count(*) from inventory_adjustments where reason='s2'")" 20

  dl_mark "S3"
  # S3. the same PO received 5× in a row (retries) then 25× at once
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('aaaaaaaa-0000-4000-8000-000000000001','S3','shipped','99999999-0000-4000-8000-000000000000')"
  q "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('aaaaaaaa-0000-4000-8000-000000000001','$A','A',40,2), ('aaaaaaaa-0000-4000-8000-000000000001','$B','B',10,5)"
  for i in $(seq 5); do call "select receive_purchase_order('aaaaaaaa-0000-4000-8000-000000000001');"; done
  for i in $(seq 25); do call "select receive_purchase_order('aaaaaaaa-0000-4000-8000-000000000001');" & done; wait
  check "S3 retries + 25 at once: A added once" "$(q "select available from inventory where product_id='$A'")" 1040
  check "S3 retries + 25 at once: B added once" "$(q "select available from inventory where product_id='$B'")" 1010
  check "S3 exactly one expense for the PO" "$(q "select count(*) from expenses where note='Purchase order S3'")" 1
  check "S3 expense amount = lines + shipping + tax" "$(q "select amount::numeric(10,2) from expenses where note='Purchase order S3'")" "130.00"

  dl_mark "S4"
  # S4. 30 overlapping 3-product POs with lines in every product order, all at once
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) select ('bbbbbbbb-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'S4-'||g, 'shipped', '99999999-0000-4000-8000-000000000000' from generate_series(1,30) g"
  q "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost)
       select ('bbbbbbbb-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid,
              (array['$A','$B','$C']::uuid[])[1 + ((g + k) % 3)], 'line', 1, 1
         from generate_series(1,30) g, generate_series(0,2) k
        order by g, case when g % 2 = 0 then -k else k end"
  local dl_before=$(grep -c deadlock "$ERR")
  for g in $(seq 30); do call "select receive_purchase_order(('bbbbbbbb-0000-4000-8000-' || lpad('$g',12,'0'))::uuid);" & done; wait
  check "S4 30 overlapping POs: all received" "$(q "select count(*) from purchase_orders where po_number like 'S4-%' and status='received'")" 30
  check "S4 no deadlock" "$(( $(grep -c deadlock "$ERR") - dl_before ))" 0
  check "S4 each product +30" "$(q "select string_agg(available::text, ',' order by product_id) from inventory")" "1030,1030,1030"
  check "S4 one expense per PO" "$(q "select count(*) from expenses where note like 'Purchase order S4-%'")" 30

  dl_mark "S5"
  # S5. failure after the first product rolls everything back
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('cccccccc-0000-4000-8000-000000000001','S5','shipped','99999999-0000-4000-8000-000000000000')"
  q "insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost) values
       ('cccccccc-1111-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','$A','A',7,1),
       ('cccccccc-1111-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000001','$C','C',9,1)"
  call "select receive_purchase_order('cccccccc-0000-4000-8000-000000000001', '[{\"line_id\":\"cccccccc-1111-4000-8000-000000000002\",\"lot_number\":\"$(printf 'X%.0s' $(seq 101))\"}]'::jsonb);"
  check "S5 failure on the last line: first product unchanged" "$(q "select available from inventory where product_id='$A'")" 1000
  check "S5 no history, no expense, PO still shipped" "$(q "select (select count(*) from inventory_adjustments)||'/'||(select count(*) from expenses)||'/'||(select status from purchase_orders where po_number='S5')")" "0/0/shipped"

  dl_mark "S6"
  # S6. lot matching: literal and case-insensitive, never wildcard
  reset
  q "insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('dddddddd-0000-4000-8000-000000000001','$A','AB1',5,5)"
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('dddddddd-1111-4000-8000-000000000001','S6a','shipped','99999999-0000-4000-8000-000000000000'), ('dddddddd-1111-4000-8000-000000000002','S6b','shipped','99999999-0000-4000-8000-000000000000')"
  q "insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost) values
       ('dddddddd-2222-4000-8000-000000000001','dddddddd-1111-4000-8000-000000000001','$A','A',3,1),
       ('dddddddd-2222-4000-8000-000000000002','dddddddd-1111-4000-8000-000000000002','$A','A',4,1)"
  call "select receive_purchase_order('dddddddd-1111-4000-8000-000000000001', '[{\"line_id\":\"dddddddd-2222-4000-8000-000000000001\",\"lot_number\":\"A_1\"}]'::jsonb);"
  call "select receive_purchase_order('dddddddd-1111-4000-8000-000000000002', '[{\"line_id\":\"dddddddd-2222-4000-8000-000000000002\",\"lot_number\":\"ab1\"}]'::jsonb);"
  check "S6 'A_1' made its own lot (no wildcard match on AB1)" "$(q "select quantity_remaining from inventory_lots where lot_number='A_1'")" 3
  check "S6 'ab1' matched AB1 (case-insensitive)" "$(q "select quantity_remaining from inventory_lots where lot_number='AB1'")" 9

  dl_mark "S7"
  # S7. overlaps on the same product: recall + receive + return at once
  reset
  q "insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('eeeeeeee-0000-4000-8000-000000000001','$B','L7',50,50)"
  q "insert into recalls (id, lot_id, product_id, reason, status) values ('eeeeeeee-1111-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001','$B','STRESS recall','initiated')"
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('eeeeeeee-2222-4000-8000-000000000001','S7','shipped','99999999-0000-4000-8000-000000000000')"
  q "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('eeeeeeee-2222-4000-8000-000000000001','$B','B',25,1)"
  q "insert into orders (id, channel, order_number) values ('eeeeeeee-3333-4000-8000-000000000001','manual','S7-O')"
  q "insert into order_items (id, order_id, sku, quantity) values ('eeeeeeee-4444-4000-8000-000000000001','eeeeeeee-3333-4000-8000-000000000001','S-B',4)"
  q "insert into returns (id, order_id, order_item_id, reason, status) values ('eeeeeeee-5555-4000-8000-000000000001','eeeeeeee-3333-4000-8000-000000000001','eeeeeeee-4444-4000-8000-000000000001','damaged','approved')"
  for i in $(seq 8); do
    call "select quarantine_recall('eeeeeeee-1111-4000-8000-000000000001');" &
    call "select receive_purchase_order('eeeeeeee-2222-4000-8000-000000000001');" &
    call "select receive_return('eeeeeeee-5555-4000-8000-000000000001','restock_available');" &
    call "select adjust_inventory('$B','available',1,'s7');" &
  done; wait
  check "S7 recall+receive+return+8 adjustments overlap: history explains every bucket" "$(history_consistent)" 0
  check "S7 recall quarantined once (50)" "$(q "select recalled from inventory where product_id='$B'")" 50
  check "S7 B.available = 1000 + 25 received + 4 returned + 8 adjusted - 50 recalled" "$(q "select available from inventory where product_id='$B'")" 987

  dl_mark "S8"
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

  dl_mark "S9"
  # S9. quantity boundaries
  reset
  q "insert into orders (id, channel, order_number) values ('ffffffff-0000-4000-8000-000000000001','manual','S9')"
  q "insert into order_items (id, order_id, sku, quantity) values ('ffffffff-1111-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','S-A',3)"
  q "insert into returns (id, order_id, order_item_id, reason, status) values ('ffffffff-2222-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','ffffffff-1111-4000-8000-000000000001','damaged','approved')"
  call "select receive_return('ffffffff-2222-4000-8000-000000000001','restock_available',0);"
  call "select receive_return('ffffffff-2222-4000-8000-000000000001','restock_available',-1);"
  call "select receive_return('ffffffff-2222-4000-8000-000000000001','restock_available',4);"
  call "select adjust_inventory('$A','available',2147483647,'s9-overflow');"
  call "select adjust_inventory('$A','available',0,'s9-zero');"
  call "select adjust_inventory('$A','not_a_bucket',1,'s9-bucket');"
  check "S9 bad return quantities refused, return still approved" "$(q "select status from returns where id='ffffffff-2222-4000-8000-000000000001'")" approved
  check "S9 overflow / zero / unknown bucket refused, stock unchanged" "$(q "select available||'/'||(select count(*) from inventory_adjustments) from inventory where product_id='$A'")" "1000/0"

  dl_mark "S10"
  # S10. 60 tabs that all saw 1000 adjust at once with the expected value:
  # exactly one wins, the rest are refused as stale (no lost update, no double)
  reset
  for i in $(seq 60); do call "select adjust_inventory('$A','available',1,'s10',1000);" & done; wait
  check "S10 60 stale-checked adjustments: exactly one applied" "$(q "select count(*) from inventory_adjustments where reason='s10'")" 1
  check "S10 stock = 1001" "$(q "select available from inventory where product_id='$A'")" 1001
  # …and 80 plain +1 on one hot row at once: all applied, none lost
  for i in $(seq 80); do call "select adjust_inventory('$B','available',1,'s10hot');" & done; wait
  check "S10 80 simultaneous +1 on one row: 1080" "$(q "select available from inventory where product_id='$B'")" 1080
  check "S10 history explains every bucket" "$(history_consistent)" 0

  dl_mark "S11"
  # S11. 20 returns of the same product (SKU in mixed case), each sent 3× at once
  reset
  q "insert into orders (id, channel, order_number) values ('a1100000-0000-4000-8000-000000000001','manual','S11')"
  q "insert into order_items (id, order_id, sku, quantity)
       select ('a1100000-1111-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'a1100000-0000-4000-8000-000000000001',
              (array['s-a','S-A','S-a'])[1 + g % 3], 1 from generate_series(1,20) g"
  q "insert into returns (id, order_id, order_item_id, reason, status)
       select ('a1100000-2222-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'a1100000-0000-4000-8000-000000000001',
              ('a1100000-1111-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'other', 'approved' from generate_series(1,20) g"
  for g in $(seq 20); do for k in 1 2 3; do
    call "select receive_return(('a1100000-2222-4000-8000-' || lpad('$g',12,'0'))::uuid, 'restock_available');" &
  done; done; wait
  check "S11 each return restocked exactly once (A = 1020)" "$(q "select available from inventory where product_id='$A'")" 1020
  check "S11 all 20 received" "$(q "select count(*) from returns where status='received'")" 20
  check "S11 20 history rows" "$(q "select count(*) from inventory_adjustments where reason like 'Return received%'")" 20

  dl_mark "S12"
  # S12. 6 recalls whose lots (60) exceed what is in stock (30), each sent 3× at once
  reset; q "update inventory set available = 30 where product_id='$B'"
  q "update inventory set available = 30 where product_id='$B'; insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$B','available',-970,'seed')"
  q "insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining)
       select ('a1200000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, '$B', 'S12-' || g, 10, 10 from generate_series(1,6) g"
  q "insert into recalls (id, lot_id, product_id, reason, status)
       select ('a1200000-1111-4000-8000-' || lpad(g::text,12,'0'))::uuid, ('a1200000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, '$B', 'S12', 'initiated' from generate_series(1,6) g"
  for g in $(seq 6); do for k in 1 2 3; do
    call "select quarantine_recall(('a1200000-1111-4000-8000-' || lpad('$g',12,'0'))::uuid);" &
  done; done; wait
  check "S12 never below zero; available + recalled = 30" "$(q "select (available >= 0)::text || '/' || (available + recalled) from inventory where product_id='$B'")" "true/30"
  check "S12 quarantined amounts add up to Recalled" "$(q "select (select coalesce(sum(quantity_quarantined),0) from recalls) = recalled from inventory where product_id='$B'")" t
  check "S12 history explains every bucket" "$(history_consistent)" 0

  dl_mark "S13"
  # S13. depletion race: 40 × -5 and 10 × +1 at once on 100 units
  reset; q "update inventory set available = 100 where product_id='$C'; insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$C','available',-900,'seed')"
  for i in $(seq 40); do call "select adjust_inventory('$C','available',-5,'s13');" & done
  for i in $(seq 10); do call "select adjust_inventory('$C','available',1,'s13');" & done; wait
  check "S13 never below zero" "$(q "select (available >= 0) from inventory where product_id='$C'")" t
  check "S13 stock = 100 + the changes that were recorded" "$(q "select available = 100 + (select coalesce(sum(change_amount),0) from inventory_adjustments where reason='s13') from inventory where product_id='$C'")" t
  check "S13 history explains every bucket" "$(history_consistent)" 0

  dl_mark "S14"
  # S14. the same NEW lot (any letter case) on 10 deliveries received at once
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) select ('a1400000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'S14-'||g, 'shipped', '99999999-0000-4000-8000-000000000000' from generate_series(1,10) g"
  q "insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost)
       select ('a1400000-1111-4000-8000-' || lpad(g::text,12,'0'))::uuid, ('a1400000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, '$C', 'C', 3, 1 from generate_series(1,10) g"
  local dup_before=$(grep -c 'duplicate key' "$ERR")
  for g in $(seq 10); do
    lot=$([ $((g%2)) = 0 ] && echo "Lot-X" || echo "LOT-x")
    call "select receive_purchase_order(('a1400000-0000-4000-8000-' || lpad('$g',12,'0'))::uuid, jsonb_build_array(jsonb_build_object('line_id', ('a1400000-1111-4000-8000-' || lpad('$g',12,'0')), 'lot_number', '$lot')));" &
  done; wait
  check "S14 one lot row holding all 30 units" "$(q "select count(*) || '/' || sum(quantity_remaining)::int from inventory_lots where lower(lot_number)='lot-x'")" "1/30"
  check "S14 all 10 received, no duplicate-key failures" "$(q "select count(*) from purchase_orders where po_number like 'S14-%' and status='received'")/$(( $(grep -c 'duplicate key' "$ERR") - dup_before ))" "10/0"

  dl_mark "S15"
  # S15. deleting products while they are being received / quarantined (30 + 30 pairs)
  reset
  q "insert into products (id, name, sku) select ('a1500000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'S15-'||g, 'S15-'||g from generate_series(1,60) g"
  q "insert into inventory (product_id, available) select ('a1500000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, case when g > 30 then 5 else 0 end from generate_series(1,60) g"
  q "insert into purchase_orders (id, po_number, status, supplier_id) select ('a1500000-1111-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'S15-'||g, 'shipped', '99999999-0000-4000-8000-000000000000' from generate_series(1,30) g"
  q "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) select ('a1500000-1111-4000-8000-' || lpad(g::text,12,'0'))::uuid, ('a1500000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'x', 2, 1 from generate_series(1,30) g"
  q "insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) select ('a1500000-2222-4000-8000-' || lpad(g::text,12,'0'))::uuid, ('a1500000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'L'||g, 5, 5 from generate_series(31,60) g"
  q "insert into recalls (id, lot_id, product_id, reason, status) select ('a1500000-3333-4000-8000-' || lpad(g::text,12,'0'))::uuid, ('a1500000-2222-4000-8000-' || lpad(g::text,12,'0'))::uuid, ('a1500000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'S15', 'initiated' from generate_series(31,60) g"
  local dl15=$(grep -c deadlock "$ERR")
  for g in $(seq 30); do
    call "select receive_purchase_order(('a1500000-1111-4000-8000-' || lpad('$g',12,'0'))::uuid);" &
    call "select delete_unused_product(('a1500000-0000-4000-8000-' || lpad('$g',12,'0'))::uuid);" &
  done
  for g in $(seq 31 60); do
    call "select quarantine_recall(('a1500000-3333-4000-8000-' || lpad('$g',12,'0'))::uuid);" &
    call "select delete_unused_product(('a1500000-0000-4000-8000-' || lpad('$g',12,'0'))::uuid);" &
  done; wait
  check "S15 no deadlock (delete vs receive / quarantine)" "$(( $(grep -c deadlock "$ERR") - dl15 ))" 0
  check "S15 products in use were all kept" "$(q "select count(*) from products where name like 'S15-%'")" 60
  check "S15 every delivery received, every recall quarantined" "$(q "select (select count(*) from purchase_orders where po_number like 'S15-%' and status='received') || '/' || (select count(*) from recalls where reason='S15' and status='quarantined')")" "30/30"

  dl_mark "S16"
  # S16. two stale tabs: both showed 1000; the first save wins, the second is refused
  reset
  call "select adjust_inventory('$A','available',5,'s16',1000);"
  call "select adjust_inventory('$A','available',-3,'s16',1000);"
  check "S16 stale second tab refused (1005, one history row)" "$(q "select available || '/' || (select count(*) from inventory_adjustments where reason='s16') from inventory where product_id='$A'")" "1005/1"

  dl_mark "S17"
  # S17. an employee hammering stock actions (refused) while the owner receives once
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('a1700000-0000-4000-8000-000000000001','S17','shipped','99999999-0000-4000-8000-000000000000')"
  q "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('a1700000-0000-4000-8000-000000000001','$A','A',6,1)"
  for i in $(seq 10); do
    call_as $EMP "select receive_purchase_order('a1700000-0000-4000-8000-000000000001');" &
    call_as $EMP "select adjust_inventory('$A','available',1,'s17-emp');" &
  done
  call "select receive_purchase_order('a1700000-0000-4000-8000-000000000001');" & wait
  check "S17 employee changed nothing; owner's receive applied once (A = 1006)" "$(q "select available || '/' || (select count(*) from inventory_adjustments where reason='s17-emp') from inventory where product_id='$A'")" "1006/0"
  check "S17 refusals were permission errors" "$( [ $(grep -c 'Only the Owner or an Administrator' "$ERR") -ge 20 ] && echo yes || echo no)" yes

  dl_mark "S19"
  # S19. the connection dies in the middle of a receive (before it commits):
  # nothing is kept, and the retry receives exactly once
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('a1900000-0000-4000-8000-000000000001','S19','shipped','99999999-0000-4000-8000-000000000000')"
  q "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('a1900000-0000-4000-8000-000000000001','$A','A',4,2), ('a1900000-0000-4000-8000-000000000001','$B','B',3,2)"
  call "select set_config('stress.sleep','1',false); select receive_purchase_order('a1900000-0000-4000-8000-000000000001');" &
  until [ "$(q "select count(*) from pg_stat_activity where query like '%a1900000-0000-4000-8000-000000000001%' and wait_event = 'PgSleep'")" = 1 ]; do :; done
  q "select pg_terminate_backend(pid) from pg_stat_activity where query like '%a1900000-0000-4000-8000-000000000001%' and wait_event = 'PgSleep'" >/dev/null
  wait
  check "S19 killed mid-receive: nothing kept" "$(q "select (select available from inventory where product_id='$A') || '/' || (select count(*) from inventory_adjustments) || '/' || (select count(*) from expenses) || '/' || (select status from purchase_orders where po_number='S19')")" "1000/0/0/shipped"
  call "select receive_purchase_order('a1900000-0000-4000-8000-000000000001');"
  call "select receive_purchase_order('a1900000-0000-4000-8000-000000000001');"
  check "S19 retry receives exactly once" "$(q "select (select available from inventory where product_id='$A') || '/' || (select count(*) from expenses)")" "1004/1"

  dl_mark "S20"
  # S20. 100 callers at once across every function: 30 adjustments, 10 POs each
  # sent twice, 10 returns each sent twice, 5 recalls each sent 3x, and 5
  # unused products deleted while 5 adjustments target them
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) select ('a2000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'S20-'||g, 'shipped', '99999999-0000-4000-8000-000000000000' from generate_series(1,10) g"
  q "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) select ('a2000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, (array['$A','$B','$C']::uuid[])[1 + g % 3], 'x', 2, 1 from generate_series(1,10) g"
  q "insert into orders (id, channel, order_number) values ('a2000000-1111-4000-8000-000000000001','manual','S20')"
  q "insert into order_items (id, order_id, sku, quantity) select ('a2000000-2222-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'a2000000-1111-4000-8000-000000000001', (array['s-a','S-B','s-C'])[1 + g % 3], 1 from generate_series(1,10) g"
  q "insert into returns (id, order_id, order_item_id, reason, status) select ('a2000000-3333-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'a2000000-1111-4000-8000-000000000001', ('a2000000-2222-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'other', 'approved' from generate_series(1,10) g"
  q "insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) select ('a2000000-4444-4000-8000-' || lpad(g::text,12,'0'))::uuid, '$A', 'S20L'||g, 3, 3 from generate_series(1,5) g"
  q "insert into recalls (id, lot_id, product_id, reason, status) select ('a2000000-5555-4000-8000-' || lpad(g::text,12,'0'))::uuid, ('a2000000-4444-4000-8000-' || lpad(g::text,12,'0'))::uuid, '$A', 'S20', 'initiated' from generate_series(1,5) g"
  q "insert into products (id, name, sku) select ('a2000000-6666-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'S20-del-'||g, 'S20D'||g from generate_series(1,5) g"
  q "insert into inventory (product_id, available) select ('a2000000-6666-4000-8000-' || lpad(g::text,12,'0'))::uuid, 0 from generate_series(1,5) g"
  local dl20=$(grep -c deadlock "$ERR")
  for i in $(seq 30); do p=$([ $((i%3)) = 0 ] && echo $A || ([ $((i%3)) = 1 ] && echo $B || echo $C)); call "select adjust_inventory('$p','available',$([ $((i%2)) = 0 ] && echo 1 || echo -1),'s20');" & done
  for g in $(seq 10); do for k in 1 2; do call "select receive_purchase_order(('a2000000-0000-4000-8000-' || lpad('$g',12,'0'))::uuid);" & done; done
  for g in $(seq 10); do for k in 1 2; do call "select receive_return(('a2000000-3333-4000-8000-' || lpad('$g',12,'0'))::uuid,'restock_available');" & done; done
  for g in $(seq 5); do for k in 1 2 3; do call "select quarantine_recall(('a2000000-5555-4000-8000-' || lpad('$g',12,'0'))::uuid);" & done; done
  for g in $(seq 5); do
    call "select delete_unused_product(('a2000000-6666-4000-8000-' || lpad('$g',12,'0'))::uuid);" &
    call "select adjust_inventory(('a2000000-6666-4000-8000-' || lpad('$g',12,'0'))::uuid,'available',1,'s20-del');" &
  done; wait
  check "S20 100 callers: no deadlock" "$(( $(grep -c deadlock "$ERR") - dl20 ))" 0
  check "S20 every PO received once (10 expenses)" "$(q "select (select count(*) from purchase_orders where po_number like 'S20-%' and status='received') || '/' || (select count(*) from expenses where note like 'Purchase order S20-%')")" "10/10"
  check "S20 every return restocked once" "$(q "select (select count(*) from returns where status='received') || '/' || (select count(*) from inventory_adjustments where reason like 'Return received%')")" "10/10"
  check "S20 each recall quarantined once (15 units)" "$(q "select (select count(*) from recalls where reason='S20' and status='quarantined') || '/' || (select recalled from inventory where product_id='$A')")" "5/15"
  # (history_consistent assumes every stock row started at 1000 available; the
  # S20 delete-race products start at 0, so check them with their own start)
  check "S20 history explains every bucket (A, B, C from 1000; delete-race products from 0)" "$(q "select count(*) from inventory i
       where i.available <> (case when i.product_id in ('$A','$B','$C') then 1000 else 0 end)
                              + coalesce((select sum(change_amount) from inventory_adjustments a where a.product_id=i.product_id and a.bucket='available'),0)
          or i.recalled <> coalesce((select sum(change_amount) from inventory_adjustments a where a.product_id=i.product_id and a.bucket='recalled'),0)")" 0
  check "S20 deleted-or-kept products consistent (no orphan stock, history only on kept ones)" "$(q "select count(*) from inventory_adjustments a where a.reason='s20-del' and not exists (select 1 from products p where p.id=a.product_id)")/$(q "select count(*) from inventory i where not exists (select 1 from products p where p.id=i.product_id)")" "0/0"

  # AL (EXT4): every data-integrity rule holds after the busiest scenario.
  check "S20 data-integrity invariants hold (invariants.sql: no broken rule)" "$($PSQL -f "$(dirname "$0")/invariants.sql" | grep -c .)" 0

  dl_mark "S21"
  # S21 (EXT3; EXT4 adds 150 and 200). Operator ladder: 2 … 200 people adjust the same
  # product at once. Every level: nothing lost, nothing doubled, history
  # explains the stock; the time per level is printed so a slowdown that
  # grows faster than the load would show up.
  local ladder=""
  for n in 2 5 10 25 50 100 150 200; do
    reset
    local l0=$(date +%s%N)
    for i in $(seq $n); do call "select adjust_inventory('$A','available',1,'s21');" & done; wait
    local l1=$(date +%s%N)
    check "S21 $n operators: stock = 1000 + $n" "$(q "select available from inventory where product_id='$A'")" "$((1000 + n))"
    check "S21 $n operators: $n history rows" "$(q "select count(*) from inventory_adjustments where reason='s21'")" "$n"
    ladder="$ladder $n:$(( (l1 - l0) / 1000000 ))ms"
  done
  [ -n "$VERBOSE" ] && echo "  S21 ladder:$ladder"
  S21_LADDER="$ladder"

  dl_mark "S22"
  # S22 (EXT3). The dashboard's stale-tab protection is a conditional update
  # ("approve only while still pending"). Prove the database lets exactly one
  # of many simultaneous conditional updates win: 100 Approve + 20 Reject on
  # one request at the same moment. The audit trigger writes one row per
  # real change, so it counts the winners.
  reset
  q "delete from approval_requests; insert into approval_requests (id, action_type, summary, status) values ('a2200000-0000-4000-8000-000000000001','stress','S22','pending')"
  for i in $(seq 100); do call "update approval_requests set status='approved', reviewed_at=now() where id='a2200000-0000-4000-8000-000000000001' and status='pending';" & done
  for i in $(seq 20); do call "update approval_requests set status='rejected', reviewed_at=now() where id='a2200000-0000-4000-8000-000000000001' and status='pending';" & done
  wait
  check "S22 120 simultaneous decisions: exactly one changed the request" "$(q "select count(*) from audit_log where table_name='approval_requests' and record_id='a2200000-0000-4000-8000-000000000001' and action='UPDATE'")" 1
  check "S22 final status is a decision" "$(q "select status in ('approved','rejected') from approval_requests where id='a2200000-0000-4000-8000-000000000001'")" t

  dl_mark "S23"
  # S23 (EXT3). Task buttons from many tabs: 50 "Mark in progress" (only from
  # open) and 50 "Mark done" (only from open / in progress) at once. Done is
  # final: it can never be moved back to in progress, whatever the order.
  reset
  q "delete from tasks; insert into tasks (id, title, status) values ('a2300000-0000-4000-8000-000000000001','S23','open')"
  for i in $(seq 50); do
    call "update tasks set status='in_progress' where id='a2300000-0000-4000-8000-000000000001' and status in ('open');" &
    call "update tasks set status='done' where id='a2300000-0000-4000-8000-000000000001' and status in ('open','in_progress');" &
  done; wait
  check "S23 100 task clicks: ends done" "$(q "select status from tasks where id='a2300000-0000-4000-8000-000000000001'")" done
  check "S23 at most one move to in progress and exactly one to done (2 or fewer changes)" "$(q "select (count(*) filter (where new_data->>'status'='done'))::text || '/' || (count(*) filter (where new_data->>'status'='in_progress') <= 1)::text from audit_log where table_name='tasks' and record_id='a2300000-0000-4000-8000-000000000001' and action='UPDATE'")" "1/true"
  check "S23 never moved backwards (no change away from done)" "$(q "select count(*) from audit_log where table_name='tasks' and record_id='a2300000-0000-4000-8000-000000000001' and action='UPDATE' and old_data->>'status'='done'")" 0

  dl_mark "S24"
  # S24 (EXT3). Return decision from many tabs: 30 Approve + 30 Reject, each
  # only while still "requested": exactly one wins.
  reset
  q "insert into orders (id, channel, order_number) values ('a2400000-1111-4000-8000-000000000001','manual','S24')"
  q "insert into order_items (id, order_id, sku, quantity) values ('a2400000-2222-4000-8000-000000000001','a2400000-1111-4000-8000-000000000001','S-A',1)"
  q "insert into returns (id, order_id, order_item_id, reason, status) values ('a2400000-3333-4000-8000-000000000001','a2400000-1111-4000-8000-000000000001','a2400000-2222-4000-8000-000000000001','other','requested')"
  for i in $(seq 30); do
    call "update returns set status='approved' where id='a2400000-3333-4000-8000-000000000001' and status='requested';" &
    call "update returns set status='rejected' where id='a2400000-3333-4000-8000-000000000001' and status='requested';" &
  done; wait
  check "S24 60 simultaneous return decisions: exactly one change" "$(q "select count(*) from audit_log where table_name='returns' and record_id='a2400000-3333-4000-8000-000000000001' and action='UPDATE'")" 1

  dl_mark "S25"
  # S25 (EXT3). Cancel racing Receive on the same shipped purchase order (20
  # of each at once). It must end fully received (stock +10 once, one
  # expense) or fully cancelled (no stock, no expense) — never both, never
  # half.
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('a2500000-0000-4000-8000-000000000001','S25','shipped','99999999-0000-4000-8000-000000000000')"
  q "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('a2500000-0000-4000-8000-000000000001','$A','x',10,1)"
  local dl25=$(grep -c deadlock "$ERR")
  for i in $(seq 20); do
    call "update purchase_orders set status='cancelled' where id='a2500000-0000-4000-8000-000000000001' and status in ('draft','ordered','shipped') and deleted_at is null;" &
    call "select receive_purchase_order('a2500000-0000-4000-8000-000000000001');" &
  done; wait
  check "S25 cancel vs receive: all-or-nothing outcome" "$(q "select case (select status from purchase_orders where id='a2500000-0000-4000-8000-000000000001')
      when 'received' then ((select available from inventory where product_id='$A') = 1010 and (select count(*) from expenses where note='Purchase order S25') = 1)::text
      when 'cancelled' then ((select available from inventory where product_id='$A') = 1000 and (select count(*) from expenses) = 0)::text
      else 'unexpected status' end")" true
  check "S25 no deadlock" "$(( $(grep -c deadlock "$ERR") - dl25 ))" 0

  dl_mark "S26"
  # S26 (EXT4). The same new lot number arrives on 20 purchase orders that are
  # received at the same moment. One lot row, quantities added up, stock and
  # history exact, 20 expenses.
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) select ('a2600000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'S26-'||g, 'shipped', '99999999-0000-4000-8000-000000000000' from generate_series(1,20) g"
  q "insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost) select ('a2600000-1111-4000-8000-' || lpad(g::text,12,'0'))::uuid, ('a2600000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, '$A', 'x', g, 1 from generate_series(1,20) g"
  for g in $(seq 1 20); do
    call "select receive_purchase_order('a2600000-0000-4000-8000-$(printf %012d $g)', '[{\"line_id\":\"a2600000-1111-4000-8000-$(printf %012d $g)\",\"lot_number\":\"$( [ $((g%2)) = 0 ] && echo l-same || echo L-SAME )\"}]'::jsonb);" &
  done; wait
  check "S26 one lot row for L-SAME / l-same (case-insensitive)" "$(q "select count(*) from inventory_lots where lower(lot_number)='l-same'")" 1
  check "S26 lot received = 1+2+…+20 = 210" "$(q "select quantity_received::int || '/' || quantity_remaining::int from inventory_lots where lower(lot_number)='l-same'")" "210/210"
  check "S26 stock = 1000 + 210, 20 expenses" "$(q "select (select available from inventory where product_id='$A') || '/' || (select count(*) from expenses)")" "1210/20"
  check "S26 history explains stock" "$(history_consistent)" 0
  check "S26 data-integrity invariants hold" "$($PSQL -f "$(dirname "$0")/invariants.sql" | grep -c .)" 0

  dl_mark "S27"
  # S27 (EXT4; EXT5 adds add-line and quantity-change). A purchase-order line
  # is removed / added / re-quantified while the order is received. Without a
  # guard the order and its stock can disagree (counted for the record, not a
  # check). With the draft guard (drafts/17_…) installed they must always
  # agree, with no deadlock. "Agree" = the order is received AND every line
  # has quantity_received = quantity AND stock grew by exactly the sum of the
  # lines; or the receive did not happen and stock did not move.
  s27_action() {
    case "$1" in
      delete) echo "delete from purchase_order_items where id='a2700000-1111-4000-8000-000000000002';" ;;
      add)    echo "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('a2700000-0000-4000-8000-000000000001','$A','late',3,1);" ;;
      qty)    echo "update purchase_order_items set quantity = 9 where id='a2700000-1111-4000-8000-000000000002';" ;;
    esac
  }
  s27_round() {
    local bad=0 kind=$1
    for i in $(seq 1 20); do
      reset
      q "insert into purchase_orders (id, po_number, status, supplier_id) values ('a2700000-0000-4000-8000-000000000001','S27','ordered','99999999-0000-4000-8000-000000000000')"
      q "insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost) values ('a2700000-1111-4000-8000-000000000001','a2700000-0000-4000-8000-000000000001','$A','x',5,1), ('a2700000-1111-4000-8000-000000000002','a2700000-0000-4000-8000-000000000001','$A','y',7,1)"
      call "select receive_purchase_order('a2700000-0000-4000-8000-000000000001');" &
      call "$(s27_action $kind)" &
      wait
      [ "$(q "select case (select status from purchase_orders where id='a2700000-0000-4000-8000-000000000001')
          when 'received' then (not exists (select 1 from purchase_order_items where purchase_order_id='a2700000-0000-4000-8000-000000000001' and coalesce(quantity_received,0) <> quantity)
                                and (select available from inventory where product_id='$A') = 1000 + (select sum(quantity) from purchase_order_items where purchase_order_id='a2700000-0000-4000-8000-000000000001'))::text
          else ((select available from inventory where product_id='$A') = 1000)::text end")" = true ] || bad=$((bad+1))
    done
    echo $bad
  }
  S27_UNGUARDED=""
  for k in delete add qty; do S27_UNGUARDED="$S27_UNGUARDED $k:$(s27_round $k)/20"; done
  $PSQL -f "$(dirname "$0")/../drafts/17_DRAFT_po_line_delete_guard.sql" >/dev/null
  local dl27=$(grep -c deadlock "$ERR")
  for k in delete add qty; do
    check "S27 with the line guard ($k vs receive): order and stock always agree (20 races)" "$(s27_round $k)" 0
  done
  check "S27 with the line guard: no deadlock" "$(( $(grep -c deadlock "$ERR") - dl27 ))" 0
  # the receive itself may still write quantity_received / landed_unit_cost on a received order's lines
  reset
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('a2700000-0000-4000-8000-000000000003','S27b','received','99999999-0000-4000-8000-000000000000')"
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('a2700000-0000-4000-8000-000000000004','S27c','ordered','99999999-0000-4000-8000-000000000000')"
  q "insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost) values ('a2700000-1111-4000-8000-000000000009','a2700000-0000-4000-8000-000000000004','$A','z',2,1)"
  q "update purchase_orders set status='received' where id='a2700000-0000-4000-8000-000000000004'"
  check "S27 guard allows receive bookkeeping (quantity_received, landed cost) on a received order" "$($PSQL -c "update purchase_order_items set quantity_received = 2, landed_unit_cost = 1.5 where id='a2700000-1111-4000-8000-000000000009'" 2>&1 | grep -c ERROR)" 0
  check "S27 guard refuses a quantity change on a received order" "$($PSQL -c "update purchase_order_items set quantity = 3 where id='a2700000-1111-4000-8000-000000000009'" 2>&1 | grep -c 'can no longer be changed')" 1
  check "S27 guard refuses adding a line to a received order" "$($PSQL -c "insert into purchase_order_items (purchase_order_id, description, quantity) values ('a2700000-0000-4000-8000-000000000003','late',1)" 2>&1 | grep -c 'can no longer be changed')" 1
  check "S27 guard still lets a whole order be deleted (cascade)" "$($PSQL -c "delete from purchase_orders where id='a2700000-0000-4000-8000-000000000004'" 2>&1 | grep -c ERROR)" 0
  $PSQL -f "$(dirname "$0")/../drafts/18_DRAFT_rollback_po_line_delete_guard.sql" >/dev/null
  check "S27 guard rollback leaves no trigger" "$(q "select count(*) from pg_trigger where tgname='he_po_line_delete_guard'")" 0
  [ -n "$VERBOSE" ] && echo "  S27 without the guard (out of 20 races each):$S27_UNGUARDED"

  dl_mark "S28"
  # S28 (EXT4). A recall is quarantined while 30 people take stock out of
  # Available at the same time. No bucket ever goes below zero, the recall
  # quarantines at most what was there, and history explains everything.
  reset
  q "update inventory set available = 40 where product_id='$A'"
  q "insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$A','available',-960,'s28 start')"
  q "insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('a2800000-4444-4000-8000-000000000001','$A','S28-LOT',40,40)"
  q "insert into recalls (id, lot_id, product_id, reason, status) values ('a2800000-5555-4000-8000-000000000001','a2800000-4444-4000-8000-000000000001','$A','S28','initiated')"
  for i in $(seq 30); do call "select adjust_inventory('$A','available',-2,'s28');" & done
  call "select quarantine_recall('a2800000-5555-4000-8000-000000000001');" &
  wait
  check "S28 no bucket below zero" "$(q "select (available >= 0 and recalled >= 0)::text from inventory where product_id='$A'")" true
  check "S28 available + recalled + units taken = 40" "$(q "select (select available + recalled from inventory where product_id='$A') + 2 * (select count(*) from inventory_adjustments where reason='s28')")" 40
  check "S28 recall quantity = recalled bucket" "$(q "select (coalesce((select quantity_quarantined from recalls where id='a2800000-5555-4000-8000-000000000001'),0) = (select recalled from inventory where product_id='$A'))::text")" true
  check "S28 history explains stock" "$(history_consistent)" 0
  check "S28 data-integrity invariants hold" "$($PSQL -f "$(dirname "$0")/invariants.sql" | grep -c .)" 0

  dl_mark "S29"
  # S29 (EXT4). "Delete product" races a delivery for that product (10 of
  # each). The product is either kept with its stock, or deleted with no
  # stock, lot, line or history left pointing at it.
  reset
  q "insert into products (id, name, sku) values ('a2900000-6666-4000-8000-000000000001','S29','S29')"
  q "insert into inventory (product_id) values ('a2900000-6666-4000-8000-000000000001')"
  q "insert into purchase_orders (id, po_number, status, supplier_id) values ('a2900000-0000-4000-8000-000000000001','S29','shipped','99999999-0000-4000-8000-000000000000')"
  local dl29=$(grep -c deadlock "$ERR")
  for i in $(seq 10); do
    call "select delete_unused_product('a2900000-6666-4000-8000-000000000001');" &
    call "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) select 'a2900000-0000-4000-8000-000000000001','a2900000-6666-4000-8000-000000000001','x',1,1 where not exists (select 1 from purchase_order_items where purchase_order_id='a2900000-0000-4000-8000-000000000001'); select receive_purchase_order('a2900000-0000-4000-8000-000000000001');" &
  done; wait
  check "S29 delete vs delivery: consistent outcome" "$(q "select case when exists (select 1 from products where id='a2900000-6666-4000-8000-000000000001')
      then ((select available from inventory where product_id='a2900000-6666-4000-8000-000000000001') = coalesce((select sum(change_amount) from inventory_adjustments where product_id='a2900000-6666-4000-8000-000000000001'),0))::text
      else (not exists (select 1 from inventory where product_id='a2900000-6666-4000-8000-000000000001') and not exists (select 1 from inventory_adjustments where product_id='a2900000-6666-4000-8000-000000000001')
            and not exists (select 1 from purchase_order_items where product_id='a2900000-6666-4000-8000-000000000001'))::text end")" true
  check "S29 no deadlock" "$(( $(grep -c deadlock "$ERR") - dl29 ))" 0

  dl_mark "end"
  local t1=$(date +%s%N)
  echo "run $1: $pass passed, $fail failed, deadlocks seen: $(grep -c deadlock "$ERR"), $(( (t1 - t0) / 1000000 )) ms; S21 ladder:$S21_LADDER; S27 unguarded:$S27_UNGUARDED"
}

total_fail=0
for r in $(seq "$RUNS"); do pass=0; fail=0; run_once "$r"; total_fail=$((total_fail + fail)); done
echo "TOTAL: $RUNS run(s), failed checks: $total_fail"
exit $([ $total_fail = 0 ] && echo 0 || echo 1)
