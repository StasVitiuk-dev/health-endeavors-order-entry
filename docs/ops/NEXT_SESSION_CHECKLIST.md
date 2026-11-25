# When you're back: checklist (printers, agents, payments)

Status: CURRENT · written Nov 23, updated Nov 24 (section 0 added) · for Stas. One step at a time; I explain each one before you
click. Nothing here goes live until you approve it.

## 0. Added Nov 24 (CURRENT): do these first

The full list of what waits on you, in order, is in `docs/health-endeavors-current-state.md`, section 8.
In short:

- [x] Merge PR #85 (it contained #56–#84): done by the owner on Nov 24, about 6:03 PM Central, merge commit `1f86df0`.
- [x] Live check after that merge: done by the owner on Nov 24 at about 6:10 PM Central (screenshots): the shorter menu (16 lines) is live, same-topic pages sit inside one another, and the owner-only section "features that save real records" lists the new switches, all Off and "Not installed yet" (drafts 48, 56, 58, 60 seen).
- [x] Merge PR #51 (documents): done by the owner on Nov 24, about 6:33 PM Central, merge commit `6648336`.
- [x] PR #86 (administrators see the switches that save real records): merged by the owner on Nov 24, about 7:03 PM Central.
- [ ] **Owner's answers on "what to add before launch" (Nov 24, about 7:07 PM Central):**
  - Dress rehearsal with one real test order: WANTED. Remind the owner when the printers arrive.
  - A "Ready to launch" page (green or red per item): WANTED. To build.
  - Backups "at the best level, also against a virus or a break-in": WANTED. Backup health is still
    UNKNOWN here (`docs/ops/RECOVERY_AND_BACKUP_READINESS.md`); the first step is the owner's
    read-only look (nightly backup: green or red and its date; restore test: green or red and its
    date; Actions minutes; the database provider's own Backups page). Then: a third copy outside
    both the code host and the database provider that cannot be overwritten, a notice on Home when
    the newest backup is too old, and one restore drill.
  - Two-step sign-in on the dashboard: NOT NOW (no employees yet). Claude recommended it separately
    for the sign-ins behind the dashboard (code host, database provider); not answered yet.
  - A professional's check of the cosmetics rules: NOT NOW.
  - Proposed additions, ANSWERED Nov 24 (about 7:13 PM Central): WANTED are the
    **unanswered-customer watch** ("customer is priority, so I always need to be able to see their
    messages") and the **weekly owner report**. NOT for now: batch expiry watch, recall drill,
    first-day checklist ("only those that I tell you for now").
    CORRECTION by Claude, found in the code the same evening: the one-day rule for customer
    questions already exists and is live (a question waiting a day or more is urgent on Home and
    says "Waiting more than a day."). What is missing for "always see their messages": a customer
    message can still be set aside with "Later", and it is not placed above other items of the same
    level. To build: customer messages are never set aside and come first.
- [ ] Live check of #86 with the administrator account: Admin → Feature Flags shows "Features that save real records (owner and administrators)", every line Off.
- [ ] Read-only check of how accounts are set up (SQL in `docs/ops/OWNER_DECISION_2026-11-24_ADMINISTRATOR_NEAR_OWNER.md`), then the People page.
- [x] Owner answered Nov 24: add a fourth role, Manager. The page is called "New Employee"; the new person types their own password on the owner's computer.
- [ ] Owner decision of Nov 24 (evening): administrators get almost everything the owner has. Plan and open points: `docs/ops/OWNER_DECISION_2026-11-24_ADMINISTRATOR_NEAR_OWNER.md`.
- [ ] One stock count: your decision, after the read-only shape check
      (`docs/ops/ONE_STOCK_COUNT_DECISION_2026-11-24.md`).
- [ ] Business email and which email service (`docs/ops/BUSINESS_EMAIL_PLAN.md`; the comparison arrives with PR #78).
- [ ] Database draft 50 in a guided sitting (it makes switches and drafts the same on every device).
- [ ] The 8:00 AM printing set-up on your Mac (`docs/ops/AUTO_PRINT_MAC_SETUP_2026-11-24.md`).

The sections below are from Nov 23 and still apply.

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

**Passing the card fee to customers (owner question, Nov 23; PROPOSED, not decided):** a card
surcharge is not banned by Illinois law, but card-network rules cap it (about 3% for Visa), forbid it
on debit and prepaid cards, require it to be shown before payment, and reportedly need notice to the
networks in advance; Shopify has no built-in surcharge (an app is needed, and customers must accept
it at checkout); a few states (for example Connecticut, Massachusetts) ban surcharges for their
buyers; whether the fee itself is taxed is a question for the accountant. Claude's suggestion:
retail online, build about 3% into the prices instead of a separate fee; wholesale, the legal and
simpler "discount for bank transfer or check" (for example 3% off), which the invoice could show
later if the owner wants.

**Business phone line (PROPOSED, Nov 23):** a separate business number in an iPhone app; Claude's
pick is Quo (formerly OpenPhone, about $15–19/month); cheaper options Grasshopper (about $14–25),
Line2 (about $8); Google Voice needs a paid Google Workspace. Get the number before printouts and the
website go out, so the printout contact line (an open owner decision) can carry it.

Connect the money-matching check to how customers really pay (Shopify Payments payouts,
wholesale payments), and finish the payment screen. The bank stays a monthly file you download;
no outside bank-connection service.

## 5. Approvals waiting (each one separately, when you are ready)

- **Merge #37 and #42** (Nov 23 night). #42 contains #38–#41 too, so two merges bring in everything
  (fonts, previous-look readability, tax-rate dates, product import, confirmed tax rates); every new
  feature stays off behind its switch. Same steps as #36 ("Merge without waiting for requirements").

- ~~The push of the working branch~~ done Nov 23 → **PR #36: merge it** when its final test run is
  green (guided). It contains every older open PR (#5–#35); close those afterwards.
- SQL review items 1–7 (each about 15 minutes, guided, with a check before and after). **Start
  here:** `docs/ops/sql-review/START_HERE_GUIDED_RUNS.md` (recommended order; step 1 only reads).
- Palette changes C1–C7 (the look itself is decided: Aurora).
- The Shopify read-only payout app (review item 6).

## Attention feed and smart scan (owner request, Nov 23 late)

Plan: `docs/ops/ATTENTION_FEED_AND_SMART_SCAN_PLAN.md`. DECIDED: customer updates are approved by the owner first, automatic later. Open for the owner: where postage is bought (Shopify Shipping or the counter), and the AI reading service (about $1–5 a month). Next: step A (one feed inside the dashboard), behind a switch.

## Backups and the launch list (owner, Nov 24 late)

- **Backups looked at by the owner (Nov 24):** nightly backup green on Nov 24; the platform lists daily backups for Nov 18–24. Still owed by the owner: the newest monthly restore test, as "green/red, date" only. Detail and the plan for "the best level" (a third copy that cannot be deleted, one restore drill, files in Storage, a Home warning): `RECOVERY_AND_BACKUP_READINESS.md` §1 and §7.
- **The owner's idea of a third copy in the partner's Administrator account:** answered in §7 of that page (a dashboard account holds no files; recommended instead: a business-owned storage account with an emergency sign-in for the partner). OWNER DECISION REQUIRED.
- **Two-step sign-in: later.** The owner wants easy sign-in while there are no employees. **Remind the owner before launching; it is one of the last lines of the "Ready to launch" page.** Do not raise it before then.
- **Reminder owed:** the dress rehearsal with a real test order, when the printers arrive.
- **Open pull request:** #87 "Customers first" (preview switch, off by default).

