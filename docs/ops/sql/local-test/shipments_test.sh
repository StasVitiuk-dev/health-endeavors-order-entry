#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-24). Never point this at Supabase.
# Tests drafts/48 (parcels with their tracking numbers; one drop-off receipt marks
# every parcel on it; status only forward; the diary written by the database) and
# drafts/49 (rollback) on a throwaway copy, as the owner, an administrator, active
# staff, a deactivated account and a visitor. All rows are made up.
# Usage: shipments_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_shipments_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/48_DRAFT_shipments.sql"; ROLLBACK="$DIR/drafts/49_DRAFT_rollback_shipments.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000008a1; A=00000000-0000-4000-8000-0000000008a2; E=00000000-0000-4000-8000-0000000008a3; X=00000000-0000-4000-8000-0000000008a4
O1=00000000-0000-4000-8000-0000000008b1; O2=00000000-0000-4000-8000-0000000008b2; O3=00000000-0000-4000-8000-0000000008b3
T1=1Z999AA10123456784; T2=9400111899223197428490; T3=EA123456785US
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$A','$E','$X');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'800000001'),
     ('$A','admin@example.test','administrator',true,'800000002'), ('$E','staff@example.test','employee',true,'800000003'), ('$X','gone@example.test','employee',false,'800000004');
   insert into orders (id, channel, order_number, status, total) values ('$O1','manual','SYN-1001','paid',10), ('$O2','manual','SYN-1002','paid',20), ('$O3','manual','SYN-1003','paid',30);" >/dev/null
echo "Shipments (throwaway database $DB)"

echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  the tables are empty and shipments are audited" "$(q "select count(*) from shipments")/$(q "select count(*) from shipment_events")/$(q "select count(*) from pg_trigger where tgname = 'shipments_audit'")" "0/0/1"

echo " 2. a tracking number is kept with its order"
ok  "staff add a parcel (spaces and lower case are cleaned)" "$(as $E "select (add_shipment('$O1', 'ups', '1z 999 aa1 01 2345 6784'))->>'duplicate'")" "false"
ok  "  stored with who and when, status label created" "$(q "select tracking_number||'|'||status||'|'||(created_by = '$E')||'|'||source from shipments")" "$T1|label_created|true|scan"
ok  "  the diary has its first line" "$(q "select string_agg(status, ',') from shipment_events")" "label_created"
ok  "  the same number on the same order again is one parcel" "$(as $E "select (add_shipment('$O1', 'ups', '$T1'))->>'duplicate'")|$(q "select count(*) from shipments")" "true|1"
has "the same number on a DIFFERENT order is refused" "$(as $E "select add_shipment('$O2', 'ups', '$T1')")" "already on another order"
ok  "an administrator and the owner add parcels too" "$(as $A "select (add_shipment('$O2', 'usps', '$T2', 'typed'))->>'ok'")/$(as $O "select (add_shipment('$O3', 'usps', '$T3'))->>'ok'")" "true/true"
has "a deactivated account cannot" "$(as $X "select add_shipment('$O1', 'ups', '1Z999AA10123456785')")" "Only an active team member"
has "a visitor cannot run it" "$(as anon "select add_shipment('$O1', 'ups', '1Z999AA10123456785')")" "permission denied"
has "an unknown order is refused" "$(as $E "select add_shipment('00000000-0000-4000-8000-000000000000', 'ups', '1Z999AA10123456785')")" "does not exist"
has "an unknown carrier is refused" "$(as $E "select add_shipment('$O1', 'pigeon', '1Z999AA10123456785')")" "check constraint"
has "a tracking number with nothing in it is refused" "$(as $E "select add_shipment('$O1', 'ups', ' - ')")" "check constraint"

echo " 3. who can read"
ok  "the owner, an administrator and staff read parcels and the diary" "$(as $O "select count(*) from shipments")/$(as $A "select count(*) from shipments")/$(as $E "select count(*) from shipment_events")" "3/3/3"
ok  "a deactivated account reads nothing" "$(as $X "select count(*) from shipments")/$(as $X "select count(*) from shipment_events")" "0/0"
has "a visitor reads nothing" "$(as anon "select count(*) from shipments")" "permission denied"

echo " 4. one receipt marks every parcel on it"
R=$(as $E "select mark_dropped_off(array['$T1', ' 9400 1118 9922 3197 4284 90 ', 'NOTAREALNUMBER1', '$T1'])")
ok  "two known parcels marked, one number not found, the repeat counted once" "$(echo "$R" | python3 -c 'import sys,json; r=json.load(sys.stdin)["results"]; print(",".join(sorted(x["result"] for x in r)))')" "marked,marked,not_found"
ok  "  status, time and diary" "$(q "select string_agg(status||':'||(dropped_off_at is not null), ',' order by tracking_number) from shipments where tracking_number in ('$T1','$T2')")|$(q "select count(*) from shipment_events where status = 'dropped_off'")" "dropped_off:true,dropped_off:true|2"
ok  "  the diary names who marked them" "$(q "select bool_and(recorded_by = '$E') from shipment_events where status = 'dropped_off'")" "t"
R2=$(as $E "select mark_dropped_off(array['$T1', '$T2'])")
ok  "pressing it twice changes nothing" "$(echo "$R2" | python3 -c 'import sys,json; r=json.load(sys.stdin)["results"]; print(",".join(x["result"] for x in r))')|$(q "select count(*) from shipment_events where status = 'dropped_off'")" "already,already|2"
has "no numbers at all" "$(as $E "select mark_dropped_off(array[' ', ''])")" "No tracking numbers"
has "more than 500 at once" "$(as $E "select mark_dropped_off(array(select 'SYN' || lpad(g::text, 9, '0') from generate_series(1, 501) g))")" "At most 500"
has "a deactivated account cannot mark" "$(as $X "select mark_dropped_off(array['$T3'])")" "Only an active team member"
ok  "  (the third parcel is untouched)" "$(q "select status from shipments where tracking_number = '$T3'")" "label_created"

echo " 5. status only forward; a parcel never changes order or number; nothing is deleted"
has "back from dropped off to label created" "$(as $O "update shipments set status = 'label_created' where tracking_number = '$T1'")" "cannot become"
ok  "forward to delivered is fine, with its time" "$(as $O "update shipments set status = 'delivered' where tracking_number = '$T1' returning (delivered_at is not null)")" "t"
has "after delivered, nothing" "$(as $O "update shipments set status = 'in_transit' where tracking_number = '$T1'")" "cannot become"
has "moving a parcel to another order" "$(as $O "update shipments set order_id = '$O2' where tracking_number = '$T1'")" "cannot be changed"
has "changing the tracking number" "$(as $O "update shipments set tracking_number = 'ABCDEFGH1' where tracking_number = '$T1'")" "cannot be changed"
ok  "cancelling a parcel that was never handed over" "$(as $E "update shipments set status = 'cancelled' where tracking_number = '$T3' returning status")" "cancelled"
R3=$(as $E "select mark_dropped_off(array['$T3'])")
ok  "  a cancelled parcel is not marked dropped off" "$(echo "$R3" | python3 -c 'import sys,json; r=json.load(sys.stdin)["results"]; print(r[0]["result"]+":"+r[0]["status"])')" "not_marked:cancelled"
has "deleting a parcel, even the owner" "$(as $O "delete from shipments where tracking_number = '$T1'")" "stays on the record\|permission denied"
has "writing the diary by hand" "$(as $O "insert into shipment_events (shipment_id, status) select id, 'delivered' from shipments limit 1")" "written by the database only"
has "changing the diary" "$(as $O "update shipment_events set status = 'x'")" "permission denied\|never changed"
has "deleting the diary" "$(as $O "delete from shipment_events")" "permission denied\|never changed"
ok  "  the full diary of the first parcel" "$(q "select string_agg(e.status, ',' order by e.id) from shipment_events e join shipments s on s.id = e.shipment_id where s.tracking_number = '$T1'")" "label_created,dropped_off,delivered"
ok  "every change is in the audit log" "$(q "select count(*) > 0 from audit_log where table_name = 'shipments'")" "t"

echo " 6. two people marking the same receipt at the same moment"
q "insert into orders (id, channel, order_number, status, total) values ('00000000-0000-4000-8000-0000000008c1','manual','SYN-2001','paid',5)" >/dev/null
as $E "select add_shipment('00000000-0000-4000-8000-0000000008c1', 'ups', '1Z999AA10123456785')" >/dev/null
( as $E "select mark_dropped_off(array['1Z999AA10123456785'])" >/dev/null ) &
( as $O "select mark_dropped_off(array['1Z999AA10123456785'])" >/dev/null ) &
wait
ok  "  marked once, one diary line" "$(q "select count(*) from shipment_events e join shipments s on s.id = e.shipment_id where s.tracking_number = '1Z999AA10123456785' and e.status = 'dropped_off'")" "1"

echo " 7. rollback"
ok  "refuses while parcels are recorded" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "parcel(s) are recorded"
ok  "  nothing was removed" "$(q "select to_regclass('public.shipments') is not null")" "t"
ok  "with written authorization in the session it removes everything" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_shipments = 'yes, delete the parcels';" -f "$ROLLBACK" >"$OUTF" 2>&1; echo $?)" "0"
ok  "  gone: tables and functions" "$(q "select (to_regclass('public.shipments') is null) and (to_regclass('public.shipment_events') is null) and to_regprocedure('public.mark_dropped_off(text[])') is null")" "t"
ok  "  orders untouched" "$(q "select count(*) from orders where order_number like 'SYN-%'")" "4"
ok  "rollback is safe to run twice" "$(run "$ROLLBACK")" "0"
ok  "install again after rollback" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
