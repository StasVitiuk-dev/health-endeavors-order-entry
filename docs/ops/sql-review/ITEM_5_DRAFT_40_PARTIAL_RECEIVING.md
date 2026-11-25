# Review item 5 — SQL draft 40: partial receiving and returns (D-ops-5)

Status: OWNER DECISION REQUIRED · PROPOSED 2026-11-22 · production run PENDING your separate approval
Nothing here has been run in production. I never run it myself: you run it, after approving it.

## Changed before install: administrators approve too (owner decision, Nov 24)

Your decision of Nov 24 (administrator "almost like owner") applies here: **the owner or an
administrator** approves, rejects and decides (deliveries, surplus, returns to the supplier,
customer-return inspections, corrections). One line does it: the check `stock_is_owner()` now
answers yes for an active administrator too (its name is kept, so the undo file still matches).
A switched-off administrator is refused like anyone else. The database's messages now say
"Only the owner or an administrator …". Staff still only record; stock still changes only on an
approval. The dashboard's Deliveries and Returns screens show Approve, Reject, Inspect and Correct
to administrators as well (changed 2026-11-25). An administrator can approve a delivery they
recorded themselves, the way you can.

### Worked example (your request of Nov 25): order 20, receive 8, then 12, return 3

Made-up lotion, nothing in stock at the start. Computed by the rules prototype
(`assets/inventory/he-receiving.js`), which follows the same rules as this draft; the
database test checks the same steps against the draft itself.

| Step | Who | Stock movement | Purchase order after it | Stock after it |
|---|---|---|---|---|
| 0. Order of 20 placed | — | none | Open · received 0 · to come 20 | Available 0 · Damaged 0 |
| 1. 8 arrive, recorded | staff | **none** (waits for approval) | Open · received 0 · to come 20 | Available 0 |
| 2. Approved | administrator | Available +8 | Partly received · 8 · to come 12 | Available 8 |
| 3. The other 12 recorded and approved | staff, administrator | Available +12 | **Received** · 20 · to come 0 | Available 20 |
| 4. 3 leaking jars to go back to the supplier, replacement expected | staff | **none** (waits) | Received · 20 · to come 0 | Available 20 |
| 5. That return approved | administrator | Available −3 | Partly received · 17 · **to come 3** | Available 17 |
| 6. Someone tries to record 5 more on the 3 to come | staff | refused: "only 3 … are still to come; enter the rest as surplus" | unchanged | unchanged |
| 7. A customer returns 3 jars | staff | **none**: they are "awaiting inspection", not for sale | unchanged | Available 17 · 3 awaiting inspection |
| 8. Inspected: 1 sellable, 1 damaged, 1 unsuitable (not opened, not used) | administrator | Available +1 · Damaged +2 | unchanged | Available 18 · Damaged 2 |
| 9. The same return approved again (double click or retry) | administrator | none: "already approved; nothing changed" | unchanged | unchanged |

About customer returns: "awaiting inspection" is the quarantine (no stock bucket, not
for sale). Unsuitable units go to Damaged, because there is no separate stock bucket
for them; the inspection keeps "unsuitable" as its own outcome. Opened or used lotion
can never go back to Available: the database refuses it.

### Managers (drafts/62 and 64, not installed)

A manager is treated like an employee here: they record deliveries and returns for
the purchase orders they can see, and **cannot approve yet**.

**Owner decision of Nov 25: yes, a manager should approve deliveries and returns.** It is
not applied to this draft yet, because of one thing that needs your choice (OWNER DECISION
REQUIRED, see "How a manager may change stock" below). Supplier documents (item 4) were
simpler and are already changed.

#### How a manager may change stock (the open choice)

Approving a delivery changes stock: it adds to Available, raises "received" on the order line
and writes the stock history. In production, those stock tables can be changed **only by the
owner or an administrator** (the existing rules, Query A), and every function in this draft runs
with the rights of the person who clicks. So letting a manager press Approve is not enough:
their approval would be refused when it tries to change stock. Two ways:

- **A (recommended): one narrow "approval only" function with raised rights.** A manager can
  change stock **only** by approving a delivery or return someone else recorded; they still
  cannot edit stock numbers directly. It is the project's first such function in a new draft,
  so it is written and tested on its own, with a test that it changes nothing else.
- **B: give managers the same stock-table rights as administrators.** Simpler, but a manager
  could then also change stock numbers directly through the database, not only by approving.

Until you choose, managers record but do not approve deliveries and returns.

**Prepared for A (Nov 25, not installed, used only if you choose A):**

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/66_DRAFT_managers_approve_stock.sql` (install, after 40 and 62) | 119 | `473d2cf80603bfd6` |
| `docs/ops/sql/drafts/67_DRAFT_rollback_managers_approve_stock.sql` (undo) | 66 | `052b34380ab7e7c8` |

What 66 does, in short: a manager decides a delivery or a return **someone else** recorded. The
four decision actions (approve, reject, decide a supplier return, decide a customer return) run
with raised rights so the stock steps after a decision work; nothing else does. A manager still
cannot change a stock figure directly, decide a surplus, correct a movement or read the stock
history. To make this possible, draft 40 itself was changed **without changing what it does**:
its approval checks now ask two named helpers (`stock_may_decide`, `stock_can_decide`) that answer
exactly as before (owner or administrator); 66 widens only those two. Draft 40's own test still
passes 75 of 75.

Tested on the practice database (`local-test/managers_approve_stock_test.sh`, 61 of 61, twice):
- a manager approves and rejects an employee's delivery, and is named on it and on the stock
  movement;
- a manager cannot decide their own delivery, supplier return or customer return;
- a switched-off manager, an employee and a visitor are refused;
- a manager cannot change stock, the order line or the stock history directly, cannot approve by
  editing the record, and cannot correct a movement or decide a surplus;
- a manager reads the records waiting for a decision;
- the undo (67) puts everything back and keeps the decisions already made.

Breaking "not their own" makes 9 checks fail; leaving one action without raised rights makes 22
fail. The project's checks allow raised rights only for these four lines of 66 and refuse any
other.

The dashboard already shows a manager Approve/Reject (deliveries, returns to the supplier) and
Inspect (customer returns) on records someone else recorded. Surplus and corrections stay with you
and administrators. This part is the same for A and B; only the database step differs. (The dashboard was corrected on Nov 25 so that a manager can at least do what
an employee can; before that, the page would have refused a manager outright.)

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/40_DRAFT_partial_receiving_returns.sql` (install) | 1031 | `365d5690d36c92d7` |
| `docs/ops/sql/drafts/41_DRAFT_rollback_partial_receiving_returns.sql` (undo) | 79 | `922a93cc5e6d5f24` |

Before running, the file you paste must show the same fingerprint
(Terminal: `shasum -a 256 40_DRAFT_partial_receiving_returns.sql`).

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by
you. Tested only on throwaway local copies with made-up data.

## Purpose: your rules of Nov 22, in the database

| Your rule | What draft 40 does | Staging test section |
|---|---|---|
| Log surplus deliveries separately for owner review | Units beyond what is still to come are entered as **surplus** on the receiving line, only once the line is complete. They are not in stock. You decide: **kept** (goes into Available, with its own movement) or **returned** (no stock change). | 5 |
| Record rejected deliveries separately; leave their quantity outstanding | Each line has a **rejected** count with a required reason. Rejected units are never received, so they stay "still to come" on the purchase order. | 3 |
| Damaged goods we keep go into a damaged status | Damaged units we keep go into the **Damaged** bucket when you approve, and count as received. | 4 |
| Reopen outstanding quantities for supplier returns only when a replacement is expected | A return to the supplier says whether a **replacement is expected**. Only then does the quantity become "still to come" again, and a completed order goes back to Ordered. Without one, the order stays as it is. | 7 |
| Staff submit receiving records for permitted purchase orders; owner approval before stock changes | Staff (and administrators) submit for purchase orders their row rules let them see. **Stock never changes on a submission**, only on an approval. Only you or an administrator approve, reject or decide. The submitter, or you, can cancel a request that is still waiting. | 1, 6 |
| Customer returns into "Awaiting inspection"; opened or used skincare stays unavailable | A customer return is recorded as **awaiting inspection**, with no stock change, so it is not for sale. You inspect and give every unit an outcome: restock, damaged or unsuitable, and say whether it was opened and whether it was used. **Opened or used units can never be restocked**: the database refuses it, and a table rule refuses it too. Unsuitable units go to Damaged (there is no separate stock bucket for them); the inspection keeps "unsuitable" as its own outcome. | 8 |
| Corrections as linked stock movements with a reason and approver | You correct a movement with a reason. The database writes a new, reversing movement that points to the original and records you as the approver. The original is never edited. Each movement can be corrected once; a correction is not corrected again. A corrected delivery is "still to come" again. Stock can never go below zero. | 9 |

Also in every case:
- **Retries and double clicks:** each submission carries a request key, so sending it again records once.
- **Two approvals at the same moment:** approvals lock the rows they change, so the same units are never counted twice, and nothing beyond what is still to come is received.
- **History:** every change is a stock movement (bucket, change, who asked, who approved, why, where it came from), copied into `inventory_adjustments` so today's history screen shows it. Nobody can write, change or delete a movement by hand, the owner included.

## What changes in the existing tables

Draft 40 adds six new tables and changes the shape of no existing table. Only when
**you approve** something does it change:
- `inventory`: the Available and Damaged buckets, by the approved amounts;
- `purchase_order_items.quantity_received`;
- `purchase_orders.status`, which becomes Received when every line is complete (and Ordered again if a replacement or a correction reopens it);
- `inventory_adjustments`, which gets one row per movement.

## Who can see what (staff exposure)

| Record | Staff | Owner and administrators |
|---|---|---|
| Receiving records and their lines | their own | all |
| Returns to the supplier | their own | all |
| Customer returns waiting for, or after, inspection | all (they receive returns) | all |
| Stock movements and corrections | none | all (owner and administrators also approve and correct) |

**Important, to confirm before production:** today's purchase-order rules let only you and
administrators see purchase orders. Staff can submit only for purchase orders they can see,
so **with today's rules staff cannot submit any receiving record**: the draft keeps that rule
and does not widen it. If you want staff to record deliveries, letting them see some or all
purchase orders is a separate decision (a separate, reviewed change). The staging test used
a test-only rule letting staff see two made-up purchase orders.

## Migration order and dependencies

- Needs, in production: `auth.uid()`, `current_role()`, `is_active_staff()`, `is_owner_or_admin()`
  and the `purchase_orders`, `purchase_order_items`, `inventory`, `inventory_adjustments`,
  `returns`, `order_items` and `products` tables. If one is missing, it stops and changes nothing.
- Depends on no other draft. Independent of the invoice, stock-count and supplier-document drafts.
- The dashboard's existing whole-order receive and whole-line return (drafts/10) are **not changed**.
  Switching the screens over to these functions is a later, separate step.
- Safe to run twice.

## Staging results (throwaway database, made-up data)

| Test | Result |
|---|---|
| `local-test/partial_receiving_test.sh`: first delivery (staff submit, you approve); over-receiving; rejected units stay outstanding; damaged kept go to Damaged; surplus logged and decided; simultaneous approvals (two approvals of 7 on 10 outstanding: one goes through, one is refused; the same record approved 10 times: one movement); returns to the supplier with and without a replacement, and over the limit; customer returns inspected, opened ones refused for restock; corrections; the history cannot be written or changed by hand; stock reconciles; rollback; an administrator approves a supplier return (recorded as approver); a switched-off administrator and staff are refused | **75 of 75** |
| SQL drafts static checks (no security definer, fixed search path, pinned row rules, functions not granted to visitors, rollback removes only its own tables) and the SQL package checks | 108 of 108 |
| Dashboard prototype of the same rules (`assets/inventory/he-receiving.js`): unit tests | 12 of 12 |
| The worked example on the Inventory page, computer and phone size | 5 of 5 (one phone-only check skipped on the computer) |
| Malformed-input probe, assets, module and SQL checks, both sizes | 231 passed |
| Nov 22–23: the real screens on these functions, against a real throwaway database with this draft installed (behind a switch not on the Feature Flags page): **Deliveries** on Purchase Orders (record, approve, reject, surplus keep or send back; a lost reply; staff refused by the database) and **Returns to check and send back** on Returns (customer return awaiting inspection, inspection with opened skincare never restocked and every unit given an outcome, return to a supplier with a replacement expected, a correction as a linked movement; a lost reply; staff can record but not approve, inspect or see stock movements, and the database refuses when the page is fooled; Nov 25: an administrator approves a delivery and the database records them as approver) | all passed, computer and phone size (Nov 25: 292 passed together with the safety and SQL checks) |

## After running: checks (read-only, paste into the SQL editor)

```sql
select to_regclass('public.receiving_records') is not null as receiving_records,
       to_regclass('public.stock_movements') is not null as stock_movements,
       (select count(*) from public.stock_movements) as movements,
       (select count(*) from public.receiving_records) as records,
       has_table_privilege('anon', 'public.stock_movements', 'select') as visitors_can_read;
```
Expected: `true | true | 0 | 0 | false`. Anything else: stop and send me a screenshot.

## Rollback and recovery

- **Nothing submitted yet:** run file 41. It removes everything 40 added. Running it twice is harmless.
- **Requests exist but no stock has moved:** file 41 refuses and says how many. If you decide they
  can go, run `set he.rollback_delete_stock_requests = 'yes, delete the requests';` and then file 41,
  in the same SQL editor session.
- **Any stock has moved through this feature:** file 41 refuses, because the movements are the
  record of real stock changes. Instead:
  1. stop using the feature in the dashboard;
  2. export `stock_movements`, `receiving_records`, `receiving_record_lines`, `supplier_returns`,
     `customer_return_inspections` and `stock_corrections` (Export CSV);
  3. I prepare a reviewed fix.
- `inventory_adjustments` keeps every row it received in every case.
- Restoring a whole Supabase backup is the last resort, because it rolls back everything.

## Honest limits

- The real screens (Deliveries on Purchase Orders, Returns to check and send back on Returns) call
  these functions, behind the switch `he_receiving_store`, which is not on the Feature Flags page
  and does nothing until this draft is installed. The Inventory page still has the simulated
  example (switch "Partial receiving and returns", off by default).
- Nov 23: a return recorded by mistake can be cancelled on the page while it still waits
  ("Cancel (recorded by mistake)"): only the person who recorded it, or you; the record stays,
  marked cancelled, and no stock changes. Tested against the real throwaway database.
- The draft uses only the caller's own permissions (no security definer, the project rule). Your
  own permissions on inventory and purchase orders apply when you approve.
- "Unsuitable" units sit in the Damaged bucket; the stock table has no separate bucket for them.
- Refunds are not part of this; returns record stock only, as today.
- The exact row rules on production's purchase-order tables must be confirmed before running
  (see "Who can see what").

## Your decision

- [ ] Approve running draft 40 in production, or
- [ ] Not yet.
- [ ] Separately: should staff see purchase orders, so they can record deliveries? (yes / no / only some)
