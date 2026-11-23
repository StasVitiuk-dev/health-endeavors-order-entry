# Partial receiving and returns — the stock rules for your review (D-ops-5)

Status: rules DECIDED by the owner on 2026-11-22 (below) · database change PROPOSED (draft 40, OWNER DECISION REQUIRED before production) · For: Stas
Backlog: INV-17 (partial-quantity returns), and partial receiving of purchase orders.
Scope: a prototype on made-up stock. **No real stock is written**, and no live
behaviour changes. The live stock buttons keep working exactly as today.

## Your rules of Nov 22 (CURRENT)

You answered the Nov 21 decisions with these rules (quoted):

> Log surplus deliveries separately for owner review. Record rejected deliveries
> separately and leave their quantity outstanding. Put damaged goods that we retain
> into a damaged or quarantine status. Reopen outstanding quantities for supplier
> returns only when a replacement is expected. Let staff submit receiving records
> for permitted purchase orders, with owner approval before stock changes. Put
> customer returns into "Awaiting inspection." Opened or used skincare must remain
> unavailable for resale. Preserve corrections as linked stock movements with a
> reason and approver. Build and test these rules in staging, then provide the
> proposed database changes for review.

| Nov 21 decision | Your Nov 22 answer | Where it is built |
|---|---|---|
| 1 Supplier sends more than ordered | Logged separately as surplus; you keep or return it | draft 40, prototype R2/R5 |
| (new) Rejected on arrival | Recorded separately with a reason; stays outstanding | draft 40, prototype R4 |
| 2 Damaged on arrival | Kept units go to Damaged and count as received | draft 40, prototype R4 |
| 3 Sending units back to the supplier | Reopens the order only when a replacement is expected | draft 40, prototype R6 |
| 4 Who receives deliveries | Staff submit for permitted purchase orders; you approve before stock changes | draft 40, prototype R8 |
| 5 Customer returns | Awaiting inspection first; you decide; opened or used is never restocked | draft 40, prototype R7 |
| (new) Corrections | A linked reversing movement with a reason and you as approver, once | draft 40, prototype R10 |
| 6 Prepare the database change | Done: draft 40 and rollback 41, tested in staging (74 of 74) | `docs/ops/sql-review/ITEM_5_DRAFT_40_PARTIAL_RECEIVING.md` |

Open point for you: with today's row rules staff cannot see purchase orders, so they
cannot yet submit receiving records. Whether staff may see some or all purchase orders
is a separate decision (see review item 5).

The prototype on the Inventory page (`assets/inventory/he-receiving.js`, version
2026-11-22) now follows these rules: 27 steps with three deliveries (rejected, damaged
and surplus jars), two supplier returns (one with a replacement), a customer return
inspected in two parts (opened jars refused for restock) and one correction. The
step-by-step table and the rules below from Nov 21 are kept as the record of what
you reviewed then; the rules R1 to R10 in the code replace them.

## What you asked for (Nov 21) — DEPRECATED by the rules above

> Show an order for 20 units where 8 arrive first, 12 arrive later, and 3 are
> returned. Show the remaining quantity and stock movement at each step. For
> customer returns, distinguish sellable units from damaged ones. Test duplicate
> submissions, over-receiving, over-returning, and audit history. Bring the stock
> rules back to me for review under D-ops-5 before enabling any live stock changes.

## The example, step by step

Made-up product `SYN-HONEY-8OZ` (5 jars in stock at the start; a customer bought 5
earlier). Purchase order `SYN-PO-020` for 20 jars.

| # | What happened | Result | Received | Still to come | Sent back | Customer returned | Available | Damaged | Stock movement |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Start | — | 0 of 20 | 20 | 0 | 0 of 5 | 5 | 0 | — |
| 1 | First delivery: 8 arrive | recorded | 8 of 20 | 12 | 0 | 0 of 5 | 13 | 0 | Available +8 (5 → 13) |
| 2 | The same delivery sent again (double click or retry) | already recorded, nothing changed | 8 of 20 | 12 | 0 | 0 of 5 | 13 | 0 | none |
| 3 | Someone tries to receive 13 | **refused**: only 12 are still to come | 8 of 20 | 12 | 0 | 0 of 5 | 13 | 0 | none |
| 4 | Second delivery: the other 12 arrive | recorded; order fully received | 20 of 20 | 0 | 0 | 0 of 5 | 25 | 0 | Available +12 (13 → 25) |
| 5 | 3 go back to the supplier (wrong scent on the labels) | recorded | 20 of 20 | 0 | 3 | 0 of 5 | 22 | 0 | Available −3 (25 → 22) |
| 6 | Someone tries to send back 18 more | **refused**: only 17 received units are left on that order | 20 of 20 | 0 | 3 | 0 of 5 | 22 | 0 | none |
| 7 | A staff member tries to receive stock | **refused**: only the owner or an administrator changes stock | 20 of 20 | 0 | 3 | 0 of 5 | 22 | 0 | none |
| 8 | The customer returns 3 of 5: 2 sellable, 1 damaged | recorded | 20 of 20 | 0 | 3 | 3 of 5 | 24 | 1 | Available +2 (22 → 24); Damaged +1 (0 → 1) |
| 9 | The same return submitted again | already recorded, nothing changed | 20 of 20 | 0 | 3 | 3 of 5 | 24 | 1 | none |
| 10 | Someone tries to take back 3 more | **refused**: only 2 of that sale are still out | 20 of 20 | 0 | 3 | 3 of 5 | 24 | 1 | none |

History: 4 changes, 5 stock movements, 4 refusals recorded with their reasons.
Check: adding every movement to the starting stock gives the final stock exactly.

"3 are returned" could mean either sent back to the supplier or returned by a
customer, so the example shows both, each with 3 units.

## The rules as proposed on Nov 21 (DEPRECATED: replaced by your Nov 22 rules)

| # | Rule | Today (live) | Proposed |
|---|---|---|---|
| R1 | Whole units only; at least one unit per submission | same | same |
| R2 | A delivery can never be more than is still to come on that order line | the whole order is received at once (no partial deliveries) | partial deliveries allowed; extra units refused (see decision 1) |
| R3 | A delivery with several lines is recorded completely or not at all | same (whole order) | same, per delivery |
| R4 | Delivered units go to Available, or to Damaged when marked damaged on arrival; both count as received | everything goes to Available | as proposed (see decision 2) |
| R5 | Units sent back to the supplier: never more than were received and kept on that order, nor more than the chosen stock (Available or Damaged) holds; sending back does **not** reopen the order | not supported in the dashboard | as proposed (see decision 3) |
| R6 | A customer return: never more than was sold and not yet returned; sellable units go to Available, damaged ones to Damaged, in one return | one destination for the whole return line | split per unit (INV-17) |
| R7 | Each submission has its own request key: sent again, nothing changes; the same key with different contents is refused | same, for the existing stock functions | same |
| R8 | Only the owner or an administrator changes stock | same (Query A) | same (see decision 4) |
| R9 | Every change records who, when, why, and the stock before and after; refusals are recorded too; nothing is edited or deleted; a mistake is corrected by a new entry with a reason | changes are recorded in `inventory_adjustments` | same, plus recorded refusals |

## The Nov 21 decisions (ANSWERED on Nov 22, see the top)

1. **A supplier sends more than ordered.** Proposed: refuse, and you change the order
   first (so the extra units are a decision, not an accident). Alternative: accept
   up to a set percentage extra.
2. **Damaged on arrival.** Proposed: count as received and put in Damaged (so the
   order shows it was delivered, and the damage is visible). Alternative: do not
   count it as received.
3. **Sending units back to the supplier.** Proposed: it does not reopen the order; a
   replacement is a new order line. Alternative: it reopens the line so the
   replacement can be received against the same order.
4. **Who receives deliveries.** Proposed: as today, only you or an administrator.
   Alternative: staff may record a delivery, which waits for your approval before
   stock changes (like stock counts).
5. **Customer returns: who decides sellable or damaged.** Proposed: the person
   receiving the return (owner or administrator), with a reason, as today.
6. **Then:** whether to prepare the reviewed database change that makes partial
   deliveries and split returns live (a new SQL draft with its own tests and
   rollback, for your separate approval).

## Where it is

| What | File |
|---|---|
| The rules, as code (made-up stock only) | `assets/inventory/he-receiving.js` |
| Tests of every rule | `tests/specs/partial-receiving-ext22.spec.js` (12 tests, Nov 22 rules) |
| The database change | `docs/ops/sql/drafts/40_DRAFT_partial_receiving_returns.sql`, rollback `41_…`, test `docs/ops/sql/local-test/partial_receiving_test.sh` (74 of 74) |
| The example on the Inventory page | switch "Partial receiving and returns" on the Feature Flags page (OFF by default); `tests/specs/partial-receiving-wiring-ext22.spec.js` |
| Live stock functions (unchanged) | `docs/ops/sql/drafts/10_DRAFT_stock_functions.sql` (`receive_purchase_order`, `receive_return`) |

## Honest limits

- The prototype runs in the browser on made-up numbers. Two people pressing at the
  same moment, and a retry after a lost reply, are proven in the database draft
  (staging test sections 1 and 6), not in the browser prototype.
- Refunds are not part of this; returns record stock only, as today.
