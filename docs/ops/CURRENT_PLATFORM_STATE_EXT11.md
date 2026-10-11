# Internal platform: current state (EXT11 entry point)

**Status:** SUPERSEDED by `CURRENT_PLATFORM_STATE_EXT12.md` and `START_HERE_EXT12.md` (2026-10-11, extension 12; no page code changed in EXT12). Kept as history. Was: CURRENT and AUTHORITATIVE for the internal dashboard/platform as of 2026-10-11 (extension 11). Supersedes `CURRENT_PLATFORM_STATE_EXT10.md` (kept as history). Short cross-project summary: `docs/health-endeavors-current-state.md`.

## 1. In one paragraph

`main` (the live dashboard) is unchanged at `d3db7bc`. Everything from extensions 1–11 is on the branch `claude/platform-ext11-final-readiness-2026-10-11` (built on the final EXT10 commit `56a927c`; EXT10 draft PR #26 is superseded by the EXT11 **draft PR #27**). It is **tested locally, not merged, not deployed**. EXT11 fixes five more real problems:

- orders without a total no longer counted as $0;
- return receive after a lost connection says whether it was saved;
- recall quarantine after a lost connection says the same;
- missing report figures show "—";
- a received return names the chosen outcome instead of claiming "Restocked".

It also adds:

- installation status and switch safety on System status;
- a test profile proving the code can be merged before any SQL;
- a one-sitting read-only session with a single verdict and backup intake;
- the owner documents that make the remaining production work a sequence of small, checked steps.

All new database-dependent features stay **off** until Stas installs the matching SQL. No production system was touched.

## 2. Where to look (two entry files are enough)

| Need | Document |
|---|---|
| **What do I do now, what is safe, what is unknown** | **`OWNER_UNBLOCK_CENTER_EXT11.md`** |
| **Why production is ~15% and the exact order to fix it** | **`PRODUCTION_READINESS_BOARD_EXT11.md`** |
| Step-by-step owner cards (backup, read-only session, agents, GitHub, real devices, evidence expiry) | `OWNER_CHECKS_EXT11.md` |
| Production steps P0–P11 with preconditions, stop conditions, rollback | `PRODUCTION_CHANGE_PACKAGE_EXT10.md` (unchanged) |
| Read-only checks V1–V13 with fingerprints | `PRODUCTION_READONLY_VERIFICATION_EXT10.md` (unchanged) |
| Write paths, transactions, audit, permissions, errors, caps, agents, roadmap | `ENGINEERING_CATALOG_EXT11.md` |
| Daily use | `OPERATIONS_CENTER_EXT10.md`, `OPERATOR_QUICK_REFERENCE_EXT10.md` |
| What is left and who does it | `UNFINISHED_WORK_EXT11.md` |
| This extension's report | `DEEP_PLATFORM_EXTENSION_11_2026-10-11.md` |

## 3. State by area (exact labels)

| Area | State |
|---|---|
| Dashboard pages and workflows | IMPLEMENTED IN BRANCH, TESTED LOCALLY (full suite on the frozen commit `32c05e2`: report §6); NOT DEPLOYED |
| Merge before any SQL | TESTED LOCALLY with a fixture that answers like today's production (`merge-without-sql-ext11`) |
| Stock all-or-nothing (R1–R5) | SQL TESTED LOCALLY, READY FOR OWNER DEPLOYMENT; switches OFF; NOT DEPLOYED |
| Duplicate creates | request keys on 18 create paths behind `request_keys` (OFF); drafts 19 + 27 NOT INSTALLED |
| Lost-connection honesty | PO receive, return receive, recall quarantine read the record back and say what happened (EXT10 + EXT11) |
| Unknown vs zero | missing order totals named on every revenue page and in the tax export; missing report figures "—" (EXT11) |
| Nightly integrity check | drafts 25 + 29 TESTED LOCALLY, NOT INSTALLED; Home card shows "Not set up yet" |
| Installation status | System status shows each database step installed / not installed / UNKNOWN and flags a switch ON without its step (read-only, IMPLEMENTED IN BRANCH) |
| Query C / D / E / F / G / H | PREPARED, read-only, tested locally; NOT RUN on production |
| Backups | **UNKNOWN / NOT CHECKED** |
| Agents | #1 UNVERIFIED; #2/#3/#7/#8 off on purpose; #4/#5/#6 reported; #9/#10 dashboard-only |
| Permissions | UNVERIFIED until Query G; fix templates mapped |
| Audit | tasks/orders known; others UNKNOWN until Query C §10 |
| Accounting / tax | read-only (tested); refund rule N4 undecided |
| Security | CSP + frame guard + no-referrer on every page; strict scripts on 3 pages; pinned library; GitHub credential still admin (X6-17) |
| Staging | built and tested; location needs owner choice |
| Accessibility | automated checks pass; real VoiceOver / Safari NOT VERIFIED |

## 4. Evidence received from production

None yet (`docs/ops/evidence/README.md`).

## 5. Documents not found

The EXT11 mission named `KNOWN_BUGS_AND_RISKS.md`, `TESTING_AND_EVIDENCE.md` and `CODING_BOUNDARIES.md`. None exists in this repository. Their topics are covered by the backlog (`MASTER_PLATFORM_BACKLOG_2026-10-06.md`, open risks), `tests/README.md` with each extension report (testing and evidence), and `CLAUDE.md` (boundaries). They were not created, to avoid a second source for the same facts.
