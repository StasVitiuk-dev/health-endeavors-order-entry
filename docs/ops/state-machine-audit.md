# State-machine audit: dashboard values vs real database rules

**Status:** CURRENT (2026-10-06, branch `claude/platform-overnight-implementation`; not live).

Query A showed the dashboard writing a status (`denied`) and document link types the database refuses. This audit compares **every** status, category and similar value the dashboard writes against the database's rules (CHECK constraints from Query A). It also makes the comparison automatic, so the same class of bug fails a test instead of failing in production.

## How it is enforced (automated)

| Layer | File | What it catches |
|---|---|---|
| Mock database rules | `tests/helpers/db-constraints.js` | The mock refuses any insert/update/upsert that breaks a real rule, with the same reply Supabase gives (HTTP 400, code 23514). The shared test setup fails **any** test that caused such a write, or whose mock tables end in a state the real database couldn't hold. Every one of the ~330 browser tests that saves something is now also a state-machine check. |
| Static value lists | `tests/specs/state-machine.spec.js` | Dropdown options, status-label maps, transition maps (`PO_ALLOWED_FROM`, `TASK_ALLOWED_FROM`, `TASK_NEXT_ACTIONS`), `data-next` buttons, approval decisions and literal values in writes, so a value no test clicks is still covered. Also: received/cancelled purchase orders and done/cancelled tasks can never be moved out of (no backwards transitions). |
| Fixture realism | same spec | The shared synthetic data obeys every rule (tests can't pass on impossible data). |

The XSS test is the only one allowed to seed impossible data (hostile text in status columns, to prove escaping doesn't depend on those rules). It still may not *write* invalid values.

## Results (tables Query A covered)

| Table.column | Database allows | Dashboard writes | Result |
|---|---|---|---|
| approval_requests.status | pending, approved, rejected | approved, rejected | OK (fixed 2026-10-05: was `denied`) |
| documents.related_type | supplier, general | supplier, or empty | OK (fixed 2026-10-05) |
| **documents.category** | contract, insurance, certification, license, tax, manufacturing_agreement, other | was: contract, insurance, certification, **lab_testing**, tax, **packaging_spec**, **wholesale_agreement**, **invoice**, **employee**, other | **BUG (HIGH) — fixed on branch 2026-10-06.** 5 of 10 offered categories were refused by the database (upload failed), and `license` / `manufacturing_agreement` weren't offered. Now exactly the database list. |
| expenses.category | packaging, ingredients, shipping_supplies, advertising, software, manufacturing, other | form: same 7; receive: the order's own category | OK |
| inventory_adjustments.bucket | 8 buckets | same 8 | OK |
| products.status | draft, active, discontinued | same | OK |
| purchase_orders.status | draft, ordered, shipped, received, cancelled | same; transitions only forward | OK |
| purchase_orders.payment_status | unpaid, partial, paid | same | OK |
| purchase_orders.expense_category | 7 categories | 5 of them offered | OK (advertising and software aren't offered; that's a choice, not a bug) |
| recalls.status / severity | initiated, quarantined, resolved / low, normal, high, critical | same | OK |
| returns.status / disposition / product_condition | per Query A | same | OK |
| suppliers.supplier_type | 6 types | same 6 | OK |
| tasks.status / priority | open, in_progress, done, cancelled / low, normal, high, urgent | open→in_progress→done | OK |
| inventory buckets ≥ 0, expenses.amount > 0, PO line quantity > 0, lot quantity_received > 0 | numeric rules | checked by the mock | OK in all tests |

A test-data bug was also found: `po-receive.spec.js` seeded a purchase order with expense category `inventory`, a state the database can't contain. Fixed.

## NEEDS QUERY C (section 9): tables Query A did not cover

Their rules are unknown, so these values are **not verified yet**. Query C version 2 section 9 lists every CHECK rule and enum on every table; after it runs, the rules go into `db-constraints.js` and the static spec.

| Table.column | Values the dashboard writes | Risk to check |
|---|---|---|
| incidents.severity | a recall's or quality check's severity: low, normal, high, critical | If incidents use low/**medium**/high/critical, every "Create incident" from a recall or QC check with severity `normal` would fail. |
| incidents.category | product_safety, customer_complaint, manufacturing, other | |
| incidents.status | open | |
| quality_checks (check_type, result, severity) | 5 types; pending/pass/fail; low/normal/high/critical | |
| legal_holds.status / related_type | active → released; order, customer, incident, supplier, other | |
| feature_requests.status / priority | requested → in_progress → done; normal, high | |
| manual_attention_items.priority | normal, high | |
| customer_inquiries.status / severity | answered (+ new, drafted, needs_review shown) | |
| service_status.status | operational, degraded, down | |
| system_mode.mode | NORMAL, LIMITED_AI, NO_AI, EMERGENCY | could be an enum |
| adverse_event_reports (outcome type) | death, hospitalization, disability, birth_defect, disfigurement, medical_intervention, other | |
| evidence_locker.evidence_type | Email, Photo, Document, Other | no CHECK in Query A (free text) |
| orders.channel (enum), profiles.role (enum app_role) | not written by the order pages except manual order entry | enum values from section 9 |

## OWNER DECISION REQUIRED

- **Document categories.** The database allows 7. If you want Lab / Testing, Invoice, Packaging Spec, Wholesale Agreement or Employee as their own categories, the database rule must be widened. That's a production change you'd run after approval (a draft can be prepared). Until then they go under the closest category or "Other".
