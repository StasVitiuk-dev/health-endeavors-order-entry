#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-24). Never point this at Supabase.
# Tests drafts/48 (parcels with their tracking numbers in the draft's OWN tables; one
# drop-off receipt marks every parcel on it; a label known only to the Shipping/
# Tracking agent's `shipments` table is looked up there, which is never changed;
# status only forward; the diary written by the database) and drafts/49 (rollback)
# on a throwaway copy, as the owner, an administrator, active staff, a deactivated
# account and a visitor. All rows are made up.
# Usage: order_parcels_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_order_parcels_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/48_DRAFT_order_parcels.sql"; ROLLBACK="$DIR/drafts/49_DRAFT_rollback_order_parcels.sql"
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
echo "Parcels and drop-off receipts (throwaway database $DB)"

echo " 0. beside the Shipping/Tracking agent's own shipments table, never over it"
ok  "without the agent's table: refused, nothing changed" "$(run "$INSTALL")/$(q "select to_regclass('public.order_parcels') is null")" "3/t"
has "  and says why" "$(cat "$OUTF")" "table public.shipments (the Shipping/Tracking agent's, only read here) is missing"
# the agent's table as production has it (read-only shape check of Nov 23)
q "create table public.shipments (
     id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
     external_fulfillment_id text, carrier text, tracking_number text, tracking_url text,
     shipment_status text not null default 'pending', shipped_at timestamptz, delivered_at timestamptz, last_status_at timestamptz,
     created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
     unique (order_id, external_fulfillment_id));
   alter table public.shipments enable row level security;
   grant select, insert, update, delete on public.shipments to authenticated;
   create policy \"Staff can view shipments\" on public.shipments for select to authenticated using (public.is_active_staff() or public.is_owner_or_admin());
   create policy \"Staff can insert shipments\" on public.shipments for insert to authenticated with check (public.is_active_staff() or public.is_owner_or_admin());
   create policy \"Staff can update shipments\" on public.shipments for update to authenticated using (public.is_active_staff() or public.is_owner_or_admin());
   create policy \"Owner can delete shipments\" on public.shipments for delete to authenticated using (public.is_owner_or_admin());" >/dev/null
SHAPE() { q "select (select string_agg(column_name||':'||data_type||':'||is_nullable, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='shipments')
   ||'|'||(select count(*) from pg_policies where schemaname='public' and tablename='shipments')
   ||'|'||(select count(*) from pg_trigger where tgrelid='public.shipments'::regclass and not tgisinternal)
   ||'|'||(select count(*) from pg_constraint where conrelid='public.shipments'::regclass or confrelid='public.shipments'::regclass)
   ||'|'||(select coalesce(obj_description('public.shipments'::regclass, 'pg_class'), ''))"; }
BEFORE="$(SHAPE)"
q "alter table public.shipments rename column tracking_number to tracking_no" >/dev/null
ok  "the agent's table with a different shape: refused" "$(run "$INSTALL")" "3"
has "  and names the missing column" "$(cat "$OUTF")" "has no column tracking_number"
q "alter table public.shipments rename column tracking_no to tracking_number" >/dev/null
q "create table public.order_parcels (id int)" >/dev/null
ok  "an order_parcels table that is not this draft's: refused" "$(run "$INSTALL")" "3"
has "  and says why" "$(cat "$OUTF")" "already exists that this draft did not create"
q "drop table public.order_parcels; create function public.add_order_parcel(uuid, text, text, text) returns int language sql as 'select 1'" >/dev/null
ok  "a function with this draft's name that is not its own: refused" "$(run "$INSTALL")" "3"
q "drop function public.add_order_parcel(uuid, text, text, text)" >/dev/null

echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  the agent's shipments table is exactly as before: same columns, rules, triggers, links" "$(SHAPE)" "$BEFORE"
ok  "  the tables are empty and parcels are audited" "$(q "select count(*) from order_parcels")/$(q "select count(*) from order_parcel_events")/$(q "select count(*) from pg_trigger where tgname = 'order_parcels_audit'")" "0/0/1"

echo " 2. a tracking number is kept with its order"
ok  "staff add a parcel (spaces and lower case are cleaned)" "$(as $E "select (add_order_parcel('$O1', 'ups', '1z 999 aa1 01 2345 6784'))->>'duplicate'")" "false"
ok  "  stored with who and when, status label created" "$(q "select tracking_number||'|'||status||'|'||(created_by = '$E')||'|'||source from order_parcels")" "$T1|label_created|true|scan"
ok  "  the diary has its first line" "$(q "select string_agg(status, ',') from order_parcel_events")" "label_created"
ok  "  the same number on the same order again is one parcel" "$(as $E "select (add_order_parcel('$O1', 'ups', '$T1'))->>'duplicate'")|$(q "select count(*) from order_parcels")" "true|1"
has "the same number on a DIFFERENT order is refused" "$(as $E "select add_order_parcel('$O2', 'ups', '$T1')")" "already on another order"
ok  "an administrator and the owner add parcels too" "$(as $A "select (add_order_parcel('$O2', 'usps', '$T2', 'typed'))->>'ok'")/$(as $O "select (add_order_parcel('$O3', 'usps', '$T3'))->>'ok'")" "true/true"
has "a deactivated account cannot" "$(as $X "select add_order_parcel('$O1', 'ups', '1Z999AA10123456785')")" "Only an active team member"
has "a visitor cannot run it" "$(as anon "select add_order_parcel('$O1', 'ups', '1Z999AA10123456785')")" "permission denied"
has "an unknown order is refused" "$(as $E "select add_order_parcel('00000000-0000-4000-8000-000000000000', 'ups', '1Z999AA10123456785')")" "does not exist"
has "an unknown carrier is refused" "$(as $E "select add_order_parcel('$O1', 'pigeon', '1Z999AA10123456785')")" "check constraint"
has "a tracking number with nothing in it is refused" "$(as $E "select add_order_parcel('$O1', 'ups', ' - ')")" "check constraint"

echo " 3. who can read"
ok  "the owner, an administrator and staff read parcels and the diary" "$(as $O "select count(*) from order_parcels")/$(as $A "select count(*) from order_parcels")/$(as $E "select count(*) from order_parcel_events")" "3/3/3"
ok  "a deactivated account reads nothing" "$(as $X "select count(*) from order_parcels")/$(as $X "select count(*) from order_parcel_events")" "0/0"
has "a visitor reads nothing" "$(as anon "select count(*) from order_parcels")" "permission denied"

echo " 4. one receipt marks every parcel on it"
R=$(as $E "select mark_parcels_dropped_off(array['$T1', ' 9400 1118 9922 3197 4284 90 ', 'NOTAREALNUMBER1', '$T1'])")
ok  "two known parcels marked, one number not found, the repeat counted once" "$(echo "$R" | python3 -c 'import sys,json; r=json.load(sys.stdin)["results"]; print(",".join(sorted(x["result"] for x in r)))')" "marked,marked,not_found"
ok  "  status, time and diary" "$(q "select string_agg(status||':'||(dropped_off_at is not null), ',' order by tracking_number) from order_parcels where tracking_number in ('$T1','$T2')")|$(q "select count(*) from order_parcel_events where status = 'dropped_off'")" "dropped_off:true,dropped_off:true|2"
ok  "  the diary names who marked them" "$(q "select bool_and(recorded_by = '$E') from order_parcel_events where status = 'dropped_off'")" "t"
R2=$(as $E "select mark_parcels_dropped_off(array['$T1', '$T2'])")
ok  "pressing it twice changes nothing" "$(echo "$R2" | python3 -c 'import sys,json; r=json.load(sys.stdin)["results"]; print(",".join(x["result"] for x in r))')|$(q "select count(*) from order_parcel_events where status = 'dropped_off'")" "already,already|2"
has "no numbers at all" "$(as $E "select mark_parcels_dropped_off(array[' ', ''])")" "No tracking numbers"
has "more than 500 at once" "$(as $E "select mark_parcels_dropped_off(array(select 'SYN' || lpad(g::text, 9, '0') from generate_series(1, 501) g))")" "At most 500"
has "a deactivated account cannot mark" "$(as $X "select mark_parcels_dropped_off(array['$T3'])")" "Only an active team member"
ok  "  (the third parcel is untouched)" "$(q "select status from order_parcels where tracking_number = '$T3'")" "label_created"

echo " 5. status only forward; a parcel never changes order or number; nothing is deleted"
has "back from dropped off to label created" "$(as $O "update order_parcels set status = 'label_created' where tracking_number = '$T1'")" "cannot become"
ok  "forward to delivered is fine, with its time" "$(as $O "update order_parcels set status = 'delivered' where tracking_number = '$T1' returning (delivered_at is not null)")" "t"
has "after delivered, nothing" "$(as $O "update order_parcels set status = 'in_transit' where tracking_number = '$T1'")" "cannot become"
has "moving a parcel to another order" "$(as $O "update order_parcels set order_id = '$O2' where tracking_number = '$T1'")" "cannot be changed"
has "changing the tracking number" "$(as $O "update order_parcels set tracking_number = 'ABCDEFGH1' where tracking_number = '$T1'")" "cannot be changed"
ok  "cancelling a parcel that was never handed over" "$(as $E "update order_parcels set status = 'cancelled' where tracking_number = '$T3' returning status")" "cancelled"
R3=$(as $E "select mark_parcels_dropped_off(array['$T3'])")
ok  "  a cancelled parcel is not marked dropped off" "$(echo "$R3" | python3 -c 'import sys,json; r=json.load(sys.stdin)["results"]; print(r[0]["result"]+":"+r[0]["status"])')" "not_marked:cancelled"
has "deleting a parcel, even the owner" "$(as $O "delete from order_parcels where tracking_number = '$T1'")" "stays on the record\|permission denied"
has "writing the diary by hand" "$(as $O "insert into order_parcel_events (parcel_id, status) select id, 'delivered' from order_parcels limit 1")" "written by the database only"
has "changing the diary" "$(as $O "update order_parcel_events set status = 'x'")" "permission denied\|never changed"
has "deleting the diary" "$(as $O "delete from order_parcel_events")" "permission denied\|never changed"
ok  "  the full diary of the first parcel" "$(q "select string_agg(e.status, ',' order by e.id) from order_parcel_events e join order_parcels s on s.id = e.parcel_id where s.tracking_number = '$T1'")" "label_created,dropped_off,delivered"
ok  "every change is in the audit log" "$(q "select count(*) > 0 from audit_log where table_name = 'order_parcels'")" "t"

echo " 5b. a label the Shipping/Tracking agent already knows (bought in Shopify) is found there"
q "insert into orders (id, channel, order_number, status, total) values ('00000000-0000-4000-8000-0000000008d1','shopify','SYN-3001','paid',7), ('00000000-0000-4000-8000-0000000008d2','shopify','SYN-3002','paid',8);
   insert into shipments (order_id, external_fulfillment_id, carrier, tracking_number) values
     ('00000000-0000-4000-8000-0000000008d1', 'SYN-F1', 'USPS', '9400 1118 9922 3197 4285 06'),
     ('00000000-0000-4000-8000-0000000008d1', 'SYN-F1b', 'USPS', '9400111899223197428506'),
     ('00000000-0000-4000-8000-0000000008d1', 'SYN-F2', 'UPS Ground', '1Z999AA10123456999'),
     ('00000000-0000-4000-8000-0000000008d2', 'SYN-F3', 'UPS Ground', '1Z999AA10123456999'),
     ('00000000-0000-4000-8000-0000000008d2', 'SYN-F4', null, null),
     ('00000000-0000-4000-8000-0000000008d2', 'SYN-F5', 'Some Courier', 'SYNCOURIER0001');" >/dev/null
RA=$(as $E "select mark_parcels_dropped_off(array['9400111899223197428506', '1Z999AA10123456999', 'SYNCOURIER0001'])")
ok  "found in the agent's table and marked; one stored twice for the same order is one parcel; one on two orders is not marked" "$(echo "$RA" | python3 -c 'import sys,json; r=json.load(sys.stdin)["results"]; print(",".join(x["tracking"][:4]+":"+x["result"] for x in r))')" "1Z99:ambiguous,9400:marked,SYNC:marked"
ok  "  kept here with its order, the carrier in this draft's words, source agent" "$(q "select string_agg(carrier||':'||status||':'||source||':'||(order_id = (select id from orders where order_number = case when tracking_number like '94%' then 'SYN-3001' else 'SYN-3002' end)), ',' order by tracking_number) from order_parcels where source = 'agent'")" "usps:dropped_off:agent:true,other:dropped_off:agent:true"
ok  "  its diary has both lines, by the person who marked it" "$(q "select string_agg(e.status, ',' order by e.id)||'|'||bool_and(e.recorded_by = '$E') from order_parcel_events e join order_parcels s on s.id = e.parcel_id where s.tracking_number = '9400111899223197428506'")" "label_created,dropped_off|true"
ok  "  pressing it again changes nothing" "$(as $E "select mark_parcels_dropped_off(array['9400111899223197428506'])" | python3 -c 'import sys,json; r=json.load(sys.stdin)["results"]; print(r[0]["result"])')|$(q "select count(*) from order_parcels where tracking_number = '9400111899223197428506'")" "already|1"
ok  "  the agent's rows were only read: same rows, same status, same times" "$(q "select count(*)||'/'||count(*) filter (where shipment_status = 'pending')||'/'||count(*) filter (where updated_at = created_at) from shipments")" "6/6/6"
ok  "  the agent can still change and delete its own rows (no link holds them)" "$(q "update shipments set shipment_status = 'in_transit' where external_fulfillment_id = 'SYN-F1' returning shipment_status")/$(q "delete from shipments where external_fulfillment_id = 'SYN-F1b' returning 1")/$(q "select count(*) from order_parcels where tracking_number = '9400111899223197428506'")" "in_transit/1/1"
ok  "  a deactivated account finds nothing there either" "$(as $X "select mark_parcels_dropped_off(array['SYNCOURIER0001'])" | grep -c 'Only an active team member')" "1"
ok  "  and the agent's table is still exactly its own shape" "$(SHAPE)" "$BEFORE"

echo " 6. two people marking the same receipt at the same moment"
q "insert into orders (id, channel, order_number, status, total) values ('00000000-0000-4000-8000-0000000008c1','manual','SYN-2001','paid',5)" >/dev/null
as $E "select add_order_parcel('00000000-0000-4000-8000-0000000008c1', 'ups', '1Z999AA10123456785')" >/dev/null
( as $E "select mark_parcels_dropped_off(array['1Z999AA10123456785'])" >/dev/null ) &
( as $O "select mark_parcels_dropped_off(array['1Z999AA10123456785'])" >/dev/null ) &
wait
ok  "  marked once, one diary line" "$(q "select count(*) from order_parcel_events e join order_parcels s on s.id = e.parcel_id where s.tracking_number = '1Z999AA10123456785' and e.status = 'dropped_off'")" "1"

echo " 7. rollback"
ok  "refuses while parcels are recorded" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "parcel(s) are recorded"
ok  "  nothing was removed" "$(q "select to_regclass('public.order_parcels') is not null")" "t"
ok  "with written authorization in the session it removes everything" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_order_parcels = 'yes, delete the parcels';" -f "$ROLLBACK" >"$OUTF" 2>&1; echo $?)" "0"
ok  "  gone: tables and functions" "$(q "select (to_regclass('public.order_parcels') is null) and (to_regclass('public.order_parcel_events') is null) and to_regprocedure('public.mark_parcels_dropped_off(text[])') is null")" "t"
ok  "  orders untouched" "$(q "select count(*) from orders where order_number like 'SYN-%'")" "6"
ok  "  the agent's shipments table and its rows untouched" "$(SHAPE)/$(q "select count(*) from shipments")" "$BEFORE/5"
ok  "rollback is safe to run twice" "$(run "$ROLLBACK")" "0"
ok  "install again after rollback" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "TOTAL: $pass passed, $fail failed"
[ "$fail" = 0 ]
