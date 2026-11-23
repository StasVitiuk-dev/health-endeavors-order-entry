# When you're back: checklist (printers, agents, payments)

Status: CURRENT · written Nov 23 · for Stas. One step at a time; I explain each one before you
click. Nothing here goes live until you approve it.

## 1. Have ready (only what you have)

- [ ] The two printers set up on Wi-Fi (Brother MFC-J1365DW, Rollo label printer).
- [ ] A few 4 × 6 labels and plain US Letter paper.
- [ ] A ruler (to measure the 1-inch square on the test pages).
- [ ] The payment details you mentioned (how customers pay): **never send passwords, keys or
      card numbers** — only the names of the services (for example "Shopify Payments").
- [ ] Your 90-item checklist, or just the item names (no private details), to compare.
- [ ] Answers to tax questions 4, 5, 6 and 10 if you have them (`docs/ops/TAX_SETUP_QUESTIONS_2026-11-16.md`).
- [ ] Your pick of the look: Aurora, Graphite, Original+ (comparison page link in the chat).

## 2. Printers (about 30 minutes)

1. In the preview, Feature Flags → turn on **Packing slips**.
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

Connect the money-matching check to how customers really pay (Shopify Payments payouts,
wholesale payments), and finish the payment screen. The bank stays a monthly file you download;
no outside bank-connection service.

## 5. Approvals waiting (each one separately, when you are ready)

- The push of the working branch (then a pull request you review and merge).
- SQL review items 1–7 (each about 15 minutes, guided, with a check before and after).
- Palette changes C1–C7 and the look choice.
- The Shopify read-only payout app (review item 6).
