# Accounts / account-numbers reconciliation (2026-11-03)

Status: CURRENT. Read-only trace of the repository, local SQL shape and git history;
**production was NOT accessed and nothing was changed, renumbered or backfilled.**

## What "accounts" means here (determined from the code/schema, not guessed)
"Accounts" = **staff / login identities** in the `profiles` table, each with a unique
**9-digit `account_number`**. Evidence:
- `docs/ops/sql/local-test/01_REAL_SHAPE_schema_for_local_tests.sql:38-40` — `profiles`
  has `account_number text NOT NULL`, `CHECK (account_number ~ '^[0-9]{9}$')`,
  `UNIQUE`. The comment notes production assigns it via `generate_account_number()`;
  the local-test schema uses a random 9-digit stand-in (no generator locally).
- Production immutability/audit: `profiles_lock_account_number` (BEFORE UPDATE),
  `profiles_audit`, `profiles_guard_privileged_columns` triggers
  (`docs/ops/EXT20B_AUTHORIZATION_MODEL.md`, `PRODUCTION_CHANGE_LOG.md`). So existing
  account numbers are unique and locked once set — they are not regenerated.
- These are NOT customers, wholesale businesses or financial/bank accounts, and
  `account_number` is an identifier, not a login credential.

## Where the concept is created / stored / read / displayed / searched
- Stored: `profiles.account_number` (production-generated, locked).
- Read for display: the Employee Activity page calls the `employee_activity_people`
  RPC (`owner-login-app.js` `loadActivityPeople`, ~line 1985) → `SEARCH_INDEX.people`.
- Displayed: Employee Activity **People** strip renders each as
  `display_name · #<fmtAccountNumber(account_number)> · <role>`
  (`owner-login-app.js:1995`); activity rows show `#<account_number>`
  (`:1883`, `:2041`); audit groups by `person_account_number` (`he-audit.js:143`).
- Searched: the command palette and the activity search both match account numbers
  ("Search people, account numbers, areas, order numbers…"; `searchEverything`
  `owner-login-app.js:542-553` matches `p.account_number` digits).
- Formatting: `fmtAccountNumber` (`owner-login-helpers.js`) renders `100000001` as
  `100-000-001`.

## Why the owner did not see accounts in the review preview
The synthetic staging build **did not seed any `profiles` / people**, and the
`employee_activity_people` RPC returned nothing, so the People strip was empty and
search found no accounts. **This is intentional exclusion of real identities from a
synthetic preview — NOT evidence that production accounts were lost or renumbered.**
The preview never connects to the real database (placeholder host `staging-demo.invalid`,
enforced by the build's own guard).

## What was done (local synthetic only)
Added **distinctly-fictional** staff accounts to the preview via the staging RPC mock
(`tests/tools/staging/build-staging.js`: `backend.rpc.employee_activity_people`):
SYNTHETIC Dana Owner #100-000-001 (owner), Alex Admin #100-000-042 (administrator),
Sam Staff #100-000-317 (staff), Jo Packer #100-004-589 (staff, inactive). They now
appear in the Employee Activity People strip and in account-number search, exercising
the EXISTING UI contracts — no new schema, no production data.

## Reconciliation table
| Concept | State |
|---|---|
| `profiles.account_number` (9-digit, unique, locked) | IMPLEMENTED in schema + production triggers; not accessed/changed here |
| Display of accounts (People strip, activity rows, audit) | IMPLEMENTED in the UI (cited) |
| Search by account number / name | IMPLEMENTED (palette + activity search) |
| Accounts visible in the synthetic preview | WAS excluded (no fixture) → now shown with synthetic fixtures |
| A dedicated standalone "account directory" page | NOT present; accounts are reached via Employee Activity + search. **OWNER CLARIFICATION:** do you want a separate directory page, or is Employee Activity + search sufficient? |
| Production accounts "lost"? | NO EVIDENCE of loss. Not accessible from here; this preview is synthetic by design. To confirm production, the owner checks the live dashboard (Employee Activity) signed in — not something this session can or should do. |

## Not done / guardrails honored
No production access; no renumber/regenerate/backfill; no bank/routing/credentials
exposed; existing roles/permissions and the `account_number` format preserved; no
auth mutations, invitations or access grants.
