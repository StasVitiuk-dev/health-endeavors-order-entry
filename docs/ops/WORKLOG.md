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
- Wrote DRAFT functions docs/ops/sql/drafts/10 (R1 receive_purchase_order, R4 adjust_inventory, R2 quarantine_recall, R3 receive_return, R5 delete_unused_product, helper _he_apply_stock_change), 11 rollback, 12 tests (BEGIN…ROLLBACK). Local result: ALL STOCK FUNCTION TESTS PASSED (5/5 runs).
- docs/ops/sql/local-test/concurrency_test.sh: 12 checks with real parallel sessions (lost updates, below-zero race, simultaneous receive/recall/return, deadlocks): all PASS ×3.
- DISCOVERY: processing PO lines in id order (as the earlier plan implied) deadlocks under overlapping receives (3–11 of 20 failed in 3 runs). Fixed in the draft by locking in product order (0 failures).
- Wrote docs/ops/R1-R5-function-design.md and docs/ops/other-fixes-review.md (R5, R7, approvals, PO states, PO Cancel, S10, new findings N1–N9).
- R7 unblocked: npm registry reachable (CDN still blocked); sha384 of supabase-js 2.117.2 UMD verified against a fresh registry tarball and package-lock: sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok. 2.117.2 is the newest 2.x (published 2026-10-02).
