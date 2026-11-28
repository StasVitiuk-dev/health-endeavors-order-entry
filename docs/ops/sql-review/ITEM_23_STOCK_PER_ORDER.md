# Review item 23 — stock per order (draft 76)

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-28
(night, while you slept). Nothing here has been run in production. I never run it myself: you run it,
after approving it. Part of the launch plan (`docs/ops/LAUNCH_PLAN_2_WEEKS.md`, step 3b of the database list).

## What it does, in plain words

Launch promise 2: "stock goes down by exactly the amount sold". Today no order lowers the stock count.
After this step:

1. An order can take its bottles off the count **exactly once** (pressing twice, or two phones at once,
   still takes them once). It is **all or nothing**: if any line's SKU is not on a product, or a product
   would go below zero, nothing changes and the message names the line.
2. A cancelled order gives its bottles back **once**.
3. **One way back only (added Nov 28, morning):** a sold bottle comes back to the shelf either as a
   cancelled order here, or as a customer return inspected under item 5 (drafts/40), never both. Giving
   an order back is refused once a return is recorded for one of its lines, and a return can no longer
   be decided for a line already given back (both checked on a throwaway copy, also when the two happen
   at the same moment). Without this, 4 test bottles were counted twice.
4. Every move is recorded (who, when, which order line) and can never be changed or deleted, and the
   stock history shows "Order #… taken off stock".

Nothing happens by itself: the button is on Orders → **Stock per order** (switch off until you turn it
on, after this step). The automatic Shopify way comes later (R9).

## Before you decide

- **When does an order take its stock: when it is paid, or when it ships?** Recommended: when paid
  (Shopify lowers its own count at checkout). The button works either way: you press it at the moment you
  choose.
- Only you and active administrators can use it (the same rule as every stock change today).
- Order lines find their product **by SKU** (order lines have no link to the product in your database), so
  the SKUs on Shopify and on the dashboard's products must be the same (launch item R8; the product
  import's **Save for Shopify** makes them the same).

## Before running (read-only, optional, 1 minute)

How many order lines would find no product by SKU today (counts only; no names, no amounts):

```sql
select count(*) as order_lines,
       count(*) filter (where p.id is null) as lines_without_a_product
  from public.order_items oi
  left join public.products p on lower(p.sku) = lower(oi.sku)
 where oi.quantity > 0;
```

Old orders without a product don't matter (nothing takes their stock). After the product list is in,
new orders should have `lines_without_a_product` = 0.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/76_DRAFT_order_stock_moves.sql` (stock per order) | 256 | `fc91d28decf94e78` |
| `docs/ops/sql/drafts/77_DRAFT_rollback_order_stock_moves.sql` (undo of 76) | 48 | `bbcd05fc33ede704` |

It stops by itself, changing nothing, if your orders, order lines, products or stock tables differ from
the shape your Query A showed, if a needed index or `is_owner_or_admin()` is missing, or if a table of the
same name exists that it did not create. The functions run with the caller's own rights (security
invoker); visitors are refused by name (the FIX 3 rule). Tested on a throwaway copy: 83 of 83 checks
(`docs/ops/sql/local-test/order_stock_moves_test.sh`), and it installs in its place on a copy shaped like
your real database (`production_shape_install_test.sh`, 34 of 34).

## How to run (one sitting, about 10 minutes)

1. Tell Claude "ready for item 23". Claude re-checks the fingerprint above against the file.
2. Supabase → SQL Editor → New query → paste the whole of `76_DRAFT_order_stock_moves.sql` → check the
   last line is `commit;` → **Run** → screenshot.
3. Run the check below → screenshot.

## After running: check (read-only)

```sql
select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('take_order_stock', 'give_back_order_stock', '_he_order_stock')) as functions,
       to_regclass('public.order_stock_moves') is not null as record_table,
       has_function_privilege('anon', 'public.take_order_stock(uuid)', 'execute') as visitors_can_run,
       has_function_privilege('authenticated', 'public.take_order_stock(uuid)', 'execute') as staff_can_call,
       (select count(*) from public.order_stock_moves) as moves;
```

Expected: `3 | true | false | true | 0` (checked on a throwaway copy, Nov 28). Then, on the dashboard:
Feature Flags → **Stock per order** says **Installed** → Turn on → Orders → Stock per order → try it on
the **test order** first (`docs/ops/TEST_ORDER_CHECKLIST.md`).

## If something is wrong: undo

Paste `77_DRAFT_rollback_order_stock_moves.sql` and run it. It removes the three functions, so no order
can take or give back stock any more. It **does not change any stock number**: bottles already taken off
stay taken off (correct them by hand if needed). The record table is kept if it holds any move, and
removed if empty.

## Related

`docs/ops/ONE_STOCK_COUNT_DECISION_2026-11-24.md` (which count is the selling count), `docs/ops/STOCK_SAFETY_MATRIX.md`,
`docs/ops/TEST_ORDER_CHECKLIST.md`.
