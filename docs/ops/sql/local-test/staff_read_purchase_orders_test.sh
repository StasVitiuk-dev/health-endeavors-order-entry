#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-22). Never point this at Supabase.
# Tests drafts/44 (active staff may SEE purchase orders and their lines, read
# only) and drafts/45 (rollback) on a throwaway copy, as the owner, an
# administrator, active staff, a deactivated staff member and a visitor; and,
# with drafts/40 installed too, that staff can then submit a receiving record
# while stock still changes only on the owner's approval. All rows are made up.
# Usage: staff_read_purchase_orders_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_staff_read_po_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/44_DRAFT_staff_read_purchase_orders.sql"; ROLLBACK="$DIR/drafts/45_DRAFT_rollback_staff_read_purchase_orders.sql"
RECEIVING="$DIR/drafts/40_DRAFT_partial_receiving_returns.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000006a1; A=00000000-0000-4000-8000-0000000006a2; E=00000000-0000-4000-8000-0000000006a3; X=00000000-0000-4000-8000-0000000006a4
P=00000000-0000-4000-8000-0000000006b1; SUP=00000000-0000-4000-8000-0000000006c1
PO=00000000-0000-4000-8000-0000000006d1; IT=00000000-0000-4000-8000-0000000006d2; POD=00000000-0000-4000-8000-0000000006d3
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$A','$E','$X');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'600000001'),
     ('$A','admin@example.test','administrator',true,'600000002'), ('$E','staff@example.test','employee',true,'600000003'), ('$X','gone@example.test','employee',false,'600000004');
   insert into products (id, name, sku) values ('$P','SYNTHETIC Honey Milk 8 oz','SYN-SRPO-A');
   insert into inventory (product_id, available, damaged) values ('$P', 5, 0);
   insert into suppliers (id, name, supplier_type, is_active) values ('$SUP','SYN Lotion Lab','lab',true);
   insert into purchase_orders (id, po_number, supplier_id, status, payment_status) values ('$PO','SYN-PO-030','$SUP','ordered','unpaid');
   insert into purchase_orders (id, po_number, supplier_id, status, payment_status, deleted_at) values ('$POD','SYN-PO-031','$SUP','ordered','unpaid', now());
   insert into purchase_order_items (id, purchase_order_id, product_id, sku, description, quantity, unit_cost, quantity_received) values ('$IT','$PO','$P','SYN-SRPO-A','Honey Milk 8 oz',20,4.25,0);" >/dev/null
echo "Staff read purchase orders (throwaway database $DB)"
echo " 1. before: only the owner and administrators see purchase orders"
ok  "staff see none today" "$(as $E "select count(*) from purchase_orders")/$(as $E "select count(*) from purchase_order_items")" "0/0"
ok  "  the owner sees them" "$(as $O "select count(*) from purchase_orders where deleted_at is null")" "1"

echo " 2. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"

echo " 3. after: active staff see purchase orders and lines, read only"
ok  "staff see the open order and its line, with the unit cost" "$(as $E "select po_number from purchase_orders")|$(as $E "select sku||'/'||quantity||'/'||unit_cost from purchase_order_items")" "SYN-PO-030|SYN-SRPO-A/20/4.25"
ok  "  a deleted order stays hidden from staff" "$(as $E "select count(*) from purchase_orders where id = '$POD'")" "0"
has "  staff cannot change an order" "$(as $E "update purchase_orders set status = 'cancelled' where id = '$PO' returning id")" "^$\|permission denied\|row-level security"
ok  "    (and nothing changed)" "$(q "select status from purchase_orders where id = '$PO'")" "ordered"
has "  staff cannot add an order" "$(as $E "insert into purchase_orders (po_number, supplier_id, status, payment_status) values ('SYN-PO-099','$SUP','draft','unpaid')")" "row-level security\|permission denied"
has "  staff cannot change a line's quantity or cost" "$(as $E "update purchase_order_items set unit_cost = 0 where id = '$IT' returning id")" "^$\|permission denied\|row-level security"
ok  "    (and nothing changed)" "$(q "select unit_cost from purchase_order_items where id = '$IT'")" "4.25"
has "  staff cannot delete a line" "$(as $E "delete from purchase_order_items where id = '$IT' returning id")" "^$\|permission denied\|row-level security"
ok  "    (still there)" "$(q "select count(*) from purchase_order_items where id = '$IT'")" "1"
ok  "a deactivated account sees nothing" "$(as $X "select count(*) from purchase_orders")" "0"
has "a visitor sees nothing" "$(as anon "select count(*) from purchase_orders")" "permission denied\|^0$"
ok  "the owner and an administrator see what they saw before" "$(as $O "select count(*) from purchase_orders")/$(as $A "select count(*) from purchase_orders")" "2/2"

echo " 4. with partial receiving (drafts/40): staff submit, the owner approves"
ok  "install drafts/40 as well" "$(run "$RECEIVING")" "0"
R=$(as $E "select (public.submit_receiving_record('00000000-0000-4000-8000-000000000601', '$PO', '[{\"po_item_id\":\"$IT\",\"good\":8}]'::jsonb, 'first pallet'))->>'id'")
has "staff can now submit a receiving record for the order they see" "$R" "^[0-9a-f-]\{36\}$"
ok  "  stock is unchanged until the owner approves" "$(q "select available from inventory where product_id = '$P'")" "5"
has "  staff cannot approve it" "$(as $E "select public.approve_receiving_record('$R')")" "Only the owner"
as $O "select public.approve_receiving_record('$R')" >/dev/null
ok  "  the owner approves: Available 5 -> 13, 8 of 20 received" "$(q "select available from inventory where product_id = '$P'")/$(q "select quantity_received from purchase_order_items where id = '$IT'")" "13/8"

echo " rollback"
ok  "rollback" "$(run "$ROLLBACK")" "0"
ok  "  staff see no purchase order again" "$(as $E "select count(*) from purchase_orders")" "0"
ok  "  the owner still sees them; nothing else changed" "$(as $O "select count(*) from purchase_orders")/$(q "select available from inventory where product_id = '$P'")" "2/13"
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
