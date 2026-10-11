#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-10-11, extension 10). Never point this at Supabase.
# Times the nightly integrity check (drafts/25 + 29) on a throwaway copy
# filled with large SYNTHETIC data (default: 50,000 orders, 100,000 order
# lines, 25,000 tasks, 25,000 expenses, 5,000 returns) with planted problems,
# and checks the run finishes well inside the proposed 60-second timeout,
# finds exactly the planted problems, and changes no business data.
# Usage: integrity_perf_test.sh -h /var/tmp/hepg -p 5499 -U postgres [orders]
set -u
N=50000
if [ $# -gt 6 ]; then N="${@: -1}"; set -- "${@:1:6}"; fi
CONN=("$@"); SRC=he_real; DB=he_intperf_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "create table if not exists public.feature_flags (id uuid primary key default gen_random_uuid(), flag_key text not null, label text, description text, enabled boolean not null default false)" >/dev/null
echo "Nightly integrity check at scale: $N orders (throwaway database $DB)"
q "alter table orders disable trigger user; alter table order_items disable trigger user; alter table tasks disable trigger user; alter table expenses disable trigger user; alter table returns disable trigger user" >/dev/null
q "insert into orders (channel, order_number, status, subtotal, shipping_total, tax_total, total, placed_at, source)
   select 'manual', 'SYN-' || g, 'paid', 10, 2, 1, case when g % 10000 = 7 then 99 else 13 end, now() - (g || ' minutes')::interval, 'manual' from generate_series(1, $N) g" >/dev/null
q "update orders set order_number = 'SYN-1' where order_number in ('SYN-2', 'SYN-3')" >/dev/null   # 1 duplicated number (3 orders)
q "insert into order_items (order_id, quantity, sku) select id, 1, case when random() < 0.5 then (select sku from products order by sku limit 1) else (select sku from products order by sku desc limit 1) end from orders, generate_series(1, 2)" >/dev/null
q "update order_items set sku = 'SYN-NOPE' where id = (select id from order_items limit 1)" >/dev/null
q "insert into tasks (title, status, updated_at, due_at) select 'SYN task ' || g, case when g % 1000 = 0 then 'in_progress' else 'done' end, now() - interval '30 days', now() - interval '30 days' from generate_series(1, $((N/2))) g" >/dev/null
q "insert into expenses (category, amount, expense_date, vendor) select 'packaging', 1 + (g % 997), current_date - (g % 365), 'SYN vendor ' || g from generate_series(1, $((N/2))) g" >/dev/null
q "insert into returns (order_id, reason, status) select id, 'SYN', 'requested' from orders limit $((N/10))" >/dev/null
q "analyze" >/dev/null
ok "drafts/25 installs" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$DIR/drafts/25_DRAFT_integrity_check_schedule.sql" >/dev/null 2>&1; echo $?)" "0"
ok "drafts/29 installs" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$DIR/drafts/29_DRAFT_integrity_results_on_home.sql" >/dev/null 2>&1; echo $?)" "0"
SNAP="select (select count(*) from orders)||'/'||(select count(*) from order_items)||'/'||(select count(*) from tasks)||'/'||(select count(*) from expenses)"
before=$(q "$SNAP")
ms=$(q "set statement_timeout = '60s'; select extract(epoch from (clock_timestamp() - t0)) * 1000 from (select clock_timestamp() as t0) s, lateral (select public.run_integrity_check()) r" | tail -1)
ms=${ms%.*}
echo "  run time: ${ms} ms"
ok "the run finished inside the 60 s timeout, logged ok" "$(q "select status from integrity_check_runs order by id desc limit 1")" "ok"
ok "  well under it (< 20 s)" "$([ "${ms:-999999}" -lt 20000 ] && echo yes || echo "no (${ms} ms)")" "yes"
ok "planted duplicate order number found" "$(q "select found from integrity_check_results where section like 'F06%' order by id desc limit 1")" "1"
ok "planted unknown SKU found" "$(q "select found from integrity_check_results where section like 'F11%' order by id desc limit 1")" "1"
ok "planted wrong totals found" "$(q "select found from integrity_check_results where section like 'F13%' order by id desc limit 1")" "$((N/10000))"
ok "planted stuck tasks found" "$(q "select found from integrity_check_results where section like 'F01%' order by id desc limit 1")" "$((N/2/1000))"
ok "business data unchanged" "$(q "$SNAP")" "$before"
ok "Home's reads are index-backed and small (latest run)" "$(q "explain select id from integrity_check_runs order by started_at desc limit 1" | grep -c 'Index Scan')" "1"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
