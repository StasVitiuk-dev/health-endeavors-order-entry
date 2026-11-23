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
# EXT20: measured concurrency. "N callers" means N client processes started at
# once; how many actually ran inside the server at the same moment was never
# measured. During each burst a sampler session polls pg_stat_activity every
# ~5 ms (fresh snapshot each time) for: callers running the function, callers
# waiting on a lock, open transactions. Each caller's start/end time is logged,
# giving latency (median, p95, max), start spread, completion spread and a
# fairness check (no caller slower than 20x the median). MEASURE=0 turns it off.
MEASURE=${MEASURE:-1}
TIMES=$(mktemp); SAMPLE=$(mktemp)
FN_RE='receive_purchase_order|quarantine_recall|receive_return|adjust_inventory|delete_unused_product'
timed_call() { local s e; s=$(date +%s%N); call "$1"; e=$(date +%s%N); echo "$s $e" >> "$TIMES"; }
sampler_start() {
  $PSQL -c "set client_min_messages = warning; create unlogged table if not exists xs_stop(x int); truncate xs_stop;" >/dev/null
  ( $PSQL -c "do \$\$ declare a int; l int; x int; pa int := 0; pl int := 0; px int := 0; n int := 0; sl int := 0; sa int := 0; begin
      loop
        perform pg_stat_clear_snapshot();
        select count(*) filter (where state = 'active' and query ~ '$FN_RE' and pid <> pg_backend_pid()),
               count(*) filter (where wait_event_type = 'Lock'),
               count(*) filter (where xact_start is not null and backend_type = 'client backend' and pid <> pg_backend_pid())
          into a, l, x from pg_stat_activity;
        pa := greatest(pa, a); pl := greatest(pl, l); px := greatest(px, x); n := n + 1; sl := sl + l; sa := sa + a;
        exit when exists (select 1 from xs_stop) or n > 60000;
        perform pg_sleep(0.005);
      end loop;
      raise notice 'SAMPLE % % % % % %', pa, pl, px, n, sl, sa;
    end \$\$;" 2> "$SAMPLE" >/dev/null ) &
  SAMPLER=$!
  sleep 0.2
}
sampler_stop() { $PSQL -c "insert into xs_stop values (1);" >/dev/null; wait $SAMPLER 2>/dev/null; }
MEAS=()
burst() { # burst N label sql
  local n=$1 label=$2 sql=$3
  if [ "$MEASURE" != 1 ]; then for i in $(seq $n); do call "$sql" & done; wait; return; fi
  : > "$TIMES"; sampler_start
  for i in $(seq $n); do timed_call "$sql" & done
  wait $(jobs -p | grep -v "^$SAMPLER\$") 2>/dev/null
  sampler_stop
  local line; line=$(grep -o 'SAMPLE.*' "$SAMPLE" | head -1)
  # latency (ms) median / p95 / max / callers slower than 20x the median; start and completion spread (ms)
  local st sp sm
  read -r -a st <<< "$(awk '{print ($2-$1)/1e6}' "$TIMES" | sort -n | awk '{d[NR]=$1} END {n=NR; if (!n) {print "0 0 0 0 0"; exit} med=d[int((n+1)/2)]; i=int(n*0.95); if (i<1) i=1; slow=0; for (k=1;k<=n;k++) if (d[k] > 20*med) slow++; printf "%.0f %.0f %.0f %d %d", med, d[i], d[n], slow, n}')"
  read -r -a sp <<< "$(awk 'NR==1{a=$1;b=$1;c=$2;d=$2} {if($1<a)a=$1; if($1>b)b=$1; if($2<c)c=$2; if($2>d)d=$2} END {printf "%.0f %.0f", (b-a)/1e6, (d-c)/1e6}' "$TIMES")"
  read -r -a sm <<< "${line#SAMPLE }"
  local avg; avg=$(awk -v a="${sm[5]:-0}" -v n="${sm[3]:-0}" 'BEGIN{ if (n>0) printf "%.1f", a/n; else print "0" }')
  local m="$label N=$n: peak running ${sm[0]:-?}, peak lock-waiting ${sm[1]:-?}, peak open transactions ${sm[2]:-?}, avg running $avg (${sm[3]:-0} samples); latency median ${st[0]} ms, p95 ${st[1]} ms, max ${st[2]} ms; starts spread ${sp[0]} ms, completions spread ${sp[1]} ms; callers slower than 20x median: ${st[3]} (of ${st[4]})"
  echo "MEASURED $m"; MEAS+=("$m")
}
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
  burst $N R1 "select receive_purchase_order('aaaaaaaa-0000-4000-8000-0000000000e1');"; ops=$((ops+N))
  check "N=$N R1: A received once" "$(q "select available from inventory where product_id='$A'")" 1040
  check "N=$N R1: one expense" "$(q "select count(*) from expenses where note='Purchase order XS-PO'")" 1
  burst $N R2 "select quarantine_recall('eeeeeeee-1111-4000-8000-0000000000e1');"; ops=$((ops+N))
  check "N=$N R2: quarantined once (50)" "$(q "select recalled from inventory where product_id='$B'")" 50
  burst $N R3 "select receive_return('eeeeeeee-5555-4000-8000-0000000000e1','restock_available');"; ops=$((ops+N))
  check "N=$N R3: one restock history row" "$(q "select count(*) from inventory_adjustments where product_id='$A' and reason like 'Return%'")" 1
  check "N=$N R3: A = 1040 + 4" "$(q "select available from inventory where product_id='$A'")" 1044
  cur=$(q "select available from inventory where product_id='$A'")
  burst $N R4 "select adjust_inventory('$A','available',1,'xs same stale view',$cur);"; ops=$((ops+N))
  check "N=$N R4: $N tabs with the same stale value → exactly one applied" "$(q "select available from inventory where product_id='$A'")" $((cur+1))
  burst $N R5 "select delete_unused_product('$D');"; ops=$((ops+N))
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
# EXT19: callers refused by the server before their session started (more callers
# than max_connections). Refused calls never ran, so they cannot apply twice; the
# exactly-once checks above still hold for the calls that did run.
refused=$(grep -c "too many clients\|remaining connection slots" "$ERR" || true)
for m in "${MEAS[@]}"; do echo "  $m"; done
echo "extreme stress: sizes [$SIZES], $ops calls in $(( $(date +%s)-t0 ))s ($refused refused by the server before starting), seed $SEED, deadlocks $dl — $pass passed, $fail failed"
rm -f "$ERR" "$TIMES" "$SAMPLE"; $PSQL -c "drop table if exists xs_stop" >/dev/null 2>&1
[ $fail -eq 0 ]
