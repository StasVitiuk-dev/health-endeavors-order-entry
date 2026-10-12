# Engineering report: EXT15 (modularization, strict style policy, CI hardening, property/chaos testing)

Date: 2026-10-12. Branch: `claude/platform-ext15-modularization-csp-2026-10-12` (from EXT14 `e51f9ed`, page code `3a40095`). **Not merged, not deployed, nothing run against production.** Everything was measured on synthetic data, in the test mock, a local PostgreSQL 16 or GitHub's CI machines.

Labels: **IMPLEMENTED IN BRANCH** (code exists and is tested here), **MEASURED LOCALLY**, **VERIFIED ON GITHUB CI**, **NOT DONE** (with the reason).

## 1. Summary for Stas (plain English)

- **The main program was split into 16 smaller files**, each with one job. The code was moved, not rewritten: a tool proves every original statement is still there unchanged, except 14 named edits (`APPLICATION_MODULE_MAP_EXT15.md`).
- **The owner page no longer allows inline styles.** All 325 were replaced by stylesheet classes; screens are pixel-identical in computed style (`CSP_AND_INLINE_STYLE_REPORT_EXT15.md`).
- **GitHub's automatic tests were not working, and now are.** Every CI run on PR #29 had failed, so the browser tests had never actually run there. Fixed; PR #29's latest run is fully green on GitHub (`CI_GUIDE_EXT15.md` §8).
- **5 real problems fixed** (§6), found by the new random-testing suites and by checking code the type checker flagged.
- **Production readiness is unchanged (~15%).** Only owner evidence from production can move it.

## 2. Before → after (MEASURED LOCALLY)

| Metric | EXT14 (page code `3a40095`) | EXT15 |
|---|---|---|
| `assets/owner-login-app.js` | 9,514 lines, 559,819 bytes | 6,783 lines, 390,053 bytes |
| Application modules | 0 (one file) | 16 in `assets/app/` (2,924 lines) + 32-line registry |
| Largest module | — | `he-config` 609 lines (pure data); largest with logic `he-data` 437 |
| Top-level functions in the program | 220 | 94 |
| Mutable top-level variables (shared between functions) | 57 (56) | 47 (46) |
| Inline `style="…"` on the owner page | 325 | 0 |
| Owner page `style-src` | `'self' 'unsafe-inline'` | `'self'` |
| Owner page `script-src` | `'self'` + pinned library + 1 hash | unchanged |
| `innerHTML` sinks (program + modules) | 160 | 160 (all `${…}` classified; 0 `outerHTML`/`insertAdjacentHTML`/`eval`) |
| Listeners added / removed in the program | 176 / 3 | 161 / 3 (+ the rest moved into modules) |
| GitHub Actions | pinned by tag `@v4` | pinned by verified commit SHA |
| CI shards | split by file count (est. 33.2 / 25.5 / 27.1 min) | split by measured duration (est. 29.5 / 29.5 / 29.5 min) |
| Spec files | 109 | 119 |
| Page mutants | 170 | 179 (+9 EXT15) |
| Full suite (local, 2 workers) | 43.6 min; 1,895 passed | FINAL: see §7 |

## 3. Modularization (IMPLEMENTED IN BRANCH)

See `APPLICATION_MODULE_MAP_EXT15.md` (generated table, graph, deliberate edits, how to add the next module). Key points:

- Registry `assets/owner-login-modules.js`: a module is created once, in a fixed order, receives only what it asked for, and returns a frozen interface. Missing or out-of-date module files stop start-up with a plain message instead of a half-working page.
- Proof tools: `app-graph.js` (inventory), `extract-module.js` (moves code), `app-modules.js` (order, cycles, hidden dependencies via the TypeScript checker), `verify-moves.js --styles` (every original statement present once, unchanged, except named edits).
- High-risk writes (purchase-order receiving, inventory, returns, recalls, accounting) **stayed in the program** on purpose; they use the shared guarded helpers in `he-data`.

## 4. Strict style policy (IMPLEMENTED IN BRANCH)

See `CSP_AND_INLINE_STYLE_REPORT_EXT15.md`. 325 inline styles → 129 generated utility classes; 3 dynamic cases by hand (checked hex colour variable, CSSOM colours, status classes). Deliberate-break tests prove the browser blocks inline styles, injected `<style>`, foreign stylesheets, inline scripts and `javascript:` links. Five smaller pages still allow inline styles (PROPOSED follow-up).

## 5. CI (IMPLEMENTED IN BRANCH, VERIFIED ON GITHUB CI)

See `CI_GUIDE_EXT15.md`.

| CI problem found in EXT15 | Effect | Fix |
|---|---|---|
| The static job ran a browser spec (`safety.spec.js`) but installs no browser | every CI run on PR #29 failed at the first job; the browser shards never ran | static job lists only Node-only specs; guard test; `ci:local` hides the browser for that step |
| A docs-only push compared itself only with the previous push | it cancelled the code push's run, then skipped the browser suite as "documentation only" — green without browser tests | pushes compare with `main`; guard test |
| The database job failed once on GitHub with no readable reason | unknown cause | the runner now prints a GitHub annotation with the failing step and its last 25 lines. **OPEN INTERMITTENT** (passed on every later run; same suite passes on a local CI-like PostgreSQL) |
| Actions pinned by moving tag | could change underneath | pinned to SHAs read from GitHub with `git ls-remote` |

GitHub CI results (VERIFIED ON GITHUB CI):

| Branch / commit | Static | Shard 1 | Shard 2 | Shard 3 | Database | Visual |
|---|---|---|---|---|---|---|
| PR #29 `e51f9ed` (EXT14 final, before fix) | **fail** | skipped | skipped | skipped | skipped | skipped |
| PR #29 `2d90113` (static-job fix) | pass | pass | pass | pass | **fail (cause unknown)** | pass |
| PR #29 `b6f7f68` (annotations) | pass | pass | pass | pass | pass | pass |
| EXT15 `ddfdc32` | pass | see note | | | pass | |
| EXT15 `66a9918` (freeze candidate) | FINAL: see §7 | | | | | |

Note: before the change-impact fix, EXT15 pushes that followed a docs-only push skipped the browser shards; those runs are not counted as browser evidence.

## 6. Real problems fixed

| # | Area | Problem | Found by | Fix and test |
|---|---|---|---|---|
| 1 | Home / nightly check | a blank or malformed "problems found" count showed **PASS** | property test | only a whole number counts; else UNKNOWN (`property-node-ext15`) |
| 2 | AI agents | a switch value that is not a real on/off showed **Enabled** | malformed-data test | Unknown (`malformed-data-ext15`) |
| 3 | AI page | a failed month-spend read showed **"$0.00 spent, $30.00 remaining"** | type checker: an error value was never read | "?" and "could not be read" (`malformed-data-ext15`) |
| 4 | Offline | the offline bar covered the menu button, Refresh and Sign out; on a narrow screen the menu could not be opened | UI chaos seed 1501 | bar at the bottom, click-through; regression test with negative control (`chaos-ui-ext15`) |
| 5 | CI | see §5 (three CI defects) | GitHub run history | as §5 |

## 7. Verification (FINAL — filled in from the freeze run)

FINAL: see `RELEASE_REVIEW_EXT15.md`.

## 8. Not done in EXT15 (moved to EXT16)

- Calendar, search, status display and the high-risk screens are still in the program file (the high-risk ones deliberately).
- A/B rounds 2–3 of the slowdown investigation and the worker-count experiment (would have competed with verification runs for the same 4 CPUs).
- Inline styles on the five smaller pages.
- Long (60–120 min) soak, failure shrinking, high-risk client state machine.
- Full page-mutant run (179) and SQL mutants on the final code; the 9 EXT15 mutants were checked when written.
