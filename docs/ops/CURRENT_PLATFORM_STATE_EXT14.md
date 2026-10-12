# Current platform state (EXT14)

**AS OF:** 2026-10-12 · page code `3a40095` · live `main` `d3db7bc` · **SUPERSEDES** `CURRENT_PLATFORM_STATE_EXT13.md`.
Machine-readable twin: `STATUS_MANIFEST_EXT14.json` (validated by `npm run status:check`).

No owner evidence has arrived yet. Nothing in EXT14 touched production.

## 1. State by area

| Area | State |
|---|---|
| Dashboard pages and workflows | IMPLEMENTED IN BRANCH, TESTED LOCALLY on `3a40095` (EXT14 full suite: `RELEASE_REVIEW_EXT14.md` §3); NOT DEPLOYED |
| Owner page structure | IMPLEMENTED IN BRANCH: program in `assets/owner-login-app.js`; strict script policy; "program did not load" message |
| CI | IMPLEMENTED IN BRANCH; **inactive until merged** (`CI_GUIDE_EXT14.md`) |
| Merge before any SQL | TESTED LOCALLY (unchanged) |
| R1–R5 | SQL TESTED LOCALLY, fingerprint `3df2bf7a07b451f12f9359ceca1c85df`; rollback `drafts/11` now refuses while a stock switch is ON (EXT14); switches absent/OFF |
| Request keys, integrity rules, nightly check, PO line guard | drafts TESTED LOCALLY (with volume/scale evidence in EXT14), NOT INSTALLED (production state UNKNOWN until Query C) |
| Optional report totals (`drafts/13`) | fixed (missing totals reported) + rollback `drafts/31`; still optional, not in the plan |
| SQL package | organized, every file in `MANIFEST.json`, lint + graph + headers; 26-step local DB suite 26/26 |
| Permission fixes | NOT WRITTEN (wait for Query G) |
| Queries C–H | PREPARED, read-only, NOT RUN on production |
| Backups | **UNKNOWN** |
| Agents | #1 UNVERIFIED; #2/#3/#7/#8 off (REPORTED); #4/#5/#6 on (REPORTED) |
| Security | in-branch protections tested; diagnostics redaction fuzzed (one leak fixed); X6-17 OPEN; RLS UNVERIFIED |
| Accounting / tax | read-only; money precision bound proven; N4 OPEN |
| Customer sends | none possible |
| Staging | private build with 12 scenarios, offline, zip (`npm run staging:build`); location OPEN; not published |
| Real devices | NOT VERIFIED |

## 2. Scores (planning estimates; meanings: `PLATFORM_MATRICES_EXT13.md` §13)

| Score | EXT13 | EXT14 | Why it moved |
|---|---|---|---|
| Branch dashboard | ~89% | ~90% | strict script policy, module failure handling, one redaction leak fixed |
| Live dashboard | unchanged | unchanged | nothing merged |
| **Production readiness** | **~15%** | **~15%** | unchanged: no production evidence |
| Data integrity | ~40% | ~42% | drafts/13 missing-total fix; drafts/11 guard; volume evidence (all local) |
| Operational readiness | ~65% | ~66% | status manifest, CI ready (inactive) |
| Security | ~60% | ~62% | script policy without inline scripts; redaction fuzz; secret check repaired |
| Staging | ~50% | ~60% | scenarios, offline, zip, one command; still no agreed private location |
| Engineering health (new) | — | ~65% | CI built, SQL linted, runners crash-safe; still one 560 KB program file, 40-minute suite |
| Backup | 0% verified | 0% verified | — |
| Agents / automation | ~20% / ~30% | unchanged | — |
