-- LOCAL ONLY: Query C v3 on a database WITHOUT pg_cron (no cron schema).
-- Must run without error, say "(pg_cron installed) NO", and mask a token-like
-- string in agent error text (grep -c FAKETOKEN → 0). Generated from
-- query_c_mock_test.sql minus every cron line. Runs inside BEGIN … ROLLBACK.
begin;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create table public.agent_controls (agent_num int primary key, enabled boolean, updated_by uuid, updated_at timestamptz, last_run_at timestamptz, last_run_status text, last_run_summary jsonb, last_error text);
insert into agent_controls values (1,true,null,now(),null,null,null,null),(4,true,null,now(),now()-interval '1 hour','ok',null,null),(6,false,null,now(),now()-interval '2 day','error',null,'failed for jane.doe@example.com while sending a very long message '||repeat('x',300)),(10,null,null,null,null,null,null,'call failed: apikey=FAKETOKENabcdefghijklmnopqrstuvwxyz0123456789 rejected');
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
\i docs/ops/sql/02_READONLY_C_agents.sql
rollback;
