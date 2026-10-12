#!/usr/bin/env bash
# LOCAL TEST ONLY (EXT14, 2026-10-11). Never point this at Supabase.
# Extreme concurrency for the DRAFT stock functions (drafts/10, R1–R5) on the
# local real-shape database: for N simultaneous callers (default 10, 25, 50)
# each function is hit N times at once on the SAME record and must produce
# exactly one business effect; then all four stock writers hit one product in
# a random order and every bucket must still be explained by its history.
# Counts deadlocks from the error log (expected: 0).
# Usage: extreme_stress_test.sh "<psql args incl. -d he_real>" [N ...]
#   e.g. extreme_stress_test.sh "-h /var/tmp/hepg -p 5499 -U postgres -d he_real" 10 25 50
CONN="$1"; shift
SIZES=${*:-"10 25 50"}
PSQL="psql $CONN -qtA -v ON_ERROR_STOP=1"
ERR=$(mktemp)
SEED=${SEED:-$RANDOM}; RANDOM=$SEED
A=11111111-1111-4111-8111-111111111111; B=22222222-2222-4222-8222-222222222222; D=44444444-4444-4444-8444-444444444444
q() { $PSQL -c "$1"; }
call() { $PSQL -c "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000$((RANDOM%9+1))',false); $1" >/dev/null 2>>"$ERR"; }
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  $1: expected $3, got $2 (seed $SEED)"; fi; }
reset() {
  $PSQL <<SQL >/dev/null
delete from inventory_adjustments; delete from expenses; delete from recalls; delete from returns; delete from order_items; delete from orders;
delete from inventory_lots; delete from purchase_order_items; delete from purchase_orders; delete from inventory; delete from products; delete from suppliers;
insert into profiles (id, email, role) select ('00000000-0000-4000-8000-00000000000' || g)::uuid, 'xstress' || g || '@example.test', 'owner'
  from generate_series(1, 9) g on conflict (id) do update set role = 'owner';
insert into suppliers (id, name) values ('99999999-0000-4000-8000-000000000000', 'XSTRESS supplier');
insert into products (id, name, sku) values ('$A','XS A','XS-A'), ('$B','XS B','XS-B'), ('$D','XS D unused','XS-D');
insert into inventory (product_id, available) values ('$A', 1000), ('$B', 1000), ('$D', 0);
insert into purchase_orders (id, po_number, status, supplier_id) values ('aaaaaaaa-0000-4000-8000-0000000000e1','XS-PO','shipped','99999999-0000-4000-8000-000000000000');
insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('aaaaaaaa-0000-4000-8000-0000000000e1','$A','A',40,2), ('aaaaaaaa-0000-4000-8000-0000000000e1','$B','B',10,5);
insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('eeeeeeee-0000-4000-8000-0000000000e1','$B','XL1',50,50);
insert into recalls (id, lot_id, product_id, reason, status) values ('eeeeeeee-1111-4000-8000-0000000000e1','eeeeeeee-0000-4000-8000-0000000000e1','$B','XS recall','initiated');
insert into orders (id, channel, order_number) values ('eeeeeeee-3333-4000-8000-0000000000e1','manual','XS-O');
insert into order_items (id, order_id, sku, quantity) values ('eeeeeeee-4444-4000-8000-0000000000e1','eeeeeeee-3333-4000-8000-0000000000e1','XS-A',4);
insert into returns (id, order_id, order_item_id, reason, status) values ('eeeeeeee-5555-4000-8000-0000000000e1','eeeeeeee-3333-4000-8000-0000000000e1','eeeeeeee-4444-4000-8000-0000000000e1','damaged','approved');
SQL
}
history_ok() { q "select count(*) from (
   select i.product_id, b.bucket, (case b.bucket when 'available' then i.available when 'damaged' then i.damaged when 'recalled' then i.recalled else 0 end) as now,
          (case when b.bucket = 'available' and i.product_id in ('$A','$B') then 1000 else 0 end) + coalesce((select sum(change_amount) from inventory_adjustments a where a.product_id=i.product_id and a.bucket=b.bucket),0) as expected
     from inventory i cross join (values ('available'),('damaged'),('recalled')) b(bucket)) x where now <> expected"; }
t0=$(date +%s)
ops=0
for N in $SIZES; do
  reset
  for i in $(seq $N); do call "select receive_purchase_order('aaaaaaaa-0000-4000-8000-0000000000e1');" & done; wait; ops=$((ops+N))
  check "N=$N R1: A received once" "$(q "select available from inventory where product_id='$A'")" 1040
  check "N=$N R1: one expense" "$(q "select count(*) from expenses where note='Purchase order XS-PO'")" 1
  for i in $(seq $N); do call "select quarantine_recall('eeeeeeee-1111-4000-8000-0000000000e1');" & done; wait; ops=$((ops+N))
  check "N=$N R2: quarantined once (50)" "$(q "select recalled from inventory where product_id='$B'")" 50
  for i in $(seq $N); do call "select receive_return('eeeeeeee-5555-4000-8000-0000000000e1','restock_available');" & done; wait; ops=$((ops+N))
  check "N=$N R3: one restock history row" "$(q "select count(*) from inventory_adjustments where product_id='$A' and reason like 'Return%'")" 1
  check "N=$N R3: A = 1040 + 4" "$(q "select available from inventory where product_id='$A'")" 1044
  cur=$(q "select available from inventory where product_id='$A'")
  for i in $(seq $N); do call "select adjust_inventory('$A','available',1,'xs same stale view',$cur);" & done; wait; ops=$((ops+N))
  check "N=$N R4: $N tabs with the same stale value → exactly one applied" "$(q "select available from inventory where product_id='$A'")" $((cur+1))
  for i in $(seq $N); do call "select delete_unused_product('$D');" & done; wait; ops=$((ops+N))
  check "N=$N R5: unused product deleted once, no orphan stock row" "$(q "select count(*) from products where id='$D'")|$(q "select count(*) from inventory where product_id='$D'")" "0|0"
  check "N=$N history explains every bucket" "$(history_ok)" 0
done
# mixed: all four writers on product B in a random order
reset
cmds=()
for i in $(seq 40); do
  case $((RANDOM % 4)) in
    0) cmds+=("select receive_purchase_order('aaaaaaaa-0000-4000-8000-0000000000e1');") ;;
    1) cmds+=("select quarantine_recall('eeeeeeee-1111-4000-8000-0000000000e1');") ;;
    2) cmds+=("select adjust_inventory('$B','available',1,'xs mixed');") ;;
    3) cmds+=("select adjust_inventory('$B','available',-1,'xs mixed');") ;;
  esac
done
for c in "${cmds[@]}"; do call "$c" & done; wait; ops=$((ops+40))
check "mixed (seed $SEED): history explains every bucket" "$(history_ok)" 0
check "mixed: recall quarantined at most once" "$(q "select (recalled in (0,50))::int from inventory where product_id='$B'")" 1
check "mixed: PO received at most once" "$(q "select count(*) from expenses where note='Purchase order XS-PO'")" "$(q "select (status='received')::int from purchase_orders where po_number='XS-PO'")"
dl=$(grep -c deadlock "$ERR")
check "deadlocks" "$dl" 0
echo "extreme stress: sizes [$SIZES], $ops calls in $(( $(date +%s)-t0 ))s, seed $SEED, deadlocks $dl — $pass passed, $fail failed"
rm -f "$ERR"
[ $fail -eq 0 ]
