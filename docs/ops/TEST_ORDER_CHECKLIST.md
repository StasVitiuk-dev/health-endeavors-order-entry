# The test order: what to check, step by step

Status: **PROPOSED** · written 2026-11-27 for launch-plan day 11 (`LAUNCH_PLAN_2_WEEKS.md`). It is
the procedure behind the Launch page line **"One real test order went all the way through"**
(`assets/views/he-launch.js`, key `rehearsal`). Related: `LAUNCH_DAY_ROLLBACK_PRACTICE.md` (going
back), `PRINTING_GUIDE.md` (printers), `INTEGRATION_READINESS.md` (what is connected).

**Honest starting point (Nov 27):** two of the five promises on that Launch page line do not happen
by themselves yet, so a test order today would show them as not ready. That is a correct result,
not a failure of the test:

| Promise | Today | What makes it true |
|---|---|---|
| The order arrives in the dashboard | **UNKNOWN here**: today's order import runs in the private backups repository, which Claude does not open | Query C section 4 shows whether it has ever run; R9 (Shopify order sync) |
| The packing slip and the label print | Slip built (`he_order_slips`, off; printer test pages); the label comes from Shopify | The printers on hand, the switch on |
| Stock goes down by exactly the amount sold | **Built Nov 28, not installed:** drafts/76 (an order takes its stock exactly once, all or nothing) and Orders → **Stock per order** (switch off) to press it per order | drafts/76 installed, the switch on, then press **Take these bottles off stock** on the test order (automatic for Shopify later: R9, with R1–R5 installed) |
| The money is right (total, Shopify's fee, the payout) | Built as drafts: drafts/42 and the daily payout program (17 of 17 on made-up Shopify replies) | Drafts 42 installed, the payout program deployed |
| The customer is told | Shopify's own order and shipping emails; the dashboard sends nothing (R10) | Nothing to build for launch while Shopify sends them |

## Before you start (all must be true)

- [ ] The products are in, with prices (Launch page: "Your products are in").
- [ ] Stock is counted for the product you will order.
- [ ] Both printers printed their test page.
- [ ] Shopify order sync is switched on (Feature Flags), **only** once R9 exists.
- [ ] You know the order number you will use (write it down; never a real customer's details).

## Part 1 — a fake-card order (about 30 minutes)

Shopify has a test mode for payments. **The exact clicks are in Shopify's own help pages**: Claude
cannot open Shopify or its help pages from here, and Shopify stays off-limits unless you approve that
specific task. Confirm the steps there.

Then, in the dashboard, one check at a time. Write the time next to each.

| # | Check | Where | Pass when |
|---|---|---|---|
| 1 | The order arrived | Orders | It shows within the time the import promises, **once** (refresh twice: still once) |
| 2 | The amounts match Shopify | Orders → the order | Items, quantities, total and tax equal Shopify's order page |
| 3 | The packing slip prints | Orders → Packing slips (switch `he_order_slips` on) | One page on the Brother (or 4×6 on the Rollo), the right items |
| 4 | The shipping label prints | Shopify's own label, on the Rollo (4 × 6, margins None, scale 100%) | Readable barcode; nothing cut off |
| 5 | Stock went down by exactly the quantity | Orders → **Stock per order** (Nov 28; drafts/76 installed, switch on): find the order → **Take these bottles off stock** (press twice), then Inventory | The message says each line was taken; Available = before − quantity; **never twice** (press Take again: "Nothing changed"; refresh, wait a minute, refresh) |
| 6 | Nothing unexpected asks for attention | Home / Needs Your Attention | No new warning, or one you understand |
| 7 | The next morning: the order is in the daily recap | Report History | One order, the right total |

A fake-card order has no real payout, so the money side (check 8) waits for Part 2.

## Part 2 — one real small order, then refund it (about 20 minutes)

Same checks 1–7, then:

| # | Check | Where | Pass when |
|---|---|---|---|
| 8 | Shopify's fee and the payout | Accounting (once drafts/42 is installed) | The payout equals the order minus the fee; no open difference |
| 9 | The refund | Shopify, then Returns / Accounting | The refund shows once; the money matches |
| 10 | Stock after the refund | Inventory | Back only through a return you approved (inspection first: sellable, damaged or opened; drafts/40). **Never by itself** |

## When something does not match

1. **Stop.** Don't fix it by hand.
2. Take a screenshot of the check that failed and send it to Claude, with the order number (no
   customer details).
3. If orders keep arriving wrong: Feature Flags → System mode → **Emergency** (turns Shopify order
   sync off; `LAUNCH_DAY_ROLLBACK_PRACTICE.md`).

## When every check passed

Launch page → "One real test order went all the way through" → mark it done. Write the order number
and the date in the chat, so the record shows when it passed.
