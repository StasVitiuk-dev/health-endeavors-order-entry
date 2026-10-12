# Reliability testing (EXT17)

Status: **CURRENT on the feature branch only.** Synthetic data, local browser (Chromium) and throwaway PostgreSQL. Not real devices, not production.

## 1. In plain English

EXT17 ran the dashboard much longer and much harder than before:

- random operator sequences of up to 1,000 steps, including stock adjustments with lost replies;
- an hour-long real-time session;
- browser storage that is full, blocked or holds junk;
- a 400% zoom check;
- a check that the optional fast sign-in for tests leaks nothing between tests.

It found two real product bugs (§4) and five problems in the test machinery itself (§5), all fixed.

## 2. Long and high-risk chaos (`tests/specs/chaos-long-ext17.spec.js`)

The runner moved to `tests/helpers/chaos.js`. The EXT15 seeds keep their exact sequences. The high-risk mix adds **manual stock adjustments** with three modes: normal; reply lost after saving; connection dropped before saving. The operator presses Save again after an error. Extra invariants:

- each adjustment moves the stock by 0 or by its amount, never twice;
- at the end, stock = start + each landed adjustment exactly once.

| Run | Steps | Result | Time |
|---|---|---|---|
| seed 1711 (in the normal suite) | 40 | PASS | 33 s |
| seed 1712 (`CHAOS_LONG=1`) | 250 | PASS | 3.2 min |
| seed 1713 | 500 | PASS | 7.0 min |
| seed 1714 | 1,000 | PASS | 12.6 min |

Proof that it can fail: the mutant "a lost adjustment reply misread as 'not saved'" is caught by the 40-step run.

## 3. Long real-time soak (`tests/specs/soak-long-ext17.spec.js`, `SOAK_MINUTES=60`)

The high-risk chaos mix runs in one signed-in page for 60 real minutes. Every 5 minutes the test samples event listeners, DOM nodes, live timers and JS heap, and after warm-up nothing may keep growing.

SOAK_RESULT

## 4. Product bugs found

| Bug | Who would see it | Fix |
|---|---|---|
| Manual stock adjustment counted twice after a lost reply and a second press | anyone adjusting stock on a bad connection (old code: +5 became +10) | explicit state + read-back (`STATE_MODEL_EXT17.md`) |
| With browser storage that refuses writes (full, or a private window that blocks it), a folded sidebar section could never be opened | Safari private windows (older versions block storage writes), full storage | open sections and pinned pages live in memory; storage only remembers them |
| A stored sidebar value of another shape (`{}`, `5`, `null`, e.g. from an older version) broke the whole sidebar | after a version change or a corrupted write | only a list of names is accepted |

Storage tests (`storage-adversarial-ext17.spec.js`, desktop + iPhone):

- 8 kinds of bad stored values (bad JSON, object, number, string, null, junk list, markup, 200 kB);
- storage that throws on every call;
- full storage;
- a section opened by hand staying open after the sidebar is drawn again.

Two mutants, both caught.

## 5. Problems in the test machinery (each would have let a test lie)

| Problem | Effect | Fix |
|---|---|---|
| S29 reproducer printed "no deadlock" with no database | a false pass | INCONCLUSIVE unless both calls completed |
| Mutation runner read "N failed" anywhere in the output | an error message like "seed 1711 failed" was taken as the count | only Playwright's summary lines count (escape codes stripped) |
| New chaos invariant measured the stock before the save finished | a double count could pass unseen | waits for the form to finish; end-of-run exact total |
| Inventory model driver counted a failed delivery | 13 false disagreements | earlier orders, lots and recalls picked from what exists |
| First Trusted Types probe fetched the page from the network | probe could not run | page served from the file with a report-only header |

## 6. Session-reuse isolation (`fast-login-isolation-ext17.spec.js`)

With the optional fast sign-in forced on, in order:

- each test gets a fresh mock database;
- no storage marker leaks from one test to the next;
- only the synthetic auth token is restored;
- after signing out, a reload stays signed out.

A mutant that restores the session again after sign-out is caught. Session reuse is still **off by default**. A full-suite A/B with it on is listed in the release review.

## 7. 400% zoom (`zoom-400-ext17.spec.js`)

At 320 px (a 1280 px window at 400%), Home, Orders, Inventory, Tasks, Returns and System status need no page-level sideways scrolling, and the menu, Refresh and Sign out stay on screen. A self-test proves the check notices a page that does not reflow. This is automated layout only, not a screen-reader or real-device test.
