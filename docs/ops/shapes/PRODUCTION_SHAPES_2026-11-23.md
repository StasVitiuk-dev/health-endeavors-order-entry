# Production table shapes read by the owner (read-only), Nov 23, 2026

Status: CURRENT · evidence: the owner ran two read-only queries in the production Supabase project
(`health-endeavors`, branch `main`) on Nov 23, 2026, about 8:20 pm Central, and sent the results.
Structure only: no row contents, no customer data. Recorded so the work that depends on them does
not rely on chat history.

## public.incidents

Columns: `id` uuid (required, generated) · `incident_number` text (unique; set by trigger
`trg_set_incident_number` on insert) · `title` text (required) · `description` text ·
`category` text (required) · `severity` text (required, default `normal`) · `status` text
(required, default `open`) · `responsible_id` uuid · `due_at` timestamptz · `actions_taken` text ·
`resolution` text · `requires_approval` boolean (required, default false) · `approved_by` uuid ·
`approved_at` timestamptz · `closed_at` timestamptz · `created_by` uuid · `created_at`,
`updated_at` timestamptz (required, default now()).

Value rules:
- `category` one of: security, order, customer_complaint, product_safety, shipping, inventory,
  accounting, supplier, manufacturing, integration, regulatory, ai_agent, other.
- `severity` one of: low, normal, high, critical.
- `status` one of: open, investigating, escalated, resolved, closed.
- `approved_by`, `created_by`, `responsible_id` reference `profiles(id)`.

Access rules (row-level security): "Administrator can manage incidents" (ALL, `is_owner_or_admin()`);
"Owner can manage incidents" (UPDATE, active owner); "Staff can report incidents" and
`incidents_insert` (INSERT, any active profile); "Staff can view incidents" and `incidents_select`
(SELECT, any active profile); **`incidents_update` (UPDATE, any active profile)**.

Triggers: `incidents_audit` (after insert/update/delete, `audit_trigger_function()`),
`trg_set_incident_number` (before insert).

What follows:
- **No database step is needed to close an incident from the dashboard**: an owner or administrator
  may update `status`, `actions_taken`, `resolution` and `closed_at`, and the audit trigger records it.
- OWNER DECISION REQUIRED (not urgent): `incidents_update` lets any active employee edit any
  incident. The dashboard's close button is offered to the owner and administrators only; tightening
  the rule in the database would be a separate draft.
- The open incident INC-20260917-0001 ("Break-glass emergency account was used to log in", high) was
  confirmed by the owner on Nov 23 as their own sign-in during setup on Sept 17.

## public.shipments (the Shipping/Tracking agent's table)

Columns: `id` uuid (required, generated) · `order_id` uuid (required, references `orders(id)`) ·
`external_fulfillment_id` text · `carrier` text · `tracking_number` text · `tracking_url` text ·
`shipment_status` text (required, default `pending`; **no value rule**) · `shipped_at`,
`delivered_at`, `last_status_at` timestamptz · `created_at`, `updated_at` timestamptz (required,
default now()).

Rules: primary key `id`; unique (`order_id`, `external_fulfillment_id`); foreign key to `orders`.
Access: "owner can delete shipments" (DELETE), "staff can insert shipments", "staff can update
shipments", "staff can view shipments". Trigger: `shipments_audit`. **Rows: 0.**

What follows for drafts/48 (drop-off receipts), which is BLOCKED because it wanted to create its own
`shipments` table:
- Adapt it to this table: no `dropped_off_at` column, no parcel diary, no uniqueness of a tracking
  number per carrier, and the status column is called `shipment_status` with no fixed list of values.
- The adapted draft should only ADD to this table (new nullable columns such as `dropped_off_at`,
  and its own diary table), keep every existing column and rule, and work with the agent's rows
  (`external_fulfillment_id`). The table is empty today, so nothing has to be converted.
