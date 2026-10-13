# Query D: local audit (what it would show)

**Status:** CURRENT (2026-10-06, extension 4, workstream N). Query D (`docs/ops/sql/03_READONLY_D_definer_function_identity_check.sql`) is **prepared only. It has not been run in production and will not be offered until the owner approves it.** Everything below comes from a local throwaway database with synthetic functions.

## What it is

Query D is a read-only check of **elevated functions**: functions marked `SECURITY DEFINER`, which run with the function owner's rights instead of the caller's. For each one it reports:
- who may call it (the public anon key, or any signed-in user)
- whether its code checks *who* is calling
- whether it writes data or returns rows
- whether its search path is pinned

It returns **no function source code**: only names and yes/no answers.

## Local test (`local-test/query_d_mock_test.sql`)

Ten synthetic functions cover every class. The result was re-run in extension 4: 10 rows, 0 errors, no planted secret in the output.

| Class | Meaning | Local example | What a real finding would mean |
|---|---|---|---|
| A trigger only | Runs only from a table trigger; not reachable through the API | `local_audit()`, `t_trg()` | Fine |
| B not callable by anon | Only signed-in users can run it | `t_rows()` | Fine if the function checks the role it needs |
| C anon + gate | The public key can run it, but it checks the caller first | `is_owner_or_admin()`, `current_role()`, `t_gated()`, `t_jwt()` | Usually fine (helper checks return "no" for anon); a person reads each one to confirm |
| D anon + no gate, read | The public key can run it, no caller check, reads only | `t_read()` | **Review:** may expose data to anyone with the public key |
| E anon + no gate, WRITES | The public key can run it, no caller check, and it writes | `t_open()` | **Urgent review:** anyone could change data. Revoke anon execute (owner-approved change) |

## Limits

- The "gate" is a text pattern near an identity check. It is a strong sign, not proof.
- Functions that build their SQL at run time (`EXECUTE format(…)`) can hide writes from the pattern.
- `SECURITY INVOKER` functions (like the R1–R5 drafts) are not listed. They run with the caller's rights and row-level security, so they need no such review.

## Relation to other work

- R1–R5 are deliberately `SECURITY INVOKER` (install test §1 checks that none runs with owner rights).
- If Query D ever shows class D or E, the fix is a separate, owner-approved change: revoke anon execute or add a gate. It has its own rollback. Nothing is changed by Query D itself.
