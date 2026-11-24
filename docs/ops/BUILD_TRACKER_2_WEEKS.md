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

## The owner's standing rules for everything we build (Nov 24)

1. **Every agent and every feature can be seen and switched on, off or paused on
   the dashboard** (agents: AI Agents page; features: Feature Flags). Nothing
   needs a typed command. (Switches that save real records get their own owner-only
   section on Feature Flags, with a warning and whether their database step is
   installed: NEXT.)
2. **Everything sits where the owner would look for it**: sorted, organised, on
   the page it belongs to, so nothing has to be searched for.
3. **Everything is the same on every phone and computer, right away** ("I need
   everything to be updated everywhere"): nothing the owner types or decides is kept
   in only one browser. New settings go into the shared settings store (database
   draft 50, #50). Still per browser today, to move next: the feature switches, the
   "recap printed" mark and feed snoozes (review item 10 lists them).
4. **Exact numbers over estimates wherever a platform records them**: real fees
   and real postage per order replace estimates as soon as their source is
   connected; every figure says whether it is exact or an estimate.

## Ready for the owner to merge (in this order)

| PR | What | Tests |
|---|---|---|
| ~~#37~~ | Documents and plans: **MERGED Nov 23 (evening), by the owner** (`096a8c2`) | docs checks |
| #42 | Confirm tax rate screen (+ #38–#41: fonts, readable sidebar, tax dates, product list import) | 3,259 passed on GitHub |
| #43 | **One attention feed** on Home ("Needs you now") | feed 13 + 68 related passed; GitHub green |
| #44 | **Drop-off receipt**: one carrier receipt marks every parcel dropped off; database draft 48 (review item 9) | DB 47/47; screen 13; 267 related passed |
| #45 | **Delivery watch**: stuck, late, problem and returned parcels in the feed with next step and customer message | 5 + 49 related passed |
| #46 | **Agent diary**: every agent step in plain words on AI Agents; hand-offs in the feed (no database change) | 10 + 73 related passed |
| #47 | **Switches for features that save real records** (Feature Flags, owner only): each shows whether its database step is installed; on needs a second tap, off always works | record switches + related passed |
| #48 | **Daily recap**: one tap prints the latest day (with a notes box); a Home reminder stays until it is printed | backups page + related passed |
| #49 | **Real profit** on Accounting: profit per order, product and sales channel after product cost, fees, postage and packaging; orders missing a cost are counted, never guessed (no database change) | profit 16 + related passed (83 passed in the last local run) |
| #50 | **Same numbers on every device**: Real profit estimates saved in the database once draft 50 is installed (review item 10); owner-only changes | DB 40/40; 198 related browser tests passed |

**How to merge (every PR above):** GitHub shows these PRs as opened by the owner's
own account, so **Approve is not offered**. On the PR's **Conversation** tab, at the
bottom: tick "Merge without waiting for requirements to be met (bypass rules)",
choose **Create a merge commit** (not Squash: the PRs build on each other), merge,
confirm. Keep the branches (rollback).

**Draft 48 (in #44) is BLOCKED, DO NOT RUN:** production already has the
Shipping/Tracking agent's `shipments` table. The draft refuses to install over it.
Next: the owner runs the read-only shape check in review item 9; then the draft is
adapted to that table.

## The plan, item by item

| # | Item | Status | Where |
|---|---|---|---|
| A | One attention feed, the main screen | READY (#43) | Home |
| B | Smart scan: drop-off receipts (paste, photo of barcodes, typing) | READY (#44); its database step BLOCKED until adapted to the agent's table | Orders |
| B2 | Smart scan for everything (receipts, expenses, supplier papers, **bottle barcodes for batches**), free reading on the phone first | NEXT | scan page |
| 1 | One stock count for all channels | NEXT (via Shopify as hub if agreed) | Inventory |
| 2 | All Orders with channel badges (Amazon, Etsy, TikTok, website) | NEXT (via Shopify as hub if agreed) | Orders |
| 3 | Business email in the feed | WAITS ON OWNER (addresses) | feed |
| 4 | Money per channel (payouts and fees matched to the bank) | IN PROGRESS: the reader for each channel's own money report is written (Etsy format confirmed from Etsy's help pages; Amazon and TikTok read by column name, to confirm with the first real export); the Accounting screen is next. Gives **exact fees per order** to Real profit | Accounting |
| 5 | Real profit per order, product and channel | READY (#49); fee numbers are starting estimates for the owner to check; real postage per parcel comes with Shopify Shipping | Accounting (top, under the totals) |
| 6 | **Batch tracing**: batch recorded on each order (by scanning the bottle when packing); recall = one button lists every customer who got that batch and holds the rest | NEXT | Inventory, Orders, Recalls |
| 7 | Delivery watch | READY (#45); carrier tracking connects with Shopify | feed |
| 8 | Reviews from every channel in the feed, worst first, reply to approve | NEXT | feed |
| 9 | **Agent diary**: every automatic step written down (which agent, what, when, which order), shown on AI Agents and in the feed when it needs the owner; each agent keeps its on/off switch | READY (#46) | AI Agents, feed |

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

## Progress (rough, planning estimates)

- **The 2-week list** (A, B, B2, 1–9, email and the switches section, 13 pieces):
  **4 built and tested** (A, B, 7, 9), waiting to be merged; **9 to build**.
  About **36% built** (Nov 24, after #47–#49), **0% live** until the owner merges.
- **The whole business** (dashboard, database fixes R1–R10, website, store launch,
  connections): **≈ 39–42%** (`docs/health-endeavors-progress.md`). Most of the rest
  needs owner steps: merges, the database steps, seller accounts, email, website photos.

## Waits on the owner

1. Merge the PRs above (in order).
2. Business address (virtual mailbox) before the seller accounts; then Etsy, TikTok Shop, Amazon.
3. Business email addresses (planned for tomorrow).
4. The database steps in `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md`, then review item 9 (draft 48).
5. A yes or no on Shopify as the hub.
6. Batch barcodes: does the barcode on each bottle carry the **batch** number, or only the product code?
7. **Read-only shape check** of the `shipments` table (review item 9, step 0): one paste in the SQL editor, screenshot.
8. **Database step for shared settings** (review item 10, draft 50), after #50 is merged: then the Real profit numbers are the same on every device.
9. Decide: should the **feature switches** also be shared by every device (for you only, or for staff too)?
10. Packaging cost per box type (to replace the single packaging estimate).
