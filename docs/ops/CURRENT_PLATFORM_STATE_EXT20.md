# Current platform state (EXT20)

**AS OF:** 2026-10-17 · branch `claude/platform-ext20-adversarial-completion-2026-10-13` (from EXT19 final `b433037`) · live `main` `d3db7bc` · **SUPERSEDES** `CURRENT_PLATFORM_STATE_EXT19.md`. Rows not listed are unchanged.

No owner evidence has arrived. Nothing in EXT20 touched production.

## 1. What changed since EXT19

| Area | State |
|---|---|
| Search palette | **real performance bug fixed (INT-7):**<br>- each keystroke forced a whole-page layout;<br>- each keystroke built every match and then dropped all but 30.<br>Typical keystroke with 10,000 products: 37.5 → 2.5 ms. Worst case under a 4× slower CPU: 284 → 35 ms |
| Raw HTML | all fixed-text HTML strings are built as elements. Trusted Types reports 86 → **56**; `innerHTML` 159 → 109. Ratchet test added |
| Intermittent failures | INT-7 FIXED (product); INT-8 FIXED (test race, reproduced on demand); INT-3 OPEN with better evidence; rule written: a passing rerun never closes an entry |
| Database concurrency | **measured for the first time.** Old storms reached only 3–6 simultaneous calls; the new pgbench test measures up to 250 of 250 at once: exactly once, 0 deadlocks; the over-limit case fails loudly |
| Audit / RLS readiness | Query G answers F1 (G08) and F2 (G09) directly |
| Schema | new Query A2 for the 24 unexported tables; drift detector for future exports (missing table/column, type, nullability, extra, draft not installed) |
| Supply chain | CI database image pinned to its registry digest (guard test) |
| Agents | the dashboard's stated agent boundary is guarded by tests and mutants |
| Operator safety | Back/Forward/reload never resend a saved stock adjustment (test) |
| Owner | one owner file: `OWNER_ACTIONS_EXT20.md` |

## 2. Scores (planning estimates; production is not raised by local work)

| Score | EXT19 | EXT20 | Why |
|---|---|---|---|
| Branch dashboard | ~94% | ~95% | one real performance bug fixed; two intermittents closed |
| Live dashboard | unchanged | unchanged | nothing merged |
| **Production readiness** | **~15%** | **~15%** | no production evidence |
| Security (local) | ~80% | ~82% | fewer raw-HTML sites, pinned CI image; hosting headers and production RLS still unknown |
| Data-integrity confidence (local) | ~85% | ~88% | exactly-once now proven under truly simultaneous callers |
| Type safety | ~65% | ~65% | unchanged (480 notes, 0 gated) |
| DOM / Trusted Types | ~70% | ~78% | 56 left; not enforced |
| Operator safety | ~85% | ~86% | history-resubmit covered |
| Engineering health | ~82% | ~85% | intermittents explained; measured concurrency; drift tooling |

**Gaps:** `FINAL_AUTONOMOUS_GAP_MAP_EXT20.md`.
**Owner list:** `OWNER_ACTIONS_EXT20.md`.
**Review package:** `RELEASE_REVIEW_EXT20.md`.
