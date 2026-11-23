# Source-of-truth map (EXT13)

**AUTHORITATIVE AS OF:** 2026-10-11 · page code `32c05e2` · `main` `d3db7bc`.
**SUPERSEDES** every earlier "where to look" table (`CURRENT_PLATFORM_STATE_EXT9`–`EXT12` §2, `OPERATIONS_RUNBOOK_INDEX_EXT9.md`, `READINESS_GATE.md`'s pointers). Those files stay as history.

**Rule when two documents disagree:** the newer *explicit* source wins (EXT13 > EXT12 > … > EXT4), unless the newer one only summarises. Then the detailed file named below wins for detail. Conflicts found are written down, never silently resolved (`OWNER_ATTENTION_SESSION_EXT13.md` §6 lists the decision conflicts). The repository and the code beat any document: if a document disagrees with the code, the code is the fact and the document gets a correction note.

## 1. One authoritative file per topic

| Topic | Authoritative file | Detail / history (still valid for detail) |
|---|---|---|
| **Start here** | `START_HERE_EXT13.md` | `START_HERE_EXT12.md` (superseded) |
| **Current state** | `CURRENT_PLATFORM_STATE_EXT13.md` | EXT9–EXT12 state files (superseded) |
| **What needs the owner, in what order** | `OWNER_ATTENTION_SESSION_EXT13.md` | `OWNER_UNBLOCK_CENTER_EXT9`–`EXT12` (superseded; EXT10 keeps U01–U50 detail, EXT11 §3 keeps the outside-help packets) |
| **Owner decisions** | `OWNER_ATTENTION_SESSION_EXT13.md` §6 | long explanations: `OWNER_DECISION_PACKETS_EXT10.md`, `N4_DECISION_ONE_PAGE.md`, `N4-refunds-accounting-map.md`; history: `OWNER_DECISIONS_NEXT.md`, `OWNER_DECISION_STATUS_EXT12.md` |
| **How to send evidence back** | `OWNER_EVIDENCE_GUIDE_EXT12.md` | `evidence/README.md` (received-files table) |
| **Owner check cards** (backup, read-only session, agents, GitHub, real device, expiry) | `OWNER_CHECKS_EXT11.md` | — |
| **Production checks (read-only queries)** | `PRODUCTION_READONLY_VERIFICATION_EXT10.md` (V1–V13) + `sql/0*_READONLY_*.sql` | `QUERY_C_OWNER_RUN_GUIDE.md`, `QUERY_E_OWNER_RUN_GUIDE.md`; plain English F/G/H: `OPERATIONS_HANDBOOK_EXT13.md` §8 |
| **Deployment** (steps, cards, observation, stop rule) | `PRODUCTION_CHANGE_PACKAGE_EXT10.md` (P0–P11) + `DEPLOYMENT_SIMULATION_EXT12.md` (cards) | `R1-R5-INSTALL-RUNBOOK.md` (P2 detail; its EXT9 note points at the superseded EXT9 package, so read P2–P4 in the EXT10 package) |
| **Rollback** | `PLATFORM_MATRICES_EXT13.md` §7 | `ROLLBACK_AND_BACKUP_REVIEW.md` (per-change table, older) |
| **Migrations / SQL order** | `PLATFORM_MATRICES_EXT13.md` §6 | `SQL_DEPENDENCY_GRAPH.md` |
| **Production readiness score** | `PRODUCTION_READINESS_BOARD_EXT11.md` (G1–G16, checkpoint log, §6 evidence → row) + `PLATFORM_MATRICES_EXT13.md` §12–13 | `PRODUCTION_READINESS_MATRIX.md`, `READINESS_GATE.md`, `LAUNCH_READINESS_2026-10-06.md` (history) |
| **R1–R10, queries, agents, automations, switches, evidence, blockers** | `PLATFORM_MATRICES_EXT13.md` | `AGENT_CURRENT_STATE_EXT9.md` (agent facts), `AUTOMATION_AND_AGENT_ARCHITECTURE.md` (D1–D11 design), `ENGINEERING_CATALOG_EXT11.md` §8 |
| **Agents** | `PLATFORM_MATRICES_EXT13.md` §3 + `AGENT_CURRENT_STATE_EXT9.md` | `AUTOMATION_AND_AGENT_REVIEW.md` (superseded) |
| **Automations** | `PLATFORM_MATRICES_EXT13.md` §4 | `AUTOMATION_AND_AGENT_ARCHITECTURE.md`, `NIGHTLY_CHECK_PACKAGE_EXT10.md` |
| **Inventory and data integrity** | `DATA_MODEL_DICTIONARY_EXT13.md` §6 + `DATA_INTEGRITY_RULES_EXT10.md` (rule wording) | `DATA_INTEGRITY_AND_CONCURRENCY_MATRIX.md`, `CONCURRENCY_MATRIX.md`, `PO_RECEIVE_RACE_REVIEW.md` |
| **Data model, write paths** | `DATA_MODEL_DICTIONARY_EXT13.md` | `WRITE_PATH_INVENTORY.md` (generated), `MUTATION_WRITE_PATH_INVENTORY.json`, `PERMISSION_RLS_MAP_EXT9.md` |
| **Permissions / RLS** | `PERMISSION_RLS_MAP_EXT9.md` | `ROLE_PERMISSION_MATRIX.md` |
| **Staging** | `STAGING_REVIEW_PLAN.md` + `OPERATIONS_HANDBOOK_EXT13.md` §10 + decision #5 | — |
| **Training and operations** | `OPERATIONS_HANDBOOK_EXT13.md` | `OPERATOR_QUICK_REFERENCE_EXT10.md` (words), `OPERATIONS_CENTER_EXT10.md` (routines), `OPERATOR_TRAINING_EXT12.md` |
| **Incidents** | `INCIDENT_SIMULATION_EXT12.md` (generated from `tests/tools/incidents.js`) + `OPERATIONS_HANDBOOK_EXT13.md` §2–3 | — |
| **Known risks and open work** | `UNFINISHED_WORK_EXT13.md` + `MASTER_PLATFORM_BACKLOG_2026-10-06.md` (generated from `backlog/items.py`) | `UNFINISHED_WORK_EXT10`–`EXT12` |
| **Post-launch** | `POST_LAUNCH_BACKLOG_EXT13.md` | — |
| **PR review, security boundaries, test inventory and profiles** | `RELEASE_REVIEW_EXT13.md` | `CUMULATIVE_CHANGE_INVENTORY.md` (per-extension changes) |
| **Testing** | `tests/README.md` + `RELEASE_REVIEW_EXT13.md` §11 | each `DEEP_PLATFORM_EXTENSION_*` report (evidence at the time) |
| **Timezone, numbers, state machines** | `TIMEZONE_CONTRACT.md`, `NUMERIC_FIELD_CONTRACT.md`, `STATE_MACHINES.md` | — |
| **Backup and recovery** | `RECOVERY_AND_BACKUP_READINESS.md` + `RELEASE_REVIEW_EXT13.md` §12 | — |
| **Standing rules** | `CLAUDE.md` | — |
| **Cross-project summary** | `docs/health-endeavors-current-state.md`, `docs/health-endeavors-progress.md` | `docs/PROJECT_RECORD.md` (history) |
| **Prompts for the next session** | `OWNER_SESSION_PROMPTS_EXT13.md` | — |

## 2. Documents that could confuse (marked in EXT13)

These said CURRENT (or were entry points) but no longer are. 30 files now have a navigation line under the title; nothing below that line was changed. They include:

- `START_HERE_EXT12.md`;
- `CURRENT_PLATFORM_STATE_EXT12.md` (and EXT9–EXT11, already superseded);
- `OWNER_UNBLOCK_CENTER_EXT12.md`;
- `UNFINISHED_WORK_EXT12.md`;
- `OWNER_DECISION_STATUS_EXT12.md`;
- `OWNER_DECISIONS_NEXT.md`;
- `OWNER_DECISION_PACKETS_EXT10.md`;
- `OPERATOR_TRAINING_EXT12.md`;
- `READINESS_GATE.md`;
- `LAUNCH_READINESS_2026-10-06.md`;
- `PRODUCTION_READINESS_MATRIX.md`;
- `OPERATIONAL_READINESS_CHECKLIST.md`;
- `OPERATIONS_RUNBOOK_INDEX_EXT9.md`;
- `OWNER-REVIEW-PACKAGE.md`;
- `OWNER_REVIEW_2026-10-06.md`;
- `OWNER_REVIEW_EXT6_2026-10-07.md`;
- `pr-merge-order.md`;
- `DEEP_PLATFORM_EXTENSION_4` … `11` (reports; evidence at the time).

## 3. Checked automatically

`tests/specs/docs-integrity-ext13.spec.js` (`node tests/tools/doc-check.js --current`) checks that:

- every file and `npm run` command named in the current owner documents exists;
- the EXT13 entry documents carry their authority header;
- the superseded entry documents say so;
- every decision name in the attention session is accepted by the evidence intake.
