#!/usr/bin/env bash
# Local database suite (EXT14). Runs every LOCAL-TEST script under
# docs/ops/sql/local-test against a throwaway PostgreSQL — never Supabase.
# Builds the working database he_real from scratch first (real-shape schema +
# drafts/10 + drafts/13), so it works on a clean machine and in CI.
#
#   bash tests/tools/run-db-suite.sh -h /var/tmp/hepg -p 5499 -U postgres     (local)
#   bash tests/tools/run-db-suite.sh -h localhost -p 5432 -U postgres          (CI service)
# QUICK=1 skips the long volume/scale scripts. Exit code = number of failed steps.
set -u
C="$*"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LT="$ROOT/docs/ops/sql/local-test"
case "$C" in *supabase.co*|*pooler.supabase*) echo "Refusing: this suite only runs against a local or CI database."; exit 99;; esac
fails=0; out=$(mktemp)
step() { local name="$1"; shift; local s=$(date +%s); if "$@" >"$out" 2>&1; then echo "PASS $name ($(( $(date +%s)-s ))s)"; else echo "FAIL $name ($(( $(date +%s)-s ))s)"; tail -15 "$out" | sed 's/^/     /'; fails=$((fails+1)); annotate "$name" "$out"; fi; }
# On GitHub, a failed step also becomes an annotation (readable on the PR without the raw log).
annotate() { [ "${GITHUB_ACTIONS:-}" = "true" ] || return 0; local msg; msg=$(tail -25 "$2" | sed 's/%/%25/g' | sed ':a;N;$!ba;s/\n/%0A/g' | tr -d '\r'); echo "::error title=DB suite step failed: $1::$msg"; }
build() {
  dropdb $C --if-exists he_real >/dev/null 2>&1
  createdb $C he_real && cd "$ROOT" \
    && psql $C -d he_real -q -v ON_ERROR_STOP=1 -f "$LT/01_REAL_SHAPE_schema_for_local_tests.sql" \
    && psql $C -d he_real -q -v ON_ERROR_STOP=1 -f docs/ops/sql/drafts/10_DRAFT_stock_functions.sql \
    && psql $C -d he_real -q -v ON_ERROR_STOP=1 -f docs/ops/sql/drafts/13_DRAFT_report_totals.sql
}
fingerprint() {
  local fp; fp=$(psql $C -d he_real -Atc "select md5(string_agg(p.proname || ':' || pg_get_function_identity_arguments(p.oid) || ':' || md5(p.prosrc), ',' order by p.proname)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('_he_apply_stock_change','adjust_inventory','receive_purchase_order','quarantine_recall','receive_return','delete_unused_product')")
  echo "fingerprint $fp"; [ "$fp" = "f6d9c2c8be690710eeb721041f6779d9" ]
}
sqlfile() { cd "$ROOT" && psql $C -d he_real -q -v ON_ERROR_STOP=1 -f "$1"; }
t0=$(date +%s)
echo "tools: $(psql --version); $(pg_dump --version); server: $(psql $C -d postgres -qtAX -c 'show server_version' 2>&1)"
# On GitHub only: the throwaway server stops logging the errors these tests cause
# on purpose. GitHub prints the server's whole log at the end of the job, which
# otherwise buries this suite's own PASS/FAIL lines.
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  psql $C -d postgres -qtAX -c "alter system set log_min_messages = 'panic'" -c "alter system set log_min_error_statement = 'panic'" -c "alter system set log_checkpoints = off" -c "select pg_reload_conf()" >/dev/null 2>&1
fi
step "build he_real (schema + drafts 10, 13)" build
step "R1–R5 fingerprint = reviewed version" fingerprint
step "draft tests: R1–R5 real shape" sqlfile "$LT/draft-tests/15_DRAFT_tests_stock_functions_real_shape.sql"
step "draft tests: hardening and failures" sqlfile "$LT/draft-tests/16_DRAFT_tests_hardening_and_failures.sql"
step "draft tests: report totals" sqlfile "$LT/draft-tests/14_DRAFT_tests_report_totals.sql"
step "install package" bash "$LT/install_package_test.sh" $C
step "PO race interleavings" bash "$LT/po_race_interleavings.sh" $C -d he_real
step "PO browser-path races" bash "$LT/po_browser_path_races.sh" $C -d he_real
step "request keys" bash "$LT/request_keys_test.sh" $C -d he_real
step "reconciliation (Query E)" bash "$LT/reconciliation_test.sh" $C -d he_real
step "integrity check (Query F)" bash "$LT/integrity_check_test.sh" $C -d he_real
step "restore drill (local only)" bash "$LT/restore_drill.sh" $C
step "stock switches + R1–R5 rollback guard" bash "$LT/stock_switches_test.sh" $C
step "permissions inventory (Query G)" bash "$LT/permissions_inventory_test.sh" $C
step "views and profile role guard (Query G2)" bash "$LT/views_profile_guard_test.sh" $C
step "timeline view and profile triggers (Query G3)" bash "$LT/timeline_profile_triggers_test.sh" $C
step "drift check for the applied security fixes (query 11): every drift a FAIL, a removed view included" bash "$LT/security_fix_drift_check_test.sh" $C
step "schema drift (Query A + A2 export vs page and local schema)" bash "$LT/schema_drift_test.sh" $C
step "RLS contract + audit immutability (local model, 6 callers)" bash "$LT/rls_contract_test.sh" $C
step "integrity constraints" bash "$LT/integrity_constraints_test.sh" $C
step "integrity schedule" bash "$LT/integrity_schedule_test.sh" $C
step "request-key switch" bash "$LT/request_keys_switch_test.sh" $C
step "nightly check on Home" bash "$LT/integrity_home_test.sh" $C
step "drift check (Query H)" bash "$LT/drift_check_test.sh" $C
step "report totals rollback lifecycle" bash "$LT/report_totals_rollback_test.sh" $C
step "random interleavings (seed 909, 40 rounds)" bash "$LT/random_interleavings.sh" 909 40 current "$C -d he_real"
# Nov 23: the November drafts' own tests (they were run by hand only; ~50 s together on a clean he_real)
step "invoices (drafts/32)" bash "$LT/invoices_test.sh" $C
step "stock-count approval (drafts/34)" bash "$LT/stock_count_adjustments_test.sh" $C
step "stock-count apply once" bash "$LT/stock_count_apply_once_test.sh" $C
step "supplier documents (drafts/36)" bash "$LT/supplier_documents_test.sh" $C
step "supplier document files (drafts/38)" bash "$LT/supplier_document_files_test.sh" $C
step "partial receiving and returns (drafts/40)" bash "$LT/partial_receiving_test.sh" $C
step "managers decide deliveries and returns, option A (drafts/66 on drafts/40)" bash "$LT/managers_approve_stock_test.sh" $C
step "search path of three history functions (drafts/68)" bash "$LT/history_search_path_test.sh" $C
step "backup reports for Home (drafts/70)" bash "$LT/backup_reports_test.sh" $C
step "the active staff check production lacked (drafts/72, then step A on top)" bash "$LT/active_staff_helper_test.sh" $C
step "every waiting draft installs on a copy shaped like production (role as a fixed list, no is_active_staff)" bash "$LT/production_shape_install_test.sh" $C
step "Shopify payouts and money differences (drafts/42)" bash "$LT/shopify_payouts_test.sh" $C
step "staff read purchase orders (drafts/44)" bash "$LT/staff_read_purchase_orders_test.sh" $C
step "confirmed tax rates (drafts/46)" bash "$LT/tax_rates_test.sh" $C
step "parcels and drop-off receipts (drafts/48)" bash "$LT/order_parcels_test.sh" $C
step "settings shared by every device (drafts/50)" bash "$LT/shared_settings_test.sh" $C
step "the id production's history recorder writes: step A2 (drafts/74 on drafts/50)" bash "$LT/shared_settings_audit_id_test.sh" $C
step "the real fee and postage of each order (drafts/52)" bash "$LT/order_costs_test.sh" $C
step "which batch went into which order (drafts/54)" bash "$LT/order_batches_test.sh" $C
step "email sending records: campaigns, outbox, do-not-email list (drafts/56)" bash "$LT/email_sending_test.sh" $C
step "one person's settings on every device (drafts/58)" bash "$LT/my_settings_test.sh" $C
step "reviews the owner typed in (drafts/60)" bash "$LT/customer_reviews_test.sh" $C
step "four levels of account: who may see and change which account (drafts/62, 64)" bash "$LT/people_levels_test.sh" $C
step "the New Employee helper program: create, password, block (drafts/64 + edge draft)" node "$LT/people_accounts_core_test.mjs" $C
step "report day cutoff (Query I)" bash "$LT/report_day_cutoff_test.sh" $C
step "restore with the November drafts" bash "$LT/restore_with_drafts_test.sh" $C
step "stress (5 runs)" bash "$LT/stress_test.sh" 5 $C -d he_real
step "S29 lock cycle, forced order (INT-4; must not deadlock)" bash "$LT/s29_lock_cycle_repro.sh" $C -d he_real
step "inventory property model (30 seeds x 60 operations vs reference model)" node "$ROOT/tests/db/inventory-model.js" $C --seeds 1-30 --ops 60 --quiet
step "inventory model self-test (planted model bug must be found and shrunk)" node "$ROOT/tests/db/inventory-model.js" $C --seeds 1-5 --ops 60 --quiet --selftest
step "extreme stress (10/25/50 client processes; measured peak printed)" env SEED=14 bash "$LT/extreme_stress_test.sh" "$C -d he_real" 10 25 50
# EXT20: truly simultaneous callers (pgbench opens every connection first, then fires).
if command -v pgbench >/dev/null 2>&1 || ls /usr/lib/postgresql/*/bin/pgbench >/dev/null 2>&1; then
  step "true concurrency (25/50/90 simultaneous connections, measured)" bash "$LT/true_concurrency_test.sh" "$C -d he_real" 25 50 90
else
  echo "NOT RUN true concurrency: pgbench is not installed on this machine (it is a PostgreSQL server tool)"
fi
step "SQL mutations" bash "$ROOT/tests/mutation/run-sql-mutations.sh" $C
if [ "${QUICK:-0}" != "1" ]; then
  step "integrity check at volume" bash "$LT/integrity_perf_test.sh" $C
  step "request keys at 10k/100k" bash "$LT/request_key_scale_test.sh" $C 10000 100000
fi
rm -f "$out"
echo "DB SUITE: $fails failed step(s) in $(( $(date +%s)-t0 ))s"
exit $fails
