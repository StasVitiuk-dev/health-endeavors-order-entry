# Engineering report: EXT16 (systems hardening and decomposition round 2)

Date: 2026-10-12. Branch: `claude/platform-ext16-overnight-systems-hardening-2026-10-12` (from EXT15 final `f2b2d33`). **Not merged, not deployed, nothing run against production.** Measured on synthetic data (test mock, local PostgreSQL 16) and GitHub CI.

## 1. Summary for Stas (plain English)

- **The open intermittent GitHub failure is explained and fixed.** It was a test-timing problem (the sidebar sliding away after the test resized the window), not the offline bar; proven with 300 instrumented runs (`CI_INTERMITTENT_EXT16.md`).
- **Every dashboard page now refuses inline styles and inline scripts**, not only the owner page (`CSP_REPORT_EXT16.md`).
- **Receiving a purchase order now runs through one explicit safety state machine**: no second send in flight, none after a confirmed receipt, none after an unknown result until a check is done. What reaches the database is unchanged (`STATE_MODEL_EXT16.md`).
- **Random-test failures now shrink automatically** to the few steps that matter (`PROPERTY_AND_SHRINKING_EXT16.md`).
- **Two more feature areas moved out of the main program** (admin pages, compliance pages); it is now 6,214 lines (was 6,783 after EXT15, 9,514 before EXT15).
- **Test speed was measured, not guessed**: session reuse saves 5.6% (not 15–20%), 3 workers 7%; neither switched on yet (`TEST_PERFORMANCE_EXT16.md`).
- **Production readiness is unchanged (~15%).**

## 2. Before → after (MEASURED LOCALLY)

| Metric | EXT15 final (`f2b2d33`) | EXT16 |
|---|---|---|
| `assets/owner-login-app.js` | 6,783 lines, 390,053 bytes | 6,214 lines, 360,131 bytes |
| Application modules | 16 | 19 (+ `he-ops` new, `he-admin`, `he-compliance` moved) |
| Largest module | `he-config` 609 (data); `he-data` 437 (logic) | unchanged |
| Top-level functions / async in the program | 94 / 44 | 84 / 34 |
| Shared mutable variables | 46 | 46 (the moved pages had none) |
| Listeners in the program | 161 | 151 |
| Direct database reads / RPC calls in the program | 101 / 11 | 90 / 8 |
| `innerHTML` sinks in the program (all files) | 132 (160) | 109 (160: moved, not removed) |
| Pages with `'unsafe-inline'` (style / script) | 5 / 2 | **0 / 0** |
| Inline style attributes, all pages | 14 (small pages) | **0** |
| Type-gated files | 18 (0 gated findings) | 21 (0 gated findings; 52 reported-only) |
| Spec files | 118 | 121 |
| Page mutants | 182 (1 silently not applying) | 187 (+7 EXT16; 17 stale ones repaired; all 187 apply, checked by a test) |

## 3. Problems found and fixed

| # | Area | Problem | Found by | Fix |
|---|---|---|---|---|
| 1 | Test harness (CI) | INT-2: offline-bar check raced the sidebar's slide after a resize (GitHub failure) | forensic probe, 300 runs | wait for running animations, then strict check |
| 2 | Order entry pages | a refused library threw a script error with no message | moving the inline script | plain message, as on the other pages |
| 3 | New module | `stillUnknown()` was accepted during a send | property test (5 × 5,000 events) | read-back results only during a read-back |
| 4 | New module | `begin()` had its own state list; a wrong table entry went unnoticed | mutation run | one transition table |
| 5 | Test tooling | shrinker simplification could replace a short value with a longer one | shrinker self-test | restart from the accepted value |
| 6 | Test tooling | chaos replays started signed in and hung on the sign-in form | browser shrink self-test | fresh sign-in per replay; 30 s action limit |
| 7 | Estimate | EXT15's 15–20% session-reuse estimate | A/B measurement | corrected to 5.6% |
| 8 | Mutation harness | 17 of 187 planted bugs no longer applied (14 after the manual-order script moved, 2 after the receive state machine, 1 since EXT15), so they checked nothing | GitHub failure of the Ctrl-C runner test (INT-5) | retargeted, all 18 matching CAUGHT; `--check` mode + a test that every mutant applies exactly once |
| 9 | Draft database function (not installed) | "delete product" can deadlock with a delivery being received at the same moment (one call is cancelled and rolled back; no damage) | GitHub DB job (INT-4), then a step-by-step reproduction | **not fixed in EXT16**: fix proven on a throwaway database, scheduled first in EXT17 |
| 10 | Draft database function (not installed) | receiving an order with no lines fails with a raw "division by zero" | the INT-4 reproduction loop | **not fixed in EXT16**: EXT17 |

No bug that a person would see in normal use of the live dashboard was found in EXT16. Item 2 only affects a page whose library fails to load. Items 9–10 are in draft database functions that are not installed anywhere.

## 4. Intermittent failures

INT-1 FIXED (EXT15), INT-2 FIXED (EXT16), INT-3 OPEN (one shrinker replay; unexplained), **INT-4 EXPLAINED, NOT FIXED** (draft-database lock cycle, reproduced on demand), INT-5 FIXED (stale mutant). Register: `tests/forensics/intermittent-register.json`; details: `CI_INTERMITTENT_EXT16.md`.

## 5. Not done in EXT16 (moved to EXT17)

- **First:** the INT-4 lock-order fix in `delete_unused_product` and the empty-order message in `receive_purchase_order` (drafts/10), with the fingerprint updated everywhere it is quoted.

- State machine for returns, recalls, adjustments, product lifecycle, approvals, escalation.
- Program type-gating beyond the modules; Trusted Types evaluation; replacing easy `innerHTML` sinks.
- Session-reuse isolation checker and a 3-worker full-suite trial.
- Long (1–3 hour) soak; 250/500/1,000-step chaos; high-risk chaos.
- Database work (connection storms, random inventory model, schema drift property test).
- More extraction: settings (switches, business rules), calendar, search, status display, then the high-risk screens behind a facade.
