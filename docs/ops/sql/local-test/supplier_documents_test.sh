#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-16). Never point this at Supabase.
# Tests drafts/36 (supplier document storage: record, review by the owner or an administrator and
# changes, review history, configurable checklist) and drafts/37 (rollback) on
# a throwaway copy, acting as the owner, two administrators, an employee, a
# deactivated account and a visitor. Covers the owner's decisions of Nov 16-17:
# staff and administrators may record that a document arrived; ONLY the owner or an
# administrator (owner decision of Nov 24; a switched-off administrator is refused)
# approves, rejects, corrects, withdraws an approved document or changes the
# checklist; a retried save never records twice; every change is in the history,
# which nobody can edit. All rows are synthetic.
# Usage: supplier_documents_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_supplier_documents_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/36_DRAFT_supplier_documents.sql"; ROLLBACK="$DIR/drafts/37_DRAFT_rollback_supplier_documents.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
# as <uid|anon> <sql>: run as that person and KEEP the result (committed).
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000000e1; A=00000000-0000-4000-8000-0000000000e2; A2=00000000-0000-4000-8000-0000000000e3
E=00000000-0000-4000-8000-0000000000e4; I=00000000-0000-4000-8000-0000000000e5
LAB=00000000-0000-4000-8000-0000000000f1; BOT=00000000-0000-4000-8000-0000000000f2; LBL=00000000-0000-4000-8000-0000000000f3; OLD=00000000-0000-4000-8000-0000000000f4
POL=00000000-0000-4000-8000-0000000000f5; POB=00000000-0000-4000-8000-0000000000f6
K() { printf '00000000-0000-4000-8000-%012d' "$1"; }   # request keys
setup() {
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
  q "delete from profiles where id in ('$O','$A','$A2','$E','$I');
     insert into profiles (id, email, role, is_active, account_number) values
     ('$O','owner@example.test','owner',true,'300000001'), ('$A','admin@example.test','administrator',true,'300000002'),
     ('$A2','admin2@example.test','administrator',true,'300000003'), ('$E','staff@example.test','employee',true,'300000004'),
     ('$I','gone@example.test','administrator',false,'300000005');
     insert into suppliers (id, name, supplier_type, is_active) values ('$LAB','SYN Lotion Lab','lab',true), ('$BOT','SYN Bottles & Pumps','packaging',true),
       ('$LBL','SYN Label Printer','other',true), ('$OLD','SYN Former Supplier','supplier',false);
     insert into purchase_orders (id, po_number, supplier_id, status) values ('$POL','SYN-PO-901','$LAB','received'), ('$POB','SYN-PO-902','$BOT','shipped');" >/dev/null
}
rec() { # rec <who> <key-n> <supplier> <kind> <subject_kind> <subject_ref> [received_on] [expires_on]
  as "$1" "select public.record_supplier_document('$(K $2)','$3','$4','$5','$6','$6 label','REF-$2',${7:-current_date},null,${8:-null},null)"; }
setup
echo "Supplier documents: record, review and changes by the owner or an administrator, history, checklist (throwaway database $DB)"
SNAP="select (select count(*) from orders)||'/'||(select count(*) from suppliers)||'/'||(select count(*) from purchase_orders)||'/'||(select count(*) from documents)||'/'||(select count(*) from products)"
before=$(q "$SNAP")

ok "install succeeds" "$(run "$INSTALL")" "0"
ok "  a second install changes nothing and succeeds" "$(run "$INSTALL")" "0"
ok "  no existing table gained or lost a row" "$(q "$SNAP")" "$before"
ok "  the starting checklist: 9 document types; lab and packaging have profiles" "$(q "select (select count(*) from supplier_document_types)||'/'||(select string_agg(supplier_type||'='||array_to_string(profiles,'+'), ',' order by supplier_type) from supplier_type_document_profiles)")" "9/lab=lotion_lab,packaging=bottles_pumps"
ok "  no documents yet" "$(q "select count(*) from supplier_documents")" "0"

echo " who can record a document that arrived"
has "a visitor cannot read documents" "$(as anon "select count(*) from supplier_documents")" "permission denied"
has "a visitor cannot record one" "$(as anon "select public.record_supplier_document('$(K 1)','$LAB','certificate_of_analysis','batch','LOT-301',null,null,current_date,null,null,null)")" "permission denied"
has "a deactivated account cannot record one" "$(rec $I 1 $LAB certificate_of_analysis batch LOT-301)" "Only active staff"
R=$(rec $E 1 $LAB certificate_of_analysis batch LOT-301)
has "staff record a certificate of analysis for a new batch" "$R" '"status": "received"'
has "  it is a new record, not a duplicate" "$R" '"duplicate": false'
ok  "  the batch was added to the supplier's subjects" "$(q "select label from supplier_document_subjects where supplier_id = '$LAB' and subject_ref = 'LOT-301'")" "LOT-301 label"
DOC1=$(q "select id from supplier_documents where request_key = '$(K 1)'")
ok  "  the record keeps who recorded it, the reference and the status" "$(q "select (recorded_by = '$E')::text||'/'||reference||'/'||status||'/'||(reviewed_by is null)::text from supplier_documents where id = '$DOC1'")" "true/REF-1/received/true"
R=$(rec $E 1 $LAB certificate_of_analysis batch LOT-301)
has "the same save sent again (a retry) returns the same document" "$R" "\"id\": \"$DOC1\""
has "  and says it was a duplicate" "$R" '"duplicate": true'
ok  "  only one document exists" "$(q "select count(*) from supplier_documents")" "1"
has "a request key cannot be reused for a different document" "$(rec $E 1 $LAB batch_record batch LOT-301)" "already used for a different document"
SAME=$(mktemp)
for n in $(seq 1 10); do ( rec $A 2 $LAB batch_record batch LOT-301 >>"$SAME" ) & done
wait
ok  "10 simultaneous sends of one save: all answered" "$(grep -c '"status": "received"' "$SAME")" "10"
ok  "  one recorded it, nine got it back as a duplicate" "$(grep -c '"duplicate": false' "$SAME")/$(grep -c '"duplicate": true' "$SAME")" "1/9"
ok  "  exactly one batch record exists" "$(q "select count(*) from supplier_documents where kind = 'batch_record'")" "1"
rm -f "$SAME"
has "a second copy of the same document cannot wait for review at the same time" "$(rec $A 3 $LAB certificate_of_analysis batch LOT-301)" "already waiting for review"
has "staff cannot record a purchase document for an order they cannot see; they are told to hand it off" "$(rec $E 4 $LAB supplier_invoice purchase $POL)" "Hand the document to the owner instead"
has "a purchase document must be for one of this supplier's orders" "$(rec $A 4 $LAB supplier_invoice purchase $POB)" "not one you can see for this supplier"
R=$(rec $A 5 $LAB supplier_invoice purchase $POL)
has "an administrator records the supplier invoice of the lab's order" "$R" '"status": "received"'
DOC5=$(q "select id from supplier_documents where request_key = '$(K 5)'")
has "an unknown document type is refused" "$(rec $E 6 $LAB passport batch LOT-301)" "ERROR"
has "a document type must match what it belongs to" "$(rec $E 7 $LAB certificate_of_analysis formula F-1)" "belongs to a batch"
has "a document for an inactive supplier is refused" "$(rec $E 8 $OLD component_specification component C-1)" "No active supplier"
has "a received date in the future is refused" "$(rec $E 9 $BOT component_specification component C-8OZ "current_date + 10")" "cannot be in the future"
has "staff cannot type a document in as already approved" "$(as $E "insert into supplier_documents (request_key, supplier_id, kind, subject_kind, subject_ref, received_on, status, reviewed_by, reviewed_at) values ('$(K 10)','$LAB','batch_record','batch','LOT-301',current_date,'approved','$E',now())")" "only the owner or an administrator can then approve"
has "the expiry cannot be before the document date" "$(as $E "select public.record_supplier_document('$(K 11)','$BOT','component_specification','component','C-8OZ','8 oz bottle','SPEC-8',current_date,'2026-11-01','2026-10-01',null)")" "expiry_after_date"
R=$(as $E "select public.record_supplier_document('$(K 12)','$BOT','component_specification','component','C-8OZ','8 oz bottle','SPEC-8',current_date,'2026-11-01','2027-11-01',null)")
has "staff record a component specification valid for a year" "$R" '"status": "received"'
DOC12=$(q "select id from supplier_documents where request_key = '$(K 12)'")

echo " only the owner or an administrator approves, rejects or corrects (owner decision of Nov 24)"
has "a switched-off administrator cannot approve (function)" "$(as $I "select public.review_supplier_document('$DOC1','approved',null)")" "Only the owner or an administrator can approve or reject"
has "staff cannot approve (direct edit)" "$(as $E "update supplier_documents set status = 'approved' where id = '$DOC1'")" "Only the owner or an administrator can approve or reject"
has "staff cannot approve" "$(as $E "select public.review_supplier_document('$DOC1','approved',null)")" "Only the owner"
has "staff cannot reject" "$(as $E "select public.review_supplier_document('$DOC1','rejected','Looks wrong to me')")" "Only the owner"
has "staff cannot correct the reference" "$(as $E "update supplier_documents set reference = 'COA-EDITED' where id = '$DOC1'")" "Only the owner or an administrator can correct"
has "  nor through the correction function" "$(as $E "select public.correct_supplier_document('$DOC1','COA-EDITED',null,null,null)")" "Only the owner or an administrator can correct"
has "nobody can change what a document is (owner included)" "$(as $O "update supplier_documents set kind = 'batch_record' where id = '$DOC1'")" "cannot change"
as $A "update supplier_documents set reviewed_by = '$A', reviewed_at = now() where id = '$DOC1'" >/dev/null
ok  "nobody can fill in the reviewer by hand: the database puts it back" "$(q "select (reviewed_by is null)::text from supplier_documents where id = '$DOC1'")" "true"
ok  "  the document is still waiting, unreviewed" "$(q "select status||'/'||(reviewed_by is null)::text from supplier_documents where id = '$DOC1'")" "received/true"
R=$(as $O "select public.correct_supplier_document('$DOC1','COA-301-A',null,'2026-11-10','2027-11-10')")
has "the owner corrects the reference and dates of a waiting document" "$R" '"ok": true'
has "  the correction is in the history, before and after" "$(q "select detail::text from supplier_document_events where document_id = '$DOC1' and event = 'corrected'")" '"reference": {"to": "COA-301-A", "from": "REF-1"}'
R=$(as $O "select public.review_supplier_document('$DOC1','approved',null)")
has "the owner approves" "$R" '"status": "approved"'
ok  "  the record names the owner as reviewer, with the time" "$(q "select (reviewed_by = '$O')::text||'/'||(reviewed_at is not null)::text from supplier_documents where id = '$DOC1'")" "true/true"
R=$(as $O "select public.review_supplier_document('$DOC1','approved',null)")
has "approving twice decides once" "$R" '"already_decided": true'
SAME=$(mktemp)
for n in $(seq 1 10); do W=$O; [ $((n % 3)) = 1 ] && W=$A; [ $((n % 3)) = 2 ] && W=$A2; ( as $W "select public.review_supplier_document('$DOC5','approved',null)" >>"$SAME" ) & done
wait
ok  "10 simultaneous approvals by the owner and two administrators: one decided, nine were told it was already decided" "$(grep -c '"already_decided": false' "$SAME")/$(grep -c '"already_decided": true' "$SAME")" "1/9"
ok  "  one 'approved' entry in the history" "$(q "select count(*) from supplier_document_events where document_id = '$DOC5' and event = 'approved'")" "1"
rm -f "$SAME"
has "an approved document cannot be corrected, even by the owner" "$(as $O "select public.correct_supplier_document('$DOC1','COA-LATE',null,null,null)")" "Only a document waiting for review"
has "a rejection must say why" "$(as $O "select public.review_supplier_document('$DOC12','rejected','no')")" "Say why"
has "the owner rejects with a reason" "$(as $O "select public.review_supplier_document('$DOC12','rejected','Wrong neck size on the drawing')")" '"status": "rejected"'
has "a rejected document can no longer change" "$(as $O "update supplier_documents set status = 'approved' where id = '$DOC12'")" "can no longer change"
R=$(as $E "select public.record_supplier_document('$(K 13)','$BOT','component_specification','component','C-8OZ','8 oz bottle','SPEC-8-B',current_date,'2026-11-12','2027-11-12',null)")
has "a corrected copy can be recorded after a rejection" "$R" '"status": "received"'

echo " withdrawing"
DOCB=$(q "select id from supplier_documents where request_key = '$(K 2)'")
has "a switched-off administrator cannot withdraw a document someone else recorded" "$(as $I "select public.withdraw_supplier_document('$(q "select id from supplier_documents where request_key = '$(K 13)'")','Recorded by mistake')")" "Only the person who recorded it\|No such supplier document"
has "a withdrawal must say why" "$(as $E "select public.withdraw_supplier_document('$(q "select id from supplier_documents where request_key = '$(K 13)'")','x')")" "Say why"
has "the person who recorded it may withdraw it while it waits" "$(as $E "select public.withdraw_supplier_document('$(q "select id from supplier_documents where request_key = '$(K 13)'")','Recorded against the wrong bottle')")" '"status": "withdrawn"'
has "staff cannot withdraw an approved document" "$(as $E "select public.withdraw_supplier_document('$DOC1','Supplier sent a new one')")" "Only the owner or an administrator can withdraw an approved"
has "the owner can withdraw an approved document, with a reason" "$(as $O "select public.withdraw_supplier_document('$DOC5','Supplier reissued the invoice')")" '"status": "withdrawn"'
ok  "  it keeps who approved it and adds who withdrew it" "$(q "select (reviewed_by in ('$O','$A','$A2'))::text||'/'||(withdrawn_by = '$O')::text||'/'||withdraw_note from supplier_documents where id = '$DOC5'")" "true/true/Supplier reissued the invoice"
has "a withdrawn document can no longer change" "$(as $O "update supplier_documents set status = 'approved' where id = '$DOC5'")" "can no longer change"
has "nobody can delete a document (owner included)" "$(as $O "delete from supplier_documents where id = '$DOCB'")" "cannot be deleted\|permission denied"

echo " the review history"
ok  "every change is in the history" "$(q "select string_agg(event||':'||n, ',' order by event) from (select event, count(*) n from supplier_document_events where area = 'document' group by event) x")" "approved:2,corrected:1,recorded:5,rejected:1,withdrawn:2"
ok  "  each entry names who did it" "$(q "select count(*) from supplier_document_events where area = 'document' and by_user is null")" "0"
ok  "  the approval is credited to the owner, the first recording to staff" "$(q "select (select (by_user = '$O')::text from supplier_document_events where document_id = '$DOC1' and event = 'approved')||'/'||(select (by_user = '$E')::text from supplier_document_events where document_id = '$DOC1' and event = 'recorded')")" "true/true"
has "nobody can write a history entry by hand (owner included)" "$(as $O "insert into supplier_document_events (document_id, area, event) values ('$DOC1','document','approved')")" "written by the database only"
has "nobody can edit the history" "$(as $O "update supplier_document_events set note = 'changed' where document_id = '$DOC1'")" "cannot be changed\|permission denied"
has "nobody can delete the history" "$(as $O "delete from supplier_document_events where document_id = '$DOC1'")" "cannot be changed\|permission denied"
ok  "staff can read the history" "$(as $E "select count(*) > 0 from supplier_document_events where document_id = '$DOC1'")" "t"

echo " the checklist, configurable by supplier type, by the owner or an administrator"
has "staff cannot change a supplier type's checklist (function)" "$(as $E "select public.set_supplier_type_document_profiles('other', array['labels_printing'])")" "Only the owner or an administrator can change"
as $E "update supplier_type_document_profiles set profiles = '{}' where supplier_type = 'lab'" >/dev/null
ok  "  nor by direct edit (nothing changes)" "$(q "select array_to_string(profiles,'+') from supplier_type_document_profiles where supplier_type = 'lab'")" "lotion_lab"
has "staff cannot switch a document type off" "$(as $E "select public.set_supplier_document_type_active('printer_proof', false)")" "Only the owner"
has "an unknown profile is refused" "$(as $O "select public.set_supplier_type_document_profiles('other', array['jewellery'])")" "Unknown checklist profile"
has "the owner gives the 'other' type the labels and printing checklist" "$(as $O "select public.set_supplier_type_document_profiles('other', array['labels_printing'])")" '"ok": true'
has "the owner gives one supplier its own list" "$(as $O "select public.set_supplier_document_profiles('$BOT', array['bottles_pumps','labels_printing'])")" '"ok": true'
has "staff cannot change one supplier's list" "$(as $E "select public.set_supplier_document_profiles('$BOT', null)")" "Only the owner or an administrator"
has "an administrator puts one supplier's list back to its type" "$(as $A "select public.set_supplier_document_profiles('$BOT', null)")" '"ok": true'
ok  "  credited to the administrator in the history" "$(q "select count(*) from supplier_document_events where area = 'checklist' and by_user = '$A'")" "1"
ok  "the checklist changes are in the history" "$(q "select count(*) from supplier_document_events where area = 'checklist' and by_user = '$O'")" "2"
has "the owner switches a document type off" "$(as $O "select public.set_supplier_document_type_active('printer_proof', false)")" '"is_active": false'
has "  then it cannot be recorded" "$(as $E "select public.record_supplier_document('$(K 20)','$LBL','printer_proof','artwork','ART-1','Label v1',null,current_date,null,null,null)")" "no longer on the checklist"
has "a document type is never deleted" "$(as $O "delete from supplier_document_types where key = 'printer_proof'")" "never deleted\|permission denied"
as $E "update supplier_document_subjects set is_active = false where subject_ref = 'LOT-301'" >/dev/null
ok  "staff cannot switch off a batch (nothing changes)" "$(q "select is_active from supplier_document_subjects where subject_ref = 'LOT-301'")" "t"
as $O "update supplier_document_subjects set label = 'Lot 301 (Honey Milk)' where subject_ref = 'LOT-301'" >/dev/null
ok  "the owner can relabel it" "$(q "select label from supplier_document_subjects where subject_ref = 'LOT-301'")" "Lot 301 (Honey Milk)"


echo " staff and purchase orders they can see (owner decision of Nov 21)"
# TEST-ONLY row rule on this throwaway copy: lets staff read ONE purchase order,
# to prove that staff can record a document for an order they are allowed to
# see. drafts/36 itself widens nothing.
q "create policy test_only_staff_reads_pob on purchase_orders for select to authenticated using (id = '$POB')" >/dev/null
R=$(rec $E 40 $BOT packing_slip purchase $POB)
has "staff record the packing slip of an order they can see" "$R" '"status": "received"'
has "  but still not for one they cannot see" "$(rec $E 41 $LAB packing_slip purchase $POL)" "Hand the document to the owner instead"
q "drop policy test_only_staff_reads_pob on purchase_orders" >/dev/null
ok  "  (the test-only rule is gone again)" "$(as $E "select count(*) from purchase_orders")" "0"

echo " hand-off to the owner (resolved by the owner or an administrator)"
HO="select public.hand_off_supplier_document('$(K 50)','$LAB','supplier_invoice','SYN-PO-901 (printed)','INV-901','2026-11-20','Came in the box')"
R=$(as $E "$HO")
has "staff hand an invoice to the owner, with the order number as printed" "$R" '"status": "waiting"'
H1=$(q "select id from supplier_document_handoffs where request_key = '$(K 50)'")
has "the same hand-off sent again adds nothing" "$(as $E "$HO")" '"duplicate": true'
ok  "  one hand-off exists" "$(q "select count(*) from supplier_document_handoffs")" "1"
has "only purchase documents are handed off" "$(as $E "select public.hand_off_supplier_document('$(K 51)','$LAB','batch_record','x',null,current_date,null)")" "Only a purchase document"
ok  "staff see their own hand-off" "$(as $E "select count(*) from supplier_document_handoffs")" "1"
ok  "an administrator sees it too" "$(as $A "select count(*) from supplier_document_handoffs")" "1"
ok  "another staff member does not" "$(as $A2 "select count(*) from supplier_document_handoffs where handed_by <> '$A2'")" "1"
has "staff cannot link it" "$(as $E "select public.resolve_supplier_document_handoff('$H1','$POL')")" "Only the owner"
has "a switched-off administrator cannot link it" "$(as $I "select public.resolve_supplier_document_handoff('$H1','$POL')")" "Only the owner or an administrator\|No such hand-off"
as $E "update supplier_document_handoffs set status = 'dismissed', resolve_note = 'not needed here' where id = '$H1'" >/dev/null
ok  "  nor mark it resolved by direct edit (nothing changes)" "$(q "select status from supplier_document_handoffs where id = '$H1'")" "waiting"
R=$(as $A "select public.resolve_supplier_document_handoff('$H1','$POL')")
has "an administrator links it to the right order: the document is recorded" "$R" '"status": "recorded"'
D50=$(q "select document_id from supplier_document_handoffs where id = '$H1'")
ok  "  the recorded document: the lab's order, the reference, waiting for review" "$(q "select (subject_ref = '$POL')::text||'/'||reference||'/'||status||'/'||(recorded_by = '$A')::text from supplier_documents where id = '$D50'")" "true/INV-901/received/true"
has "linking again changes nothing" "$(as $O "select public.resolve_supplier_document_handoff('$H1','$POL')")" '"already_resolved": true'
ok  "  still one document from that hand-off" "$(q "select count(*) from supplier_documents where request_key = '$(K 50)'")" "1"
as $E "select public.hand_off_supplier_document('$(K 52)','$LAB','packing_slip','unreadable',null,current_date,null)" >/dev/null
H2=$(q "select id from supplier_document_handoffs where request_key = '$(K 52)'")
has "dismissing needs a reason" "$(as $O "select public.dismiss_supplier_document_handoff('$H2','no')")" "Say why"
has "the owner dismisses one with a reason" "$(as $O "select public.dismiss_supplier_document_handoff('$H2','Duplicate of the slip already recorded')")" '"status": "dismissed"'
has "a hand-off cannot be deleted" "$(as $O "delete from supplier_document_handoffs where id = '$H2'")" "cannot be deleted\|permission denied"
ok  "the history holds the hand-offs and their outcome" "$(q "select string_agg(event, ',' order by id) from supplier_document_events where event like 'hand%'")" "handed_off,handoff_recorded,handed_off,handoff_dismissed"

echo " files: attached once, approved by fingerprint"
SHA1=$(printf 'a%.0s' $(seq 1 64)); SHA2=$(printf 'b%.0s' $(seq 1 64))
R=$(rec $E 60 $LAB certificate_of_analysis batch LOT-600)
D60=$(q "select id from supplier_documents where request_key = '$(K 60)'")
has "a file path must belong to this document" "$(as $E "select public.attach_supplier_document_file('$D60','$D50/coa.pdf','$SHA1',2048,'application/pdf')")" "file_is_this_document"
has "a switched-off administrator cannot attach a file to a document staff recorded" "$(as $I "select public.attach_supplier_document_file('$D60','$D60/coa.pdf','$SHA1',2048,'application/pdf')")" "Only the person who recorded\|No such supplier document"
has "only PDF, JPEG or PNG" "$(as $E "select public.attach_supplier_document_file('$D60','$D60/coa.exe','$SHA1',2048,'application/x-msdownload')")" "file_type_check"
has "the person who recorded it attaches the file" "$(as $E "select public.attach_supplier_document_file('$D60','$D60/coa.pdf','$SHA1',2048,'application/pdf')")" '"already_attached": false'
has "  attaching the same file again changes nothing" "$(as $E "select public.attach_supplier_document_file('$D60','$D60/coa.pdf','$SHA1',2048,'application/pdf')")" '"already_attached": true'
has "  a different file cannot replace it (owner included)" "$(as $O "select public.attach_supplier_document_file('$D60','$D60/coa-v2.pdf','$SHA2',2048,'application/pdf')")" "cannot be replaced"
has "  nor can it be removed by direct edit" "$(as $O "update supplier_documents set file_path = null, file_sha256 = null, file_bytes = null, file_type = null, file_attached_at = null where id = '$D60'")" "cannot be replaced"
as $E "update supplier_documents set approved_file_sha256 = '$SHA2' where id = '$D60'" >/dev/null
ok  "nobody can type an approved fingerprint: the database puts it back" "$(q "select (approved_file_sha256 is null)::text from supplier_documents where id = '$D60'")" "true"
has "staff cannot approve it" "$(as $E "select public.review_supplier_document('$D60','approved',null)")" "Only the owner"
has "a switched-off administrator cannot approve it" "$(as $I "select public.review_supplier_document('$D60','approved',null)")" "Only the owner or an administrator"
has "an administrator approves it" "$(as $A "select public.review_supplier_document('$D60','approved',null)")" '"status": "approved"'
ok  "  the approval records the fingerprint of the exact file approved" "$(q "select (approved_file_sha256 = '$SHA1')::text from supplier_documents where id = '$D60'")" "true"
has "  a file cannot be attached once a document is approved" "$(as $O "select public.attach_supplier_document_file('$DOC1','$DOC1/coa.pdf','$SHA2',100,'application/pdf')")" "only while the document waits for review"
ok  "the file attachment is in the history" "$(q "select count(*) from supplier_document_events where document_id = '$D60' and event = 'file_attached' and detail->>'file_sha256' = '$SHA1'")" "1"

echo " after everything"
ok  "no existing table gained or lost a row" "$(q "$SNAP")" "$before"
ok  "every approved or rejected document names its reviewer" "$(q "select count(*) from supplier_documents where status in ('approved','rejected') and (reviewed_by is null or reviewed_at is null)")" "0"

echo " rollback"
ok  "rollback refuses while approved or rejected documents exist" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "approved or rejected supplier document(s) exist"
ok  "  nothing was removed" "$(q "select count(*) from supplier_documents")" "8"
setup
before=$(q "$SNAP")
ok  "fresh copy: install" "$(run "$INSTALL")" "0"
rec $E 30 $LAB certificate_of_analysis batch LOT-400 >/dev/null
ok  "  rollback with only a waiting document succeeds" "$(run "$ROLLBACK")" "0"
ok  "  tables and functions are gone" "$(q "select (to_regclass('public.supplier_documents') is null)::text||'/'||(to_regclass('public.supplier_document_events') is null)::text||'/'||(to_regclass('public.supplier_document_types') is null)::text||'/'||(to_regprocedure('public.review_supplier_document(uuid,text,text)') is null)::text||'/'||(to_regprocedure('public.supplier_documents_is_owner()') is null)::text")" "true/true/true/true/true"
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  every other table is as it was" "$(q "$SNAP")" "$before"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
