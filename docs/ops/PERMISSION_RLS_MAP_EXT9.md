# Permission / row-level-security map (EXT9)

**Status:** CURRENT (2026-10-10, extension 9). Generated from the page code (every `from('…')` read and every write in `MUTATION_WRITE_PATH_INVENTORY.json`) and the Query A export. **No production rule was changed.** "Expected" is what the business needs; "Known" is what the database is proven to enforce. Where they may differ, the fix is a PROPOSED draft built from Query G's real output (§4). Role definitions and owner questions: `ROLE_PERMISSION_MATRIX.md`.

Roles: **O/A** = owner or administrator (`is_owner_or_admin()`), **Staff** = any active staff (`is_active_staff()`), **anon** = not signed in (must have nothing).

## 1. Tables the dashboard reads and writes

| Table / function | Pages | Page writes | Expected role (write) | Known database rule | Risk if too broad | Verify with |
|---|---|---|---|---|---|---|
| inventory, inventory_adjustments, inventory_lots | owner-login | insert / update / delete / upsert | O/A | O/A (Query A) | stock changed by staff | — (known) |
| products, suppliers, purchase_orders, purchase_order_items, expenses, recalls | owner-login | insert / update / delete | O/A | O/A (Query A) | money / stock by staff | — |
| orders, order_items | owner-login, manual-order-entry | insert / update (soft delete) | Staff | Staff (Query A) | — | — |
| tasks | owner-login | update (status) | Staff | Staff (Query A, local mirror); **concern recorded: an update policy open to every signed-in user** | anyone with an account (even inactive?) changes tasks | **V5 G03** |
| approval_requests | owner-login | update (decide) | **OWNER DECISION** (X7-14a: should staff approve?) | Staff | an employee approves owner-level requests | V5 G02 |
| returns, documents | owner-login | insert / update / delete | Staff (restock O/A via stock rules) | Staff | — | — |
| evidence_locker | owner-login | insert | Staff | RLS on, policy not exported | UNKNOWN | V5 G02/G07 |
| feature_flags, system_mode, agent_controls, business_rules | owner-login | update | **O/A** (switches, Emergency, agent pause) | **UNKNOWN** (outside export) | staff switches agents / Order Sync | **V5 G02**; X7-14b |
| incidents, customer_inquiries, service_status, sop_documents, feature_requests, legal_holds, quality_checks, adverse_event_reports, manual_attention_items | owner-login | insert / update | Staff (legal holds, adverse events: O/A suggested) | **UNKNOWN** | compliance records changed by anyone signed in | V5 G02 |
| calendar_notes, personal_calendar_events | owner-login | insert / update / delete | the person themself (own rows) | **UNKNOWN** | one person reads or edits another's private notes | V5 G02 |
| calendar_events, daily_reports, ai_decision_log, ai_model_config, needs_attention, profiles, owner_dashboard_* views | owner-login, dashboard | read only | read: O/A (calendar: owner) | partly known (profiles: own row) | private calendar visible to staff | V5 G02 |
| storage: document-files, expense-receipts | owner-login | upload / remove | Staff / O/A | storage policies UNKNOWN | receipts readable by anyone with a link guess | V2 / storage review |
| RPC receive_purchase_order, adjust_inventory, quarantine_recall, receive_return, delete_unused_product | owner-login (switched) | execute | O/A checked inside each function | drafts grant to `authenticated`, revoke from `public, anon`; every function checks O/A itself (staff can only discard a return) | — | V8 after install |
| RPC list_my_sessions, revoke_my_session, log_customer_data_access, employee_activity*, get_agent_cron_status, global_search | owner-login, search | execute | own sessions / O/A | UNKNOWN (outside export) | anon could call them | **V4**, V5 G06 |
| anon | all pages | sign-in only | **nothing** | UNKNOWN | public key reads or writes data | **V5 G04, G06** |

## 2. What the page does on a refusal

Every write asks for the changed rows back; "0 rows" (row-level security refuses silently) is shown as "not permitted, nothing was changed", never as success (silent-refusal sweep, EXT; role-matrix and fault-injection specs). Stock buttons check the role before sending anything (`canChangeStock()`); the database is still the real lock.

## 3. Recorded concerns (status)

| Concern | Status | Evidence needed |
|---|---|---|
| Broad task update policy | **UNVERIFIED** (not in the local mirror) | Query G G03 = FAIL or PASS |
| Unnecessary anon grants | **UNVERIFIED** | Query G G04 / G06 |
| Duplicate SELECT policies | **UNVERIFIED** | Query G G05 |

## 4. PROPOSED fixes (draft only after Query G returns; each needs owner approval)

Written as templates because the real policy names are not known yet. Each will become a numbered draft with forward SQL, rollback (the exact original policy text from Query G's G02 row), a local test, and an entry in `PRODUCTION_CHANGE_PACKAGE_EXT9.md`.

| If Query G shows | Proposed change | Rollback |
|---|---|---|
| G03 FAIL on tasks | Replace the open policy with `using (public.is_active_staff()) with check (public.is_active_staff())` | Recreate the original policy from its G02 text |
| G04 FAIL (anon INSERT/UPDATE/DELETE on any table) | `revoke insert, update, delete, truncate on public.<table> from anon;` | `grant … to anon` (same list) |
| G04 WARN (anon SELECT) | Revoke, unless the public website needs it (owner confirms) | grant back |
| G05 WARN | Merge into one SELECT policy per table (the narrowest that keeps today's access) | Recreate both from G02 |
| G06 WARN | `revoke execute on function … from anon, public;` for functions the website does not need | grant back |
| G01 FAIL | Enable RLS **only together with** a policy matching today's access (enabling alone locks everyone out) | disable again |
| X7-14b (switch tables open to staff) | O/A-only update policy on feature_flags, system_mode, agent_controls, business_rules | Recreate from G02 |
