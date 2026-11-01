# Page-mutation coverage — full 221 run (2026-11-01)

Status: CURRENT. First COMPLETE current-tree run of the 221-mutant page program
(prior evidence was only the 10 re-pointed kills). Tested tree: branch
`claude/ext20-recovery-2026-10-31` @ `01d4170` (code identical through the run;
later commits are docs + the esc re-point). Runner: `tests/mutation/run-page-mutations.js`
in an isolated git-worktree scratch, one mutant at a time, infra-aware classifier
(`tests/mutation/classify-run.js`, pinned by `mutation-classify-ext.spec.js`).
Browser: diagnostic Chrome-for-Testing 153 (pinned 1194 un-downloadable here).

## Denominators (kept distinct — applicability ≠ detection)
| Category | Count | Basis |
|---|---|---|
| Total inventory (page mutants) | 221 | MUTATIONS array |
| Applicable (anchor present, unique) | 221 | `--check`: 0 not-applicable, 0 duplicate |
| Baseline-healthy selections | 221 | full integrated run (2452 passed) + targeted baseline re-runs below |
| **CAUGHT — clean assertion** | **211** | runner, classifyRun |
| **CAUGHT — after stale-selector re-point** | **1** | esc mutant, re-pointed to helpers-unit, verified |
| **MUTATION-INDUCED TIMEOUT (intended-invariant liveness)** | **9** | baseline passes fast; mutant breaks exactly the awaited contract so the assertion's wait never resolves (see below) |
| SURVIVED (true coverage gap) | 0 | — |
| INFRA (genuine infra / undetermined) | 0 | the 9 timeouts are reproducible and baseline-verified, not infra |
| NO_TEST / equivalent / invalid | 0 | — |

**Clean detection: 212/221** (211 + the re-pointed esc). **9 more are
MUTATION-INDUCED TIMEOUTs**, reported as a SEPARATE category: a fast baseline plus
a reproducible mutant timeout establishes a mutation-induced liveness failure, and
for the inspected cases the awaited state IS the intended contract (so the intended
invariant is detected) — but the detection MODE is the assertion's 30 s polling
wait, not a fast targeted assertion, so they are NOT folded into clean CAUGHT and
NOT left as bare INFRA. No mutant counted as a kill on an infrastructure failure;
no timeout counted as "passed."

## The 1 initial NOT CAUGHT — esc mutant (investigated, not a gap)
`escaping broken (esc returns raw text)` in `assets/owner-login-helpers.js`,
selected via `xss-everywhere`. Survived because post-EXT19 the owner dashboard
renders through DOM **text nodes** (dom-sinks gate: innerHTML ceiling 0), so that
exported `esc()` is off the page's critical path and `xss-everywhere` no longer
exercises it. It is NOT dead-and-equivalent: `helpers-unit` directly tests `esc()`
and **catches the mutant** (verified — "escapes the five HTML special characters"
fails on the mutant, passes on baseline). Fix = re-point the mutant's selection to
`helpers-unit` (stale anchor, like the EXT19 re-points; commit 4bc5d65). Re-run:
CAUGHT (1 failed, 0 passed). Rendering-sink XSS safety remains covered separately
by `xss-everywhere` + the dom-sinks gate — not weakened by this change.

## The 9 timeouts — resolved to detections (baseline-verified)
Each timed out at Playwright's 30 000 ms PER-TEST limit, reproducibly, under a
serial re-run (no contention). The classifier correctly held them as INFRA (not
kills) by default. I then ran the UNMUTATED baseline for each selection:
| mutant (abbrev) | selection | baseline (unmutated) |
|---|---|---|
| return receive lost reply (X11-02) | failure-recovery -g "X11-02" | 6 passed (27.9s) |
| system status says DB works | system-status-ext10 -g "database unreadable" | 1 passed (12.9s) |
| zero shows -$0.00 | accounting-oracle -g "exactly zero" | 1 passed (5.2s) |
| figure effect changes number | (animation spec) | passed in full run |
| second press removed | (double-submit) | passed in full run |
| adjustment sends again (×2) | adjust-ops-ext17 -g "sends NOTHING" | 2 passed (7.5s) |
| history line refused | adjust-ops-ext17 -g "history line refused" | 2 passed (7.3s) |
| lost adjustment reply (browser) | (chaos) | passed in full run |
Baseline passes fast → the mutant makes the test's awaited post-condition never
occur → the assertion's wait never resolves → timeout. Verified correspondence
(example): the "read-back never recognises a saved adjustment" mutant replaces
`else if (p.before != null && now === p.before + p.change)` with `else if (false)`,
so the dashboard never shows "WAS saved — the stock is now 105" — exactly the text
`adjust-ops-ext17` awaits via `toContainText('WAS saved…', {timeout:30000})`. So
the intended invariant IS what fails; the slowness is only because the assertion
is a 30 s polling wait. Reported as MUTATION-INDUCED TIMEOUT (distinct), not clean
CAUGHT. Timeouts NOT lowered (baseline X11-02 already ~27.9 s; lowering would be a
threshold change and risk flakiness); tests not rewritten. A reasonable future
improvement is a bounded direct assertion for these contracts, noted not done to
avoid churn/threshold changes on passing product tests.

## Not covered here
- SQL mutants (`run-sql-mutations.sh`): require a disposable local loopback
  PostgreSQL. See the handoff for status (BLOCKED unless a non-production fixture
  is stood up); never run against production Supabase.
- This is a mutation-coverage signal on the current tree, not a guarantee of
  absence of all defects. Diagnostic browser, not pinned-1194.
