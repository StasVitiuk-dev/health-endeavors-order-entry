# When you're back: checklist (printers, agents, payments)

Status: CURRENT · written Nov 23, updated Nov 23 evening (PR #36 merged and live) · for Stas. One step at a time; I explain each one before you
click. Nothing here goes live until you approve it.

## 1. Have ready (only what you have)

- [ ] The two printers set up on Wi-Fi (Brother MFC-J1365DW, Rollo label printer).
      **Owner update, Nov 23:** the Brother (paper) arrives in a few days; the Rollo (labels) will be
      bought around Black Friday. Test each one when it arrives (section 2); they don't need to be together.
- [ ] A few 4 × 6 labels and plain US Letter paper.
- [ ] A ruler (to measure the 1-inch square on the test pages).
- [ ] The payment details you mentioned (how customers pay): **never send passwords, keys or
      card numbers** — only the names of the services (for example "Shopify Payments").
- [ ] Your 90-item checklist, or just the item names (no private details), to compare.
- [ ] Answers to tax questions 4, 5, 6 and 10 if you have them (`docs/ops/TAX_SETUP_QUESTIONS_2026-11-16.md`).
- [x] Your pick of the look: **Aurora for everyone** (decided Nov 23).

## 2. Printers (about 30 minutes)

1. In the live dashboard (merged Nov 23), Feature Flags → turn on **Packing slips** (only in your
   browser; turn it off again afterwards if you like).
2. Orders page → **Test page: Rollo 4×6** → print → measure the square (1 inch) and check the
   frame shows on all four sides. Same with **Test page: Brother Letter**.
3. Print a **4×6 slip** and a **Letter slip** for one example order.
4. Send me a photo of each (blur anything real). I adjust sizes if anything is off.

## 3. Agents (about 1–2 hours together)

| # | Agent | Recorded state | What we decide |
|---|---|---|---|
| 1 | Invoice | runs inside the database when its switch is on; state not visible to the dashboard | check its switch (read-only) |
| 2 | Order Intake | off until the store has products | when to turn on |
| 3 | Order Monitoring | off until products | when to turn on |
| 4 | Retail/Wholesale | on, hourly | keep |
| 5 | Shipping/Tracking | on, hourly | keep |
| 6 | Customer Notification | on, dry-run only (no email service) | which email service, if any |
| 7 | Customer Service (the only one using paid AI) | off until products | when to turn on; spend cap |
| 8 | Supervisor | off until products | when to turn on |
| 9 | Accounting | live in the dashboard | keep |
| 10 | Tax Records | live in the dashboard | keep |

Plus: which agents from your 90-item list are still missing; I list them and build them, off by
default, with tests.

## 4. Payments (after you send the details)

**Claude's recommendation (PROPOSED, Nov 23; prices change, check before signing up):** keep
everything in Shopify. Shopify Basic about $39/month (about $29 paid yearly); card payments through
Shopify Payments 2.9% + 30¢ per online order (using another card processor adds a 2% Shopify fee);
wholesale buyers pay by bank transfer or check (free), or by card through a Shopify invoice (same
card fee). No Square or PayPal unless customers ask. Example: $1,000 a month in 25 orders ≈ $37
card fees + $39 plan ≈ $76/month. Waiting for the owner's "ok" or changes.

**Owner fact (Nov 23):** the owner already pays for the Shopify Basic plan, $39/month billed
monthly, for about 4 months. It was not recorded anywhere before; now it is. So the only new cost
of the recommendation is the card fee per order. Open: is Shopify Payments turned on (Shopify admin
→ Settings → Payments)? Possible saving: yearly billing (about $29/month, about $120 a year less).

**Business phone line (PROPOSED, Nov 23):** a separate business number in an iPhone app; Claude's
pick is Quo (formerly OpenPhone, about $15–19/month); cheaper options Grasshopper (about $14–25),
Line2 (about $8); Google Voice needs a paid Google Workspace. Get the number before printouts and the
website go out, so the printout contact line (an open owner decision) can carry it.

Connect the money-matching check to how customers really pay (Shopify Payments payouts,
wholesale payments), and finish the payment screen. The bank stays a monthly file you download;
no outside bank-connection service.

## 5. Approvals waiting (each one separately, when you are ready)

- ~~The push of the working branch~~ done Nov 23 → **PR #36: merge it** when its final test run is
  green (guided). It contains every older open PR (#5–#35); close those afterwards.
- SQL review items 1–7 (each about 15 minutes, guided, with a check before and after). **Start
  here:** `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md` (recommended order; step 1 only reads).
- Palette changes C1–C7 (the look itself is decided: Aurora).
- The Shopify read-only payout app (review item 6).
