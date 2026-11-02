# Database security (EXT18)

Status: **CURRENT on the feature branch, local throwaway PostgreSQL only.** Local DB ≠ production DB. A local RLS contract is not a production RLS verification. Tested SQL drafts are not installed SQL.

## 1. What was tested

| Test | Result | Where |
|---|---|---|
| RLS contract: 6 callers × tasks / expenses / products / audit_log | PASS 63/63 (incl. 2 planted-weakness self-checks) | `docs/ops/sql/local-test/rls_contract_test.sh` |
| Audit completeness: every change leaves exactly one line naming the person, with old and new values; a refused change leaves none | PASS | same |
| Audit immutability: owner, administrator and employee cannot edit or delete a line; anon cannot read | PASS | same |
| Forged audit line (direct insert) | refused (RLS, no INSERT policy) | same |
| Permissions inventory (Query G) on planted problems | PASS (EXT9) | `permissions_inventory_test.sh` |
| Deadlock / lock order (R1–R5, INT-4) | PASS; canonical order product → PO → lines → lot → stock row → history (EXT17) | `s29_lock_cycle_repro.sh`, stress, inventory model |
| SQL mutants | 15/15 caught (EXT17; re-run in EXT18 final) | `tests/mutation/run-sql-mutations.sh` |

## 2. Findings for production confirmation (owner decision; nothing changed)

- **F1:** the `audit_log` INSERT privilege is granted to `authenticated`. RLS blocks it today in the local model. Proposed: also revoke it.
- **F2:** in the local model, any signed-in user (even inactive) can read `audit_log`. Proposed: owner/administrator only, if the owner agrees.

Both are explained in `AUTHORIZATION_CONTRACT_EXT18.md` §4. **Query G must be run first:** production may differ.

## 3. Malformed input to the database

- Numbers: the page refuses non-numbers, blanks and out-of-range values before sending (EXT4/EXT9 numeric contracts). The database CHECKs are the backstop (`db-constraints.js` mirrors them in the mock).
- Text used as a key: values such as `__proto__` and `constructor` are ordinary text everywhere (EXT18 fix; `prototype-keys-ext18.spec.js`).
- RPC: the stock functions validate their own inputs (R1–R5 drafts); unknown results are never retried automatically (EXT16/17 state machines).
- Pasted JSON (business-rule settings) goes to the database as a value; it is never merged into a page object.

## 4. Not done in EXT18 (honest)

- No change to the R1–R5 drafts (fingerprint `f6d9c2c8be690710eeb721041f6779d9`, unchanged).
- No new SQL draft for F1/F2. That waits for Query G evidence and the owner's decision.
- Concurrent admin actions at 100/250 callers: covered by the existing extreme stress (10/25/50) and S21 (200). No new run in EXT18 beyond the DB suite.
