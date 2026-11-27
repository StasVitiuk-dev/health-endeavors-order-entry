#!/usr/bin/env bash
# LOCAL TEST ONLY (Nov 27, 2026). Never point this at Supabase.
# Tests tests/tools/rls-analyzer.js on the REAL output of Query G (06_READONLY_G_permissions_inventory.sql)
# and Query A (00_READONLY_A_schema.sql), run read-only on a throwaway copy of the local database with
# planted policies (made-up tables, no data). The analyzer had no test; this one found that it judged a
# "people may edit their own row" policy by WORDS in the policy, not by the table's columns, so a self-edit
# on a table with a role column was called benign and an owner-gated policy was flagged; and it only counted
# *_id columns as "own row", so created_by = auth.uid() was not seen at all. Both fixed with it.
# Usage: rls_analyzer_test.sh -h /var/tmp/hepg -p 5499 -U postgres   (source db: he_real)
set -u
CONN=("$@"); SRC=he_real; DB=he_rls_analyzer_test
DIR="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$DIR/../../.." && pwd)"
TOOL="$ROOT/tests/tools/rls-analyzer.js"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"; psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1' EXIT
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3], got [$2]"; fi; }
has() { if printf '%s' "$2" | grep -qF -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected to find [$3] in [$(printf '%s' "$2" | tr '\n' ' ' | cut -c1-300)]"; fi; }
q()   { psql "${CONN[@]}" -d "$DB" -qtAX -v ON_ERROR_STOP=1 -c "$1" >/dev/null 2>&1 || echo "SETUP FAILED: $1"; }
# run both read-only queries, then the analyzer; prints its output and "exit=<code>"
analyze() {
  psql "${CONN[@]}" -d "$DB" -q --csv -c "begin read only;" -f "$DIR/06_READONLY_G_permissions_inventory.sql" -c "commit;" > "$TMP/g.csv" 2>&1
  psql "${CONN[@]}" -d "$DB" -q --csv -c "begin read only;" -f "$DIR/00_READONLY_A_schema.sql" -c "commit;" > "$TMP/a.csv" 2>&1
  local out code; out=$(node "$TOOL" "$TMP/g.csv" ${1:-"$TMP/a.csv"} 2>&1); code=$?
  printf '%s\nexit=%s' "$out" "$code"
}
psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template $SRC" >/dev/null || { echo "cannot copy $SRC"; exit 2; }
q "do \$\$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end \$\$"
echo "RLS analyzer on real Query G + Query A output (throwaway database $DB)"

echo " 1. the local copy as it is"
out=$(analyze)
has "no self-escalation found" "$out" "Verdict: no profiles-style self-escalation found."
has "  exit 0" "$out" "exit=0"
has "the Query A file really has column rows" "$(grep -c '^1 column,returns,' "$TMP/a.csv")" "1"

echo " 2. people may edit their own row on a table WITH a sensitive column (returns.approved_by)"
q "create policy zz_self_edit_returns on public.returns for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid())"
out=$(analyze)
has "REVIEW, naming the column" "$out" "*** REVIEW *** returns :: zz_self_edit_returns  (sensitive column: approved_by)"
has "  exit 2" "$out" "exit=2"
q "drop policy zz_self_edit_returns on public.returns"
q "create policy zz_self_edit_returns2 on public.returns for update to authenticated using ((select auth.uid()) = created_by)"
out=$(analyze)
has "  also when written the recommended way, (select auth.uid())" "$out" "*** REVIEW *** returns :: zz_self_edit_returns2  (sensitive column: approved_by)"
q "drop policy zz_self_edit_returns2 on public.returns"

echo " 3. the same on a table with NO sensitive column (tasks), written the other way round"
q "create policy zz_self_edit_tasks on public.tasks for update to authenticated using (auth.uid() = owner_id)"
out=$(analyze)
has "benign, because its columns were checked" "$out" "ok  tasks :: zz_self_edit_tasks  (columns checked: none sensitive)"
has "  exit 0" "$out" "exit=0"
echo " 4. without the Query A file the same table is REVIEW, never benign"
out=$(analyze /dev/null)
has "REVIEW: columns not known" "$out" "*** REVIEW *** tasks :: zz_self_edit_tasks  (columns not known"
has "  exit 2" "$out" "exit=2"
q "drop policy zz_self_edit_tasks on public.tasks"

echo " 5. a new table outside Query A's list, with a role column, edited by its own person"
q "create table public.zz_staff_prefs (id uuid primary key, user_id uuid, role text, note text)"
q "alter table public.zz_staff_prefs enable row level security"
q "create policy zz_self_edit on public.zz_staff_prefs for update to authenticated using (user_id = auth.uid())"
out=$(analyze)
has "REVIEW: columns not known (it used to say benign)" "$out" "*** REVIEW *** zz_staff_prefs :: zz_self_edit  (columns not known"
has "  exit 2" "$out" "exit=2"
q "drop table public.zz_staff_prefs"

echo " 6. a policy that checks for the owner is not flagged just for the words in it"
q "create policy zz_owner_only on public.tasks for update to authenticated using (owner_id = auth.uid() and public.current_role() = 'owner')"
out=$(analyze)
has "no self-escalation (the old analyzer said REVIEW for the words role and owner)" "$out" "Verdict: no profiles-style self-escalation found."
has "  exit 0" "$out" "exit=0"
q "drop policy zz_owner_only on public.tasks"

echo " 7. the table reviewed by hand on Oct 18 stays benign, with its source"
q "create table public.personal_calendar_events (id uuid primary key, owner_id uuid, title text)"
q "alter table public.personal_calendar_events enable row level security"
q "create policy pce_own on public.personal_calendar_events for update to authenticated using (owner_id = auth.uid())"
out=$(analyze)
has "benign, citing the review" "$out" "ok  personal_calendar_events :: pce_own  (reviewed by hand 2026-10-18"
has "  exit 0" "$out" "exit=0"

echo " 8. profiles: pointed to its guard and the drift check"
q "create policy zz_profiles_self on public.profiles for update to authenticated using (id = auth.uid())"
out=$(analyze)
has "names the FIX 2 guard and the drift check" "$out" "protected only by the FIX 2 guard. Confirm the guard with the drift check"

echo " 9. a file that is not Query G is refused"
printf 'section,item,detail\n1 column,x,1 a text\n' > "$TMP/other.csv"
node "$TOOL" "$TMP/other.csv" >/dev/null 2>&1; ok "exit 3 (not interpretable)" "$?" "3"

echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
