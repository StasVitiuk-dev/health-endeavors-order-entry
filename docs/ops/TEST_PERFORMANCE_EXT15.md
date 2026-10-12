# Test performance (EXT15)

Status: **CURRENT, MEASURED LOCALLY** on this session's machine (4 CPUs, 2 Playwright workers, Chromium headless). Numbers from GitHub's runners are not measured yet.

## 1. In plain English

The full test suite takes about 45 minutes here. EXT14 reported it had become about 6% slower than EXT13 and suspected the page split. EXT15 measured it properly: **the page itself did not get slower.** Sign-in takes the same time before and after, and the same set of tests runs within about 1% when repeated. The extra time came mostly from **more tests** (EXT14 added 9 spec files and ~75 tests) and from normal run-to-run noise.

Where the time goes: most of it is many ordinary short tests (2–4 seconds each: sign in, open a page, check a few things), which together are 60% of all test time. Each browser test signs in on a fresh page first (≈0.6 s), roughly 20% of all test time. The few very slow tests (10,000-record search, leak sweeps, layout sweeps) add up to only ~13%.

## 2. The "6% slowdown" investigation

| Measurement | EXT13 (`cc9a142`) | EXT14 page (`3a40095`) | Result |
|---|---|---|---|
| Sign-in to dashboard shown, median of 60 fresh runs each | 603 ms | 601 ms | **no difference** |
| Same 6 spec files (372 tests), 2 workers, round 1 | 544.5 s | 551.4 s | +1.3% (machine load 6.7 vs 7.8 during the runs) |
| Further rounds | see §6 | | |

Conclusion: the page split (program moved out of the HTML) is **not** the cause. The EXT14 full-suite difference (41.7 → 43.6 min) is explained by test growth: 100 → 109 spec files, 1,820 → 1,895 passing tests (+4%), plus noise of a few percent between identical runs on a shared machine.

## 3. Where the time goes (EXT14 final full run, 1,908 tests that ran)

| Test length | Tests | Total test time |
|---|---|---|
| under 1 s (mostly Node-only checks) | 450 | 1.2 min |
| 1–2 s | 130 | 3.2 min |
| **2–4 s (sign in + a few checks)** | **1,148** | **51.5 min (60%)** |
| 4–8 s | 102 | 9.3 min |
| 8–16 s | 46 | 7.9 min |
| over 16 s | 32 | 11.6 min (13%) |

Median test: 2.54 s; 90th percentile 3.83 s; 99th 18.3 s. Total test time 86 min, run on 2 workers → ~43 min wall.

Slowest single tests: 10,000-record palette search (74 s), resource-leak sweep (32 s), 5,000-product inventory (28 s), the phone-width layout sweeps (23–25 s each, 5 widths), the mutation-runner Ctrl-C test (21 s), 10 concurrent operators (20 s).

## 4. What would actually make it faster (PROPOSED, not done)

| Idea | Expected gain | Why not done now |
|---|---|---|
| Reuse a signed-in browser state between tests of the same file (Playwright `storageState`) | roughly 15–20% of test time (≈0.6 s sign-in × ~1,700 browser tests) | every test today starts from a clean sign-in on purpose (session bugs were found that way); needs a per-file review of which tests rely on a fresh sign-in |
| 3 workers instead of 2 | ~20–30% wall time on 4 CPUs if stable | must first prove timing-sensitive tests (debounce, stale reply, double-click) stay stable; see §5 |
| Split the 5 layout-sweep widths into separate tests | better parallelism, same total | small gain |
| Smaller data in the 10,000-record search test | ~1 min | the size is the point of the test |

## 5. Worker experiment

PENDING in this document until measured (see §6). The question is whether 3 or 4 workers finish faster without new flaky failures on this 4-CPU machine.

## 6. CI shard balance

See `CI_GUIDE_EXT15.md` §4: shards balanced by measured duration, ~29.5 min of test time each instead of 33.2 / 25.5 / 27.1.

## 7. Database suite

`npm run db:suite:local` (full) and `QUICK=1` (CI). Timing per step is printed by `tests/tools/run-db-suite.sh`; results in `ENGINEERING_REPORT_EXT15.md`.
