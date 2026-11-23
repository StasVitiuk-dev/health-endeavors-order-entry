# Engineering report: EXT17 (deep reliability)

Date: 2026-10-12. Branch: `claude/platform-ext17-deep-reliability-2026-10-12` (from EXT16 final `bcf4f25`). **Not merged, not deployed, nothing run against production.** Measured on synthetic data (test mock, throwaway PostgreSQL 16) and GitHub CI.

## 1. Summary for Stas (plain English)

- **Three real problems in the database drafts were fixed**: the rare "delete product" deadlock (INT-4), an order with no lines failing to be received, and a raw database error instead of a plain message when stock would go below zero. The drafts are still not installed anywhere (`DATABASE_RELIABILITY_EXT17.md`).
- **A real dashboard bug was fixed: a stock adjustment could be counted twice** when the connection dropped and the person pressed Save again (proven on the old code: +5 became +10). Pressing Save now checks first (`STATE_MODEL_EXT17.md`).
- **Two sidebar bugs with unusual browser storage were fixed.** A folded section could not be opened when storage was full or blocked, and an old or corrupted stored value broke the sidebar.
- **Much longer and harder testing**:
  - random operator runs of up to 1,000 steps;
  - an hour-long session;
  - a database model checked after every one of 1,800 random operations;
  - full, blocked and junk browser storage;
  - 400% zoom (`RELIABILITY_TESTING_EXT17.md`).
- **Five problems in the test machinery itself were found and fixed.** Each could have made a test pass when it should not.
- **Trusted Types (a stricter browser protection) was measured, not switched on**: 86 code locations would break. The path is written down (`TRUSTED_TYPES_EVALUATION_EXT17.md`).
- **Production readiness is unchanged (~15%).** No production evidence was added.

## 2. Before → after (MEASURED LOCALLY)

| Metric | EXT16 final (`bcf4f25`) | EXT17 |
|---|---|---|
| `assets/owner-login-app.js` | 6,214 lines | 6,307 lines (+ the adjustment state machine and read-back) |
| Application modules | 19 | 19 (`he-ops` gained a repeatable mode; `he-nav` memory-first state) |
| Explicit operation state machines | 1 (PO receive) | 2 (+ manual adjustment); other high-risk actions are protected by database claims (documented) |
| Page mutants | 187 | 196 (all applicable; 9 new, all caught) |
| SQL mutants | 14 | 15 (all caught) |
| Spec files | 121 | 127 |
| Property / model checks | 5 seeds × 5,000 (client) | 8 seeds × 5,000 (client) + DB model 30 seeds × 60 operations |
| Longest chaos run | 70 steps | 1,000 steps (plus a 60-minute soak) |
| Reviewed R1–R5 fingerprint | `3df2bf7a…` | `f6d9c2c8be690710eeb721041f6779d9` |
| Intermittents open | INT-3, INT-4 | INT-3 (INT-4 fixed with evidence) |

## 3. Problems found and fixed

| # | Area | Problem | Found by | Fix |
|---|---|---|---|---|
| 1 | Draft SQL (R5) | INT-4: delete product deadlocks with a delivery receive | GitHub DB job (EXT16), forced reproduction | re-check under the product lock |
| 2 | Draft SQL (R1) | an order with no lines: "division by zero" | INT-4 reproduction loop (EXT16) | `nullif`; test forces the revealing plan mode |
| 3 | Draft SQL (R4 and helpers) | below zero gave the raw rule error; the friendly check was dead code | **inventory property model** | refuse before the update |
| 4 | Dashboard | stock adjustment counted twice after a lost reply | review of every high-risk flow | state + read-back; "stock saved, history refused" now says so |
| 5 | Dashboard | folded sidebar section cannot open when storage refuses writes | storage tests (the test hung) | memory-first state |
| 6 | Dashboard | a stored sidebar value of another shape breaks the sidebar | storage tests | accept only a list of names |
| 7 | Test harness | S29 reproducer: "no deadlock" with no database | first run after a container restart | INCONCLUSIVE unless both calls completed |
| 8 | Test harness | mutation runner parsed counts from error text | a "1711 failed" count | summary lines only |
| 9 | Test harness | new chaos invariant measured too early | proving it with a mutant | wait + end total |
| 10 | Test harness | model driver counted failed deliveries | shrinking (13 identical cases) | pick from what exists |
| 11 | Test fixtures | old inventory test expected the understated message | regression run | expects the truthful message |

## 4. Intermittent failures

INT-1, INT-2, INT-4, INT-5 FIXED; INT-3 OPEN (one shrinker replay, unexplained, not seen again). Register: `tests/forensics/intermittent-register.json`.

## 5. Not done in EXT17 (carried forward)

- Program type-gating beyond the modules (JSDoc/checkJs over the whole program).
- Replacing `innerHTML` locations (the first step towards Trusted Types).
- Further module extraction of the high-risk screens behind a facade.
- Boot/session state machine (session expiry is covered by existing tests; no explicit machine yet).
- Connection-storm and schema-drift property tests beyond the existing S21 (200 callers) and Query H drift check.
- Performance baselines and a lazy-load evaluation.
- Session reuse on by default (the isolation checker exists; the full-suite A/B is in the release review).
