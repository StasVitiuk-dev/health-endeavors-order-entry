# Internal platform: current state (EXT10 entry point)

> **SUPERSEDED (EXT13 navigation, 2026-10-11)** by `CURRENT_PLATFORM_STATE_EXT13.md`. Start at `START_HERE_EXT13.md`; authority per topic: `SOURCE_OF_TRUTH_MAP_EXT13.md`. Nothing below this line was changed by EXT13 except dated correction notes.

> **SUPERSEDED (2026-10-11, EXT11):** the current entry point is `CURRENT_PLATFORM_STATE_EXT11.md`. This file stays as history and keeps its detail; nothing in it was rewritten.

**Status:** CURRENT and AUTHORITATIVE for the internal dashboard/platform as of 2026-10-11 (extension 10). Start here. Supersedes `CURRENT_PLATFORM_STATE_EXT9.md` (kept as history). Short cross-project summary: `docs/health-endeavors-current-state.md` (kept in step).

## 1. In one paragraph

`main` (the live dashboard) is unchanged since `d3db7bc`. Everything from extensions 1–10 is on the branch `claude/platform-ext10-operations-hardening-2026-10-11` (built on EXT9 `f9e4850`), **tested locally, not merged, not deployed**. EXT10 (two missions) makes phones show wide tables as cards, adds a next step to every Home check, honest agent health, a receipt-status lock after a lost reply on Receive, a System status card, complete pick-lists past the database reply limit, a read-only production drift check, lets every create form refuse duplicates after a lost reply, puts the nightly integrity check on Home with honest states, removes inline scripts from the change-password, search and dashboard pages, and fixes eleven real problems (X10-01, 02, 03, 12, 13, 14, 15, 21, 22, 23, 24). All new database-dependent features stay **off** until Stas installs the matching SQL. No production system was touched.

Review: **draft PR #26** (contains everything in EXT9 draft PR #25 plus EXT10; review #26 instead of #25). Final frozen code `e3268a6`.

## 2. Where to look

| Need | Document |
|---|---|
| What is left and who does it; your next three actions | **`OWNER_UNBLOCK_CENTER_EXT10.md`** |
| Every workstream: done / covered / remaining | `UNFINISHED_WORK_EXT10.md` |
| Production checks (read-only) | `PRODUCTION_READONLY_VERIFICATION_EXT10.md` |
| Production changes in order, with rollback, canary and pause points | `PRODUCTION_CHANGE_PACKAGE_EXT10.md` |
| Integrity rules and proofs | `DATA_INTEGRITY_RULES_EXT10.md`; per workflow `DATA_INTEGRITY_AND_CONCURRENCY_MATRIX.md` |
| Decisions with worked examples | `OWNER_DECISION_PACKETS_EXT10.md` |
| Daily operations, routines, runbooks | **`OPERATIONS_CENTER_EXT10.md`** |
| Maps (entities, paths, side effects, automation rules, Shopify contract, scale) | `OPERATIONS_MAPS_EXT10.md` |
| Day-to-day use | `OPERATOR_QUICK_REFERENCE_EXT10.md` |
| Phone layout | `MOBILE_LAYOUT_EXT10.md` |
| Request keys | `REQUEST_KEYS_EXT10.md` |
| Nightly check on Home | `NIGHTLY_CHECK_PACKAGE_EXT10.md` |
| Code structure | `MODULARIZATION_ROADMAP.md` §6 |
| Agents | `AGENT_CURRENT_STATE_EXT9.md` (unchanged: no agent work possible without V2) |
| Permissions | `PERMISSION_RLS_MAP_EXT9.md` (unchanged until Query G) |
| This extension's report | `DEEP_PLATFORM_EXTENSION_10_2026-10-11.md` |

## 3. State by area (exact labels)

| Area | State |
|---|---|
| Dashboard pages and workflows | IMPLEMENTED IN BRANCH, TESTED LOCALLY (full suite on the frozen commit `e3268a6`: report §6); NOT DEPLOYED |
| Phone layout | wide tables are cards below 600 px: IMPLEMENTED IN BRANCH, TESTED LOCALLY (Chromium 320–430 px); real iPhone NOT VERIFIED |
| Stock all-or-nothing (R1–R5) | SQL TESTED LOCALLY, READY FOR OWNER DEPLOYMENT; dashboard behind `stock_fn_*` (off); NOT DEPLOYED |
| Duplicate creates | request keys on all 18 create paths + escalation: IMPLEMENTED IN BRANCH behind `request_keys` (off); drafts 19 + 27 NOT INSTALLED |
| Nightly integrity check | drafts 25 + 29 TESTED LOCALLY (incl. 50k orders: 0.3 s), NOT INSTALLED; Home card IMPLEMENTED IN BRANCH, shows NOT VERIFIED until installed and switched on |
| Integrity rules in the database | drafts 23 ready; NOT INSTALLED |
| Query C / D / E / F / G / **H (drift)** | PREPARED, read-only, tested locally; NOT RUN on production |
| Backups | **UNKNOWN / NOT CHECKED** |
| Agents | #4/#5/#6 reported on; #1 UNVERIFIED; #2/#3/#7/#8 off on purpose; #9/#10 dashboard-only; PRODUCTION STATE REQUIRES READ-ONLY VERIFICATION |
| Customer communication | no send path (tested) |
| Accounting / tax | read-only (tested); refund rule N4 undecided |
| Security | CSP + frame guard + no-referrer on every page; change-password, search and dashboard without `'unsafe-inline'` scripts; pinned library; GitHub credential still admin (X6-17) |
| Permissions | expected vs known mapped; UNVERIFIED until Query G |
| Staging | built and tested (includes EXT10); URL needs owner choice |
| Accessibility | automated checks pass; real VoiceOver / Safari NOT VERIFIED (M-38 added) |

## 4. Evidence received from production

None yet (`docs/ops/evidence/README.md`).

## 5. Superseded statements (marked, not rewritten)

| Old statement | Where | Now |
|---|---|---|
| EXT9 entry points | `*_EXT9.md` (5 files) | each carries a SUPERSEDED line pointing here |
| "U38/U39/U42/U43 deferred until after the merge" | `OWNER_UNBLOCK_CENTER_EXT9.md` §4 | done in branch (U39 partly) |
| "the other create paths still rely on the lock + check-first message" | `DATA_INTEGRITY_AND_CONCURRENCY_MATRIX.md` EXT9 note | all creates keyed (EXT10 section) |
| "Showing the latest result on Home is a separate, later change" | drafts/25 header | drafts/29 + Home card (EXT10) |
| `fmtMoney(NaN)` = "$0.00" | EXT6 unit test | "—" (X10-03) |
