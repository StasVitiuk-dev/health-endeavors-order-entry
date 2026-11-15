#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-15). Never point this at Supabase.
# Tests drafts/32 (invoice storage, numbering and the issue / void functions)
# and drafts/33 (rollback) on a throwaway copy, acting as the owner, an
# administrator, an employee, a deactivated account and an anonymous visitor.
# Covers the owner's decisions of Nov 14: a pending tax rate blocks issuing;
# due on receipt / Net 14; HE-YYYY-NNNN assigned at issue, per year, no gaps,
# never reused, safe when two people issue at once; issued invoices cannot be
# edited or deleted; only the owner or an administrator can issue or void.
# All rows are synthetic.
# Usage: invoices_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_invoices_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/32_DRAFT_invoices.sql"; ROLLBACK="$DIR/drafts/33_DRAFT_rollback_invoices.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-200)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
# as <uid|anon> <sql>: run as that person and KEEP the result (committed).
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000000a1; A=00000000-0000-4000-8000-0000000000a2
E=00000000-0000-4000-8000-0000000000a3; I=00000000-0000-4000-8000-0000000000a4
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
echo "Invoices: storage, numbering, issue and void (throwaway database $DB)"
q "delete from profiles where id in ('$O','$A','$E','$I');
   insert into profiles (id, email, role, is_active, account_number) values
   ('$O','owner@example.test','owner',true,'100000001'), ('$A','admin@example.test','administrator',true,'100000002'),
   ('$E','staff@example.test','employee',true,'100000003'), ('$I','gone@example.test','employee',false,'100000004')" >/dev/null
for n in 1 2 3 4 5; do q "insert into orders (id, channel, status, order_number) values ('00000000-0000-4000-8000-00000000c00$n','synthetic','paid','SYN-$n')" >/dev/null; done
ORD() { echo "00000000-0000-4000-8000-00000000c00$1"; }
SNAP="select (select count(*) from orders)||'/'||(select count(*) from tasks)||'/'||(select count(*) from expenses)||'/'||(select count(*) from inventory)"
before=$(q "$SNAP")
Y=$(q "select extract(year from (now() at time zone 'America/Chicago'))::int")
TODAY=$(q "select (now() at time zone 'America/Chicago')::date")
PLUS14=$(q "select (now() at time zone 'America/Chicago')::date + 14")
num() { printf 'HE-%s-%04d' "$Y" "$1"; }

ok "install succeeds" "$(run "$INSTALL")" "0"
ok "  a second install changes nothing and succeeds" "$(run "$INSTALL")" "0"
ok "  no existing table gained or lost a row" "$(q "$SNAP")" "$before"
ok "  both tables are empty" "$(q "select (select count(*) from invoices)||'/'||(select count(*) from invoice_counters)")" "0/0"

echo " who can do what"
has "a visitor cannot read invoices" "$(as anon "select count(*) from invoices")" "permission denied"
has "a visitor cannot run issue_invoice" "$(as anon "select public.issue_invoice('$(ORD 1)')")" "permission denied"
ok  "a deactivated account sees nothing" "$(as $I "select count(*) from invoices")" "0"
has "a deactivated account cannot add a draft" "$(as $I "insert into invoices (order_id) values ('$(ORD 1)')")" "row-level security"
D1=$(as $E "insert into invoices (order_id, lines, subtotal, shipping, tax_rate, tax, total) values ('$(ORD 1)', '[{\"sku\":\"SYN-A\",\"quantity\":6,\"unitPrice\":18.5}]', 111, 9, 0.0625, 7.5, 127.5) returning id")
ok  "staff can prepare a draft" "$(q "select status||'/'||tax_rate_status||'/'||coalesce(invoice_number,'none') from invoices where id = '$D1'")" "draft/PENDING/none"
ok  "staff can edit their draft" "$(as $E "update invoices set shipping = 10, total = 128.5 where id = '$D1' returning total")" "128.50"
has "staff cannot create a row that is already issued" "$(as $E "insert into invoices (order_id, status) values ('$(ORD 2)', 'issued')")" "ERROR"
has "staff cannot issue" "$(as $E "select public.issue_invoice('$D1')")" "Only the owner or an administrator can issue"
has "staff cannot issue by editing the status either" "$(as $E "update invoices set status = 'issued', tax_rate_status = 'CONFIRMED' where id = '$D1'")" "ERROR"
has "staff cannot touch the number counter" "$(as $E "insert into invoice_counters values ($Y, 500)")" "row-level security"
ok  "  the draft is still a draft" "$(q "select status from invoices where id = '$D1'")" "draft"

echo " decision 1: a pending tax rate blocks issuing"
has "the owner cannot issue while the rate is pending" "$(as $O "select public.issue_invoice('$D1')")" "tax rate on this draft is still pending"
ok  "  no number was used" "$(q "select count(*) from invoice_counters")" "0"
as $O "update invoices set tax_rate = 0.09, tax_rate_status = 'CONFIRMED', tax = 10.80, total = 130.80, shipping = 9 where id = '$D1'" >/dev/null

echo " decisions 2, 3, 4: number, day of issue, terms and due date"
R=$(as $O "select public.issue_invoice('$D1')")
has "the owner issues it: first number of the year" "$R" "\"invoice_number\": \"$(num 1)\""
ok  "  stored as issued, dated the Central day, due on receipt" "$(q "select status||'/'||invoice_number||'/'||issue_date||'/'||due_date||'/'||terms||'/'||(issued_by = '$O') from invoices where id = '$D1'")" "issued/$(num 1)/$TODAY/$TODAY/DUE_ON_RECEIPT/true"
R=$(as $O "select public.issue_invoice('$D1')")
has "asking again is safe: same number, marked already issued" "$R" "\"already_issued\": true"
has "  and it is the same number" "$R" "$(num 1)"
ok  "  and the counter did not move" "$(q "select last_seq from invoice_counters where invoice_year = $Y")" "1"
D2=$(as $E "insert into invoices (order_id, tax_rate_status, total) values ('$(ORD 2)', 'CONFIRMED', 50) returning id")
has "Net 14 without a credit approval is refused" "$(as $A "select public.issue_invoice('$D2', 'NET_14')")" "only for an account approved for credit"
has "unknown terms are refused" "$(as $A "select public.issue_invoice('$D2', 'NET_90', true)")" "Unknown payment terms"
R=$(as $A "select public.issue_invoice('$D2', 'NET_14', true)")
has "an administrator issues with Net 14 once credit is confirmed" "$R" "$(num 2)"
ok  "  due 14 days after the day of issue" "$(q "select due_date||'/'||terms from invoices where id = '$D2'")" "$PLUS14/NET_14"

echo " a number cannot be typed, edited, reused or lost"
D3=$(as $O "insert into invoices (order_id, tax_rate_status, total, invoice_number, invoice_year, invoice_seq) values ('$(ORD 3)', 'CONFIRMED', 20, 'HE-1999-0001', 1999, 1) returning id")
ok  "a typed number on a new draft is ignored" "$(q "select coalesce(invoice_number,'none') from invoices where id = '$D3'")" "none"
as $O "update invoices set invoice_number = 'HE-1999-0002' where id = '$D3'" >/dev/null
ok  "a typed number on an edit is ignored" "$(q "select coalesce(invoice_number,'none') from invoices where id = '$D3'")" "none"
as $O "update invoices set status = 'issued', invoice_number = 'HE-1999-0003' where id = '$D3'" >/dev/null
ok  "issuing by a direct edit still gets the real next number" "$(q "select invoice_number from invoices where id = '$D3'")" "$(num 3)"
has "an issued invoice cannot be edited" "$(as $O "update invoices set total = 1 where id = '$D1'")" "An issued invoice cannot be edited"
has "  nor its number" "$(as $O "update invoices set invoice_number = 'HE-2000-0001' where id = '$D1'")" "An issued invoice cannot be edited"
has "an issued invoice cannot be deleted" "$(as $O "delete from invoices where id = '$D1'")" "stays on the record"
has "an issued invoice cannot go back to draft" "$(as $O "update invoices set status = 'draft' where id = '$D1'")" "cannot go from issued to draft"
psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$O'; insert into invoices (order_id, tax_rate_status, total) values ('$(ORD 4)', 'CONFIRMED', 5); select public.issue_invoice((select id from invoices where order_id = '$(ORD 4)')); rollback;" >/dev/null 2>&1
ok  "an attempt that is undone hands its number back (no gap)" "$(q "select last_seq from invoice_counters where invoice_year = $Y")" "3"
q "insert into invoice_counters values (2031, 7)" >/dev/null
D4=$(as $O "insert into invoices (order_id, tax_rate_status, total) values ('$(ORD 4)', 'CONFIRMED', 5) returning id")
has "another year's counter does not affect this year" "$(as $O "select public.issue_invoice('$D4')")" "$(num 4)"

echo " decision 3: voiding keeps the row and the number"
has "voiding needs a written reason" "$(as $O "select public.void_invoice('$D4', ' ok ')")" "written reason is required"
has "staff cannot void" "$(as $E "select public.void_invoice('$D4', 'entered twice')")" "Only the owner or an administrator can void"
has "an administrator voids it" "$(as $A "select public.void_invoice('$D4', 'Entered twice (synthetic)')")" "\"already_void\": false"
ok  "  the row, its number and the reason are kept" "$(q "select status||'/'||invoice_number||'/'||void_reason||'/'||(voided_by = '$A') from invoices where id = '$D4'")" "void/$(num 4)/Entered twice (synthetic)/true"
has "voiding again is safe" "$(as $O "select public.void_invoice('$D4', 'Entered twice (synthetic)')")" "\"already_void\": true"
has "a void invoice cannot be deleted" "$(as $O "delete from invoices where id = '$D4'")" "stays on the record"
has "a draft cannot be voided (it is deleted instead)" "$(as $O "select public.void_invoice((select id from invoices where status = 'draft' limit 1), 'no draft here')" ; as $E "insert into invoices (order_id) values ('$(ORD 5)') returning 'made'" ; as $O "select public.void_invoice((select id from invoices where order_id = '$(ORD 5)'), 'not wanted')")" "A draft is not void-able"
ok  "staff can delete a draft" "$(as $E "delete from invoices where order_id = '$(ORD 5)' returning 'gone'")" "gone"
D5=$(as $O "insert into invoices (order_id, tax_rate_status, total) values ('$(ORD 4)', 'CONFIRMED', 5) returning id")
has "the same order can be invoiced again after a void, and the voided number is not reused" "$(as $O "select public.issue_invoice('$D5')")" "$(num 5)"
has "an order cannot have two live invoices" "$(as $O "insert into invoices (order_id) values ('$(ORD 1)')")" "invoices_one_live_per_order"
as $O "update invoices set status = 'paid' where id = '$D5'" >/dev/null
has "a paid invoice cannot be voided" "$(as $O "select public.void_invoice('$D5', 'changed my mind')")" "A paid invoice cannot be voided"

echo " two people issuing at the same moment"
q "delete from invoices where status = 'draft'" >/dev/null
for n in $(seq 1 20); do
  oid=$(printf '00000000-0000-4000-8000-0000000d%04d' "$n")
  q "insert into orders (id, channel, status) values ('$oid','synthetic','paid')" >/dev/null
  as $E "insert into invoices (order_id, tax_rate_status, total) values ('$oid', 'CONFIRMED', $n)" >/dev/null
done
for id in $(q "select id from invoices where status = 'draft'"); do
  ( as $O "select public.issue_invoice('$id')" >/dev/null ) &
done
wait
ok  "20 invoices issued in parallel: 20 different numbers" "$(q "select count(distinct invoice_number) from invoices where order_id::text like '%0000000d%' and status = 'issued'")" "20"
ok  "  consecutive, with no gap and no repeat" "$(q "select min(invoice_seq)||'-'||max(invoice_seq)||'/'||count(*) from invoices where order_id::text like '%0000000d%'")" "6-25/20"
ok  "  the counter equals the highest number" "$(q "select last_seq from invoice_counters where invoice_year = $Y")" "25"
ok  "  every issued row has a well-formed number" "$(q "select count(*) from invoices where status <> 'draft' and invoice_number !~ '^HE-[0-9]{4}-[0-9]{4,}\$'")" "0"

echo " rollback"
ok  "rollback refuses while issued or void invoices exist" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "issued or void invoice(s) exist"
ok  "  nothing was removed" "$(q "select count(*) from invoices where status <> 'draft'")" "25"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null
q "delete from profiles where id = '$E'; insert into profiles (id, email, role, is_active, account_number) values ('$E','staff@example.test','employee',true,'100000003')" >/dev/null
before=$(q "$SNAP")
ok  "fresh copy: install" "$(run "$INSTALL")" "0"
as $E "insert into invoices default values" >/dev/null
ok  "  rollback with only a draft succeeds" "$(run "$ROLLBACK")" "0"
ok  "  tables and functions are gone" "$(q "select (to_regclass('public.invoices') is null)::text||'/'||(to_regclass('public.invoice_counters') is null)::text||'/'||(to_regprocedure('public.issue_invoice(uuid,text,boolean)') is null)::text||'/'||(to_regprocedure('public.invoices_guard()') is null)::text")" "true/true/true/true"
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  every other table is as it was" "$(q "$SNAP")" "$before"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
