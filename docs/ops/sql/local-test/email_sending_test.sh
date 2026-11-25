#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-24). Never point this at Supabase.
# Tests drafts/56 (email sending records: approved campaigns, an outbox, the
# do-not-email list, the slow start, the 90-day rest for stores, the automatic
# stop, who may do what, audit, refuses foreign tables) and drafts/57 (rollback)
# on a throwaway copy, as the owner, an administrator, staff, a visitor and the
# sending program (no signed-in person). NOTHING IS SENT: there is no sending
# program here. Every address is made up.
# Usage: email_sending_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_email_sending_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/56_DRAFT_email_sending.sql"; ROLLBACK="$DIR/drafts/57_DRAFT_rollback_email_sending.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000009a1; A=00000000-0000-4000-8000-0000000009a2; E=00000000-0000-4000-8000-0000000009a3
SUBJ='A body-care line for your shop'
BODY='Hello, we make small-batch body lotion and would love to send a sample to your shop. Reply any time.'
ADDR='1 SYNTHETIC Street, Testville, TS 00000'
# n made-up recipients: list <prefix> <from> <to>
list() { q "select jsonb_agg(jsonb_build_object('email', '$1' || i || '@example.test', 'name', 'SYNTHETIC ' || i)) from generate_series($2, $3) i"; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$A','$E');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'900000001'),
     ('$A','admin@example.test','administrator',true,'900000002'), ('$E','staff@example.test','employee',true,'900000003');" >/dev/null
echo "Email sending records (throwaway database $DB). Nothing is sent."

echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  three empty tables, each marked" "$(q "select (select count(*) from email_campaigns) + (select count(*) from email_outbox) + (select count(*) from email_suppressions)")/$(q "select count(*) from pg_class where relname in ('email_campaigns','email_outbox','email_suppressions') and obj_description(oid, 'pg_class') like 'Health Endeavors drafts/56:%'")" "0/3"
ok  "  before anything is queued: 20 on a working day, none on a weekend" "$(q "select email_daily_cap(date '2026-11-23') || '|' || email_daily_cap(date '2026-11-28') || '|' || email_daily_cap(date '2026-11-29') || '|' || coalesce(email_daily_cap(null)::text, 'null')")" "20|0|0|0"

echo " 2. only the owner approves a wording"
C1=$(as $O "select (approve_email_campaign('store', 'First stores', '$SUBJ', '$BODY', '$ADDR'))->>'id'")
has "the owner approves a campaign for stores" "$C1" "^[0-9a-f-]\{36\}$"
ok  "  approved, by the owner, not sent" "$(q "select status || '|' || (approved_by = '$O') || '|' || kind from email_campaigns where id = '$C1'")" "approved|true|store"
has "an administrator cannot" "$(as $A "select approve_email_campaign('store', 'Sneaky', '$SUBJ', '$BODY', '$ADDR')")" "Only the owner"
has "staff cannot" "$(as $E "select approve_email_campaign('store', 'Sneaky', '$SUBJ', '$BODY', '$ADDR')")" "Only the owner"
has "staff cannot insert directly either" "$(as $E "insert into email_campaigns (kind, name, subject, body, postal_address) values ('store', 'Sneaky', '$SUBJ', '$BODY', '$ADDR')")" "Only the owner\|row-level security"
has "a visitor cannot" "$(as anon "select approve_email_campaign('store', 'Sneaky', '$SUBJ', '$BODY', '$ADDR')")" "permission denied"
has "the database owner without a signed-in person cannot either" "$(q "insert into email_campaigns (kind, name, subject, body, postal_address) values ('store', 'Nobody', '$SUBJ', '$BODY', '$ADDR')")" "Only the owner"
has "a wording with a health claim is refused" "$(as $O "select approve_email_campaign('store', 'Claims', '$SUBJ', 'Hello, our lotion cures dry skin and heals eczema for every one of your customers.', '$ADDR')")" "health or medical claim"
has "  also in the subject" "$(as $O "select approve_email_campaign('store', 'Claims', 'A lotion that prevents ageing', '$BODY', '$ADDR')")" "health or medical claim"
has "an email that is too short" "$(as $O "select approve_email_campaign('store', 'Short', '$SUBJ', 'Too short.', '$ADDR')")" "check constraint"
has "no postal address" "$(as $O "select approve_email_campaign('store', 'No address', '$SUBJ', '$BODY', '')")" "check constraint"
has "an unknown kind" "$(as $O "select approve_email_campaign('everyone', 'Odd', '$SUBJ', '$BODY', '$ADDR')")" "check constraint"
ok  "  (one campaign, as before)" "$(q "select count(*) from email_campaigns")" "1"

echo " 3. an approved wording never changes"
has "the subject" "$(as $O "update email_campaigns set subject = 'A different subject line' where id = '$C1'")" "cannot be changed"
has "the email" "$(as $O "update email_campaigns set body = body || ' One more sentence for you all.' where id = '$C1'")" "cannot be changed"
has "who approved it" "$(as $O "update email_campaigns set approved_by = '$A' where id = '$C1'")" "cannot be changed"
has "it cannot be deleted (no delete permission)" "$(as $O "delete from email_campaigns where id = '$C1'")" "permission denied"
has "  and the guard refuses it even for the table owner" "$(q "delete from email_campaigns")" "stays on the record"

echo " 4. the owner queues who it goes to; the slow start"
R=$(as $O "select queue_campaign_emails('$C1', '[{\"email\": \" Shop1@Example.test \", \"name\": \"SYNTHETIC One\", \"fields\": {\"store\": \"SYNTHETIC One\", \"city\": \"Testville\"}}, {\"email\": \"not an email\"}, {\"email\": \"shop1@example.test\"}, 7, {\"email\": \"shop2@example.test\"}]')")
ok  "two usable addresses are queued, three entries are left out with the reason" "$(echo "$R" | psql "${CONN[@]}" -d "$DB" -qtAX -c "select (j->>'queued') || '|' || (select string_agg(x->>'why', ';') from jsonb_array_elements(j->'skipped') x) || '|' || (j->>'sent') from (select '$R'::jsonb j) t")" "2|no usable email address;already in this campaign;no usable email address|false"
ok  "  stored in lower case, queued, on a working day from today on, with the fill-ins" "$(q "select to_email || '|' || status || '|' || (send_on >= current_date) || '|' || (extract(isodow from send_on) < 6) || '|' || (fields->>'city') from email_outbox where to_email = 'shop1@example.test'")" "shop1@example.test|queued|true|true|Testville"
D1=$(q "select min(send_on) from email_outbox")
ok  "25 more: the first day takes 20 in all, the rest go to the next working day" "$(as $O "select (queue_campaign_emails('$C1', '$(list store 1 25)'))->>'queued'")/$(q "select string_agg(n::text, ',' order by d) from (select send_on d, count(*) n from email_outbox group by send_on) t")" "25/20,7"
ok  "  the second day is the next working day" "$(q "select (max(send_on) - min(send_on)) in (1, 3) and extract(isodow from max(send_on)) < 6 from email_outbox")" "t"
has "an administrator cannot queue" "$(as $A "select queue_campaign_emails('$C1', '$(list other 1 1)')")" "Only the owner"
has "staff cannot queue" "$(as $E "select queue_campaign_emails('$C1', '$(list other 1 1)')")" "Only the owner"
has "more than 500 at a time is refused" "$(as $O "select queue_campaign_emails('$C1', '$(list big 1 501)')")" "At most 500"
has "something that is not a list is refused" "$(as $O "select queue_campaign_emails('$C1', '{\"email\": \"x@example.test\"}')")" "must be a list"
has "an unknown campaign" "$(as $O "select queue_campaign_emails('00000000-0000-4000-8000-000000000000', '[]')")" "not found"
ok  "  (27 queued, as before)" "$(q "select count(*) from email_outbox")" "27"

echo " 5. a store is not written to again within 90 days; a customer campaign is separate"
C2=$(as $O "select (approve_email_campaign('store', 'Second stores', '$SUBJ', '$BODY', '$ADDR'))->>'id'")
ok  "the same store in a second store campaign is left out" "$(as $O "select (j->>'queued') || '|' || (j->'skipped'->0->>'why') from (select queue_campaign_emails('$C2', '[{\"email\": \"shop1@example.test\"}]') j) t")" "0|written to in the last 90 days"
C3=$(as $O "select (approve_email_campaign('customer', 'Welcome', 'Thank you for your first order', 'Hi {name}, thank you for ordering from our small shop. Reply any time you have a question.', '$ADDR'))->>'id'")
ok  "the same address in a customer campaign is allowed" "$(as $O "select (queue_campaign_emails('$C3', '[{\"email\": \"shop1@example.test\", \"name\": \"SYNTHETIC One\", \"fields\": {\"name\": \"Ann\"}}]'))->>'queued'")" "1"

echo " 6. the do-not-email list"
ok  "an administrator adds an address; its queued emails are skipped" "$(as $A "select (j->>'added') || '|' || (j->>'skipped') from (select add_email_suppression(' Shop2@Example.test ', 'unsubscribed', 'replied no thanks') j) t")" "true|1"
ok  "  skipped with the reason" "$(q "select status || '|' || skip_reason from email_outbox where to_email = 'shop2@example.test'")" "skipped|on the do-not-email list"
ok  "adding it again changes nothing" "$(as $O "select (add_email_suppression('shop2@example.test'))->>'added'")/$(q "select count(*) from email_suppressions")" "false/1"
ok  "it is never queued again, in any campaign" "$(as $O "select j->'skipped'->0->>'why' from (select queue_campaign_emails('$C3', '[{\"email\": \"shop2@example.test\"}]') j) t")" "on the do-not-email list"
has "staff cannot add to it" "$(as $E "select add_email_suppression('x@example.test')")" "Only the owner and administrators"
has "an address that is not one is refused" "$(as $O "select add_email_suppression('not an email')")" "check constraint"
has "an unknown reason is refused" "$(as $O "select add_email_suppression('y@example.test', 'bored')")" "check constraint"
has "nobody takes an address off it from the dashboard (no permission)" "$(as $O "delete from email_suppressions")" "permission denied"
has "  and the guard refuses it even for the table owner" "$(q "delete from email_suppressions")" "stays on the do-not-email list"
has "  nor change it" "$(q "update email_suppressions set reason = 'owner'")" "stays on the do-not-email list"

echo " 7. a person can only skip a queued email; who it is for never changes"
ID1=$(q "select id from email_outbox where to_email = 'store1@example.test'")
has "the owner cannot mark an email sent" "$(as $O "update email_outbox set status = 'sent' where id = '$ID1'")" "Only the sending program"
has "nor call the sending program's functions" "$(as $O "select record_email_result('$ID1', 'sent')")" "permission denied"
has "  or be handed emails" "$(as $O "select count(*) from next_emails_to_send(5)")" "permission denied"
has "the address cannot change" "$(as $O "update email_outbox set to_email = 'other@example.test' where id = '$ID1'")" "cannot change"
has "the day cannot change" "$(q "update email_outbox set send_on = send_on + 7 where id = '$ID1'")" "cannot change"
has "an email cannot be deleted" "$(q "delete from email_outbox where id = '$ID1'")" "stays on the record"
ok  "an administrator skips a queued email" "$(as $A "update email_outbox set status = 'skipped', skip_reason = 'wrong shop' where to_email = 'store25@example.test' returning status")" "skipped"
has "  a skipped email cannot be queued again" "$(as $O "update email_outbox set status = 'queued' where to_email = 'store25@example.test'")" "cannot become"
ok  "staff see and change nothing" "$(as $E "select (select count(*) from email_outbox) + (select count(*) from email_campaigns) + (select count(*) from email_suppressions)")/$(as $E "update email_outbox set status = 'skipped' returning 1" | wc -l | tr -d ' ')" "0/0"
has "a visitor reads nothing" "$(as anon "select count(*) from email_outbox")" "permission denied"
ok  "the owner and an administrator read everything" "$(as $O "select count(*) from email_outbox")/$(as $A "select count(*) from email_campaigns")/$(as $A "select count(*) from email_suppressions")" "28/3/1"

echo " 8. the sending program (no signed-in person): results, bounces, the do-not-email list by itself"
ok  "it records an email as sent" "$(q "select (record_email_result('$ID1', 'sent', 'prov-0001'))->>'status'")/$(q "select status || '|' || provider_id || '|' || (sent_at is not null) from email_outbox where id = '$ID1'")" "sent/sent|prov-0001|true"
has "a queued email cannot become bounced without having been sent" "$(q "select record_email_result((select id from email_outbox where to_email = 'store2@example.test'), 'bounced')")" "cannot become"
has "an unknown result is refused" "$(q "select record_email_result('$ID1', 'opened')")" "must be sent, failed, bounced or complaint"
ok  "the same address is also queued in the customer campaign" "$(as $O "select (queue_campaign_emails('$C3', '[{\"email\": \"store1@example.test\"}]'))->>'queued'")" "1"
ok  "the sent email comes back: it is marked bounced" "$(q "select (record_email_result('$ID1', 'bounced', null, 'mailbox not found'))->>'status'")" "bounced"
ok  "  the address is on the do-not-email list by itself" "$(q "select reason from email_suppressions where email = 'store1@example.test'")" "bounced"
ok  "  and its other queued email is skipped" "$(q "select status || '|' || skip_reason from email_outbox where to_email = 'store1@example.test' and campaign_id = '$C3'")" "skipped|on the do-not-email list"
ok  "  one bounce does not stop the campaign" "$(q "select status from email_campaigns where id = '$C1'")" "approved"

echo " 9. the campaign stops by itself"
q "select record_email_result(id, 'sent') from email_outbox where campaign_id = '$C1' and to_email in ('store2@example.test', 'store3@example.test')" >/dev/null
q "select record_email_result(id, 'complaint') from email_outbox where campaign_id = '$C1' and to_email = 'store2@example.test'" >/dev/null
ok  "one spam complaint: still running" "$(q "select status from email_campaigns where id = '$C1'")" "approved"
q "select record_email_result(id, 'complaint') from email_outbox where campaign_id = '$C1' and to_email = 'store3@example.test'" >/dev/null
ok  "two spam complaints: stopped, with the reason" "$(q "select status || '|' || stop_reason from email_campaigns where id = '$C1'")" "stopped|Stopped by itself: 2 people marked the email as spam."
ok  "  what was still queued in it is skipped" "$(q "select count(*) filter (where status = 'queued') || '|' || (count(*) filter (where skip_reason = 'the campaign stopped') > 0) from email_outbox where campaign_id = '$C1'")" "0|true"
ok  "  both addresses are on the do-not-email list" "$(q "select count(*) from email_suppressions where reason = 'complaint'")" "2"
has "a stopped campaign cannot be started again" "$(as $O "select set_email_campaign_status('$C1', 'approved')")" "cannot be started again"
has "  and nothing can be queued for it" "$(as $O "select queue_campaign_emails('$C1', '$(list late 1 1)')")" "is stopped"
C4=$(as $O "select (approve_email_campaign('customer', 'Bounce test', 'Something new from us', 'Hi {name}, there is something new in our shop. Have a look when you have a minute.', '$ADDR'))->>'id'")
as $O "select queue_campaign_emails('$C4', '$(list cust 1 30)')" >/dev/null
q "select record_email_result(id, 'sent') from email_outbox where campaign_id = '$C4' and to_email in (select 'cust' || i || '@example.test' from generate_series(1, 20) i)" >/dev/null
q "select record_email_result(id, 'bounced') from email_outbox where campaign_id = '$C4' and to_email = 'cust1@example.test'" >/dev/null
ok  "1 of 20 came back (5%): still running" "$(q "select status from email_campaigns where id = '$C4'")" "approved"
q "select record_email_result(id, 'bounced') from email_outbox where campaign_id = '$C4' and to_email = 'cust2@example.test'" >/dev/null
ok  "2 of 20 came back (10%): stopped, with the reason" "$(q "select status || '|' || stop_reason from email_campaigns where id = '$C4'")" "stopped|Stopped by itself: 2 of 20 emails came back (more than 5%)."
ok  "  its 10 queued emails are skipped" "$(q "select count(*) from email_outbox where campaign_id = '$C4' and status = 'skipped' and skip_reason = 'the campaign stopped'")" "10"

echo "10. pause, resume, stop by the owner; what the sending program is handed"
MON=$(q "select (current_date - (extract(isodow from current_date)::int - 1) - 7)::date")     # last week's Monday: due
as $O "insert into email_outbox (campaign_id, to_email, send_on) select '$C3', 'due' || i || '@example.test', date '$MON' from generate_series(1, 6) i" >/dev/null
WD=$(q "select extract(isodow from current_date) < 6")
ok  "it is handed the due emails of running campaigns, never more than asked (none on a weekend)" "$(q "select count(*) = case when '$WD' = 't' then 4 else 0 end from next_emails_to_send(4)")" "t"
ok  "  with the wording and the postal address, and only addresses that are due" "$(q "select coalesce(bool_and(subject = 'Thank you for your first order' and postal_address = '$ADDR' and to_email like 'due%'), true) from next_emails_to_send(4)")" "t"
ok  "the owner pauses the campaign" "$(as $O "select (set_email_campaign_status('$C3', 'paused'))->>'status'")" "paused"
ok  "  nothing of a paused campaign is handed out" "$(q "select count(*) from next_emails_to_send(50)")" "0"
has "  and nothing can be queued for it" "$(as $O "select queue_campaign_emails('$C3', '$(list late 1 1)')")" "is paused"
has "an administrator cannot resume it" "$(as $A "select set_email_campaign_status('$C3', 'approved')")" "Only the owner"
has "the sending program cannot resume it either" "$(q "update email_campaigns set status = 'approved' where id = '$C3'")" "Only the owner can pause or resume"
ok  "the owner resumes it" "$(as $O "select (set_email_campaign_status('$C3', 'approved'))->>'status'")" "approved"
q "select add_email_suppression('due1@example.test', 'owner')" >/dev/null
ok  "  an address put on the do-not-email list is not handed out" "$(q "select count(*) from next_emails_to_send(50) where to_email = 'due1@example.test'")" "0"
ok  "the owner stops it, with a reason; what was queued is skipped" "$(as $O "select (j->>'status') || '|' || ((j->>'skipped')::int >= 5) from (select set_email_campaign_status('$C3', 'stopped', 'changed my mind') j) t")/$(q "select stop_reason from email_campaigns where id = '$C3'")" "stopped|true/Stopped by the owner: changed my mind"
ok  "  nothing is handed out any more" "$(q "select count(*) from next_emails_to_send(50)")" "0"

echo "11. the slow start, week by week, counted from the first day an email was to go"
F=$(q "select min(send_on) from email_outbox where status in ('queued', 'sent', 'bounced', 'complaint')")
ok  "20 a day in the first working week, then 40, 60, 80, and 100 from the fifth week" "$(q "select string_agg(email_daily_cap(date '$F' + d)::text, ',' order by d) from unnest(array[0, 7, 14, 21, 28, 70]) d")" "20,40,60,80,100,100"
ok  "  never on a weekend, in any week" "$(q "select string_agg(email_daily_cap(date '$F' + (6 - extract(isodow from date '$F')::int) + d)::text, ',' order by d) from unnest(array[0, 1, 28, 29]) d")" "0,0,0,0"

echo "12. audit"
ok  "every change is in audit_log" "$(q "select (select count(*) from audit_log where table_name = 'email_campaigns') >= 4 and (select count(*) from audit_log where table_name = 'email_outbox') >= 30 and (select count(*) from audit_log where table_name = 'email_suppressions') >= 4")" "t"

echo "13. rollback"
ok  "it stops while email records are saved" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "email record(s) are saved"
ok  "  (nothing was removed)" "$(q "select count(*) > 0 from email_suppressions")" "t"
ok  "with the authorization, it removes everything" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_email_sending = 'yes, delete the email records'" -f "$ROLLBACK" >"$OUTF" 2>&1; echo $?)" "0"
ok  "  the tables and functions are gone" "$(q "select (select count(*) from pg_class where relname in ('email_campaigns','email_outbox','email_suppressions')) + (select count(*) from pg_proc where proname in ('approve_email_campaign','queue_campaign_emails','set_email_campaign_status','add_email_suppression','next_emails_to_send','record_email_result','email_daily_cap','email_outbox_guard','email_campaigns_guard','email_suppressions_guard','email_outbox_after_result'))")" "0"
ok  "  safe to run twice" "$(run "$ROLLBACK")" "0"
ok  "install again works" "$(run "$INSTALL")" "0"
q "create table if not exists public.zz_tmp (id int); drop table public.email_outbox; create table public.email_outbox (id int)" >/dev/null
ok  "it refuses to install over a table it did not create" "$(run "$INSTALL")" "3"
has "  and says so" "$(cat "$OUTF")" "was not created by this file"
ok  "  and the rollback refuses to touch it" "$(run "$ROLLBACK")" "3"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
