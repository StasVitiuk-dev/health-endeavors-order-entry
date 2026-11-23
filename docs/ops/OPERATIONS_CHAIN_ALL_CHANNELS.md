# Operations chain across every sales channel — map and gaps (Nov 23, 2026)

Status: **PROPOSED** (owner request, Nov 23: "everything connected — website,
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
