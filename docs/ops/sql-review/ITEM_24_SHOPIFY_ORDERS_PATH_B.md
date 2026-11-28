# Review item 24 — Shopify orders saved once (R9 path B: draft 78 and the order program)

Status: **PROPOSED · OWNER DECISION REQUIRED** (path A or path B, `docs/ops/R9_SHOPIFY_ORDERS_DESIGN.md`) ·
production run PENDING your separate approval · written 2026-11-28 (morning). Nothing here is installed,
deployed or scheduled. **Use it only if you choose path B.** If today's order import works (path A), this
item is set aside.

## What it does, in plain words

Launch promise 2 says every order lands on the dashboard. If today's import (in the private backups
repository) is off or broken, this is the replacement, prepared in advance so it does not cost launch days:

1. A small program at Supabase asks Shopify, with a **read-only** key, for the orders created or changed
   in the last few days, every few minutes or once an hour (your choice).
2. Each order is written **once**: the order by Shopify's order id, each line by Shopify's line id. Running
   it twice, or two runs at the same moment, changes nothing.
3. When Shopify changes an order (a quantity, a refund, a cancellation), the dashboard copy follows. Two
   exceptions:
   - a line whose bottles were already taken off stock (item 23) is **left as it was**, and the run says so;
   - an order you deleted on the dashboard is **never brought back**.
4. **No customer details** are asked for or kept: no name, email, address or card. The order shows its
   number, date, status, lines and totals.
5. It obeys the dashboard's own **Shopify Order Sync** switch (Feature Flags): while that is off it asks
   Shopify nothing and writes nothing, and **System mode → Emergency** (which turns that switch off) stops it
   too. The switch stays off until the test order.
6. It never changes stock. Taking bottles off stock is still item 23 (the button, or later an automatic
   step once you choose "when paid" or "when shipped").

## Before you decide

- **Never two importers at once.** If you choose path B while today's import still runs, that one is
  switched off first, in the backups repository (by you), or order lines would be written twice.
- Customer names on the dashboard's orders: path B keeps none. If you want names on packing slips, say so;
  it needs one more Shopify permission (customers) and your privacy text to cover it.
- How often: every 15 minutes is enough for a small store and stays well inside Shopify's limits.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/78_DRAFT_shopify_orders.sql` (Shopify orders saved once) | 200 | `5dd78c5a78d3dfc7` |
| `docs/ops/sql/drafts/79_DRAFT_rollback_shopify_orders.sql` (undo of 78) | 46 | `1194a52d0bab5470` |

The program: `docs/ops/edge-drafts/shopify-orders-sync/` (`index.ts`, `sync-core.mjs`).

It stops by itself, changing nothing, if your orders or order lines differ from the shape your Query A
showed, if the rule "one order per Shopify order id" is missing, if the database's service key may not read
and write orders (Supabase gives it that by default), or if the service key would not be allowed to run the
new function. Only the program can run it: visitors and signed-in people (you included) are refused by
name. Tested on a throwaway copy with made-up Shopify answers: 47 of 47 checks
(`docs/ops/sql/local-test/shopify_orders_test.mjs`); it installs in its place on a copy shaped like your
real database (`production_shape_install_test.sh`, 35 of 35).

## How to run (two sittings, only for path B)

**Sitting 1 (10 minutes): the database step.**
1. Tell Claude "ready for item 24". Claude re-checks the fingerprint above against the file.
2. Supabase → SQL Editor → New query → paste the whole of `78_DRAFT_shopify_orders.sql` → check the last line
   is `commit;` → **Run** → screenshot.
3. Run the check below → screenshot.

**Sitting 2 (30 minutes, Claude guides click by click): the program.**
1. Shopify → Settings → Apps and sales channels → Develop apps → create an app with **only** the
   `read_orders` permission → install it → copy its access key **straight into Supabase** (Edge Functions →
   Secrets), never into chat.
2. Deploy the program and give it its schedule (Claude gives the exact steps then).
3. Place the fake-card test order (`TEST_ORDER_CHECKLIST.md`) and watch it arrive once.

## After running: check (read-only)

```sql
select to_regprocedure('public.save_shopify_order(jsonb)') is not null as save_function,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_items' and column_name = 'external_line_id') as line_ids,
       has_function_privilege('anon', 'public.save_shopify_order(jsonb)', 'execute') as visitors_can_run,
       has_function_privilege('authenticated', 'public.save_shopify_order(jsonb)', 'execute') as signed_in_can_run,
       has_function_privilege('service_role', 'public.save_shopify_order(jsonb)', 'execute') as program_can_run;
```

Expected: `true | true | false | false | true`.

## Honest limits

- A line Shopify changed after its stock was taken is left as it was and named in the program's run
  report (Supabase → Edge Functions → its logs), **not yet on the dashboard**. Showing it in Needs Your
  Attention is a small follow-up once path B is chosen.
- An order with more than 100 lines is refused whole and named in the report (look at it in Shopify).
- Shopify's API version is pinned (`2026-10`); Shopify supports each version for about a year.

## If something is wrong: undo

Paste `79_DRAFT_rollback_shopify_orders.sql` and run it, and stop the program's schedule. It removes the
function, so the program can no longer write. It **does not delete any order or line**. The Shopify line ids
stay on lines that have them (they prevent a line being written twice if the step comes back).

## Related

`docs/ops/R9_SHOPIFY_ORDERS_DESIGN.md` (the two paths), `sql-review/ITEM_23_STOCK_PER_ORDER.md` (stock per
order), `sql-review/ITEM_6_SHOPIFY_FEED_AND_MONEY_MATCHING.md` (the payouts program it is modelled on),
`docs/ops/TEST_ORDER_CHECKLIST.md`.
