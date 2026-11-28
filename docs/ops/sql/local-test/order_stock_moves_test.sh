#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-28). Never point this at Supabase.
# Tests drafts/76 (an order takes its bottles off the stock count exactly once, and gives them back
# once) and drafts/77 (its rollback) on a throwaway copy of the real-shape database (he_real, built
# from the owner's Query A). All products, orders and people are made up.
# Usage: order_stock_moves_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_order_stock_moves_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/76_DRAFT_order_stock_moves.sql"; ROLLBACK="$DIR/drafts/77_DRAFT_rollback_order_stock_moves.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2"
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$who'; $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
visitor() { psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role anon; $1; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000076a1   # owner
A=00000000-0000-4000-8000-0000000076a2   # administrator, active
X=00000000-0000-4000-8000-0000000076a3   # administrator, switched off
E=00000000-0000-4000-8000-0000000076a4   # employee
P1=00000000-0000-4000-8000-0000000076b1; P2=00000000-0000-4000-8000-0000000076b2; P3=00000000-0000-4000-8000-0000000076b3
O1=00000000-0000-4000-8000-0000000076c1; O2=00000000-0000-4000-8000-0000000076c2; O3=00000000-0000-4000-8000-0000000076c3
O4=00000000-0000-4000-8000-0000000076c4; O5=00000000-0000-4000-8000-0000000076c5; O6=00000000-0000-4000-8000-0000000076c6

fresh() {
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
  q "insert into profiles (id, email, role, is_active, deleted_at, account_number) values
       ('$O','o76@example.test','owner',true,null,'760000001'), ('$A','a76@example.test','administrator',true,null,'760000002'),
       ('$X','x76@example.test','administrator',false,null,'760000003'), ('$E','e76@example.test','employee',true,null,'760000004');
     insert into products (id, sku, name, status) values
       ('$P1','HE-BODY-200','Test body cream 200 ml','active'), ('$P2','HE-FACE-50','Test face serum 50 ml','active'),
       ('$P3','HE-NEW-10','Test new item (no stock row yet)','active');
     insert into inventory (product_id, available) values ('$P1', 10), ('$P2', 4);
     insert into orders (id, channel, external_order_id, order_number, status, total) values
       ('$O1','shopify','T-1','#T1001','paid',60), ('$O2','shopify','T-2','#T1002','paid',30),
       ('$O3','shopify','T-3','#T1003','paid',20), ('$O4','shopify','T-4','#T1004','paid',50),
       ('$O5','shopify','T-5','#T1005','paid',10), ('$O6','shopify','T-6','#T1006','paid',10);
     update orders set deleted_at = now() where id = '$O6';
     insert into order_items (order_id, sku, product_name, quantity) values
       ('$O1','HE-BODY-200','Body cream',2), ('$O1','he-face-50','Face serum (lower-case SKU)',1), ('$O1','HE-BODY-200','Body cream again',1),
       ('$O1','HE-BODY-200','Free sample line',0),
       ('$O2','HE-BODY-200','Body cream',1), ('$O2','HE-GHOST-1','A product the dashboard does not know',1),
       ('$O3','HE-FACE-50','Face serum',9), ('$O3','HE-BODY-200','Body cream',1),
       ('$O4','HE-BODY-200','Body cream',1),
       ('$O5','HE-NEW-10','New item',1),
       ('$O6','HE-BODY-200','Body cream',1);" >"$OUTF" 2>&1
  if grep -q ERROR "$OUTF"; then echo "set-up failed:"; cat "$OUTF"; fi
}
avail()  { q "select string_agg(coalesce(i.available::text,'-'), ',' order by p.sku) from products p left join inventory i on i.product_id = p.id where p.id in ('$P1','$P2','$P3')"; }
moves()  { q "select count(*) from order_stock_moves where order_id = '$1' and kind = '$2'"; }
take()   { as "$1" "select public.take_order_stock('$2')"; }
back()   { as "$1" "select public.give_back_order_stock('$2')"; }

fresh
echo "stock per order (drafts/76, drafts/77; throwaway database $DB)"
ok  "set-up: stock body 10, serum 4, new item has no stock row" "$(avail)" "10,4,-"
ok  "drafts/76 installs" "$(run "$INSTALL")" "0"
ok  "  a second install changes nothing and succeeds" "$(run "$INSTALL")" "0"
ok  "  nothing changed stock by installing" "$(avail)" "10,4,-"

echo " taking stock for an order"
R=$(take "$O" "$O1")
has "the owner takes order #T1001" "$R" '"lines_changed": 3'
ok  "  body 10 - 2 - 1 = 7, serum 4 - 1 = 3 (lower-case SKU matched)" "$(avail)" "7,3,-"
ok  "  one move per line with a quantity (the 0 line is skipped)" "$(moves "$O1" take)" "3"
ok  "  one history row per line, with the order number" "$(q "select count(*) from inventory_adjustments where reason = 'Order #T1001: taken off stock'")" "3"
ok  "  the history rows say who" "$(q "select count(*) from inventory_adjustments where reason like 'Order #T1001%' and adjusted_by = '$O'")" "3"
R=$(take "$O" "$O1")
has "taking the same order again changes nothing" "$R" '"lines_already_done": 3'
ok  "  stock unchanged" "$(avail)" "7,3,-"
ok  "  still three moves" "$(moves "$O1" take)" "3"

echo " refusals (all or nothing)"
has "an order with a SKU no product has is refused" "$(take "$O" "$O2")" "no product has the SKU of these lines: HE-GHOST-1"
ok  "  nothing changed, not even its known line" "$(avail)|$(moves "$O2" take)" "7,3,-|0"
has "an order that would take a product below zero is refused" "$(take "$O" "$O3")" "not enough in stock for HE-FACE-50: needs 9, has 3"
ok  "  nothing changed, not even the line that fitted" "$(avail)|$(moves "$O3" take)" "7,3,-|0"
has "a product with no stock row yet counts as zero (refused, not an error)" "$(take "$O" "$O5")" "HE-NEW-10: needs 1, has 0"
ok  "  nothing changed" "$(moves "$O5" take)" "0"
has "a deleted order is refused" "$(take "$O" "$O6")" "does not exist or was deleted"
has "an order that does not exist is refused" "$(take "$O" 00000000-0000-4000-8000-0000000076ff)" "does not exist or was deleted"

echo " who may"
has "an employee is refused" "$(take "$E" "$O4")" "Only the Owner or an Administrator"
has "a switched-off administrator is refused" "$(take "$X" "$O4")" "Only the Owner or an Administrator"
has "a visitor cannot even call it" "$(visitor "select public.take_order_stock('$O4')")" "permission denied"
has "  nor the inner function" "$(visitor "select public._he_order_stock('$O4','take')")" "permission denied"
ok  "  nothing changed by any of them" "$(avail)|$(moves "$O4" take)" "7,3,-|0"
has "an active administrator takes order #T1004" "$(take "$A" "$O4")" '"lines_changed": 1'
ok  "  body 7 - 1 = 6" "$(avail)" "6,3,-"
has "the inner function refuses a made-up kind" "$(as "$O" "select public._he_order_stock('$O4','steal')")" 'Unknown stock move'

echo " the record"
ok  "the owner reads the moves" "$(as "$O" "select count(*) from order_stock_moves")" "4"
ok  "an employee sees none" "$(as "$E" "select count(*) from order_stock_moves")" "0"
has "a visitor cannot read them" "$(visitor "select count(*) from order_stock_moves")" "permission denied"
has "the owner cannot change a move" "$(as "$O" "update order_stock_moves set quantity = 99")" "permission denied"
has "the owner cannot delete a move" "$(as "$O" "delete from order_stock_moves")" "permission denied"
has "an employee cannot write a move by hand" "$(as "$E" "insert into order_stock_moves (order_id, order_item_id, product_id, quantity, kind, moved_by) values ('$O5', gen_random_uuid(), '$P1', 1, 'take', '$E')")" "row-level security"
has "the owner cannot write a move in someone else's name" "$(as "$O" "insert into order_stock_moves (order_id, order_item_id, product_id, quantity, kind, moved_by) values ('$O5', gen_random_uuid(), '$P1', 1, 'take', '$A')")" "row-level security"

echo " giving back (a cancelled order)"
has "the owner gives back #T1001" "$(back "$O" "$O1")" '"lines_changed": 3'
ok  "  body 6 + 3 = 9, serum 3 + 1 = 4" "$(avail)" "9,4,-"
ok  "  three give-back moves and history rows" "$(moves "$O1" give_back)|$(q "select count(*) from inventory_adjustments where reason = 'Order #T1001: given back to stock (cancelled)'")" "3|3"
has "giving back again changes nothing" "$(back "$O" "$O1")" '"lines_already_done": 3'
ok  "  stock unchanged" "$(avail)" "9,4,-"
has "taking a given-back order again changes nothing (correct it by hand)" "$(take "$O" "$O1")" '"lines_changed": 0'
ok  "  stock unchanged" "$(avail)" "9,4,-"
has "giving back an order that took nothing does nothing" "$(back "$O" "$O5")" '"lines_changed": 0'
q "update products set sku = 'HE-BODY-200-RENAMED' where id = '$P1'" >/dev/null
has "after a SKU is renamed, giving back still finds the product it was taken from" "$(back "$O" "$O4")" '"lines_changed": 1'
ok  "  body 9 + 1 = 10" "$(avail)" "10,4,-"
q "update products set sku = 'HE-BODY-200' where id = '$P1'" >/dev/null

echo " two devices at the same moment"
q "insert into orders (id, channel, external_order_id, order_number, status) values ('00000000-0000-4000-8000-0000000076c7','shopify','T-7','#T1007','paid');
   insert into order_items (order_id, sku, product_name, quantity) values ('00000000-0000-4000-8000-0000000076c7','HE-BODY-200','Body cream',2);" >/dev/null
( psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$O'; select public.take_order_stock('00000000-0000-4000-8000-0000000076c7'); select pg_sleep(2); commit;" >/dev/null 2>&1 ) &
sleep 0.5
R=$(as "$A" "select public.take_order_stock('00000000-0000-4000-8000-0000000076c7')")
wait
has "the second device waits, then finds the order done" "$R" '"lines_already_done": 1'
ok  "  taken once: body 10 - 2 = 8" "$(avail)" "8,4,-"

echo " rollback (drafts/77)"
ok  "rollback succeeds" "$(run "$ROLLBACK")" "0"
has "  says the record is kept because it holds moves" "$(cat "$OUTF")" "order_stock_moves kept"
ok  "  the functions are gone" "$(q "select count(*) from pg_proc where proname in ('take_order_stock','give_back_order_stock','_he_order_stock')")" "0"
ok  "  stock numbers unchanged" "$(avail)" "8,4,-"
ok  "  the record table is kept" "$(q "select count(*) > 0 from order_stock_moves")" "t"
ok  "  install works again afterwards and keeps the record" "$(run "$INSTALL")|$(q "select count(*) from order_stock_moves where kind = 'take'")" "0|5"
fresh
ok  "on an empty record, install then rollback removes the table too" "$(run "$INSTALL")|$(run "$ROLLBACK")|$(q "select to_regclass('public.order_stock_moves') is null")" "0|0|t"
ok  "  a second rollback stops: nothing to undo" "$(run "$ROLLBACK")" "3"

echo " install refusals (wrong shape stops everything)"
fresh
q "drop index if exists products_sku_unique_idx" >/dev/null
ok  "without the case-insensitive SKU index, drafts/76 stops" "$(run "$INSTALL")" "3"
has "  and names it" "$(cat "$OUTF")" "unique index on products(lower(sku))"
ok  "  nothing was created" "$(q "select count(*) from pg_proc where proname = 'take_order_stock'")|$(q "select to_regclass('public.order_stock_moves') is null")" "0|t"
fresh
q "alter table order_items rename column sku to sku_code" >/dev/null
ok  "when order_items has no sku column, drafts/76 stops" "$(run "$INSTALL")" "3"
has "  and names it" "$(cat "$OUTF")" "column order_items.sku"
fresh
q "create table order_stock_moves (id int)" >/dev/null
ok  "a table of the same name it did not create stops it" "$(run "$INSTALL")" "3"
has "  and says so" "$(cat "$OUTF")" "that this file did not create"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "order stock moves: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
