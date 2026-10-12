-- =============================================================================
-- Health Endeavors — READ-ONLY permissions inventory (Query G)
-- ONE SELECT statement. Changes NOTHING. No customer data: only table, policy,
-- role and function NAMES and the policy conditions (no table rows).
--
-- Status: PREPARED (2026-10-10, extension 9), NOT RUN on production. Tested on
-- the local throwaway database (local-test/permissions_inventory_test.sh), with
-- one planted example of each problem.
--
-- Why: the dashboard only works safely if the database's own rules (row-level
-- security, grants) are right; the page's checks are convenience. The rules
-- for many tables were never exported (Query A covered 18 tables). Three
-- concerns were recorded and are checked here:
--   G03 a policy that lets ANY signed-in user change tasks (update ... using (true))
--   G04 table rights granted to anon (people who are NOT signed in)
--   G05 two or more permissive SELECT policies on one table (they add up: the
--       widest one wins, which is easy to overlook)
-- plus the general picture (G01 tables without row-level security, G02 every
-- policy, G06 functions anon can run, G07 tables with RLS on but no policy).
--
-- HOW TO READ: one row per finding. level: PASS / WARN / FAIL / INFO.
--   FAIL = should be fixed before launch; WARN = look at it; INFO = listing.
-- Nothing here changes anything. Any fix is a separate, reviewed draft built
-- from THIS output (docs/ops/PERMISSION_RLS_MAP_EXT9.md §4).
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query): paste the whole
-- file, Run, Export → Download CSV, send the CSV. It only reads.
-- =============================================================================
with app_tables as (
  select c.oid, c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
),
pol as (
  select p.tablename, p.policyname, p.permissive, p.roles::text as roles, p.cmd,
         coalesce(p.qual, '') as using_expr, coalesce(p.with_check, '') as check_expr
    from pg_policies p where p.schemaname = 'public'
),
anon_grants as (
  select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privs
    from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'
   group by table_name
),
anon_funcs as (
  select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
     and p.prokind = 'f'
)
select 'G01 no row-level security' as check_id, case when relrowsecurity then 'PASS' else 'FAIL' end as level,
       relname as object, case when relrowsecurity then 'RLS on' else 'RLS OFF: every signed-in user (and anon, if granted) sees and changes every row' end as detail
  from app_tables
union all
select 'G02 policy', 'INFO', tablename || ' · ' || policyname,
       cmd || ' for ' || roles || case when permissive = 'PERMISSIVE' then '' else ' (restrictive)' end
         || ' · using: ' || left(using_expr, 160) || case when check_expr <> '' then ' · check: ' || left(check_expr, 160) else '' end
  from pol
union all
select 'G03 open task update', case when count(*) = 0 then 'PASS' else 'FAIL' end, 'tasks',
       case when count(*) = 0 then 'no update policy on tasks that allows every signed-in user'
            else count(*) || ' policy(ies) let any signed-in user update tasks: ' || string_agg(policyname, ', ') end
  from pol
 where tablename = 'tasks' and cmd in ('UPDATE', 'ALL') and permissive = 'PERMISSIVE'
   and (using_expr in ('', 'true') or replace(using_expr, ' ', '') in ('(true)', '(auth.uid()ISNOTNULL)', '(auth.role()=''authenticated''::text)'))
union all
select 'G04 anon table rights', case when privs ~ '(INSERT|UPDATE|DELETE|TRUNCATE)' then 'FAIL' else 'WARN' end,
       table_name, 'not-signed-in users hold: ' || privs || ' (RLS still applies, but a missing or wide policy would expose it)'
  from anon_grants
union all
select 'G05 duplicate read policies', 'WARN', tablename,
       count(*) || ' permissive SELECT policies (they add up; the widest wins): ' || string_agg(policyname, ', ' order by policyname)
  from pol where cmd in ('SELECT', 'ALL') and permissive = 'PERMISSIVE'
 group by tablename having count(*) > 1
union all
select 'G06 anon can run function', 'WARN', proname, 'not-signed-in users can call this function'
  from anon_funcs
union all
select 'G07 RLS on, no policy', 'INFO', t.relname, 'nobody but the owner role can use this table (fine if intended)'
  from app_tables t where t.relrowsecurity and not exists (select 1 from pol where pol.tablename = t.relname)
order by 1, 3;
