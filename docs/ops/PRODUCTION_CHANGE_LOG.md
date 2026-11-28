# Production change log

Status: **CURRENT.** One entry per production change, newest first. Each entry shows who approved and ran it, the exact SQL, the exact rollback and the check result. Claude never runs anything on production: the owner runs every change after approving it.

Only changes that are already applied are recorded here. Fixes that are still waiting are not published in this public repository until they are applied.

Fingerprints are the first 16 characters of the file's SHA-256 (`sha256sum <file> | cut -c1-16`), as in `sql-review/START_HERE_GUIDED_RUNS.md`. The five entries of Nov 26–27 were added on Nov 27 (evening) from the evidence already in `PROJECT_RECORD.md` and the review items; until then this log held only the Oct 18 round.

## 2026-11-27 · FIX 3: visitors who are not signed in can no longer run ten owner-rights functions

| | |
|---|---|
| Found by | read-only Query D (2026-10-18; review in `QUERY_D_FUNCTION_SECURITY_REVIEW.md`), confirmed on production by read-only Queries D2 and D3 (owner, 2026-11-27, about 8:10 and 8:21 PM Central). All ten functions ran with the owner's rights and could be run by anyone, signed in or not (`{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`); nine had no check on the caller (`log_customer_data_access` checks `auth.uid()`); four had no fixed schema path. None returns customer data (they return nothing, a number, yes/no, or one account number); the risk was that a visitor could *trigger* them (alerts, reports, escalations, account numbers). No sign of misuse was looked for or found; this is a closed door, not an incident report |
| What the fix does | rights only; no function code, table, row or schedule changes. (A) the six functions only scheduled jobs use (`check_adverse_event_deadlines`, `check_break_glass_usage`, `check_stale_privacy_deletion_requests`, `detect_unusual_activity`, `escalate_overdue_tasks`, `generate_daily_report`) and (B) `raise_activity_alert` (used only inside `detect_unusual_activity`, which runs as the owner): taken away from everyone, visitors and signed-in staff. (C) `log_customer_data_access` (the dashboard's privacy log), `record_alert` (used by stock adjustments with the person's own rights) and `generate_account_number` (fills `profiles.account_number` for every new account): taken away from everyone and visitors, kept for signed-in staff, and given by name to the sign-up service (`supabase_auth_admin`, which had it only through "everyone"). (D) the four with no fixed schema path get `search_path = public, extensions, pg_temp` (what they used before). The database owner (`postgres`, who runs the scheduled jobs) and the service key keep all ten |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project, about 8:34 PM Central |
| Tested before | a throwaway local copy whose Query D2 answer matched production's 27 rows exactly (same rights text, settings and scheduled jobs; stand-in function bodies, since the real code is not in this repository), shaped by Query D3 (the column default, the caller-rights stock function, the nested calls): 50 of 50 checks — visitors refused on all ten; the six jobs and their nested calls still run as the owner; the privacy log, stock adjustment and new-account number still work for staff; staff refused on the seven job-only functions; sign-up still fills the account number; settings pinned; Query D2 afterwards reads "all safe"; running it twice is harmless; the rollback restores the same rights; its three self-checks stop it with nothing changed. Two plausible wrong fixes were tried and caught: taking the ten away from staff too breaks the privacy log, stock adjustments and new accounts (4 checks fail); forgetting the sign-up service breaks sign-up (1 fails). The Oct 18 local plan (23/23) kept staff on all ten; this fix is narrower because D2 and D3 showed who really calls what |
| Downtime | none |
| Dashboard change | none visible. The dashboard calls only `log_customer_data_access` (after sign-in), which staff keep |
| Result: **checked** | the fix's own check (8:34 PM): visitors `false` on all ten; staff `true` only on the three in C; scheduled jobs `true` on all ten; the four settings pinned, the other six unchanged. Query D2 again (about 8:37 PM), read by `tests/tools/query-d2-interpret.js`: "Overall: all expected functions already safe", ten OK, exit 0. Scheduled jobs (about 10:00 PM, last 3 hours): `check-break-glass-usage` succeeded 12 times (last 9:45 PM), `escalate-overdue-tasks-hourly` succeeded (9:00 PM), `detect-unusual-activity` succeeded (9:07 PM), no failed run. Still to confirm: the three jobs not due that evening (midnight, 3 AM, 6:05 PM Central), and the privacy log the first time the dashboard shows a real order (the Orders page had 0 orders, as Query I found on Nov 23) |

SQL that was run:

```sql
-- Health Endeavors: FIX 3. Visitors (not signed in) can no longer run the ten functions.
-- One transaction: all or nothing. It stops BEFORE changing anything if the database is not what D2/D3 showed.
begin;

do $pre$
declare missing text; bad_jobs text;
begin
  -- 1. the ten functions exist with exactly the versions D3 listed
  select string_agg(s, ', ') into missing from unnest(array[
    'public.check_adverse_event_deadlines()', 'public.check_break_glass_usage()',
    'public.check_stale_privacy_deletion_requests()', 'public.detect_unusual_activity()',
    'public.escalate_overdue_tasks()', 'public.generate_account_number()', 'public.generate_daily_report()',
    'public.log_customer_data_access(text,text)', 'public.raise_activity_alert(text,text,text,text)',
    'public.record_alert(text,text,text,text,text,text,integer)']) s
  where to_regprocedure(s) is null;
  if missing is not null then raise exception 'FIX 3 stopped, nothing changed: not found: %', missing; end if;
  -- 2. every scheduled job that uses them runs as the owner (postgres) or a superuser, so it keeps working
  if to_regclass('cron.job') is null then raise exception 'FIX 3 stopped, nothing changed: scheduled-job table not found'; end if;
  execute $q$
    select string_agg(j.jobname || ' runs as ' || j.username, ', ')
    from cron.job j
    where j.command ~* '\m(check_adverse_event_deadlines|check_break_glass_usage|check_stale_privacy_deletion_requests|detect_unusual_activity|escalate_overdue_tasks|generate_daily_report|raise_activity_alert|record_alert|generate_account_number|log_customer_data_access)\M'
      and j.username <> 'postgres'
      and not exists (select 1 from pg_roles r where r.rolname = j.username and r.rolsuper)$q$ into bad_jobs;
  if bad_jobs is not null then raise exception 'FIX 3 stopped, nothing changed: these jobs would lose access: %', bad_jobs; end if;
end $pre$;

-- A. Run only by scheduled jobs (as postgres): nobody else needs them.
revoke execute on function public.check_adverse_event_deadlines()          from public, anon, authenticated;
revoke execute on function public.check_break_glass_usage()                from public, anon, authenticated;
revoke execute on function public.check_stale_privacy_deletion_requests()  from public, anon, authenticated;
revoke execute on function public.detect_unusual_activity()                from public, anon, authenticated;
revoke execute on function public.escalate_overdue_tasks()                 from public, anon, authenticated;
revoke execute on function public.generate_daily_report()                  from public, anon, authenticated;
-- B. Used only inside detect_unusual_activity, which runs as postgres.
revoke execute on function public.raise_activity_alert(text,text,text,text) from public, anon, authenticated;
-- C. Needed by signed-in staff: the dashboard's privacy log; stock adjustments (record_alert);
--    the account number filled in for every new account. Visitors lose them; staff keep them.
revoke execute on function public.log_customer_data_access(text,text)                      from public, anon;
revoke execute on function public.record_alert(text,text,text,text,text,text,integer)      from public, anon;
revoke execute on function public.generate_account_number()                                from public, anon;
grant  execute on function public.log_customer_data_access(text,text)                      to authenticated;
grant  execute on function public.record_alert(text,text,text,text,text,text,integer)      to authenticated;
grant  execute on function public.generate_account_number()                                to authenticated;
-- Sign-up: the sign-up service fills in profiles.account_number through this default. It had access only
-- through "everyone" (PUBLIC); give it the right by name so new accounts keep working.
do $g$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function public.generate_account_number() to supabase_auth_admin';
  end if;
end $g$;
-- D. Lock the settings of the four that were unlocked, to what they see today (public, extensions).
alter function public.check_stale_privacy_deletion_requests()              set search_path = public, extensions, pg_temp;
alter function public.escalate_overdue_tasks()                             set search_path = public, extensions, pg_temp;
alter function public.log_customer_data_access(text,text)                  set search_path = public, extensions, pg_temp;
alter function public.record_alert(text,text,text,text,text,text,integer)  set search_path = public, extensions, pg_temp;

commit;

-- Check (read-only): visitors can run none; staff only the three in C; the scheduled jobs' owner all ten.
select p.oid::regprocedure as function,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as visitors,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as staff,
       has_function_privilege('postgres', p.oid, 'EXECUTE')      as scheduled_jobs,
       coalesce(array_to_string(p.proconfig, ','), 'NOT pinned') as settings
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname in ('check_adverse_event_deadlines','check_break_glass_usage','check_stale_privacy_deletion_requests',
  'escalate_overdue_tasks','generate_daily_report','log_customer_data_access','raise_activity_alert',
  'record_alert','detect_unusual_activity','generate_account_number')
order by 1;
```

Rollback, only if something goes wrong (puts back exactly the rights of 2026-11-27 before the fix; Postgres may list them in another order afterwards, which reads the same):

```sql
-- FIX 3 rollback: puts back exactly the rights Query D2 showed on 2026-11-27 (everyone, visitors, staff and the service key on all ten; four settings unlocked again).
begin;
grant execute on function public.check_adverse_event_deadlines()                       to public, anon, authenticated, service_role;
grant execute on function public.check_break_glass_usage()                             to public, anon, authenticated, service_role;
grant execute on function public.check_stale_privacy_deletion_requests()               to public, anon, authenticated, service_role;
grant execute on function public.detect_unusual_activity()                             to public, anon, authenticated, service_role;
grant execute on function public.escalate_overdue_tasks()                              to public, anon, authenticated, service_role;
grant execute on function public.generate_daily_report()                               to public, anon, authenticated, service_role;
grant execute on function public.raise_activity_alert(text,text,text,text)             to public, anon, authenticated, service_role;
grant execute on function public.log_customer_data_access(text,text)                   to public, anon, authenticated, service_role;
grant execute on function public.record_alert(text,text,text,text,text,text,integer)   to public, anon, authenticated, service_role;
grant execute on function public.generate_account_number()                             to public, anon, authenticated, service_role;
do $g$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'revoke execute on function public.generate_account_number() from supabase_auth_admin';
  end if;
end $g$;
alter function public.check_stale_privacy_deletion_requests()              reset search_path;
alter function public.escalate_overdue_tasks()                             reset search_path;
alter function public.log_customer_data_access(text,text)                  reset search_path;
alter function public.record_alert(text,text,text,text,text,text,integer)  reset search_path;
commit;
```

Check of the scheduled jobs afterwards (read-only):

```sql
-- READ-ONLY, after FIX 3: did the six scheduled jobs keep running? (last 3 hours)
select j.jobname, d.status, count(*) as runs, max(d.start_time) as last_run,
       max(d.return_message) filter (where d.status <> 'succeeded') as last_problem
from cron.job j
left join cron.job_run_details d on d.jobid = j.jobid and d.start_time > now() - interval '3 hours'
where j.command ~* '\m(check_adverse_event_deadlines|check_break_glass_usage|check_stale_privacy_deletion_requests|detect_unusual_activity|escalate_overdue_tasks|generate_daily_report)\M'
group by j.jobname, d.status
order by j.jobname, d.status;
```

The 24-hour check (due Nov 28, about 6:20 PM Central; read-only): the same, over the last 26 hours, so the
three jobs that were not due on Nov 27 (midnight, 3 AM, 6:05 PM) have run at least once. Expected: every job
has a `succeeded` row and no other status; `last_problem` empty.

```sql
-- READ-ONLY, 24 hours after FIX 3: every scheduled job ran, and none failed (last 26 hours)
select j.jobname, d.status, count(*) as runs, max(d.start_time) as last_run,
       max(d.return_message) filter (where d.status <> 'succeeded') as last_problem
from cron.job j
left join cron.job_run_details d on d.jobid = j.jobid and d.start_time > now() - interval '26 hours'
where j.command ~* '\m(check_adverse_event_deadlines|check_break_glass_usage|check_stale_privacy_deletion_requests|detect_unusual_activity|escalate_overdue_tasks|generate_daily_report)\M'
group by j.jobname, d.status
order by j.jobname, d.status;
```

## 2026-11-27 · Step A2 (drafts/74): `shared_settings` gets the `id` the history recorder writes

| | |
|---|---|
| Found by | the first shared save after step A (2026-11-27, about 2:50 AM) was refused by the database: `record "new" has no field "id"`, nothing changed. The owner's read-only look at the history recorder: `audit_trigger_function()` writes `new.id::text`, and `shared_settings` had no `id` (PROJECT_RECORD discrepancy 9) |
| What the fix does | adds `shared_settings.id` (uuid, filled automatically, unique). Nothing else changes |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project, about 4:07 AM Central |
| Tested before | `local-test/shared_settings_audit_id_test.sh` on a copy whose history recorder is production's word for word: the refusal reproduced after step A alone, accepted and recorded after drafts/74, undo restores the refusal (review item 19) |
| Downtime | none |
| Dashboard change | "Settings shared by every device" can now save; before it, every shared save was refused |
| Result: **checked** | install: one `pg_advisory_xact_lock` row, no warning, no error. Read-only check returned `uuid \| 0 \| 1`. Then the owner turned shared settings on again: after a reload the switches page read "Switches are shared"; turning Real profit off and on saved for every device; `shared_settings` holds one row `feature_switches \| staff`, `audit_log` holds 2 rows for it; Accounting → Real profit → Save estimates answered "Estimates saved for every phone and computer" |

SQL that was run: the whole file, unchanged in this repository since:

```sql
-- docs/ops/sql/drafts/74_DRAFT_shared_settings_audit_id.sql  (57 lines, fingerprint 27550a1b2cda75ef)
-- the change itself, after checks that stop without changing anything:
alter table public.shared_settings add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists shared_settings_id_key on public.shared_settings (id);
-- read-only check afterwards:
select format_type(a.atttypid, a.atttypmod) as id_type,
       (select count(*) from public.shared_settings) as settings,
       (select count(*) from pg_indexes where indexname = 'shared_settings_id_key') as unique_index
  from pg_attribute a
 where a.attrelid = 'public.shared_settings'::regclass and a.attname = 'id' and not a.attisdropped;
```

Rollback, only if something goes wrong: `docs/ops/sql/drafts/75_DRAFT_rollback_shared_settings_audit_id.sql`. Shared saves are then refused again; turn "Settings shared by every device" off first.

## 2026-11-27 · Step A (drafts/50): settings and switches shared by every device

| | |
|---|---|
| Found by | the owner's standing rule that settings and switches be the same on every phone and computer (review item 10). Until then each browser kept its own |
| What the fix does | adds the `shared_settings` table, its row rules (owner and administrators save; signed-in staff read only what is meant for them), the history trigger, and `set_shared_setting()` with a version check so two devices cannot overwrite each other silently |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project, about 2:45 AM Central |
| Tested before | `local-test/shared_settings_test.sh`: 51 of 51, three runs in a row, with the two-device check (review item 10) |
| Downtime | none |
| Dashboard change | the switch "Settings shared by every device" shows "Installed"; nothing is shared until it is turned on |
| Result: **checked** | install: one `pg_advisory_xact_lock` row. Read-only check returned `true \| 0 \| 1 \| false` (table present, no settings yet, history trigger present, visitors cannot read). The first shared save was then refused (see Step A2 above); nothing changed |
| Note | a first run, earlier that night, **stopped safely and changed nothing**: production had no `is_active_staff()`. Step 0 (below) added it, then this file was run again |

SQL that was run: the whole file, unchanged in this repository since:

```sql
-- docs/ops/sql/drafts/50_DRAFT_shared_settings.sql  (193 lines, fingerprint 0d17fc4e94fbd847)
-- read-only check afterwards:
select to_regclass('public.shared_settings') is not null as table_present,
       (select count(*) from public.shared_settings) as settings,
       (select count(*) from pg_trigger where tgname = 'shared_settings_audit') as audit_trigger,
       has_table_privilege('anon', 'public.shared_settings', 'select') as visitors_can_read;
```

Rollback, only if something goes wrong: `docs/ops/sql/drafts/51_DRAFT_rollback_shared_settings.sql`. Turn "Settings shared by every device" off first (the switches go back to each browser); Step A2's undo comes before this one.

## 2026-11-27 · Step 0 (drafts/72): the "active staff member" and "role of a switched-on account" checks

| | |
|---|---|
| Found by | Step A's first run stopped safely: production has no `is_active_staff()`. The owner's read-only look listed the role helpers that exist (`current_role()`, `is_owner_or_admin()`); a second look showed `current_role()` answers for switched-off accounts too |
| What the fix does | adds `is_active_staff()` and `active_role()` (the role as text, only for a switched-on account), both with the caller's rights, reading only the person's own account row; visitors cannot run them. Nothing uses them until step A |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project, about 2:15 AM Central |
| Tested before | `local-test/active_staff_helper_test.sh`: 41 of 41 on production's shape; every waiting draft installs on a copy shaped like production with this file first (review item 18) |
| Downtime | none |
| Dashboard change | none |
| Result: **checked** | install: one `pg_advisory_xact_lock` row, no error. Read-only check returned exactly `active_role \| false \| false` and `is_active_staff \| false \| false` (no raised rights; visitors cannot use them) |

SQL that was run: the whole file, unchanged in this repository since:

```sql
-- docs/ops/sql/drafts/72_DRAFT_active_staff_helper.sql  (108 lines, fingerprint da6f7ed3ca5eacc8)
-- read-only check afterwards:
select p.proname as function, p.prosecdef as raised_rights,
       has_function_privilege('anon', p.oid, 'execute') as visitors_can_use
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('active_role', 'is_active_staff')
 order by 1;
```

Rollback, only if something goes wrong: `docs/ops/sql/drafts/73_DRAFT_rollback_active_staff_helper.sql`, and only after steps A2 and A are undone (they use these checks).

## 2026-11-26 · Step 19 (drafts/70): a table for the backup job's reports (backup status on Home)

| | |
|---|---|
| Found by | the plan to show "last night's backup succeeded" on Home (`RECOVERY_AND_BACKUP_READINESS.md`) |
| What the fix does | adds the empty table `backup_reports` (which job, when, worked or not, size; no file names, paths or logs). The owner and administrators can read it; nobody signed in can add, change or delete a line; only the backup job writes, with the key it already uses |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project, Nov 26 evening, Central |
| Tested before | `local-test/backup_reports_test.sh`: 40 of 40 |
| Downtime | none |
| Dashboard change | none until the preview switch "Backup status on Home" is turned on (after the backups repository step) |
| Result: **checked** | install: one `pg_advisory_xact_lock` row. Read-only check returned `true \| 1 \| SELECT \| 0` (reading rules on, one rule, signed-in people may only read, no lines yet) |

SQL that was run: the whole file, unchanged in this repository since:

```sql
-- docs/ops/sql/drafts/70_DRAFT_backup_reports.sql  (73 lines, fingerprint fef6f3402edfcbf6)
-- read-only check afterwards:
select (select relrowsecurity from pg_class where oid = 'public.backup_reports'::regclass) as reading_rules_on,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'backup_reports') as rules,
       (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
         where table_schema = 'public' and table_name = 'backup_reports' and grantee = 'authenticated') as signed_in_may,
       (select count(*) from public.backup_reports) as lines;
```

Rollback, only if something goes wrong: remove the backups repository step first, then `docs/ops/sql/drafts/71_DRAFT_rollback_backup_reports.sql`.

## 2026-11-26 · Step 18 (drafts/68): three history and sign-in functions name `pg_temp` last

| | |
|---|---|
| Found by | the owner's read-only look of Nov 25 (`OWNER_PROTECTION_AND_PRIVATE_HISTORY.md`): three functions fixed their search path without naming `pg_temp`, which Postgres recommends listing last. Not exploitable through the dashboard today |
| What the fix does | changes only that setting on `employee_activity(...)`, `employee_activity_people()` and `list_my_sessions()`, never their text |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project, Nov 26 evening, Central |
| Tested before | `local-test/history_search_path_test.sh`: 17 of 17 (the gap before, closed after, the undo restores the exact earlier setting) |
| Downtime | none |
| Dashboard change | none |
| Result: **checked** | install: one `pg_advisory_xact_lock` row, no warning. Read-only check returned the three expected rows, each setting ending in `pg_temp` |

SQL that was run: the whole file, unchanged in this repository since:

```sql
-- docs/ops/sql/drafts/68_DRAFT_history_functions_search_path.sql  (52 lines, fingerprint 5a842bd5b4bb92c4)
-- the change itself, after checks that stop without changing anything:
alter function public.employee_activity(text, uuid, text, timestamp with time zone, timestamp with time zone, integer, integer) set search_path = public, pg_temp;
alter function public.employee_activity_people() set search_path = public, pg_temp;
alter function public.list_my_sessions() set search_path = auth, public, pg_temp;
-- read-only check afterwards:
select p.proname as function, array_to_string(p.proconfig, '; ') as setting
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('employee_activity', 'employee_activity_people', 'list_my_sessions')
 order by 1;
```

Rollback, only if something goes wrong: `docs/ops/sql/drafts/69_DRAFT_rollback_history_functions_search_path.sql` (puts the three settings back exactly as the Nov 25 look showed them).

## 2026-10-18 · FIX 1B: `activity_timeline` follows the row rules of the tables it reads

| | |
|---|---|
| Found by | read-only Queries G2 and G3 (2026-10-18). After FIX 1A, visitors who are not signed in were blocked, but the view still ran with its owner's rights and did not check who was asking, so every signed-in user could read all of its rows |
| What the fix does | marks the view `security_invoker`: it now runs with the reader's rights, so the row-level security of `orders`, `tasks`, `approval_requests` and `ai_decision_log` applies. The owner still sees everything; other signed-in users see only rows they can already see in those tables |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project `uizrazyehilyzmwttsrn` |
| Tested before | local throwaway database shaped like production (same 33-check run as FIX 2): fix, rollback, re-apply |
| Downtime | none |
| Dashboard change | none: no dashboard page reads this view |
| Result: **checked** | the owner re-ran read-only Query G2 after the change and pasted the full result as text (the CSV attachment did not arrive twice). Claude checked every row: **all 17 views PASS** (`security_invoker`, row-level security applies), including `activity_timeline`. The FIX 2 guard `profiles_guard_privileged_columns` is listed on `profiles` (BEFORE UPDATE, mentions role: yes), next to the unchanged `profiles_audit` and `profiles_lock_account_number`. The P1 column row stays WARN as expected: it only reports the column right, which FIX 2 does not change; the guard is what blocks the change |
| View count note | earlier notes said 16 views. That number came from Query G's G04 list (77 objects − 61 tables). G2 lists 17: `needs_attention` is a view that was not in G04, which only lists objects where visitors hold all rights. It is PASS, so nothing is open for it |

SQL that was run:

```sql
begin;
do $$
begin
  if to_regclass('public.activity_timeline') is null then
    raise exception 'Stopped, nothing was changed: the view public.activity_timeline was not found.';
  end if;
end $$;
alter view public.activity_timeline set (security_invoker = true);
commit;
select relname, reloptions from pg_class where oid = 'public.activity_timeline'::regclass;
```

Rollback, only if something goes wrong (the view runs with its owner's rights again, as before; FIX 1A stays in place):

```sql
begin;
alter view public.activity_timeline reset (security_invoker);
commit;
select relname, reloptions from pg_class where oid = 'public.activity_timeline'::regclass;
```

**Security-fix round of 2026-10-18 (FIX 1A, FIX 2, FIX 1B): complete, checked** against the owner's final Query G2 result. Still open and not part of this round: the wide default rights of the `anon` role found by Query G (G04, WARN), to be reviewed read-only first.

## 2026-10-18 · FIX 2: only the owner can change a person's role, break-glass access or account status

| | |
|---|---|
| Found by | read-only Queries G2 and G3 (2026-10-18). Signed-in users held the UPDATE right on `profiles.role`; the update policy `profiles_update_self` lets a user update their own profile row, and no trigger checked which columns changed. So any signed-in user could change their own `role`, `is_break_glass`, `is_active` or `deleted_at` |
| What the fix does | a BEFORE UPDATE trigger on `profiles` (`profiles_guard_privileged_columns`). A role or break-glass change is refused unless the signed-in caller is the owner. Deactivate / reactivate / delete is refused unless the caller is the owner, or an administrator acting on someone else. Other profile edits are unchanged. Server-side work with no signed-in user (service key, SQL Editor, scheduled jobs) is not affected |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project `uizrazyehilyzmwttsrn` |
| Tested before | local throwaway database shaped like production, including exact copies of the `lock_account_number` trigger and the `profiles_update_self` policy: 33/33 checks. The hole was reproduced, the fix closed it, owner and normal edits still worked, the rollback restored the exact previous behaviour, and re-applying worked |
| Downtime | none |
| Dashboard change | none for the owner |
| Result | the check after the change returned `profiles_guard_privileged_columns`. The owner then re-ran read-only Query G3: the trigger is listed on `profiles`, and its source has the same checks as the SQL below (compared by Claude on the owner's CSV). The owner reports the dashboard still loads normally |
| Note | Query G2's P1 row will still say WARN: it only checks the column right, which is unchanged. The guard is what now stops the change; G3 is the check that shows it |

SQL that was run:

```sql
begin;
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Stopped, nothing was changed: public.profiles was not found.';
  end if;
  if to_regprocedure('public."current_role"()') is null then
    raise exception 'Stopped, nothing was changed: public.current_role() was not found.';
  end if;
end $$;

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_caller uuid := auth.uid();
  v_role   text;
begin
  if v_caller is null then
    return new;  -- not a signed-in API call (database job, service key, SQL editor)
  end if;
  v_role := coalesce(public."current_role"()::text, '');
  if (new.role is distinct from old.role or new.is_break_glass is distinct from old.is_break_glass)
     and v_role <> 'owner' then
    raise exception 'Only the owner can change a person''s role or break-glass access. Nothing was changed.'
      using errcode = '42501';
  end if;
  if (new.is_active is distinct from old.is_active or new.deleted_at is distinct from old.deleted_at)
     and not (v_role = 'owner' or (v_role = 'administrator' and new.id <> v_caller)) then
    raise exception 'Only the owner (or an administrator, for someone else) can deactivate, reactivate or delete an account. Nothing was changed.'
      using errcode = '42501';
  end if;
  return new;
end
$fn$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();
commit;
-- Check (read-only): must list the new trigger
select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_guard_privileged_columns';
```

Rollback, only if something goes wrong (it removes the guard; the previous behaviour returns):

```sql
begin;
drop trigger if exists profiles_guard_privileged_columns on public.profiles;
drop function if exists public.guard_profile_privileged_columns();
commit;
select count(*) as guard_triggers_left from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_guard_privileged_columns';
```

## 2026-10-18 · FIX 1A: visitors who are not signed in can no longer read `activity_timeline`

| | |
|---|---|
| Found by | read-only Queries G, G2 and G3 (2026-10-18). The view ran with its owner's rights, did not check who was asking, and the `anon` role (anyone with the website's public key) could read all of its rows: order numbers and statuses, task titles, approval types and AI decision summaries |
| Approved and run by | Stas (owner), in the Supabase SQL Editor of the production project `uizrazyehilyzmwttsrn` |
| Tested before | local throwaway database shaped like production. The hole was reproduced, the fix applied, the rollback restored the exact previous behaviour, and re-applying worked |
| Downtime | none |
| Dashboard change | none: no dashboard page reads this view |
| Result reported by the owner | `visitors_can_still_read = false` |

SQL that was run:

```sql
begin;
do $$
begin
  if to_regclass('public.activity_timeline') is null then
    raise exception 'Stopped, nothing was changed: the view public.activity_timeline was not found.';
  end if;
end $$;
revoke all on public.activity_timeline from anon;
commit;
select has_table_privilege('anon', 'public.activity_timeline', 'SELECT') as visitors_can_still_read;
```

Rollback, only if something goes wrong (it restores exactly the previous rights):

```sql
begin;
grant all on public.activity_timeline to anon;
commit;
select has_table_privilege('anon', 'public.activity_timeline', 'SELECT') as visitors_can_read_again;
```

**Verification after the change (owner re-ran read-only Query G2, 2026-10-18; results as reported by the owner):**

| Check | Before FIX 1A | After FIX 1A |
|---|---|---|
| V1 `activity_timeline` | FAIL (readable by visitors who are not signed in) | **WARN** (readable by signed-in users only) |
| V1, the other views (owner-reported as 15; the final G2 shows 16 others, see FIX 1B) | PASS | **PASS** (unchanged) |
| P1 (a separate item, not part of this change) | WARN | WARN (unchanged at that time; fixed later the same day by FIX 2, above) |

**Still open for this view at that time:** signed-in users still read it with the owner's rights. Closed later the same day by FIX 1B, above.
