# CI and intermittent failures (EXT16)

Status: **CURRENT on the feature branch only.** The machine-readable register is `tests/forensics/intermittent-register.json` (never delete an entry; nothing is marked FIXED without a reproduced cause).

## 1. In plain English

"Intermittent" means a test that sometimes fails for no obvious reason. The rule here: never just re-run until green. Each one is recorded, investigated, and closed only when its cause is reproduced and fixed. Two of three are now explained and fixed; one new, minor one stays open.

## 2. Register

| ID | Test | First seen | Classification | Status |
|---|---|---|---|---|
| INT-1 | DB stress S21 (200 operators) | GitHub DB job, `2d90113` | HARNESS | **FIXED** (EXT15): refused connections were silently dropped; reproduced with a 30-connection limit |
| INT-2 | offline bar must not cover the menu (desktop) | GitHub shard 2, `079f378` | HARNESS | **FIXED** (EXT16), see §3 |
| INT-3 | one replay inside the chaos shrinker self-test | local | UNEXPLAINED | **OPEN INTERMITTENT**: one `networkidle` wait did not settle in 30 s; not seen in any full chaos run |

## 3. INT-2 forensics (the EXT15 open item)

Probe: `tests/forensics/offline-bar.probe.spec.js` (not part of `npm test`; run with `npx playwright test -c tests/forensics/probe.config.js`). At the first instant after going offline it records what is under the centre of each header button, the geometry, viewport, running animations and timing.

| Variant (25 repeats × desktop + phone) | Covered at the first instant |
|---|---|
| plain (resize 1100 → 760, no wait) | 25 / 50 |
| resize from 1280 first | 22 / 50 |
| stylesheet delayed 400 ms | 17 / 50 |
| plain, CPU load (4 busy cores) + 4 workers | 3 / 50 |
| **after waiting for running animations** | **0 / 50** |
| **after waiting for running animations, CPU load + 4 workers** | **0 / 50** |

Every covered case was on **desktop**, and the cover was the **sidebar** (its search box), never the offline bar. Cause: crossing the 820 px breakpoint makes the sidebar slide away (`transform .22s`); a check inside the slide sees the sidebar over the menu button. Not a product bug (the drawer is meant to slide away when the window narrows). Fix: the test waits for running animations after the resize, then checks strictly at the first instant (EXT15's 5-second re-check removed). The mutant "offline bar covers the header" is still caught.

## 4. CI changes in EXT16

None to the workflow file. Pins, shards and the jobs are as in `CI_GUIDE_EXT15.md`. GitHub CI results for the EXT16 head are in `RELEASE_REVIEW_EXT16.md`.
