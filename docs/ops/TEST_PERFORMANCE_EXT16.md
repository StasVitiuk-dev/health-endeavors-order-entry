# Test performance (EXT16)

Status: **CURRENT, MEASURED LOCALLY** (4 CPUs, Chromium headless). Builds on `TEST_PERFORMANCE_EXT15.md`.

## 1. In plain English

EXT15 guessed that reusing one sign-in across tests would save 15–20% of test time. EXT16 measured it: **5.6%**. The guess was too high because each test still loads the page; only the typing and the sign-in request are skipped. EXT16 also measured how many test workers this machine handles best: 3 workers are about 7% faster than 2 on the measured set, 4 barely more, at much higher machine load. Neither change is switched on by default yet (§4).

## 2. Signed-in session reuse (A/B, same 369 tests, 6 spec files, 2 workers)

| Run | Sign in through the form (default) | Reuse the saved session (`HE_FAST_LOGIN=1`) |
|---|---|---|
| Round 1 | 577.0 s | 546.7 s |
| Round 2 | 571.2 s | 537.0 s |
| Mean | **574.1 s** | **541.8 s (−5.6%)** |
| Result | 369 passed, 0 failed, 0 flaky (both rounds) | 369 passed, 0 failed, 0 flaky (both rounds) |

How it works (`tests/helpers/dashboard.js`): the first sign-in in a worker saves the synthetic session; later tests restore it before the page loads. Each test still gets its own fresh mock database. The restore runs once per page, so a test that signs out and reloads really is signed out.

## 3. Worker count (same 181 tests, 3 spec files, one run each: indicative, not a median)

| Workers | Wall time | Peak load (4 CPUs) | Result |
|---|---|---|---|
| 1 | 415 s | 2.9 | 181 passed |
| 2 (default) | 287 s | 7.5 | 181 passed |
| 3 | 267 s (−7%) | 11.4 | 181 passed |
| 4 | 262 s (−9%) | 16.7 | 181 passed |

## 4. Decisions

- **Session reuse: OFF by default (opt-in).** A 5.6% saving (~3 min of a ~55 min run) does not yet outweigh losing each test's own fresh sign-in. Before turning it on: an isolation checker that proves no test depends on the one before it (EXT17 phase 76–78).
- **Workers: stay at 2.** The measured set did not include the timing-sensitive tests (double clicks, slow and stale replies, debounce) that machine load breaks first; 3 workers needs a full-suite run with zero new flaky tests first.

## 5. Other EXT16 timing facts

- High-risk state machine property test: 5 seeds × 5,000 events in 1.2 s (was 1.2 min before the assertions were made cheap).
- Shrinker self-tests: 1.2 s (Node); browser self-test 1.3 min.
- Full-suite timings for the EXT16 freeze: see `RELEASE_REVIEW_EXT16.md`.
