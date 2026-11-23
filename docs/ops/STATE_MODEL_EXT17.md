# High-risk operation states (EXT17)

Status: **CURRENT on the feature branch only.** Builds on `STATE_MODEL_EXT16.md` (PO receiving).

## 1. In plain English

Every action that changes stock must never happen twice by accident: not after a double click, not after a lost reply, not after a second tab. EXT16 gave purchase-order receiving an explicit state machine. EXT17 checked every other stock-changing action and found that **one had no protection: the manual stock adjustment**. With a lost reply, pressing Save again could add the stock twice. Proven on the old code: +5 with a lost reply, then a second press, took the stock from 100 to 110. That is fixed. The other actions were already protected by the database itself, as shown in §3.

## 2. Manual stock adjustment (new)

One state per product + bucket, in `he-ops` with a new **repeatable** mode: a confirmed adjustment is not final, because the same product can be adjusted again later. Everything else is as strict as PO receiving.

| Situation | What happens now |
|---|---|
| Reply lost while saving (connection dropped) | State RESULT_UNKNOWN. The message says pressing Save again first **checks**; it never sends twice |
| Save pressed again after a lost reply | Read-back of the stock: unchanged = "NOT saved, press Save again"; exactly +amount = "WAS saved, nothing more sent" (amount cleared); anything else = "cannot tell, check the history, reload": still blocked |
| Connection dropped before anything was written (the read) | "Nothing was changed"; Save is allowed again |
| Stock saved, history line refused | "The stock WAS changed … do not save it again" (before: "Could not save that adjustment", which invited a second save) |
| Database function path (R4), reply lost | Same read-back rule. The page refreshes its numbers after an error, so the R4 "expected value" check alone would have accepted a repeat |
| Another product or bucket | Not affected by an unknown result elsewhere |

Two independent layers stop a double count: the read-back check, and `begin()` refusing a send from RESULT_UNKNOWN. Removing either one alone does not double-count (shown by mutants). The test that catches a classification bug is the high-risk chaos run (§4).

## 3. The other high-risk actions: the database claim is the state machine

| Action | Protection against a double effect | Client tracker? |
|---|---|---|
| PO receive | explicit state machine (EXT16) + claim (Ordered/Shipped → Received) or R1 | yes (EXT16) |
| **Manual adjustment** | **none before EXT17** (not a status change, no claim) | **yes (EXT17)** |
| Return "Mark Received" | claim Approved → Received; restock only for the winning claim; R3 refuses a repeat | not needed |
| Recall "Quarantine" | claim Initiated → Quarantined; stock moves only for the winning claim; R2 returns already_done | not needed |
| Product delete | refused if anything refers to it; R5 locks and checks (INT-4 fix, see `DATABASE_RELIABILITY_EXT17.md`) | not needed |
| Approvals, PO status, tasks | compare-and-set on the status the page showed (stale → refused) | not needed |

A client tracker on top of a database claim would duplicate the protection without adding any, so none was added. The decision is recorded here instead.

## 4. Evidence

- `tests/specs/adjust-ops-ext17.spec.js`: 7 tests (desktop + iPhone). On the EXT16 code, 5 fail, and a direct proof shows +5 becoming +10.
- `tests/specs/ops-state-ext16.spec.js`: property test now 8 seeds × 5,000 events (5 strict, 3 repeatable) against an independent model. New invariant: a non-idempotent unknown result is never sent again.
- `tests/specs/chaos-long-ext17.spec.js`: adjustments with lost replies inside random operator sequences (40 steps in the suite; 250 / 500 / 1,000 opt-in). The stock moves by 0 or the amount each time, and the end total is exact.
- Mutants (all caught): read-back removed; read-back never recognises a saved adjustment; "stock saved, history refused" misreported; a confirmed adjustment blocks the next; a lost reply misread as "not saved" (caught by both the browser test and the chaos run).
