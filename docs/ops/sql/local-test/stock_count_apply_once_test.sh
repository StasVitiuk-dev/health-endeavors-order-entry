#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-16). Never point this at Supabase.
# Owner request of Nov 16 (later): "approving a stock adjustment twice changes
# stock only once; verify the audit history". On a throwaway copy with drafts/10
# (stock functions, R4 adjust_inventory) and drafts/34 (owner-only approval):
#   1. staff propose a count; the owner approves it again and again, and ten
#      times at the same moment: ONE decision, and no stock figure changes
#      (approval never writes stock, by design);
#   2. the approved figure is applied through R4 with the figure the count was
#      made against (p_expected): sent once, then again, then five times at the
#      same moment, stock changes ONCE and exactly one stock-history row exists;
#   3. the audit trail: the approval record (original count, requested count,
#      reason, who proposed, who decided, when) and the stock-history row (who,
#      when, change, reason naming the approved count).
# Real stock writes stay gated: there is no "apply" button anywhere; this only
# proves that the existing safe write cannot double-apply. All rows synthetic.
# Usage: stock_count_apply_once_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_stock_apply_once_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-200)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >/dev/null 2>&1; echo $?; }
as()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$1'; $2; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
O=00000000-0000-4000-8000-0000000003b1; E=00000000-0000-4000-8000-0000000003b4; P1=00000000-0000-4000-8000-0000000003d1
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$E');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'600000001'), ('$E','staff@example.test','employee',true,'600000004');
   insert into products (id, name, sku) values ('$P1','SYNTHETIC lotion A','SYN-APPLY-A');
   insert into inventory (product_id, available) values ('$P1', 40);" >/dev/null
echo "Stock-count approval applied once (throwaway database $DB)"
ok "drafts/10 (stock functions) installs" "$(run "$DIR/drafts/10_DRAFT_stock_functions.sql")" "0"
ok "drafts/34 (owner-only count approval) installs" "$(run "$DIR/drafts/34_DRAFT_stock_count_adjustments.sql")" "0"
STOCK="select available from inventory where product_id = '$P1'"
HIST="select count(*) from inventory_adjustments where product_id = '$P1'"
h0=$(q "$HIST")

echo " 1. approving again and again decides once, and changes no stock"
has "staff propose a count of 38 (two jars short)" "$(as $E "select public.propose_stock_count_adjustment('$P1','available',38,'Counted the main shelf: two jars short')")" '"status": "proposed"'
A=$(q "select id from stock_count_adjustments where product_id = '$P1'")
has "the owner approves" "$(as $O "select public.approve_stock_count_adjustment('$A')")" '"already_decided": false'
has "the owner approves again" "$(as $O "select public.approve_stock_count_adjustment('$A')")" '"already_decided": true'
SAME=$(mktemp)
for n in $(seq 1 10); do ( as $O "select public.approve_stock_count_adjustment('$A')" >>"$SAME" ) & done; wait
ok  "  ten more at the same moment: all say it was already decided" "$(grep -c '"already_decided": true' "$SAME")" "10"
rm -f "$SAME"
ok  "  stock is unchanged: approval never writes stock" "$(q "$STOCK")" "40"
ok  "  no stock-history row was written by approving" "$(q "$HIST")" "$h0"
ok  "  the record: original 40, requested 38, reason, proposer, decider, times" "$(q "select original_count||'/'||requested_count||'/'||reason||'/'||(submitted_by = '$E')::text||'/'||(decided_by = '$O')::text||'/'||(submitted_at is not null and decided_at is not null)::text||'/'||status from stock_count_adjustments where id = '$A'")" "40/38/Counted the main shelf: two jars short/true/true/true/approved"

echo " 2. applying the approved figure through R4 changes stock once"
APPLY="select public.adjust_inventory('$P1', 'available', -2, 'Stock count $A approved by the owner', 40)"
has "applied once: 40 -> 38" "$(as $O "$APPLY")" '"new_value": 38'
has "applied again (a retry, a double click): refused, the stock is no longer 40" "$(as $O "$APPLY")" "ERROR"
SAME=$(mktemp)
for n in $(seq 1 5); do ( as $O "$APPLY" >>"$SAME" ) & done; wait
ok  "  five more at the same moment: all refused" "$(grep -c '"new_value"' "$SAME")" "0"
rm -f "$SAME"
ok  "stock is 38: changed exactly once" "$(q "$STOCK")" "38"
ok  "exactly one stock-history row was written" "$(q "$HIST")" "$((h0 + 1))"

echo " 3. the audit trail"
ok  "the stock-history row: who, change, reason naming the approved count" "$(q "select (adjusted_by = '$O')::text||'/'||change_amount||'/'||(reason like '%$A%')::text||'/'||(adjusted_at is not null)::text from inventory_adjustments where product_id = '$P1'")" "true/-2/true/true"
has "the approval record can no longer be changed by anyone" "$(as $O "update stock_count_adjustments set requested_count = 30 where id = '$A'")" "already approved"
has "nor deleted" "$(as $O "delete from stock_count_adjustments where id = '$A'")" "cannot be deleted\|permission denied"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
