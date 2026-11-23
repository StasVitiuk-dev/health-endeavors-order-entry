-- =============================================================================
-- Health Endeavors — READ-ONLY schema check, part 2 (Query A2)
-- ONE SELECT statement. Changes NOTHING. No table rows, no customer data:
-- only table and column NAMES, column types, NOT NULL, and whether row-level
-- security is on.
--
-- Status: PREPARED (2026-10-17, extension 20), NOT RUN on production. Tested
-- read-only on the local throwaway database (local-test/schema_drift_test.sh).
--
-- Why: Query A exported 18 tables. The dashboard also reads 24 other tables
-- and views whose exact columns were never exported (agents, incidents,
-- calendar, compliance pages, Home summary views). The schema contract
-- (tests/tools/schema-contract.js) can only list them as "outside". This query
-- returns their shape in the SAME three-column format as Query A, so
-- tests/tools/schema-drift.js can compare every column the page uses with
-- what production really has. Nothing is guessed: a table that does not exist
-- is reported as "0 table missing".
--
-- HOW TO RUN (Supabase dashboard → SQL Editor → New query): paste the whole
-- file, Run, Export → Download CSV, send the CSV. It only reads.
-- =============================================================================
with t(tbl) as (values
  ('agent_controls'), ('ai_decision_log'), ('ai_model_config'), ('adverse_event_reports'), ('business_rules'),
  ('calendar_events'), ('calendar_notes'), ('customer_inquiries'), ('feature_flags'), ('feature_requests'),
  ('incidents'), ('integrity_check_results'), ('integrity_check_runs'), ('legal_holds'), ('manual_attention_items'),
  ('needs_attention'), ('owner_dashboard_recent_activity'), ('owner_dashboard_summary'), ('personal_calendar_events'),
  ('quality_checks'), ('service_status'), ('sop_documents'), ('system_mode'), ('daily_reports')
)
select '0 table missing' as section, t.tbl as item, 'not found in schema public' as detail
  from t where not exists (select 1 from information_schema.tables x where x.table_schema = 'public' and x.table_name = t.tbl)
union all
select '1 column', c.table_name,
       c.ordinal_position::text || ' ' || c.column_name || ' ' || c.data_type ||
       case when c.is_nullable = 'NO' then ' NOT NULL' else '' end
  from information_schema.columns c join t on t.tbl = c.table_name
 where c.table_schema = 'public'
union all
select '4 rls', cl.relname,
       case cl.relkind when 'v' then 'view (row-level security does not apply to views; the underlying tables decide)'
                       when 'm' then 'materialized view'
                       else 'row level security ' || case when cl.relrowsecurity then 'ON' else 'OFF' end end
  from pg_class cl join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname
 where cl.relkind in ('r', 'p', 'v', 'm')
order by 1, 2, 3;
