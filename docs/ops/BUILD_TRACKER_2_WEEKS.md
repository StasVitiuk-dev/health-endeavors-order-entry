# Build tracker — the 2-week plan (started Nov 23, 2026)

**One place for what we are building, what is done, what is next, and what waits
on the owner.** Updated as work lands. Detail per area: the linked docs.
Plans: `docs/ops/OPERATIONS_CHAIN_ALL_CHANNELS.md` (chain and gaps),
`docs/ops/ATTENTION_FEED_AND_SMART_SCAN_PLAN.md` (feed and scan),
`docs/ops/BUSINESS_EMAIL_PLAN.md` (email). History: `docs/PROJECT_RECORD.md`.

Status words: **DONE** (merged and live) · **READY** (built, tested, PR open, waiting
for the owner to merge) · **IN PROGRESS** · **NEXT** · **WAITS ON OWNER**.
Every new feature ships behind a switch that is off until the owner turns it on.
Database changes are drafts the owner runs after approving them.

## Ready for the owner to merge (in this order)

| PR | What | Tests |
|---|---|---|
| #37 | Documents and plans (this file, the chain, email plan, record) | docs checks |
| #42 | Confirm tax rate screen (+ #38–#41: fonts, readable sidebar, tax dates, product list import) | 3,259 passed on GitHub |
| #43 | **One attention feed** on Home ("Needs you now") | feed 13 + 68 related passed; GitHub green |
| #44 | **Drop-off receipt**: one carrier receipt marks every parcel dropped off; database draft 48 (review item 9) | DB 47/47; screen 13; 267 related passed |
| #45 | **Delivery watch**: stuck, late, problem and returned parcels in the feed with next step and customer message | 5 + 49 related passed |

## The plan, item by item

| # | Item | Status | Where |
|---|---|---|---|
| A | One attention feed, the main screen | READY (#43) | Home |
| B | Smart scan: drop-off receipts (paste, photo of barcodes, typing) | READY (#44) | Orders |
| B2 | Smart scan for everything (receipts, expenses, supplier papers, **bottle barcodes for batches**), free reading on the phone first | NEXT | scan page |
| 1 | One stock count for all channels | NEXT (via Shopify as hub if agreed) | Inventory |
| 2 | All Orders with channel badges (Amazon, Etsy, TikTok, website) | NEXT (via Shopify as hub if agreed) | Orders |
| 3 | Business email in the feed | WAITS ON OWNER (addresses) | feed |
| 4 | Money per channel (payouts and fees matched to the bank) | NEXT | Accounting |
| 5 | Real profit per order, product and channel | NEXT | Accounting |
| 6 | **Batch tracing**: batch recorded on each order (by scanning the bottle when packing); recall = one button lists every customer who got that batch and holds the rest | NEXT | Inventory, Orders, Recalls |
| 7 | Delivery watch | READY (#45); carrier tracking connects with Shopify | feed |
| 8 | Reviews from every channel in the feed, worst first, reply to approve | NEXT | feed |
| 9 | **Agent diary**: every automatic step written down (which agent, what, when, which order), shown on AI Agents and in the feed when it needs the owner; each agent keeps its on/off switch | NEXT (owner: "love it") | AI Agents, feed |

## What each agent will do (agents stay off until the owner switches them on)

| Agent | Job in the chain |
|---|---|
| #2 Order Intake | brings every new order in (all channels through Shopify), checks it, writes the diary |
| #3 Order Monitoring | watches orders that are not moving (unpaid, not packed in time) |
| #5 Shipping/Tracking | runs the delivery watch on a schedule, updates parcel status from tracking |
| #6 Customer Notification | prepares the customer messages (delivery, delays, returned); the owner approves before sending (decision D1) |
| #7 Customer Service | drafts replies to customer questions and reviews for approval |
| #9 Accounting | matches payouts and fees per channel to the bank; flags differences |
| #10 Tax Record | keeps sales tax records per channel and period |
| #1 Invoice | wholesale invoices |
| #4 Retail/Wholesale | store outreach drafts (owner approves sending) |
| #8 **Supervisor (the manager)** | checks every other agent ran on time and did its job; anything flagged and not handled within 24 hours is raised to urgent; an agent that fails or misbehaves is reported in the feed so the owner can switch it off |

## Owner decisions so far

- Customer updates: **approve first, automatic later** (D1).
- Receipt reading: **free first**, paid service only if needed.
- Postage: **Shopify Shipping**. Label paper: fits the Rollo.
- Website: built on Shopify (its orders are Shopify orders).
- All nine gaps approved; agent diary confirmed ("love it").
- PROPOSED, waiting for a yes: **Shopify as the hub** for Amazon, Etsy and TikTok
  (their official Shopify apps bring orders in and keep one stock count).

## Waits on the owner

1. Merge the PRs above (in order).
2. Business address (virtual mailbox) before the seller accounts; then Etsy, TikTok Shop, Amazon.
3. Business email addresses (planned for tomorrow).
4. The database steps in `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md`, then review item 9 (draft 48).
5. A yes or no on Shopify as the hub.
6. Batch barcodes: does the barcode on each bottle carry the **batch** number, or only the product code?
