#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-14). Never point this at Supabase.
# Tests Query I (12_READONLY_I_report_day_cutoff.sql) on a throwaway copy:
# no saved reports; a nightly job that counts by the Central day; one that
# counts by the UTC day; a mix; days that cannot tell the cutoffs apart; a
# deleted order; proves it runs inside a READ ONLY transaction; and (Nov 16)
# runs it through an account that can only read, checking nothing changed.
# daily_reports is created here with only the two columns the query reads
# (report_date, orders_count): its real shape is not in the local schema.
# All rows are synthetic. Usage:
#   report_day_cutoff_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_cutoff_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
Q="$DIR/12_READONLY_I_report_day_cutoff.sql"
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
i00() { psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -f "$Q" 2>&1 | awk -F'|' '$1=="I00" {print $5}'; }
day() { psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -f "$Q" 2>&1 | awk -F'|' -v id="I-$1" '$1==id {print $2"/"$3"/"$4" "$5}'; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
echo "Query I report day cutoff (throwaway database $DB)"
q "create table public.daily_reports (report_date date primary key, orders_count integer)" >/dev/null
q "delete from orders" >/dev/null
D3="$(q "select to_char(current_date - 3, 'YYYY-MM-DD')")"; D2="$(q "select to_char(current_date - 2, 'YYYY-MM-DD')")"; D5="$(q "select to_char(current_date - 5, 'YYYY-MM-DD')")"
ord() { q "insert into orders (channel, status, placed_at, customer_name, deleted_at) values ('synthetic', 'paid', $1, 'SYNTHETIC Buyer', $2)" >/dev/null; }

ok "runs inside a READ ONLY transaction" "$( { echo 'begin read only;'; cat "$Q"; echo 'commit;'; } | psql "${CONN[@]}" -d "$DB" -qtAX 2>&1 | grep -c ERROR)" "0"
ok "no saved reports: NO DATA" "$(i00)" "NO DATA"

# Day D3: one order at 15:00 UTC (the same day both ways) and one at 02:00 UTC
# the next morning, which is the evening of D3 in Central time (either season).
ord "(current_date - 3) + interval '15 hours'" null
ord "(current_date - 2) + interval '2 hours'" null
ord "(current_date - 2) + interval '16 hours'" null

q "insert into daily_reports values (current_date - 3, 2), (current_date - 2, 1)" >/dev/null
ok "a job that counts by the Central day: PASS" "$(i00)" "PASS"
ok "  D-3 shows reported 2, Central 2, UTC 1" "$(day "$D3")" "2/2/1 MATCHES CENTRAL"
ok "  D-2 shows reported 1, Central 1, UTC 2" "$(day "$D2")" "1/1/2 MATCHES CENTRAL"

q "update daily_reports set orders_count = 1 where report_date = current_date - 3; update daily_reports set orders_count = 2 where report_date = current_date - 2" >/dev/null
ok "a job that counts by the UTC day: ACTION" "$(i00)" "ACTION"
ok "  D-3 shows MATCHES UTC" "$(day "$D3")" "1/2/1 MATCHES UTC"

q "update daily_reports set orders_count = 2 where report_date = current_date - 3" >/dev/null
ok "one day each way: UNCLEAR" "$(i00)" "UNCLEAR"

q "update daily_reports set orders_count = 7" >/dev/null
ok "reports that agree with neither count: NOT ENOUGH DATA" "$(i00)" "NOT ENOUGH DATA"
ok "  and the day says MATCHES NEITHER" "$(day "$D3")" "7/2/1 MATCHES NEITHER"

# A quiet day (midday order only) cannot tell the cutoffs apart.
ord "(current_date - 5) + interval '18 hours'" null
q "delete from daily_reports; insert into daily_reports values (current_date - 5, 1)" >/dev/null
ok "a midday-only day: SAME EITHER WAY" "$(day "$D5")" "1/1/1 SAME EITHER WAY"
ok "  and the conclusion is NOT ENOUGH DATA" "$(i00)" "NOT ENOUGH DATA"

# A deleted order is not counted.
ord "(current_date - 5) + interval '19 hours'" "now()"
ok "a deleted order is ignored" "$(day "$D5")" "1/1/1 SAME EITHER WAY"

# A report older than the window is left out.
q "delete from daily_reports; insert into daily_reports values (current_date - 60, 3)" >/dev/null
ok "a report outside the 45-day window: NO DATA" "$(i00)" "NO DATA"

ok "six columns, and no customer name anywhere in the output" "$(psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -f "$Q" | awk -F'|' '{print NF}' | sort -u | tr '\n' ' ')$(q "insert into daily_reports values (current_date - 3, 2)" >/dev/null; psql "${CONN[@]}" -d "$DB" -qtAX -f "$Q" | grep -c SYNTHETIC)" "6 0"

# Nov 16 (owner decision 7): run it through an account that can ONLY read.
# he_query_i_reader may select from the two tables the query names and nothing
# else; it cannot insert, update or delete anywhere. The query must give the
# same answer through it, and must leave every row exactly as it was.
echo " through a read-only account"
q "delete from orders; delete from daily_reports" >/dev/null
ord "(current_date - 3) + interval '15 hours'" null
ord "(current_date - 2) + interval '2 hours'" null
ord "(current_date - 2) + interval '16 hours'" null
q "insert into daily_reports values (current_date - 3, 2), (current_date - 2, 1)" >/dev/null
q "drop role if exists he_query_i_reader" >/dev/null
q "create role he_query_i_reader nologin bypassrls; grant usage on schema public to he_query_i_reader; grant select on public.orders, public.daily_reports to he_query_i_reader" >/dev/null
FP="select md5(coalesce((select string_agg(o::text, '|' order by o.id) from orders o), '')) || '/' || md5(coalesce((select string_agg(d::text, '|' order by d.report_date) from daily_reports d), ''))"
fp_before=$(q "$FP")
AS_OWNER=$(psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -f "$Q" 2>&1)
AS_READER=$(psql "${CONN[@]}" -d "$DB" -qtAX -F '|' -c "set role he_query_i_reader" -c "set default_transaction_read_only = on" -f "$Q" 2>&1)
ok "the read-only account gets a result with no error" "$(echo "$AS_READER" | grep -c ERROR)" "0"
ok "  the same result, row for row, as the database owner gets" "$AS_READER" "$AS_OWNER"
ok "  and it has a conclusion row" "$(echo "$AS_READER" | awk -F'|' '$1=="I00" {print $5}')" "PASS"
has() { if echo "$2" | grep -q "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-160)]"; fi; }
has "the read-only account cannot add an order" "$(psql "${CONN[@]}" -d "$DB" -qtAX -c "set role he_query_i_reader" -c "insert into orders (channel, status) values ('synthetic','paid')" 2>&1)" "permission denied"
has "  nor change a saved report" "$(psql "${CONN[@]}" -d "$DB" -qtAX -c "set role he_query_i_reader" -c "update daily_reports set orders_count = 99" 2>&1)" "permission denied"
has "  nor delete one" "$(psql "${CONN[@]}" -d "$DB" -qtAX -c "set role he_query_i_reader" -c "delete from daily_reports" 2>&1)" "permission denied"
has "  nor read a table the query does not name" "$(psql "${CONN[@]}" -d "$DB" -qtAX -c "set role he_query_i_reader" -c "select count(*) from profiles" 2>&1)" "permission denied"
ok "every order and every saved report is exactly as it was before the query ran" "$(q "$FP")" "$fp_before"
ok "the query text holds one statement and no word that could change data" "$(grep -v '^--' "$Q" | sed "s/''//g; s/'[^']*'//g" | tr 'A-Z' 'a-z' | grep -cwE 'insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do')/$(grep -v '^--' "$Q" | sed "s/''//g; s/'[^']*'//g" | grep -o ';' | wc -l | tr -d ' ')" "0/1"
q "drop owned by he_query_i_reader; drop role if exists he_query_i_reader" >/dev/null

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
