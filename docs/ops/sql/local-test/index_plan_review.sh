#!/usr/bin/env bash
# LOCAL TEST ONLY (EXT14, 2026-10-11). Never point this at Supabase.
# Evidence for index decisions: runs the dashboard's real query shapes on a
# throwaway real-shape database filled with synthetic volume (default 50k
# orders/expenses, 20k tasks/approvals, 200k stock-history rows), prints the
# plan type and time for each, then repeats with each candidate index and
# reports the read gain, the index size and the extra cost of 5,000 inserts.
# Nothing here is a production change: candidates go to the engineering report.
# Usage: index_plan_review.sh <psql connection args>   e.g. -h /var/tmp/hepg -p 5499 -U postgres
CONN="$*"
DIR="$(cd "$(dirname "$0")" && pwd)"
DB=he_index_review_$$
N=${HE_ROWS:-50000}
P() { psql $CONN -d $DB -qtAX -v ON_ERROR_STOP=1 "$@"; }
cleanup() { dropdb $CONN --if-exists $DB >/dev/null 2>&1; }
trap cleanup EXIT INT TERM
createdb $CONN $DB && P -f "$DIR/01_REAL_SHAPE_schema_for_local_tests.sql" >/dev/null || exit 1
P -c "create extension if not exists pg_trgm;" >/dev/null
P -c "set session_replication_role = replica;
  insert into orders (id, channel, order_number, customer_name, status, total, placed_at, deleted_at)
    select md5('o'||g)::uuid, 'manual', 'HE-'||lpad(g::text, 6, '0'), 'Customer '||(g % 9000), (array['paid','shipped','delivered','cancelled','refunded'])[1 + g % 5], 10 + g % 90,
           now() - (g || ' minutes')::interval, case when g % 50 = 0 then now() end from generate_series(1,$N) g;
  insert into expenses (category, amount, expense_date, vendor, deleted_at)
    select 'packaging', 1 + g % 100, current_date - (g % 1500), 'Vendor '||(g % 300), case when g % 40 = 0 then now() end from generate_series(1,$N) g;
  insert into products (id, name, sku) select md5('p'||g)::uuid, 'P'||g, 'SKU-'||g from generate_series(1,2000) g;
  insert into inventory_adjustments (product_id, bucket, change_amount, reason, adjusted_at)
    select md5('p'||(1 + g % 2000))::uuid, 'available', 1, 'synthetic', now() - (g || ' seconds')::interval from generate_series(1,$((N*4))) g;
  insert into tasks (title, priority, status, due_at)
    select 'Task '||g, 'normal', (array['open','in_progress','done','done','done','cancelled'])[1 + g % 6], now() + ((g % 60 - 30) || ' days')::interval from generate_series(1,$((N*2/5))) g;
  insert into approval_requests (action_type, summary, status)
    select 'refund', 'Request '||g, (array['pending','approved','rejected','approved'])[1 + g % 4] from generate_series(1,$((N*2/5))) g;
  analyze;" >/dev/null || { echo "fill failed"; exit 1; }

declare -A Q
Q[orders_newest]="select id, order_number, total from orders where deleted_at is null order by placed_at desc limit 200"
Q[orders_lookup]="select id, order_number from orders where deleted_at is null and (order_number ilike '%01234%' or customer_name ilike '%01234%') order by placed_at desc limit 20"
Q[orders_exact_number]="select id from orders where deleted_at is null and order_number ilike '%HE-012345%' limit 20"
Q[expenses_newest]="select id, amount from expenses where deleted_at is null order by expense_date desc limit 200"
Q[stock_history_product]="select id, change_amount from inventory_adjustments where product_id = md5('p77')::uuid order by adjusted_at desc limit 50"
Q[tasks_open_first]="select id, title from tasks where status not in ('done','cancelled','closed','resolved','rejected') order by due_at asc nulls last limit 200"
Q[approvals_pending]="select id, summary from approval_requests where status = 'pending' order by created_at desc limit 200"
Q[query_f_duplicate_numbers]="select order_number, count(*) from orders where deleted_at is null group by order_number having count(*) > 1"
order=(orders_newest orders_lookup orders_exact_number expenses_newest stock_history_product tasks_open_first approvals_pending query_f_duplicate_numbers)

plan() { # prints "<top scan node> <ms>"
  local j; j=$(P -c "explain (analyze, format json) ${Q[$1]}")
  node -e 'const p=JSON.parse(process.argv[1])[0]; const scans=[]; (function w(n){ if(/Scan/.test(n["Node Type"])) scans.push(n["Node Type"]+(n["Index Name"]?"("+n["Index Name"]+")":"")); (n.Plans||[]).forEach(w); })(p.Plan); console.log(scans.join("+")+" "+p["Execution Time"].toFixed(2)+"ms")' "$j"
}
echo "== baseline (indexes from Query A only), rows: orders/expenses=$N, history=$((N*4)), tasks/approvals=$((N*2/5))"
for k in "${order[@]}"; do echo "$k: $(plan $k)"; done

declare -A C
C[orders_newest]="create index cand_orders_placed on orders (placed_at desc) where deleted_at is null"
C[orders_lookup]="create index cand_orders_trgm on orders using gin (order_number gin_trgm_ops, customer_name gin_trgm_ops)"
C[expenses_newest]="create index cand_expenses_date on expenses (expense_date desc) where deleted_at is null"
C[stock_history_product]="create index cand_adj_product on inventory_adjustments (product_id, adjusted_at desc)"
C[tasks_open_first]="create index cand_tasks_due on tasks (due_at) where status not in ('done','cancelled','closed','resolved','rejected')"
C[approvals_pending]="create index cand_approvals_pending on approval_requests (created_at desc) where status = 'pending'"
TBL=([orders_newest]=orders [orders_lookup]=orders [expenses_newest]=expenses [stock_history_product]=inventory_adjustments [tasks_open_first]=tasks [approvals_pending]=approval_requests)
declare -A INS
INS[orders]="insert into orders (channel, order_number, customer_name, total, placed_at) select 'manual', 'INS-'||g, 'Ins '||g, 1, now() from generate_series(1,5000) g"
INS[expenses]="insert into expenses (category, amount, expense_date) select 'packaging', 1, current_date from generate_series(1,5000) g"
INS[inventory_adjustments]="insert into inventory_adjustments (product_id, bucket, change_amount, reason) select md5('p'||(1 + g % 2000))::uuid, 'available', 1, 'ins' from generate_series(1,5000) g"
INS[tasks]="insert into tasks (title, priority, status, due_at) select 'Ins '||g, 'normal', 'open', now() from generate_series(1,5000) g"
INS[approval_requests]="insert into approval_requests (action_type, summary, status) select 'refund', 'Ins '||g, 'pending' from generate_series(1,5000) g"
ins_ms() { local s=$(date +%s%N); P -c "begin; ${INS[$1]}; rollback;" >/dev/null; echo $(( ($(date +%s%N)-s)/1000000 )); }
echo "== with each candidate index (read plan · index size · 5,000 inserts without → with)"
for k in orders_newest orders_lookup expenses_newest stock_history_product tasks_open_first approvals_pending; do
  t=$(eval echo \${TBL[$k]}); before=$(ins_ms $t)
  P -c "${C[$k]}; analyze $t;" >/dev/null
  after=$(ins_ms $t)
  name=$(echo "${C[$k]}" | awk '{print $3}')
  size=$(P -c "select pg_size_pretty(pg_relation_size('$name'))")
  echo "$k: $(plan $k) · size $size · inserts ${before}ms → ${after}ms"
  P -c "drop index $name" >/dev/null
done
