# Operator and state safety (EXT20)

Status: **CURRENT.** It reviews what protects an operator from double, stale or lost actions, and what EXT20 added. Nothing here was redone where equal or stronger evidence already existed.

## 1. Operation state contract

The contract (`OPERATION_STATE_CONTRACT_EXT19.json`) covers 7 operations, checked against `he-ops.js` by 6 × 4,000 random events:

- PO receive;
- return receive;
- recall quarantine;
- stock adjustment;
- product delete;
- approval;
- the shared request-key create.

**Review for more candidates:**

| Candidate | In contract? | Why |
|---|---|---|
| Agent switch (`agent_controls`) | no | a single boolean toggle with a stale-value guard (`updateIfUnchanged`) and confirmation. No multi-step outcome, so no UNKNOWN state to manage |
| Customer communication draft | n/a | the dashboard sends nothing (`no-live-send.spec.js`); replies are copied by hand |
| Product lifecycle (archive / restore) | covered | `product delete` plus the guarded-update helper and stale-tab tests |

**Invariants already enforced by the contract test and its mutants (all caught):**

- UNKNOWN never re-sends automatically;
- CONFLICT never overwrites;
- REFUSED never shows as saved;
- SENDING cannot be submitted twice;
- a late old reply cannot undo SAVED.

## 2. Operator actions

| Risk | Evidence |
|---|---|
| Double click / repeated Enter | `double-submit-stale.spec.js`, `reauth-double-submit.spec.js`, chaos double-clicks (one update per click) |
| Record changed while a confirmation is open | guarded updates refuse a stale write (`updateIfUnchanged`; `stale-tab-gaps.spec.js`, `double-submit-stale.spec.js`) |
| **Back / Forward / reload after a save** | **new, EXT20:** `operator-safety-ext20.spec.js`. A saved stock adjustment is not sent again by Back, Forward or a reload (forms are handled by the page, not posted by the browser) |
| Offline during a high-risk action | `session-failures.spec.js`, chaos offline steps: no fake success |
| Unknown result | "may or may not have been saved" plus read-back (PO receipt check, adjustment read-back, request lookup). `session-expiry-midway.spec.js` |
| Session expired, refresh failed, revoked, permission changed, network down | `auth-chaos.spec.js`, `session-failures.spec.js`, `session-expiry-reads-ext15.spec.js`, `role-matrix.spec.js` |
| Cross-tab sign-out with a save in flight | `session-security-ext18.spec.js` (INT-6 fixed) |
| Focus after refused / conflict / unknown; live regions | `a11y-ext8.spec.js`, a11y live-region tests (EXT P2). EXT20 changed no dialog |

## 3. Accessibility of EXT20 changes

The palette keyboard path was changed (list-only scrolling). `palette-perf-ext20.spec.js` proves:

- Arrow Down and Arrow Up through every row keep the selected row visible;
- the page itself never scrolls.

Reduced-motion and zoom are unaffected: no animation or layout rule changed.

## 4. Long session

The EXT17 60-minute soak (resource trends: listeners, timers, DOM nodes) still stands. EXT20 did not change timers, listeners or polling. The palette change *removes* work per keystroke. A new soak was judged not useful.
