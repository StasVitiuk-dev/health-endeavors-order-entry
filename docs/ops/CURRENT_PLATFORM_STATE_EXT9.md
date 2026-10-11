# Internal platform: current state (EXT9 entry point)

**Status:** CURRENT and AUTHORITATIVE for the internal dashboard/platform as of 2026-10-10 (extension 9). Start here. Older state pages stay as history and are marked superseded where they disagree: `docs/health-endeavors-current-state.md` (short cross-project summary, kept in step), `READINESS_GATE.md`, `PRODUCTION_READINESS_MATRIX.md`, the extension reports.

## 1. In one paragraph

`main` (the live dashboard) is unchanged since `d3db7bc`. Everything from extensions 1–9 is on the branch `claude/platform-deep-completion-extension-9-2026-10-10` (built on EXT8), **tested locally, not merged, not deployed**. The branch fixes dozens of problems that are live today and adds the switches and database drafts that make stock changes all-or-nothing and creates duplicate-proof, **all switched off** until Stas installs the matching database step. No production system was touched.

## 2. Where to look

| Need | Document |
|---|---|
| What is left and who does it | **`OWNER_UNBLOCK_CENTER_EXT9.md`** |
| Production checks (read-only) | `PRODUCTION_READONLY_VERIFICATION_EXT9.md` |
| Production changes, in order, with rollback | `PRODUCTION_CHANGE_PACKAGE_EXT9.md` |
| Agents 1–10 | `AGENT_CURRENT_STATE_EXT9.md` |
| Permissions / row-level security | `PERMISSION_RLS_MAP_EXT9.md` (+ Query G) |
| Integrity rules and their tests | `DATA_INTEGRITY_RULES_EXT9.md`; per workflow `DATA_INTEGRITY_AND_CONCURRENCY_MATRIX.md` |
| Procedures and incidents | `OPERATIONS_RUNBOOK_INDEX_EXT9.md` |
| Owner decisions | `OWNER_UNBLOCK_CENTER_EXT9.md` §3 (compressed); full history `OWNER_DECISIONS_NEXT.md` |
| Refund question for the accountant | `N4_DECISION_ONE_PAGE.md` |
| Real-device checks | `MANUAL_DEVICE_CHECKLIST_EXT9.md` |
| Staging | `STAGING_REVIEW_PLAN.md` |
| Backups and recovery | `RECOVERY_AND_BACKUP_READINESS.md` |
| Write paths (generated) | `WRITE_PATH_INVENTORY.md`, `MUTATION_WRITE_PATH_INVENTORY.json` |
| Backlog (generated) | `MASTER_PLATFORM_BACKLOG_2026-10-06.md` |
| This extension's report | `DEEP_PLATFORM_EXTENSION_9_2026-10-10.md` |

## 3. State by area (exact labels)

| Area | State |
|---|---|
| Dashboard pages and workflows | IMPLEMENTED IN BRANCH, TESTED LOCALLY (full suite on the frozen commit: see the EXT9 report §9); NOT DEPLOYED |
| Stock all-or-nothing (R1–R5) | SQL: TESTED LOCALLY, READY FOR OWNER DEPLOYMENT. Dashboard: IMPLEMENTED IN BRANCH behind `stock_fn_*` switches (off). NOT DEPLOYED |
| PO receive | today's path: claim-first, partial failures reported; R1 path ready behind its switch |
| Returns | claim-first restock (branch); R3 behind its switch; partial quantity = owner decision D-ops-5; refunds recorded only, never money moved |
| Product deletion / history | deletion refused for anything used, sold or stocked (branch); R5 behind its switch; Deactivate keeps history |
| Duplicate creates | request keys: SQL ready (19, 27); dashboard IMPLEMENTED IN BRANCH for 5 create forms behind `request_keys` (off) |
| Integrity rules in the database | drafts 23 (4 CHECK rules) ready |
| Query C / D / G / E / F | PREPARED, read-only, tested locally; NOT RUN on production |
| Query F nightly | draft 25 ready (pg_cron); thresholds = owner decision |
| Backups | **UNKNOWN / NOT CHECKED** (owner's 2-minute look) |
| Agents | #4/#5/#6 reported on; #1 UNVERIFIED; #2/#3/#7/#8 off on purpose; #9/#10 dashboard-only. PRODUCTION STATE REQUIRES READ-ONLY VERIFICATION |
| Customer communication | no send path in any page (tested); Agent #6 dry run; Agent #7 drafts only |
| Accounting / tax | read-only (tested); refund rule N4 undecided (today's rule stays) |
| Security | CSP + frame guard + no-referrer on every page; pinned library with integrity hash; GitHub credential still admin (X6-17, owner action) |
| Permissions | expected vs known mapped; three recorded concerns UNVERIFIED until Query G |
| Staging | built and tested (synthetic); URL needs owner choice |
| Accessibility / mobile | automated checks pass (320–768 px, 200% text, keyboard, names); real VoiceOver / Safari NOT VERIFIED |

## 4. Superseded statements (not rewritten, marked here)

| Old statement | Where | Now |
|---|---|---|
| "A separate dashboard PR switches the stock buttons to the functions" | `R1-R5-INSTALL-RUNBOOK.md`, `R1-R5-function-design.md` §4 | The switch-over code is in the EXT9 branch behind one switch per button; after install, turning a switch on replaces that PR (rollback = switch off) |
| Staging URL "NOT AVAILABLE" as final | `STAGING_REVIEW_PLAN.md` | still not available; ranked options added (§5) |
| Agent table in `AUTOMATION_AND_AGENT_REVIEW.md` | EXT7 | `AGENT_CURRENT_STATE_EXT9.md` |
| Stage lists in `READINESS_GATE.md` / `PRODUCTION_READINESS_MATRIX.md` | EXT7/EXT8 | this page + the unblock center (both files carry an EXT9 section) |
