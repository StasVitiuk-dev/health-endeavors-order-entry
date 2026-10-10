# Database drafts: what depends on what

> **EXT9 note (2026-10-10):** the install order is now `PRODUCTION_CHANGE_PACKAGE_EXT9.md` (adds drafts 21–28 and Query G). This page keeps the per-file detail.

**Status:** CURRENT (2026-10-07, extension 7: no new draft; new local evidence in §4). **Nothing here is installed.** Every install is a production change that needs the owner's approval, run by the owner in the Supabase SQL editor, one file at a time. Claude never runs SQL against production.

## 1. The files

| File | What it is | Changes data? | Rollback | Local evidence |
|---|---|---|---|---|
| `00_READONLY_A_schema.sql` | Query A: schema facts (already run, 2026-10-05) | No | — | ran |
| `01_READONLY_B_data_health.sql` | Query B: data health counts (already run, clean) | No | — | ran |
| `02_READONLY_C_agents.sql` | Query C: agents, scheduled jobs, other stock writers, rules | No | — | `query_c_mock_test.sql`, `query_c_no_cron_test.sql`, static read-only check |
| `03_READONLY_D_definer_function_identity_check.sql` | Query D: which elevated functions anyone can call | No | — | `query_d_mock_test.sql`, static check |
| `04_READONLY_E_stock_reconciliation.sql` | **New EXT6.** Query E: stock vs history, deliveries vs stock and expense | No | — | `reconciliation_test.sh` (21 checks), static check |
| `05_READONLY_F_daily_integrity_check.sql` | **New EXT8.** Query F: stuck work, duplicate risks, wrong references, impossible values (15 checks) | No | — | `integrity_check_test.sh` (33), static read-only check |
| `06_READONLY_G_permissions_inventory.sql` | **New EXT9.** Query G: policies, anon rights, duplicate read policies, tables without RLS (PASS/WARN/FAIL) | No | — | `permissions_inventory_test.sh` (11), static read-only check |
| `drafts/10_DRAFT_stock_functions.sql` | R1–R5: all-or-nothing receive, recall quarantine, return restock, stock adjustment, product delete | Adds 6 functions; no data | `drafts/11_…` | SQL tests 12/15/16, `install_package_test.sh` (61), `stress_test.sh` (98 × 3), SQL mutations |
| `drafts/13_DRAFT_report_totals.sql` | Optional server-side totals function (Accounting / Tax); EXT6: now one transaction | Adds 1 function | drop function | `drafts/14_…` |
| `drafts/17_DRAFT_po_line_delete_guard.sql` | PO line guard (revised EXT6: NOWAIT order lock) | Adds 1 trigger + function | `drafts/18_…` | `po_race_interleavings.sh`, `po_browser_path_races.sh`, S27, install section 13 |
| `drafts/19_DRAFT_request_keys.sql` | **New EXT6.** Request keys: one empty column + unique index on 22 tables | Adds columns + indexes; no data | `drafts/20_…` | `request_keys_test.sh` (23) |
| `drafts/21_DRAFT_stock_function_switches.sql` | **New EXT9.** Five stock switches, all off; refuses without R1–R5 | Inserts 5 rows | `drafts/22_…` (refuses while a switch is on) | `stock_switches_test.sh` (23) |
| `drafts/23_DRAFT_integrity_constraints.sql` | **New EXT9.** recalled ≥ 0, lot and PO-line ranges, refund ≥ 0; stops if data already breaks a rule | Adds 4 CHECK rules | `drafts/24_…` | `integrity_constraints_test.sh` (17) |
| `drafts/25_DRAFT_integrity_check_schedule.sql` | **New EXT9.** Query F nightly (view + results table + pg_cron job) | Adds 1 view, 1 table, 1 function, 1 job | `drafts/26_…` | `integrity_schedule_test.sh` (12) |
| `drafts/27_DRAFT_request_keys_switch.sql` | **New EXT9.** `request_keys` switch, off; refuses before drafts/19 | Inserts 1 row | `drafts/28_…` (refuses while on) | `request_keys_switch_test.sh` (10) |

## 2. Dependencies (read top to bottom)

```
Query C (read-only, owner runs)  ──►  decides: other stock writers? agents? rules?
Query D (read-only, owner runs)  ──►  decides: permission fixes (SE-01/SE-02)
                │
                ▼
        R1–R5 (drafts/10)  ───────────────►  dashboard PR that CALLS R1–R5 (INV-06)
                │                                     │
                │                                     ▼
                │                         revoke direct stock writes (INV-20)
                │
PO line guard (drafts/17)   — independent since EXT6 (protects today's receive and R1)
Request keys (drafts/19)    — independent; then a dashboard PR that SENDS the keys
Query E (read-only)         — any time; most useful before and after each install
Query F (read-only, EXT8)   — any time; nightly once scheduling is approved (pg_cron, read-only)
```

- **R1–R5 needs Query C first.** If an agent or script writes stock directly (INV-22), R1–R5 do not cover it.
- **The dashboard change that calls R1–R5 must come after R1–R5 are installed** (calling a missing function fails every receive).
- **The guard has no prerequisite** (EXT6). It used to require R1 (EXT4/EXT5 wording, superseded).
- **The request-key dashboard change must come after drafts/19** (sending an unknown column fails every save). Rollback in the reverse order: dashboard first, then `drafts/20`.
- **Revoking direct stock writes (INV-20) comes last.** Only after the dashboard calls R1–R5, and only after Query C shows nothing else writes stock directly.

## 3. Suggested order (owner decides)

1. Run **Query E** (read-only) to see today's state. Optional, takes seconds.
2. Run **Query C** and **Query D** (read-only). Send the results.
3. Install the **PO line guard** (small, independent, closes a live race).
4. Install **R1–R5** (after Query C), then merge the dashboard change that calls them.
5. Install **request keys**, then merge the dashboard change that sends them.
6. Run **Query E** again.

Each step can stop on its own; nothing later is needed to keep an earlier step safe.

## 4. Properties checked for every draft (local throwaway PostgreSQL 16, synthetic data)

| Property | R1–R5 (10) | Guard (17) | Request keys (19) |
|---|---|---|---|
| One transaction (all-or-nothing) | yes | yes | yes |
| Two copies run at once wait instead of failing (advisory lock) | yes (EXT5) | yes (EXT5) | yes |
| Safe to run twice | yes | yes | yes |
| Stops cleanly if the schema differs | column preflight | table check | skips missing tables; stops if the dashboard role could not write the column |
| Existing data compatible | Query B clean | no data touched | new column empty; existing rows NULL |
| Permissions / RLS unchanged | security invoker + owner/admin check; grants listed | security invoker; revoke from public | no policy or grant change; checks the dashboard role can write the column |
| Locking / downtime | row locks per call, product-first order | share lock on the order, NOWAIT (never waits while holding a line) | brief write block per table while its index builds (small tables) |
| Rollback tested | yes (`11`) | yes (`18`) | yes (`20`), keeps records |
| Concurrency tested | stress 98 checks × 3, 100 callers | forced orderings (R1 and browser path), 60 random races | 20 simultaneous retries of one attempt |
| Mutation-tested | 9 (8 rule mutations + the install type check) | 2 | 1 |

**Not verifiable here:** Supabase's own settings (statement timeout, pooler), timings, and whether production tables have column-level grants (the request-key install checks this itself and stops if so).

### Extension 7 local evidence (2026-10-07)

`local-test/random_interleavings.sh` (randomized parallel mixes of R1–R5 calls and stale-tab PO line changes, invariants checked each round, failures shrunk to a minimal repro). Seed 2026, 300 rounds each:

| Scenario | Without guard | EXT5 guard draft | Current guard draft (`17_`) | Revised draft | Expected |
|---|---|---|---|---|---|
| Random mixes, R1 receive + stale-tab line edit/delete/add | **75 / 300 rounds broke "received order with an unreceived line"**; minimal repro: line add + R1 receive of the same order | 0 / 300 (1,262 changes refused) | 0 / 300 (1,186 refused) | not needed (no gap found) | 0 broken rounds |
| Browser step-by-step receive vs stale-tab edit (EXT6 `po_browser_path_races.sh`, forced orderings; `PO_RECEIVE_RACE_REVIEW.md` §0) | 1 SILENT, 5 reported | 2 reported, 0 silent | all agree | not needed | all agree |
| Deadlocks in any of the above | 0 | 0 | 0 | — | 0 |

So the current guard draft stays the recommendation. It still needs owner approval to install.
