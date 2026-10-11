# Internal platform: current state (EXT12)

> **SUPERSEDED (EXT13 navigation, 2026-10-11)** by `CURRENT_PLATFORM_STATE_EXT13.md`. Start at `START_HERE_EXT13.md`; authority per topic: `SOURCE_OF_TRUTH_MAP_EXT13.md`. Nothing below this line was changed by EXT13 except dated correction notes.

**Status:** CURRENT and AUTHORITATIVE for the internal dashboard/platform as of 2026-10-11 (extension 12). Supersedes `CURRENT_PLATFORM_STATE_EXT11.md` (kept as history). Entry point: `START_HERE_EXT12.md`.

## 1. In one paragraph

`main` (the live dashboard) is unchanged at `d3db7bc`. Everything from extensions 1–12 is on the branch `claude/platform-ext12-preproduction-simulation-2026-10-11`, built on the final EXT11 commit `ad9a0ab`, in **draft PR #28** (replaces #27). EXT12 changes **no page code**: the dashboard files are byte-identical to the EXT11 frozen commit `32c05e2` that the full suite ran on. EXT12 adds three local tools, all tested and all connecting to nothing:

- **evidence intake**: reads what the owner sends back, labels it honestly, records it without secrets;
- **deployment simulator**: rehearses the rollout order and refuses wrong orders;
- **incident response map**: in the page's own words.

It also adds the owner, deployment, incident, training and decision documents. Nothing is merged, deployed, or run on production. No owner evidence has arrived yet.

## 2. State by area (exact labels)

| Area | State |
|---|---|
| Dashboard pages and workflows | IMPLEMENTED IN BRANCH, TESTED LOCALLY on `32c05e2` (EXT11 full suite: 1,783 passed, 0 flaky after one harness fix); unchanged in EXT12; NOT DEPLOYED |
| Merge before any SQL | TESTED LOCALLY (`merge-without-sql-ext11`, 11 tests) |
| Stock all-or-nothing (R1–R5) | SQL TESTED LOCALLY, READY FOR OWNER DEPLOYMENT; switches OFF; NOT DEPLOYED |
| Request keys / nightly check / integrity rules | drafts TESTED LOCALLY, NOT INSTALLED |
| Owner-evidence intake | **NEW, TESTED LOCALLY** (`tests/tools/evidence.js`, 16 tests): 15 evidence types; environment required; secrets refused; e-mails redacted; staleness; conflicts; history diff; ledger |
| Deployment simulation | **NEW, TESTED LOCALLY** (`tests/tools/deploy-sim.js`, 16 tests): simulation only, never production evidence |
| Incident response | **NEW, TESTED LOCALLY** (`tests/tools/incidents.js`, 7 tests): 19 cards; every screen phrase checked against the page |
| Query C / D / E / F / G / H | PREPARED, read-only, tested locally; NOT RUN on production; the intake reads all six |
| Backups | **UNKNOWN / NOT CHECKED** (intake ready) |
| Agents | #1 UNVERIFIED; #2/#3/#7/#8 off on purpose (REPORTED); #4/#5/#6 reported running; agent source not available |
| Permissions | UNVERIFIED until Query G |
| Audit | tasks/orders known; the other required tables UNKNOWN until Query C §10 |
| Accounting / tax | read-only (tested); refund rule N4 OPEN |
| Security | unchanged from EXT11; GitHub credential still admin (X6-17 OPEN; intake can close it) |
| Staging | built and tested; location OPEN (private artifact page recommended) |
| Accessibility / real devices | automated checks pass; real Safari / VoiceOver NOT VERIFIED (intake ties a result to a commit) |

## 3. Agents (#1–#8): what the intake shows and what comes next

The agent contract (input, output with an issue key, failure recorded, one run at a time, no back-filled writes) is in `ENGINEERING_CATALOG_EXT11.md` §8; each agent's facts are in `AGENT_CURRENT_STATE_EXT9.md`.

| Agent | Today | Query C / AGENT_STATUS intake flags | With its source code (packet E) |
|---|---|---|---|
| #1 Invoice | UNVERIFIED (paused Sept 24, not recorded as back on) | switch unknown → UNKNOWN; last run error → WARN | contract tests: one invoice per order, a second run adds none |
| #2 Order Intake, #3 Order Monitoring, #7 Customer Service, #8 Supervisor | off on purpose (REPORTED) | **ON → CONFLICT** (expected off) | duplicate-task / duplicate-approval tests before they are ever switched on |
| #4 Retail/Wholesale, #5 Shipping, #6 Notification (dry run) | reported running | error / unknown flagged per row | replay test: a second run with the same input changes nothing; #6 must stay unable to send |

Bad response, replay, unknown and off states are handled by the intake (UNKNOWN / WARN / CONFLICT) and by the incident card `agent-unknown` (switch off, keep the output, never rerun to "see"). Real agent failure testing still needs the source (packet E); `AGENT_SOURCE` intake is ready for it (`second_run_duplicates: yes` → FAIL).

## 4. Automations D1–D11

Unchanged (`ENGINEERING_CATALOG_EXT11.md` §8): nothing automated is switched on; D9 automatic reordering and D10 AI answering customers are **never built**. Duplicate-schedule safety: the nightly check uses one named job, `integrity_check_nightly`; re-running drafts/25 replaces that job instead of adding a second (pg_cron 1.3 and later; the read-only verification line in the draft shows exactly 1 row). A missed run is shown as STALE on Home, never back-filled.

## 5. Evidence received from production

None (`evidence/README.md`; the ledger `evidence/ledger.jsonl` does not exist until the first intake).

## 6. Verification for EXT12 (this branch, Node-only, no page change)

| Check | Result |
|---|---|
| EXT12 specs (evidence 16, deploy-sim 16, incidents 7) + query interpreter + SQL static/read-only specs | all passed (desktop; iPhone skips Node-only on purpose) |
| Staging build, library pin, write-path inventory specs (nothing in them depends on EXT12, run to be sure) | 50 passed, 10 skipped |
| EXT12 tool mutants (12: environment, secrets, non-production board, staleness, switch-before-SQL, skipped precheck, local evidence in production, fingerprint, rollback while ON, two switches at once, SIMULATED label, unsafe retry) | **12/12 caught** |
| Page files vs frozen `32c05e2` | byte-identical (no full re-run needed; EXT11 full-suite evidence still applies) |
