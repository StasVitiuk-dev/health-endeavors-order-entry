#!/usr/bin/env bash
# LOCAL TEST ONLY (EXT18). Never point this at Supabase.
# Local row-level-security CONTRACT test on a throwaway copy of the local
# real-shape database (he_real). It acts as six kinds of caller and checks what
# each one can read and change:
#   owner, administrator, employee, inactive employee, signed-in user with no
#   profile, and not-signed-in (anon)
# against four representative tables (tasks: all staff; expenses: owner/admin
# only; products: owner/admin write, staff read; audit_log) plus audit
# completeness (every change leaves exactly one audit row naming the person)
# and audit immutability (nobody can edit or delete an audit row).
#
# IMPORTANT: the policies here are the LOCAL stand-ins in
# 01_REAL_SHAPE_schema_for_local_tests.sql, written to match Query A. Passing
# this is NOT a verification of production RLS. Production is checked only by
# the read-only Query G (06_READONLY_G_permissions_inventory.sql), run by the owner.
#
# It also records properties of the LOCAL model worth confirming in production:
#   F1  a forged audit line (direct INSERT) is refused here only because
#       audit_log has row-level security and no INSERT policy; the table
#       privilege itself is still granted to authenticated
#   F2  any signed-in user, even inactive or with no profile, may READ audit_log
#   PROPOSED defence in depth (not installed, owner decision): also revoke
#   INSERT on audit_log from authenticated; the audit trigger is SECURITY
#   DEFINER and keeps writing (proved below).
# Usage: rls_contract_test.sh -h localhost -p 5433 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_rls_contract
pass=0; fail=0
ok() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
q()  { psql "${CONN[@]}" -d "$DB" -qtAX -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "INCONCLUSIVE: cannot copy $SRC (is the local database running and built?)"; exit 2; }

O=00000000-0000-4000-8000-0000000000a1; A=00000000-0000-4000-8000-0000000000a2
E=00000000-0000-4000-8000-0000000000a3; I=00000000-0000-4000-8000-0000000000a4
U=00000000-0000-4000-8000-0000000000a9
q "insert into profiles (id, email, role, is_active, account_number) values
   ('$O','owner@example.test','owner',true,'100000001'), ('$A','admin@example.test','administrator',true,'100000002'),
   ('$E','staff@example.test','employee',true,'100000003'), ('$I','gone@example.test','employee',false,'100000004')" >/dev/null
q "insert into tasks (id, title) values ('00000000-0000-4000-8000-00000000b001','SYNTHETIC task');
   insert into expenses (id, category, amount, expense_date) values ('00000000-0000-4000-8000-00000000b002','other',1,'2026-01-01');
   insert into products (id, name) values ('00000000-0000-4000-8000-00000000b003','SYNTHETIC product')" >/dev/null || { echo "INCONCLUSIVE: seed failed"; exit 2; }
# rows that exist in each table (the copy may hold earlier local test rows)
NT=$(q "select count(*) from tasks"); NX=$(q "select count(*) from expenses"); NP=$(q "select count(*) from products")

# as <uid|anon> <sql>: one statement in its own transaction (rolled back), as
# that caller. Prints the result, or DENIED (permission) / REFUSED (policy) / ERR.
as() {
  local who="$1" sql="$2" pre
  if [ "$who" = anon ]; then pre="set local role anon;"; else pre="set local role authenticated; set local request.jwt.claim.sub = '$who';"; fi
  local out; out=$(psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; $pre $sql; rollback;" 2>&1)
  if echo "$out" | grep -q "permission denied"; then echo DENIED
  elif echo "$out" | grep -q "row-level security"; then echo REFUSED
  elif echo "$out" | grep -q "ERROR"; then echo "ERR"
  else echo "$out" | grep -v '^\(BEGIN\|ROLLBACK\|SET\)$' | tr -d ' ' | grep -v '^$' | tail -1; fi
}
cnt()  { as "$1" "select count(*) from $2"; }
upd()  { as "$1" "with u as (update $2 set $3 returning 1) select count(*) from u"; }
del()  { as "$1" "with d as (delete from $2 returning 1) select count(*) from d"; }
ins()  { local r; r=$(as "$1" "with i as (insert into $2 returning 1) select count(*) from i"); echo "$r"; }

echo "RLS contract (local model, throwaway database $DB)"
echo "-- tasks: any active staff reads and writes; nobody else"
for who in O A E; do v=${!who}
  ok "tasks: $who reads all"   "$(cnt $v tasks)" "$NT"
  ok "tasks: $who updates all" "$(upd $v tasks "title='SYNTHETIC x'")" "$NT"
  ok "tasks: $who adds"        "$(ins $v "tasks (title) values ('SYNTHETIC new')")" "1"
  ok "tasks: $who deletes all" "$(del $v tasks)" "$NT"
done
for who in I U; do v=${!who}
  ok "tasks: $who sees nothing"     "$(cnt $v tasks)" "0"
  ok "tasks: $who changes nothing"  "$(upd $v tasks "title='x'")" "0"
  ok "tasks: $who cannot add"       "$(ins $v "tasks (title) values ('x')")" "REFUSED"
  ok "tasks: $who deletes nothing"  "$(del $v tasks)" "0"
done
ok "tasks: anon has no access at all" "$(cnt anon tasks)" "DENIED"
ok "tasks: anon cannot add"           "$(ins anon "tasks (title) values ('x')")" "DENIED"

echo "-- expenses: owner and administrator only"
for who in O A; do v=${!who}
  ok "expenses: $who reads all"   "$(cnt $v expenses)" "$NX"
  ok "expenses: $who updates all" "$(upd $v expenses "amount=2")" "$NX"
done
for who in E I U; do v=${!who}
  ok "expenses: $who sees nothing"    "$(cnt $v expenses)" "0"
  ok "expenses: $who changes nothing" "$(upd $v expenses "amount=2")" "0"
  ok "expenses: $who cannot add"      "$(ins $v "expenses (category, amount, expense_date) values ('other',1,'2026-01-02')")" "REFUSED"
  ok "expenses: $who deletes nothing" "$(del $v expenses)" "0"
done
ok "expenses: anon has no access" "$(cnt anon expenses)" "DENIED"

echo "-- products: owner/administrator write, staff read"
ok "products: employee reads all"       "$(cnt $E products)" "$NP"
ok "products: employee changes nothing" "$(upd $E products "name='x'")" "0"
ok "products: employee cannot add"      "$(ins $E "products (name) values ('x')")" "REFUSED"
ok "products: owner updates all"        "$(upd $O products "name='SYNTHETIC y'")" "$NP"
ok "products: inactive sees nothing"    "$(cnt $I products)" "0"

echo "-- audit completeness: every change leaves exactly one audit line naming the person"
before=$(q "select count(*) from audit_log")
psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$E';
  update tasks set title='SYNTHETIC audited' where id='00000000-0000-4000-8000-00000000b001'; commit;" >/dev/null 2>&1
ok "employee task change: one audit line" "$(q "select count(*) from audit_log") " "$((before+1)) "
ok "the audit line names the employee and the action" "$(q "select changed_by||'|'||action||'|'||table_name from audit_log order by changed_at desc, id desc limit 1")" "$E|UPDATE|tasks"
ok "the audit line keeps the old and the new value" "$(q "select (old_data->>'title')||'>'||(new_data->>'title') from audit_log where changed_by='$E' order by changed_at desc limit 1")" "SYNTHETIC task>SYNTHETIC audited"
psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$O';
  insert into expenses (category, amount, expense_date) values ('other', 3, '2026-01-03'); delete from expenses where amount = 3; commit;" >/dev/null 2>&1
ok "owner insert + delete: two audit lines, INSERT then DELETE" "$(q "select string_agg(action, ',' order by changed_at, action desc) from audit_log where changed_by='$O' and table_name='expenses'")" "INSERT,DELETE"
ok "a refused change leaves no audit line" "$(c0=$(q "select count(*) from audit_log"); as $E "update expenses set amount=9" >/dev/null; q "select count(*) from audit_log" | grep -c "^$c0$")" "1"

echo "-- audit immutability: nobody edits or deletes audit lines"
for who in O A E; do v=${!who}
  ok "audit: $who cannot edit a line"   "$(as $v "update audit_log set action='DELETE'")" "DENIED"
  ok "audit: $who cannot delete a line" "$(as $v "delete from audit_log")" "DENIED"
done
ok "audit: anon cannot read it" "$(cnt anon audit_log)" "DENIED"

echo "-- recorded properties of the LOCAL model (confirm in production with Query G)"
ok "F1 (local model): a forged audit line is refused (row-level security, no INSERT policy)" "$(ins $E "audit_log (table_name, record_id, action, changed_by) values ('tasks','x','DELETE','$O')")" "REFUSED"
ok "F1 (local model): ...although the INSERT privilege itself is granted" "$(q "select has_table_privilege('authenticated','audit_log','INSERT')")" "t"
ok "F2 (local model): an inactive user CAN read the audit log" "$( [ "$(cnt $I audit_log)" -gt 0 ] && echo yes)" "yes"

echo "-- PROPOSED defence in depth, tried here only: no INSERT privilege on audit_log for signed-in users"
q "revoke insert, update, delete, truncate on audit_log from authenticated, anon" >/dev/null
ok "after the fix: a forged audit line is refused" "$(ins $E "audit_log (table_name, record_id, action, changed_by) values ('tasks','x','DELETE','$O')")" "DENIED"
before=$(q "select count(*) from audit_log")
psql "${CONN[@]}" -d "$DB" -qtAX -c "begin; set local role authenticated; set local request.jwt.claim.sub = '$E';
  update tasks set title='SYNTHETIC after fix' where id='00000000-0000-4000-8000-00000000b001'; commit;" >/dev/null 2>&1
ok "after the fix: real changes are still audited (trigger runs as definer)" "$(q "select count(*) from audit_log")" "$((before+1))"

echo "-- self-test: a planted weakness is noticed"
q "create policy planted_open_read on expenses for select to authenticated using (true)" >/dev/null
ok "self-test: with a planted open read rule the employee DOES see expenses" "$( [ "$(cnt $E expenses)" != "0" ] && echo noticed)" "noticed"
q "drop policy planted_open_read on expenses" >/dev/null
q "grant select on tasks to anon" >/dev/null
ok "self-test: with a planted anon grant, anon is no longer DENIED" "$( [ "$(cnt anon tasks)" != "DENIED" ] && echo noticed)" "noticed"

psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB" >/dev/null 2>&1
echo "RLS contract: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
