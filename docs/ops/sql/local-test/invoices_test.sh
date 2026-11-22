#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-15, rewritten 2026-11-22). Never point this at Supabase.
# Tests drafts/32 (invoice storage) and drafts/33 (rollback) on a throwaway copy,
# acting as the owner, an administrator, two employees, a deactivated account and
# an anonymous visitor. All rows are synthetic.
#
# Covers the owner's decisions of Nov 14 and 16, and the owner's review of Nov 22:
#   install     installs twice; stops, changing nothing, on an incompatible existing
#               table (a different column, a missing constraint)
#   audit       production's audit trigger attached; a readable history of
#               creation, changes, issue, void, payments; creator and creation
#               time cannot be changed; the history cannot be written or changed by hand
#   contents    lines in the supported format; quantities, prices, discounts;
#               lines add up to the subtotal; order discount within the subtotal;
#               confirmed tax = rate x taxable amount; lines and billing details
#               needed before issue
#   Net 14      on every write path, with the approver recorded
#   numbers     HE-YYYY-NNNN, 9999 -> 10000 keeps every digit, each year from 0001,
#               never typed, reused or lost, safe when issued at the same moment
#   people      staff see invoices they created or whose order they can see
#   payments    recorded with amount, date, method and reference; status follows
#               them; overpayment refused; retries and simultaneous payments
#               counted once; corrections are linked reversals
#   rollback    refuses with issued invoices; refuses with drafts unless their
#               deletion is authorized; safe against an issue happening meanwhile
# Usage: invoices_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_invoices_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/32_DRAFT_invoices.sql"; ROLLBACK="$DIR/drafts/33_DRAFT_rollback_invoices.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
# as <uid|anon> <sql>: run as that person and KEEP the result (committed).
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
fresh() { psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
          psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
          q "delete from profiles where id in ('$O','$A','$E','$E2','$I');
             insert into profiles (id, email, role, is_active, account_number) values
             ('$O','owner@example.test','owner',true,'100000001'), ('$A','admin@example.test','administrator',true,'100000002'),
             ('$E','staff@example.test','employee',true,'100000003'), ('$E2','staff2@example.test','employee',true,'100000005'),
             ('$I','gone@example.test','employee',false,'100000004')" >/dev/null
          for n in 1 2 3 4 5 6 7 8 9; do q "insert into orders (id, channel, status, order_number) values ('$(ORD $n)','synthetic','paid','SYN-$n')" >/dev/null; done; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000000a1; A=00000000-0000-4000-8000-0000000000a2
E=00000000-0000-4000-8000-0000000000a3; I=00000000-0000-4000-8000-0000000000a4; E2=00000000-0000-4000-8000-0000000000a5
ORD() { echo "00000000-0000-4000-8000-00000000c00$1"; }
# valid contents: 6 x 18.50 = 111.00 (one line) and a complete billing address
LINES='[{"sku":"SYN-A","description":"Synthetic lotion","quantity":6,"unitPrice":18.5,"discount":0,"lineTotal":111}]'
BILL='{"name":"SYN Cedar Spa","lines":["100 Example Street","Example City, IL 60000"]}'
CONF="tax_rate = 0.09, tax_rate_status = 'CONFIRMED', tax_place = 'Example City, IL'"
# a complete, confirmed draft for an order: 111 + 9 shipping (not taxed) + 9.99 tax (9% of 111) = 129.99
draft() { as "$1" "insert into invoices (order_id, lines, subtotal, shipping, bill_to, tax_rate, tax_rate_status, tax_place, tax, total) values ($2, '$LINES', 111, 9, '$BILL', 0.09, 'CONFIRMED', 'Example City, IL', 9.99, 129.99) returning id"; }

fresh
Y=$(q "select extract(year from (now() at time zone 'America/Chicago'))::int")
TODAY=$(q "select (now() at time zone 'America/Chicago')::date")
PLUS14=$(q "select (now() at time zone 'America/Chicago')::date + 14")
num() { if [ "$1" -lt 10000 ]; then printf 'HE-%s-%04d' "$Y" "$1"; else printf 'HE-%s-%d' "$Y" "$1"; fi; }
SNAP="select (select count(*) from orders)||'/'||(select count(*) from tasks)||'/'||(select count(*) from expenses)||'/'||(select count(*) from inventory)"
before=$(q "$SNAP")
echo "Invoices (throwaway database $DB)"

echo " install"
ok  "install succeeds" "$(run "$INSTALL")" "0"
ok  "  a second install changes nothing and succeeds (the existing tables match the expected shape)" "$(run "$INSTALL")" "0"
ok  "  no existing table gained or lost a row" "$(q "$SNAP")" "$before"
ok  "  the four tables are empty" "$(q "select (select count(*) from invoices)||'/'||(select count(*) from invoice_counters)||'/'||(select count(*) from invoice_payments)||'/'||(select count(*) from invoice_events)")" "0/0/0/0"
ok  "  production's audit trigger (the one on tasks) is attached to invoices, payments and counters" "$(q "select string_agg(tgrelid::regclass::text||'>'||tgfoid::regproc::text, ',' order by tgrelid::regclass::text) from pg_trigger where tgname like '%\_audit' and tgrelid::regclass::text like 'invoice%'")" "invoice_counters>local_audit,invoice_payments>local_audit,invoices>local_audit"
ok  "  the pinned shape list equals a fresh install exactly" "$(q "select count(*) from pg_attribute a where a.attrelid in ('public.invoices'::regclass,'public.invoice_counters'::regclass,'public.invoice_payments'::regclass,'public.invoice_events'::regclass) and a.attnum > 0 and not a.attisdropped")" "$(grep -o "('[a-z_]*','[a-z_]*','" "$INSTALL" | wc -l | tr -d ' ')"

echo " who can do what"
has "a visitor cannot read invoices" "$(as anon "select count(*) from invoices")" "permission denied"
has "a visitor cannot run issue_invoice" "$(as anon "select public.issue_invoice('$(ORD 1)')")" "permission denied"
ok  "a deactivated account sees nothing" "$(as $I "select count(*) from invoices")" "0"
has "a deactivated account cannot add a draft" "$(as $I "insert into invoices (order_id) values ('$(ORD 1)')")" "row-level security"
D1=$(as $E "insert into invoices (order_id, lines, subtotal, shipping, bill_to) values ('$(ORD 1)', '$LINES', 111, 10, '$BILL') returning id")
ok  "staff can prepare a draft" "$(q "select status||'/'||tax_rate_status||'/'||coalesce(invoice_number,'none') from invoices where id = '$D1'")" "draft/PENDING/none"
ok  "  a new draft has no tax rate, no tax and no total (not 0)" "$(q "select (tax_rate is null)::text||'/'||(tax is null)::text||'/'||(total is null)::text from invoices where id = '$D1'")" "true/true/true"
ok  "staff can edit their draft" "$(as $E "update invoices set shipping = 9 where id = '$D1' returning shipping")" "9.00"
has "staff cannot create a row that is already issued" "$(as $E "insert into invoices (order_id, status) values ('$(ORD 2)', 'issued')")" "ERROR"
has "staff cannot issue" "$(as $E "select public.issue_invoice('$D1')")" "Only the owner or an administrator can issue"
has "staff cannot issue by changing the status directly" "$(as $E "update invoices set status = 'issued' where id = '$D1'")" "row-level security\|Only the owner"
has "staff cannot touch the number counter" "$(as $E "insert into invoice_counters values ($Y, 41)")" "row-level security"

echo " staff see what they created, or invoices for orders they can see (Nov 22)"
DU=$(as $E2 "insert into invoices (lines, subtotal, bill_to) values ('$LINES', 111, '$BILL') returning id")
ok  "a draft not linked to an order is seen by the staff member who made it" "$(as $E2 "select count(*) from invoices where id = '$DU'")" "1"
ok  "  not by another staff member" "$(as $E "select count(*) from invoices where id = '$DU'")" "0"
ok  "  the owner and an administrator see it" "$(as $O "select count(*) from invoices where id = '$DU'")/$(as $A "select count(*) from invoices where id = '$DU'")" "1/1"
ok  "  another staff member cannot change or delete it" "$(as $E "update invoices set shipping = 1 where id = '$DU' returning 'x'")$(as $E "delete from invoices where id = '$DU' returning 'x'")" ""
# test-only: narrow which orders staff can see, to show invoices follow the orders' own rules
q "alter policy local_staff on orders using (public.is_owner_or_admin() or (public.is_active_staff() and order_number in ('SYN-1','SYN-3')))" >/dev/null
ok  "with staff limited to orders SYN-1 and SYN-3: staff E sees the invoice for SYN-1 (their own) but not E2's unlinked one" "$(as $E "select count(*) from invoices")" "1"
DO=$(as $O "insert into invoices (order_id, lines, subtotal, bill_to) values ('$(ORD 2)', '$LINES', 111, '$BILL') returning id")
ok  "  an invoice the owner made for order SYN-2 is not visible to staff" "$(as $E "select count(*) from invoices where id = '$DO'")" "0"
has "  staff cannot start an invoice for an order they cannot see" "$(as $E "insert into invoices (order_id, lines, subtotal) values ('$(ORD 2)', '$LINES', 111)")" "row-level security"
q "alter policy local_staff on orders using (public.is_active_staff())" >/dev/null
ok  "  with the orders rule back as it was, staff see the SYN-2 invoice again" "$(as $E "select count(*) from invoices where id = '$DO'")" "1"
q "delete from invoices where id in ('$DU','$DO')" >/dev/null

echo " invoice contents (Nov 22)"
bad() { as $E "update invoices set lines = '$1', subtotal = $2 where id = '$D1'"; }
has "lines that are not a list are refused" "$(as $E "update invoices set lines = '{\"sku\":\"x\"}' where id = '$D1'")" "invoices_lines_check\|not a list"
has "a line that is not an object is refused" "$(bad '[3]' 0)" "line 1 is not a line"
has "an unknown field is refused" "$(bad '[{"sku":"A","quantity":1,"unitPrice":1,"lineTotal":1,"colour":"red"}]' 1)" "unknown field"
has "a line with neither SKU nor description is refused" "$(bad '[{"quantity":1,"unitPrice":1,"lineTotal":1}]' 1)" "neither a SKU nor a description"
has "quantity 0 is refused" "$(bad '[{"sku":"A","quantity":0,"unitPrice":1,"lineTotal":0}]' 0)" "whole number from 1"
has "a fractional quantity is refused" "$(bad '[{"sku":"A","quantity":1.5,"unitPrice":2,"lineTotal":3}]' 3)" "whole number from 1"
has "a quantity given as text is refused" "$(bad '[{"sku":"A","quantity":"3","unitPrice":1,"lineTotal":3}]' 3)" "must be numbers"
has "a negative price is refused" "$(bad '[{"sku":"A","quantity":1,"unitPrice":-1,"lineTotal":-1}]' 0)" "unit price must be"
has "a price in fractions of a cent is refused" "$(bad '[{"sku":"A","quantity":1,"unitPrice":1.005,"lineTotal":1.005}]' 1)" "unit price must be"
has "a line discount above what the line is worth is refused" "$(bad '[{"sku":"A","quantity":2,"unitPrice":5,"discount":11,"lineTotal":0}]' 0)" "more than the line is worth"
has "a line total that is not quantity x price - discount is refused" "$(bad '[{"sku":"A","quantity":2,"unitPrice":5,"discount":1,"lineTotal":10}]' 10)" "line total is not"
has "a subtotal that is not the sum of the lines is refused" "$(bad "$LINES" 110)" "lines add up to 111"
has "more than 200 lines are refused" "$(as $E "update invoices set lines = (select jsonb_agg(jsonb_build_object('sku','A','quantity',1,'unitPrice',1,'lineTotal',1)) from generate_series(1,201)), subtotal = 201 where id = '$D1'")" "more than 200 lines"
has "an order discount above the goods is refused" "$(as $E "update invoices set order_discount = 112 where id = '$D1'")" "more than the goods it discounts"
has "a confirmed tax that is not rate x taxable amount is refused" "$(as $O "update invoices set $CONF, tax = 10.00, total = 130.00 where id = '$D1'")" "should be 9.99"
has "  shipping counts in the taxable amount only when it is taxed" "$(as $O "update invoices set $CONF, tax_shipping = true, tax = 9.99, total = 129.99 where id = '$D1'")" "should be 10.80"
has "a half-cent tax rounds up exactly as the dashboard does: \$13,625.00 x 13.62% = 1,855.725 -> 1,855.73 (1,855.72 refused)" "$(as $O "update invoices set lines = '[{\"sku\":\"A\",\"quantity\":1,\"unitPrice\":13625,\"lineTotal\":13625}]', subtotal = 13625, shipping = 0, tax_rate = 0.1362, tax_rate_status = 'CONFIRMED', tax_place = 'Example City, IL', tax = 1855.72, total = 15480.72 where id = '$D1'")" "should be 1855.73"
ok  "  and 1,855.73 is accepted" "$(as $O "update invoices set lines = '[{\"sku\":\"A\",\"quantity\":1,\"unitPrice\":13625,\"lineTotal\":13625}]', subtotal = 13625, shipping = 0, tax_rate = 0.1362, tax_rate_status = 'CONFIRMED', tax_place = 'Example City, IL', tax = 1855.73, total = 15480.73 where id = '$D1' returning tax")" "1855.73"
as $O "update invoices set lines = '$LINES', subtotal = 111, shipping = 9, tax_rate = null, tax_rate_status = 'PENDING', tax_place = null, tax = null, total = null where id = '$D1'" >/dev/null
ok  "a draft with valid lines, a line discount and an order discount saves" "$(as $E "update invoices set lines = '[{\"sku\":\"A\",\"quantity\":2,\"unitPrice\":5,\"discount\":1.5,\"lineTotal\":8.5},{\"description\":\"Freight insurance\",\"quantity\":1,\"unitPrice\":2,\"lineTotal\":2}]', subtotal = 10.5, order_discount = 0.5 where id = '$D1' returning subtotal")" "10.50"
ok  "  the draft is unchanged by all the refused attempts above" "$(q "select tax_rate_status||'/'||(tax is null)::text from invoices where id = '$D1'")" "PENDING/true"
as $E "update invoices set lines = '$LINES', subtotal = 111, order_discount = 0 where id = '$D1'" >/dev/null

echo " decision 1: tax"
has "the owner cannot issue while the tax is pending" "$(as $O "select public.issue_invoice('$D1')")" "tax on this draft is still pending"
has "  nor by editing the status directly" "$(as $O "update invoices set status = 'issued' where id = '$D1'")" "tax on this draft is still pending"
ok  "  no number was used" "$(q "select count(*) from invoice_counters")" "0"
has "a confirmed rate must say which place it is for" "$(as $O "update invoices set tax_rate = 0.09, tax_rate_status = 'CONFIRMED', tax = 9.99, total = 129.99 where id = '$D1'")" "invoices_confirmed_names_place"
has "a confirmed draft must carry all its figures" "$(as $O "update invoices set $CONF where id = '$D1'")" "invoices_pending_has_no_figures"
has "the total must be what the parts add up to" "$(as $O "update invoices set $CONF, tax = 9.99, total = 130.00 where id = '$D1'")" "invoices_total_adds_up"
has "an exempt draft must record the verified document" "$(as $O "update invoices set tax_rate_status = 'EXEMPT', tax_exempt = true, tax_rate = 0, tax = 0, total = 120 where id = '$D1'")" "invoices_exempt_is_documented"
ok  "confirming the rate for a named place gives the draft its figures" "$(as $O "update invoices set $CONF, tax = 9.99, total = 129.99 where id = '$D1' returning total")" "129.99"

echo " before issue: lines and billing details (Nov 22)"
DE=$(as $E "insert into invoices (order_id, bill_to, tax_rate, tax_rate_status, tax_place, tax, total) values ('$(ORD 3)', '$BILL', 0.09, 'CONFIRMED', 'Example City, IL', 0, 0) returning id")
has "an invoice with no lines cannot be issued" "$(as $O "select public.issue_invoice('$DE')")" "no lines cannot be issued"
as $O "delete from invoices where id = '$DE'" >/dev/null
DB1=$(as $E "insert into invoices (order_id, lines, subtotal, shipping, tax_rate, tax_rate_status, tax_place, tax, total) values ('$(ORD 3)', '$LINES', 111, 9, 0.09, 'CONFIRMED', 'Example City, IL', 9.99, 129.99) returning id")
has "an invoice with no billing details cannot be issued" "$(as $O "select public.issue_invoice('$DB1')")" "billing details are not complete"
as $E "update invoices set bill_to = '{\"name\":\"SYN Cedar Spa\"}' where id = '$DB1'" >/dev/null
has "  a name without an address is not enough" "$(as $O "select public.issue_invoice('$DB1')")" "billing details are not complete"
as $E "update invoices set bill_to = '{\"name\":\"SYN Cedar Spa\",\"city\":\"Chicago\",\"state\":\"IL\"}' where id = '$DB1'" >/dev/null
has "  a name with a city and state is enough" "$(as $O "select public.issue_invoice('$DB1')")" "\"invoice_number\": \"$(num 1)\""

echo " decisions 2, 3, 4: number, day of issue, terms and due date"
R=$(as $O "select public.issue_invoice('$D1')")
has "the owner issues: the next number of the year" "$R" "\"invoice_number\": \"$(num 2)\""
ok  "  stored as issued, dated the Central day, due on receipt, by the owner" "$(q "select status||'/'||invoice_number||'/'||issue_date||'/'||due_date||'/'||terms||'/'||(issued_by = '$O') from invoices where id = '$D1'")" "issued/$(num 2)/$TODAY/$TODAY/DUE_ON_RECEIPT/true"
has "asking again is safe: same number, marked already issued" "$(as $O "select public.issue_invoice('$D1')")" "\"already_issued\": true"
ok  "  and the counter did not move" "$(q "select last_seq from invoice_counters where invoice_year = $Y")" "2"

echo " Net 14 on every path, with the approver recorded (Nov 22)"
D2=$(draft $E "'$(ORD 2)'")
has "Net 14 through issue_invoice without a credit approval is refused" "$(as $A "select public.issue_invoice('$D2', 'NET_14')")" "only for an account approved for credit"
has "Net 14 by a direct change of the row, without a credit approval, is refused too" "$(as $A "update invoices set status = 'issued', terms = 'NET_14' where id = '$D2'")" "only for an account approved for credit"
as $E "update invoices set credit_approved = true, credit_approved_by = '$E' where id = '$D2'" >/dev/null
ok  "  a credit approval cannot be typed into a draft (staff tried): it is cleared" "$(q "select credit_approved::text||'/'||coalesce(credit_approved_by::text,'none') from invoices where id = '$D2'")" "false/none"
has "unknown terms are refused" "$(as $A "select public.issue_invoice('$D2', 'NET_90', true)")" "Unknown payment terms"
has "an administrator issues with Net 14 once credit is confirmed" "$(as $A "select public.issue_invoice('$D2', 'NET_14', true)")" "$(num 3)"
ok  "  due 14 days later; the approval is recorded with who and when" "$(q "select due_date||'/'||terms||'/'||credit_approved::text||'/'||(credit_approved_by = '$A')::text||'/'||(credit_approved_at is not null)::text from invoices where id = '$D2'")" "$PLUS14/NET_14/true/true/true"
D3=$(draft $E "'$(ORD 4)'")
as $O "update invoices set status = 'issued', terms = 'NET_14', credit_approved = true, credit_approved_by = '$E' where id = '$D3'" >/dev/null
ok  "a direct change with an explicit credit approval works, and records the real approver (the owner), not a typed one" "$(q "select status||'/'||terms||'/'||(credit_approved_by = '$O')::text from invoices where id = '$D3'")" "issued/NET_14/true"
has "  the approval cannot be changed afterwards" "$(as $O "update invoices set credit_approved_by = '$A' where id = '$D3'")" "An issued invoice cannot be edited"
has "  nor the terms" "$(as $O "update invoices set terms = 'DUE_ON_RECEIPT' where id = '$D3'")" "An issued invoice cannot be edited"

echo " a number cannot be typed, edited, reused or lost"
D5=$(draft $O "'$(ORD 5)'")
as $O "update invoices set invoice_number = 'HE-1999-0002' where id = '$D5'" >/dev/null
ok  "a typed number on a draft is ignored" "$(q "select coalesce(invoice_number,'none') from invoices where id = '$D5'")" "none"
as $O "update invoices set status = 'issued', invoice_number = 'HE-1999-0003' where id = '$D5'" >/dev/null
ok  "issuing by a direct change still gets the real next number" "$(q "select invoice_number from invoices where id = '$D5'")" "$(num 5)"
has "an issued invoice cannot be edited" "$(as $O "update invoices set total = 1 where id = '$D1'")" "An issued invoice cannot be edited"
has "  nor who it bills" "$(as $O "update invoices set bill_to = '{\"name\":\"Someone else\"}' where id = '$D1'")" "An issued invoice cannot be edited"
has "  nor its lines" "$(as $O "update invoices set lines = '[]', subtotal = 0 where id = '$D1'")" "An issued invoice cannot be edited"
has "an issued invoice cannot be deleted" "$(as $O "delete from invoices where id = '$D1'")" "stays on the record"
has "an issued invoice cannot go back to draft" "$(as $O "update invoices set status = 'draft' where id = '$D1'")" "can only be edited\|cannot be edited\|follows the payments"
psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$O'; insert into invoices (order_id, lines, subtotal, bill_to, tax_rate, tax_rate_status, tax_place, tax, total) values ('$(ORD 6)', '$LINES', 111, '$BILL', 0.09, 'CONFIRMED', 'Example City, IL', 9.99, 120.99); select public.issue_invoice((select id from invoices where order_id = '$(ORD 6)')); rollback;" >/dev/null 2>&1
ok  "an attempt that is undone hands its number back (no gap)" "$(q "select last_seq from invoice_counters where invoice_year = $Y")" "5"

echo " numbers past 9,999, and a new year (Nov 22)"
q "update invoice_counters set last_seq = 9998 where invoice_year = $Y" >/dev/null
D6=$(draft $O "'$(ORD 6)'"); D7=$(draft $O "'$(ORD 7)'")
has "invoice 9,999" "$(as $O "select public.issue_invoice('$D6')")" "\"invoice_number\": \"HE-$Y-9999\""
has "invoice 10,000 keeps all five digits" "$(as $O "select public.issue_invoice('$D7')")" "\"invoice_number\": \"HE-$Y-10000\""
ok  "  9,999 and 10,000 are different numbers, in order" "$(q "select string_agg(invoice_number, ',' order by invoice_seq) from invoices where invoice_seq >= 9999")" "HE-$Y-9999,HE-$Y-10000"
ok  "  every number is well formed (at least four digits)" "$(q "select count(*) from invoices where status <> 'draft' and invoice_number !~ '^HE-[0-9]{4}-[0-9]{4,}\$'")" "0"
q "insert into invoice_counters values ($((Y - 1)), 9999)" >/dev/null
ok  "last year ending at 9,999 does not affect this year's sequence" "$(q "select last_seq from invoice_counters where invoice_year = $Y")" "10000"
ok  "  a new year starts again at 0001 (the format for the first number of a year)" "$(q "select public.invoice_number_text($((Y + 1)), 1)||' '||public.invoice_number_text($((Y + 1)), 10000)")" "HE-$((Y + 1))-0001 HE-$((Y + 1))-10000"
q "delete from invoice_counters where invoice_year = $((Y - 1)); update invoice_counters set last_seq = 5 where invoice_year = $Y; delete from invoice_events; " >/dev/null 2>&1
q "set session_replication_role = replica; delete from invoices where invoice_seq >= 9999; set session_replication_role = origin;" >/dev/null

echo " who made it and when cannot change (Nov 22)"
DC=$(as $E "insert into invoices (order_id, lines, subtotal, bill_to, created_by, created_at) values ('$(ORD 8)', '$LINES', 111, '$BILL', '$O', '2001-01-01') returning id")
ok  "a typed creator and time on a new draft are replaced by the real ones" "$(q "select (created_by = '$E')::text||'/'||(created_at > now() - interval '1 hour')::text from invoices where id = '$DC'")" "true/true"
has "the creator cannot be changed later, by the owner either" "$(as $O "update invoices set created_by = '$O' where id = '$DC'")" "cannot be changed"
has "  nor the creation time" "$(as $O "update invoices set created_at = now() - interval '1 day' where id = '$DC'")" "cannot be changed"
ok  "the last change records who made it" "$(as $A "update invoices set shipping = 3 where id = '$DC' returning (updated_by = '$A')::text")" "true"

echo " payments (Nov 22): status follows recorded payments"
has "\"paid\" cannot be typed without a payment" "$(as $O "update invoices set status = 'paid' where id = '$D1'")" "Record the payment instead"
has "the amount paid cannot be typed" "$(as $O "update invoices set amount_paid = 129.99 where id = '$D1'")" "never typed"
has "staff cannot record a payment" "$(as $E "select public.record_invoice_payment('00000000-0000-4000-8000-00000000f001', '$D1', 50, current_date, 'check', '1001', null)")" "Only the owner or an administrator can record payments"
ok  "  nor see payments" "$(as $E "select count(*) from invoice_payments")" "0"
has "a payment cannot be recorded on a draft" "$(as $O "select public.record_invoice_payment('00000000-0000-4000-8000-00000000f002', '$DC', 5, current_date, 'cash', null, null)")" "only against an issued invoice"
R=$(as $A "select public.record_invoice_payment('00000000-0000-4000-8000-00000000f003', '$D1', 50, current_date, 'check', 'CHK-1001', 'first part')")
has "a part payment with method and reference: partially paid" "$R" '"status": "partially_paid"'
has "  sending it again (lost reply, double click) records nothing more" "$(as $A "select public.record_invoice_payment('00000000-0000-4000-8000-00000000f003', '$D1', 50, current_date, 'check', 'CHK-1001', 'first part')")" '"duplicate": true'
ok  "  one payment stored, 50.00 paid" "$(q "select count(*)||'/'||(select amount_paid from invoices where id = '$D1') from invoice_payments where invoice_id = '$D1'")" "1/50.00"
has "a payment above what is still owed is refused" "$(as $A "select public.record_invoice_payment('00000000-0000-4000-8000-00000000f004', '$D1', 80, current_date, 'ach', 'ACH-77', null)")" "more than is still owed (79.99)"
has "the rest: paid" "$(as $A "select public.record_invoice_payment('00000000-0000-4000-8000-00000000f005', '$D1', 79.99, current_date, 'ach', 'ACH-77', null)")" '"status": "paid"'
has "a paid invoice cannot be voided" "$(as $O "select public.void_invoice('$D1', 'changed my mind')")" "payments recorded against it cannot be voided"
has "a recorded payment cannot be changed (no permission to change payments at all)" "$(as $O "update invoice_payments set amount = 1 where request_key = '00000000-0000-4000-8000-00000000f003'")" "permission denied\|cannot be changed or deleted"
has "  nor deleted" "$(as $O "delete from invoice_payments where request_key = '00000000-0000-4000-8000-00000000f003'")" "permission denied\|cannot be changed or deleted"
P1=$(q "select id from invoice_payments where request_key = '00000000-0000-4000-8000-00000000f005'")
has "a reversal needs a reason" "$(as $O "select public.reverse_invoice_payment('00000000-0000-4000-8000-00000000f006', '$P1', 'no')")" "written reason is required"
has "a payment entered in error is corrected by a linked reversal: back to partially paid" "$(as $O "select public.reverse_invoice_payment('00000000-0000-4000-8000-00000000f006', '$P1', 'ACH returned by the bank (synthetic)')")" '"status": "partially_paid"'
ok  "  the original payment is still on record, linked to its reversal" "$(q "select count(*) from invoice_payments where id = '$P1'")/$(q "select kind||'/'||amount||'/'||note from invoice_payments where reverses = '$P1'")" "1/reversal/79.99/ACH returned by the bank (synthetic)"
has "  a payment cannot be reversed twice" "$(as $O "select public.reverse_invoice_payment('00000000-0000-4000-8000-00000000f007', '$P1', 'again, by mistake')")" "already been reversed"
has "  a reversal sent again records nothing more" "$(as $O "select public.reverse_invoice_payment('00000000-0000-4000-8000-00000000f006', '$P1', 'ACH returned by the bank (synthetic)')")" '"duplicate": true'
echo "  ten payments of 10.00 sent at the same moment on 79.99 still owed:"
D9=$(draft $O "'$(ORD 9)'"); as $O "select public.issue_invoice('$D9')" >/dev/null
for n in $(seq 1 10); do ( as $A "select public.record_invoice_payment('00000000-0000-4000-8000-0000000f10$(printf %02d $n)', '$D9', 20, current_date, 'card', 'CARD-$n', null)" >/dev/null ) & done
wait
ok  "  six of 20.00 fit into 129.99; the rest are refused; never more than the total" "$(q "select count(*)||'/'||sum(amount)||'/'||(select amount_paid||'/'||status from invoices where id = '$D9') from invoice_payments where invoice_id = '$D9'")" "6/120.00/120.00/partially_paid"

echo " the history (Nov 22)"
ok  "creation, issue, payments, reversal and status changes are in the readable history" "$(q "select string_agg(event, ',' order by id) from invoice_events where invoice_id = '$D1'")" "created,draft_changed,draft_changed,draft_changed,draft_changed,draft_changed,draft_changed,issued,status_changed,payment_recorded,status_changed,payment_recorded,status_changed,payment_reversed"
ok  "  each entry names who did it" "$(q "select count(*) from invoice_events where invoice_id = '$D1' and by_user is null")" "0"
ok  "  the issue entry names the number; the Net 14 issue entry names who approved the credit" "$(q "select detail->>'invoice_number' from invoice_events where invoice_id = '$D1' and event = 'issued'")/$(q "select (detail->>'credit_approved_by' = '$A')::text from invoice_events where invoice_id = '$D2' and event = 'issued'")" "$(num 2)/true"
ok  "  a payment entry keeps amount, method and reference" "$(q "select detail->>'amount'||'/'||(detail->>'method')||'/'||(detail->>'reference') from invoice_events where invoice_id = '$D1' and event = 'payment_recorded' order by id limit 1")" "50.00/check/CHK-1001"
ok  "  a draft change lists which fields changed" "$(q "select detail->'fields' from invoice_events where invoice_id = '$D1' and event = 'draft_changed' order by id limit 1")" '["shipping"]'
has "nobody can write the history by hand, owner included" "$(as $O "insert into invoice_events (invoice_id, event) values ('$D1', 'issued')")" "written by the database only"
has "  nor change it" "$(as $O "update invoice_events set event = 'voided' where invoice_id = '$D1'")" "permission denied\|cannot be changed or deleted"
has "  nor delete it" "$(as $O "delete from invoice_events where invoice_id = '$D1'")" "permission denied\|cannot be changed or deleted"
ok  "production's audit_log also has every change, with who made it" "$(q "select count(*) > 5 and bool_and(changed_by is not null) from audit_log where table_name = 'invoices' and record_id = '$D1'")" "t"
ok  "  including payments" "$(q "select count(*) from audit_log where table_name = 'invoice_payments'")" "$(q "select count(*) from invoice_payments")"
ok  "staff read the history of invoices they can see" "$(as $E "select count(*) > 0 from invoice_events where invoice_id = '$D1'")" "t"

echo " decision 3: voiding keeps the row and the number"
as $O "delete from invoices where id = '$DC'" >/dev/null; DV=$(draft $O "'$(ORD 8)'")
as $O "select public.issue_invoice('$DV')" >/dev/null
has "voiding needs a written reason" "$(as $O "select public.void_invoice('$DV', ' ok ')")" "written reason is required"
has "staff cannot void" "$(as $E "select public.void_invoice('$DV', 'entered twice')")" "Only the owner or an administrator can void"
has "an administrator voids it" "$(as $A "select public.void_invoice('$DV', 'Entered twice (synthetic)')")" "\"already_void\": false"
ok  "  the row, its number and the reason are kept; the history says so" "$(q "select status||'/'||void_reason||'/'||(voided_by = '$A')||'/'||(select count(*) from invoice_events where invoice_id = '$DV' and event = 'voided') from invoices where id = '$DV'")" "void/Entered twice (synthetic)/true/1"
has "voiding again is safe" "$(as $O "select public.void_invoice('$DV', 'Entered twice (synthetic)')")" "\"already_void\": true"
has "a void invoice cannot be deleted" "$(as $O "delete from invoices where id = '$DV'")" "stays on the record"
has "a void invoice stays void" "$(as $O "update invoices set status = 'issued' where id = '$DV'")" "stays void\|cannot be edited"

echo " issuing at the same moment"
q "delete from invoices where status = 'draft'" >/dev/null
START=$(q "select last_seq from invoice_counters where invoice_year = $Y")
for n in $(seq 1 20); do
  oid=$(printf '00000000-0000-4000-8000-0000000d%04d' "$n")
  q "insert into orders (id, channel, status) values ('$oid','synthetic','paid')" >/dev/null
  draft $E "'$oid'" >/dev/null
done
for id in $(q "select id from invoices where status = 'draft'"); do ( as $O "select public.issue_invoice('$id')" >/dev/null ) & done
wait
ok  "20 invoices issued in parallel: 20 different numbers" "$(q "select count(distinct invoice_number) from invoices where order_id::text like '%0000000d%' and status = 'issued'")" "20"
ok  "  consecutive, with no gap and no repeat" "$(q "select min(invoice_seq)||'-'||max(invoice_seq)||'/'||count(*) from invoices where order_id::text like '%0000000d%'")" "$((START + 1))-$((START + 20))/20"
oid=00000000-0000-4000-8000-0000000e0001
q "insert into orders (id, channel, status) values ('$oid','synthetic','paid')" >/dev/null
DS=$(draft $E "'$oid'")
SAME=$(mktemp)
for n in $(seq 1 12); do ( as $O "select public.issue_invoice('$DS')" >>"$SAME" ) & done
wait
ok  "the same draft asked for 12 times at once: one number, one issuing, eleven told it was already issued" "$(grep -o 'HE-[0-9]*-[0-9]*' "$SAME" | sort -u | wc -l | tr -d ' ')/$(grep -c '\"already_issued\": false' "$SAME")/$(grep -c '\"already_issued\": true' "$SAME")" "1/1/11"
rm -f "$SAME"

echo " a verified resale order: exempt, tax 0"
q "insert into orders (id, channel, status) values ('00000000-0000-4000-8000-0000000e0002','synthetic','paid')" >/dev/null
DX=$(as $E "insert into invoices (order_id, lines, subtotal, shipping, bill_to, tax_rate, tax_rate_status, tax_exempt, tax_exempt_reason, tax, total) values ('00000000-0000-4000-8000-0000000e0002', '$LINES', 111, 9, '$BILL', 0, 'EXEMPT', true, 'resale exempt - certificate SYN-RESALE-0001 verified by owner on 2026-11-01', 0, 120) returning id")
has "the owner issues the exempt invoice" "$(as $O "select public.issue_invoice('$DX')")" '"already_issued": false'
ok  "  stored with tax 0 and the document on record" "$(q "select tax_rate_status||'/'||tax||'/'||total||'/'||(tax_exempt_reason like '%SYN-RESALE-0001%')::text from invoices where id = '$DX'")" "EXEMPT/0.00/120.00/true"

echo " rollback"
ok  "rollback refuses while issued invoices exist" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "issued, paid or void invoice(s) exist"
ok  "  nothing was removed" "$(q "select (to_regclass('public.invoices') is not null)::text||'/'||(select count(*) > 0 from invoice_payments)")" "true/true"

fresh
before=$(q "$SNAP")
ok  "fresh copy: install" "$(run "$INSTALL")" "0"
draft $E "'$(ORD 1)'" >/dev/null; draft $E "'$(ORD 2)'" >/dev/null
ok  "  rollback with two drafts and no authorization refuses" "$(run "$ROLLBACK")" "3"
has "  and says how many drafts would be deleted and how to allow it" "$(cat "$OUTF")" "2 draft invoice(s) exist and would be deleted"
ok  "  the drafts are still there" "$(q "select count(*) from invoices")" "2"
psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_draft_invoices = 'yes'" -f "$ROLLBACK" >"$OUTF" 2>&1
ok  "  a wrong authorization phrase does not count" "$(q "select count(*) from invoices")" "2"
echo "  an issue in progress while the rollback runs:"
D=$(q "select id from invoices where order_id = '$(ORD 1)'")
( psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$O'; select public.issue_invoice('$D'); select pg_sleep(3); commit;" >/dev/null 2>&1 ) &
sleep 1
psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_draft_invoices = 'yes, delete the drafts'" -f "$ROLLBACK" >"$OUTF" 2>&1; rc=$?
wait
ok  "  the rollback waited for the issue to finish, then refused (an invoice was issued meanwhile)" "$rc/$(grep -c 'issued, paid or void invoice(s) exist' "$OUTF")" "3/1"
ok  "  the issued invoice is intact" "$(q "select status||'/'||invoice_number from invoices where id = '$D'")" "issued/$(num 1)"

fresh
ok  "fresh copy: install" "$(run "$INSTALL")" "0"
draft $E "'$(ORD 1)'" >/dev/null
psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_draft_invoices = 'yes, delete the drafts'" -f "$ROLLBACK" >"$OUTF" 2>&1
ok  "  with the deletion of drafts authorized, the rollback runs" "$(q "select (to_regclass('public.invoices') is null)::text")" "true"
has "  and says how many drafts it deleted" "$(cat "$OUTF")" "Draft invoices deleted with them: 1"
ok  "  every table, function and audit trigger of the feature is gone" "$(q "select (to_regclass('public.invoice_payments') is null and to_regclass('public.invoice_events') is null and to_regclass('public.invoice_counters') is null and to_regprocedure('public.issue_invoice(uuid,text,boolean)') is null and to_regprocedure('public.invoice_lines_problem(jsonb)') is null)::text||'/'||(select count(*) from pg_trigger where tgname like 'invoice%')")" "true/0"
ok  "  audit_log keeps what it recorded" "$(q "select count(*) > 0 from audit_log where table_name = 'invoices'")" "t"
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  every other table is as it was" "$(q "$SNAP")" "$before"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

echo " safe install: an existing table of a different shape"
fresh
q "create table public.invoices (id uuid primary key, note text)" >/dev/null
ok  "an existing invoices table with other columns: the install stops" "$(run "$INSTALL")" "3"
has "  and names what differs" "$(cat "$OUTF")" "already exists with a different shape"
has "  (a missing column)" "$(cat "$OUTF")" "missing or different: amount_paid"
has "  (an unexpected column)" "$(cat "$OUTF")" "unexpected: note text"
ok  "  nothing was created" "$(q "select (to_regclass('public.invoice_counters') is null and to_regclass('public.invoice_payments') is null)::text||'/'||(select count(*) from pg_trigger where tgname like 'invoice%')")" "true/0"
fresh
ok  "install on a fresh copy" "$(run "$INSTALL")" "0"
q "alter table public.invoices drop constraint invoices_paid_within_total" >/dev/null
ok  "an existing invoices table missing one of its rules: the install stops" "$(run "$INSTALL")" "3"
has "  and names the missing rule" "$(cat "$OUTF")" "missing constraints: invoices_paid_within_total"
q "alter table public.invoices alter column total type numeric(14,2)" >/dev/null
ok  "a column of a different type: the install stops" "$(run "$INSTALL")" "3"
has "  and names it" "$(cat "$OUTF")" "total numeric(12,2)"
fresh
q "drop trigger tasks_audit on tasks" >/dev/null
ok  "no audit trigger on tasks: the install stops before changing anything" "$(run "$INSTALL")" "3"
has "  and says so" "$(cat "$OUTF")" "audit trigger on public.tasks was not found"
ok  "  nothing was created" "$(q "select (to_regclass('public.invoices') is null)::text")" "true"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
