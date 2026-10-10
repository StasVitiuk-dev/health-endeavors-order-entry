#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-10, extension 9). Never point this at Supabase.
# Tests drafts/23 (four integrity rules) and drafts/24 (rollback) on a
# throwaway copy: stops without changing anything when existing data breaks a
# rule; installs on clean data; each rule refuses a bad value and allows good
# ones; rollback removes them.
# Usage: integrity_constraints_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_constraints_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
rc()  { psql "${CONN[@]}" -d "$DB" -qtAX -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>&1; echo $?; }
run() { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >/dev/null 2>"$ERRF"; echo $?; }
ERRF=$(mktemp)
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
echo "Integrity constraints (throwaway database $DB)"
NCON="select count(*) from pg_constraint where conname in ('inventory_recalled_check','inventory_lots_remaining_range_check','purchase_order_items_received_range_check','returns_refund_amount_check')"

ok "copy starts clean of the four problems" "$(q "select (select count(*) from inventory where recalled<0)+(select count(*) from inventory_lots where quantity_remaining<0 or quantity_remaining>quantity_received)+(select count(*) from purchase_order_items where quantity_received<0 or quantity_received>quantity)+(select count(*) from returns where refund_amount<0)")" "0"
PID0=$(q "select id from products limit 1")
LOT=$(q "insert into inventory_lots (product_id, lot_number, quantity_received, quantity_remaining) values ('$PID0', 'SYN-CONSTRAINT-LOT', 10, 10) returning id" | head -1)
q "update inventory_lots set quantity_remaining = quantity_received + 1 where id = '$LOT'" >/dev/null
ok "existing bad data: install stops" "$(run "$DIR/drafts/23_DRAFT_integrity_constraints.sql")" "3"
ok "  says how many rows" "$(grep -c 'lots out of range: 1' "$ERRF")" "1"
ok "  and adds no rule" "$(q "$NCON")" "0"
q "update inventory_lots set quantity_remaining = quantity_received where id = '$LOT'" >/dev/null

ok "clean data: install succeeds" "$(run "$DIR/drafts/23_DRAFT_integrity_constraints.sql")" "0"
ok "four rules present" "$(q "$NCON")" "4"
PID=$(q "select product_id from inventory limit 1")
ok "recalled below 0 refused" "$(rc "update inventory set recalled = -1 where product_id = '$PID'")" "1"
ok "recalled 0 allowed" "$(rc "update inventory set recalled = 0 where product_id = '$PID'")" "0"
ok "lot remaining above received refused" "$(rc "update inventory_lots set quantity_remaining = quantity_received + 1 where id = '$LOT'")" "1"
ok "lot remaining below 0 refused" "$(rc "update inventory_lots set quantity_remaining = -1 where id = '$LOT'")" "1"
ok "lot remaining 0 allowed" "$(rc "update inventory_lots set quantity_remaining = 0 where id = '$LOT'")" "0"
LINE=$(q "select id from purchase_order_items limit 1")
ok "PO line received above ordered refused" "$(rc "update purchase_order_items set quantity_received = quantity + 1 where id = '$LINE'")" "1"
ok "PO line received equal to ordered allowed" "$(rc "update purchase_order_items set quantity_received = quantity where id = '$LINE'")" "0"
RET=$(q "select id from returns limit 1")
if [ -n "$RET" ]; then
  ok "negative refund refused" "$(rc "update returns set refund_amount = -0.01 where id = '$RET'")" "1"
  ok "empty refund allowed" "$(rc "update returns set refund_amount = null where id = '$RET'")" "0"
fi
ok "second install refused (already there), nothing changed" "$(run "$DIR/drafts/23_DRAFT_integrity_constraints.sql"; q "$NCON")" "$(printf '3\n4')"
ok "rollback succeeds" "$(run "$DIR/drafts/24_DRAFT_rollback_integrity_constraints.sql")" "0"
ok "rollback removed the four" "$(q "$NCON")" "0"
ok "second rollback is harmless" "$(run "$DIR/drafts/24_DRAFT_rollback_integrity_constraints.sql")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
rm -f "$ERRF"
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
