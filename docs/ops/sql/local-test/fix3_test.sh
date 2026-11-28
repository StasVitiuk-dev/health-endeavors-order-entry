#!/usr/bin/env bash
# LOCAL TEST ONLY (written Nov 27, 2026, before FIX 3 was installed; added to the repository the same night, after FIX 3 was applied).
# Tests FIX 3 and its rollback exactly as recorded in docs/ops/PRODUCTION_CHANGE_LOG.md ("2026-11-27 · FIX 3":
# the SQL is read from that entry at run time, so the log and the test cannot drift apart) on a throwaway
# database shaped by the owner's Query D2/D3 answers of Nov 27: its D2 answer must equal production's 27 rows
# (below). Function bodies are stand-ins (the real code is not in this repository). Two plausible wrong fixes
# were run against this test before the install: both were caught (see the change-log entry).
# Usage: fix3_test.sh -h <host> -p <port> -U <user>
set -u
CONN=("$@"); DB=he_fix3_test; HERE="$(cd "$(dirname "$0")" && pwd)"; SQLDIR="$(cd "$HERE/.." && pwd)"; ROOT="$(cd "$HERE/../../../.." && pwd)"
READER="$ROOT/tests/tools/query-d2-interpret.js"; D2Q="$SQLDIR/13_READONLY_D2_function_rights.sql"; LOG="$ROOT/docs/ops/PRODUCTION_CHANGE_LOG.md"
TMP=$(mktemp -d)
MADE_ROLE=0; MADE_SR=0
cleanup() { rm -rf "$TMP"; psql "${CONN[@]}" -d postgres -qX -c "drop database if exists $DB with (force)" >/dev/null 2>&1; [ "$MADE_ROLE" = 1 ] && psql "${CONN[@]}" -d postgres -qX -c "drop role if exists supabase_auth_admin" >/dev/null 2>&1; [ "$MADE_SR" = 1 ] && psql "${CONN[@]}" -d postgres -qX -c "drop role if exists service_role" >/dev/null 2>&1; true; }
trap cleanup EXIT
pass=0; fail=0
ok()  { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: expected [$3] got [$2]"; fi; }
has() { if printf '%s' "$2" | grep -qF -- "$3"; then pass=$((pass+1)); echo "  ok   $1"; else fail=$((fail+1)); echo "  FAIL $1: [$3] not in [$(printf '%s' "$2" | tr '\n' ' ' | cut -c1-300)]"; fi; }
sql() { psql "${CONN[@]}" -d $DB -qtAX -v ON_ERROR_STOP=1 "$@"; }
q()   { sql -c "$1" >/dev/null 2>&1 || { fail=$((fail+1)); echo "  SETUP FAILED: $1"; }; }
# try "$role" "$sub" "statement" -> ok | denied | error:<msg>
try() { local out; out=$(sql -c "set role $1; select set_config('request.jwt.claim.sub', '$2', false);" -c "$3" 2>&1) && echo ok || { printf '%s' "$out" | grep -q 'permission denied' && echo denied || echo "error:$(printf '%s' "$out" | tail -1)"; }; }
d2() { sql -F $'\t' -f "$D2Q"; }
# rights as a SET (Postgres may list the same rights in another order after a revoke and re-grant)
acl() { sql -c "select md5(string_agg(oid::regprocedure::text||'|'||coalesce((select string_agg(x::text, ',' order by x::text) from unnest(proacl) x),'')||'|'||coalesce(array_to_string(proconfig,','),''), ';' order by oid::regprocedure::text)) from pg_proc where pronamespace='public'::regnamespace"; }
normd2() { python3 -I -c "
import re,sys
for l in open(sys.argv[1]):
  print(re.sub(r'\{([^}]*)\}', lambda m: '{'+','.join(sorted(m.group(1).split(',')))+'}', l.rstrip()))" "$1" | sort; }
cleanup; TMP=$(mktemp -d)
# the FIX 3 entry: its first ```sql block is the fix as run, its second the rollback
python3 -I -c '
import re,sys
t=open(sys.argv[1]).read()
e=t.split("\n## 2026-11-27 · FIX 3:",1)[1].split("\n## ",1)[0]
b=re.findall(r"```sql\n(.*?)\n```",e,re.S)
open(sys.argv[2]+"/fix.sql","w").write(b[0]+"\n"); open(sys.argv[2]+"/rollback.sql","w").write(b[1]+"\n")' "$LOG" "$TMP" || { echo "cannot read the FIX 3 entry from the change log"; exit 2; }
FIX="$TMP/fix.sql"; ROLLBACK="$TMP/rollback.sql"
psql "${CONN[@]}" -d postgres -qX -v ON_ERROR_STOP=1 -c "create database $DB template template0" >/dev/null || exit 2
psql "${CONN[@]}" -d postgres -qX -c "create role supabase_auth_admin nologin" >/dev/null 2>&1 && MADE_ROLE=1
# the service key's role exists on Supabase; the CI database may not have it
psql "${CONN[@]}" -d postgres -qX -c "create role service_role nologin" >/dev/null 2>&1 && MADE_SR=1
q "create schema auth"; q "create schema extensions"; q "create schema cron"
q "create function auth.uid() returns uuid language sql stable as \$\$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \$\$"
q "grant usage on schema auth, public to anon, authenticated, supabase_auth_admin"; q "grant execute on function auth.uid() to anon, authenticated, supabase_auth_admin"
q "create table public.alerts_log (fn text, at timestamptz default now())"
q "create sequence public.acct_seq"
q "create table cron.job (jobid bigint, jobname text, schedule text, command text, username text)"
mk() { q "create function public.$1 returns $2 language plpgsql security definer $3 as \$b\$ begin $4 end \$b\$"; }
mk "check_adverse_event_deadlines()" void "set search_path = public" "insert into public.alerts_log(fn) values ('adverse');"
mk "check_break_glass_usage()" void "set search_path = auth, public" "insert into public.alerts_log(fn) values ('breakglass');"
mk "check_stale_privacy_deletion_requests()" void "" "insert into public.alerts_log(fn) values ('privacy');"
mk "raise_activity_alert(p_key text, p_severity text, p_title text, p_message text)" void "set search_path = public" "insert into public.alerts_log(fn) values ('raise:'||p_key);"
mk "detect_unusual_activity()" integer "set search_path = public" "perform public.raise_activity_alert('k','low','t','m'); return 1;"
mk "record_alert(p_alert_key text, p_source text, p_category text, p_severity text, p_title text, p_message text, p_renotify_minutes integer)" boolean "" "insert into public.alerts_log(fn) values ('record:'||p_alert_key); return true;"
mk "escalate_overdue_tasks()" integer "" "perform public.record_alert('esc','cron','tasks','low','t','m',60); return 0;"
mk "generate_account_number()" text "set search_path = public" "return 'HE-' || lpad(nextval('public.acct_seq')::text, 6, '0');"
mk "generate_daily_report()" void "set search_path = public" "insert into public.alerts_log(fn) values ('report');"
mk "log_customer_data_access(p_customer_email text, p_reason text)" void "" "if auth.uid() is null then raise exception 'not signed in'; end if; insert into public.alerts_log(fn) values ('privacylog');"
# caller-rights stock adjustment that calls record_alert (D3)
q "create function public.apply_inventory_adjustment(p_qty integer) returns void language plpgsql as \$b\$ begin perform public.record_alert('stock','inv','stock','low','t','m',60); end \$b\$"
q "grant execute on function public.apply_inventory_adjustment(integer) to authenticated"
q "grant insert on public.alerts_log to authenticated"
q "create table public.profiles (id uuid primary key, account_number text default public.generate_account_number())"
q "grant insert, select on public.profiles to authenticated, supabase_auth_admin"
# Supabase's default rights on new functions -> exactly the production ACL text
for f in "check_adverse_event_deadlines()" "check_break_glass_usage()" "check_stale_privacy_deletion_requests()" "detect_unusual_activity()" "escalate_overdue_tasks()" "generate_account_number()" "generate_daily_report()" "log_customer_data_access(text,text)" "raise_activity_alert(text,text,text,text)" "record_alert(text,text,text,text,text,text,integer)"; do q "grant execute on function public.$f to anon, authenticated, service_role"; done
q "insert into cron.job values (1,'check-adverse-event-deadlines','0 */6 * * *','select public.check_adverse_event_deadlines()','postgres'),(2,'check-break-glass-usage','*/15 * * * *','select public.check_break_glass_usage()','postgres'),(3,'check-stale-privacy-deletion-requests','0 9 * * *','select public.check_stale_privacy_deletion_requests()','postgres'),(4,'detect-unusual-activity','7 * * * *','select public.detect_unusual_activity()','postgres'),(5,'escalate-overdue-tasks-hourly','0 * * * *','select public.escalate_overdue_tasks()','postgres'),(6,'generate-daily-report','5 0 * * *','select public.generate_daily_report()','postgres'),(7,'a','0 1 * * *','select 1','postgres'),(8,'b','0 2 * * *','select 1','postgres'),(9,'c','0 3 * * *','select 1','postgres'),(10,'d','0 4 * * *','select 1','postgres')"
echo "FIX 3 on a stand-in shaped by the owner's D2/D3 answers"
echo " 0. the stand-in answers D2 exactly like production did"
cat > $TMP/prod.unsorted <<'PROD'
D2 rights	public.check_adverse_event_deadlines()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 rights	public.check_break_glass_usage()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 rights	public.check_stale_privacy_deletion_requests()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 rights	public.detect_unusual_activity()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 rights	public.escalate_overdue_tasks()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 rights	public.generate_account_number()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 rights	public.generate_daily_report()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 rights	public.log_customer_data_access()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 rights	public.raise_activity_alert()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 rights	public.record_alert()	{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres} | visitor role can run it: YES | runs with owner rights: yes
D2 code	public.check_adverse_event_deadlines()	checks caller: none found; search_path=public
D2 code	public.check_break_glass_usage()	checks caller: none found; search_path=auth, public
D2 code	public.check_stale_privacy_deletion_requests()	checks caller: none found; schema path NOT pinned
D2 code	public.detect_unusual_activity()	checks caller: none found; search_path=public
D2 code	public.escalate_overdue_tasks()	checks caller: none found; schema path NOT pinned
D2 code	public.generate_account_number()	checks caller: none found; search_path=public
D2 code	public.generate_daily_report()	checks caller: none found; search_path=public
D2 code	public.log_customer_data_access()	checks caller: auth.uid(); schema path NOT pinned
D2 code	public.raise_activity_alert()	checks caller: none found; search_path=public
D2 code	public.record_alert()	checks caller: none found; schema path NOT pinned
D2 scheduled job	public.check_adverse_event_deadlines()	job check-adverse-event-deadlines (0 */6 * * *)
D2 scheduled job	public.check_break_glass_usage()	job check-break-glass-usage (*/15 * * * *)
D2 scheduled job	public.check_stale_privacy_deletion_requests()	job check-stale-privacy-deletion-requests (0 9 * * *)
D2 scheduled job	public.detect_unusual_activity()	job detect-unusual-activity (7 * * * *)
D2 scheduled job	public.escalate_overdue_tasks()	job escalate-overdue-tasks-hourly (0 * * * *)
D2 scheduled job	public.generate_daily_report()	job generate-daily-report (5 0 * * *)
D2 summary	(all)	10 of 10 functions found | not found: none | scheduled-job table: present, 10 jobs
PROD
sort $TMP/prod.unsorted > $TMP/prod.tsv
d2 | sort > $TMP/local.tsv
ok "D2 rows identical to production (27 rows)" "$(diff $TMP/prod.tsv $TMP/local.tsv >/dev/null && wc -l < $TMP/local.tsv)" "27"
before=$(acl); d2 > $TMP/before.tsv
echo " 1. before the fix: a visitor can create an alert (the hole)"
ok "visitor runs record_alert" "$(try anon '' "select public.record_alert('x','x','x','x','x','x',1)")" "ok"
echo " 2. the fix"
out=$(sql -f "$FIX" 2>&1); ok "installs" "$?" "0"
has "check shows visitors false on all ten" "$(printf '%s' "$out" | grep -c '|f|')" "10"
echo " 3. visitors: refused on all ten"
for c in "check_adverse_event_deadlines()" "check_break_glass_usage()" "check_stale_privacy_deletion_requests()" "detect_unusual_activity()" "escalate_overdue_tasks()" "generate_account_number()" "generate_daily_report()" "log_customer_data_access('a@b.c','r')" "raise_activity_alert('k','s','t','m')" "record_alert('x','x','x','x','x','x',1)"; do ok "visitor: $c" "$(try anon '' "select public.$c")" "denied"; done
echo " 4. scheduled jobs (as postgres): all six still run, with what they call inside"
q "truncate public.alerts_log"
for c in check_adverse_event_deadlines check_break_glass_usage check_stale_privacy_deletion_requests detect_unusual_activity escalate_overdue_tasks generate_daily_report; do ok "job: $c" "$(sql -c "select public.$c()" >/dev/null 2>&1 && echo ok)" "ok"; done
ok "nested calls ran (raise_activity_alert, record_alert)" "$(sql -c "select count(*) from public.alerts_log where fn in ('raise:k','record:esc')")" "2"
echo " 5. signed-in staff: what the dashboard and stock adjustments need still works"
U=00000000-0000-0000-0000-000000000001
ok "privacy log from the dashboard" "$(try authenticated $U "select public.log_customer_data_access('a@b.c','order view')")" "ok"
ok "stock adjustment (calls record_alert with the person's rights)" "$(try authenticated $U "select public.apply_inventory_adjustment(3)")" "ok"
ok "new account gets its number (default)" "$(try authenticated $U "insert into public.profiles(id) values ('$U')")" "ok"
ok "  ... and it is filled in" "$(sql -c "select account_number like 'HE-%' from public.profiles where id='$U'")" "t"
echo " 6. signed-in staff cannot run the job-only functions"
for c in check_adverse_event_deadlines check_break_glass_usage check_stale_privacy_deletion_requests detect_unusual_activity escalate_overdue_tasks generate_daily_report; do ok "staff: $c" "$(try authenticated $U "select public.$c()")" "denied"; done
ok "staff: raise_activity_alert" "$(try authenticated $U "select public.raise_activity_alert('k','s','t','m')")" "denied"
echo " 7. sign-up service still fills in the account number"
ok "sign-up insert" "$(try supabase_auth_admin '' "insert into public.profiles(id) values ('00000000-0000-0000-0000-000000000002')")" "ok"
echo " 8. settings locked on the four, unchanged on the others"
ok "four pinned now" "$(sql -c "select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('check_stale_privacy_deletion_requests','escalate_overdue_tasks','log_customer_data_access','record_alert') and 'search_path=public, extensions, pg_temp' = any(proconfig)")" "4"
ok "break-glass keeps auth, public" "$(sql -c "select array_to_string(proconfig,',') from pg_proc where proname='check_break_glass_usage'")" "search_path=auth, public"
echo " 9. Query D2 after the fix, read by the corrected checker: all safe"
d2 > $TMP/after.tsv; out=$(node $READER $TMP/after.tsv 2>&1; echo "exit=$?")
has "overall all safe" "$out" "Overall: all expected functions already safe"
has "exit 0" "$out" "exit=0"
ok "no 'confirm pinned' left" "$(printf '%s' "$out" | grep -c 'confirm pinned')" "0"
echo "10. running the fix twice is harmless"
ok "second run" "$(sql -f "$FIX" >/dev/null 2>&1; echo $?)" "0"
echo "11. rollback puts back exactly what production has today"
ok "rollback runs" "$(sql -f "$ROLLBACK" >/dev/null 2>&1; echo $?)" "0"
ok "rights and settings identical to before (fingerprint)" "$(acl)" "$before"
d2 > $TMP/rolled.tsv; ok "D2 identical to before (same rights, any order)" "$(diff <(normd2 $TMP/before.tsv) <(normd2 $TMP/rolled.tsv) >/dev/null && echo same)" "same"
ok "D2 after rollback still reads as FIX 3 targets (the checker handles 'everyone' listed last)" "$(node $READER $TMP/rolled.tsv | grep -c 'FAIL (visitor-callable')" "9"
ok "sign-up service has no extra right left" "$(sql -c "select count(*) from pg_proc p, aclexplode(p.proacl) a where p.proname='generate_account_number' and a.grantee='supabase_auth_admin'::regrole")" "0"
echo "12. it stops, changing nothing, if production is not what D2/D3 showed"
before=$(acl)
q "insert into cron.job values (11,'odd','0 5 * * *','select public.escalate_overdue_tasks()','authenticated')"
out=$(sql -f "$FIX" 2>&1); has "job running as another role -> stops" "$out" "FIX 3 stopped, nothing changed: these jobs would lose access: odd runs as authenticated"
ok "  nothing changed" "$(acl)" "$before"
q "delete from cron.job where jobid=11"
q "alter function public.record_alert(text,text,text,text,text,text,integer) rename to record_alert_x"
before=$(acl)
out=$(sql -f "$FIX" 2>&1); has "a function missing -> stops" "$out" "not found: public.record_alert(text,text,text,text,text,text,integer)"
ok "  nothing changed" "$(acl)" "$before"
q "alter function public.record_alert_x(text,text,text,text,text,text,integer) rename to record_alert"
before=$(acl)
q "alter table cron.job rename to job_x"
out=$(sql -f "$FIX" 2>&1); has "no scheduled-job table -> stops" "$out" "scheduled-job table not found"
ok "  nothing changed" "$(acl)" "$before"
echo "passed $pass, failed $fail"; [ $fail -eq 0 ]
