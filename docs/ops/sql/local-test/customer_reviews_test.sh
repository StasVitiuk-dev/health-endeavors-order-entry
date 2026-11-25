#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-24). Never point this at Supabase.
# Tests drafts/60 (reviews the owner typed in: added once, never deleted, only
# the status changes, owner and administrators only, audit, refuses a foreign
# table) and drafts/61 (rollback) on a throwaway copy, as the owner, an
# administrator, a staff member, a deactivated account and a visitor.
# NOTHING IS POSTED OR SENT: this only keeps what was typed in. All values are made up.
# Usage: customer_reviews_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_customer_reviews_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/60_DRAFT_customer_reviews.sql"; ROLLBACK="$DIR/drafts/61_DRAFT_rollback_customer_reviews.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-240)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-000000000ca1; A=00000000-0000-4000-8000-000000000ca2; E=00000000-0000-4000-8000-000000000ca3; X=00000000-0000-4000-8000-000000000ca4
L1='[{"channel":"etsy","stars":2,"text":"SYNTHETIC The pump stopped working.","date":"2026-11-20"},
     {"channel":"amazon","stars":5,"text":"  SYNTHETIC Lovely scent.  ","date":"2026-11-22","product":"SYNTHETIC lotion"},
     {"channel":"walmart","stars":3,"text":"SYNTHETIC It is fine"},
     {"channel":"etsy","stars":9,"text":"SYNTHETIC not a rating"},
     {"channel":"etsy","stars":4,"text":"x"},
     {"channel":"etsy","stars":4,"text":"SYNTHETIC bad date","date":"2026-02-31"},
     {"channel":"etsy","stars":4,"text":"SYNTHETIC bad date two","date":"someday"},
     "not a review"]'
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "delete from profiles where id in ('$O','$A','$E','$X');
   insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'920000001'),
     ('$A','admin@example.test','administrator',true,'920000002'), ('$E','staff1@example.test','employee',true,'920000003'),
     ('$X','gone@example.test','administrator',false,'920000004');" >/dev/null
echo "Reviews the owner typed in (throwaway database $DB)"

echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  the table is empty, marked and audited" "$(q "select count(*) from customer_reviews")/$(q "select obj_description('public.customer_reviews'::regclass, 'pg_class') like 'Health Endeavors drafts/60:%'")/$(q "select count(*) from pg_trigger where tgname = 'customer_reviews_audit'")" "0/t/1"

echo " 2. the owner adds a list"
ok  "three are added, five lines that are not reviews are refused and counted" "$(as $O "select add_customer_reviews('$L1'::jsonb)::text")" '{"ok": true, "added": 3, "refused": 5, "duplicates": 0}'
ok  "  stored as typed: site, stars, date, product; the text without the spaces around it" "$(q "select string_agg(channel || '/' || stars || '/' || coalesce(review_date::text, '-') || '/' || product || '/' || review_text, ' ; ' order by stars) from customer_reviews")" "etsy/2/2026-11-20//SYNTHETIC The pump stopped working. ; other/3/-//SYNTHETIC It is fine ; amazon/5/2026-11-22/SYNTHETIC lotion/SYNTHETIC Lovely scent."
ok  "  each is new, under the person who added it, with the time" "$(q "select count(*) from customer_reviews where status = 'new' and status_at is null and added_by = '$O' and added_at > now() - interval '1 minute'")" "3"
ok  "the same list again adds nothing" "$(as $O "select (add_customer_reviews('$L1'::jsonb))->>'duplicates'")" "3"
ok  "  still three rows" "$(q "select count(*) from customer_reviews")" "3"
ok  "the same words with other capitals and spacing are the same review" "$(as $O "select (add_customer_reviews('[{\"channel\":\"etsy\",\"stars\":2,\"text\":\"synthetic  THE pump   stopped working.\",\"date\":\"2026-11-20\"}]'::jsonb))->>'duplicates'")" "1"
ok  "on another site, or on another day, it is another review" "$(as $O "select (add_customer_reviews('[{\"channel\":\"amazon\",\"stars\":2,\"text\":\"SYNTHETIC The pump stopped working.\",\"date\":\"2026-11-20\"},{\"channel\":\"etsy\",\"stars\":2,\"text\":\"SYNTHETIC The pump stopped working.\",\"date\":\"2026-11-21\"}]'::jsonb))->>'added'")" "2"

echo " 3. what is refused"
has "something that is not a list" "$(as $O "select add_customer_reviews('{\"stars\":5}'::jsonb)")" "Give the reviews as a list"
has "nothing at all" "$(as $O "select add_customer_reviews(null)")" "Give the reviews as a list"
has "more than 200 at a time" "$(as $O "select add_customer_reviews((select jsonb_agg(jsonb_build_object('stars', 5, 'text', 'SYNTHETIC many ' || g)) from generate_series(1, 201) g))")" "At most 200 reviews at a time"
ok  "  and none of them was added" "$(q "select count(*) from customer_reviews where review_text like 'SYNTHETIC many %'")" "0"
ok  "exactly 200 is accepted" "$(as $O "select (add_customer_reviews((select jsonb_agg(jsonb_build_object('stars', 5, 'text', 'SYNTHETIC two hundred ' || g)) from generate_series(1, 200) g)))->>'added'")" "200"
ok  "a text of 2,000 characters is accepted, 2,001 is refused" "$(as $O "select (add_customer_reviews(jsonb_build_array(jsonb_build_object('stars', 4, 'text', repeat('a', 2000)), jsonb_build_object('stars', 4, 'text', repeat('b', 2001)))))::text")" '{"ok": true, "added": 1, "refused": 1, "duplicates": 0}'

echo " 4. who may do what"
ok  "an administrator adds a review" "$(as $A "select (add_customer_reviews('[{\"channel\":\"google\",\"stars\":1,\"text\":\"SYNTHETIC from the administrator\"}]'::jsonb))->>'added'")" "1"
ok  "  and it is under the administrator" "$(q "select added_by = '$A' from customer_reviews where review_text = 'SYNTHETIC from the administrator'")" "t"
ok  "the owner and an administrator read every review" "$(as $O "select count(*) from customer_reviews")/$(as $A "select count(*) from customer_reviews")" "207/207"
ok  "a staff member reads none" "$(as $E "select count(*) from customer_reviews")" "0"
has "a staff member cannot add" "$(as $E "select add_customer_reviews('[{\"stars\":5,\"text\":\"SYNTHETIC from staff\"}]'::jsonb)")" "Only the owner and administrators"
has "  not by writing to the table either" "$(as $E "insert into customer_reviews (channel, stars, review_text, text_key) values ('etsy', 5, 'SYNTHETIC direct', 'k')")" "Only the owner and administrators\|row-level security"
ok  "a deactivated administrator reads none" "$(as $X "select count(*) from customer_reviews")" "0"
has "  and cannot add" "$(as $X "select add_customer_reviews('[{\"stars\":5,\"text\":\"SYNTHETIC from a closed account\"}]'::jsonb)")" "Only the owner and administrators"
has "a visitor cannot read" "$(as anon "select count(*) from customer_reviews")" "permission denied"
has "  and cannot add" "$(as anon "select add_customer_reviews('[]'::jsonb)")" "permission denied"
ok  "nothing from staff, the closed account or a visitor was stored" "$(q "select count(*) from customer_reviews where review_text like 'SYNTHETIC from staff%' or review_text like '%closed account%' or review_text = 'SYNTHETIC direct'")" "0"
ok  "a row typed in for someone else is stored under the signed-in person" "$(as $O "insert into customer_reviews (channel, stars, review_text, text_key, added_by, status, added_at) values ('other', 4, 'SYNTHETIC typed for someone else', 'made-up', '$E', 'answered', '2020-01-01') returning (added_by = '$O') || '|' || status || '|' || (added_at > now() - interval '1 minute') || '|' || (text_key <> 'made-up')")" "true|new|true|true"

echo " 5. marking a review"
RID=$(q "select id from customer_reviews where review_text = 'SYNTHETIC The pump stopped working.' and channel = 'etsy' and review_date = '2026-11-20'")
ok  "the owner marks one answered" "$(as $O "select (set_customer_review_status('$RID', 'answered'))->>'status'")" "answered"
ok  "  with who and when" "$(q "select (status_by = '$O') || '|' || (status_at > now() - interval '1 minute') from customer_reviews where id = '$RID'")" "true|true"
ok  "an administrator marks it: no reply needed" "$(as $A "select (set_customer_review_status('$RID', 'noreply'))->>'status'")/$(q "select status_by = '$A' from customer_reviews where id = '$RID'")" "noreply/t"
has "a status that does not exist is refused" "$(as $O "select set_customer_review_status('$RID', 'published')")" "new, answered, needs no reply, or removed"
has "a review that is not there is refused" "$(as $O "select set_customer_review_status('00000000-0000-4000-8000-00000000dead', 'answered')")" "not on the list"
has "a staff member cannot mark" "$(as $E "select set_customer_review_status('$RID', 'new')")" "Only the owner and administrators"
ok  "  (it is unchanged)" "$(q "select status from customer_reviews where id = '$RID'")" "noreply"
ok  "removed: it stays on the record" "$(as $O "select (set_customer_review_status('$RID', 'removed'))->>'status'")/$(q "select count(*) from customer_reviews where id = '$RID'")" "removed/1"
ok  "adding a removed review again brings it back as new, not twice" "$(as $O "select (add_customer_reviews('[{\"channel\":\"etsy\",\"stars\":2,\"text\":\"SYNTHETIC The pump stopped working.\",\"date\":\"2026-11-20\"}]'::jsonb))->>'added'")/$(q "select status from customer_reviews where id = '$RID'")/$(q "select count(*) from customer_reviews where review_text = 'SYNTHETIC The pump stopped working.' and channel = 'etsy' and review_date = '2026-11-20'")" "1/new/1"

echo " 6. a review cannot be changed or deleted"
has "the text cannot be changed" "$(as $O "update customer_reviews set review_text = 'SYNTHETIC rewritten' where id = '$RID'")" "cannot be changed after it was added"
has "the stars cannot be changed" "$(as $O "update customer_reviews set stars = 5 where id = '$RID'")" "cannot be changed after it was added"
has "the site and the date cannot be changed" "$(as $O "update customer_reviews set channel = 'amazon', review_date = '2026-01-01' where id = '$RID'")" "cannot be changed after it was added"
has "who added it cannot be changed" "$(as $O "update customer_reviews set added_by = '$A' where id = '$RID'")" "cannot be changed after it was added"
has "a review cannot be deleted, not even by the owner" "$(as $O "delete from customer_reviews where id = '$RID'")" "permission denied\|stays on the record"
ok  "  (it is unchanged)" "$(q "select stars || '|' || channel || '|' || review_text from customer_reviews where id = '$RID'")" "2|etsy|SYNTHETIC The pump stopped working."

echo " 7. audit"
ok  "adding and marking are in audit_log" "$(q "select (count(*) filter (where action ilike '%insert%') >= 200) || '|' || (count(*) filter (where action ilike '%update%') >= 4) from audit_log where table_name = 'customer_reviews'")" "true|true"

echo " 8. rollback"
ok  "the rollback stops while reviews are saved" "$(run "$ROLLBACK")" "3"
has "  and says how many" "$(cat "$OUTF")" "review(s) are saved"
ok  "  nothing was removed" "$(q "select count(*) from customer_reviews")" "208"
ok  "with written authorization in the session it removes everything" "$(psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_customer_reviews = 'yes, delete the saved reviews';" -f "$ROLLBACK" >"$OUTF" 2>&1; echo $?)" "0"
ok  "  the table and functions are gone" "$(q "select (select count(*) from pg_class where relname = 'customer_reviews') + (select count(*) from pg_proc where proname in ('add_customer_reviews', 'set_customer_review_status', 'customer_reviews_guard', 'customer_review_key'))")" "0"
ok  "  safe to run twice" "$(run "$ROLLBACK")" "0"
ok  "install again works" "$(run "$INSTALL")" "0"
q "drop table public.customer_reviews; create table public.customer_reviews (id int)" >/dev/null
ok  "it refuses to install over a table it did not create" "$(run "$INSTALL")" "3"
has "  and says so" "$(cat "$OUTF")" "was not created by this file"
ok  "  and the rollback refuses to touch it" "$(run "$ROLLBACK")" "3"
ok  "  (the foreign table is untouched)" "$(q "select count(*) from information_schema.columns where table_name = 'customer_reviews'")" "1"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
rm -f "$OUTF"
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
