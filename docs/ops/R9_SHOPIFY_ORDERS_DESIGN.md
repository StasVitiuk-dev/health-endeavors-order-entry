# R9 — Shopify orders into the dashboard, and their stock (design, Nov 28)

Status: **PROPOSED · OWNER DECISION REQUIRED** (morning list question 2). Nothing here is deployed or
switched on. **Nov 28 (morning): path B is prepared** as drafts only (draft 78, the program
`docs/ops/edge-drafts/shopify-orders-sync`, review item 24), so choosing it costs no launch days; it is never
used if you keep path A. Related: `ONE_STOCK_COUNT_DECISION_2026-11-24.md` (which count sells), `sql-review/ITEM_23_STOCK_PER_ORDER.md`
(the stock step, draft 76), `TEST_ORDER_CHECKLIST.md`, `INTEGRATION_READINESS.md`.

## Where things stand (checked Nov 28)

- **Orders today:** an order import runs in the **private backups repository**, which Claude never opens.
  Whether it is switched on and still works is **unknown here** (the dashboard showed 0 orders on Nov 23,
  which fits "no store sales yet" and also "the import is off").
- **The Shopify program draft** in this repository (`edge-drafts/shopify-payouts-sync`, with drafts/42) reads
  **payouts only**; it never touches orders.
- **Stock:** drafts/76 lets an order take its stock exactly once (and give it back once). Today a person
  presses the button on Orders; nothing calls it by itself.
- **Safety already in the database (Query A):** one order per channel and outside order number
  (`orders` unique on channel + external_order_id). **Not** protected: order lines (`order_items` has no
  unique rule), so two importers writing the same order would duplicate its lines.

## The decision (one of two paths)

**Path A — the existing import works (recommended if it does).**
1. The owner confirms it (the read-only count in the morning list shows orders arriving).
2. Claude needs to know, without opening that repository: does it write `orders` with `channel = 'shopify'`
   and Shopify's order id in `external_order_id`, and the lines in `order_items` with the **SKU**? (The
   owner can paste the first lines of its log or answer from memory; a read-only look at a few columns of
   the newest order, with no customer fields, settles it.)
3. Stock then works with the button (draft 76) from day one. Later, an automatic step: when an order
   arrives **paid** (or ships, the owner's choice), the database takes its stock by itself — a small
   database trigger calling the same function, so it is still once and all or nothing.

**Path B — no import, or it is broken.**
A new program in this repository, written like the payouts draft: read-only access to Shopify (scope
`read_orders` only), every few minutes or on Shopify's order webhook, writes each order **once** (by
channel + order id) and its lines **once** (a new unique rule on order line + Shopify line id, added by
its own database step), never a customer's card or more than the order needs. Then the same automatic
stock step as in path A. **Prepared Nov 28** (not deployed): draft 78 and the program, 46 checks against
made-up Shopify replies (`docs/ops/sql/local-test/shopify_orders_test.mjs`); what is left is one owner sitting to
install the database step and one to create the read-only key and switch the program on
(`sql-review/ITEM_24_SHOPIFY_ORDERS_PATH_B.md`). It keeps no customer details (no name, email or address).

**Never both at once:** if path B is chosen while the old import still runs, the old one is switched off
first (in the backups repository, by the owner), because order lines would be written twice.

## Questions for the owner

1. Is the order import in the backups repository switched on? When did it last run? (morning list 2.2)
   **One read-only look answers most of path A** (added Nov 28, morning; counts only, no customer details,
   the last 60 days; checked on a throwaway copy with made-up orders):

```sql
select o.channel::text as channel, count(distinct o.id) as orders,
       count(distinct o.id) filter (where coalesce(o.external_order_id, '') <> '') as with_outside_number,
       count(oi.id) as lines,
       count(oi.id) filter (where coalesce(oi.sku, '') <> '') as lines_with_sku,
       count(oi.id) filter (where p.id is not null) as lines_matching_a_product,
       max(o.created_at)::date as newest
  from public.orders o
  left join public.order_items oi on oi.order_id = o.id
  left join public.products p on lower(p.sku) = lower(oi.sku)
 where o.deleted_at is null and o.created_at > now() - interval '60 days'
 group by 1 order by 2 desc;
```

   What it means: a `shopify` row with `orders` = `with_outside_number` and `lines` = `lines_with_sku` says
   the import writes what stock per order needs (path A works). `lines_matching_a_product` lower than
   `lines_with_sku` only means those products are not in the dashboard yet (the product list, R8). No
   `shopify` row at all, or an old `newest`, means no Shopify order arrived lately (no sales yet, or the
   import is off).
2. When should an order take its stock: when paid, or when shipped? (morning list 6b)
3. Path A or path B, once 1 is answered.
4. **Does the existing import change stock by itself?** If it does, an order would lose its bottles
   twice (once by the import, once by stock per order), so stock per order must not be used for those
   orders until this is known. Nothing in this repository lowers stock for an order today (checked Nov
   28: no page, no draft). A read-only look settles it (no customer fields; only the start of each stock
   history reason, whether a person made it, and how many):

```sql
select coalesce(left(reason, 40), '(no reason)') as reason_starts_with, (adjusted_by is null) as no_person, count(*) as changes, max(adjusted_at)::date as newest
  from public.inventory_adjustments
 group by 1, 2 order by 3 desc limit 15;
```

   Rows with `no_person = true` and a reason naming an order would mean the import changes stock. An import
   that changes stock without writing history would not show here; the test order settles that too
   (`TEST_ORDER_CHECKLIST.md`, check 5: note the stock **before** pressing the button).
