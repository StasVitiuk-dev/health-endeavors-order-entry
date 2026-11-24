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
| ~~#42~~ **MERGED Nov 23, live check passed** | Confirm tax rate screen (+ #38–#41: fonts, readable sidebar, tax dates, product list import) | 3,259 passed on GitHub |
| ~~#43~~ **MERGED Nov 23, live check passed** | **One attention feed** on Home ("Needs you now") | feed 13 + 68 related passed; GitHub green |
| ~~#44~~ **MERGED Nov 23, live check passed** | **Drop-off receipt**: one carrier receipt marks every parcel dropped off; database draft 48 (review item 9) | DB 47/47; screen 13; 267 related passed |
| ~~#45~~ **MERGED Nov 23, live check passed** | **Delivery watch**: stuck, late, problem and returned parcels in the feed with next step and customer message | 5 + 49 related passed |
| #46 | **Agent diary**: every agent step in plain words on AI Agents; hand-offs in the feed (no database change) | 10 + 73 related passed |
| #47 | **Switches for features that save real records** (Feature Flags, owner only): each shows whether its database step is installed; on needs a second tap, off always works | record switches + related passed |
| #48 | **Daily recap**: one tap prints the latest day (with a notes box); a Home reminder stays until it is printed | backups page + related passed |
| #49 | **Real profit** on Accounting: profit per order, product and sales channel after product cost, fees, postage and packaging; orders missing a cost are counted, never guessed (no database change) | profit 16 + related passed (83 passed in the last local run) |
| #50 | **Same numbers on every device**: Real profit estimates saved in the database once draft 50 is installed (review item 10); owner-only changes | DB 40/40; 198 related browser tests passed |
| #52 | **Money per channel** on Accounting: choose the money report of Etsy, Amazon or TikTok Shop; real sales, refunds, fees, postage and payouts, the real fee rate next to the estimate, payouts checked against the bank (Etsy layout confirmed; Amazon and TikTok wait for a first real export) | channel money + related passed |
| #53 | **Feature switches shared by every device**, with an audience (work features: everyone; money, revenue, sensitive documents: owner and administrators). Audience table approved by the owner Nov 23. Needs draft 50 installed | shared switches + related passed |
| #54 | **Real fee and postage per order** (draft 52, review item 11): Real profit uses the real numbers where saved, estimates elsewhere, and says which | DB 35/35; related browser tests passed |
| ~~#55~~ **MERGED Nov 23 (evening, owner's time)** | **Incidents: record what was done and close** (owner and administrators; switch `he_incident_close`; no database step). Also two fixes from the owner's screenshots of Nov 24 in a narrow computer window (about 790 wide): the slide-over menu was see-through, and tables scrolled sideways. Contains #46–#54 | 157 + 131 + 77 related passed |
| #56 | **Drop-off database step (draft 48) adapted to production**: its own tables (`order_parcels`), the Shipping agent's `shipments` table only read and never changed; review item 9 no longer blocked. Contains #46–#55 | DB 64/64, whole DB suite 0 failed; 284 related browser tests passed |
| #57 | **Batch stickers** on Inventory: the batch in words and as a barcode (Code 128), for a small label roll (2.25 × 1.25 in) or a 4 × 6 label cut into 8 strips; preview switch `he_batch_labels`; reads only. Contains #46–#56 | 178 related passed, 54 skipped; barcode identical to an established library on 304 texts |
| #58 | **Batch on each order** (draft 54, review item 12; switch `he_order_batches`): scan the batch sticker onto the order when packing, void a wrong scan with a reason, and "Who got a batch". Also lists the incident save in the write-path list (the one red check on #55) and steadies the request-baseline test. Contains #56–#57 | DB 48/48, whole DB suite 0 failed; 171 related passed |
| #59 | **Sales channel on every order** (Orders): a "Sold on" badge per order and buttons to see one channel with its count; preview switch `he_order_channels`; reads only. Contains #56–#58 | 183 related passed; one unrelated test race fixed and re-run twice clean |
| #60 | **The "recap printed" note on every device** (needs shared settings, draft 50): printing the daily recap clears the Home reminder on every phone and computer. Contains #56–#59 | 161 related passed, 36 skipped |
| #61 (first commit) | **Batch sticker from a phone photo** on the batch screen: each sticker in the photo is one bottle on the open order; other barcodes are ignored | 171 related passed |
| #61 | **A shorter menu**: same-topic pages inside one another, three variations, chooser under Feature Flags → Menu; since Nov 24 everyone starts with variation 1 (16 lines); choice shared with every device once draft 50 is in use. Contains #56–#60 | 28 new tests passed, 6 skipped; 480 related passed, 124 skipped |
| #62 | **Packaging cost per box type** on Real profit: up to four boxes (name, bottles that fit, cost); each order gets the smallest box that holds it; shown as an estimate; no boxes = the one amount as before; no database change. Contains #56–#61 | 352 related passed, 59 skipped |
| #63 | **Day pack** on Backups & Printouts: choose a day, print its orders with items, its clients once each, exact totals and the saved recap; reads only, on demand. Contains #56–#62 | 373 related passed, 49 skipped |
| #64 | **Agents at a glance** on AI Agent Activity: counts (working, paused, off on purpose, need a look), one line per agent with state and last run, a jump to its switch; read-only, no switch. Contains #56–#63 | 204 + 119 related passed |
| #65 | **Store Campaigns** page (switch `he_store_campaigns`, owner and administrators): write one email, wording checked by the claim firewall, approve the wording once, paste stores or use example stores, choose how many and nearest or best first, see who would get it on which day; slow start and stop rule; **nothing is sent**; kept in the browser for now. Contains #56–#64 | 224 + 77 related passed |
| #66 | **Client list to print** on Backups & Printouts (from orders: each client once, counted orders, exact total, first and last order; periods 30/90/365 days or all); the sending guard listed with the approved agents. Contains #56–#65 | 141 related passed after one real fix found by the safety probe |
| #67 | **Fill an expense in from a receipt's text** on Expenses (switch `he_receipt_reader`): paste the text or let the browser read the photo where it can; total, date and shop filled in for checking; never saves by itself; a guess is labelled, a date is never guessed. Contains #56–#66 | 178 related passed after one real fix (a made-up month name was read as a month) |
| #68 | **Morning summary to copy** on the attention feed: the day, how many things need the owner, the most urgent by name, how many more; copied with one press; nothing sent. Contains #56–#67 | 180 related passed, 30 skipped |
| #69 | **Agents overview finished**: requests waiting for the owner's approval (kept in step with the menu's count) with a button to the Approval Queue, and a way to the Agent diary. Contains #56–#68. Full GitHub run on #61 (shorter menu, after the test fix): green | 238 related passed after one real fix (a stale count) |
| #70 | **Content Helper** (page under Sales, switch off): a product name and the owner's own story in; three ready drafts at a time for a post, an ad headline, an ad text and an email paragraph, with "Show me others" (up to 18 per kind and tone, no repeats), a short video (what to say, what to film; three versions), a week's plan, three tones, the owner's own version checked live, six ready looks for a text card. Fixed wording around the owner's story, NOT an AI model, so no fact is invented. Every draft passes the health-claim check; a blocked draft cannot be copied. Nothing posted, sent, spent or written. Contains #56–#69 | 13 new passed; 344 pre-push passed, 62 switch/menu passed. The claim check caught one of the ready phrases ("Treat yourself"), replaced |
| #71 | **Customer Emails** (page under Sales, switch off; owner and administrators): four kinds (welcome after a first order, time to reorder, something new, we miss you), each with three ready texts; the wording is checked for health claims and approved once per kind; "Show who would get it" reads the orders and lists exactly who fits (with those left out and why: no email, cancelled only, same address twice, asked not to be emailed), on which days (the slow-start plan) and what the first customer would read (with the stop-these-emails line and the postal address). NOTHING IS SENT. Only the wording is kept in the browser; the customer list is kept nowhere. Contains #56–#70 | see the PR |

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
| B | Smart scan: drop-off receipts (paste, photo of barcodes, typing) | READY (#44, live); its database step is adapted and READY FOR REVIEW (#56, review item 9) | Orders |
| B2 | Smart scan for everything (receipts, expenses, supplier papers, **bottle barcodes for batches**), free reading on the phone first | NEXT | scan page |
| 1 | One stock count for all channels | NEXT (via Shopify as hub if agreed) | Inventory |
| 2 | All Orders with channel badges (Amazon, Etsy, TikTok, website) | NEXT (via Shopify as hub if agreed) | Orders |
| 3 | Business email in the feed | WAITS ON OWNER (addresses) | feed |
| 4 | Money per channel (payouts and fees matched to the bank) | IN PROGRESS: the reader for each channel's own money report is written (Etsy format confirmed from Etsy's help pages; Amazon and TikTok read by column name, to confirm with the first real export); the Accounting screen is next. Gives **exact fees per order** to Real profit | Accounting |
| 5 | Real profit per order, product and channel | READY (#49); fee numbers are starting estimates for the owner to check; real postage per parcel comes with Shopify Shipping | Accounting (top, under the totals) |
| 6 | **Batch tracing**: batch recorded on each order (by scanning the bottle's batch sticker when packing); recall = one button lists every customer who got that batch and holds the rest | IN PROGRESS: stickers built (#57, not yet printed on the real printer). NEXT: read the sticker when packing and save the batch on the order (small database step), then the recall list | Inventory, Orders, Recalls |
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
- DECIDED Nov 24: **Shopify is the hub** for Amazon, Etsy and TikTok. The owner agreed
  after asking for an opinion: selling out fast (even on one channel) is welcome; selling
  more than is in stock is not, and the shared stock count must prevent it. Costs and
  fees, with sources: `docs/ops/CHANNEL_COSTS_2026-11-24.md`. OPEN: how Etsy connects
  (Shopify's own connector appears closed to new Etsy shops).
- Nov 24, bottle photo from the owner: the barcode on a bottle is a normal 12-digit
  **product** barcode. It does **not** carry the batch, and no batch number is printed
  on the label side shown. PROPOSED for batch tracing: the dashboard prints small
  batch stickers (Rollo) when a batch is made, and that sticker is scanned when
  packing; or the batch is picked on screen. A second photo (the bottom of the
  bottle) shows only the recycling mark: **no batch number anywhere on the bottle**.
  DECIDED Nov 24 (owner: "we will have to print it on label like you said"): batch
  stickers printed by the dashboard.
- Nov 23: the owner approved the audience split for shared switches ("looks good").
- Nov 23: the owner confirmed the open incident about the emergency account was
  their own sign-in during setup; it will be closed with a note once #55 is live.

## Progress (rough, planning estimates)

- **The 2-week list** (A, B, B2, 1–9, email and the switches section, 13 pieces):
  **4 built and tested** (A, B, 7, 9), waiting to be merged; **9 to build**.
  About **36% built** (Nov 24, after #47–#49); Real profit (5) and Money per channel (4)
  are now built too (#49–#54). Merged and live so far: #37, #42–#45 (feed, smart scan,
  delivery watch). Whole list roughly **55–58% built, 25% merged, 0% in daily use**.
- **The whole business** (dashboard, database fixes R1–R10, website, store launch,
  connections): **≈ 39–42%** (`docs/health-endeavors-progress.md`). Most of the rest
  needs owner steps: merges, the database steps, seller accounts, email, website photos.

Nov 23 (evening): the owner began opening the **Etsy** shop and found Etsy's one-time $29 set-up fee
(`docs/ops/CHANNEL_COSTS_2026-11-24.md` corrected). Still to move off one browser: the feed's "Later"
snoozes (per person; needs a per-person settings step, not the owner-wide shared settings).

Nov 23 (evening), owner request: **regroup the whole dashboard** so things of the same kind sit together
and there are far fewer pages; three variations asked for. PROPOSED with a picture: A "follow the work"
(6 pages with tabs, recommended), B "fewest pages" (4 + settings), C "tidy what is there" (about 16 pages).
`docs/ops/MENU_REORGANISATION_OPTIONS_2026-11-24.md`. That first proposal is DEPRECATED: on Nov 24 the owner
said "I like how it is right now, I just want less of them: put some inside each other if it is the same
topic". BUILT (PR #61): the same menu, look and page names, with same-topic pages inside one another as a
row of buttons at the top of the page; three variations (16, 10 or 6 lines instead of 30) chosen under
Feature Flags → Menu. DECIDED Nov 24 ("let's go with A option"): variation 1, "A little shorter" (16 lines),
is the menu everyone starts with; "Today's menu" and the other two stay one click away. Nothing is deleted.

Nov 24, owner requests added to the list (phone line, agents writing to stores and customers, marketing
agents, one place to see and stop agents, smart camera for receipts, day-pack and automatic printing):
checked against what exists and planned in `docs/ops/OWNER_REQUESTS_2026-11-24_AGENTS_PHONE_PRINTING.md`.
The owner answered the same day (section 3 there): no texting at the start, email only; approve the text of a campaign once, not each send; customer email agents as well as store agents; printing and the control room approved; low stock → purchase order draft NOT wanted for now. Nothing sends a real message.

## Waits on the owner

Decided Nov 23 (evening): **feature switches are shared by every device**; work features are for every employee; money, revenue and sensitive documents are for the owner and administrators only. NEXT: switches with an audience, stored in shared settings (draft 50).

1. Merge **one** PR: the highest green one contains all earlier ones (#55 merged Nov 23 evening, which also brought in #46–#54; live check by the owner passed the same evening: Feature Flags rows fit a narrow window, and INC-20260917-0001 was closed with a note through the new button. the newest green one of #69–#71 contains the rest).
2. Business address (virtual mailbox) before the seller accounts; then Etsy, TikTok Shop, Amazon.
3. Business email addresses (planned for tomorrow).
4. The database steps in `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md`, then review item 9 (draft 48).
5. ~~Shopify as the hub~~ DECIDED Nov 24: yes.
6. ~~Batch barcodes~~ ANSWERED Nov 24: product code only, nothing on the bottom; batch stickers decided.
7. ~~Read-only shape check of `shipments` and `incidents`~~ DONE Nov 23 (`docs/ops/shapes/PRODUCTION_SHAPES_2026-11-23.md`, on #54). Draft 48 adapted Nov 24 (#56): the agent's table is only read.
8. **Database step for shared settings** (review item 10, draft 50), after #50 is merged: then the Real profit numbers are the same on every device.
9. ~~Feature switches shared?~~ DECIDED Nov 23 (yes, with audiences; #53).
11. ~~Read-only Query I~~ RUN Nov 23 (evening, owner's time): 45 saved daily reports, every one with 0 orders, and 0 orders in the table for those days. Verdict **NOT ENOUGH DATA**: nothing is wrong, but with no orders yet the report's day cutoff cannot be told. Run it again after the first week with real orders (at least one placed in the evening).
12. ~~Try One attention feed~~ DONE: the owner turned it on and sent pictures on Nov 23; no change was asked for. Not to be asked again.
10. Packaging cost per box type: BUILT (#62). Waits on the owner only for the real box names, sizes and costs, typed on the Real profit estimates form after merging.
