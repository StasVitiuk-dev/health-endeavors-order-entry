# Data model dictionary (EXT13)

**AUTHORITATIVE AS OF:** 2026-10-11 · table shapes from the owner's read-only Query A (Oct 5), mirrored in `sql/local-test/01_REAL_SHAPE_schema_for_local_tests.sql` · page code `32c05e2`.
For engineers and reviewers. Only the tables that matter for operations. Permissions detail: `PERMISSION_RLS_MAP_EXT9.md`. Write-path detail (generated): `WRITE_PATH_INVENTORY.md`, `MUTATION_WRITE_PATH_INVENTORY.json`.

**Write authority:**

- **O/A** = owner or administrator (`is_owner_or_admin()`);
- **Staff** = any active staff;
- **Agent** = an automation outside the page.

**Audit:**

- **Known** = an audit trigger writes `audit_log` (REPORTED / Query A);
- **Expected** = should have one (listed in `AUDIT_REQUIRED`), but UNKNOWN until Query C §10.

## 1. Tables

| Table | Purpose | Important keys | Critical relationships | Write authority | Audit |
|---|---|---|---|---|---|
| `products` | catalogue | `id`; unique `lower(sku)` | ← inventory, lots, order lines (by SKU text), PO lines | O/A | Expected |
| `inventory` | stock per product in 8 buckets (available, reserved, damaged, sample, wholesale, promotional, returned, recalled) | `product_id` (one row per product) | → products | O/A (R1–R5 when on) | Expected |
| `inventory_adjustments` | stock history: every change with bucket, amount, reason, who | `id` | → products, optional lot | O/A | Expected |
| `inventory_lots` | lots received (number, received, remaining) | `id` | → products, purchase order | O/A | — |
| `suppliers` | suppliers | `id` | ← purchase orders | O/A | — |
| `purchase_orders` | orders to suppliers; status ordered/shipped/received/…; soft delete | `id`, `po_number` | ← PO lines; → supplier; one expense when received | O/A | Expected |
| `purchase_order_items` | PO lines (product or free text, quantity, unit cost, quantity received) | `id` | → PO, product | O/A | — |
| `expenses` | money spent (incl. one per received PO); soft delete; receipts in storage | `id`; `client_request_id` after draft 19 | — | O/A | — |
| `orders` | customer orders (manual or synced); totals; soft delete | `id`, `order_number` (page-checked unique) | ← order lines, returns | Staff | **Known** |
| `order_items` | order lines (SKU text, quantity, price) | `id` | → order; SKU text → product | Staff | — |
| `returns` | return per order line; status, disposition, refund amount/date | `id` | → order line | Staff (restock O/A) | Expected |
| `recalls` | recall per lot; status, quantity quarantined | `id` | → lot | O/A | Expected |
| `approval_requests` | requests waiting for a person (agent #3, others) | `id` | — | Staff today (decision #10) | Expected |
| `tasks` | work items | `id` | — | Staff (broad update policy to verify: Query G G03) | **Known** |
| `incidents` | incidents; escalation from checks/recalls at most once | `id`, `incident_number`; `client_request_id` | ← evidence | Staff | — |
| `evidence_locker`, `documents` | files and their records (storage) | `id` | → storage object | Staff | — |
| `feature_flags` | switches | `flag_key` | — | O/A expected; rule UNKNOWN (decision #11) | Expected |
| `system_mode`, `business_rules`, `agent_controls` | emergency mode, rules, agent switches | keys | — | O/A expected; rule UNKNOWN | Expected |
| `audit_log` | change history written by triggers | `id` | → any audited row | trigger only | — |
| `integrity_check_runs`, `integrity_check_results` (drafts 25/29) | nightly check results | `id`, `run_id` | — | the check function only; read O/A | — |
| `profiles` | people and roles | `id` = auth user | — | own row | — |

## 2. High-risk write paths (button → code → table/function → record → what the person sees)

| Action | Where | Today (switch OFF) | With its switch ON | Record left | Shown |
|---|---|---|---|---|---|
| Receive PO | Purchase Orders → Receive delivery | claim status → lots → stock (+ history) → expense, each a separate write; a failure part-way is detected and listed | `receive_purchase_order` (one transaction) | lots, history rows, expense, `received_by` | "Received"; partial failure lists what to finish; lost reply → "Receipt status unknown" + "Check this order now" |
| Manual stock change | adjustment form | stock update guarded by the old value, then a history row | `adjust_inventory` with the expected old value | history row with reason | "changed since the page loaded" on a stale value |
| Return received | Returns → Mark received | claim status → restock + history | `receive_return` | history row "Return received…" | "Chosen outcome: …"; lost reply → read back and say which happened |
| Recall quarantine | Recalls → Quarantine | claim status → move stock to quarantine | `quarantine_recall` | quantity quarantined, history | same read-back rule |
| Delete product | Products | refused if any history; else stock row + product | `delete_unused_product` | none (refused when history exists) | "archive instead" |
| Approve / reject | Approval Queue | conditional status change (pending only) | — | `decided_by` | stale → "changed elsewhere" |
| Create (18 paths) | each form | insert; lost reply → "check the list" | with `request_keys` ON: insert with key; repeat → "already saved" | the row | see `OPERATOR_QUICK_REFERENCE_EXT10.md` §2 |
| Feature switch | Feature Switches | password + probe for its database step | — | flag row | refused with the reason when the step is missing |

## 3. Read paths (what feeds the screens)

| Screen | Reads | Freshness |
|---|---|---|
| Home | open tasks/approvals/inquiries, checks (attention rows), nightly card (if installed), revenue tiles | "Checked at …"; 15-minute note; nightly 26-hour staleness |
| Search / palette | in-memory lists + "look up in all orders" (literal match) | per page load |
| System status (Continuity) | switches, agent controls, database-step probes (only while open) | on open |
| Accounting / Tax | paged orders, expenses, returns | per page load; latest request wins |

## 4. Side effects (what else changes when you press the button)

| Action | Side effects |
|---|---|
| PO receive | stock ↑ per line · lots created · one expense · PO status received · history rows |
| Return received | stock ↑ in the chosen bucket (or none for discard) · history row · return status |
| Recall quarantine | available ↓ · recalled ↑ · recall status · history |
| Manual adjustment | one bucket ± · history row |
| Delete / deactivate product | delete only if unused; otherwise archive (product inactive, history kept) |
| Approval | request status; the requesting agent/person acts on it later (never automatic money movement) |

## 5. Intentionally not atomic today (eventual consistency)

| Flow | Why | Safety net |
|---|---|---|
| PO receive, return restock, recall quarantine, manual adjustment (switches OFF) | multi-step from the browser until R1–R4 are installed | claim-first status change; read-back after a lost reply; partial-failure lists; Query E; `test.fail` tests mark the wanted atomic behaviour |
| Document upload (file, then record) | storage and table are separate services | orphan cleanup; record removed if the upload fails |
| Escalate to incident (incident, then link) | two writes | key made from the record → at most one incident |
| Accounting / Tax figures | computed in the page on load | oracle tests; "—" when unknown |
| Agents' work (#4 customer linking, #5 tasks) | outside the page, hourly | Query C shows last run and status |

## 6. Invariants: catalogue, tests and production checks

Rules (I-1 … I-24) and enforcement: `DATA_INTEGRITY_RULES_EXT10.md` (authoritative for wording). This table adds the production check for each.

| # | Rule (short) | Tests | Production check |
|---|---|---|---|
| I-1 | stock never silently doubles | `po-receive`, `failure-recovery`, `inventory-safety`, `stock-functions`, `concurrency_test.sh` | Query E (stock vs history; deliveries vs stock) |
| I-2 | a received PO cannot be received again | `po-receive`, `stock-functions` | Query E; Query F F05 |
| I-3 | one delivery = one expense | `concurrency_test.sh`, `invariants.sql` | Query E |
| I-4 | no stock bucket below zero | `inventory-safety`, `integrity_constraints_test.sh` | Query F F14; database CHECKs |
| I-5 | a stale page never overwrites a newer save | `double-submit-stale`, `state-transitions` | — (behaviour; no data trace) |
| I-6 | a slower old reply never draws over a newer one | `out-of-order`, `nightly-check-ext10` | — |
| I-7 | an atomic operation never half-applies | `po-receive`, `stock-functions` | Query E; Query H H01 (functions installed) |
| I-8 | unknown never shows as success or zero | `missing-totals-ext11`, `attention-checks`, `nightly-check-ext10` | Query F F12 (missing totals) |
| I-9 | health results know their age | `attention-checks`, `nightly-check-ext10` | nightly card "Last success" |
| I-10 | dangerous actions need an explicit human action | `reauth-double-submit`, `admin-pages`, `safety` | — |
| I-11 | nothing leaves for a customer | `hard-walls`, `no-live-send` | Query C §1 (agent #6 dry run, #7 off) |
| I-12 | accounting and tax are read-only | `hard-walls`, `accounting-oracle`, `tax-oracle` | Query G (no unexpected write grants) |
| I-13 | a lot never holds more than received, nor below 0 | `integrity_constraints_test.sh` | Query E; draft 23 CHECK |
| I-14 | a PO line never received beyond ordered | `integrity_constraints_test.sh` | Query E; draft 23 CHECK |
| I-15 | a product with history is never deleted | `inventory-safety`, `product-lifecycle`, `stock-functions` | Query F F11 (order lines without a product) |
| I-16 | a switch is on only when its step exists | `system-status-ext10`, `merge-without-sql-ext11`, `deploy-sim-ext12` | **Query H H03–H09** |
| I-17 | duplicate creates after a lost reply prevented | `request-keys`, `request-keys-ext10` | Query F F06–F09; Query H H08 |
| I-18 | every write is attributable | `AUDITABILITY_REVIEW.md` checks | **Query C §10** |
| I-19 | exports never run as formulas | `helpers-unit`, `csv-export-guard` | — |
| I-20 | never shown inside another site's frame | `csp` | — (header check on the live site) |
| I-21 | a record escalates to at most one incident | `request-keys-ext10`, `failure-recovery` | Query F (duplicates) |
| I-22 | a request key never reused for another person or new content | `request-keys-ext10` | — |
| I-23 | the nightly check never changes business data | `integrity_check_test.sh`, `integrity_home_test.sh` | Query G G06; Query H H09 |
| I-24 | nightly results visible only to owner/admin | `integrity_home_test.sh` | Query G |
