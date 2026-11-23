# Property testing and automatic shrinking (EXT16)

Status: **CURRENT on the feature branch only.** Builds on `PROPERTY_AND_CHAOS_EXT15.md`.

## 1. In plain English

Random ("property") tests try thousands of situations from a fixed seed. Their weakness in EXT15: when one failed after 70 random steps, a person had to work out which of the 70 steps mattered. EXT16 adds an **automatic shrinker**: it cuts a failing sequence down to the smallest one that still fails and prints it. In the self-tests, a bug that needs three particular steps, hidden in 70 random ones, comes out as exactly those three.

## 2. The shrinker (`tests/helpers/shrink.js`)

1. Remove chunks (halves, quarters, … single steps), keeping a removal only if the shorter sequence still fails.
2. Remove single steps until none can go.
3. Simplify values (e.g. shorter text) when the test offers simpler variants.

It is bounded by a run budget and a time budget, and says when it stopped early (`complete: false`). A replay that crashes counts as "did not reproduce", never as proof. The seed is kept, so the shrunk sequence can be replayed exactly.

## 3. Self-tests

| Test | Result |
|---|---|
| Planted "open dialog → stale update → submit" bug in 70 random steps (5 seeds) | shrinks to **exactly 3 steps**, every seed |
| Slow predicate with a 120 ms budget | stops early, result still fails, budget respected |
| Value simplification (500-char text) | reduced to the 1 character that matters |
| Predicate that throws | never accepted as a reproduction |
| **Real browser chaos runner**, planted "search, then a task click" failure in a 24-step seed-1501 run | shrinks from 19 steps to **exactly [search, task]** (1.3 min, 11 replays) |

Two flaws in the shrinker itself were found by these self-tests and fixed before commit: simplification could swap a short accepted value for a longer one; browser replays started still signed in and hung on the sign-in form.

## 4. Where it is used

- UI chaos (`chaos-ui-ext15.spec.js`): the whole operation list is generated from the seed first; on a failure the test replays shorter sequences on a fresh sign-in with the mock database restored, and the error message names the seed, the failing step and the smallest sequence found.
- High-risk state machine (`ops-state-ext16.spec.js`): 5 seeds × 5,000 random events against an independent model; this property test found a real looseness in the new module (§5 of `STATE_MODEL_EXT16.md`).

## 5. Not done (EXT17)

- Chaos runs of 250 / 500 / 1,000 steps, and high-risk operations inside chaos runs.
- A corpus of minimized regressions (none needed yet: no real chaos failure occurred in EXT16).
- Shrinking for database-side random interleavings.
