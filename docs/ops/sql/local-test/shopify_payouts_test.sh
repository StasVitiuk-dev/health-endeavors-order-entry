#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-22). Never point this at Supabase or Shopify.
# Tests drafts/42 (Shopify payout copy, the daily payout check, the list of
# differences) and drafts/43 (rollback) on a throwaway copy, as the sync (the
# service role, here the database superuser), the owner, an administrator, staff
# and a visitor. Every payout and transaction is made up.
# Usage: shopify_payouts_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_shopify_payouts_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/42_DRAFT_shopify_payouts_money_issues.sql"; ROLLBACK="$DIR/drafts/43_DRAFT_rollback_shopify_payouts_money_issues.sql"
pass=0; fail=0
ok()   { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has()  { if echo "$2" | grep -q -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(echo "$2" | tr '\n' ' ' | cut -c1-220)]"; fi; }
q()    { psql "${CONN[@]}" -d "$DB" -qtAX -c "$1" 2>&1; }
run()  { psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -f "$1" >"$OUTF" 2>&1; echo $?; }
as()   { local who="$1" sql="$2" pre
         if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
         psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; commit;" 2>&1 | grep -v '^\(BEGIN\|COMMIT\|SET\|ROLLBACK\)$'; }
OUTF=$(mktemp)
O=00000000-0000-4000-8000-0000000007a1; A=00000000-0000-4000-8000-0000000007a2; E=00000000-0000-4000-8000-0000000007a3
fresh() { psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
          psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
          q "delete from profiles where id in ('$O','$A','$E');
             insert into profiles (id, email, role, is_active, account_number) values ('$O','owner@example.test','owner',true,'700000001'),
               ('$A','admin@example.test','administrator',true,'700000002'), ('$E','staff@example.test','employee',true,'700000003');" >/dev/null; }
# what the sync writes (as the service role, which bypasses the row rules)
sync_week() {
  q "insert into shopify_payouts (id, issued_at, status, net) values
       ('gid://shopify/ShopifyPaymentsPayout/9001', '2026-11-16 18:00+00', 'PAID', 412.07),
       ('gid://shopify/ShopifyPaymentsPayout/9002', '2026-11-18 18:00+00', 'PAID', 261.87),
       ('gid://shopify/ShopifyPaymentsPayout/9003', '2026-11-23 18:00+00', 'IN_TRANSIT', 99.00)
     on conflict (id) do update set status = excluded.status, net = excluded.net, synced_at = now();
     insert into shopify_balance_transactions (id, payout_id, type, amount, fee, net, order_ref, occurred_at, test) values
       ('t1', 'gid://shopify/ShopifyPaymentsPayout/9001', 'CHARGE', 250.00, 7.55, 242.45, '#1101', '2026-11-14 15:00+00', false),
       ('t2', 'gid://shopify/ShopifyPaymentsPayout/9001', 'CHARGE', 175.00, 5.38, 169.62, '#1102', '2026-11-15 15:00+00', false),
       ('t1x', 'gid://shopify/ShopifyPaymentsPayout/9001', 'TRANSFER', -412.07, 0, -412.07, null, '2026-11-16 18:00+00', false),
       ('t3', 'gid://shopify/ShopifyPaymentsPayout/9002', 'CHARGE', 270.00, 8.13, 261.87, '#1103', '2026-11-17 15:00+00', false),
       ('t3t', 'gid://shopify/ShopifyPaymentsPayout/9002', 'CHARGE', 99.00, 0, 99.00, '#TEST', '2026-11-17 16:00+00', true),
       ('t4', 'gid://shopify/ShopifyPaymentsPayout/9003', 'CHARGE', 101.00, 3.00, 98.00, '#1104', '2026-11-22 15:00+00', false)
     on conflict (id) do nothing" >/dev/null; }

fresh
echo "Shopify payouts and differences (throwaway database $DB)"
echo " 1. install"
ok  "install" "$(run "$INSTALL")" "0"
ok  "  safe to run twice" "$(run "$INSTALL")" "0"
ok  "  three new tables, empty" "$(q "select count(*) from shopify_payouts")/$(q "select count(*) from shopify_balance_transactions")/$(q "select count(*) from money_match_issues")" "0/0/0"

echo " 2. the daily sync writes the copy; nobody signed in can"
sync_week
ok  "the sync stores 3 payouts and 6 transactions" "$(q "select count(*) from shopify_payouts")/$(q "select count(*) from shopify_balance_transactions")" "3/6"
sync_week
ok  "  running the sync again adds nothing" "$(q "select count(*) from shopify_payouts")/$(q "select count(*) from shopify_balance_transactions")" "3/6"
has "the owner cannot write the copy by hand" "$(as $O "insert into shopify_payouts (id, issued_at, status, net) values ('x', now(), 'PAID', 1)")" "permission denied"
has "  nor change it" "$(as $O "update shopify_payouts set net = 0")" "permission denied"
has "a transaction whose net is not amount minus fee is refused" "$(q "insert into shopify_balance_transactions (id, type, amount, fee, net) values ('bad', 'CHARGE', 10, 1, 10)")" "shopify_balance_transactions_net"

echo " 3. the daily check: every payout against its own transactions"
ok  "it finds the one payout that does not add up" "$(q "select public.check_shopify_payouts()")" "1"
ok  "  the issue says how much and why" "$(q "select outcome||' | '||summary||' | '||expected||'/'||found||' | '||occurred_on from money_match_issues")" "AMOUNT_DIFFERS | Shopify payout of \$99.00: its 1 transaction(s) add up to \$98.00 | 99.00/98.00 | 2026-11-23"
ok  "  the payout's own TRANSFER line and test orders are left out (the others match)" "$(q "select count(*) from money_match_issues where summary like '%412.07%' or summary like '%261.87%'")" "0"
ok  "  running the check again adds nothing" "$(q "select public.check_shopify_payouts()")/$(q "select count(*) from money_match_issues")" "0/1"
ok  "  the owner may run it too" "$(as $O "select public.check_shopify_payouts()")" "0"
has "  staff may not" "$(as $E "select public.check_shopify_payouts()")" "Only the owner or an administrator"

echo " 4. who sees the copy and the differences"
ok  "the owner and an administrator read everything" "$(as $O "select count(*) from shopify_payouts")/$(as $A "select count(*) from money_match_issues")" "3/1"
ok  "  staff read nothing" "$(as $E "select count(*) from shopify_payouts")/$(as $E "select count(*) from shopify_balance_transactions")/$(as $E "select count(*) from money_match_issues")" "0/0/0"
has "  a visitor is refused" "$(as anon "select count(*) from money_match_issues")" "permission denied"

echo " 5. the screen saves what it found in a bank or card file"
ok  "the owner saves a card purchase that is not recorded" "$(as $O "select (public.record_money_issue('card:2026-11-18:-3215:SYN SHIPPING SUPPLIES', 'card', 'NOT_RECORDED', 'A card purchase of \$32.15 with no expense', null, 32.15, '2026-11-18'))->>'duplicate'")" "false"
ok  "  saving the same file again adds nothing" "$(as $O "select (public.record_money_issue('card:2026-11-18:-3215:SYN SHIPPING SUPPLIES', 'card', 'NOT_RECORDED', 'A card purchase of \$32.15 with no expense', null, 32.15, '2026-11-18'))->>'duplicate'")/$(q "select count(*) from money_match_issues")" "true/2"
ok  "  it is open and names who saved it" "$(q "select status||'/'||(created_by = '$O')::text from money_match_issues where source = 'card'")" "open/true"
has "  staff cannot save one" "$(as $E "select public.record_money_issue('bank:x', 'bank', 'UNEXPECTED', 'something odd', null, 1, null)")" "Only the owner or an administrator"
has "  an unknown kind is refused" "$(as $O "select public.record_money_issue('bank:y', 'bank', 'FINE', 'all good', null, 1, null)")" "money_match_issues_outcome_check"

echo " 6. marking a difference checked: owner or administrator, with a note, once"
I1=$(q "select id from money_match_issues where source = 'shopify_payout'")
has "a note is required" "$(as $A "select public.mark_money_issue_checked('$I1', 'ok')")" "at least 5 characters"
has "staff cannot mark it" "$(as $E "select public.mark_money_issue_checked('$I1', 'Looked at it')")" "No such difference\|Only the owner"
ok  "an administrator marks it checked with a note" "$(as $A "select (public.mark_money_issue_checked('$I1', 'Shopify support: \$1.00 reserve released later'))->>'status'")" "checked"
ok  "  stored with who, when and the note" "$(q "select (checked_by = '$A')::text||'/'||(checked_at is not null)::text||'/'||check_note from money_match_issues where id = '$I1'")" "true/true/Shopify support: \$1.00 reserve released later"
has "  it cannot be checked again" "$(as $O "select public.mark_money_issue_checked('$I1', 'second look')")" "already checked"
has "  what was found cannot be edited" "$(as $O "update money_match_issues set found = 99 where id = '$I1'")" "only its status"
has "  nor deleted, owner included" "$(as $O "delete from money_match_issues where id = '$I1'")" "permission denied\|stays on the record"
ok  "open differences left: the card purchase" "$(as $O "select string_agg(source, ',') from money_match_issues where status = 'open'")" "card"

echo " rollback"
ok  "rollback refuses while differences are recorded" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "2 difference(s) are recorded"
psql "${CONN[@]}" -d "$DB" -qX -v ON_ERROR_STOP=1 -c "set he.rollback_delete_money_issues = 'yes, delete the differences'" -f "$ROLLBACK" >"$OUTF" 2>&1
ok  "  authorized: everything 42 added is gone" "$(q "select (to_regclass('public.shopify_payouts') is null and to_regclass('public.money_match_issues') is null and to_regprocedure('public.check_shopify_payouts()') is null)::text")" "true"
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
