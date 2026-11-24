# Attention feed and smart scan — plan (owner request, Nov 23, 2026)

Status: **IN PROGRESS**. Step A (one feed) is built behind `he_attention_feed`, off, in PR #43 (not merged). The whole chain across channels: `docs/ops/OPERATIONS_CHAIN_ALL_CHANNELS.md`. Detail and
history stay in `docs/PROJECT_RECORD.md`; this file is the one place for this plan.

## What the owner asked for

1. **"Needs your attention" becomes the main screen and "brain"**: every message,
   update and decision in one chat-like feed, newest first, where the owner can
   read and reply (or approve, mark done, snooze) without leaving the page.
2. **Smart scan page**: open the camera, add a screenshot, or type. The dashboard
   recognises what it is and files it:
   - carrier drop-off receipts (for example 100 parcels at UPS): read the tracking
     numbers, match each to its order, mark it dropped off, keep the tracking, and
     prepare the customer update;
   - expense receipts and screenshots: store, date, amount, category, photo kept;
   - supplier invoices and packing slips: attached to the right purchase order;
   - unsure: one-tap question ("expense or delivery?").

## Owner decisions

| # | Decision | Status |
|---|---|---|
| D1 | Customer updates: **the owner approves first; automatic later**, once trusted | **DECIDED** (Nov 23) |
| D2 | Message sources: Shopify first; later Amazon, Etsy, TikTok Shop (accounts to be created by the owner, with guidance), supplier and important emails | DECIDED (list); each connection needs its own approval |
| D3 | Shipping labels: the owner bought 4×6 label paper online (fine for the Rollo if it is direct thermal, 4×6, perforated). Where the postage is bought is separate and still open: buying it in Shopify (Shopify Shipping) puts every tracking number in Shopify automatically and Shopify can send the customer its own shipping email; buying at the counter needs the scan page | **DECIDED** (Nov 23): **Shopify Shipping** (included in the plan, usually cheapest); marketplace orders use each marketplace's own labels |
| D4 | Reading receipts and screenshots: **free first** (text reading that runs on the phone or computer itself, open-source, nothing leaves the device; barcodes read for free). A paid AI service (about $1–5 a month) is used only if the free reading proves not good enough on the owner's real receipts; its key would be stored by the owner in Supabase, never in chat or this repository | **DECIDED** (Nov 23): free first, paid service only if needed |

## Where messages can come from (for the feed)

- Sales channels: Shopify (order notes, contact form, Shopify Inbox chat), Amazon
  buyer messages (Amazon expects a reply within 24 hours), Etsy messages, TikTok
  Shop chat. Some marketplaces do not let outside apps read or answer messages;
  those arrive through their notification emails, so **one business email inbox
  connected to the dashboard catches most of them**.
- Money: payouts, chargebacks and disputes (these have deadlines), refund requests.
- Shipping: delivery exceptions, returned to sender, "where is my order".
- Reviews: store, marketplace and Google reviews.
- Social: Instagram, Facebook and TikTok messages and comments.
- Suppliers: invoices, shipping notices, price changes.
- Business: marketplace account-health or policy warnings, sales tax filing
  reminders, renewals (domain, email, insurance), bank notices.
- Inside the dashboard already: low stock, money that does not match, returns to
  inspect, tax rate re-checks, supplier documents, tasks.

## Steps and rough times

| Step | What | Approx. | Needs the owner |
|---|---|---|---|
| A | One feed of everything inside the dashboard, cards to act in place, priority (urgent / today / info), "All caught up" | 3–4 days | no (behind a switch, off) |
| B | Scan page: camera and screenshot; tracking-number barcodes read on the phone (free, no AI); match to orders; mark dropped off; customer updates prepared for approval (D1) | 4–5 days | review only |
| C | AI reading and sorting of receipts, screenshots, invoices | 1–2 weeks | D4; storage approval |
| D | Outside messages into the feed, one source at a time (Shopify first, then the business inbox, then marketplaces); approved customer updates sent; later automatic | 1–2 weeks | each connection; D1 |

First really useful version (A + B): about 1.5–2 weeks. All of it: about 4–6 weeks.

## Rules that stay in force

- No real customer message is sent without the owner's approval (D1), and none
  from tests: every test uses made-up data and a mocked network.
- No keys or passwords in chat or in this repository; the owner adds them in the
  service's own settings.
- Everything new ships behind a switch, off, and goes live only when the owner merges.
