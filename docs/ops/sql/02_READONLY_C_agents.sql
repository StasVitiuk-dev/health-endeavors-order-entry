-- =============================================================================
-- Health Endeavors — READ-ONLY agents, schedules and stock-paths check (Query C)
-- Version 2 (2026-10-06). Replaces the earlier three-statement version.
--
-- ONE SELECT statement. It reads tables and the system catalog and changes
-- NOTHING. Three named columns (section, item, result) so the CSV export
-- keeps every field, like Query B.
--
-- What it does NOT return, on purpose:
--   * no function source code and no scheduled-job command text (a job
--     command can contain a key) — only names and yes/no answers;
--   * no customer data — numbers, names of agents/flags/jobs/functions only;
--   * agent error text is cut to 120 characters with e-mail addresses masked.
--
-- Sections:
--   0 counts            rows per table (numbers only); "table not found" if absent
--   1 agents            each agent switch, last run, last status
--   2 switches          feature flags (on/off) and the system mode
--   3 agent #1 invoices the invoice trigger's state and whether it checks its switch
--   4 shopify sync      evidence of whether Shopify order sync has ever run
--   5 scheduled jobs    each pg_cron job: schedule, active, last run, failures,
--                       which database / edge functions it calls
--   6 stock writers     every database function that writes stock tables
--                       directly, and who can reach it (trigger, job, anon)
--   7 triggers          every trigger on stock / order / purchasing tables
--   8 direct writes     which API roles may write stock tables directly
--
-- Limits: agents that run outside the database (GitHub workflows, edge
-- functions) are only visible through what they record (agent_controls,
-- ai_decision_log, rows they create). Pattern flags ("writes stock directly")
-- are text matches, not proof; a person reads anything flagged before acting.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query):
--   1. Paste this whole file. 2. Click "Run".
--   3. Export → Download CSV and send it back. If it stops with an error,
--      send the exact error message.
-- =============================================================================
with
sys_schemas as (
  select unnest(array['pg_catalog','information_schema','pg_toast','auth','storage',
    'extensions','cron','net','vault','realtime','graphql','graphql_public',
    'pgsodium','pgsodium_masks','supabase_functions','supabase_migrations',
    '_realtime','_analytics','pgbouncer']) as nspname
),
fn as (
  select p.oid, n.nspname, p.proname, p.prosrc, p.prosecdef,
         (p.prorettype = 'trigger'::regtype) as is_trigger_fn,
         p.prosrc ~* '(insert\s+into|update|delete\s+from)\s+("?public"?\.)?"?(inventory|inventory_lots|inventory_adjustments)"?\M' as writes_stock
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prokind in ('f','p')
    and n.nspname not in (select nspname from sys_schemas)
    and n.nspname not like 'pg\_%'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
reach as (  -- writes stock itself, or calls (one level) a function that does
  select f.oid, f.proname,
         f.writes_stock or exists (select 1 from fn w where w.writes_stock and w.oid <> f.oid
                                    and f.prosrc ~* ('\m' || w.proname || '\M')) as reaches_stock
  from fn f
),
jobs as (
  select j.jobid, j.jobname, j.schedule, j.active,
    (select string_agg(distinct f.nspname || '.' || f.proname, ', ' order by f.nspname || '.' || f.proname)
       from fn f where j.command ~* ('\m' || f.proname || '\M')) as calls_functions,
    substring(j.command from '/functions/v1/([A-Za-z0-9_-]+)') as calls_edge_function,
    (j.command ~* 'net\.http_') as uses_http
  from cron.job j
),
runs as (
  select d.jobid, max(d.start_time) as last_start,
         count(*) filter (where d.start_time > now() - interval '7 days') as runs_7d,
         count(*) filter (where d.start_time > now() - interval '7 days' and d.status <> 'succeeded') as not_ok_7d,
         count(*) as runs_total
  from cron.job_run_details d group by d.jobid
),
last_run as (
  select distinct on (d.jobid) d.jobid, d.status
  from cron.job_run_details d order by d.jobid, d.start_time desc
),
trg as (
  select c.relname, t.tgname, t.tgfoid,
         case t.tgenabled when 'O' then 'enabled' when 'D' then 'DISABLED'
                          when 'R' then 'replica only' when 'A' then 'always' end as state
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname = 'public'
)
-- 0 counts ------------------------------------------------------------------
select '0 counts' as section, t as item,
       case when to_regclass('public.' || t) is null then 'table not found'
            else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t), false, true, '')))[1]::text
       end as result
from unnest(array['products','inventory','inventory_lots','inventory_adjustments',
  'orders','order_items','invoices','purchase_orders','purchase_order_items','returns',
  'recalls','approval_requests','documents','tasks','suppliers','expenses','incidents',
  'agent_controls','ai_decision_log','feature_flags','system_mode','service_status',
  'daily_reports','manual_attention_items','audit_log','profiles']) as t
-- 1 agents ------------------------------------------------------------------
union all
select '1 agents', 'agent #' || lpad(coalesce(to_jsonb(a)->>'agent_num', '?'), 2, '0'),
       concat_ws('; ',
         'switch=' || case when (to_jsonb(a)->>'enabled')::boolean then 'ON' when (to_jsonb(a)->>'enabled')::boolean = false then 'off' else 'unknown' end,
         'last_run_at=' || coalesce(to_jsonb(a)->>'last_run_at', 'never recorded'),
         'last_run_status=' || coalesce(to_jsonb(a)->>'last_run_status', 'none'),
         'switch_changed_at=' || coalesce(to_jsonb(a)->>'updated_at', 'unknown'),
         'last_error=' || coalesce(nullif(left(regexp_replace(coalesce(to_jsonb(a)->>'last_error', ''), '[^[:space:]@]+@[^[:space:]@]+', '[email]', 'g'), 120), ''), 'none'))
from agent_controls a
-- 2 switches ----------------------------------------------------------------
union all
select '2 switches', 'flag ' || coalesce(to_jsonb(f)->>'flag_key', '?'),
       case when (to_jsonb(f)->>'enabled')::boolean then 'ON' when (to_jsonb(f)->>'enabled')::boolean = false then 'off' else 'unknown' end
from feature_flags f
union all
select '2 switches', 'system mode',
       coalesce((select (to_jsonb(m)->>'mode') || ' since ' || coalesce(to_jsonb(m)->>'changed_at', '?') from system_mode m limit 1), 'no mode row')
-- 3 agent #1 invoices -------------------------------------------------------
union all
select '3 agent #1 invoices', 'trigger ' || trg.relname || '.' || trg.tgname,
       concat_ws('; ', 'state=' || trg.state, 'function=' || f.nspname || '.' || f.proname,
                 'checks agent switch=' || (f.prosrc ilike '%agent_controls%'))
from trg join fn f on f.oid = trg.tgfoid
where trg.tgname ilike '%invoice%' or f.proname ilike '%invoice%'
union all
select '3 agent #1 invoices', 'invoice trigger present',
       case when exists (select 1 from trg join fn f on f.oid = trg.tgfoid where trg.tgname ilike '%invoice%' or f.proname ilike '%invoice%')
            then 'yes (see rows above)' else 'NO invoice trigger found' end
-- 4 shopify sync ------------------------------------------------------------
union all
select '4 shopify sync', 'flag shopify_order_sync',
       coalesce((select case when (to_jsonb(f)->>'enabled')::boolean then 'ON' else 'off' end
                 from feature_flags f where to_jsonb(f)->>'flag_key' = 'shopify_order_sync' limit 1), 'flag row not found')
union all
select '4 shopify sync', 'orders that came from Shopify (including deleted)',
       (select count(*)::text from orders o
         where coalesce(to_jsonb(o)->>'source', '') ilike '%shopify%'
            or coalesce(to_jsonb(o)->>'shopify_order_id', '') <> '')
union all
select '4 shopify sync', 'scheduled jobs named like shopify / order sync',
       coalesce((select string_agg(j.jobname || ' (runs ever=' || coalesce(r.runs_total, 0) || ')', ', ')
                 from jobs j left join runs r on r.jobid = j.jobid
                 where j.jobname ilike '%shopify%' or j.jobname ilike '%order%sync%' or j.jobname ilike '%intake%'), 'none')
union all
select '4 shopify sync', 'ai_decision_log ' || coalesce(to_jsonb(l)->>'agent_key', '(none)'),
       'rows=' || count(*) || '; latest=' || max(to_jsonb(l)->>'created_at')
from ai_decision_log l group by to_jsonb(l)->>'agent_key'
-- 5 scheduled jobs ----------------------------------------------------------
union all
select '5 scheduled jobs', j.jobname,
       concat_ws('; ', 'schedule=' || j.schedule, 'active=' || j.active,
                 'last_run=' || coalesce(r.last_start::text, 'never'), 'last_status=' || coalesce(lr.status, 'none'),
                 'runs_7d=' || coalesce(r.runs_7d, 0), 'not_succeeded_7d=' || coalesce(r.not_ok_7d, 0),
                 'calls=' || coalesce(j.calls_functions, 'no database function found'),
                 'edge_function=' || coalesce(j.calls_edge_function, 'none'),
                 'uses_http=' || j.uses_http,
                 'reaches stock=' || exists (select 1 from reach x where x.reaches_stock and j.calls_functions ~* ('\m' || x.proname || '\M')))
from jobs j left join runs r on r.jobid = j.jobid left join last_run lr on lr.jobid = j.jobid
union all
select '5 scheduled jobs', '(total)', count(*)::text || ' job(s)' from jobs
-- 6 stock writers -----------------------------------------------------------
union all
select '6 stock writers', f.nspname || '.' || f.proname,
       concat_ws('; ',
         'kind=' || case when f.is_trigger_fn then 'trigger function' else 'callable' end,
         'security_definer=' || f.prosecdef,
         'anon_can_execute=' || has_function_privilege('anon', f.oid, 'EXECUTE'),
         'authenticated_can_execute=' || has_function_privilege('authenticated', f.oid, 'EXECUTE'),
         'fired_by_triggers=' || coalesce((select string_agg(trg.relname || '.' || trg.tgname || ' (' || trg.state || ')', ', ') from trg where trg.tgfoid = f.oid), 'none'),
         'called_by_jobs=' || coalesce((select string_agg(j.jobname, ', ') from jobs j where j.calls_functions ~* ('\m' || f.proname || '\M')), 'none'),
         'called_via_wrapper_by_jobs=' || coalesce((select string_agg(distinct j.jobname, ', ') from jobs j join fn c on j.calls_functions ~* ('\m' || c.proname || '\M')
                                                     where c.oid <> f.oid and c.prosrc ~* ('\m' || f.proname || '\M')), 'none'),
         'checks_caller=' || (f.prosrc ~* '(auth\.uid\(\)|auth\.role\(\)|auth\.jwt\(\)|is_owner_or_admin\(\)|current_role\(\))'))
from fn f where f.writes_stock
union all
select '6 stock writers', '(functions that call a stock writer)',
       coalesce((select string_agg(distinct c.nspname || '.' || c.proname || ' -> ' || w.proname, ', ')
                 from fn c join fn w on w.writes_stock and w.oid <> c.oid and c.prosrc ~* ('\m' || w.proname || '\M')), 'none')
-- 7 triggers ----------------------------------------------------------------
union all
select '7 triggers', trg.relname || '.' || trg.tgname,
       concat_ws('; ', 'state=' || trg.state, 'function=' || coalesce(f.nspname || '.' || f.proname, '(system)'),
                 'writes stock=' || coalesce(f.writes_stock, false))
from trg left join fn f on f.oid = trg.tgfoid
where trg.relname in ('products','inventory','inventory_lots','inventory_adjustments','orders','order_items',
                      'purchase_orders','purchase_order_items','returns','recalls','expenses')
-- 8 direct writes -----------------------------------------------------------
union all
select '8 direct writes', r || ' on ' || t,
       concat_ws('; ',
         'insert=' || has_table_privilege(r, 'public.' || t, 'INSERT'),
         'update=' || has_table_privilege(r, 'public.' || t, 'UPDATE'),
         'delete=' || has_table_privilege(r, 'public.' || t, 'DELETE'),
         'row_security=' || (select case when c.relforcerowsecurity then 'on (forced)' when c.relrowsecurity then 'on' else 'OFF' end
                             from pg_class c where c.oid = ('public.' || t)::regclass))
from unnest(array['inventory','inventory_lots','inventory_adjustments']) t, unnest(array['anon','authenticated']) r
order by 1, 2;
