#!/usr/bin/env bash
# LOCAL TEST ONLY (2026-11-16). Never point this at Supabase.
# Tests drafts/34 (stock-count adjustments: propose, owner-only approval, the
# per-account grant) and drafts/35 (rollback) on a throwaway copy, acting as the
# owner, two administrators, an employee, a deactivated account and a visitor.
# Covers the owner's decision of Nov 16: staff and ordinary administrators may
# propose with a reason; ONLY the owner approves; the record keeps the original
# count, the requested count, the reason, who submitted, who approved and when;
# an ordinary administrator cannot approve; approval can be granted to one named
# administrator account by the owner only. No stock figure is changed.
# All rows are synthetic.
# Usage: stock_count_adjustments_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_stock_count_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$DIR/drafts/34_DRAFT_stock_count_adjustments.sql"; ROLLBACK="$DIR/drafts/35_DRAFT_rollback_stock_count_adjustments.sql"
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
O=00000000-0000-4000-8000-0000000000b1; A=00000000-0000-4000-8000-0000000000b2; A2=00000000-0000-4000-8000-0000000000b3
E=00000000-0000-4000-8000-0000000000b4; I=00000000-0000-4000-8000-0000000000b5
P1=00000000-0000-4000-8000-0000000000d1; P2=00000000-0000-4000-8000-0000000000d2; P3=00000000-0000-4000-8000-0000000000d3
setup() {
  psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
  psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
  q "delete from profiles where id in ('$O','$A','$A2','$E','$I');
     insert into profiles (id, email, role, is_active, account_number) values
     ('$O','owner@example.test','owner',true,'200000001'), ('$A','admin@example.test','administrator',true,'200000002'),
     ('$A2','admin2@example.test','administrator',true,'200000003'), ('$E','staff@example.test','employee',true,'200000004'),
     ('$I','gone@example.test','administrator',false,'200000005');
     insert into products (id, name, sku) values ('$P1','SYNTHETIC lotion A','SYN-CNT-A'), ('$P2','SYNTHETIC lotion B','SYN-CNT-B'), ('$P3','SYNTHETIC lotion C','SYN-CNT-C');
     insert into inventory (product_id, available, damaged) values ('$P1', 40, 2), ('$P2', 25, 0), ('$P3', 12, 0);" >/dev/null
}
setup
echo "Stock-count adjustments: propose, owner-only approval, per-account grant (throwaway database $DB)"
SNAP="select (select count(*) from orders)||'/'||(select count(*) from tasks)||'/'||(select count(*) from products)||'/'||(select count(*) from inventory_adjustments)"
STOCK="select string_agg(available||':'||damaged, ',' order by product_id) from inventory where product_id in ('$P1','$P2','$P3')"
before=$(q "$SNAP"); stock0=$(q "$STOCK")

ok "install succeeds" "$(run "$INSTALL")" "0"
ok "  a second install changes nothing and succeeds" "$(run "$INSTALL")" "0"
ok "  no existing table gained or lost a row" "$(q "$SNAP")" "$before"
ok "  both new tables are empty (nobody but the owner can approve yet)" "$(q "select (select count(*) from stock_count_adjustments)||'/'||(select count(*) from stock_count_approvers)")" "0/0"

echo " who can propose"
has "a visitor cannot read proposals" "$(as anon "select count(*) from stock_count_adjustments")" "permission denied"
has "a visitor cannot propose" "$(as anon "select public.propose_stock_count_adjustment('$P1','available',38,'Counted the shelf')")" "permission denied"
has "a deactivated account cannot propose" "$(as $I "select public.propose_stock_count_adjustment('$P1','available',38,'Counted the shelf')")" "Only active staff"
has "a proposal needs a written reason" "$(as $E "select public.propose_stock_count_adjustment('$P1','available',38,' ok ')")" "written reason is required"
has "a count equal to the system is not a proposal" "$(as $A "select public.propose_stock_count_adjustment('$P1','available',40,'Counted the shelf')")" "nothing to adjust"
has "a product that does not exist is refused" "$(as $E "select public.propose_stock_count_adjustment('00000000-0000-4000-8000-0000000000ff','available',1,'Counted the shelf')")" "No such product"
has "a negative count is refused" "$(as $E "select public.propose_stock_count_adjustment('$P1','available',-1,'Counted the shelf')")" "zero or more"
has "an unknown bucket is refused" "$(as $E "select public.propose_stock_count_adjustment('$P1','secret',1,'Counted the shelf')")" "Unknown stock bucket"
R=$(as $E "select public.propose_stock_count_adjustment('$P1','available',38,'Counted the main shelf: two jars short')")
has "staff propose an adjustment" "$R" "\"status\": \"proposed\""
ok  "  staff cannot see stock figures (existing row rule), so theirs is a blind count" "$(as $E "select count(*) from inventory")" "0"
has "  and the proposal does not reveal the system's figure to them" "$R" "\"original_count\": null"
ADJ1=$(q "select id from stock_count_adjustments where product_id = '$P1' and bucket = 'available'")
ok  "  the record holds the requested count, reason, submitter and time" "$(q "select coalesce(original_count::text,'not yet')||'/'||requested_count||'/'||reason||'/'||(submitted_by = '$E')::text||'/'||(submitted_at is not null)::text||'/'||status from stock_count_adjustments where id = '$ADJ1'")" "not yet/38/Counted the main shelf: two jars short/true/true/proposed"
has "  the system's figure cannot be typed into an open proposal" "$(as $A "update stock_count_adjustments set original_count = 99 where id = '$ADJ1'")" "cannot be edited"
has "a second open proposal for the same product and bucket is refused" "$(as $A "select public.propose_stock_count_adjustment('$P1','available',37,'Counted again later')")" "stock_count_adjustments_one_open"
R=$(as $A "select public.propose_stock_count_adjustment('$P2','available',27,'Found two jars behind the boxes')")
has "an ordinary administrator can propose too" "$R" "\"status\": \"proposed\""
has "  an administrator may see stock, so the system's figure is recorded at once" "$R" "\"original_count\": 25"
ADJ2=$(q "select id from stock_count_adjustments where product_id = '$P2'")
has "a proposal cannot be typed in as already approved" "$(as $A "insert into stock_count_adjustments (product_id, original_count, requested_count, reason, status, decided_by, decided_at) values ('$P3', 12, 10, 'Typed in directly', 'approved', '$A', now())")" "ERROR"
has "a proposal cannot be edited (cancel and propose again)" "$(as $E "update stock_count_adjustments set requested_count = 1 where id = '$ADJ1'")" "cannot be edited"
has "  nor its original count" "$(as $O "update stock_count_adjustments set original_count = 1 where id = '$ADJ2'")" "cannot be edited"
has "  nor who submitted it" "$(as $O "update stock_count_adjustments set submitted_by = '$O' where id = '$ADJ1'")" "cannot be edited"

echo " ONLY the owner approves"
has "staff cannot approve" "$(as $E "select public.approve_stock_count_adjustment('$ADJ1')")" "Only the owner can approve"
has "an ORDINARY ADMINISTRATOR cannot approve" "$(as $A "select public.approve_stock_count_adjustment('$ADJ1')")" "Only the owner can approve"
has "  not even their own proposal" "$(as $A "select public.approve_stock_count_adjustment('$ADJ2')")" "Only the owner can approve"
has "  nor by editing the row directly" "$(as $A "update stock_count_adjustments set status = 'approved' where id = '$ADJ1'")" "Only the owner can approve or reject"
has "  nor by filling in the decision fields" "$(as $A "update stock_count_adjustments set status = 'approved', decided_by = '$O', decided_at = now() where id = '$ADJ1'")" "Only the owner can approve or reject"
has "  nor reject" "$(as $A "select public.reject_stock_count_adjustment('$ADJ1', 'Not convinced')")" "Only the owner can reject"
has "a second administrator cannot approve either" "$(as $A2 "select public.approve_stock_count_adjustment('$ADJ1')")" "Only the owner can approve"
has "a deactivated administrator cannot approve" "$(as $I "select public.approve_stock_count_adjustment('$ADJ1')")" "Only the owner can approve"
has "a visitor cannot approve" "$(as anon "select public.approve_stock_count_adjustment('$ADJ1')")" "permission denied"
ok  "  after all of that, both proposals are still open" "$(q "select count(*) from stock_count_adjustments where status = 'proposed' and decided_by is null")" "2"
ok  "  can_approve_stock_count: owner yes, administrator no, staff no" "$(as $O "select public.can_approve_stock_count()")/$(as $A "select public.can_approve_stock_count()")/$(as $E "select public.can_approve_stock_count()")" "t/f/f"
R=$(as $O "select public.approve_stock_count_adjustment('$ADJ1')")
has "the owner approves" "$R" "\"status\": \"approved\""
has "  and is told that no stock figure was changed" "$R" "\"applied\": false"
has "  the system's figure is recorded at the moment of the decision" "$R" "\"original_count\": 40"
ok  "  the record now also holds the approver and the time" "$(q "select status||'/'||(decided_by = '$O')::text||'/'||(decided_at is not null)::text||'/'||original_count||'/'||requested_count||'/'||(submitted_by = '$E')::text from stock_count_adjustments where id = '$ADJ1'")" "approved/true/true/40/38/true"
ok  "  no stock figure changed (the stock write stays a separate, gated step)" "$(q "$STOCK")" "$stock0"
ok  "  and nothing was written to the stock adjustment log" "$(q "select count(*) from inventory_adjustments")" "0"
R=$(as $O "select public.approve_stock_count_adjustment('$ADJ1')")
has "asking again is safe: already decided, nothing changes" "$R" "\"already_decided\": true"
has "a decided adjustment cannot be edited, even by the owner" "$(as $O "update stock_count_adjustments set requested_count = 1 where id = '$ADJ1'")" "already approved and cannot be changed"
has "  nor un-approved" "$(as $O "update stock_count_adjustments set status = 'proposed' where id = '$ADJ1'")" "already approved and cannot be changed"
has "  nor deleted" "$(as $O "delete from stock_count_adjustments where id = '$ADJ1'")" "permission denied"
has "  not by the database owner's delete either: the guard refuses" "$(q "delete from stock_count_adjustments where id = '$ADJ1'")" "stays on the record"

echo " rejecting, cancelling, and a count that has gone stale"
has "rejecting needs a written reason" "$(as $O "select public.reject_stock_count_adjustment('$ADJ2', ' no ')")" "written reason is required"
has "the owner rejects with a reason" "$(as $O "select public.reject_stock_count_adjustment('$ADJ2', 'Recount the back room first')")" "\"status\": \"rejected\""
ok  "  the rejection is on the record with who and why" "$(q "select status||'/'||decision_note||'/'||(decided_by = '$O')::text from stock_count_adjustments where id = '$ADJ2'")" "rejected/Recount the back room first/true"
has "  approving a rejected one changes nothing" "$(as $O "select public.approve_stock_count_adjustment('$ADJ2')")" "\"ok\": false"
as $E "select public.propose_stock_count_adjustment('$P3','available',10,'Two jars damaged in the box')" >/dev/null
ADJ3=$(q "select id from stock_count_adjustments where product_id = '$P3' and status = 'proposed'")
has "someone else cannot cancel a proposal that is not theirs" "$(as $A "select public.cancel_stock_count_adjustment('$ADJ3')")" "Only the person who proposed it"
has "the person who proposed it can cancel it" "$(as $E "select public.cancel_stock_count_adjustment('$ADJ3')")" "\"status\": \"cancelled\""
has "  a cancelled proposal cannot be approved" "$(as $O "select public.approve_stock_count_adjustment('$ADJ3')")" "\"ok\": false"
as $E "select public.propose_stock_count_adjustment('$P3','available',10,'Two jars damaged in the box')" >/dev/null
ADJ4=$(q "select id from stock_count_adjustments where product_id = '$P3' and status = 'proposed'")
q "update inventory set available = 10 where product_id = '$P3'" >/dev/null
has "a blind count that now matches the system is not approved" "$(as $O "select public.approve_stock_count_adjustment('$ADJ4')")" "count now matches the system (10)"
ok  "  it stays open, to be rejected or cancelled" "$(q "select status from stock_count_adjustments where id = '$ADJ4'")" "proposed"
q "update inventory set available = 12 where product_id = '$P3'" >/dev/null
as $A "select public.propose_stock_count_adjustment('$P2','reserved',3,'Three jars set aside for a pickup')" >/dev/null
ADJS=$(q "select id from stock_count_adjustments where product_id = '$P2' and bucket = 'reserved'")
q "update inventory set reserved = 1 where product_id = '$P2'" >/dev/null
has "approval is refused when the stock changed after the figure was recorded" "$(as $O "select public.approve_stock_count_adjustment('$ADJS')")" "stock has changed since this count (it was 0, it is now 1)"
q "update inventory set reserved = 0 where product_id = '$P2'" >/dev/null
has "  the owner rejects that one; the figure it was judged against is kept" "$(as $O "select public.reject_stock_count_adjustment('$ADJS', 'Stock moved, count again')")" "\"status\": \"rejected\""

echo " granting approval to ONE named administrator account (owner only)"
has "an administrator cannot grant it to themselves" "$(as $A2 "select public.grant_stock_count_approval('$A2', 'I need this to work faster')")" "Only the owner can grant"
has "  nor by adding the row directly" "$(as $A2 "insert into stock_count_approvers (user_id, note) values ('$A2', 'I need this to work faster')")" "row-level security"
has "  nor can another administrator grant it" "$(as $A "select public.grant_stock_count_approval('$A2', 'Helping a colleague')")" "Only the owner can grant"
has "a grant needs a reason" "$(as $O "select public.grant_stock_count_approval('$A2', ' ')")" "why this account is granted"
has "it cannot be granted to a staff account" "$(as $O "select public.grant_stock_count_approval('$E', 'Trusted member of staff')")" "only be granted to an administrator"
has "  nor to a deactivated account" "$(as $O "select public.grant_stock_count_approval('$I', 'Old administrator account')")" "No active account"
has "the owner grants it to one named administrator" "$(as $O "select public.grant_stock_count_approval('$A2', 'Owner personal administrator account')")" "\"granted\": true"
ok  "  the grant records who, when and why" "$(q "select (granted_by = '$O')::text||'/'||(granted_at is not null)::text||'/'||note from stock_count_approvers where user_id = '$A2'")" "true/true/Owner personal administrator account"
ok  "  that account can now approve; the other administrator still cannot" "$(as $A2 "select public.can_approve_stock_count()")/$(as $A "select public.can_approve_stock_count()")" "t/f"
has "  the other administrator is still refused" "$(as $A "select public.approve_stock_count_adjustment('$ADJ4')")" "Only the owner can approve"
has "the granted account approves a proposal made by someone else" "$(as $A2 "select public.approve_stock_count_adjustment('$ADJ4')")" "\"status\": \"approved\""
ok  "  recorded under that account" "$(q "select (decided_by = '$A2')::text from stock_count_adjustments where id = '$ADJ4'")" "true"
as $A2 "select public.propose_stock_count_adjustment('$P2','damaged',1,'One jar cracked on the shelf')" >/dev/null
ADJ5=$(q "select id from stock_count_adjustments where product_id = '$P2' and bucket = 'damaged'")
has "the granted account cannot approve its OWN proposal" "$(as $A2 "select public.approve_stock_count_adjustment('$ADJ5')")" "cannot decide your own proposal"
has "  the owner can approve it" "$(as $O "select public.approve_stock_count_adjustment('$ADJ5')")" "\"status\": \"approved\""
as $O "select public.propose_stock_count_adjustment('$P1','damaged',3,'Owner counted the damaged bin')" >/dev/null
ADJ6=$(q "select id from stock_count_adjustments where product_id = '$P1' and bucket = 'damaged'")
has "the owner may approve the owner's own proposal" "$(as $O "select public.approve_stock_count_adjustment('$ADJ6')")" "\"status\": \"approved\""
q "update profiles set is_active = false where id = '$A2'" >/dev/null
ok  "a granted account that is deactivated can no longer approve" "$(as $A2 "select public.can_approve_stock_count()")" "f"
q "update profiles set is_active = true where id = '$A2'" >/dev/null
q "update profiles set role = 'employee' where id = '$A2'" >/dev/null
ok  "  nor one that is no longer an administrator" "$(as $A2 "select public.can_approve_stock_count()")" "f"
q "update profiles set role = 'administrator' where id = '$A2'" >/dev/null
has "only the owner can revoke" "$(as $A2 "select public.revoke_stock_count_approval('$A2')")" "Only the owner can revoke"
has "the owner revokes the grant" "$(as $O "select public.revoke_stock_count_approval('$A2')")" "\"revoked\": true"
ok  "  that account can no longer approve" "$(as $A2 "select public.can_approve_stock_count()")" "f"

echo " the same proposal approved 10 times at the same moment (a double click, two tabs, a retry)"
as $E "select public.propose_stock_count_adjustment('$P3','damaged',2,'Two jars dented in the delivery')" >/dev/null
ADJ7=$(q "select id from stock_count_adjustments where product_id = '$P3' and bucket = 'damaged'")
SAME=$(mktemp)
for n in $(seq 1 10); do ( as $O "select public.approve_stock_count_adjustment('$ADJ7')" >>"$SAME" ) & done
wait
ok  "all 10 requests were answered" "$(grep -c '"status": "approved"' "$SAME")" "10"
ok  "  exactly one did the approving; the rest were told it was already decided" "$(grep -c '"already_decided": false' "$SAME")/$(grep -c '"already_decided": true' "$SAME")" "1/9"
rm -f "$SAME"
ok  "after everything: no stock figure was changed by any approval" "$(q "$STOCK")" "$stock0"
ok  "  every decided row names who decided and when" "$(q "select count(*) from stock_count_adjustments where status <> 'proposed' and (decided_by is null or decided_at is null)")" "0"

echo " rollback"
ok  "rollback refuses while approved or rejected adjustments exist" "$(run "$ROLLBACK")" "3"
has "  and says why" "$(cat "$OUTF")" "approved or rejected stock-count adjustment(s) exist"
ok  "  nothing was removed" "$(q "select count(*) from stock_count_adjustments where status in ('approved','rejected')")" "7"
setup
before=$(q "$SNAP")
ok  "fresh copy: install" "$(run "$INSTALL")" "0"
as $E "select public.propose_stock_count_adjustment('$P1','available',38,'Counted the shelf again')" >/dev/null
ok  "  rollback with only an open proposal succeeds" "$(run "$ROLLBACK")" "0"
ok  "  tables and functions are gone" "$(q "select (to_regclass('public.stock_count_adjustments') is null)::text||'/'||(to_regclass('public.stock_count_approvers') is null)::text||'/'||(to_regprocedure('public.approve_stock_count_adjustment(uuid)') is null)::text||'/'||(to_regprocedure('public.can_approve_stock_count()') is null)::text")" "true/true/true/true"
ok  "  a second rollback is harmless" "$(run "$ROLLBACK")" "0"
ok  "  every other table is as it was" "$(q "$SNAP")" "$before"
ok  "  install works again afterwards" "$(run "$INSTALL")" "0"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "passed $pass, failed $fail"
[ "$fail" = "0" ]
