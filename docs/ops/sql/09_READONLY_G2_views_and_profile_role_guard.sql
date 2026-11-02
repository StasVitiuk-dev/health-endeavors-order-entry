-- =============================================================================
-- Health Endeavors — READ-ONLY follow-up to Query G (Query G2)
-- ONE SELECT statement. Changes NOTHING. No table rows, no customer data, no
-- function source code: only object names, owners and yes/no answers.
--
-- Status: PREPARED (2026-10-18, after the owner's first Query G result), NOT
-- RUN on production yet. Tested read-only on the local throwaway database
-- (local-test/views_profile_guard_test.sh), with planted examples.
--
-- Why: Query G checks row-level security on TABLES. Two things it cannot see:
--   V1  VIEWS. A view normally runs with its OWNER's rights, so it can skip the
--       row-level security of the tables underneath. That is safe only if the
--       view is marked security_invoker (it then uses the caller's rights) or
--       if untrusted roles cannot read it.
--         FAIL = not-signed-in visitors (anon) can read a view that skips RLS
--         WARN = any signed-in user can read a view that skips RLS
--         PASS = the view uses the caller's rights (security_invoker)
--   P1  PROFILES ROLE. Query G shows an UPDATE policy that lets a user update
--       their own profile row. P1 shows whether signed-in users may write the
--       "role" column, and which triggers on profiles could stop a self-promotion.
--       It returns trigger NAMES and a yes/no "mentions role" only.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query): paste the whole
-- file, Run, Export → Download CSV, send the CSV. It only reads.
-- =============================================================================
with views as (
  select c.oid, c.relname, r.rolname as owner, (r.rolsuper or r.rolbypassrls) as owner_bypasses_rls,
         coalesce(c.reloptions::text, '') ~* 'security_invoker=(true|on|1|yes)' as invoker,
         has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
         has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select
    from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_roles r on r.oid = c.relowner
   where n.nspname = 'public' and c.relkind in ('v', 'm')
),
prof_trg as (
  select t.tgname, p.proname, (pg_get_functiondef(p.oid) ~* '\mrole\M') as mentions_role,
         (t.tgtype & 2) <> 0 as before_trigger, (t.tgtype & 16) <> 0 as on_update, t.tgenabled <> 'D' as enabled
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
   where n.nspname = 'public' and c.relname = 'profiles' and not t.tgisinternal
)
select 'V1 view rights' as check_id,
       case when invoker then 'PASS' when anon_select then 'FAIL' when auth_select then 'WARN' else 'INFO' end as level,
       relname as object,
       case when invoker then 'uses the caller''s rights (security_invoker): row-level security applies'
            else 'runs with owner ' || owner || '''s rights' || case when owner_bypasses_rls then ' (owner skips RLS)' else '' end
                 || '; readable by: ' || case when anon_select then 'not-signed-in visitors and ' else '' end
                 || case when auth_select then 'every signed-in user' else 'nobody but the owner' end end as detail
  from views
union all
select 'P1 profiles role column', case when has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') then 'WARN' else 'PASS' end,
       'profiles.role',
       case when has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
            then 'signed-in users hold the UPDATE right on the role column; only a policy or trigger stops someone changing their own role (see the P1 trigger rows)'
            else 'signed-in users cannot update the role column at all' end
 where exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'profiles')
   and exists (select 1 from pg_roles where rolname = 'authenticated')
union all
select 'P1 profiles trigger', 'INFO', tgname,
       'function ' || proname || '; ' || case when before_trigger then 'BEFORE' else 'AFTER' end
         || case when on_update then ' UPDATE' else ' (not on UPDATE)' end
         || '; mentions role: ' || case when mentions_role then 'yes' else 'no' end
         || case when enabled then '' else '; DISABLED' end
  from prof_trg
order by 1, 3;
