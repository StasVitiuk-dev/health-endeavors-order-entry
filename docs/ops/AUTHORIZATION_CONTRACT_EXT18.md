# Authorization contract (EXT18)

Status: **CURRENT on the feature branch.** The client rules and the local database model are tested. **Production RLS is UNKNOWN** until the owner runs the read-only Query G (`docs/ops/sql/06_READONLY_G_permissions_inventory.sql`).

## 1. In plain English

Two layers decide what a person can do:

1. **The database** (row-level security). This is the only real protection.
2. **The page.** It only gives early, plain-English answers ("Only the Owner or an Administrator can change stock") so nobody starts a workflow that the database will refuse half-way.

The page never grants anything the database would refuse. An unknown role is treated like an employee (deny by default).

## 2. Callers

| Caller | Who | Page treatment | Database (local model, matches Query A) |
|---|---|---|---|
| owner | Stas | everything | `is_owner_or_admin()` |
| administrator | trusted staff | everything | `is_owner_or_admin()` |
| employee | staff | no stock, PO, recall, expense, product changes | `is_active_staff()` |
| unknown role (e.g. `contractor`) | — | like employee | like employee if active |
| inactive person | former staff | refused at sign-in, signed out | sees nothing |
| signed in, no profile | broken account | — | sees nothing |
| not signed in (anon) | anyone | sign-in form only | no table privilege |

## 3. Table contract (local model, `rls_contract_test.sh`, 63 checks)

| Table group | owner / admin | employee | inactive / no profile | anon |
|---|---|---|---|---|
| tasks, returns, approvals, documents, orders, order lines | read + write | read + write | nothing | DENIED |
| stock, adjustments, lots, POs, PO lines, recalls, expenses, suppliers, products | read + write | products and suppliers read only | nothing | DENIED |
| audit_log | read; no edit, no delete, no direct insert | same | **read** (see F2) | DENIED |

"Nothing" means the rows are invisible, changes affect 0 rows, and an insert is refused by the policy.

## 4. Findings to confirm in production (owner decision, not changed)

| ID | Local model | Why it matters | How to check | Proposed change |
|---|---|---|---|---|
| F1 | a direct insert into `audit_log` is refused only by RLS (no INSERT policy); the INSERT privilege is still granted to `authenticated` | one mistaken policy would allow forged audit lines | Query G02 lists `audit_log` policies; look for any INSERT/ALL policy | also revoke INSERT (the trigger still writes; proved locally) |
| F2 | any signed-in user, even inactive or without a profile, may read `audit_log` | the audit log names people and holds old/new values | Query G02: the `audit_log` SELECT policy's condition | limit reading to `is_owner_or_admin()` (OWNER DECISION REQUIRED: may staff see history?) |

These come from the **local stand-in policies**. Production may already be stricter. No production change is proposed until Query G has been run.

## 5. Page-side rules (tested)

- Stock writes: `canChangeStock()` (owner/administrator); an employee is told before anything is sent (`role-matrix.spec.js`).
- Role and permission changes mid-session (EXT7/EXT15): a refusal is shown in plain words, with no false success (`fault-injection.spec.js`, `session-expiry-midway.spec.js`).
- The diagnostic summary never copies the raw role value (EXT14 mutant).
- Write paths: **105** (unchanged since EXT10; `docs/ops/WRITE_PATH_INVENTORY.md`, regenerated in EXT18). EXT18 added no new database write.

## 6. CSRF and CORS (based on the actual architecture)

- **CSRF does not apply in the classic sense.** The session is not a cookie. Every request carries the token in an `Authorization` header that only the page's own script adds. Another site cannot make the browser send it.
- **CORS** is decided by Supabase. The page cannot weaken it. The page's own policy limits where it may connect (`connect-src`: this site + the one Supabase project).
- **The public key** in the pages is the Supabase publishable (anon) key. It is public by design and gives only what RLS allows anon (nothing). No service key is ever present (secret scan + tests).
