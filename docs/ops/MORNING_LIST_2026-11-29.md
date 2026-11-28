# Morning list for Stas (Sunday, Nov 29, 2026)

Status: CURRENT · written Nov 28 (daytime) while Claude worked alone. It replaces
`MORNING_LIST_2026-11-28.md` (kept for its details; everything still open there is carried over below).
Nothing here was merged, installed, switched on or sent by Claude.

**Where things stand:** #163 is merged and live (Nov 28, about 4 AM Central; nothing installed). The next
bundle is **#164**; Claude writes "Ready" on it when its checks pass. FIX 3 is installed; its 24-hour check is
tonight (section 5). Launch target about **Dec 10** (12 days), and it depends above all on the product list.

## 1. Two minutes

- Feature Flags on the live dashboard (hard refresh): send a screenshot of the new row **Stock per order:
  Not installed yet** (it confirms #163 arrived as tested).
- When #164 says "Ready": tick the bypass box, then **Merge pull request** → **Confirm merge**.

## 2. Answers that decide the launch date (most important first)

| # | Question | Unblocks | Effort |
|---|---|---|---|
| 1 | **Which day does the lab send the product list?** (name, size, SKU exactly as on the label, price, cost, photos) | the store (R8): the plan assumed Nov 30 | a text to the lab |
| 2 | **How do Shopify orders reach the dashboard: path A (today's import) or path B (the read-only order program, prepared Nov 28)?** Is today's import (private backups repository) on and working? Three read-only looks help (counts only, `R9_SHOPIFY_ORDERS_DESIGN.md`, questions 1 and 4). Note: the dashboard's "Shopify Order Sync" switch is off before launch; if today's import obeys it, it is not bringing orders in now. Known from September: today's import uses the "Health Endeavors Order Sync" app, whose key expires about March 6, 2027 (a renewal reminder is set for Feb 20), so it is fine for launch | "every order lands on the dashboard"; the test order | tell Claude what you know, or a screenshot of the backups repository's Actions page |
| 3 | **When should an order take its bottles off stock: when paid, or when shipped?** (recommendation: when paid, as Shopify does) | using Stock per order | one word |
| 4 | **Stock steps in the launch: yes / not yet?** (`sql-review/ITEM_20_STOCK_STEPS_R1_R5.md`; recommendation: yes) | the database evenings | one word |
| 5 | **Tax:** your Illinois sales tax registration and the rate you charge (or your accountant's answer) | Shopify taxes, invoices | accountant |
| 6 | **Email provider** (`BUSINESS_EMAIL_PLAN.md`; recommendation Google Workspace) | `support@`, the store's contact email | one word |
| 7 | **Returns / ship-from address: home or a private mailbox?** | shipping setup, return policy | one word |
| 8 | If path B: should orders keep the **customer's name** (for packing slips)? Today path B keeps none; a name needs one more Shopify permission and a line in your privacy text | path B's setup | one word |

## 3. The store texts (the file sent Nov 28)

| # | Question | Recommendation |
|---|---|---|
| 9 | Where should store texts live: straight into Shopify, or a new private repository? | straight into Shopify for launch |
| 10 | The 9 choices at the top of the drafts | say "all as recommended" or change any |
| 11 | **Ask a lawyer 3 questions** (in the drafts), mainly Washington's My Health My Data Act | a short paid consult before launch |
| 12 | **Ask the lab:** who is the FDA cosmetics "responsible person", and is a U.S. contact for reaction reports on every label? | a text to the lab |

## 4. Read-only looks (whenever you have time; they change nothing)

1. The `feature_flags` columns (before drafts 21, 27 and 29): query in `LAUNCH_PLAN_2_WEEKS.md`.
2. Query C: does anything else change stock? `QUERY_C_OWNER_RUN_GUIDE.md` (say "ready for Query C").
3. The three R9 looks (question 2 above).

## 5. Tonight (about 6:20 PM Central)

The 24-hour check after FIX 3: one read-only query (in `PRODUCTION_CHANGE_LOG.md`, "The 24-hour check");
Claude sends it in the chat; you run it and paste the result. It confirms the midnight, 3 AM and 6:05 PM jobs
ran without errors.

## 6. Still open from earlier (skip any you already answered)

- The two-week plan: **go**, or what to change.
- The nightly check: should Home warn after one missed night? (X8-D4)
- Customer email at launch: **none** (drafts to copy) or **real sending**? (R10)
- The Washington mail details from your partner (a few days; fine).
- Connect Claude as `stasvitiuk-reos` (claude.ai → Settings → Connectors → GitHub), so you can approve normally.
- In Shopify, when convenient: Products → Import → "Download a sample CSV" and send it (to match the columns exactly).

## Done on Nov 28 (details in `docs/PROJECT_RECORD.md`)

- **#163 merged:** Stock per order (draft 76) and its Orders button, one way back only, products typed once
  for Shopify, the Shopify setup guide, the R9 design.
- **#164 (in progress):** R9 path B prepared as drafts (draft 78 and a read-only order program, review item 24;
  obeys the Shopify Order Sync switch, so Emergency stops it); the service key may only read the stock-per-order
  record; manual-order lines now carry their product's SKU (so phone and wholesale orders can take stock), and a line that will be saved without one says so before saving;
  the Stock per order card lists the recent orders that have not taken their stock (none forgotten; cancelled, refunded, voided and expired ones left out); four
  documents corrected (the payouts program was named as a way orders arrive; it never reads orders).
