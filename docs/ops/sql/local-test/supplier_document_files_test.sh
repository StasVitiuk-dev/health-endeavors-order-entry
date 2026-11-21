#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-21). Never point this at Supabase.
# Tests drafts/38 (private supplier document files) and drafts/39 (rollback) on
# a throwaway copy with drafts/36 installed. The local database has no Supabase
# storage service, so a minimal STAND-IN of its storage schema is created first:
# the two tables and the grants Supabase uses, with row-level security on. The
# Supabase storage service checks these same rules, as the signed-in person, for
# every download, signed link and upload; here the test runs those checks
# directly (a read of the object row = "may open / may get a link").
# Owner decision of Nov 21: only the owner opens files; staff and ordinary
# administrators cannot open one through a direct link or approve through the
# backend. All rows synthetic.
# Usage: supplier_document_files_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_supplier_document_files_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-200)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000004e1; A=00000000-0000-4000-8000-0000000004e2; E=00000000-0000-4000-8000-0000000004e4; E2=00000000-0000-4000-8000-0000000004e5
LAB=00000000-0000-4000-8000-0000000004f1
K() { printf '00000000-0000-4000-8000-%012d' "$1"; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$A','$E','$E2');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'700000001'),
     ('$A','admin@example.test','administrator',true,'700000002'), ('$E','staff@example.test','employee',true,'700000004'), ('$E2','staff2@example.test','employee',true,'700000005');
   insert into suppliers (id, name, supplier_type, is_active) values ('$LAB','SYN Lotion Lab','lab',true);
   -- STAND-IN for Supabase's storage schema (the shape its rules run against)
   create schema storage;
   create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
   create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null,
     owner uuid default auth.uid(), created_at timestamptz default now(), metadata jsonb, unique (bucket_id, name));
   alter table storage.objects enable row level security;
   grant usage on schema storage to authenticated, anon;
   grant select, insert, update, delete on storage.objects to authenticated, anon;
   grant select on storage.buckets to authenticated, anon;
   insert into storage.buckets (id, name, public) values ('expense-receipts','expense-receipts',false);" >/dev/null
echo "Private supplier document files (throwaway database $DB, storage stand-in)"
ok "drafts/36 installs" "$(run "$DIR/drafts/36_DRAFT_supplier_documents.sql")" "0"
before=$(q "select count(*) from pg_policies where schemaname = 'storage'")
ok "drafts/38 installs" "$(run "$DIR/drafts/38_DRAFT_supplier_document_files.sql")" "0"
ok "  a second install changes nothing" "$(run "$DIR/drafts/38_DRAFT_supplier_document_files.sql")" "0"
ok "  the bucket is private, PDF/JPEG/PNG, 10 MB" "$(q "select public::text||'/'||file_size_limit||'/'||array_to_string(allowed_mime_types,',') from storage.buckets where id = 'supplier-documents'")" "false/10485760/application/pdf,image/jpeg,image/png"
ok "  two rules added, on this bucket only" "$(q "select count(*) from pg_policies where schemaname = 'storage'")" "$((before + 2))"

rec() { as "$1" "select public.record_supplier_document('$(K $2)','$LAB','certificate_of_analysis','batch','$3','$3','COA-$2',current_date,null,null,null)" >/dev/null; q "select id from supplier_documents where request_key = '$(K $2)'"; }
D1=$(rec $E 1 LOT-1); D2=$(rec $E2 2 LOT-2)
put() { as "$1" "insert into storage.objects (bucket_id, name) values ('supplier-documents', '$2')"; }
see() { as "$1" "select count(*) from storage.objects where bucket_id = 'supplier-documents' and name = '$2'"; }

echo " uploading"
has "a visitor cannot upload" "$(put anon "$D1/coa.pdf")" "permission denied\|row-level security"
has "staff cannot upload into a document someone else recorded" "$(put $E2 "$D1/coa.pdf")" "row-level security"
has "an administrator cannot upload into a document staff recorded" "$(put $A "$D1/coa.pdf")" "row-level security"
has "a file name outside a document's folder is refused" "$(put $E "loose-file.pdf")" "row-level security"
ok  "the person who recorded it uploads its file" "$(put $E "$D1/coa.pdf")" ""
as $E "select public.attach_supplier_document_file('$D1','$D1/coa.pdf','$(printf 'c%.0s' $(seq 1 64))',4096,'application/pdf')" >/dev/null
has "  once the file is attached, a second upload is refused" "$(put $E "$D1/coa-2.pdf")" "row-level security"

echo " opening a file (a direct link needs the read rule)"
ok  "the owner can open it" "$(see $O "$D1/coa.pdf")" "1"
ok  "the staff member who uploaded it cannot open it" "$(see $E "$D1/coa.pdf")" "0"
ok  "another staff member cannot" "$(see $E2 "$D1/coa.pdf")" "0"
ok  "an ordinary administrator cannot" "$(see $A "$D1/coa.pdf")" "0"
has "a visitor cannot" "$(see anon "$D1/coa.pdf")" "permission denied\|^0$"
ok  "  nor list the bucket" "$(as $A "select count(*) from storage.objects where bucket_id = 'supplier-documents'")" "0"

echo " replacing or deleting"
as $O "update storage.objects set name = '$D1/swapped.pdf' where name = '$D1/coa.pdf'" >/dev/null
ok  "nobody can replace a file (owner included): nothing changes" "$(q "select name from storage.objects where bucket_id = 'supplier-documents'")" "$D1/coa.pdf"
as $O "delete from storage.objects where name = '$D1/coa.pdf'" >/dev/null
ok  "nobody can delete a file (owner included)" "$(q "select count(*) from storage.objects where bucket_id = 'supplier-documents'")" "1"

echo " approving"
has "staff cannot approve" "$(as $E "select public.review_supplier_document('$D1','approved',null)")" "Only the owner"
has "an ordinary administrator cannot approve" "$(as $A "select public.review_supplier_document('$D1','approved',null)")" "Only the owner"
has "the owner approves" "$(as $O "select public.review_supplier_document('$D1','approved',null)")" '"status": "approved"'
has "  after approval, no further upload into that document" "$(put $O "$D1/later.pdf")" "row-level security"
ok  "other buckets are untouched (no new rule names them)" "$(q "select count(*) from pg_policies where schemaname = 'storage' and (qual like '%expense-receipts%' or with_check like '%expense-receipts%')")" "0"

echo " rollback"
ok  "rollback refuses while files are stored" "$(run "$DIR/drafts/39_DRAFT_rollback_supplier_document_files.sql")" "3"
has "  and says why" "$(cat "$OUTF")" "file(s) are stored"
q "alter table storage.objects disable row level security; delete from storage.objects where bucket_id = 'supplier-documents'; alter table storage.objects enable row level security" >/dev/null
ok  "with no files, rollback succeeds" "$(run "$DIR/drafts/39_DRAFT_rollback_supplier_document_files.sql")" "0"
ok  "  rules, check and bucket are gone; other buckets kept" "$(q "select (select count(*) from pg_policies where schemaname = 'storage')||'/'||(to_regprocedure('public.supplier_document_file_upload_allowed(text)') is null)::text||'/'||(select count(*) from storage.buckets where id = 'supplier-documents')||'/'||(select count(*) from storage.buckets)")" "$before/true/0/1"
ok  "  a second rollback is harmless" "$(run "$DIR/drafts/39_DRAFT_rollback_supplier_document_files.sql")" "0"
ok  "  install works again afterwards" "$(run "$DIR/drafts/38_DRAFT_supplier_document_files.sql")" "0"
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
