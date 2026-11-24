# Review item 11 — SQL draft 52: the real fee and postage of each order

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-24
Nothing here has been run in production. I never run it myself: you run it, after approving it.

Why: your question of Nov 23, "they are estimates, not the exact fee per order: how can we fix
this?" With this step, Real profit uses what each order really cost wherever that is known, and
your estimates only where it is not.

## The exact SQL

| File | Lines |
|---|---|
| `docs/ops/sql/drafts/52_DRAFT_order_costs.sql` (install) | see the file; fingerprint re-checked by Claude before the run |
| `docs/ops/sql/drafts/53_DRAFT_rollback_order_costs.sql` (undo) | see the file |

## What it does, in plain words

A small new list, **order_costs**: one line per order with its **real platform fee** and its **real
postage**, each with where the figure came from (the channel's own money report, a Shopify Shipping
label, or typed by hand), who saved it and when.

- **Only you and your administrators** can read or save these (money figures). Staff and visitors
  see nothing.
- Either part can be missing. A missing part stays an estimate on the screen.
- A line is replaced, never deleted. Every change is written to the audit log.
- It refuses to install if a table with this name exists that this file did not create. It changes
  no existing table; orders are untouched.

On the dashboard (Accounting), after turning on **Real fees and postage per order** under Feature
Flags → Features that save real records:
- **Money per channel** gets a button **Save these real fees to their orders**. It matches the
  report's order numbers to the orders in the dashboard and says how many were saved and how many
  are not in the dashboard yet.
- **Real profit** uses the real figures and says, for example, "Real figures: the fee of 47 and the
  postage of 12 of the 52 counted orders. The rest use your estimates."

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/order_costs_test.sh`: **35 of 35 passed** (Nov 24): install twice; owner and
administrator save and read, staff and visitors refused; a part that is not given is kept; a
corrected fee replaces the old one; an order that does not exist is counted and skipped; refusals
(negative amount, unknown source, a fee without its source, an empty line, not a list, a bad id, more
than 500 at once, moving costs to another order, deleting); audit log; rollback; a foreign table of
the same name refused. Dashboard tests: `tests/specs/order-costs-ext24.spec.js`.

## After running: check (read-only, paste into the SQL editor)

```sql
select to_regclass('public.order_costs') is not null as table_present,
       (select count(*) from public.order_costs) as orders_with_costs,
       (select count(*) from pg_trigger where tgname = 'order_costs_audit') as audit_trigger,
       has_table_privilege('anon', 'public.order_costs', 'select') as visitors_can_read;
```
Expected: `true | 0 | 1 | false`. Anything else: stop and send me a screenshot.

## Undo

- Nothing saved yet: run file 53. It removes everything 52 added. Harmless twice.
- Costs saved: file 53 stops and says for how many orders. Export them first, then (only if you
  decide they can go) run `set he.rollback_delete_order_costs = 'yes, delete the order costs';` and
  file 53 in the same session. Real profit then uses the estimates for every order again.

## Honest limits

- It stores what it is given; it does not fetch fees by itself. Today the real fees come from the
  channel reports you choose under Money per channel. Shopify's own fees and Shopify Shipping label
  prices arrive automatically once the Shopify feed (review item 6) is connected.
- Postage from a channel report cannot be tied to an order (labels are listed without the order), so
  real postage waits for Shopify Shipping.

## Your decision

- [ ] Approve running draft 52 in production, or
- [ ] Not yet.
