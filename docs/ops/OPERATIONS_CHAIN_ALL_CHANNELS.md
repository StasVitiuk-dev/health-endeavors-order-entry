# Operations chain across every sales channel — map and gaps (Nov 23, 2026)

Status: **AGREED** (owner, Nov 24: gaps 1–9 all approved; order and details below). Owner request, Nov 23: "everything connected — website,
Shopify, Amazon, Etsy, TikTok Shop and the rest — automated as much as possible,
agents controlling and tracing every step; tell me what we are missing").
One authoritative page for the whole chain; detail lives in the linked docs.
Related: `docs/ops/ATTENTION_FEED_AND_SMART_SCAN_PLAN.md` (feed and scan),
`docs/ops/integration-service-architecture.md` (Shopify service, PROPOSED),
`docs/ops/AUTOMATION_AND_AGENT_ARCHITECTURE.md` (agents).

## Rules for the whole chain

1. **One record per order, whatever the channel**, with the channel's own order
   number kept, so nothing is counted twice and every step can be traced back.
2. **One stock count for all channels.** A sale anywhere lowers stock everywhere;
   no channel may sell what another already sold.
3. **Every automatic step is logged** (who or which agent, what, when, from which
   channel), and every agent has an on/off switch the owner controls.
4. **Money and customer messages need the owner's approval first** (decision D1:
   approve first, automatic later).
5. **Each connection is switched on one at a time**, after the owner approves it.

## The chain, step by step

| # | Step | Shopify / website | Amazon | Etsy | TikTok Shop | Today |
|---|---|---|---|---|---|---|
| 1 | Order arrives | order sync (Order Intake Agent #2) | order report or API | order export or API | order export or API | Shopify sync drafted, **off**; others **not built** |
| 2 | Stock reserved, then lowered | dashboard stock (functions R1–R5) | needs channel stock sync | same | same | stock functions drafted (step 1 of the SQL runs); **channel stock sync not built** |
| 3 | Pick and pack | packing slip, 4×6 label | same | same | same | built (behind `he_order_slips`) |
| 4 | Postage and label | **Shopify Shipping** (decision D3) | Amazon "Buy Shipping" | Etsy labels | TikTok labels | buy inside each channel |
| 5 | Tracking to customer | Shopify's own shipped email | the channel | the channel | the channel | automatic once labels are bought in the channel |
| 6 | Delivery problems | Shipping/Tracking Agent #5 | same | same | same | agent planned; **not built** |
| 7 | Customer messages | feed (Step A, PR #43) | Amazon messages (reply within 24 h) | Etsy messages | TikTok chat | feed built for questions in the dashboard; **outside sources not connected** |
| 8 | Returns and refunds | returns screens (drafts/40) | channel return flow | same | same | dashboard side built; **channel return import not built** |
| 9 | Money arrives | Shopify payouts check (drafts/42) | Amazon settlement report | Etsy deposits | TikTok settlements | Shopify drafted; **others not built** |
| 10 | Fees and real profit | Shopify fees | referral and FBA fees | listing, transaction, payment fees | commission | **not built** (profit per product, per channel) |
| 11 | Sales tax | owner's confirmed rate (drafts/46) | usually collected and paid by the marketplace | same | same | Shopify side built; **marketplace tax to be confirmed with an accountant** |
| 12 | Restock and suppliers | reorder planning, purchase orders, supplier documents | — | — | — | built (some behind switches) |
| 13 | Batch and lot tracing | which batch went to which order | same | same | same | **partly**: packing slip has a blank lot column; full lot-to-order trace **not built** |
| 14 | Reviews | store reviews | Amazon reviews | Etsy reviews | TikTok reviews | **not built** |
| 15 | Agents watch every step | Supervisor Agent #8 watches the others; the feed shows what needs the owner | | | | agents registered with switches; most **off on purpose** until launch |

## Owner decisions (Nov 24) and the order of work

All nine gaps are approved. Order of work for the 2 weeks (each piece small,
tested, behind a switch, and merged by the owner when ready):

| Order | Piece | How it works | Needs the owner |
|---|---|---|---|
| 1 | Scan page (Step B) | camera or screenshot; tracking barcodes matched to orders; "dropped off" | review |
| 2 | **One stock count for all channels** (gap 1) | the dashboard holds the true count; a sale on any channel lowers it; the dashboard sends the new number to every channel, keeping a small safety buffer per channel | database step approval; each channel connection |
| 3 | **All Orders page with channel orders** (gap 2) | orders from Amazon, Etsy and TikTok come **into** the dashboard (not to the website), each with a channel badge and its channel order number, and then follow the same chain (pack, label, tracking). First by dropping in each channel's order download (checked like the product list), then automatically every few minutes once each channel approves access | seller accounts |
| 4 | **Delivery problems, done like a Swiss watch** (gap 7) | every shipment watched: label made but not handed over in 24 h; no movement for 3 days; delivery exception; returned to sender; delivered. Each becomes a feed item with the next step, and a ready message for the customer (approve first) | review |
| 5 | **Money per channel** (gap 4) | each channel's settlement or payout file matched to the bank, like the Shopify check | review |
| 6 | **Real profit** (gap 5) | builds on what exists: Accounting already shows overall profit (sales minus expenses) and receiving already works out each product's true unit cost. Added: cost per product, channel fees and postage, giving profit per order, per product and per channel | review |
| 7 | **Batch tracing** (gap 6) | each batch of lotion gets a number (on the jar label); when an order is packed, the batch is recorded; if there is ever a reaction or an ingredient recall, the dashboard lists exactly who received that batch and holds the remaining jars. Connects to the existing Recalls, Adverse events and Quality checks pages | review |
| 8 | **Reviews in the feed** (gap 8) | new reviews from the store and every marketplace in one place, lowest stars first, with a drafted reply to approve | channel connections |
| 9 | **Agent diary in the feed** (gap 9) | every automatic step an agent takes is written down (which agent, what, when, which order), shown on AI Agents and in the feed when it needs the owner; each agent keeps its on/off switch | review |
| 10 | **Business email in the feed** (gap 3) | `docs/ops/BUSINESS_EMAIL_PLAN.md`; connected when the owner sets up the addresses | addresses and approval |

Also on the critical path for the owner: the database steps waiting in
`docs/ops/sql-review/START_HERE_GUIDED_RUNS.md` (several pieces above use them).

## What is missing (gaps), most important first

1. **One stock count pushed to every channel** (prevents selling the same jar twice).
2. **Orders from Amazon, Etsy and TikTok Shop** into the dashboard. Fastest start:
   each channel's order download (CSV), checked and imported like the product
   list; the automatic connection follows once each channel approves API access.
3. **Outside messages in the feed**: one business email inbox first (most
   marketplaces also send messages there), then each channel directly where allowed.
4. **Money per channel**: settlements and fees from Amazon, Etsy and TikTok matched
   to the bank, like the Shopify check.
5. **Real profit** per product and per channel (ingredients, packaging, fees, postage).
6. **Lot tracing**: record the batch on each order line, so a recall can name every
   customer who received that batch.
7. **Delivery problems** (stuck, returned to sender) raised in the feed.
8. **Reviews** from every channel in the feed.
9. **An agent action log in the feed**: every automatic step visible, with undo
   where possible.

## Needs the owner (not code)

- Whether the public website is built on Shopify (then its orders are Shopify
  orders and nothing extra is needed for it). OWNER DECISION REQUIRED.
- Seller accounts on Amazon, Etsy and TikTok Shop: created by the owner (guided
  step by step; passwords are never shared). Approval can take days, and skincare
  may need documents (ingredient list, safety documents, insurance), so this is
  on the critical path for the 2-week goal. OWNER ACTION.
- One business email address for all the accounts, so one inbox catches the
  messages. OWNER DECISION REQUIRED.
- Each connection's approval when it is ready (keys are added by the owner in the
  service's own settings, never in chat).
