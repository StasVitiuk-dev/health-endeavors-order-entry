# High-risk operation state model (EXT16)

Status: **CURRENT on the feature branch only** (`claude/platform-ext16-overnight-systems-hardening-2026-10-12`). Not merged, not live.

## 1. In plain English

Some buttons change stock or money and cannot be undone from the dashboard: receiving a purchase order is the main one. Since EXT5 the page already protected against a double receipt in several separate ways: a "still ordered?" check in the database, a lock on the button, and a per-order "result unknown" flag. EXT16 puts these rules into **one small, explicit state machine** (`assets/app/he-ops.js`). The rules now live in one place, are tested on their own with thousands of random sequences, and cannot quietly drift apart.

What the database receives is **unchanged**. The change is on the screen side only: which presses are allowed.

## 2. States

| State | Meaning |
|---|---|
| READY | nothing in progress for this record |
| VALIDATING | checks before sending (reserved; PO receiving validates before `begin`) |
| SENDING | a request is on its way; a second press is refused |
| CONFIRMED | the database confirmed the change; **final**: a new send is refused |
| FAILED_BEFORE_EFFECT | the database refused, or the claim was proven unsaved; a retry is allowed |
| RESULT_UNKNOWN | the reply was lost and a read-back could not decide; **no send** until a person runs the check (unless the database step refuses duplicates, see §3) |
| READBACK_CHECKING | the person pressed "Check this order now" |
| RESOLVED | the check decided; READY again only when it said "not received" |
| CONFLICT | someone else changed the record first; the list is re-read, then READY |
| SESSION_EXPIRED / PERMISSION_DENIED | refused before any effect; shown, then READY |

## 3. Rules (each enforced in code and tested)

1. A second send while one is SENDING is refused (double click, two handlers).
2. Nothing is sent after CONFIRMED (no second receipt from this page).
3. Nothing is sent after RESULT_UNKNOWN, except when the database step itself refuses duplicates (the R1 `receive_purchase_order` function: "already received, nothing added"). Then a person may press again; nothing ever retries automatically.
4. RESULT_UNKNOWN is left only through an explicit read-back (`startReadback` → `resolved` / `stillUnknown`).
5. Read-back results are accepted only during a read-back.
6. Any transition not in the table throws an error: a bug can never turn into a silent success.
7. One transition table is the single source of truth (also for `begin`).

## 4. Purchase-order receiving (wired)

| Path | Outcome → state |
|---|---|
| R1 function on: success or "already received" | CONFIRMED |
| R1: reply lost (`err.kind === 'unknown'`) | RESULT_UNKNOWN (idempotent: a person may press again) |
| R1: expired sign-in / permission | SESSION_EXPIRED / PERMISSION_DENIED → READY |
| R1: refused / function missing | FAILED_BEFORE_EFFECT |
| Claim path: claimed (or reply lost but read-back shows our stamp) | CONFIRMED |
| Claim path: reply lost, read-back shows still ordered/shipped | FAILED_BEFORE_EFFECT |
| Claim path: reply lost, read-back failed | RESULT_UNKNOWN (button hidden, "Check this order now" shown) |
| Claim path: already changed elsewhere | CONFLICT → READY after re-read |
| "Check this order now" | READBACK_CHECKING → RESOLVED / RESULT_UNKNOWN |

The former `PO_RECEIPT_UNKNOWN` flag object is gone; the list reads `poReceiveOps.isUnknown(po.id)`.

## 5. Tests

- `tests/specs/ops-state-ext16.spec.js`: the rules one by one; **5 seeds × 5,000 random events** over 4 records compared with an independent reference model written from the rules (1.2 s).
- Mutation: 3 mutants (send after unknown, second send after confirmed, "still unknown" outside a read-back) are each **caught**.
- All existing purchase-order browser tests pass unchanged (`po-receive`, `purchase-orders`, fault injection, double submit, concurrency, stale tabs).

Found while building it (both fixed before commit): `stillUnknown()` was accepted during a send (property test); `begin()` kept its own list of states, so a wrong table entry went unnoticed (mutation run).

## 6. Not done yet (EXT17)

Returns, recalls, manual stock adjustments, product lifecycle, approvals and escalation still use their existing (tested) guards, not this state machine. They are the next candidates, one at a time, each with the same tests.
