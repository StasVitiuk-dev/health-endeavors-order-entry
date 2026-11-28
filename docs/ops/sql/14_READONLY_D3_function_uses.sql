-- =============================================================================
-- Health Endeavors - READ-ONLY Query D3: where the ten FIX 3 functions are used
-- ONE SELECT. Changes NOTHING. Returns no table rows, no customer data and no
-- function code: what each function returns, every place INSIDE the database that
-- uses it (column defaults, triggers, other functions, views, row rules) and which
-- login roles can run it. Run before any change to these functions' rights, so a
-- caller is never cut off by surprise (it found the account-number default and the
-- stock-adjustment caller that shaped FIX 3).
--
-- History: written and run by the owner on 2026-11-27 (about 8:21 PM Central), before FIX 3.
-- HOW TO RUN: as Query D2; read by Claude. Tested: local-test/query_d2_d3_test.sh.
-- =============================================================================
with fn(name) as (values
  ('check_adverse_event_deadlines'),('check_break_glass_usage'),('check_stale_privacy_deletion_requests'),
  ('escalate_overdue_tasks'),('generate_daily_report'),('log_customer_data_access'),('raise_activity_alert'),
  ('record_alert'),('detect_unusual_activity'),('generate_account_number')),
p as (select f.name, pr.oid from fn f join pg_proc pr on pr.proname = f.name
      join pg_namespace n on n.oid = pr.pronamespace and n.nspname = 'public'),
out(ord, check_id, object, detail) as (
  select 1, 'D3 returns', 'public.' || p.name || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         pg_get_function_result(p.oid) || ' | language ' || l.lanname || ' | owner ' || pg_get_userbyid(pr.proowner)
  from p join pg_proc pr on pr.oid = p.oid join pg_language l on l.oid = pr.prolang
  union all   -- used as a column default
  select 2, 'D3 used by default', 'public.' || p.name || '()', c.relname || '.' || a.attname
  from p join pg_attrdef d on pg_get_expr(d.adbin, d.adrelid) ~* ('\m' || p.name || '\M')
  join pg_class c on c.oid = d.adrelid join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  union all   -- the function IS a trigger
  select 3, 'D3 is trigger on', 'public.' || p.name || '()', c.relname || '.' || t.tgname || case when t.tgenabled = 'D' then ' (disabled)' else '' end
  from p join pg_trigger t on t.tgfoid = p.oid and not t.tgisinternal join pg_class c on c.oid = t.tgrelid
  union all   -- called from another function (name appears in its code); names the caller and how it runs
  select 4, 'D3 called by function', 'public.' || p.name || '()',
         n2.nspname || '.' || o.proname || case when o.prosecdef then ' (owner rights, owner ' || pg_get_userbyid(o.proowner) || ')' else ' (caller rights)' end
         || coalesce(' | trigger on ' || (select string_agg(distinct c.relname, ', ') from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgfoid = o.oid and not t.tgisinternal), '')
  from p join pg_proc o on o.prosrc ~* ('\m' || p.name || '\M') and o.oid <> p.oid
  join pg_namespace n2 on n2.oid = o.pronamespace and n2.nspname not in ('pg_catalog', 'information_schema')
  union all   -- used in a view
  select 5, 'D3 used by view', 'public.' || p.name || '()', v.schemaname || '.' || v.viewname
  from p join pg_views v on v.definition ~* ('\m' || p.name || '\M') and v.schemaname not in ('pg_catalog', 'information_schema')
  union all   -- used in a row rule (policy)
  select 6, 'D3 used by policy', 'public.' || p.name || '()', pol.tablename || '.' || pol.policyname
  from p join pg_policies pol on coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '') ~* ('\m' || p.name || '\M')
  union all   -- login and system roles that can run it today (they would lose it if only PUBLIC were revoked)
  select 7, 'D3 can run it', 'public.' || p.name || '()',
         (select string_agg(r.rolname, ', ' order by r.rolname) from pg_roles r
          where r.rolname in ('anon', 'authenticated', 'service_role', 'postgres', 'supabase_auth_admin', 'supabase_admin', 'authenticator', 'pgbouncer', 'supabase_storage_admin')
            and has_function_privilege(r.oid, p.oid, 'EXECUTE'))
  from p
  union all
  select 8, 'D3 summary', '(all)', (select count(*) from p) || ' function versions read; rows 2-6 list every use inside the database')
select check_id, object, detail from out order by ord, object, detail;
