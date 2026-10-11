#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-06, extension 5). Deterministic interleavings of a
# purchase-order receive (R1 draft) with a line edit. Unlike the random races
# in stress_test.sh S27, each ordering is FORCED: one session opens a
# transaction, makes its change and holds it (pg_sleep) while the other
# session starts. Run without and with the draft guard (drafts/17). Never
# point this at Supabase.
# Usage: po_race_interleavings.sh <psql args>   e.g. -h /var/tmp/hepg -p 5499 -U postgres -d he_real
P="psql $* -qtAX -v ON_ERROR_STOP=0 --set=client_min_messages=warning"
OWN="set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);"
A=11111111-1111-4111-8111-111111111111
PO=a2900000-0000-4000-8000-0000000000aa
L2=a2900000-1111-4000-8000-0000000000b2
DIR="$(cd "$(dirname "$0")" && pwd)"
GUARD="${GUARD_FILE:-$DIR/../drafts/17_DRAFT_po_line_delete_guard.sql}"  # GUARD_FILE: mutation runs only
fail=0
setup() {
  $P -c "delete from inventory_adjustments; delete from expenses; delete from inventory_lots; delete from purchase_orders; delete from purchase_order_items;
    delete from inventory where product_id='$A'; insert into products (id,name,sku) values ('$A','RACE A','RACE-A') on conflict (id) do nothing;
    insert into inventory (product_id, available) values ('$A',1000);
    insert into profiles (id,email,role) values ('00000000-0000-4000-8000-000000000001','race-owner@example.test','owner') on conflict (id) do update set role='owner';
    insert into suppliers (id,name) values ('99999999-0000-4000-8000-000000000000','RACE supplier') on conflict do nothing;
    insert into purchase_orders (id, po_number, status, supplier_id) values ('$PO','RACE','ordered','99999999-0000-4000-8000-000000000000');
    insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost) values
      (gen_random_uuid(),'$PO','$A','x',5,1), ('$L2','$PO','$A','y',7,1);" >/dev/null
}
agree() {  # prints true when the order and the stock agree
  $P -c "select case (select status from purchase_orders where id='$PO')
     when 'received' then (not exists (select 1 from purchase_order_items where purchase_order_id='$PO' and coalesce(quantity_received,0) <> quantity)
                           and (select available from inventory where product_id='$A') = 1000 + (select coalesce(sum(quantity),0) from purchase_order_items where purchase_order_id='$PO'))::text
     else ((select available from inventory where product_id='$A') = 1000)::text end"
}
edit_sql() {
  case "$1" in
    delete) echo "delete from purchase_order_items where id='$L2'" ;;
    add)    echo "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('$PO','$A','late',3,1)" ;;
    qty)    echo "update purchase_order_items set quantity = 9 where id='$L2'" ;;
  esac
}
run_case() {  # $1 guard on/off, $2 kind, $3 order
  setup
  local recv="select receive_purchase_order('$PO')"
  local edit; edit=$(edit_sql "$2")
  if [ "$3" = edit-first ]; then
    $P -c "$OWN begin; $edit; select pg_sleep(1.5); commit;" >/dev/null 2>&1 &
    sleep 0.5; $P -c "$OWN $recv" >/dev/null 2>&1; wait
  else
    $P -c "$OWN begin; $recv; select pg_sleep(1.5); commit;" >/dev/null 2>&1 &
    sleep 0.5; $P -c "$OWN $edit" >/dev/null 2>&1; wait
  fi
  local ok; ok=$(agree)
  printf '%-6s %-7s %-12s agree=%s\n' "$1" "$2" "$3" "$ok"
  [ "$1" = guard ] && [ "$ok" != true ] && fail=$((fail+1))
}
echo "R1 must be installed locally (drafts/10)."
$P -f "$DIR/../drafts/18_DRAFT_rollback_po_line_delete_guard.sql" >/dev/null
for k in delete add qty; do for o in edit-first receive-first; do run_case none $k $o; done; done
$P -f "$GUARD" >/dev/null
for k in delete add qty; do for o in edit-first receive-first; do run_case guard $k $o; done; done
$P -f "$DIR/../drafts/18_DRAFT_rollback_po_line_delete_guard.sql" >/dev/null
echo "GUARDED FAILURES: $fail"
[ "$fail" -eq 0 ]
