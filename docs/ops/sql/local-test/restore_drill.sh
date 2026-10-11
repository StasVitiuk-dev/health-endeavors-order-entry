#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-07, extension 8). Never point this at Supabase.
# A restore drill on the throwaway local database: plant synthetic data,
# back it up (pg_dump, custom format), restore it into a NEW database, and
# prove the copy is complete and usable: same row counts per table, same
# stock-function fingerprint, Query E and Query F run on the copy, and the
# time each step took. This rehearses the procedure in
# docs/ops/RECOVERY_AND_BACKUP_READINESS.md; it says nothing about whether
# production backups work (only the owner can check those).
# Usage: restore_drill.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
CONN="$*"; SRC=he_real; DST=he_restore_drill
DIR="$(cd "$(dirname "$0")" && pwd)"
DUMP=$(mktemp --suffix=.dump)
pass=0; failn=0
check() { if [ "$2" = "$3" ]; then echo "  ok   $1"; pass=$((pass+1)); else echo "  FAIL $1 (got '$2', want '$3')"; failn=$((failn+1)); fi; }
P() { psql $CONN -d "$1" -qtAX -v ON_ERROR_STOP=1 --set=client_min_messages=warning -c "$2"; }
cleanup() { rm -f "$DUMP"; dropdb $CONN --if-exists "$DST" 2>/dev/null; P $SRC "set session_replication_role = replica; delete from order_items where id::text like 'f9%'; delete from orders where id::text like 'f9%'; delete from inventory where product_id::text like 'f9%'; delete from products where id::text like 'f9%';" >/dev/null 2>&1; }
trap cleanup EXIT
TABLES="products inventory suppliers purchase_orders purchase_order_items inventory_lots inventory_adjustments expenses recalls orders order_items returns approval_requests documents tasks profiles audit_log"
fp() { P "$1" "select md5(string_agg(p.proname || ':' || pg_get_function_identity_arguments(p.oid) || ':' || md5(p.prosrc), ',' order by p.proname)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('_he_apply_stock_change','adjust_inventory','receive_purchase_order','quarantine_recall','receive_return','delete_unused_product')"; }
counts() { for t in $TABLES; do printf '%s=%s ' "$t" "$(P "$1" "select count(*) from $t")"; done; }

echo "Restore drill (local, synthetic)"
P $SRC "set session_replication_role = replica;
  insert into products (id, name, sku) select ('f9000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'DRILL product ' || g, 'DRILL-' || g from generate_series(1, 200) g;
  insert into inventory (product_id, available) select id, 10 from products where id::text like 'f9%';
  insert into orders (id, channel, order_number, total) select ('f9100000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'manual', 'DRILL-O' || g, g from generate_series(1, 2000) g;
  insert into order_items (order_id, sku, quantity) select id, 'DRILL-1', 1 from orders where id::text like 'f91%';" >/dev/null
before=$(counts $SRC); fpb=$(fp $SRC)

t0=$(date +%s%N)
pg_dump $CONN -d $SRC -Fc -f "$DUMP" || { echo "dump failed"; exit 2; }
t1=$(date +%s%N)
dropdb $CONN --if-exists $DST; createdb $CONN $DST
pg_restore $CONN -d $DST --no-owner "$DUMP" 2>/tmp/he_restore_err.log
t2=$(date +%s%N)

check "every table has the same number of rows in the copy" "$(counts $DST)" "$before"
check "stock functions are identical in the copy (fingerprint)" "$(fp $DST)" "$fpb"
check "Query E runs on the copy" "$(psql $CONN -d $DST -qtAX -f "$DIR/../04_READONLY_E_stock_reconciliation.sql" >/dev/null 2>&1 && echo ok)" ok
check "Query F runs on the copy" "$(psql $CONN -d $DST -qtAX -f "$DIR/../05_READONLY_F_daily_integrity_check.sql" >/dev/null 2>&1 && echo ok)" ok
check "row-level security is still on in the copy (orders)" "$(P $DST "select relrowsecurity from pg_class where relname = 'orders'")" t
check "the original was not changed by the drill" "$(counts $SRC)" "$before"
echo "  dump: $(( (t1 - t0) / 1000000 )) ms, size $(du -k "$DUMP" | cut -f1) KB; restore into a new database: $(( (t2 - t1) / 1000000 )) ms"
echo "TOTAL: $pass passed, $failn failed"
[ "$failn" = 0 ]
