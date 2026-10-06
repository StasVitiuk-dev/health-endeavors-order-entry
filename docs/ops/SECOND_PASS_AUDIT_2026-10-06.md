# Second-pass platform audit (2026-10-06, extension 3)

**Status:** CURRENT. Branch `claude/platform-overnight-extension-3` (from `claude/platform-overnight-implementation` at `37050c6`). Nothing here is merged or live.

This is an independent re-read of the dashboard code and the master backlog, done without trusting the first pass. It records only findings that are **not** already in `MASTER_PLATFORM_BACKLOG_2026-10-06.md`. Each one has a backlog id (prefix `X3-`), a priority, and one of these classes:

| Class | Meaning |
|---|---|
| SAFE NOW | Fixed on the branch, with a test |
| OWNER DECISION | Needs your decision |
| QUERY C | Needs Query C results |
| PRODUCTION CHANGE | Needs an approved production change |
| DEFER | Real, but not worth doing before launch |

## Method

1. **Automated state-machine rule.** The test mock now records every status change sent without an "only if it is still …" condition on that column (`STATE_COLUMNS` in `tests/helpers/mock-supabase.js`). The shared test setup fails any test that leaves one behind, so every existing test now also checks this.
2. **Runtime transition matrix** (`tests/specs/state-transitions.spec.js`, 71 tests) for tasks, returns and purchase orders:
   - each status shows exactly the expected buttons;
   - every button, with the record moved to every other status first (a stale tab), only succeeds from an allowed status.
3. **Manual review** of every `.limit(…)` read, numeric input, date conversion and write path.

## Findings

| Id | P | Class | Finding | Evidence | Outcome |
|---|---|---|---|---|---|
| X3-01 | P2 | SAFE NOW | **Product edit form wrote the product status with no condition.** A tab opened earlier could flip a product discontinued → active (or the reverse) without noticing | Caught by the new state-machine rule (`pages-data.spec.js` "saving a product…") | Save only applies while the status is the one the form opened with; otherwise "already changed" and nothing saved. New test: stale edit form |
| X3-02 | P3 | SAFE NOW | **Order Restore had no "still deleted?" condition.** Harmless in effect (restoring twice changes nothing), but it reported success for something another tab had already done | Caught by the same rule | Guarded; says "already changed". New test |
| X3-03 | P1 | SAFE NOW | **Expenses page totals came from the newest 200 expenses only.** "Expenses on file" and **"Total logged" (money)** were silently wrong beyond 200 expenses. This contradicts the scale audit's statement that money totals come only from complete reads | `owner-login.html` loadExpenses: `.limit(200)`, totals summed from that list | See the fix section below |
| X3-04 | P2 | SAFE NOW | **Returns page counts came from the newest 200 returns only.** Older open returns disappeared from the list and from "Total returns" / the open count, with no warning | loadReturns: `.limit(200)`, counts from that list | See the fix section below |
| X3-05 | P3 | SAFE NOW | **A blank Business Rules value saved as 0** (`Number('') === 0`) instead of being refused | ruleSaveBtn handler | See the fix section below |
| X3-06 | P3 | SAFE NOW | **Money and number inputs not checked in the browser:** negative PO shipping and tax, negative product prices, "infinite" amounts (`1e400`). A stock adjustment of "2.7" was silently cut to 2 | parseFloat / Number / parseInt without finiteness or range checks | See the fix section below |
| X3-07 | P3 | SAFE NOW | **Cleared expense date fell back to the UTC date** ("tomorrow" on a US evening) | `new Date().toISOString().slice(0, 10)` fallback | See the fix section below |
| X3-08 | P2 | SAFE NOW | **Query C failed outright if pg_cron is not installed**, and agent error text masked e-mails but not long tokens | `02_READONLY_C_agents.sql` v2 referenced `cron.job` directly | v3: scheduler tables read only if present; tokens masked. Local tests with and without pg_cron. Static read-only check for queries A–D (`sql-readonly.spec.js`) |
| X3-09 | P1 | SAFE NOW | **R1–R5 install had no schema preflight.** On a wrong shape it would install "successfully" and fail at the first button press | PostgreSQL checks function bodies only when called | Preflight added (tables, columns, unique indexes, helper functions); `install_package_test.sh`, 34 checks |
| X3-10 | P3 | SAFE NOW | **Flaky test:** hostile-filename test typed the next name before the previous save had finished, so under load the form reset wiped it (seen once in a full run) | `storage-safety.spec.js` | Waits for the form to clear and the button to come back; no fixed delay. 15/15 repeats |
| X3-11 | P3 | DEFER | Return-form order picker lists the newest 200 orders only: a return for an older order cannot be logged from the dashboard | loadReturns order picker `.limit(200)` | Fine at launch volume; revisit at about 150 orders a month |
| X3-12 | P3 | DEFER | The evidence form's incident picker shows the newest 200 incidents only | `.limit(200)` | Years away at expected volume |
