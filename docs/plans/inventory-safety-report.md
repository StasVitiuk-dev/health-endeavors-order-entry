# Inventory safety report

Status: **investigation only.** Written September 29, 2026. No dashboard code or SQL was changed, nothing touched Supabase, and all tests use synthetic data.

## Summary

Every place in the dashboard that changes stock follows the same pattern:
1. It reads the number into the browser.
2. It does the arithmetic there.
3. It writes the new total back.
4. It writes the history record in a separate request, and then the status change in another.

None of these steps is protected, so three things go wrong:

- **Lost updates.** If anything else changes the same stock between steps 1 and 3 (another person, another tab, an agent), that change is silently overwritten. No error is shown and no record is left.
- **Half-saved work.** If the connection drops or a request fails partway, the earlier steps stay saved. The stock moves without a history record, or the record's status never changes.
- **Double-counting on retry.** After an error the button comes back, but the page still holds the old data. Pressing it again repeats the steps that were already saved.

All of it was reproduced with synthetic data. **The same database-side design fixes all of it** (section 4).

## 1. Findings, by severity

Severity reflects business impact, meaning wrong money or stock and how visible it is, times how easily it happens.

| # | Severity | Where | Exact failure scenario (reproduced) |
| --- | --- | --- | --- |
| 1 | 🔴 **High** | **Purchase order "Receive delivery"** (`owner-login.html` 4532–4641) | The connection drops on the last step, then the owner presses Receive again. **Stock 110/40 instead of 60/20, and 2 expenses instead of 1.** Even after a reload, the expense is logged twice. Money and stock are both wrong. |
| 2 | 🔴 **High** | **Recall "Quarantine stock"** (4908–4953) | The connection drops on the recall status update, then the owner presses Quarantine again. **80 units moved to Recalled from a 40-unit lot**, and Available is 20 lower than it should be. This is a safety-compliance record, and it overstates what was pulled. |
| 3 | 🔴 **High** | **Lost update, in all four places** (receive 4592, recall 4918, manual 8131, returns 8351) | Someone else changes the same product's stock between the page's read and write, and their change disappears without a trace. For example: 25 units sold during a quarantine leaves Available at 60 instead of 35. A delivery of 50 landing during a manual −10 leaves 90 instead of 140. The chance of this grows with every extra person or agent that writes stock. |
| 4 | 🟠 **High / rare** | **Delete product** (8031–8034) | The page deletes the product's stock row *first*, ignores any error, and only then tries to delete the product. If the product is in use, the database refuses the product delete, and the page correctly says "use Deactivate". **But its stock numbers are already gone.** Reproduced in the mock. On the real database this depends on whether row-level security allows deleting `inventory` rows (unverified). |
| 5 | 🟠 **Medium** | **Return "Mark Received" (restock)** (8322–8375) | The connection drops on the status update, then the owner presses Mark Received again, and the **3 returned units are restocked twice.** A second open tab showing the return as "approved" also restocks it again, because the status update isn't conditional on the return still being "approved". |
| 6 | 🟠 **Medium** | **Manual "Save adjustment"** (8112–8165) | The stock is saved but the history insert fails. The form keeps its values, so one more click **adds the amount again.** |
| 7 | 🟠 **Medium** | **Manual "can't go below zero" check** | The check runs in the browser against the number it read earlier. If 95 units are sold in between, a −60 is accepted and the count is written as 40, when the real stock was 5. |
| 8 | 🟡 **Medium** | **Missing history records** (all four) | Every half-saved case leaves stock changed with no matching `inventory_adjustments` row. The Inventory history stops adding up, and nobody is warned. |
| 9 | ℹ️ **By design (corrected Sept 29)** | **Recall doesn't reduce the lot's remaining count** (4927) | Quarantine moves units from Available to Recalled, but the lot's own `quantity_remaining` stays at 40. **The old system documentation (Sept 24) says this is deliberate:** `quantity_remaining` means "still physically in the business, in any bucket", not "still sellable". The remaining risk is only that a *second* recall on the same lot could quarantine again, and that's covered by finding 2 and the status check in the fix. |
| 10 | 🟡 **Low** | **Stale data** (all four) | Every action uses what the page loaded earlier: the order lines, the return row's attributes, the recall's status. Nothing re-checks before writing, so another tab or person can't be detected. |

**Stale-data specifics per workflow:**
- **Receive:** the page's copy of the PO says 0 received, even after the lines were saved. This is the root of the immediate-retry doubling.
- **Recall:** the button shows while the page thinks the recall is "initiated". There is no server-side status check.
- **Return:** quantity and SKU are read from HTML attributes on the row. The status write has no "still approved" condition.
- **Manual:** the numbers aren't stale (it re-reads first), but the gap between read and write is the lost-update window.

**Double-click:** all four disable the button during a save, so a fast double-click on one page is safe. The risk is **retry after an error** and **two tabs or two people**, not a double-click.

## 2. Tests written and results

| File | Tests | What they cover |
| --- | --- | --- |
| `tests/specs/po-receive.spec.js` | 8 × 2 sizes = 16 | Receive: baseline, drop at the end, retry, reload + retry, "saved but reply lost", 2 wanted-behaviour tests |
| `tests/specs/inventory-safety.spec.js` | 17 × 2 sizes = 34 | Recall (6), manual adjustment (5), returns (5), product delete (1), each with a baseline, current unsafe behaviour and wanted behaviour |
| `tests/helpers/stateful-backend.js` | helper | Opt-in extras for the mock: inserts, upserts and deletes are kept; `dropNext` (connection drop, optionally after the database saved the write); `failNext` (error reply); `beforeNext` (simulates another person changing data mid-action). The shared mock is unchanged. |

Results:
- **50/50 passing** on desktop and iPhone size.
- **250/250 across 5 repeated runs** of both files.
- Two test-timing issues were found during the repeats and fixed in the *tests*: they were checking before the page's last save had finished. The dashboard was not changed.
- The **5 "wanted" tests** are marked `test.fail()`. I confirmed each one fails on the wrong numbers, not on a timeout. When a fix lands, Playwright flags them. Then we remove `test.fail()` and retire the matching "current behaviour" tests.

## 3. Common root cause

| Problem | Cause | Cure |
| --- | --- | --- |
| Lost update | The arithmetic happens in the browser | Do `available = available + n` **inside the database** |
| Half-saved | Several separate requests | **One database function = one transaction** |
| Retry double-count | Nothing records "this was already done" | **Lock the source row + check its status** (idempotency) |
| Below-zero race | The check runs in the browser | Check in the database, **inside the same transaction**, plus a `CHECK (bucket >= 0)` safety net |
| Stale data | The page trusts its own copy | The function re-reads under a lock. The page reloads after any error. |

## 4. Recommended fix: one shared architecture

**Layer 1: one internal database function that every workflow uses**

```
apply_stock_change(product_id, bucket, change, reason, lot_id, source_type, source_id)
```
- Adds `change` to the chosen bucket **in the database**, using insert-or-update with `bucket = bucket + change`.
- Refuses to go below zero, and raises an error that rolls everything back.
- Writes the `inventory_adjustments` row **in the same transaction**, so stock and history can never disagree.
- Optional belt-and-braces: a unique key on `(source_type, source_id, product_id, bucket)` in `inventory_adjustments`. The same delivery, return or recall can then never be applied twice, even if a future bug skips the status check.

**Layer 2: one small function per workflow.** Each one locks its source row, checks its status, calls Layer 1, and updates the status, all in one transaction:

| Function | Replaces | Idempotency rule |
| --- | --- | --- |
| `receive_purchase_order(po_id, lots)` | Receive delivery | Already `received` → "already received", no change (your decision) |
| `quarantine_recall(recall_id)` | Quarantine stock | Not `initiated` → "already quarantined", no change. Keep `quantity_remaining` unchanged (by design, finding 9); consider refusing a second active recall on the same lot. |
| `receive_return(return_id, disposition)` | Mark Received | Not `approved` → "already received", no change |
| `adjust_inventory(product_id, bucket, change, reason)` | Save adjustment | Atomic by itself. Optionally, a client-generated request id makes a retry safe. |
| `delete_unused_product(product_id)` | Delete product | Deletes the stock row and product together, or neither |

**Security:** all functions use `security invoker` (the default). They run with the logged-in user's own permissions, so row-level security keeps working exactly as today. Execute permission goes to `authenticated` only. No new powers, no service key.

**Dashboard side (per workflow, small):**
- Replace the chain of requests with one `supabase.rpc(...)` call.
- On *any* error, reload the page's data instead of re-enabling a button that holds stale data.
- Show "already done" as information, not an error.

## 5. Recommended implementation order

Each step is its own reviewed PR. SQL is drafted as files only, and **you run it**.

0. **Read-only schema check (you run it; I provide the query).** Table columns, constraints, triggers and RLS policies for the six inventory and purchasing tables. Also check whether any stock bucket is already negative, since that would block the `CHECK` constraint. *(Already approved in principle.)*
1. **Tests PR:** `po-receive.spec.js` + `inventory-safety.spec.js` + helper. No dashboard change. *(Pushed to branches, no PR yet.)*
2. **SQL draft PR (not run): the shared foundation + `receive_purchase_order`.** Receive has the highest money impact (duplicate expenses) and your decisions are already made. It proves Layer 1 on the most complex workflow.
   - Includes a rollback script and a test script that runs inside `begin … rollback` on synthetic rows.
3. **Dashboard PR:** Receive button → rpc. Flip its `test.fail()` tests.
4. **`quarantine_recall`** (SQL PR, then dashboard PR). This one has compliance impact.
5. **`receive_return`** (SQL, then dashboard).
6. **`adjust_inventory`** (SQL, then dashboard). This also fixes the below-zero race.
7. **`delete_unused_product`** (SQL, then dashboard). Or first, as a zero-SQL stop-gap: stop deleting the stock row before the product delete succeeds. That's a one-line dashboard change, but it needs care, because the foreign key may block the product delete while the stock row exists.
8. **Optional:** the idempotency unique key and the `CHECK (… >= 0)` constraints, once step 0 shows the data is clean.
9. **Optional, read-only:** look for past damage. Duplicate "Purchase order …" expenses (approved), stock changes without a history row, recalls quarantined twice.

**Wait until steps 2–7 are done** before moving the inventory, purchasing or returns code into separate files (see the modularization plan). Refactoring and changing behaviour at the same time would make both harder to verify.

## 6. Decisions needed from you

1. ~~Finding 9~~: answered by the old system documentation. Leaving `quantity_remaining` unchanged is deliberate.
2. **Order:** start with Receive (my recommendation, highest money impact) or with the simpler manual adjustment?
3. **Product delete:** OK to start with the small dashboard-only stop-gap before the database function?
4. **Agents:** do any agents or automations write `inventory` directly? If so, the lost-update risk (finding 3) is higher than a single-owner setup suggests, and those writers should move onto `apply_stock_change` too.
