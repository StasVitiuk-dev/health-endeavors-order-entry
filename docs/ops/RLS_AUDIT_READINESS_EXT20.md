# RLS and audit readiness (EXT20)

Status: **CURRENT.** Production RLS is **UNKNOWN**. Nothing here was run on production.

## 1. What is ready

| Item | State |
|---|---|
| Query G (`06_READONLY_G_permissions_inventory.sql`) | PREPARED and read-only. Tested locally (`permissions_inventory_test.sh`: 17 checks, planted cases) |
| **New: G08 audit log direct insert (F1)** | FAIL if any INSERT/ALL policy exists on `audit_log`; WARN if signed-in users still hold the INSERT right (refused today only because no policy exists); PASS if neither |
| **New: G09 audit log readers (F2)** | WARN if any signed-in user can read every line (`using (true)` or similar); INFO with the policy text otherwise |
| Interpretation | `npm run evidence:interpret` with type QUERY_G. Each G08/G09 result routes to the prepared next step (`evidence-ext12.spec.js`) |
| Local permission model | `AUTHORIZATION_CONTRACT_EXT18.md` §2: 6 roles × 18 tables × read/insert/update/delete, checked by `rls_contract_test.sh` (63 checks, DB suite) |
| Schema shape of the 24 unexported tables | **New: Query A2** (`08_READONLY_A2_outside_tables.sql`) plus `tests/tools/schema-drift.js` |

## 2. F1: audit insert privilege (needs Query G)

| Who | Expected |
|---|---|
| The audit trigger (database owner, `security definer`) | writes every audit line |
| Owner / administrator (signed in) | **cannot** insert directly (only through the trigger) |
| Employee, inactive employee, no profile | cannot insert |
| Not signed in (anon) | no right at all |
| `service_role` (agents) | bypasses RLS by design. It must never be used in the browser (it is not: the page holds only the public anon key) |

- **Locally as shipped:** G08 = WARN. INSERT is granted, but there is no INSERT policy.
- **Prepared fix (draft only, not installed):** revoke INSERT on `audit_log` from `authenticated`. The trigger keeps writing; this is proved locally in EXT18.

## 3. F2: who may read the audit log (OWNER DECISION, not made here)

| Option | Who can read history | Good | Cost |
|---|---|---|---|
| A. Owner only | Stas | most private: staff never see who changed what | administrators lose the Activity view |
| B. Owner + administrators (`is_owner_or_admin()`) | Stas and admins | matches every other owner/admin page | employees cannot see their own history |
| C. Leave as is | every signed-in user, even inactive | nothing changes | anyone with a login sees names and old/new values of every change |

**Claude does not choose.** After Query G shows G09, Stas picks A, B or C (`OWNER_ACTIONS_EXT20.md`).

## 4. Audit log integrity (local, existing evidence)

| Property | Evidence |
|---|---|
| Cannot silently edit a past line | no UPDATE policy plus trigger refusal (`rls_contract_test.sh`, EXT18) |
| Cannot silently delete a past line | no DELETE policy (same) |
| Actor cannot be spoofed by the page | locally `changed_by` is set by the trigger from `auth.uid()`, not from page input. The production trigger source is returned by Query A section 8 (already exported once; re-check after any change) |
| Ordering | `changed_at` default `now()` plus identity `id`. The page orders by `changed_at desc`; reordering would need an UPDATE, which is refused |
| Audit payload sanitisation | the trigger stores whole rows (old/new). No secrets live in business tables; the diagnostics summary stores error *kinds*, not texts (EXT14 test) |

## 5. Authorization UI

The page hides or disables owner-only actions. The **server decides**:

- every write the page makes is refused by RLS for the wrong role (role matrix tests);
- a refused write is shown as refused, never as saved (silent-refusal sweep, EXT P2).

## 6. False-green guard

- Missing production evidence stays **UNKNOWN / NOT RECEIVED**, never PASS (evidence tool: an empty file is "NOT RECEIVED"; local results say "NOT PRODUCTION").
- The production readiness score is not raised by any local test.
