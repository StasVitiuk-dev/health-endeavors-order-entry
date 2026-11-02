# Current platform state (EXT19)

**AS OF:** 2026-10-13 · branch `claude/platform-ext19-preproduction-completion-2026-10-12` · live `main` `d3db7bc` · **SUPERSEDES** `CURRENT_PLATFORM_STATE_EXT18.md` (rows not listed are unchanged).

No owner evidence has arrived. Nothing in EXT19 touched production.

## 1. What changed since EXT18

| Area | State |
|---|---|
| "Changed by" names (System mode, agent switches) | **bug fixed**: read `display_name` (the page asked for `full_name`, which the real table does not have) |
| Raw HTML on the page | safe element builder; sidebar and loading skeletons converted; Trusted Types reports 168 → 86 |
| Type safety | whole program type-gated (27 files, 0 gated defects); dead code removed |
| High-risk operations | one machine-readable contract (7 operations, shared states), checked against the code |
| Schema | every table/column the page names is checked against the real-shape schema; the mock refuses unknown columns |
| Database storms (local) | 100 / 150 / 250 callers: exactly once, 0 deadlocks |
| Test machinery | the mutation runner reports "no test ran" instead of "not caught" |
| Everything else (Queries C–H, backups, agents, real devices) | unchanged: production state UNKNOWN |

## 2. Scores (planning estimates)

| Score | EXT18 | EXT19 | Why |
|---|---|---|---|
| Branch dashboard | ~93% | ~94% | one more real bug fixed |
| Live dashboard | unchanged | unchanged | nothing merged |
| **Production readiness** | **~15%** | **~15%** | unchanged: no production evidence |
| Type safety | ~55% | ~65% | whole program gated on defect codes; DOM typing not enforced |
| DOM / Trusted Types | ~60% | ~70% | half the violations gone; 84 locations left |
| Engineering health | ~80% | ~82% | contracts and gates |

Gaps: [PREPRODUCTION_GAPS_EXT19.md](PREPRODUCTION_GAPS_EXT19.md). Review package: [RELEASE_REVIEW_EXT19.md](RELEASE_REVIEW_EXT19.md).
