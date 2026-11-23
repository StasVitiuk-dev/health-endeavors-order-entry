# Current platform state (EXT15)

**AS OF:** 2026-10-12 · page code `66a9918` (branch `claude/platform-ext15-modularization-csp-2026-10-12`) · live `main` `d3db7bc` · **SUPERSEDES** `CURRENT_PLATFORM_STATE_EXT14.md` (that file's §1 rows not listed here are unchanged).

No owner evidence has arrived. Nothing in EXT15 touched production.

## 1. What changed since EXT14

| Area | State |
|---|---|
| Dashboard pages and workflows | IMPLEMENTED IN BRANCH, TESTED LOCALLY on `66a9918`: 1,991 passed / 0 failed / 0 flaky (`RELEASE_REVIEW_EXT15.md` §3); NOT DEPLOYED |
| Owner page structure | program 6,783 lines + 16 modules + registry (`APPLICATION_MODULE_MAP_EXT15.md`); load/version failures show a plain message |
| Owner page security policy | scripts and styles only from the site itself (plus the pinned library): **no inline styles, no inline scripts** (`CSP_AND_INLINE_STYLE_REPORT_EXT15.md`) |
| CI | **VERIFIED ON GITHUB CI**: all jobs green on `3980d99` (same page code). Three CI defects found and fixed (`CI_GUIDE_EXT15.md`) |
| Intermittent CI database failure | **EXPLAINED**: test harness ignored callers refused by the 100-connection limit; fixed and reproduced locally; passed on GitHub after the fix |
| Intermittent CI offline-bar check | **OPEN INTERMITTENT** (one GitHub run; not reproduced; harness timing suspected) |
| Honesty fixes | nightly blank count ≠ PASS; unclear agent switch = Unknown; failed AI spend read = "?"; offline bar no longer blocks the menu |
| Random / chaos testing | property, XSS, chaos, malformed-data, session-expiry, soak and staging suites (`PROPERTY_AND_CHAOS_EXT15.md`) |
| Mutation testing | 12/12 EXT15 page mutants caught |
| Everything else (R1–R5, SQL drafts, Queries C–H, backups, agents, real devices) | unchanged from EXT14: drafts TESTED LOCALLY, NOT INSTALLED; production state UNKNOWN |

## 2. Scores (planning estimates; meanings: `PLATFORM_MATRICES_EXT13.md` §13)

| Score | EXT14 | EXT15 | Why it moved |
|---|---|---|---|
| Branch dashboard | ~90% | ~91% | four honesty fixes, strict style policy, module failure handling |
| Live dashboard | unchanged | unchanged | nothing merged |
| **Production readiness** | **~15%** | **~15%** | unchanged: no production evidence |
| Engineering health | ~65% | ~72% | program split into modules with proofs, CI actually working on GitHub, mutation gaps closed |
| Security | ~62% | ~65% | no inline styles; module window-read rule; DOM sink audit |
| Staging | ~60% | ~63% | 17 scenarios, firewall hardened, scenario switching tested |
| Data integrity / operational / backup / agents | unchanged | unchanged | — |
