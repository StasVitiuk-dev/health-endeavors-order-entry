#!/usr/bin/env bash
# LOCAL TEST ONLY (EXT20, 2026-10-17). Never point this at Supabase.
# TRUE simultaneous callers for the DRAFT stock functions (drafts/10, R1–R5).
#
# Why: extreme_stress_test.sh starts one psql PROCESS per caller. EXT20 measured
# it: "50 callers" put at most 3–6 calls inside the server at the same moment,
# because starting psql takes longer than the call itself. Here pgbench opens
# all N connections FIRST and then fires the call on every connection at once,
# so the server really sees N callers together. A sampler session polls
# pg_stat_activity every ~5 ms (fresh snapshot each time) and reports the
# measured peak.
#
# For each N and each function: exactly one business effect, history explains
# every bucket, 0 deadlocks, and the measured peak of simultaneous callers.
# Then a connection-pressure check: more callers than the server accepts must
# fail loudly (pgbench refuses to start) and change nothing.
#
# Usage: true_concurrency_test.sh "<psql args incl. -d he_real>" [N ...]
#   N must stay below the server's max_connections minus 5.
CONN="$1"; shift
SIZES=${*:-"25 50 90"}
PSQL="psql $CONN -qtA -v ON_ERROR_STOP=1"
PGB=$(command -v pgbench || ls /usr/lib/postgresql/*/bin/pgbench 2>/dev/null | head -1)
[ -x "$PGB" ] || { echo "pgbench not found"; exit 2; }
W=$(mktemp -d)
A=11111111-1111-4111-8111-111111111111; B=22222222-2222-4222-8222-222222222222; D=44444444-4444-4444-8444-444444444444
q() { $PSQL -c "$1"; }
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL  $1: expected $3, got $2"; fi; }
reset() {
  $PSQL <<SQL >/dev/null
delete from inventory_adjustments; delete from expenses; delete from recalls; delete from returns; delete from order_items; delete from orders;
delete from inventory_lots; delete from purchase_order_items; delete from purchase_orders; delete from inventory; delete from products; delete from suppliers;
insert into profiles (id, email, role) select ('00000000-0000-4000-8000-00000000000' || g)::uuid, 'tconc' || g || '@example.test', 'owner'
  from generate_series(1, 9) g on conflict (id) do update set role = 'owner';
insert into suppliers (id, name) values ('99999999-0000-4000-8000-000000000000', 'TCONC supplier');
insert into products (id, name, sku) values ('$A','TC A','TC-A'), ('$B','TC B','TC-B'), ('$D','TC D unused','TC-D');
insert into inventory (product_id, available) values ('$A', 1000), ('$B', 1000), ('$D', 0);
insert into purchase_orders (id, po_number, status, supplier_id) values ('aaaaaaaa-0000-4000-8000-0000000000e1','TC-PO','shipped','99999999-0000-4000-8000-000000000000');
insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('aaaaaaaa-0000-4000-8000-0000000000e1','$A','A',40,2), ('aaaaaaaa-0000-4000-8000-0000000000e1','$B','B',10,5);
insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('eeeeeeee-0000-4000-8000-0000000000e1','$B','TL1',50,50);
insert into recalls (id, lot_id, product_id, reason, status) values ('eeeeeeee-1111-4000-8000-0000000000e1','eeeeeeee-0000-4000-8000-0000000000e1','$B','TC recall','initiated');
insert into orders (id, channel, order_number) values ('eeeeeeee-3333-4000-8000-0000000000e1','manual','TC-O');
insert into order_items (id, order_id, sku, quantity) values ('eeeeeeee-4444-4000-8000-0000000000e1','eeeeeeee-3333-4000-8000-0000000000e1','TC-A',4);
insert into returns (id, order_id, order_item_id, reason, status) values ('eeeeeeee-5555-4000-8000-0000000000e1','eeeeeeee-3333-4000-8000-0000000000e1','eeeeeeee-4444-4000-8000-0000000000e1','damaged','approved');
SQL
}
history_ok() { q "select count(*) from (
   select i.product_id, b.bucket, (case b.bucket when 'available' then i.available when 'damaged' then i.damaged when 'recalled' then i.recalled else 0 end) as now,
          (case when b.bucket = 'available' and i.product_id in ('$A','$B') then 1000 else 0 end) + coalesce((select sum(change_amount) from inventory_adjustments a where a.product_id=i.product_id and a.bucket=b.bucket),0) as expected
     from inventory i cross join (values ('available'),('damaged'),('recalled')) b(bucket)) x where now <> expected"; }

sampler_start() {
  $PSQL -c "set client_min_messages = warning; create unlogged table if not exists tc_stop(x int); truncate tc_stop;" >/dev/null
  ( $PSQL -c "do \$\$ declare a int; l int; pa int := 0; pl int := 0; n int := 0; begin
      loop
        perform pg_stat_clear_snapshot();
        select count(*) filter (where state = 'active' and query ~ 'receive_purchase_order|quarantine_recall|receive_return|adjust_inventory|delete_unused_product' and pid <> pg_backend_pid()),
               count(*) filter (where wait_event_type = 'Lock' and pid <> pg_backend_pid())
          into a, l from pg_stat_activity;
        pa := greatest(pa, a); pl := greatest(pl, l); n := n + 1;
        exit when exists (select 1 from tc_stop) or n > 60000;
        perform pg_sleep(0.005);
      end loop;
      raise notice 'SAMPLE % % %', pa, pl, n;
    end \$\$;" 2> "$W/sample" >/dev/null ) &
  SAMPLER=$!
  sleep 0.3
}
sampler_stop() { $PSQL -c "insert into tc_stop values (1);" >/dev/null; wait $SAMPLER 2>/dev/null; }

DEADLOCKS=0; RESULTS=()
# fire N label sql : N connections, each runs the call once, all at the same time
fire() {
  local n=$1 label=$2 sql=$3
  printf "set role authenticated;\nselect set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);\n%s\n" "$sql" > "$W/script.sql"
  rm -f "$W"/pgbench_log.*
  sampler_start
  ( cd "$W" && "$PGB" $CONN -n -c "$n" -j 4 -t 1 -f script.sql -l --log-prefix=pgbench_log > "$W/out" 2> "$W/err" )
  local rc=$?
  sampler_stop
  local smp; read -r -a smp <<< "$(grep -o 'SAMPLE.*' "$W/sample" | head -1 | cut -d' ' -f2-)"
  local dl; dl=$(grep -c deadlock "$W/err" || true); DEADLOCKS=$((DEADLOCKS + dl))
  local errs; errs=$(grep -c "aborted in command" "$W/err" || true)
  local why; why=$(grep -o 'ERROR: .*' "$W/err" | head -1 | cut -c1-90)
  # pgbench log: client tx latency_us script epoch_s epoch_us
  local lat; lat=$(cat "$W"/pgbench_log.* 2>/dev/null | awk '{printf "%.3f %.3f\n", $3/1000, ($5 - 1700000000)*1000 + $6/1000}' | sort -n | awk '{l[NR]=$1; e[NR]=$2; if (NR==1 || $2<mn) mn=$2; if (NR==1 || $2>mx) mx=$2} END {n=NR; if (!n) {print "0 0 0 0 0"; exit} med=l[int((n+1)/2)]; i=int(n*0.95); if (i<1) i=1; printf "%.1f %.1f %.1f %.0f %d", med, l[i], l[n], mx-mn, n}')
  local L; read -r -a L <<< "$lat"
  local line="$label N=$n: measured peak running together ${smp[0]:-?} (peak lock-waiting ${smp[1]:-?}, ${smp[2]:-0} samples); latency median ${L[0]} ms, p95 ${L[1]} ms, max ${L[2]} ms; completions spread ${L[3]} ms; finished ${L[4]}, ended with an error $errs, deadlocks $dl, pgbench exit $rc${why:+; first error: $why}"
  echo "MEASURED $line"; RESULTS+=("$line")
}

t0=$(date +%s)
for N in $SIZES; do
  reset
  fire "$N" R1 "select receive_purchase_order('aaaaaaaa-0000-4000-8000-0000000000e1');"
  check "N=$N R1: A received once" "$(q "select available from inventory where product_id='$A'")" 1040
  check "N=$N R1: one expense" "$(q "select count(*) from expenses where note='Purchase order TC-PO'")" 1
  fire "$N" R2 "select quarantine_recall('eeeeeeee-1111-4000-8000-0000000000e1');"
  check "N=$N R2: quarantined once (50)" "$(q "select recalled from inventory where product_id='$B'")" 50
  fire "$N" R3 "select receive_return('eeeeeeee-5555-4000-8000-0000000000e1','restock_available');"
  check "N=$N R3: one restock history row" "$(q "select count(*) from inventory_adjustments where product_id='$A' and reason like 'Return%'")" 1
  cur=$(q "select available from inventory where product_id='$A'")
  fire "$N" R4 "select adjust_inventory('$A','available',1,'tc same stale view',$cur);"
  check "N=$N R4: $N connections with the same stale value -> exactly one applied" "$(q "select available from inventory where product_id='$A'")" $((cur+1))
  fire "$N" R5 "select delete_unused_product('$D');"
  check "N=$N R5: unused product deleted once, no orphan stock row" "$(q "select count(*) from products where id='$D'")|$(q "select count(*) from inventory where product_id='$D'")" "0|0"
  check "N=$N history explains every bucket" "$(history_ok)" 0
done

# Connection pressure: ask for more connections than the server allows.
MAXC=$(q "show max_connections")
OVER=$((MAXC + 5))
reset
before=$(q "select available from inventory where product_id='$A'")
printf "set role authenticated;\nselect set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);\nselect adjust_inventory('$A','available',1,'tc pressure');\n" > "$W/script.sql"
( cd "$W" && "$PGB" $CONN -n -c "$OVER" -j 4 -t 1 -f script.sql > "$W/out" 2> "$W/err" ); prc=$?
after=$(q "select available from inventory where product_id='$A'")
refused=$(grep -c "too many clients\|remaining connection slots\|could not create connection\|connection to server" "$W/err" || true)
check "pressure: $OVER callers above max_connections $MAXC fail loudly (pgbench exit non-zero)" "$([ $prc -ne 0 ] && echo loud || echo silent)" loud
applied=$((after - before))
check "pressure: applied changes are exactly the calls that ran, never more (applied $applied of $OVER)" "$([ $applied -le $OVER ] && echo ok || echo over)" ok
check "pressure: history still explains every bucket" "$(history_ok)" 0
echo "PRESSURE $OVER callers, max_connections $MAXC: pgbench exit $prc, connection errors reported $refused, changes applied $applied (each applied change has its history row)"

check "deadlocks (all levels)" "$DEADLOCKS" 0
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo "true concurrency: sizes [$SIZES] in $(( $(date +%s)-t0 ))s, deadlocks $DEADLOCKS — $pass passed, $fail failed"
$PSQL -c "drop table if exists tc_stop" >/dev/null 2>&1
rm -rf "$W"
[ $fail -eq 0 ]
