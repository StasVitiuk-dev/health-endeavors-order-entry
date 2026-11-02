-- =============================================================================
-- Health Endeavors - READ-ONLY drift check for the applied security fixes
-- ONE SELECT. Changes NOTHING. Returns no table rows, no customer data.
--
-- Purpose: confirm that the three owner-applied production fixes (FIX 1A, 1B, 2)
-- are still in place and have not drifted or been removed. Run it any time to
-- re-check; it only reads the system catalog.
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
              when coalesce((select c.reloptions::text from pg_class c where c.oid='public.activity_timeline'::regclass), '') ~* 'security_invoker=(true|on|1|yes)'
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
           where t.tgrelid = 'public.profiles'::regclass and t.tgname = 'profiles_guard_privileged_columns' and not t.tgisinternal
         ), 'FAIL: guard trigger missing')
)
select fix as check_name, verdict,
       case when verdict = 'PASS' then 'ok' else '*** INVESTIGATE ***' end as flag
  from checks order by ord;
