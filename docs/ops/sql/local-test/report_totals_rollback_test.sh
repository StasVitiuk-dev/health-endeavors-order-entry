#!/usr/bin/env bash
# LOCAL TEST ONLY (EXT14, 2026-10-11). Never point this at Supabase.
# Lifecycle of drafts/13 (report_totals) and its rollback drafts/31 on a fresh
# throwaway copy of the real-shape schema: install → rollback → reinstall →
# rollback twice → rollback before install → a failed install leaves nothing.
# Usage: report_totals_rollback_test.sh <psql connection args>  e.g. -h /var/tmp/hepg -p 5499 -U postgres
CONN="$*"
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../../../.." && pwd)"
DB=he_rt_rollback_$$
SIG="public.report_totals(timestamptz, timestamptz, date, date, text)"
pass=0; failn=0
ok() { echo "  ok   $1"; pass=$((pass+1)); }
bad() { echo "  FAIL $1"; failn=$((failn+1)); }
P() { psql $CONN -d $DB -qtAX -v ON_ERROR_STOP=1 "$@" 2>&1; }
exists() { P -c "select to_regprocedure('$SIG') is not null"; }
cleanup() { dropdb $CONN --if-exists $DB >/dev/null 2>&1; }
trap cleanup EXIT INT TERM
createdb $CONN $DB || { echo "cannot create $DB"; exit 1; }
P -f "$DIR/01_REAL_SHAPE_schema_for_local_tests.sql" >/dev/null || { echo "schema failed"; exit 1; }
cd "$ROOT"

out=$(P -f docs/ops/sql/drafts/31_DRAFT_rollback_report_totals.sql)
[ "$(exists)" = "f" ] && echo "$out" | grep -q "nothing to roll back" && ok "rollback before install changes nothing and says so" || bad "rollback before install ($out)"

P -f docs/ops/sql/drafts/13_DRAFT_report_totals.sql >/dev/null
[ "$(exists)" = "t" ] && ok "install creates the function" || bad "install"
anon=$(P -c "select has_function_privilege('anon', '$SIG', 'execute')")
[ "$anon" = "f" ] && ok "anon cannot run it" || bad "anon can run it ($anon)"

P -f docs/ops/sql/drafts/31_DRAFT_rollback_report_totals.sql >/dev/null
[ "$(exists)" = "f" ] && ok "rollback removes it" || bad "rollback"
P -f docs/ops/sql/drafts/31_DRAFT_rollback_report_totals.sql >/dev/null && [ "$(exists)" = "f" ] && ok "rollback twice is harmless" || bad "rollback twice"

P -f docs/ops/sql/drafts/13_DRAFT_report_totals.sql >/dev/null && P -f docs/ops/sql/drafts/13_DRAFT_report_totals.sql >/dev/null
[ "$(exists)" = "t" ] && ok "reinstall (twice) works" || bad "reinstall"
P -f docs/ops/sql/drafts/31_DRAFT_rollback_report_totals.sql >/dev/null

# A failed install (simulated by a broken copy that errors after the function is
# created, inside the same transaction) must leave nothing behind.
sed 's/^revoke all on function public.report_totals/select 1\/0; revoke all on function public.report_totals/' docs/ops/sql/drafts/13_DRAFT_report_totals.sql > /tmp/he_13_broken_$$.sql
P -f /tmp/he_13_broken_$$.sql >/dev/null; rm -f /tmp/he_13_broken_$$.sql
[ "$(exists)" = "f" ] && ok "a failed install leaves nothing (one transaction)" || bad "partial install left the function"

# Data is untouched by install and rollback.
P -c "insert into orders (channel, order_number, total) values ('manual', 'RT-1', 5)" >/dev/null
P -f docs/ops/sql/drafts/13_DRAFT_report_totals.sql >/dev/null; P -f docs/ops/sql/drafts/31_DRAFT_rollback_report_totals.sql >/dev/null
[ "$(P -c "select count(*) from orders where order_number = 'RT-1'")" = "1" ] && ok "install + rollback leave business data alone" || bad "data changed"

echo "report_totals rollback: $pass passed, $failn failed"
[ $failn -eq 0 ]
