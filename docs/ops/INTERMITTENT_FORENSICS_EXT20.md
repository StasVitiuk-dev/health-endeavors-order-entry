# Intermittent forensics (EXT20)

Status: **CURRENT.** The register is `tests/forensics/intermittent-register.json`.

**Rule (formal from EXT20):** a rerun that passes **never** closes an entry. An entry closes only when its cause is reproduced on demand and a fix is shown to remove it.

## 1. Summary

| ID | Test | EXT20 result | Class | Status |
|---|---|---|---|---|
| INT-7 | search palette, 10,000 records, slowest keystroke < 250 ms | **root cause found and fixed** | PRODUCT (amplified by ENVIRONMENT) | **FIXED** |
| INT-8 | two uploads of the same file name | **reproduced on demand; test race fixed** | TEST | **FIXED** |
| INT-3 | one replay inside the chaos shrinker self-test | not reproduced; next failure now self-explaining | UNEXPLAINED | **OPEN** |
| INT-1, 2, 4, 5, 6 | (earlier rounds) | unchanged | — | FIXED / EXPLAINED |

## 2. INT-7: the palette did two wasteful things on every keystroke

**Instrument.** `tests/forensics/palette-int7.probe.spec.js` uses the same set-up as the failing test: 10,000 products, so the inventory table behind the palette has 10,000 rows. It times 125 keystrokes and takes a CPU profile of them.

**Finding 1 (layout):** 93% of keystroke time was spent in `scrollIntoView()`. That call scrolls every ancestor of the selected row, which forced a layout of the whole page, including the 10,000-row table behind the palette.

**Finding 2 (allocation):** `searchEverything()` built a result object and label for every match (10,000 for "s") and then kept only 30. Under a 4× slower CPU this caused garbage-collection pauses of 700–900 ms.

**Fixes (behaviour unchanged):**

- the palette scrolls only its own list;
- the search stops matching once 30 results are found. The results and their order are the same.

**Measured distributions (ms):**

| Condition | Before (b433037) p50 / p90 / p99 / max | After p50 / p90 / p99 / max |
|---|---|---|
| Quiet, 1 browser | 37.5 / 42.6 / 50.2 / 55.5 | **2.5 / 4.0 / 6.5 / 6.8** |
| CPU 4× slower (controlled contention) | 196.9 / 248 / **282.8 / 284.1** (over the 250 limit) | **11–14 / 17–22 / 25–33 / 27–35** |
| 4 browsers at once (4 workers on 4 cores) | medians 40–48; one run p99 322, max 341 | medians 3–5; 1 of 8 runs had a single 326 ms spike, not repeated in the next 4 runs |

**Not tried:** injecting long tasks. The measurement runs synchronously inside the page, so an injected task cannot fall inside the timed window. That is itself a finding: the 524 ms seen in the full suite was work done inside the keystroke handler, not event-loop waiting.

**Classification:** PRODUCT (real wasted work, measurable on any large inventory), amplified by ENVIRONMENT (CPU contention). The residual rare spike under 4 parallel browsers is ENVIRONMENT. The 250 ms limit was **not** raised.

**Guards:**

- `palette-perf-ext20.spec.js`: no `scrollIntoView` while typing or moving, and the selected row is always visible.
- 2 mutants, both caught.

## 3. INT-8: the test clicked a disabled button

**Instrument.** `tests/forensics/upload-int8.probe.spec.js` widens the window between the first file request and the end of the first save by delaying the first `documents` insert.

| First insert delay | Uploads | Before click 2 |
|---|---|---|
| 0 ms | 2 | button enabled |
| 300 ms | **1** (the INT-8 failure) | button **disabled** |
| 1,500 ms | **1** | button **disabled** |

**Cause:** the test started the second upload as soon as it saw the first FILE request. The first save was still waiting for the database reply. The page correctly kept Save disabled, to prevent a double save, and cleared the form afterwards. Under load, the second click landed on the disabled button.

**Classification:** TEST. The product is correct.

**Fix:** each save is awaited (record saved, button enabled). The test now **always** delays the first insert by 300 ms, so the old race would fail every time instead of rarely. Result: 5 of 5 passed. No timeout was raised.

## 4. INT-3: still open, better evidence next time

What is known so far:

- History: once, locally, on 2026-10-12 (`885552e+`), a `networkidle` wait did not settle within 30 s at step 2 of a replayed 3-step sequence (task button flow).
- Never seen in a full chaos run.
- EXT20 ran the chaos spec twice (2 × 37 tests): passed.

Instrumentation added: any chaos step failure now appends:

- every request still in flight (method, path, age in ms);
- every mock hook still queued (delay, drop or fail).

The next occurrence will name what kept the page busy. Status stays **OPEN, UNEXPLAINED**.

## 5. New intermittents in EXT20

To be filled from the final full run (see `RELEASE_REVIEW_EXT20.md` §3).
