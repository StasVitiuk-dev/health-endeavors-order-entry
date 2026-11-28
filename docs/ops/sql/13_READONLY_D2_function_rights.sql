-- =============================================================================
-- Health Endeavors - READ-ONLY Query D2: the ten owner-rights functions of FIX 3
-- ONE SELECT. Changes NOTHING. Returns no table rows, no customer data and no
-- function code: for each of the ten functions only who may run it, whether its
-- code checks who is calling (a yes/no pattern match), whether its schema path is
-- fixed, and which scheduled jobs use it.
--
-- History: written and run by the owner on 2026-11-27 (about 8:10 PM Central) before
-- FIX 3, and again after it (about 8:37 PM: "all expected functions already safe").
-- Kept out of the repository until FIX 3 was applied; see PRODUCTION_CHANGE_LOG.md.
--
-- HOW TO RUN (Supabase -> SQL Editor -> New query): paste the whole file, Run, copy the
-- result (JSON or CSV) and send it. Read it with tests/tools/query-d2-interpret.js:
-- since FIX 3 every function should read OK. Tested: local-test/query_d2_d3_test.sh.
-- =============================================================================
with fn(name) as (values
  ('check_adverse_event_deadlines'),('check_break_glass_usage'),('check_stale_privacy_deletion_requests'),
  ('escalate_overdue_tasks'),('generate_daily_report'),('log_customer_data_access'),('raise_activity_alert'),
  ('record_alert'),('detect_unusual_activity'),('generate_account_number')),
p as (
  select f.name, pr.oid, pr.proacl, pr.prosecdef, pr.proconfig,
         pr.prosrc ~* 'auth\.uid\s*\(' as g_uid,
         pr.prosrc ~* 'current_role\s*\(' as g_role,
         pr.prosrc ~* 'is_owner_or_admin\s*\(' as g_owner,
         pr.prosrc ~* 'request\.jwt' as g_jwt,
         pr.prosrc ~* 'is_active_staff\s*\(' as g_staff,
         pr.prosrc ~* 'active_role\s*\(' as g_active
  from fn f join pg_proc pr on pr.proname = f.name
  join pg_namespace n on n.oid = pr.pronamespace and n.nspname = 'public'),
per_fn as (   -- one row per name; several versions of one name are judged together
  select name, count(*) as versions,
    string_agg(coalesce(proacl::text, 'default: everyone'), ' ; ' order by oid) as rights,
    bool_or(has_function_privilege('anon', oid, 'EXECUTE')) as visitor_can_run,
    bool_or(prosecdef) as owner_rights,
    concat_ws(', ',
      case when bool_or(g_uid) then 'auth.uid()' end,
      case when bool_or(g_role) then 'current_role()' end,
      case when bool_or(g_owner) then 'is_owner_or_admin()' end,
      case when bool_or(g_jwt) then 'request.jwt' end,
      case when bool_or(g_staff) then 'is_active_staff()' end,
      case when bool_or(g_active) then 'active_role()' end) as gates,
    bool_and(exists (select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search\_path=%')) as path_pinned,
    string_agg(distinct (select c from unnest(coalesce(proconfig, '{}')) c where c like 'search\_path=%'), ' ; ') as path
  from p group by name),
jobs as (     -- scheduled jobs (pg_cron); read only if that table exists and may be read
  select x.jobname, x.schedule, x.command
  from (select query_to_xml('select jobname::text, schedule::text, command::text from cron.job', false, false, '') as doc
        where case when to_regclass('cron.job') is null then false else has_table_privilege('cron.job', 'select') end) d,
  xmltable('/table/row' passing d.doc columns jobname text, schedule text, command text) x),
out(ord, check_id, object, detail) as (
  select 1, 'D2 rights', 'public.' || name || '()',
    rights || ' | visitor role can run it: ' || case when visitor_can_run then 'YES' else 'no' end
           || ' | runs with owner rights: ' || case when owner_rights then 'yes' else 'no' end
           || case when versions > 1 then ' | versions: ' || versions else '' end
  from per_fn
  union all
  select 2, 'D2 code', 'public.' || name || '()',
    'checks caller: ' || coalesce(nullif(gates, ''), 'none found') || '; '
    || case when path_pinned then path else 'schema path NOT pinned' end
  from per_fn
  union all
  select 3, 'D2 scheduled job', 'public.' || f.name || '()', 'job ' || j.jobname || ' (' || j.schedule || ')'
  from jobs j join fn f on j.command ~* ('\m' || f.name || '\M')
  union all
  select 4, 'D2 summary', '(all)',
    (select count(*) from per_fn) || ' of 10 functions found'
    || ' | not found: ' || coalesce((select string_agg(name, ', ' order by name) from fn where name not in (select name from per_fn)), 'none')
    || ' | scheduled-job table: ' || case when to_regclass('cron.job') is null then 'not present' when not has_table_privilege('cron.job', 'select') then 'present but NOT readable (jobs unknown)' else 'present, ' || (select count(*) from jobs) || ' jobs' end)
select check_id, object, detail from out order by ord, object, detail;
