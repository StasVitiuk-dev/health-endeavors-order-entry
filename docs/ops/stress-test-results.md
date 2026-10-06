# Stock functions: local stress-test results

## CURRENT: hardened drafts on the real table shapes (2026-10-06)

**What was tested:** `docs/ops/sql/drafts/10_DRAFT_stock_functions.sql` after the 2026-10-06 hardening (design doc section 9), on a throwaway local PostgreSQL 16 with the **real** table shapes from Query A (`local-test/01_REAL_SHAPE_…`). Real parallel sessions, each signed in as a synthetic owner (or the synthetic employee), with row-level security on. **Not Supabase; not production evidence.**

**Script:** `docs/ops/sql/local-test/stress_test.sh <runs> <psql args>`: 19 scenarios, 46 checks per run. S1–S9 are described further down; new this round:

| # | Scenario | Invariant checked |
|---|---|---|
| S10 | 60 tabs that all showed 1000 save +1 at once **with the expected value**; then 80 plain +1 on one row at once | Exactly 1 of the 60 applied (1001), the rest refused as stale; all 80 applied (1080); history explains every bucket |
| S11 | 20 returns of one product, SKU in mixed case (`s-a`, `S-A`, `S-a`), each sent 3× at once | Each restocked exactly once (+20); all received; 20 history rows |
| S12 | 6 recalls whose lots (60 units) exceed what is in stock (30), each sent 3× at once | Never below zero; available + recalled = 30; quarantined amounts add up to Recalled |
| S13 | Depletion race: 40 × −5 and 10 × +1 at once on 100 units | Never below zero; stock = 100 + exactly the changes recorded |
| S14 | The same **new** lot (mixed case) on 10 deliveries received at once | One lot row holding all 30 units; all 10 received; 0 duplicate-key failures |
| S15 | Deleting 60 products while they are being received (30) or quarantined (30) | **0 deadlocks**; products in use kept; every delivery received, every recall quarantined |
| S16 | Two stale tabs both showing 1000 | First save wins (1005), second refused, one history row |
| S17 | An employee firing 20 receive/adjust calls while the owner receives once | Employee changed nothing (permission errors); owner's receive applied once |
| S19 | The connection is killed in the middle of a receive (held open by a test-only sleep) | Nothing kept (stock, history, expense, status unchanged); the retry receives exactly once |

Malformed inputs (zero, negative, decimal, unknown bucket, injection-looking text, lots not a list, oversized lot), and a failure injected at **every** write of R1–R4 with a before/after fingerprint of all tables, are covered sequentially in `drafts/16_DRAFT_tests_hardening_and_failures.sql` (all pass).

| Run set | Runs | Checks | Failed | Deadlocks | Time per run |
|---|---|---|---|---|---|
| Hardened drafts | 30 | 1,380 | **0** | **0** | 12.0–23.3 s |
| Control: old lock order (quarantine/receive lock the lot or stock row before the product; no lock-free in-use check in delete) | 3 | 138 | 4 (all S15) | 2, 2, 0 | ~20 s |

**What the control shows:** S15 detects the delete-vs-receive/quarantine deadlock that the product-first order removes. Each deadlock cancelled one receive or quarantine (`29/30`). Even then nothing was half-applied: the totals stayed consistent.

---

## Earlier: guessed schema (2026-10-05)


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
