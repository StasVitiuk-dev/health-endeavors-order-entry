# Internal platform: current state (EXT13)

> **SUPERSEDED 2026-10-12 by `CURRENT_PLATFORM_STATE_EXT14.md`** (EXT14). Kept as history; owner actions in the EXT13 owner documents are unchanged.

**AUTHORITATIVE AS OF:** 2026-10-11 · dashboard code frozen at `32c05e2` (unchanged in EXT12 and EXT13) · live `main` `d3db7bc` · branch `claude/platform-ext13-owner-attention-final-audit-2026-10-11` (continues EXT12 `bd574df`; draft PR #28's branch was fast-forwarded to the same commits, so #28 carries EXT1–13).
**SUPERSEDES:** `CURRENT_PLATFORM_STATE_EXT12.md` (kept as history). Entry point: `START_HERE_EXT13.md`.

## 1. In one paragraph

The live dashboard (`main`) is unchanged. Extensions 1–13 wait in draft PR #28 and are tested locally; nothing is merged, deployed or run on production. EXT13 changed **no page code**. It did four things:

- **Audits:** SQL round 2, the stock functions, PR #28, the history secret scan, the decision sweep, the document sweep.
- **Fixes:** one real owner-tool bug (undated evidence counted as fresh forever), one wrong decision description (legal hold), stale documents marked.
- **Owner documents:** consolidated into one owner attention session, matrices, a source-of-truth map, a data dictionary, an operations handbook, a post-launch backlog and session prompts.
- **New check:** a documentation integrity check that proves every file and command named in the owner documents exists.

No owner evidence has arrived yet.

## 2. State by area

| Area | State |
|---|---|
| Dashboard pages and workflows | IMPLEMENTED IN BRANCH, TESTED LOCALLY on `32c05e2` (EXT11 full suite: 1,783 passed, 0 flaky); NOT DEPLOYED |
| Merge before any SQL | TESTED LOCALLY (`merge-without-sql-ext11`); re-confirmed in `RELEASE_REVIEW_EXT13.md` §4 |
| R1–R5 | SQL TESTED LOCALLY, READY FOR OWNER DEPLOYMENT; re-reviewed (invoker, owner/admin check, pinned path, fixed lock order); switches absent/OFF |
| Request keys, integrity rules, nightly check, PO line guard | drafts TESTED LOCALLY, NOT INSTALLED |
| Permission fixes | NOT WRITTEN (wait for Query G) |
| Queries C–H | PREPARED, read-only, NOT RUN on production (A and B were run on Oct 5) |
| Backups | **UNKNOWN** |
| Agents | #1 UNVERIFIED; #2/#3/#7/#8 off (REPORTED); #4/#5/#6 on (REPORTED); source not available |
| Audit coverage | tasks and orders known; the other required tables UNKNOWN until Query C §10 |
| Security | in-branch protections tested; X6-17 (admin credential) OPEN; RLS UNVERIFIED |
| Accounting / tax | read-only; N4 OPEN |
| Customer sends | none possible (no send path) |
| Staging | built and tested on synthetic data; location OPEN |
| Real devices | NOT VERIFIED |
| Owner tools | evidence intake (now refuses undated evidence), deployment simulator, incident map, doc checker; all tested, connect to nothing |

## 3. Scores (planning estimates; what each means: `PLATFORM_MATRICES_EXT13.md` §13)

| Score | Value |
|---|---|
| Branch dashboard | ~89% |
| Live dashboard | unchanged since `d3db7bc` |
| **Production readiness** | **~15%** (unchanged: only production evidence moves it) |
| Data integrity | ~40% |
| Operational readiness | ~65% |
| Security | ~60% |
| Staging | ~50% |
| Training | ~70% |
| Backup | 0% verified |
| Agents | ~20% |
| Automation | ~30% |

EXT12 gave operator training ~60%. The EXT13 handbook (15 modules, 20-question quiz, certification card) raises the *material* to ~70%; it rises further only when a real person passes the quiz.

## 4. What changed in EXT13

| Kind | Change |
|---|---|
| Bug fixed (owner tool) | evidence without a valid run date is UNKNOWN (was: fresh forever); test + mutant |
| Owner information corrected | legal-hold option 2 was described as "nothing deleted"; dated correction notes in EXT11/EXT12 files |
| Stale guidance marked | 30 old entry or "CURRENT" documents now point to the EXT13 entry point (no history edited); `pr-merge-order.md` marked obsolete |
| SQL | comment-only note in `drafts/19` (its "ship after" sentence predates the switch); no executable SQL changed |
| Decisions | about 70 mentions merged into 24 decisions; 5 conflicts flagged; 8 decisions added to the intake |
| Tools | `tests/tools/doc-check.js` + `npm run docs:check`; `docs-integrity-ext13.spec.js` |
| New documents | `START_HERE_EXT13`, `OWNER_ATTENTION_SESSION_EXT13`, `PLATFORM_MATRICES_EXT13`, `SOURCE_OF_TRUTH_MAP_EXT13`, `RELEASE_REVIEW_EXT13`, `DATA_MODEL_DICTIONARY_EXT13`, `OPERATIONS_HANDBOOK_EXT13`, `POST_LAUNCH_BACKLOG_EXT13`, `OWNER_SESSION_PROMPTS_EXT13`, `UNFINISHED_WORK_EXT13`, this file |

## 5. Verification for EXT13 (no page change)

| Check | Result |
|---|---|
| Page files vs `32c05e2` | byte-identical; the EXT11 full-suite evidence still applies |
| Owner-tool, doc and SQL specs (evidence, deploy-sim, incidents, docs-integrity, query interpreter, SQL static/read-only, write-path inventory, staging build, library pin, ops findings, mock realism) | **212 passed, 0 failed**, 148 skipped (Node-only tests run once, on desktop) |
| Tool mutants (EXT12 12 + EXT13 3) | 15/15 caught |
| Secret scan of `d3db7bc..HEAD` (all commits) | clean |
| `npm run docs:check` | OK |
