# High-risk operation contract (EXT19)

Status: **CURRENT on the feature branch.** Machine-readable source: [OPERATION_STATE_CONTRACT_EXT19.json](OPERATION_STATE_CONTRACT_EXT19.json).

## 1. In plain English

One shared list of states covers every high-risk action:

- READY;
- VALIDATING;
- SENDING;
- CONFIRMED;
- FAILED_BEFORE_EFFECT;
- RESULT_UNKNOWN;
- READBACK_CHECKING;
- RESOLVED;
- CONFLICT;
- SESSION_EXPIRED;
- PERMISSION_DENIED.

The contract file lists the allowed moves between them and the 7 high-risk operations. For each operation it says what stops a duplicate or stale action and which tests prove it.

## 2. The 7 operations

| Operation | Client protection | Database protection |
|---|---|---|
| Receive a PO | state machine (strict) | status claim; R1 when installed |
| Manual stock adjustment | state machine (repeatable) + read-back | stale-value check; R4 when installed |
| Return receive / restock | buttons disabled while sending | `updateIfUnchanged('returns')`; R3 |
| Recall quarantine | buttons disabled while sending | `updateIfUnchanged('recalls')`; R2 |
| Delete unused product | confirmation + in-use checks | R5 (re-checks under the product lock) |
| Approval decision | buttons disabled while sending | `updateIfUnchanged('approval_requests')` |
| Task status | confirmation | `.in('status', allowedFrom)` compare-and-set |

## 3. Tests (`state-contract-ext19.spec.js`, Node only, in the CI static job)

- the code tables equal the contract exactly;
- the invariants hold:
  - RESULT_UNKNOWN leaves only through a read-back;
  - no SENDING → READY;
  - CONFIRMED is final;
  - every other state can reach READY;
- every operation's protection is still in the code, and its tests exist; a new tracker missing from the contract fails;
- 6 seeds × 4,000 random events: the tracker accepts exactly what the table allows, and an unknown result is never re-sent (0.2 s).

**Mutants caught:** an unknown result may be re-sent; a conflict goes straight to sending.
