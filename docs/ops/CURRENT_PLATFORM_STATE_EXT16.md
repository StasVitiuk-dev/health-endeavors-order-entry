# Current platform state (EXT16)

**AS OF:** 2026-10-12 · branch `claude/platform-ext16-overnight-systems-hardening-2026-10-12` · page code frozen at `bc8ce5e` · live `main` `d3db7bc` · **SUPERSEDES** `CURRENT_PLATFORM_STATE_EXT15.md` (rows not listed are unchanged).

No owner evidence has arrived. Nothing in EXT16 touched production.

## 1. What changed since EXT15

| Area | State |
|---|---|
| Security policy, all six pages | no `'unsafe-inline'` for styles or scripts on any dashboard page; validator test (`CSP_REPORT_EXT16.md`) |
| PO receiving | explicit operation state machine (`he-ops`), server calls unchanged (`STATE_MODEL_EXT16.md`) |
| Program structure | 6,214 lines + 19 modules (admin and compliance pages moved) |
| Random testing | automatic shrinking of failing sequences, verified on the real browser runner |
| Intermittent failures | INT-2 explained and fixed; INT-3 open (minor, unexplained) |
| Test speed | measured: session reuse −5.6%, 3 workers −7%; both off by default |
| Everything else (SQL drafts, Queries C–H, backups, agents, real devices) | unchanged: drafts TESTED LOCALLY, NOT INSTALLED; production state UNKNOWN |

## 2. Scores (planning estimates)

| Score | EXT15 | EXT16 | Why |
|---|---|---|---|
| Branch dashboard | ~91% | ~91% | no visible feature change |
| Live dashboard | unchanged | unchanged | nothing merged |
| **Production readiness** | **~15%** | **~15%** | unchanged: no production evidence |
| Engineering health | ~72% | ~75% | state machine, shrinker, CI intermittent closed, two more modules |
| Security | ~65% | ~68% | strict policies on all pages |
| CSP readiness | owner page only | all dashboard pages | — |
| Test reliability | — | ~80% | 2 of 3 intermittents explained and fixed |
