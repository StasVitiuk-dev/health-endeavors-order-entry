# R9 — Shopify orders into the dashboard, and their stock (design, Nov 28)

Status: **PROPOSED · OWNER DECISION REQUIRED** (morning list question 2). Nothing here is built, deployed
or switched on. Related: `ONE_STOCK_COUNT_DECISION_2026-11-24.md` (which count sells), `sql-review/ITEM_23_STOCK_PER_ORDER.md`
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
stock step as in path A. About one to two evenings of work for Claude, tested against made-up Shopify
replies, then one owner sitting to install and one to set the key.

**Never both at once:** if path B is chosen while the old import still runs, the old one is switched off
first (in the backups repository, by the owner), because order lines would be written twice.

## Questions for the owner

1. Is the order import in the backups repository switched on? When did it last run? (morning list 2.2)
2. When should an order take its stock: when paid, or when shipped? (morning list 6b)
3. Path A or path B, once 1 is answered.
