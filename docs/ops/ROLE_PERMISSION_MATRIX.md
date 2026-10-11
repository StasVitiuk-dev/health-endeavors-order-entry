# Role permission matrix (dashboard)

**Status:** CURRENT (2026-10-07, extension 7, workstream H). Branch work, not live. One authoritative page for "who can do what". Evidence labels: **TESTED** (an automated test proves it), **DB (Query A)** (read from the production schema export and mirrored in the local test database), **UNKNOWN** (not verifiable from the repository; needs Query D, read-only, owner runs it).

## 1. Roles

| Role (`profiles.role`) | Who | Notes |
|---|---|---|
| `owner` | Stas | Sees the synced Apple Calendar; everything else as administrator |
| `administrator` | Trusted staff | Same rights as owner in the database (`is_owner_or_admin()`) |
| `employee` | Staff | Active staff (`is_active_staff()`); no stock, purchasing, money or product rights |
| any other value | — | Treated like an employee by the page (**deny by default**, TESTED: role-matrix "contractor") |
| `is_active = false` or no profile | Former staff | The page refuses to open and signs out (TESTED: login-session) |

The database is the real lock. The page only adds an early, plain-words refusal so nobody gets half a workflow.

## 2. Matrix

| Area / action | Owner | Admin | Employee | Page check | Database rule | Evidence |
|---|---|---|---|---|---|---|
| Stock: manual adjustment, low-stock threshold, receive delivery, delete unused product | ✓ | ✓ | ✗ | `canChangeStock()` refuses **before anything is sent** | Owner/admin only on `inventory`, `inventory_adjustments`, `inventory_lots`, `purchase_orders`, `purchase_order_items`, `recalls`, `expenses`, `suppliers`, `products` | TESTED (role-matrix, 4 actions × 4 roles); DB (Query A) |
| Return restock (puts units back in stock) | ✓ | ✓ | ✗ (can log a return, not restock) | `canChangeStock()` when the disposition restocks | Returns: any active staff; stock: owner/admin | TESTED (query-a-fixes employee restock); DB (Query A) |
| Purchase orders, suppliers, products, expenses, recalls | ✓ | ✓ | read products/suppliers only | Database refusal shown in plain words | Owner/admin write; staff read products/suppliers | TESTED (fault-injection refusals); DB (Query A) |
| Tasks, approvals, returns, documents, orders, order items | ✓ | ✓ | ✓ | — | Any active staff | DB (Query A) |
| Approve / reject a request | ✓ | ✓ | ✓ (database allows any active staff) | — | Any active staff on `approval_requests` | DB (Query A). **OWNER DECISION**: should employees approve? (see §4) |
| Calendar | Apple-synced (owner only) | personal calendar | personal calendar | `calMode` by role | UNKNOWN (`calendar_events`, `personal_calendar_events` are outside the 18 exported tables) | TESTED (calendar-owner) |
| Emergency / No-AI mode, feature flags, agent switches, business rules | ✓ | ? | ? | none (the page relies on the database) | **UNKNOWN** (tables outside the export) | Refusal UX TESTED (admin-pages, fault-injection) |
| Incidents, customer inquiries, service status, SOPs, feature requests, legal holds, quality checks, adverse events, evidence | ✓ | ? | ? | none | **UNKNOWN** except `evidence_locker` (no policy listed in the export shape) | Refusal UX TESTED |
| Audit history (`audit_log`) | read | read | read | — | Read for authenticated users (local mirror); writes only by the trigger | DB (Query A shape) |
| Sessions: log out another device | own sessions only | own | own | — | `list_my_sessions` / `revoke_my_session` RPCs (own sessions) | TESTED (operations-pages session revoke) |
| Manual order entry page | ✓ | ✓ | ✓ | signed-in active staff | `orders`, `order_items`: any active staff | TESTED (manual-order-entry) |
| GitHub repository | Stas | — | — | — | Claude's credential is currently admin (finding X6-17) | `docs/security/GITHUB_CREDENTIAL_ADMIN_FINDING_2026-10-07.md` |

## 3. Session and identity rules (EXT6–EXT7)

- Sign-out (here, in another tab, or expired) wipes the page by reloading (TESTED: session-failures, manual-order-entry).
- **New in EXT7:** if a different person signs in on the same computer (another tab), the open tab wipes itself; a routine refresh for the same person changes nothing (TESTED: auth-chaos, 3 tests).
- Unsaved typing asks before closing or signing out; a forced sign-out never waits (TESTED: unsaved-changes).

## 4. Open questions (OWNER DECISION REQUIRED / UNKNOWN)

1. **Approvals by employees.** The database lets any active staff approve or reject a request. If approvals are meant for the owner only, that is a database policy change (draft + rollback, owner approval). Not changed.
2. **Admin-only switches** (Emergency mode, flags, agent switches, business rules) have no page-side role check. Whether the database restricts them is UNKNOWN until Query D. If employees can flip them, that is a production policy fix. A page-side pre-check can be added once the intended rule is decided.
3. **Tables outside the 18-table export**: their policies are UNKNOWN. Query D (read-only) lists every policy; `QUERY_D_LOCAL_AUDIT.md` explains how.
