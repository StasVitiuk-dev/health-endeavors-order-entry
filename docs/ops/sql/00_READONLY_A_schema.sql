-- =============================================================================
-- Health Endeavors — READ-ONLY schema check (Query A of 2) (for R1–R5 and the
-- approval / purchase-order / upload fixes).
--
-- SAFE TO RUN: this is ONE SELECT statement. It reads system catalogs and
-- counts rows. It creates, changes or deletes NOTHING.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query):
--   1. Paste this whole file. 2. Click "Run".
--   3. In the results grid use "Export → Download CSV" (or select all rows and copy).
--   4. Send the CSV / text back to Claude.
--
-- PRIVACY / SECRETS:
--   * No customer names, emails, addresses or order contents are returned.
--   * Function source code is NOT returned (Agent functions may contain keys);
--     only name, settings and an md5 fingerprint. The one exception is the
--     source of TRIGGER functions on the inventory/purchasing tables, with any
--     line that mentions key/secret/token/password/bearer/authorization
--     replaced by '-- [line removed]'. Glance at those rows before sending.
-- =============================================================================
with
t(tbl) as (values
  ('products'),('inventory'),('inventory_lots'),('inventory_adjustments'),
  ('purchase_orders'),('purchase_order_items'),('suppliers'),('expenses'),
  ('recalls'),('returns'),('orders'),('order_items'),('approval_requests'),
  ('evidence_locker'),('documents'),('audit_log'),('profiles'),('tasks')
),
cols as (
  select '1 column' as section, c.table_name as item,
         c.ordinal_position::text || ' ' || c.column_name || ' ' || c.data_type ||
         case when c.is_nullable = 'NO' then ' NOT NULL' else '' end ||
         coalesce(' DEFAULT ' || c.column_default, '') as detail
  from information_schema.columns c join t on t.tbl = c.table_name
  where c.table_schema = 'public'
),
missing as (
  select '0 table missing' , t.tbl, 'not found in schema public'
  from t where not exists (select 1 from information_schema.tables x where x.table_schema='public' and x.table_name=t.tbl)
),
cons as (
  select '2 constraint', cl.relname, con.conname || ' ' || pg_get_constraintdef(con.oid)
  from pg_constraint con join pg_class cl on cl.oid = con.conrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname
),
idx as (
  select '3 index', tablename, indexname || ': ' || indexdef
  from pg_indexes join t on t.tbl = tablename where schemaname = 'public'
),
rls as (
  select '4 rls', cl.relname, 'row level security ' || case when cl.relrowsecurity then 'ON' else 'OFF' end ||
         case when cl.relforcerowsecurity then ' (forced)' else '' end
  from pg_class cl join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname where cl.relkind = 'r'
),
pol as (
  select '5 policy', p.tablename,
         p.policyname || ' | ' || p.cmd || ' | roles=' || array_to_string(p.roles, ',') ||
         ' | using=' || coalesce(p.qual, '-') || ' | check=' || coalesce(p.with_check, '-')
  from pg_policies p join t on t.tbl = p.tablename where p.schemaname = 'public'
),
grants as (
  select '6 grant', g.table_name, g.grantee || ': ' || string_agg(g.privilege_type, ',' order by g.privilege_type)
  from information_schema.role_table_grants g join t on t.tbl = g.table_name
  where g.table_schema = 'public' and g.grantee in ('anon','authenticated','service_role','public')
  group by g.table_name, g.grantee
),
trg as (
  select '7 trigger', cl.relname,
         tg.tgname || ' → ' || pn.nspname || '.' || p.proname || '() ' ||
         case when tg.tgenabled = 'D' then '[DISABLED] ' else '' end || pg_get_triggerdef(tg.oid)
  from pg_trigger tg join pg_class cl on cl.oid = tg.tgrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname
  join pg_proc p on p.oid = tg.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
  where not tg.tgisinternal
),
trgsrc as (
  select distinct '8 trigger function source (secrets-redacted)', pn.nspname || '.' || p.proname,
         regexp_replace(pg_get_functiondef(p.oid),
           '[^\n]*(key|secret|token|password|bearer|authorization|apikey)[^\n]*', '-- [line removed]', 'gi')
  from pg_trigger tg join pg_class cl on cl.oid = tg.tgrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join pg_proc p on p.oid = tg.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
  where not tg.tgisinternal and cl.relname in
    ('inventory','inventory_lots','inventory_adjustments','purchase_orders','purchase_order_items','expenses','recalls','returns','approval_requests','products')
),
funcs as (
  select '9 function (no source)', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         case when p.prosecdef then 'SECURITY DEFINER' else 'security invoker' end ||
         ' | returns ' || pg_get_function_result(p.oid) || ' | lang ' || l.lanname ||
         ' | md5 ' || md5(pg_get_functiondef(p.oid)) ||
         ' | execute: ' || coalesce((select string_agg(distinct coalesce(r.rolname, 'PUBLIC'), ',') from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                      left join pg_roles r on r.oid = a.grantee where a.privilege_type = 'EXECUTE'), '-')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') -- skip extension functions
),
ext as (
  select '10 extension', e.extname, 'version ' || e.extversion from pg_extension e
)
select * from missing
union all select * from cols union all select * from cons union all select * from idx
union all select * from rls union all select * from pol union all select * from grants
union all select * from trg union all select * from trgsrc union all select * from funcs
union all select * from ext
order by 1, 2, 3;
