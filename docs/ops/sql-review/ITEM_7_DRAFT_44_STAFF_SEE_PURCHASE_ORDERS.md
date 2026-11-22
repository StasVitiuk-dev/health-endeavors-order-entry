# Review item 7 — SQL draft 44: all employees can see purchase orders (read only)

Status: OWNER DECISION MADE (Nov 22: yes, all employees) · production run PENDING your separate approval
Nothing here has been run in production. I never run it myself: you run it, after approving it.

## Your decision

> Allow all employees to do that stuff, since it's basically why I'm hiring them.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/44_DRAFT_staff_read_purchase_orders.sql` (install) | 55 | `c87c37c54901a648` |
| `docs/ops/sql/drafts/45_DRAFT_rollback_staff_read_purchase_orders.sql` (undo) | 21 | `a5ed8d4783851cf5` |

## What it changes

Two **read-only** rules. Active staff may see purchase orders that are not deleted, and their
lines. Nothing else:
- staff still cannot add, change or delete a purchase order or a line;
- stock still changes only when you approve (draft 40);
- a deactivated account sees nothing; visitors see nothing;
- no data is changed.

## What staff will see (please read)

Supplier, order number, dates, status, **payment status**, notes, and every line's product,
quantity, quantity received and **unit cost** (also landed cost, shipping and tax on the order).
If you would rather staff not see costs, that is possible as a separate change (a view without
the cost columns that the staff screens use instead). Tell me if you want it.

## Order with other drafts

- Independent of every other draft. Most useful together with draft 40 (partial receiving):
  with both installed, staff record deliveries and you approve them.
- Needs `is_active_staff()` and row-level security already on for purchase orders (it checks
  and stops otherwise).

## Staging results (throwaway database, made-up data)

| Test | Result |
|---|---|
| `local-test/staff_read_purchase_orders_test.sh`: before (staff see none); install twice; staff see the open order and its line with the cost; a deleted order stays hidden; staff cannot add, change or delete; a deactivated account and a visitor see nothing; owner and administrator unchanged; with draft 40, staff submit 8 units, stock unchanged until the owner approves, then 5 → 13; rollback; install again | **26 of 26** |
| SQL drafts static checks (only read rules, no grant, the rollback drops exactly these two rules) | 122 of 122 |

## After running: check (read-only)

```sql
select policyname, cmd from pg_policies
 where tablename in ('purchase_orders', 'purchase_order_items') and policyname like 'staff_read_%'
 order by 1;
```
Expected: two rows, both `SELECT`. Anything else: stop and send me a screenshot.

## Rollback

Run file 45: staff no longer see purchase orders, exactly as before. It changes no data and is
safe to run twice. Receiving records staff already submitted stay as they are.

## Your decision on running it

- [ ] Approve running draft 44 in production, or
- [ ] Not yet.
