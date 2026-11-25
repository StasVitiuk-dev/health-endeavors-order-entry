#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-23). Never point this at Supabase.
# Tests drafts/46 (confirmed sales tax rates: the owner and administrators, never deleted or
# edited, no overlaps, a new rate ends the old one, re-check, audit) and
# drafts/47 (rollback) on a throwaway copy, as the owner, an administrator,
# active staff, a deactivated account and a visitor. All rows are made up.
# Usage: tax_rates_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_tax_rates_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/46_DRAFT_tax_rates.sql"; ROLLBACK="$DIR/drafts/47_DRAFT_rollback_tax_rates.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000007a1; A=00000000-0000-4000-8000-0000000007a2; E=00000000-0000-4000-8000-0000000007a3; X=00000000-0000-4000-8000-0000000007a4
PL="Ships from: SYNTHETIC place"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$A','$E','$X');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'700000001'),
     ('$A','admin@example.test','administrator',true,'700000002'), ('$E','staff@example.test','employee',true,'700000003'), ('$X','gone@example.test','employee',false,'700000004');" >/dev/null
echo "Tax rates (throwaway database $DB)"

echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  the table is empty and audited" "$(q "select count(*) from tax_rates")/$(q "select count(*) from pg_trigger where tgname = 'tax_rates_audit'")" "0/1"

echo " 2. the owner and administrators confirm a rate (owner decision of Nov 24); nobody else"
ok  "the owner confirms 8.75% from 2026-07-01" "$(as $O "select (set_tax_rate('$PL', 0.0875, '2026-07-01', 'IDOR Tax Rate Finder'))->>'ok'")" "true"
ok  "  stored with who and when" "$(q "select rate||'|'||effective_from||'|'||coalesce(effective_until::text,'-')||'|'||(confirmed_by = '$O')||'|'||(confirmed_at > now() - interval '1 minute') from tax_rates")" "0.08750|2026-07-01|-|true|true"
ok  "  the same confirmation again is one row" "$(as $O "select (set_tax_rate('$PL', 0.0875, '2026-07-01', 'IDOR Tax Rate Finder'))->>'duplicate'")|$(q "select count(*) from tax_rates")" "true|1"
ok  "an administrator confirms too (the same confirmation: still one row)" "$(as $A "select (set_tax_rate('$PL', 0.0875, '2026-07-01', 'IDOR Tax Rate Finder'))->>'duplicate'")|$(q "select count(*) from tax_rates")" "true|1"
has "staff cannot" "$(as $E "select set_tax_rate('$PL', 0.09, '2027-01-01', 'IDOR Tax Rate Finder')")" "Only the owner or an administrator"
has "a switched-off account cannot" "$(as $X "select set_tax_rate('$PL', 0.09, '2027-01-01', 'IDOR Tax Rate Finder')")" "Only the owner or an administrator"
has "staff cannot insert directly either" "$(as $E "insert into tax_rates (place, rate, effective_from, source) values ('x place', 0.01, '2027-01-01', 'abc')")" "Only the owner\|row-level security"
has "a visitor cannot run it" "$(as anon "select set_tax_rate('$PL', 0.09, '2027-01-01', 'abc')")" "permission denied"
ok  "  (still one rate)" "$(q "select count(*) from tax_rates")" "1"

echo " 3. who can read"
ok  "the owner, an administrator and staff read it" "$(as $O "select count(*) from tax_rates")/$(as $A "select count(*) from tax_rates")/$(as $E "select count(*) from tax_rates")" "1/1/1"
ok  "a deactivated account reads nothing" "$(as $X "select count(*) from tax_rates")" "0"
has "a visitor reads nothing" "$(as anon "select count(*) from tax_rates")" "permission denied"

echo " 4. what is refused"
has "a rate above 25%" "$(as $O "select set_tax_rate('$PL', 0.30, '2027-01-01', 'IDOR Tax Rate Finder')")" "check constraint"
has "a negative rate" "$(as $O "select set_tax_rate('Other SYN place', -0.01, '2027-01-01', 'IDOR Tax Rate Finder')")" "check constraint"
has "no start day" "$(as $O "select set_tax_rate('$PL', 0.09, null, 'IDOR Tax Rate Finder')")" "from which day"
has "no source" "$(as $O "select set_tax_rate('Other SYN place', 0.09, '2027-01-01', '  ')")" "check constraint"
has "a one-letter place" "$(as $O "select set_tax_rate('x', 0.09, '2027-01-01', 'IDOR Tax Rate Finder')")" "check constraint"
has "a place longer than 80 characters (an address does not fit the idea)" "$(as $O "select set_tax_rate(repeat('a', 81), 0.09, '2027-01-01', 'IDOR Tax Rate Finder')")" "check constraint"
has "a new rate that starts before the one in force" "$(as $O "select set_tax_rate('$PL', 0.09, '2026-06-01', 'IDOR Tax Rate Finder')")" "must start after"
has "a direct insert that overlaps" "$(as $O "insert into tax_rates (place, rate, effective_from, source) values ('$PL', 0.09, '2026-08-01', 'IDOR Tax Rate Finder')")" "already in force"
has "editing the rate" "$(as $O "update tax_rates set rate = 0.01")" "cannot be edited"
has "editing the start day" "$(as $O "update tax_rates set effective_from = '2026-01-01'")" "cannot be edited"
has "deleting it (the owner included): no delete permission at all" "$(as $O "delete from tax_rates")" "permission denied"
has "  and the guard refuses it even for the table owner" "$(q "delete from tax_rates")" "stays on the record"
has "staff cannot end it" "$(as $E "update tax_rates set effective_until = '2026-12-31' returning id")" "^$\|Only the owner\|row-level security"
ok  "  (unchanged)" "$(q "select rate||'|'||effective_from||'|'||coalesce(effective_until::text,'-') from tax_rates")" "0.08750|2026-07-01|-"

echo " 5. the rate changes on January 1"
ok  "the owner confirms 9.00% from 2027-01-01" "$(as $O "select (set_tax_rate('$PL', 0.09, '2027-01-01', 'IDOR Tax Rate Finder', 'January change'))->>'ok'")" "true"
ok  "  the old rate ends the day before; the new one is in force" "$(q "select string_agg(rate||':'||effective_from||'..'||coalesce(effective_until::text,'-'), ' ' order by effective_from) from tax_rates")" "0.08750:2026-07-01..2026-12-31 0.09000:2027-01-01..-"
has "  an ended rate cannot end again" "$(as $O "update tax_rates set effective_until = '2026-12-30' where rate = 0.0875")" "already ended"
ok  "a second place has its own rate" "$(as $O "select (set_tax_rate('Ships from: SYNTHETIC second place', 0.1025, '2026-07-01', 'IDOR Tax Rate Finder'))->>'ok'")|$(q "select count(*) from tax_rates")" "true|3"

echo " 6. re-checked, still correct"
ID=$(q "select id from tax_rates where effective_until is null and rate = 0.09")
ok  "the owner re-checks the rate in force" "$(as $O "select (recheck_tax_rate('$ID'))->>'ok'")" "true"
ok  "  today's date (Central) and who" "$(q "select (rechecked_at = (now() at time zone 'America/Chicago')::date)||'|'||(rechecked_by = '$O') from tax_rates where id = '$ID'")" "true|true"
has "  a typed date is replaced by today" "$(as $O "update tax_rates set rechecked_at = '2030-01-01' where id = '$ID' returning rechecked_at = (now() at time zone 'America/Chicago')::date")" "t"
has "staff cannot re-check" "$(as $E "select recheck_tax_rate('$ID')")" "Only the owner or an administrator"
ok  "an administrator re-checks, recorded under the administrator" "$(as $A "select (recheck_tax_rate('$ID'))->>'ok'")|$(q "select rechecked_by = '$A' from tax_rates where id = '$ID'")" "true|t"
ok  "a rate still in force until Dec 31 can be re-checked today" "$(as $O "select (recheck_tax_rate('$(q "select id from tax_rates where rate = 0.0875")'))->>'ok'")" "true"
as $O "select set_tax_rate('Ships from: SYNTHETIC third place', 0.07, '2026-01-01', 'IDOR Tax Rate Finder')" >/dev/null
as $O "select set_tax_rate('Ships from: SYNTHETIC third place', 0.075, '2026-07-01', 'IDOR Tax Rate Finder')" >/dev/null
OLD=$(q "select id from tax_rates where rate = 0.07")
ok  "  (that one ended on 2026-06-30)" "$(q "select effective_until from tax_rates where id = '$OLD'")" "2026-06-30"
has "a rate that ended in the past cannot be re-checked" "$(as $O "select recheck_tax_rate('$OLD')")" "already ended"

echo " 7. audit"
ok  "every change is in audit_log" "$(q "select count(*) > 0 from audit_log where table_name = 'tax_rates'")" "t"

echo " 8. rollback"
ok  "the rollback stops while rates are recorded" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "tax rate(s) are recorded"
ok  "  (the table is still there)" "$(q "select count(*) from tax_rates")" "5"
ok  "with written authorization in the session it removes everything" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_tax_rates = 'yes, delete the tax rates';" -f "$ROLLBACK" >"$OUTF" 2>&1; echo $?)" "0"
ok  "  gone" "$(q "select to_regclass('public.tax_rates') is null and to_regprocedure('public.set_tax_rate(text,numeric,date,text,text)') is null")" "t"
ok  "  running it again is harmless" "$(run "$ROLLBACK")" "0"
ok  "  and the install works again afterwards" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "tax rates: $pass passed, $fail failed"
[ "$fail" = 0 ]
