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
- CURRENT (built Nov 24, behind the owner's switch `he_incident_close`, off until turned on under
  Feature Flags → "features that save real records"): the Incidents page offers the owner and
  administrators **Record what was done** on each open incident. It saves `actions_taken` (and
  `resolution` when filled), and on "Save and close" also `status = 'closed'` and `closed_at`. The save
  only goes through while the incident is unchanged since the list was read (`status` and `updated_at`
  must still match). Nothing is deleted; closed incidents are listed with their note. Rules:
  `assets/views/he-incident-close.js`; screen: `assets/app/he-incidents.js`; tests:
  `tests/specs/incident-close-ext24.spec.js`.
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

What followed for drafts/48 (drop-off receipts), which was BLOCKED because it wanted to create its
own `shipments` table:
- DEPRECATED (first idea, Nov 23): add columns such as `dropped_off_at` to this table.
- CURRENT (Nov 24): the draft was rewritten to **never change this table**. It keeps its records in
  two tables of its own (`order_parcels`, `order_parcel_events`) and only reads `order_id`,
  `carrier` and `tracking_number` here, to find the order of a label the agent already knows. Why
  this instead of adding columns: the agent's code is not in this repository and the table has no
  rows yet, so nobody can say how the agent writes it; a guard or a required column added here could
  stop the agent's hourly run, and a link to its rows could stop it deleting them. Reading only
  cannot. Review page: `docs/ops/sql-review/ITEM_9_DRAFT_48_ORDER_PARCELS.md`.
