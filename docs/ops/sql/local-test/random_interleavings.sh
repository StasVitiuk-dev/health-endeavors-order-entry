#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-07, extension 7, workstream B). Never point this at
# Supabase. Randomized, interleaved stress for the DRAFT stock functions
# (drafts/10_, "R1–R5") mixed with what a stale second tab can still send
# directly (purchase-order line edits / deletes / additions, today's
# step-by-step stock write), on the local real-shape database.
#
# Each round starts from a clean slate, picks a random mix of operations from
# a fixed seed, fires them in parallel with random small delays, then checks
# every data-integrity rule in invariants.sql (stock explained by history,
# no negative stock, received orders fully received, one expense per received
# order, lots consistent, ...). A failing round is shrunk to a minimal set of
# operations that still breaks a rule (replayed up to 3 times per candidate,
# because timing decides the outcome) and printed as a repro.
#
# Usage: random_interleavings.sh <seed> <rounds> <guard> <psql args...>
#   guard: none | ext5 | current
#     none     no PO line guard installed
#     ext5     the guard as drafted in extension 5 (git 2e1bda4)
#     current  docs/ops/sql/drafts/17_DRAFT_po_line_delete_guard.sql
#   e.g. random_interleavings.sh 7 200 current -h /var/tmp/hepg -p 5499 -U postgres -d he_real
# Output: one summary line "SUMMARY guard=… rounds=… failing=… rules=…",
# then one "REPRO" block per distinct broken rule (first seen).

SEED=${1:?seed}; ROUNDS=${2:?rounds}; GUARD=${3:?guard}; shift 3
[ $# -gt 0 ] || { echo "connection arguments are required (e.g. -h /var/tmp/hepg -p 5499 -U postgres -d he_real)"; exit 2; }
CONN="$*"
P="psql $* -qtAX -v ON_ERROR_STOP=0 --set=client_min_messages=warning"
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$DIR/../../../.." && pwd)"
ERR=$(mktemp); ACT=$(mktemp); trap 'rm -f "$ERR" "$ACT"' EXIT
A=11111111-1111-4111-8111-111111111111
B=22222222-2222-4222-8222-222222222222
C=33333333-3333-4333-8333-333333333333
SUP=99999999-0000-4000-8000-000000000000
OWN="set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);"

# --- guard state ------------------------------------------------------------
$P -f "$DIR/../drafts/18_DRAFT_rollback_po_line_delete_guard.sql" >/dev/null 2>&1
case "$GUARD" in
  none) ;;
  ext5) git -C "$REPO" show 2e1bda4:docs/ops/sql/drafts/17_DRAFT_po_line_delete_guard.sql | $P >/dev/null 2>>"$ERR" || { echo "could not install the EXT5 guard"; exit 2; } ;;
  current) $P -f "$DIR/../drafts/17_DRAFT_po_line_delete_guard.sql" >/dev/null 2>>"$ERR" || { echo "could not install the current guard"; exit 2; } ;;
  *) echo "guard must be none, ext5 or current"; exit 2 ;;
esac
# On exit: remove the guard and every row this script made, so the other
# local scripts start from what they expect (their clean-up does not know
# about recalls, returns or orders left here).
cleanup() {
  rm -f "$ERR" "$ACT"
  $P -f "$DIR/../drafts/18_DRAFT_rollback_po_line_delete_guard.sql" >/dev/null 2>&1
  psql $CONN -qtAX -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set session_replication_role = replica;
delete from inventory_adjustments; delete from expenses; delete from recalls; delete from returns; delete from order_items; delete from orders;
delete from inventory_lots; delete from purchase_order_items; delete from purchase_orders; delete from inventory; delete from products; delete from suppliers;
SQL
}
trap cleanup EXIT

# The clean-up runs with triggers off (session_replication_role = replica), so
# a guard that refuses deleting lines of a received order cannot leave the
# previous round's rows behind. Any error here stops the whole run: a round
# on leftover data would prove nothing.
reset() {
  psql $CONN -qtAX -v ON_ERROR_STOP=1 --set=client_min_messages=warning <<SQL >/dev/null 2>>"$ERR" || { echo "RESET FAILED; stopping"; tail -5 "$ERR"; exit 3; }
set session_replication_role = replica;
delete from inventory_adjustments; delete from expenses; delete from recalls; delete from returns; delete from order_items; delete from orders;
delete from inventory_lots; delete from purchase_order_items; delete from purchase_orders; delete from inventory; delete from products; delete from suppliers;
insert into profiles (id, email, role) values ('00000000-0000-4000-8000-000000000001', 'stress1@example.test', 'owner') on conflict (id) do update set role = 'owner';
insert into suppliers (id, name) values ('$SUP', 'RANDOM supplier');
insert into products (id, name, sku) values ('$A','RANDOM A','S-A'), ('$B','RANDOM B','S-B'), ('$C','RANDOM C','S-C');
insert into inventory (product_id, available) values ('$A', 100), ('$B', 100), ('$C', 0);
insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$A','available',100,'start'), ('$B','available',100,'start');
insert into purchase_orders (id, po_number, status, supplier_id) values
  ('a7000000-0000-4000-8000-000000000001','R-1','shipped','$SUP'), ('a7000000-0000-4000-8000-000000000002','R-2','ordered','$SUP'), ('a7000000-0000-4000-8000-000000000003','R-3','shipped','$SUP');
insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost) values
  ('a7000000-1111-4000-8000-000000000011','a7000000-0000-4000-8000-000000000001','$A','A',12,2), ('a7000000-1111-4000-8000-000000000012','a7000000-0000-4000-8000-000000000001','$B','B',5,3),
  ('a7000000-1111-4000-8000-000000000021','a7000000-0000-4000-8000-000000000002','$A','A',7,1),
  ('a7000000-1111-4000-8000-000000000031','a7000000-0000-4000-8000-000000000003','$B','B',9,4);
insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('a7000000-2222-4000-8000-000000000001','$B','RL1',30,30);
insert into recalls (id, lot_id, product_id, reason, status) values ('a7000000-3333-4000-8000-000000000001','a7000000-2222-4000-8000-000000000001','$B','RANDOM recall','initiated');
insert into orders (id, channel, order_number) values ('a7000000-4444-4000-8000-000000000001','manual','R-O');
insert into order_items (id, order_id, sku, quantity) values ('a7000000-5555-4000-8000-000000000001','a7000000-4444-4000-8000-000000000001','S-B',4);
insert into returns (id, order_id, order_item_id, reason, status) values ('a7000000-6666-4000-8000-000000000001','a7000000-4444-4000-8000-000000000001','a7000000-5555-4000-8000-000000000001','damaged','approved');
reset session_replication_role;
SQL
}

# The operation pool. Each entry: name|SQL (run as the owner, in its own session).
POS=(a7000000-0000-4000-8000-000000000001 a7000000-0000-4000-8000-000000000002 a7000000-0000-4000-8000-000000000003)
LINES=(a7000000-1111-4000-8000-000000000011 a7000000-1111-4000-8000-000000000012 a7000000-1111-4000-8000-000000000021 a7000000-1111-4000-8000-000000000031)
make_op() {
  local k=$((RANDOM % 11)) po=${POS[$((RANDOM % 3))]} line=${LINES[$((RANDOM % 4))]} p
  p=$([ $((RANDOM % 2)) = 0 ] && echo $A || echo $B)
  case $k in
    0|1) echo "adjust|select adjust_inventory('$p','available',$(( (RANDOM % 21) - 10 )),'random');" ;;
    2) echo "adjust-sample|select adjust_inventory('$p','sample',$(( (RANDOM % 5) + 1 )),'random');" ;;
    3|4) echo "receive-R1 ${po: -1}|select receive_purchase_order('$po');" ;;
    5) echo "stale-tab line edit ${line: -2}|begin; update purchase_order_items set quantity = quantity + 1 where id = '$line'; select pg_sleep(0.03); commit;" ;;
    6) echo "stale-tab line delete ${line: -2}|delete from purchase_order_items where id = '$line';" ;;
    7) echo "stale-tab line add ${po: -1}|insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('$po','$A','added',3,1);" ;;
    8) echo "quarantine recall|select quarantine_recall('a7000000-3333-4000-8000-000000000001');" ;;
    9) echo "restock return|select receive_return('a7000000-6666-4000-8000-000000000001','restock_available');" ;;
    10) echo "today's browser stock write|begin; update inventory set available = available + 2 where product_id = '$p'; insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$p','available',2,'browser'); commit;" ;;
  esac
}

broken_rules() { $P -c "set he.invariants_history_baseline = 'zero';" -f "$DIR/invariants.sql" 2>>"$ERR" | cut -d'|' -f1 | sort -u | paste -sd';' -; }

# run_ops <op lines...> : reset, fire all in parallel with random 0–60 ms delays, return broken rules
run_ops() {
  reset
  local o
  for o in "$@"; do
    ( sleep "0.0$((RANDOM % 6))$((RANDOM % 10))"; $P -c "$OWN ${o#*|}" >/dev/null 2>>"$ERR" ) &
  done
  wait
  # activity counters (so "0 failing" can be read as "the races really ran")
  $P -c "select (select count(*) from purchase_orders where status = 'received'), (select count(*) from purchase_order_items where description = 'added') + (select count(*) from purchase_order_items where id in ('a7000000-1111-4000-8000-000000000011','a7000000-1111-4000-8000-000000000012','a7000000-1111-4000-8000-000000000021','a7000000-1111-4000-8000-000000000031') and quantity not in (12,5,7,9)) + (4 - (select count(*) from purchase_order_items where id in ('a7000000-1111-4000-8000-000000000011','a7000000-1111-4000-8000-000000000012','a7000000-1111-4000-8000-000000000021','a7000000-1111-4000-8000-000000000031')))" >> "$ACT" 2>>"$ERR"
  broken_rules
}

RANDOM=$SEED
failing=0; declare -A SEEN
for r in $(seq "$ROUNDS"); do
  n=$((6 + RANDOM % 9)); ops=()
  for i in $(seq $n); do ops+=("$(make_op)"); done
  rules=$(run_ops "${ops[@]}")
  [ -z "$rules" ] && continue
  failing=$((failing + 1))
  [ -n "${SEEN[$rules]}" ] && continue
  SEEN[$rules]=1
  # shrink: drop an operation when the rest still breaks a rule (3 tries)
  keep=("${ops[@]}")
  for ((i = ${#keep[@]} - 1; i >= 0; i--)); do
    try=("${keep[@]:0:$i}" "${keep[@]:$((i + 1))}")
    [ ${#try[@]} -eq 0 ] && continue
    for t in 1 2 3; do
      if [ -n "$(run_ops "${try[@]}")" ]; then keep=("${try[@]}"); break; fi
    done
  done
  echo "REPRO round $r: broke [$rules] with ${#keep[@]} operation(s) at once:"
  for o in "${keep[@]}"; do echo "    - ${o%%|*}"; done
done
dl=$(grep -c deadlock "$ERR")
refused=$(grep -c "po_not_editable\|can no longer be changed" "$ERR")
recv=$(awk -F'|' '{s+=$1} END {print s+0}' "$ACT"); edits=$(awk -F'|' '{s+=$2} END {print s+0}' "$ACT")
echo "SUMMARY guard=$GUARD seed=$SEED rounds=$ROUNDS failing=$failing distinct_rule_sets=${#SEEN[@]} deadlocks=$dl orders_received=$recv line_changes_applied=$edits line_changes_refused_by_guard=$refused"
