# Email, tracking and Shopify: what is ready on made-up data, and what is off

Status: CURRENT · written 2026-11-27 (night). **Every live send is off.** No email, text or message
reaches a real person from the dashboard or its drafts; tests fail if a send path appears
(`no-live-send`, `hard-walls`). Real sending, the business email inbox and each outside connection are
separate owner decisions (decision D1: approve first).

## Email (store campaigns, customer emails; drafts/56 records only)

| Safety rule | Proven by | State |
|---|---|---|
| The owner or an administrator approves the **exact** subject and text; staff, switched-off accounts and visitors cannot | `email_sending_test.sh` §2, §10b | draft not installed |
| An approved wording never changes; any edit is a new wording that needs approval again | §3; `customer-emails-ext24` ("still approved" is false after an edit) | dashboard merged, behind a switch, off |
| Who an email is for is fixed when queued; a person can only skip it | §7 | draft |
| No store written to again within 90 days; the slow start week by week | §5, §11 | draft |
| The do-not-email list wins over everything (an "unsubscribe" reply goes on it) | §6, §8 | draft; adding an address is done by a person today |
| Health or medical claims refused in the subject and the text | §2 | draft |
| Bounces and spam complaints stop the campaign by itself; what was queued is skipped | §8, §9 | draft |
| One shipping email per order | #108 (`staging-rehearsal-ext25`) | merged, sends nothing |
| **Stop when the person replies** | **not built**: replies are not read; the business email inbox is not set up (`BUSINESS_EMAIL_PLAN.md`) | waits on the inbox and an owner decision |
| Sending itself | **not built and off**: the sending program and provider are a separate decision | owner decision |

## Tracking (parcels and delivery problems; drafts/48)

| Rule | Proven by | State |
|---|---|---|
| One parcel per tracking number per order; a drop-off receipt marks each parcel once | `order_parcels_test.sh` (drafts/48) | draft not installed |
| Stuck, late or returned parcels raised in the feed, never sent to a customer by themselves | `delivery-watch-ext24` | merged, switch off |
| The carrier's live status | **not connected** (the Shipping/Tracking agent's earlier version is REPORTED live, not re-verified) | owner decision |

## Shopify (orders, payouts)

| Rule | Proven by | State |
|---|---|---|
| Payout differences recorded once each (`issue_key` unique; a repeat changes nothing) | drafts/42 (`on conflict do nothing`); `money-issues-storage-ext22`; the daily program `edge-drafts/shopify-payouts-sync/` against made-up Shopify replies: `shopify_sync_core_test.mjs`, 17 of 17 (read-only queries, pages, the rate-limit pause, running twice changes nothing, a wrong key or Shopify error writes nothing). It existed but no suite ran it; since Nov 27 the database suite does, and it fails when the program's amount check is removed | drafts not installed; the daily program not deployed |
| A Shopify order lowers stock once, ignores an older message, and a replay changes nothing | **the stock part drafted Nov 28** (drafts/76: once per order line, a replay changes nothing); the Shopify trigger itself is not built (R9) | waits on R8, R1–R4 |
| Today's order import | runs in the private backups repository (off-limits to Claude): **UNKNOWN** here | — |
| Each Shopify order and each of its lines written once (two runs at once, a replay or a Shopify edit change nothing twice); a line whose stock was taken is never rewritten; a dashboard-deleted order never returns; no customer details; obeys the Shopify Order Sync switch, so Emergency stops it | **R9 path B, prepared Nov 28**: drafts/78 and `edge-drafts/shopify-orders-sync/` against made-up Shopify replies, `shopify_orders_test.mjs`, 52 of 52 | draft not installed, program not deployed; used only if the owner chooses path B (review item 24) |

Nothing in this page is switched on; each line says what it waits for.
