#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-22). Never point this at Supabase.
# Backup restore verification WITH the pending drafts installed (32 invoices,
# 34 stock-count approval, 36 supplier documents, 38 private files). The earlier
# drill (restore_drill.sh) proves rows come back; this one proves the RULES come
# back too: after a backup (pg_dump) is restored into a brand-new database,
#   * every new table still has row-level security on, with the same rules;
#   * the guards (triggers), the functions (caller's rights, fixed search path)
#     and the permissions (nothing for visitors) are identical;
#   * the records are identical, and the invoice counter carries on (no number
#     is ever reused after a restore);
#   * on the restored copy an administrator still cannot approve, an issued
#     invoice still cannot be edited, staff still cannot open a file.
# A restore that silently dropped one rule would let the dashboard keep working
# while a protection was gone; that is what this catches. All rows synthetic.
# Usage: restore_with_drafts_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_restore_drafts_src; DST=he_restore_drafts_copy
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DUMP=$(mktemp --suffix=.dump)
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-200)]"; fi; }
q()    { psql "${CONN[@]}" -d "$1" -qtAX -c "$2" 2>&1; }
run()  { psql "${CONN[@]}" -d "$1" -qX -v ON_ERROR_STOP=1 -f "$2" >/dev/null 2>&1; echo $?; }
as()   { local db="$1" who="$2" sql="$3" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$db" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
cleanup() { rm -f "$DUMP"; for d in $DB $DST; do psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $d with (force)" >/dev/null 2>&1; done; }
trap cleanup EXIT
cleanup; DUMP=$(mktemp --suffix=.dump)

O=00000000-0000-4000-8000-0000000007a1; A=00000000-0000-4000-8000-0000000007a2; E=00000000-0000-4000-8000-0000000007a3
P1=00000000-0000-4000-8000-0000000007d1; LAB=00000000-0000-4000-8000-0000000007f1
ORD() { echo "00000000-0000-4000-8000-00000000770$1"; }
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
echo "Backup restore with the pending drafts installed (throwaway databases $DB -> $DST)"
# A backup of a database with broken references cannot be restored; make sure the
# local template is clean first (an earlier test once left order lines behind).
ok "the local template has no order line pointing at a missing order" "$(q $DB "select count(*) from order_items oi where not exists (select 1 from orders o where o.id = oi.order_id)")" "0"
q $DB "delete from profiles where id in ('$O','$A','$E');
  insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'770000001'),
    ('$A','admin@example.test','administrator',true,'770000002'), ('$E','staff@example.test','employee',true,'770000003');
  insert into products (id, name, sku) values ('$P1','SYNTHETIC restore lotion','SYN-RST-A');
  insert into inventory (product_id, available, damaged) values ('$P1', 40, 0);
  insert into suppliers (id, name, supplier_type, is_active) values ('$LAB','SYN Restore Lab','lab',true);
  insert into orders (id, channel, status, order_number) values ('$(ORD 1)','synthetic','paid','SYN-R1'), ('$(ORD 2)','synthetic','paid','SYN-R2');
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null,
    owner uuid default auth.uid(), created_at timestamptz default now(), metadata jsonb, unique (bucket_id, name));
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated, anon; grant select, insert, update, delete on storage.objects to authenticated, anon; grant select on storage.buckets to authenticated, anon;" >/dev/null
for d in 32_DRAFT_invoices 34_DRAFT_stock_count_adjustments 36_DRAFT_supplier_documents 38_DRAFT_supplier_document_files; do
  ok "drafts/${d%%_*} installs on the source" "$(run $DB "$DIR/drafts/$d.sql")" "0"
done

# made-up records in every new table: an issued invoice and a draft, a stock-count
# proposal, a supplier document with its file, approved by the owner, and a hand-off
BILL='{"name":"SYN Restore Spa","lines":["100 Example Street","Example City, IL 60000"]}'
D1=$(as $DB $E "insert into invoices (order_id, lines, subtotal, shipping, bill_to) values ('$(ORD 1)', '[{\"sku\":\"SYN-RST-A\",\"quantity\":2,\"unitPrice\":20,\"lineTotal\":40}]', 40, 0, '$BILL') returning id")
as $DB $O "update invoices set tax_rate = 0.09, tax_rate_status = 'CONFIRMED', tax_place = 'Example City, IL', tax = 3.60, total = 43.60 where id = '$D1'" >/dev/null
has "  an invoice is issued on the source (first number)" "$(as $DB $O "select public.issue_invoice('$D1')")" '"invoice_number": "HE-'
D2=$(as $DB $E "insert into invoices (order_id, lines, subtotal, bill_to, tax_rate, tax_rate_status, tax_place, tax, total) values ('$(ORD 2)', '[{\"sku\":\"SYN-RST-B\",\"quantity\":5,\"unitPrice\":10,\"lineTotal\":50}]', 50, '$BILL', 0, 'CONFIRMED', 'Example City, IL', 0, 50) returning id")
as $DB $O "select public.record_invoice_payment('00000000-0000-4000-8000-000000007a91', '$D1', 20, current_date, 'check', 'CHK-RST-1', null)" >/dev/null
ADJ=$(as $DB $E "select (public.propose_stock_count_adjustment('$P1','available',38,'Counted the shelf twice')->>'id')")
as $DB $E "select public.record_supplier_document('00000000-0000-4000-8000-000000007901','$LAB','certificate_of_analysis','batch','LOT-R1','Lot R1','COA-R1',current_date,null,null,null)" >/dev/null
DOC=$(q $DB "select id from supplier_documents where reference = 'COA-R1'")
as $DB $E "insert into storage.objects (bucket_id, name) values ('supplier-documents', '$DOC/coa.pdf')" >/dev/null
as $DB $E "select public.attach_supplier_document_file('$DOC','$DOC/coa.pdf','$(printf 'a%.0s' $(seq 1 64))',4096,'application/pdf')" >/dev/null
as $DB $O "select public.review_supplier_document('$DOC','approved',null)" >/dev/null
as $DB $E "select public.record_supplier_document('00000000-0000-4000-8000-000000007902','$LAB','batch_record','batch','LOT-R2','Lot R2','BR-R2',current_date,null,null,null)" >/dev/null
DOC2=$(q $DB "select id from supplier_documents where reference = 'BR-R2'")
as $DB $E "select public.hand_off_supplier_document('00000000-0000-4000-8000-000000007903','$LAB','packing_slip','R-77 handwritten','PS-R','2026-11-20',null)" >/dev/null
ok "  the source holds the made-up records" "$(q $DB "select (select count(*) from invoices)||'/'||(select count(*) from stock_count_adjustments)||'/'||(select count(*) from supplier_documents)||'/'||(select count(*) from supplier_document_handoffs)||'/'||(select count(*) from storage.objects)")" "2/1/2/1/1"

# --- back up and restore into a brand-new database ---------------------------
# The backup tools may be newer than the database (GitHub's runner has version 18
# tools, the test database is 16). A newer pg_restore writes settings an older
# server does not know (transaction_timeout, from 17), so the backup is turned
# into a plain SQL script, only those unknown settings are removed, and the
# script runs with every other error stopping it. Same-version tools are used
# directly when installed.
SNUM=$(psql "${CONN[@]}" -d postgres -qtAX -c "show server_version_num"); SMAJ=$((SNUM / 10000))
BIN=""; [ -x "/usr/lib/postgresql/$SMAJ/bin/pg_restore" ] && BIN="/usr/lib/postgresql/$SMAJ/bin/"
DUMPOPT=(); "${BIN}pg_dump" --help 2>/dev/null | grep -q -- '--no-statistics' && DUMPOPT=(--no-statistics)
echo "  (server $SMAJ; $("${BIN}pg_dump" --version))"
ERRF=$(mktemp); SQLF=$(mktemp --suffix=.sql)
"${BIN}pg_dump" "${CONN[@]}" "${DUMPOPT[@]}" -Fc -f "$DUMP" $DB 2>"$ERRF"; ok "the backup is taken (pg_dump, custom format)" "$?" "0"
psql "${CONN[@]}" -d postgres -qX -c "create database $DST" >/dev/null
"${BIN}pg_restore" -f "$SQLF" "$DUMP" 2>>"$ERRF"
[ "$SMAJ" -lt 17 ] && sed -i '/^SET transaction_timeout = /d' "$SQLF"
psql "${CONN[@]}" -d $DST -qX -v ON_ERROR_STOP=1 -f "$SQLF" >/dev/null 2>>"$ERRF"; rc=$?
ok "the backup restores into a brand-new database with no error" "$rc" "0"
if [ "$rc" != 0 ]; then echo "  the restore stopped; nothing below can be checked. It said:"; grep -m5 -i 'error\|fatal' "$ERRF" | sed 's/^/    /'; rm -f "$ERRF" "$SQLF"; echo "passed $pass, failed $fail"; exit 1; fi
rm -f "$ERRF" "$SQLF"

NEW_TABLES="'invoices','invoice_counters','invoice_payments','invoice_events','stock_count_adjustments','stock_count_approvers','supplier_document_types','supplier_type_document_profiles','supplier_document_supplier_profiles','supplier_document_subjects','supplier_documents','supplier_document_events','supplier_document_handoffs'"
same() { local a b; a=$(q $DB "$2"); b=$(q $DST "$2"); if [ -n "$a" ] && [ "$a" = "$b" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: source [$a] copy [$b]"; fi; }
echo " the rules came back"
same "row-level security is on for every new table, exactly as on the source" "select string_agg(relname||':'||relrowsecurity||':'||relforcerowsecurity, ',' order by relname) from pg_class where relnamespace = 'public'::regnamespace and relname in ($NEW_TABLES)"
ok   "  (and it is on for all 13)" "$(q $DST "select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname in ($NEW_TABLES) and relrowsecurity")" "13"
same "every row rule is identical (names, commands, roles, conditions)" "select count(*)||':'||md5(string_agg(schemaname||tablename||policyname||cmd||roles::text||coalesce(qual,'')||coalesce(with_check,''), '|' order by schemaname, tablename, policyname)) from pg_policies where schemaname in ('public','storage')"
same "every guard (trigger) is identical and enabled" "select count(*)||':'||md5(string_agg(tgrelid::regclass::text||tgname||tgenabled||pg_get_triggerdef(oid), '|' order by tgrelid::regclass::text, tgname)) from pg_trigger where not tgisinternal"
same "every function is identical: text, caller's rights, fixed search path" "select count(*)||':'||md5(string_agg(proname||pg_get_function_identity_arguments(oid)||md5(prosrc)||prosecdef::text||coalesce(proconfig::text,''), '|' order by proname, pg_get_function_identity_arguments(oid))) from pg_proc where pronamespace = 'public'::regnamespace"
same "every table permission is identical" "select md5(string_agg(grantee||table_name||privilege_type, '|' order by grantee, table_name, privilege_type)) from information_schema.role_table_grants where table_schema in ('public','storage')"
same "every function permission is identical" "select md5(string_agg(grantee||routine_name||privilege_type, '|' order by grantee, routine_name, privilege_type)) from information_schema.role_routine_grants where routine_schema = 'public'"
ok   "  visitors still have no access to the new tables" "$(q $DST "select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_name in ($NEW_TABLES)")" "0"
echo " the records came back"
same "every new table has the same rows" "select md5(string_agg(t||':'||c, ',' order by t)) from (select 'invoices' t, md5(string_agg(to_jsonb(x)::text, '' order by x.id))::text c from invoices x union all select 'counters', md5(string_agg(to_jsonb(x)::text, '' order by x.invoice_year)) from invoice_counters x union all select 'adj', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from stock_count_adjustments x union all select 'docs', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from supplier_documents x union all select 'events', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from supplier_document_events x union all select 'handoffs', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from supplier_document_handoffs x union all select 'payments', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from invoice_payments x union all select 'invoice_events', md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from invoice_events x union all select 'files', md5(string_agg(x.bucket_id||x.name, '' order by x.name)) from storage.objects x) s"
same "  the private bucket is still private" "select public::text||'/'||file_size_limit from storage.buckets where id = 'supplier-documents'"

echo " on the restored copy, the protections still hold"
has "an issued invoice still cannot be edited" "$(as $DST $O "update invoices set total = 1 where id = '$D1'")" "An issued invoice cannot be edited"
R=$(as $DST $O "select public.issue_invoice('$D2')")
has "the next invoice gets the NEXT number (the counter carried over; no number reused)" "$R" '0002"'
has "staff still cannot issue" "$(as $DST $E "select public.issue_invoice('$D1')")" "Only the owner or an administrator can issue"
has "an administrator still cannot approve a stock count" "$(as $DST $A "select public.approve_stock_count_adjustment('$ADJ')")" "Only the owner can approve"
ok  "  and stock is unchanged" "$(q $DST "select available from inventory where product_id = '$P1'")" "40"
has "staff still cannot approve a supplier document (the owner or an administrator does, owner decision of Nov 24)" "$(as $DST $E "select public.review_supplier_document('$DOC2','approved',null)")" "Only the owner or an administrator"
ok  "  the approval of the first one still names the exact file approved" "$(q $DST "select status||'/'||left(approved_file_sha256, 8) from supplier_documents where id = '$DOC'")" "approved/aaaaaaaa"
ok  "staff still cannot open the stored file" "$(as $DST $E "select count(*) from storage.objects where bucket_id = 'supplier-documents'")" "0"
ok  "  an administrator can (owner decision of Nov 24)" "$(as $DST $A "select count(*) from storage.objects where bucket_id = 'supplier-documents'")" "1"
ok  "  the owner can" "$(as $DST $O "select count(*) from storage.objects where bucket_id = 'supplier-documents'")" "1"
as $DST $O "delete from supplier_document_events" >/dev/null
same "nobody can delete the review history, owner included" "select count(*) from supplier_document_events"
has "staff still cannot link a hand-off" "$(as $DST $E "select public.resolve_supplier_document_handoff((select id from supplier_document_handoffs limit 1), (select id from purchase_orders limit 1))")" "Only the owner"
ok  "a payment is still recorded only by the owner or an administrator, and the restored part payment still counts" "$(as $DST $E "select public.record_invoice_payment('00000000-0000-4000-8000-000000007a92', '$D1', 1, current_date, 'cash', null, null)" | grep -c 'Only the owner')/$(q $DST "select status||'/'||amount_paid from invoices where id = '$D1'")" "1/partially_paid/20.00"
has "nobody can write the invoice history by hand on the copy" "$(as $DST $O "insert into invoice_events (invoice_id, event) values ('$D1', 'voided')")" "written by the database only"
ok  "the source itself was not changed by the backup" "$(q $DB "select (select count(*) from invoices where status <> 'draft')||'/'||(select last_seq from invoice_counters limit 1)")" "1/1"

echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
