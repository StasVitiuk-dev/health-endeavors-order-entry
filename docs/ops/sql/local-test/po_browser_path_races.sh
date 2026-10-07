#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-07, extension 6). Never point this at Supabase.
#
# Forced interleavings of the dashboard's receive AS IT RUNS TODAY (separate
# browser requests, no R1) with a purchase-order edit made in another tab.
# po_race_interleavings.sh covers R1; this covers the path that stays live
# until the dashboard is switched to R1 (backlog INV-06), i.e. the period in
# which the line guard (drafts/17) may already be installed.
#
# The receive is copied step by step from owner-login.html (receive button):
#   1 claim:   status -> received, only if still ordered/shipped (one request)
#   2 re-read: the order's lines (EXT5)
#   3 per line: compare-and-set stock, history row, quantity_received
#              (0 rows changed = "removed while being received", reported)
#   4 expense
#   5 final re-check of the lines (EXT5): a difference is reported
# The other tab's edit opens a transaction, makes its change, and holds it
# (pg_sleep) while the receive runs: the moment between a guard's check and
# the edit's commit, stretched so it can be hit every time.
#
# Each case ends in one of:
#   agree     order and stock match (the only good outcome)
#   reported  they differ, but the dashboard tells the user (steps 3 / 5)
#   SILENT    they differ and nobody is told (the dangerous outcome)
#
# Usage: po_browser_path_races.sh <psql args>   e.g. -h /var/tmp/hepg -p 5499 -U postgres -d he_real
#   GUARD_FILE=<file>  guard to test in the "guard" rounds (default drafts/17)
#   ONLY=guard         skip the unguarded round
P="psql $* -qtAX -v ON_ERROR_STOP=0 --set=client_min_messages=warning"
OWN="set role authenticated; set request.jwt.claim.sub to '00000000-0000-4000-8000-000000000001';"  # SET prints nothing, so outputs below are only the query's
A=11111111-1111-4111-8111-111111111111
PO=a3000000-0000-4000-8000-0000000000aa
L1=a3000000-1111-4000-8000-0000000000b1
L2=a3000000-1111-4000-8000-0000000000b2
DIR="$(cd "$(dirname "$0")" && pwd)"
GUARD="${GUARD_FILE:-$DIR/../drafts/17_DRAFT_po_line_delete_guard.sql}"
ROLLBACK="$DIR/../drafts/18_DRAFT_rollback_po_line_delete_guard.sql"
LOG=$(mktemp); trap 'rm -f "$LOG"' EXIT
silent_guarded=0; reported_guarded=0; errors_seen=""

setup() {
  $P -c "delete from inventory_adjustments; delete from expenses; delete from inventory_lots; delete from purchase_orders; delete from purchase_order_items;  -- orders first: the guard lets a whole order go, not single lines of a received one
    delete from inventory where product_id='$A'; insert into products (id,name,sku) values ('$A','RACE A','RACE-A') on conflict (id) do nothing;
    insert into inventory (product_id, available) values ('$A',1000);
    insert into profiles (id,email,role) values ('00000000-0000-4000-8000-000000000001','race-owner@example.test','owner') on conflict (id) do update set role='owner';
    insert into suppliers (id,name) values ('99999999-0000-4000-8000-000000000000','RACE supplier') on conflict do nothing;
    insert into purchase_orders (id, po_number, status, supplier_id, shipping_cost, tax) values ('$PO','BROWSER','ordered','99999999-0000-4000-8000-000000000000',10,0);
    insert into purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_cost) values
      ('$L1','$PO','$A','x',5,1), ('$L2','$PO','$A','y',7,1);" >/dev/null
}

# The order and its stock agree when: received, every line fully received,
# stock grew by exactly the lines, one expense of lines + shipping + tax; or
# not received and nothing moved.
agree() {
  $P -c "select case (select status from purchase_orders where id='$PO')
     when 'received' then (not exists (select 1 from purchase_order_items where purchase_order_id='$PO' and coalesce(quantity_received,0) <> quantity)
         and (select available from inventory where product_id='$A') = 1000 + (select coalesce(sum(quantity),0) from purchase_order_items where purchase_order_id='$PO')
         and (select count(*) from expenses) = 1
         and (select amount from expenses limit 1) = (select coalesce(sum(quantity*unit_cost),0) from purchase_order_items where purchase_order_id='$PO')
                                                    + (select coalesce(shipping_cost,0) + coalesce(tax,0) from purchase_orders where id='$PO'))::text
     else ((select available from inventory where product_id='$A') = 1000 and (select count(*) from expenses) = 0)::text end"
}

# The dashboard's receive, one request per step (each its own transaction).
browser_receive() {
  local claimed lines used now
  claimed=$($P -c "$OWN update purchase_orders set status='received', received_at=now() where id='$PO' and status in ('ordered','shipped') and deleted_at is null returning id" 2>>"$LOG" | grep -c .)
  if [ "$claimed" != 1 ]; then echo "NOT_CLAIMED" >>"$LOG"; return; fi
  lines=$($P -c "$OWN select id||'|'||coalesce(product_id::text,'')||'|'||quantity||'|'||coalesce(quantity_received,0) from purchase_order_items where purchase_order_id='$PO' order by id" 2>>"$LOG")
  used=$($P -c "$OWN select string_agg(id||':'||quantity||':'||unit_cost||':'||coalesce(product_id::text,''), ',' order by id) from purchase_order_items where purchase_order_id='$PO'" 2>>"$LOG")
  local total=0
  while IFS='|' read -r id prod qty got; do
    [ -z "$id" ] && continue
    local out=$((qty - got)); [ "$out" -le 0 ] && continue
    # compare-and-set, as changeStock does
    local old; old=$($P -c "$OWN select available from inventory where product_id='$prod'")
    $P -c "$OWN update inventory set available = $old + $out where product_id='$prod' and available = $old" >/dev/null 2>>"$LOG"
    $P -c "$OWN insert into inventory_adjustments (product_id, bucket, change_amount, reason) values ('$prod','available',$out,'PO BROWSER')" >/dev/null 2>>"$LOG"
    local marked; marked=$($P -c "$OWN update purchase_order_items set quantity_received = quantity where id='$id' returning id" 2>>"$LOG" | grep -c .)
    [ "$marked" = 1 ] || echo "REPORTED line removed while being received" >>"$LOG"
  done <<<"$lines"
  $P -c "$OWN insert into expenses (category, amount, expense_date, vendor, note)
         select 'ingredients', (select coalesce(sum(quantity*unit_cost),0) from purchase_order_items where id in (select split_part(x,':',1)::uuid from unnest(string_to_array('$used', ',')) x))
                + coalesce(shipping_cost,0) + coalesce(tax,0), current_date, 'RACE supplier', 'PO BROWSER' from purchase_orders where id='$PO'" >/dev/null 2>>"$LOG"
  now=$($P -c "$OWN select string_agg(id||':'||quantity||':'||unit_cost||':'||coalesce(product_id::text,''), ',' order by id) from purchase_order_items where purchase_order_id='$PO'" 2>>"$LOG")
  [ "$now" = "$used" ] || echo "REPORTED lines changed while being received" >>"$LOG"
}

edit_sql() {
  case "$1" in
    noedit)   echo "select 1" ;;  # control: no edit at all must always agree
    delete)   echo "delete from purchase_order_items where id='$L2'" ;;
    add)      echo "insert into purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) values ('$PO','$A','late',3,1)" ;;
    qty)      echo "update purchase_order_items set quantity = 9 where id='$L2'" ;;
    price)    echo "update purchase_order_items set unit_cost = 4 where id='$L2'" ;;
    shipping) echo "update purchase_orders set shipping_cost = 40 where id='$PO' and status in ('draft','ordered')" ;;  # the dashboard's own condition
    cancel)   echo "update purchase_orders set status = 'cancelled' where id='$PO' and status in ('draft','ordered','shipped')" ;;
  esac
}

run_case() {  # $1 label, $2 kind, $3 order
  setup; : >"$LOG"
  local edit; edit=$(edit_sql "$2")
  # The editing tab, as the dashboard does it (EXT5): after its line edit is
  # saved it reads the order's status again and warns if the order is no
  # longer editable ("...at the same moment..."), so that counts as reported.
  local editor_check="select 'REPORTED editor warned: order is now '||status from purchase_orders where id='$PO' and status not in ('draft','ordered')"
  case "$2" in delete|add|qty|price) ;; *) editor_check="select 1 where false" ;; esac
  if [ "$3" = edit-holds ]; then
    { $P -c "$OWN begin; $edit; select pg_sleep(1.5); commit;" >/dev/null 2>>"$LOG" && $P -c "$OWN $editor_check" >>"$LOG" 2>&1; } &
    sleep 0.4; browser_receive; wait
  else  # the receive starts first; the edit lands between its claim and its line steps
    ( browser_receive ) & sleep 0.15
    $P -c "$OWN $edit" >/dev/null 2>>"$LOG" && $P -c "$OWN $editor_check" >>"$LOG" 2>&1; wait
  fi
  local ok verdict; ok=$(agree)
  if [ "$ok" = true ]; then verdict=agree
  elif grep -q '^REPORTED' "$LOG"; then verdict=reported
  else verdict=SILENT; fi
  local why; why=$(grep -oE "po_busy|can no longer be changed|being received|deadlock detected|could not obtain lock" "$LOG" | sort -u | paste -sd, -)
  printf '%-7s %-9s %-14s %-9s %s\n' "$1" "$2" "$3" "$verdict" "${why:+($why)}"
  if [ -n "$DEBUG" ] && [ "$verdict" != agree ]; then
    sed 's/^/    log: /' "$LOG"
    $P -c "select '    state: status='||status||' shipping='||coalesce(shipping_cost,0) from purchase_orders where id='$PO'"
    $P -c "select '    line: '||quantity||' got '||coalesce(quantity_received,0)||' @'||unit_cost from purchase_order_items where purchase_order_id='$PO'"
    $P -c "select '    stock: '||available from inventory where product_id='$A'"
    $P -c "select '    expense: '||amount from expenses"
  fi
  grep -q "deadlock detected" "$LOG" && errors_seen="$errors_seen deadlock:$1/$2/$3"
  if [ "$1" = guard ]; then
    [ "$verdict" = SILENT ] && silent_guarded=$((silent_guarded+1))
    [ "$verdict" = reported ] && reported_guarded=$((reported_guarded+1))
  fi
}

KINDS="${KINDS:-noedit delete add qty price shipping cancel}"
$P -f "$ROLLBACK" >/dev/null
if [ "$ONLY" != guard ]; then
  for k in $KINDS; do for o in edit-holds receive-first; do run_case none $k $o; done; done
fi
$P -f "$GUARD" >/dev/null
for k in $KINDS; do for o in edit-holds receive-first; do run_case guard $k $o; done; done
$P -f "$ROLLBACK" >/dev/null
echo "GUARDED: silent=$silent_guarded reported=$reported_guarded${errors_seen:+ errors:$errors_seen}"
[ "$silent_guarded" -eq 0 ] && [ "$reported_guarded" -eq 0 ] && [ -z "$errors_seen" ]
