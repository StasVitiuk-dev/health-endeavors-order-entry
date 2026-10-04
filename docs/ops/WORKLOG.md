# Ops-readiness work log (dashboard/backend/operations session)

Purpose: let any later session recover exactly what this session did.
Scope: dashboard, backend, agents, integrations, security/reliability. NOT the website, visual identity, whale or packaging (another session).
Rules: no merges, deploys, Supabase changes, agent state changes, branch deletions, secret changes or Shopify changes. Work only on `claude/ops-readiness`.

## 2026-10-04
- Start state: `main` = d3db7bc. PRs #5–#24 open and unchanged since 2026-09-30. 22 remote branches, none from the website session.
- Created branch `claude/ops-readiness` from `origin/main`.
- Merge-order simulation running in a scratch worktree (scratchpad/merge-sim, detached; NOT a branch): merges each PR in the proposed order and runs the full suite after each step. Log: scratchpad/merge-sim.log.
- Code review of the stock paths (owner-login.html 4532–4641 receive, 4908–4953 recall, 8112–8165 manual, 8322–8375 returns, 8031 delete) matches the PR #16 audit. NEW findings: lot lookup uses ilike (wildcards `_`/`%` match a different lot); return restock uses the full order-line quantity (no returned-quantity field); Cancel after Receive in another tab overwrites `received`; Mark Refunded has no state check or cap; Accounting ignores returns.refund_amount; S10 also affects expense receipts.
- Local PostgreSQL 16 started at /var/tmp/hepg (port 5499, throwaway, synthetic). Nothing touches Supabase.
- Wrote docs/ops/sql/00_READONLY_A_schema.sql and 01_READONLY_B_data_health.sql (single SELECTs; secrets-redacted; tested locally on a guessed schema).
- Wrote docs/ops/sql/local-test/00_GUESSED_schema_for_local_tests.sql (LOCAL ONLY).
