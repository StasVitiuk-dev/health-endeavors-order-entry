# One stock count for all channels: what was found, and the decision needed (Nov 24, 2026)

Status: OWNER DECISION REQUIRED · nothing built for this item yet

The owner's rule (Nov 24): selling out fast is welcome; **selling more than is in stock is not**, and
the shared stock count must prevent it.

## What was found in the repository (checked Nov 24)

- The dashboard's stock number (`inventory.available`) changes only when a purchase order is received,
  when someone adjusts it by hand, on a recall, and on a return. **No order, on any channel, lowers it,
  neither when the order is placed nor when it ships.** No agent writes to the inventory table.
- So after every shipping day the dashboard's number is higher than the shelf, until someone corrects
  it by hand.
- The orders table carries a payment status, not a "shipped" mark; shipping is recorded separately.
- A draft exists for bringing Shopify's data into the dashboard automatically (not installed).

Not verified here (general understanding of Shopify, to be confirmed in the owner's own Shopify):
Shopify keeps its own stock count per product, lowers it at checkout for every connected sales channel,
and can refuse a sale when the count reaches zero.

## The decision: which count is "the" count for selling?

**Option 1 (recommended): Shopify's count is the selling count; the dashboard mirrors it.**
Shopify already lowers stock at the moment of sale on every channel connected to it, which is exactly
the protection against overselling. The dashboard would show Shopify's number next to its own book
number, flag any difference, and keep everything Shopify does not: batches, receiving, quality, recalls.
New stock received in the dashboard would be sent to Shopify (that step writes to Shopify, so it needs
the owner's approval).
- Good: one system decides at checkout; nothing can be sold twice between two systems.
- Needs: the Shopify connection installed (a production step with a key the owner provides), and
  "continue selling when out of stock" switched off in Shopify.

**Option 2: the dashboard's count is the selling count and is pushed to every channel.**
The dashboard lowers its own count for every order and sends the new number to Shopify and the
channels, keeping a safety buffer.
- Good: one place to look.
- Risk: two systems counting the same sale; a delay between them is exactly when overselling happens.
  More to build and more that can drift.

## What can be built before the decision (same under both options)

A database step so that **every order takes its bottles off the dashboard's book count exactly once**
(and gives them back when an order is cancelled), with a record of each move. Under option 1 it keeps
the book count honest for comparing with Shopify; under option 2 it is the count itself.
**Correction (Nov 28):** the real columns of `order_items` **are** on record: the owner's Query A of Oct 5
included `orders` and `order_items` (`sql-review/PRODUCTION_SHAPE_AUDIT_2026-11-27.md`, E1). They are order,
SKU, product name, quantity, prices, and **no link to the product**, so lines match products by SKU. The
sentence that follows (written Nov 24) said they were only guessed; it is kept for the record. **Built Nov 28
as a draft: `sql/drafts/76_DRAFT_order_stock_moves.sql`** (undo 77; `local-test/order_stock_moves_test.sh`,
62 checks), see "Built Nov 28" below. Original text: BLOCKED on one read-only check first: the real columns of `order_items` in production are not on
record (the local test schema only guesses them: order, product name, SKU, quantity; no link to the
product). The step must not be written against a guess. NEXT: the owner runs a read-only shape check of
`orders`, `order_items` and `inventory` (given in chat), as was done for `shipments`; then the database
step as a draft with a local test; then the screen.

## The read-only shape check (prepared Nov 24, NOT RUN on production)

One statement. It changes nothing and reads no rows: only the names and types of the columns of
`orders`, `order_items`, `inventory` and `products`, their keys and links, the names of their triggers,
and whether row-level security is on. No customer, no order, no amount is in the answer. Tried on the
local throwaway database only.

How to run it: Supabase → SQL Editor → New query → paste → Run → Export → Download CSV → send the CSV.

```sql
with t(tbl) as (values ('orders'), ('order_items'), ('inventory'), ('products'))
select '0 table missing' as section, t.tbl as item, 'not found in schema public' as detail
  from t where not exists (select 1 from information_schema.tables x where x.table_schema = 'public' and x.table_name = t.tbl)
union all
select '1 column', c.table_name,
       lpad(c.ordinal_position::text, 2, '0') || ' ' || c.column_name || ' ' || c.data_type ||
       case when c.is_nullable = 'NO' then ' NOT NULL' else '' end ||
       case when c.column_default is not null then ' (has a default)' else '' end
  from information_schema.columns c join t on t.tbl = c.table_name
 where c.table_schema = 'public'
union all
select '2 key or link', cl.relname, con.conname || ': ' || pg_get_constraintdef(con.oid)
  from pg_constraint con
  join pg_class cl on cl.oid = con.conrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname
 where con.contype in ('p', 'f', 'u')
union all
select '3 trigger', cl.relname, tg.tgname || ' -> ' || p.proname
  from pg_trigger tg
  join pg_class cl on cl.oid = tg.tgrelid
  join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join pg_proc p on p.oid = tg.tgfoid
  join t on t.tbl = cl.relname
 where not tg.tgisinternal
union all
select '4 rls', cl.relname, 'row level security ' || case when cl.relrowsecurity then 'ON' else 'OFF' end
  from pg_class cl join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
  join t on t.tbl = cl.relname
 where cl.relkind in ('r', 'p')
order by 1, 2, 3;
```

## Built Nov 28 (draft, NOT installed)

`sql/drafts/76_DRAFT_order_stock_moves.sql` (undo `77_…`), tested by `local-test/order_stock_moves_test.sh`
(62 checks; three deliberate breakages each caught) and by the production-shape install test (34 of 34):

- `take_order_stock(order)`: every line of the order takes its quantity off "available", matched to the
  product by SKU (capital letters ignored). **All or nothing**: an unknown SKU, or a product that would go
  below zero, refuses the whole order and names the lines. Taking the same order again changes nothing.
- `give_back_order_stock(order)`: puts back exactly what that order took, once (for a cancelled order),
  using the product recorded at the time, even if the SKU was renamed since.
- Every move is a row in `order_stock_moves` (never changed or deleted) and a history row in
  `inventory_adjustments` ("Order #… taken off stock").
- Owner or active administrator only; visitors and staff are refused. Two devices pressing at once: the
  stock moves once.
- **Dashboard side (also Nov 28):** Orders → **Stock per order** (switch "Stock per order" under the
  features that save real records, OFF; it can be turned on only once drafts/76 is installed): find an
  order, see each line and whether it took stock, then **Take these bottles off stock** or **Order
  cancelled: give them back**, each with a second press. Owner and administrators only. Tests:
  `tests/specs/order-stock-ext28.spec.js` (13 at both sizes). This is the manual way for every channel
  (Shopify, Etsy, Amazon, TikTok files); the automatic Shopify way is R9, later.
- Until a page or the Shopify step calls it, nothing changes by itself. **OWNER DECISIONS before it is used:** which count is the selling count (option 1 or
  2 above), and **when** an order takes its stock: when it is paid (recommended; Shopify lowers its own count
  at checkout), or when it ships.

