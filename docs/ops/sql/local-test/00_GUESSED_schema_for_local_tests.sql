-- LOCAL TEST ONLY — NEVER RUN ON SUPABASE.
-- A GUESSED stand-in for the production tables, reconstructed only from how
-- owner-login.html reads and writes them (column names, buckets, statuses).
-- Used to compile and stress-test the DRAFT functions on a throwaway local
-- PostgreSQL. Replace with the real definitions from Query A before any
-- production SQL is finalised.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
-- Supabase-like auth.uid(): reads the JWT subject from a session setting.
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;

create table products (id uuid primary key default gen_random_uuid(), name text not null, sku text unique, cost numeric, active boolean default true);
create table inventory (
  product_id uuid primary key references products(id),
  available int not null default 0, reserved int not null default 0, damaged int not null default 0, sample int not null default 0,
  wholesale int not null default 0, promotional int not null default 0, returned int not null default 0, recalled int not null default 0,
  updated_at timestamptz, updated_by uuid);
create table suppliers (id uuid primary key default gen_random_uuid(), name text);
create table purchase_orders (id uuid primary key default gen_random_uuid(), po_number text unique, supplier_id uuid references suppliers(id),
  status text not null default 'draft' check (status in ('draft','ordered','shipped','received','cancelled')),
  shipping_cost numeric default 0, tax numeric default 0, expense_category text default 'Inventory',
  ordered_at timestamptz, received_at timestamptz, received_by uuid, updated_at timestamptz);
create table purchase_order_items (id uuid primary key default gen_random_uuid(), purchase_order_id uuid not null references purchase_orders(id),
  product_id uuid references products(id), description text, quantity int not null, unit_cost numeric not null default 0,
  quantity_received int not null default 0, landed_unit_cost numeric);
create table inventory_lots (id uuid primary key default gen_random_uuid(), product_id uuid not null references products(id), lot_number text not null,
  purchase_order_id uuid references purchase_orders(id), quantity_received int not null default 0, quantity_remaining int not null default 0,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz);
create table inventory_adjustments (id uuid primary key default gen_random_uuid(), product_id uuid not null references products(id),
  bucket text not null, change_amount int not null, reason text, adjusted_by uuid, lot_id uuid references inventory_lots(id), created_at timestamptz default now());
create table expenses (id uuid primary key default gen_random_uuid(), category text, amount numeric not null, expense_date date not null,
  vendor text, note text, receipt_path text, deleted_at timestamptz, created_at timestamptz default now());
create table recalls (id uuid primary key default gen_random_uuid(), lot_id uuid references inventory_lots(id),
  status text not null default 'initiated', quantity_quarantined int, updated_at timestamptz);
create table orders (id uuid primary key default gen_random_uuid(), order_number text, status text, total numeric);
create table order_items (id uuid primary key default gen_random_uuid(), order_id uuid references orders(id), product_name text, sku text, quantity int);
create table returns (id uuid primary key default gen_random_uuid(), order_id uuid references orders(id), order_item_id uuid references order_items(id),
  status text not null default 'requested', disposition text, refund_amount numeric, received_at timestamptz, refunded_at timestamptz,
  approved_at timestamptz, updated_at timestamptz);
create table approval_requests (id uuid primary key default gen_random_uuid(), action_type text, summary text, status text not null default 'pending',
  reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz default now());
create table evidence_locker (id uuid primary key default gen_random_uuid(), title text, file_path text);
create table documents (id uuid primary key default gen_random_uuid(), title text, file_path text);
create table audit_log (id bigserial primary key, table_name text, row_id text, action text, at timestamptz default now());
create table profiles (id uuid primary key, role text);
create table tasks (id uuid primary key default gen_random_uuid(), status text);

-- Staff-only RLS, roughly like production (real policies come from Query A).
do $$ declare t text; begin
  foreach t in array array['products','inventory','suppliers','purchase_orders','purchase_order_items','inventory_lots',
    'inventory_adjustments','expenses','recalls','orders','order_items','returns','approval_requests'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_all on %I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
