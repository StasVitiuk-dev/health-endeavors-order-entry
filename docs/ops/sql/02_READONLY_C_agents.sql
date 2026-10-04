-- =============================================================================
-- Health Endeavors — READ-ONLY agent check (Query C). Changes NOTHING.
-- Run each of the three SELECTs separately (select one, click Run) and send
-- the results. If one says "permission denied" or "does not exist", send that.
-- =============================================================================

-- C1. Agent switches and last runs (what the AI Agent Activity page shows).
select agent_num, enabled, updated_at, last_run_at, last_run_status,
       left(coalesce(last_error, ''), 200) as last_error_start
from agent_controls
order by agent_num;

-- C2. Scheduled jobs inside Supabase (pg_cron). Names and schedules only.
select jobid, jobname, schedule, active
from cron.job
order by jobname;

-- C3. Which database functions and triggers mention stock or invoices
--     (names only — no source code is returned).
select n.nspname || '.' || p.proname as function_name,
       (p.prosrc ilike '%inventory%')            as mentions_inventory,
       (p.prosrc ilike '%inventory_adjustments%') as mentions_inventory_history,
       (p.prosrc ilike '%invoice%')              as mentions_invoices,
       (p.prosrc ilike '%agent_controls%')       as checks_agent_switch
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.prosrc ilike '%inventory%' or p.prosrc ilike '%invoice%' or p.prosrc ilike '%agent_controls%')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
