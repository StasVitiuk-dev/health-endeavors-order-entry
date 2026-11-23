-- LOCAL TEST ONLY — NEVER RUN ON SUPABASE.
-- The REAL table shapes of the 18 tables, generated from the owner's
-- read-only Query A output (2026-10-05): columns, types, defaults, CHECK,
-- UNIQUE and foreign keys between these tables, and indexes. (Table shapes are
-- not secret: the public API publishes them to anyone with the anon key.)
-- NOT copied from production: row-level security policies, grants and
-- functions. Below they are simple LOCAL stand-ins, written for testing:
--   * is_owner_or_admin() / current_role() read profiles.role for auth.uid()
--   * stock, purchasing, lots, recalls: owner/administrator only (as Query A
--     shows); returns, approvals, documents, tasks: any active staff
-- Differences on purpose: enum columns (orders.channel, profiles.role) are text
-- here; foreign keys to tables outside these 18 (auth.users, incidents,
-- customers) are left out; profiles.account_number has no generator.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
create sequence if not exists purchase_order_number_seq;
grant usage on sequence purchase_order_number_seq to authenticated;

create table profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'employee',
  department text,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_break_glass boolean NOT NULL DEFAULT false,
  account_number text NOT NULL,
  constraint profiles_account_number_format CHECK ((account_number ~ '^[0-9]{9}$'::text)),
  constraint profiles_account_number_unique UNIQUE (account_number),
  constraint profiles_pkey PRIMARY KEY (id)
);
create table products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sku text,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cost numeric,
  retail_price numeric,
  wholesale_price numeric,
  status text NOT NULL DEFAULT 'draft'::text,
  packaging_info text,
  constraint products_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  constraint products_pkey PRIMARY KEY (id),
  constraint products_sku_key UNIQUE (sku),
  constraint products_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'discontinued'::text])))
);
create table inventory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  available integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  damaged integer NOT NULL DEFAULT 0,
  sample integer NOT NULL DEFAULT 0,
  wholesale integer NOT NULL DEFAULT 0,
  promotional integer NOT NULL DEFAULT 0,
  returned integer NOT NULL DEFAULT 0,
  low_stock_threshold integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  recalled integer NOT NULL DEFAULT 0,
  constraint inventory_available_check CHECK ((available >= 0)),
  constraint inventory_damaged_check CHECK ((damaged >= 0)),
  constraint inventory_pkey PRIMARY KEY (id),
  constraint inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id),
  constraint inventory_product_id_key UNIQUE (product_id),
  constraint inventory_promotional_check CHECK ((promotional >= 0)),
  constraint inventory_reserved_check CHECK ((reserved >= 0)),
  constraint inventory_returned_check CHECK ((returned >= 0)),
  constraint inventory_sample_check CHECK ((sample >= 0)),
  constraint inventory_wholesale_check CHECK ((wholesale >= 0))
);
create table suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  supplier_type text NOT NULL DEFAULT 'supplier'::text,
  contact_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  constraint suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  constraint suppliers_pkey PRIMARY KEY (id),
  constraint suppliers_supplier_type_check CHECK ((supplier_type = ANY (ARRAY['supplier'::text, 'manufacturer'::text, 'lab'::text, 'packaging'::text, 'freight'::text, 'other'::text])))
);
create table purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  po_number text NOT NULL DEFAULT ('PO-'::text || lpad((nextval('purchase_order_number_seq'::regclass))::text, 4, '0'::text)),
  supplier_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  currency text NOT NULL DEFAULT 'USD'::text,
  shipping_cost numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  expense_category text NOT NULL DEFAULT 'manufacturing'::text,
  ordered_at timestamp with time zone,
  expected_at date,
  received_at timestamp with time zone,
  payment_status text NOT NULL DEFAULT 'unpaid'::text,
  notes text,
  created_by uuid,
  received_by uuid,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  constraint purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  constraint purchase_orders_expense_category_check CHECK ((expense_category = ANY (ARRAY['packaging'::text, 'ingredients'::text, 'shipping_supplies'::text, 'advertising'::text, 'software'::text, 'manufacturing'::text, 'other'::text]))),
  constraint purchase_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text]))),
  constraint purchase_orders_pkey PRIMARY KEY (id),
  constraint purchase_orders_po_number_key UNIQUE (po_number),
  constraint purchase_orders_received_by_fkey FOREIGN KEY (received_by) REFERENCES profiles(id),
  constraint purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ordered'::text, 'shipped'::text, 'received'::text, 'cancelled'::text]))),
  constraint purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);
create table purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL,
  product_id uuid,
  description text NOT NULL,
  sku text,
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  quantity_received numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  landed_unit_cost numeric,
  constraint purchase_order_items_pkey PRIMARY KEY (id),
  constraint purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id),
  constraint purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  constraint purchase_order_items_quantity_check CHECK ((quantity > (0)::numeric))
);
create table inventory_lots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  lot_number text NOT NULL,
  purchase_order_id uuid,
  quantity_received numeric NOT NULL,
  quantity_remaining numeric NOT NULL DEFAULT 0,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at date,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  constraint inventory_lots_pkey PRIMARY KEY (id),
  constraint inventory_lots_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id),
  constraint inventory_lots_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  constraint inventory_lots_quantity_received_check CHECK ((quantity_received > (0)::numeric))
);
create table inventory_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  bucket text NOT NULL,
  change_amount integer NOT NULL,
  reason text,
  adjusted_by uuid,
  adjusted_at timestamp with time zone NOT NULL DEFAULT now(),
  lot_id uuid,
  constraint inventory_adjustments_bucket_check CHECK ((bucket = ANY (ARRAY['available'::text, 'reserved'::text, 'damaged'::text, 'sample'::text, 'wholesale'::text, 'promotional'::text, 'returned'::text, 'recalled'::text]))),
  constraint inventory_adjustments_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES inventory_lots(id),
  constraint inventory_adjustments_pkey PRIMARY KEY (id),
  constraint inventory_adjustments_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id)
);
create table expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount numeric NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  receipt_path text,
  constraint expenses_amount_check CHECK ((amount > (0)::numeric)),
  constraint expenses_category_check CHECK ((category = ANY (ARRAY['packaging'::text, 'ingredients'::text, 'shipping_supplies'::text, 'advertising'::text, 'software'::text, 'manufacturing'::text, 'other'::text]))),
  constraint expenses_pkey PRIMARY KEY (id)
);
create table recalls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL,
  product_id uuid,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'high'::text,
  status text NOT NULL DEFAULT 'initiated'::text,
  quantity_quarantined numeric,
  incident_id uuid,
  resolution text,
  resolved_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  constraint recalls_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES inventory_lots(id),
  constraint recalls_pkey PRIMARY KEY (id),
  constraint recalls_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id),
  constraint recalls_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text]))),
  constraint recalls_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'quarantined'::text, 'resolved'::text])))
);
create table orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  external_order_id text,
  order_number text,
  customer_name text,
  customer_email text,
  status text NOT NULL DEFAULT 'pending'::text,
  currency text NOT NULL DEFAULT 'USD'::text,
  subtotal numeric,
  shipping_total numeric,
  tax_total numeric,
  total numeric,
  raw_data jsonb,
  placed_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'shopify'::text,
  entered_by uuid,
  customer_id uuid,
  intake_checked_at timestamp with time zone,
  constraint orders_channel_external_order_id_key UNIQUE (channel, external_order_id),
  constraint orders_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES profiles(id),
  constraint orders_pkey PRIMARY KEY (id)
);
create table order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  sku text,
  product_name text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric,
  line_total numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  constraint order_items_pkey PRIMARY KEY (id)
);
create table returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  order_item_id uuid,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'requested'::text,
  product_condition text,
  refund_amount numeric,
  approved_by uuid,
  approved_at timestamp with time zone,
  received_at timestamp with time zone,
  refunded_at timestamp with time zone,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  disposition text,
  constraint returns_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id),
  constraint returns_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  constraint returns_disposition_check CHECK ((disposition = ANY (ARRAY['restock_available'::text, 'restock_damaged'::text, 'discard'::text]))),
  constraint returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id),
  constraint returns_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  constraint returns_pkey PRIMARY KEY (id),
  constraint returns_product_condition_check CHECK ((product_condition = ANY (ARRAY['resalable'::text, 'damaged'::text, 'used'::text, 'unknown'::text]))),
  constraint returns_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text, 'received'::text, 'refunded'::text, 'closed'::text])))
);
create table approval_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  summary text NOT NULL,
  payload jsonb,
  requested_by uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  constraint approval_requests_pkey PRIMARY KEY (id),
  constraint approval_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES profiles(id),
  constraint approval_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id),
  constraint approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);
create table evidence_locker (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid,
  title text NOT NULL,
  description text,
  evidence_type text,
  external_link text,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  file_path text,
  constraint evidence_locker_added_by_fkey FOREIGN KEY (added_by) REFERENCES profiles(id),
  constraint evidence_locker_pkey PRIMARY KEY (id)
);
create table documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other'::text,
  related_type text,
  related_id uuid,
  document_url text,
  issued_date date,
  expiration_date date,
  notes text,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  file_path text,
  constraint documents_category_check CHECK ((category = ANY (ARRAY['contract'::text, 'insurance'::text, 'certification'::text, 'license'::text, 'tax'::text, 'manufacturing_agreement'::text, 'other'::text]))),
  constraint documents_pkey PRIMARY KEY (id),
  constraint documents_related_type_check CHECK ((related_type = ANY (ARRAY['supplier'::text, 'general'::text]))),
  constraint documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id)
);
create table audit_log (
  id bigint generated by default as identity NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  constraint audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))),
  constraint audit_log_pkey PRIMARY KEY (id)
);
create table tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  related_type text,
  related_id uuid,
  owner_id uuid,
  priority text NOT NULL DEFAULT 'normal'::text,
  status text NOT NULL DEFAULT 'open'::text,
  due_at timestamp with time zone,
  escalated_at timestamp with time zone,
  escalated_to uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  constraint tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  constraint tasks_escalated_to_fkey FOREIGN KEY (escalated_to) REFERENCES profiles(id),
  constraint tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id),
  constraint tasks_pkey PRIMARY KEY (id),
  constraint tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
  constraint tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text])))
);
-- indexes (from Query A)
CREATE UNIQUE INDEX products_sku_unique_idx ON products USING btree (lower(sku)) WHERE (sku IS NOT NULL);
CREATE INDEX po_status_idx ON purchase_orders USING btree (status);
CREATE INDEX po_supplier_idx ON purchase_orders USING btree (supplier_id);
CREATE INDEX po_items_po_idx ON purchase_order_items USING btree (purchase_order_id);
CREATE UNIQUE INDEX inventory_lots_product_lot_idx ON inventory_lots USING btree (product_id, lower(lot_number));
CREATE INDEX idx_returns_order ON returns USING btree (order_id);
CREATE INDEX idx_returns_status ON returns USING btree (status);
CREATE INDEX audit_log_changed_at_idx ON audit_log USING btree (changed_at DESC);
CREATE INDEX audit_log_changed_by_idx ON audit_log USING btree (changed_by, changed_at DESC);
CREATE INDEX audit_log_record_idx ON audit_log USING btree (record_id);
CREATE INDEX audit_log_table_changed_at_idx ON audit_log USING btree (table_name, changed_at DESC);
-- ---------------------------------------------------------------------------
-- LOCAL stand-ins (written for testing, not copied from production)
-- ---------------------------------------------------------------------------
create or replace function public.current_role() returns text language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and is_active and deleted_at is null $$;
create or replace function public.is_owner_or_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('owner','administrator') from profiles where id = auth.uid() and is_active and deleted_at is null), false) $$;
create or replace function public.is_active_staff() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and is_active and deleted_at is null) $$;

-- every change is recorded with the acting user (production has an audit trigger on all 18 tables)
create or replace function public.local_audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  values (tg_table_name, coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', '?'), tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['products','inventory','suppliers','purchase_orders','purchase_order_items','inventory_lots',
    'inventory_adjustments','expenses','recalls','orders','order_items','returns','approval_requests','evidence_locker','documents','tasks','profiles'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function local_audit()', t || '_audit', t);
  end loop;
  -- Owner/administrator only, as in production (Query A)
  foreach t in array array['inventory','inventory_adjustments','inventory_lots','purchase_orders','purchase_order_items','recalls','expenses','suppliers','products'] loop
    execute format('create policy local_owner_admin on %I for all to authenticated using (is_owner_or_admin()) with check (is_owner_or_admin())', t);
  end loop;
  -- Any active staff (read for products/suppliers; read+write for these)
  foreach t in array array['returns','approval_requests','documents','tasks','orders','order_items'] loop
    execute format('create policy local_staff on %I for all to authenticated using (is_active_staff()) with check (is_active_staff())', t);
  end loop;
  foreach t in array array['products','suppliers'] loop
    execute format('create policy local_staff_read on %I for select to authenticated using (is_active_staff())', t);
  end loop;
end $$;
create policy local_self on profiles for select to authenticated using (true);
alter table audit_log enable row level security;
grant select, insert on audit_log to authenticated;
create policy local_audit_read on audit_log for select to authenticated using (true);
-- local stand-in for generate_account_number(): any 9 digits
alter table profiles alter column account_number set default lpad((floor(random() * 1000000000))::bigint::text, 9, '0');
