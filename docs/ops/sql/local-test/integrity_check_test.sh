#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-07, extension 8). Never point this at Supabase.
# Proves Query F (05_READONLY_F_daily_integrity_check.sql) reports nothing on
# clean data and exactly the planted problem for each check, runs inside a
# READ ONLY transaction, and changes nothing. Synthetic data only; cleans up
# after itself (other local scripts' resets do not know its rows).
# Usage: integrity_check_test.sh <psql args>   e.g. -h /var/tmp/hepg -p 5499 -U postgres -d he_real
P="psql $* -qtAX -v ON_ERROR_STOP=0 --set=client_min_messages=warning"
DIR="$(cd "$(dirname "$0")" && pwd)"
QF="$DIR/../05_READONLY_F_daily_integrity_check.sql"
pass=0; failn=0
check() { if [ "$2" = "$3" ]; then echo "  ok   $1"; pass=$((pass+1)); else echo "  FAIL $1 (got '$2', want '$3')"; failn=$((failn+1)); fi; }
q() { $P -c "$1" 2>&1; }
# "section|check|findings|examples" -> findings of the check whose section starts with $1
count() { $P -F '|' -f "$QF" | awk -F'|' -v s="$1" 'index($1, s) == 1 { print $3 }'; }
all_zero() { $P -F '|' -f "$QF" | awk -F'|' '$3 != 0 { n++ } END { print n + 0 }'; }

wipe() {
  q "set session_replication_role = replica;
     delete from inventory_adjustments; delete from expenses; delete from recalls; delete from returns; delete from order_items; delete from orders;
     delete from inventory_lots; delete from purchase_order_items; delete from purchase_orders; delete from inventory; delete from products;
     delete from suppliers; delete from tasks; delete from approval_requests;" >/dev/null
}
base() {
  wipe
  q "insert into suppliers (id, name) values ('f8000000-0000-4000-8000-000000000001', 'INTEGRITY Supplier');
     insert into products (id, name, sku) values ('f8000000-0000-4000-8000-0000000000a1', 'INTEGRITY Lotion', 'INT-A');
     insert into inventory (product_id, available) values ('f8000000-0000-4000-8000-0000000000a1', 5);
     insert into orders (id, channel, order_number, subtotal, shipping_total, tax_total, total) values ('f8000000-0000-4000-8000-0000000000b1', 'manual', 'INT-1', 10, 2, 1, 13);
     insert into order_items (id, order_id, sku, quantity) values ('f8000000-0000-4000-8000-0000000000c1', 'f8000000-0000-4000-8000-0000000000b1', 'int-a', 1);
     insert into tasks (title, status, due_at) values ('INTEGRITY ok task', 'open', now() + interval '1 day');
     insert into approval_requests (action_type, summary, status) values ('INTEGRITY', 'fresh', 'pending');" >/dev/null
}
# F14 drops the "available >= 0" rule on this throwaway database for a moment;
# it is always put back, also if the script stops early.
restore() { wipe; q "alter table inventory drop constraint if exists inventory_available_check; alter table inventory add constraint inventory_available_check check (available >= 0)" >/dev/null; }
trap restore EXIT

echo "Query F local test"
base
check "clean data: every check is 0" "$(all_zero)" 0

plant() { base; q "$2" >/dev/null; check "$1 found" "$(count "$1")" 1; check "$1: no other check fires" "$(all_zero)" 1; }
plant F01 "insert into tasks (title, status, updated_at) values ('INTEGRITY stuck', 'in_progress', now() - interval '20 days')"
plant F02 "insert into tasks (title, status, due_at) values ('INTEGRITY late', 'open', now() - interval '9 days')"
plant F03 "insert into approval_requests (action_type, summary, status, created_at) values ('INTEGRITY', 'old', 'pending', now() - interval '8 days')"
plant F04 "insert into inventory_lots (id, product_id, lot_number, quantity_received, quantity_remaining) values ('f8000000-0000-4000-8000-0000000000d1','f8000000-0000-4000-8000-0000000000a1','L1',1,1);
           insert into recalls (lot_id, product_id, reason, status, created_at) values ('f8000000-0000-4000-8000-0000000000d1','f8000000-0000-4000-8000-0000000000a1','INTEGRITY','initiated', now() - interval '15 days')"
plant F05 "insert into purchase_orders (po_number, status, supplier_id, expected_at) values ('INT-PO-LATE', 'shipped', 'f8000000-0000-4000-8000-000000000001', current_date - 10)"
plant F06 "insert into orders (channel, order_number, total) values ('manual', 'INT-1', 13)"
plant F07 "insert into suppliers (name) values ('  integrity   SUPPLIER ')"
plant F08 "insert into products (name, sku) values ('integrity lotion', 'INT-B')"
plant F09 "insert into expenses (category, amount, expense_date, vendor) values ('packaging', 12.5, '2026-10-01', 'Box Co'), ('packaging', 12.5, '2026-10-01', 'box co ')"
plant F10 "insert into orders (id, channel, order_number, total) values ('f8000000-0000-4000-8000-0000000000b2', 'manual', 'INT-2', 5);
           insert into returns (order_id, order_item_id, reason, status) values ('f8000000-0000-4000-8000-0000000000b2', 'f8000000-0000-4000-8000-0000000000c1', 'damaged', 'requested')"
plant F11 "insert into order_items (order_id, sku, quantity) values ('f8000000-0000-4000-8000-0000000000b1', 'NO-SUCH-SKU', 1)"
plant F12 "insert into orders (channel, order_number, total) values ('manual', 'INT-NEG', -1)"
plant F13 "insert into orders (channel, order_number, subtotal, shipping_total, tax_total, total) values ('manual', 'INT-SUM', 10, 2, 1, 14)"
plant F14 "alter table inventory drop constraint if exists inventory_available_check; update inventory set available = -1"
q "update inventory set available = 0; alter table inventory add constraint inventory_available_check check (available >= 0)" >/dev/null
plant F15 "insert into returns (order_id, order_item_id, reason, status) values ('f8000000-0000-4000-8000-0000000000b1', 'f8000000-0000-4000-8000-0000000000c1', 'damaged', 'refunded')"

base
before=$(q "select count(*) from orders")
check "runs inside a READ ONLY transaction" "$( { echo 'begin read only;'; cat "$QF"; echo 'commit;'; } | $P -F '|' 2>&1 | grep -c ERROR)" 0
check "running it changed nothing" "$(q "select count(*) from orders")" "$before"
echo "TOTAL: $pass passed, $failn failed"
[ "$failn" = 0 ]
