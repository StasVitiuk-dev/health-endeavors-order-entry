-- =============================================================================
-- Health Endeavors - READ-ONLY drift check for the applied security fixes
-- ONE SELECT. Changes NOTHING. Returns no table rows, no customer data.
--
-- Purpose: confirm that the owner-applied production fixes (FIX 1A, 1B, 2 of
-- 2026-10-18, and FIX 3 of 2026-11-27) are still in place and have not drifted or
-- been removed. Run it any time to re-check; it only reads the system catalog.
--
-- HOW TO RUN (Supabase -> SQL Editor -> New query): check the address bar shows
-- the production project, paste the whole file, Run, read the "verdict" column.
-- Every row should say PASS. Any FAIL means that fix is no longer in place.
-- =============================================================================
with checks as (
  -- FIX 1A: not-signed-in visitors (anon) cannot SELECT activity_timeline
  select 1 as ord, 'FIX 1A: visitors blocked from activity_timeline' as fix,
         case when to_regclass('public.activity_timeline') is null then 'FAIL: view missing'
              when has_table_privilege('anon', 'public.activity_timeline', 'SELECT') then 'FAIL: visitors can still read it'
              else 'PASS' end as verdict
  union all
  -- FIX 1B: the view uses the caller's rights (security_invoker = true)
  select 2, 'FIX 1B: activity_timeline uses caller rights (security_invoker)',
         case when to_regclass('public.activity_timeline') is null then 'FAIL: view missing'
              when coalesce((select c.reloptions::text from pg_class c where c.oid = to_regclass('public.activity_timeline')), '') ~* 'security_invoker=(true|on|1|yes)'
                   then 'PASS' else 'FAIL: security_invoker not set' end
  union all
  -- FIX 2: the profiles privileged-column guard trigger exists, is enabled, BEFORE UPDATE, right function
  select 3, 'FIX 2: profiles guard trigger present, enabled, BEFORE UPDATE',
         coalesce((
           select case
             when t.tgname is null then 'FAIL: guard trigger missing'
             when t.tgenabled = 'D' then 'FAIL: guard trigger disabled'
             when (t.tgtype & 2) = 0 then 'FAIL: not a BEFORE trigger'
             when (t.tgtype & 16) = 0 then 'FAIL: not on UPDATE'
             when p.proname <> 'guard_profile_privileged_columns' then 'FAIL: wrong function attached (' || p.proname || ')'
             else 'PASS' end
           from pg_trigger t join pg_proc p on p.oid = t.tgfoid
           where t.tgrelid = to_regclass('public.profiles') and t.tgname = 'profiles_guard_privileged_columns' and not t.tgisinternal
         ), 'FAIL: guard trigger missing')
  union all
  -- FIX 3 (2026-11-27): the ten owner-rights functions; see PRODUCTION_CHANGE_LOG.md
  select 4, 'FIX 3: visitors cannot run any of the ten functions',
         coalesce((select 'FAIL: missing ' || string_agg(s, ', ') from unnest(array[
             'public.check_adverse_event_deadlines()', 'public.check_break_glass_usage()',
             'public.check_stale_privacy_deletion_requests()', 'public.detect_unusual_activity()',
             'public.escalate_overdue_tasks()', 'public.generate_daily_report()',
             'public.raise_activity_alert(text,text,text,text)', 'public.log_customer_data_access(text,text)',
             'public.record_alert(text,text,text,text,text,text,integer)', 'public.generate_account_number()']) s
           where to_regprocedure(s) is null),
           (select 'FAIL: visitors can run ' || string_agg(p.proname, ', ' order by p.proname)
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
             where p.proname in ('check_adverse_event_deadlines','check_break_glass_usage','check_stale_privacy_deletion_requests',
                                 'detect_unusual_activity','escalate_overdue_tasks','generate_daily_report','raise_activity_alert',
                                 'log_customer_data_access','record_alert','generate_account_number')
               and has_function_privilege('anon', p.oid, 'EXECUTE')),
           'PASS')
  union all
  select 5, 'FIX 3: signed-in staff cannot run the seven job-only functions',
         coalesce((select 'FAIL: staff can run ' || string_agg(p.proname, ', ' order by p.proname)
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
             where p.proname in ('check_adverse_event_deadlines','check_break_glass_usage','check_stale_privacy_deletion_requests',
                                 'detect_unusual_activity','escalate_overdue_tasks','generate_daily_report','raise_activity_alert')
               and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
           'PASS')
  union all
  -- the other direction: taking these away breaks the privacy log, stock adjustments, new accounts and sign-up
  select 6, 'FIX 3: staff keep the privacy log, record_alert and the account number; sign-up keeps the account number',
         coalesce((select 'FAIL: ' || string_agg(problem, '; ') from (
             select 'staff cannot run ' || s as problem from unnest(array[
                 'public.log_customer_data_access(text,text)', 'public.record_alert(text,text,text,text,text,text,integer)',
                 'public.generate_account_number()']) s
              where to_regprocedure(s) is not null and not has_function_privilege('authenticated', to_regprocedure(s), 'EXECUTE')
             union all
             select 'sign-up service cannot run public.generate_account_number()'
              where to_regprocedure('public.generate_account_number()') is not null
                and exists (select 1 from pg_roles where rolname = 'supabase_auth_admin')
                and not has_function_privilege('supabase_auth_admin', to_regprocedure('public.generate_account_number()'), 'EXECUTE')
           ) x), 'PASS')
  union all
  select 7, 'FIX 3: the ten keep a fixed schema path',
         coalesce((select 'FAIL: no fixed path: ' || string_agg(p.proname, ', ' order by p.proname)
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
             where p.proname in ('check_adverse_event_deadlines','check_break_glass_usage','check_stale_privacy_deletion_requests',
                                 'detect_unusual_activity','escalate_overdue_tasks','generate_daily_report','raise_activity_alert',
                                 'log_customer_data_access','record_alert','generate_account_number')
               and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search\_path=%')),
           'PASS')
)
select fix as check_name, verdict,
       case when verdict = 'PASS' then 'ok' else '*** INVESTIGATE ***' end as flag
  from checks order by ord;
