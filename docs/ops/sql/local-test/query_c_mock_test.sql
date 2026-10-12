-- LOCAL ONLY: checks Query C (docs/ops/sql/02_READONLY_C_agents.sql) on the
-- real-shape local schema (01_REAL_SHAPE_…) with mock agent tables, a mock
-- pg_cron schema, a stock-writing function, a wrapper, an invoice trigger and
-- a disabled legacy restock trigger. Everything runs inside BEGIN … ROLLBACK.
-- One mock job command contains a fake key and a fake project host: the
-- output must contain neither (run with: psql … -f this_file | grep -c SUPERSECRET → 0).
-- Run from the repository root: psql -h <socket> -p <port> -d he_real -f docs/ops/sql/local-test/query_c_mock_test.sql
begin;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create schema if not exists cron;
create table cron.job (jobid bigserial primary key, schedule text, command text, nodename text, nodeport int, database text, username text, active boolean default true, jobname text);
create table cron.job_run_details (jobid bigint, runid bigserial, job_pid int, database text, username text, command text, status text, return_message text, start_time timestamptz, end_time timestamptz);
create table public.agent_controls (agent_num int primary key, enabled boolean, updated_by uuid, updated_at timestamptz, last_run_at timestamptz, last_run_status text, last_run_summary jsonb, last_error text);
insert into agent_controls values (1,true,null,now(),null,null,null,null),(4,true,null,now(),now()-interval '1 hour','ok',null,null),(6,false,null,now(),now()-interval '2 day','error',null,'failed for jane.doe@example.com while sending a very long message '||repeat('x',300)),(10,null,null,null,null,null,null,null);
create table public.feature_flags (id uuid default gen_random_uuid(), flag_key text, label text, description text, enabled boolean);
insert into feature_flags (flag_key,enabled) values ('shopify_order_sync',false),('no_ai_mode',false);
create type public.sysmode as enum ('NORMAL','NO_AI');
create table public.system_mode (id boolean primary key, mode2 public.sysmode, mode text, changed_at timestamptz, changed_by uuid);
insert into system_mode values (true,'NORMAL','normal',now(),null);
create table public.ai_decision_log (id bigserial, agent_key text, created_at timestamptz default now(), cost_usd numeric, model_used text);
insert into ai_decision_log (agent_key) values ('customer_service_agent'),('customer_service_agent'),('supervisor');
create function public.agent4_run() returns void language plpgsql security definer as $f$
begin update public.inventory set available = available where false; end $f$;
create function public.agent_wrapper() returns void language plpgsql as $f$ begin perform public.agent4_run(); end $f$;
create function public.notify_customers() returns void language plpgsql as $f$ begin perform 1; end $f$;
create function public.generate_invoice_for_order() returns trigger language plpgsql security definer as $f$
begin if (select enabled from agent_controls where agent_num=1) then null; end if; return new; end $f$;
create trigger trg_generate_invoice_for_order after insert on public.orders for each row execute function generate_invoice_for_order();
create function public.legacy_restock() returns trigger language plpgsql as $f$
begin insert into inventory_adjustments(product_id) select null where false; return new; end $f$;
create trigger legacy_restock_trg after update on public.returns for each row execute function legacy_restock();
alter table public.returns disable trigger legacy_restock_trg;
insert into cron.job (schedule, command, jobname) values
 ('3 * * * *', 'select public.agent_wrapper()', 'agent4-retail-wholesale'),
 ('5 * * * *', $c$select net.http_post(url:='https://abcdefghijk.supabase.co/functions/v1/customer-notify', headers:='{"Authorization":"Bearer SUPERSECRET_TOKEN_123"}'::jsonb)$c$, 'agent6-notify'),
 ('0 3 * * *', 'select public.notify_customers()', 'shopify-order-sync');
insert into cron.job_run_details (jobid,status,start_time) values (1,'succeeded',now()-interval '1 hour'),(1,'failed',now()-interval '2 hour'),(2,'succeeded',now()-interval '30 day');
\i docs/ops/sql/02_READONLY_C_agents.sql
rollback;
