# Stock functions: local stress-test results (2026-10-05)

**What was tested:** the DRAFT functions in `docs/ops/sql/drafts/10_DRAFT_stock_functions.sql` (R1–R5).
- **Where:** a throwaway local PostgreSQL 16, using the **guessed** schema (`local-test/00_GUESSED_…`).
- **Not tested:** Supabase. **This is not production evidence.** The functions are BLOCKED ON QUERY A/B until they are reconciled with the real schema.

**Script:** `docs/ops/sql/local-test/stress_test.sh <runs> <psql args>`. Real parallel database sessions, each logged in as a synthetic staff user with row-level security on.

| # | Scenario | Invariant checked |
|---|---|---|
| S1 | 120 simultaneous mixed adjustments (+2/−3/+1) across 3 products × 2 buckets | Every bucket = start + sum of its history; all 120 recorded |
| S2 | 50 simultaneous −1 on a bucket holding 20 | Exactly 20 succeed; ends at exactly 0; never negative |
| S3 | Same PO received 5× in a row, then 25× at once | Stock added once per line; exactly one expense, with the right amount |
| S4 | 30 overlapping 3-product POs, lines in alternating product order, all at once | All received, **no deadlock**, each product +30, one expense per PO |
| S5 | Receive fails on the last line (lot over 100 characters) | First product unchanged; no history, no expense; PO still Shipped |
| S6 | Lot `A_1` when `AB1` exists; lot `ab1` | `A_1` gets its own lot (no wildcard); `ab1` matches `AB1` (case-insensitive) |
| S7 | Recall + receive + return + 8 adjustments, all on product B at once (×8) | History explains every bucket; recall applied once (50); available = 1000+25+4+8−50 |
| S8 | Delete a zero-stock product while another session adds stock | No silent loss: either the product is kept and stock = history, or it is deleted and the adjustment landed nowhere; no orphaned stock rows |
| S9 | Return quantity 0 / −1 / above the line; adjustment overflow / zero / unknown bucket | All refused; nothing changed |

## Results

| Run set | Runs | Checks | Failed | Deadlocks | Time per run |
|---|---|---|---|---|---|
| Current drafts | 10 | 230 | **0** | **0** | 13.9–15.2 s |
| Control: receive with the old "line id" lock order | 2 | 46 | 8 (all S4) | **17 and 15 of 30** | ~29.5 s |

**What the control shows:**
- S4 really detects the deadlock that product-ordered locking fixes.
- Even the deadlocked receives rolled back completely: the totals stayed consistent (+13/+15), with no partial receives and no extra expenses.

The earlier `concurrency_test.sh` also still passes: 12/12 checks.

## Not covered (needs the real schema or production-like data)

- Real RLS policies, triggers and audit tables (unknown until Query A)
- Agents or cron jobs writing `inventory` directly (D-ops-6, Query C3)
- Performance at production row counts
