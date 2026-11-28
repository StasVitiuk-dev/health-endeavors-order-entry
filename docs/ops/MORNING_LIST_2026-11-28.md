# Morning list for Stas (Saturday, Nov 28, 2026)

Status: CURRENT · rewritten overnight (Nov 28, from about 1 AM Central) while Claude worked alone. It
replaces the earlier list of the same name (Nov 27–28); that list's merges are all done, and its open
decisions are carried over below. Nothing here was merged, installed, switched on or sent by Claude.

**Where things stand:** every pull request up to #162 is merged. FIX 3 is installed and checked. The launch
target is about **Dec 10** (13 days), and it depends on the answers below, above all the product list.

## 1. Merge (1 minute)

- The day's single pull request (opened overnight; Claude writes "Ready" on it when its checks pass). Tick
  the bypass box (GitHub lists you as the author, see #160), then **Merge pull request** → **Confirm merge**.

## 2. Answers that decide the launch date (most important first)

| # | Question | Unblocks | Effort |
|---|---|---|---|
| 1 | **Which day does the lab send the product list?** (name, size, SKU exactly as on the label, price, cost, photos) | everything for the store (R8); the plan assumed Nov 30 | a text to the lab |
| 2 | **How do Shopify orders reach the dashboard at launch?** Today the order import runs in the private backups repository, which Claude never opens. Is it switched on and working? If you don't know, the alternative is the daily Shopify program (database step 7, draft 42) | "every order lands on the dashboard" (launch promise 2); the test order | tell Claude what you know, or a screenshot of the backups repository's Actions page |
| 3 | **Stock steps in the launch: yes / not yet?** (`sql-review/ITEM_20_STOCK_STEPS_R1_R5.md`; recommendation: yes) | the database evenings | one word |
| 4 | **Tax answers:** your Illinois sales tax registration (done or not) and the rate you charge, or your accountant's answer | Shopify taxes (setup guide F), invoices | accountant |
| 5 | **Email provider** (`BUSINESS_EMAIL_PLAN.md`; recommendation Google Workspace, about $21/month for 3 mailboxes) | `support@` / `admin@`, the store's contact email, TikTok sign-up | one word |
| 6b | **When should an order take its bottles off the stock count: when it is paid, or when it ships?** (the new stock-per-order step, draft 76, built overnight; recommendation: when paid, as Shopify does) | the stock-per-order step being used | one word |
| 6 | **Returns / ship-from address: home or a private mailbox?** (home = printed on every package and return label) | shipping setup (guide E), return policy, TikTok | one word |

## 3. The store texts (sent to you as a file this morning)

Claude drafted the store's legal pages overnight: return and refund, shipping, contact, privacy, a
**consumer health data privacy policy**, and the product-use part of the terms. They are **not** in this
public repository, because where store texts live is still your decision (question 7).

| # | Question | Recommendation |
|---|---|---|
| 7 | Where should store texts live? Straight into Shopify (with your approval), or a new private repository for the website project? | straight into Shopify for launch |
| 8 | The 9 choices at the top of the drafts (return window, opened products, who pays return postage, refund timing, US only, processing time, free-shipping threshold, returns address, which state's law) | recommended answers are written in; say "all as recommended" or change any |
| 9 | **Ask a lawyer 3 questions** (in the drafts): mainly whether Washington's My Health My Data Act applies because the business is registered there and keeps product reaction reports. If it does, the store needs that separate privacy page **linked on the home page** | a short paid consult before launch |
| 10 | **Ask the lab:** who is the "responsible person" for FDA cosmetics rules, and is a U.S. contact for reaction reports on every label? (federal law requires it) | a text to the lab |

## 4. Read-only database looks (15 minutes, change nothing; whenever you have time)

1. The `feature_flags` columns (needed before drafts 21, 27 and 29): the query is in `LAUNCH_PLAN_2_WEEKS.md`.
2. Query C: does anything else change stock? Guide: `QUERY_C_OWNER_RUN_GUIDE.md`. Say "ready for Query C"
   and Claude sends it one step at a time.

## 5. Still open from the earlier list (skip any you already answered)

- The two-week plan: **go**, or what to change.
- The nightly check: should Home warn after one missed night? (decision X8-D4)
- Customer email at launch: **none** (drafts to copy only) or **real sending**? (launch fix R10)
- The mail details from your partner (the Washington address): you said it may take a few days. Fine.
- Connect Claude as `stasvitiuk-reos` (claude.ai → Settings → Connectors → GitHub), so you can approve
  normally instead of using the bypass box (`docs/security/GITHUB_CREDENTIAL_ADMIN_FINDING_2026-10-07.md`, section 7).

## 6. Tonight (about 6:20 PM Central)

The 24-hour check after FIX 3: Claude sends one read-only query in the chat; you run it and paste the result.
It confirms the midnight, 3 AM and 6:05 PM jobs ran without errors.

## Done overnight (details in `docs/PROJECT_RECORD.md`)

- **Stock per order (draft 76, not installed):** an order now can take its bottles off the stock count exactly once
  (all or nothing; refused if a SKU is unknown or stock would go below zero) and give them back once when
  cancelled. 62 local checks. It closes the launch gap "stock goes down by exactly the amount sold" on the
  database side; it becomes step 3b of the launch plan's database list. Details: `ONE_STOCK_COUNT_DECISION_2026-11-24.md`.
- `SHOPIFY_STORE_SETUP_GUIDE.md`: the store setup click by click (store details, simple theme, products,
  payments, shipping, taxes, policies, checkout, before opening), launch-plan days 6 and 8.
- The store texts (section 3), sent as a file.
- The question about how orders reach the dashboard (2.2) found while writing the guide: the test-order
  checklist had marked it UNKNOWN; it is now a question for you instead of a surprise on test day.
- **Products typed once:** the product import now has **Save for Shopify (CSV)**, the same checked list as
  Shopify's import file (behind the Product list import switch, off). Small favour when you are in Shopify:
  Products → Import → "Download a sample CSV" and send it, so the columns can be matched exactly to your
  store's version (Shopify's import preview would show a mismatch anyway, before anything is created).
- A stray Python cache file removed from the repository, and such files are now ignored.
- The full test run on the latest code: results in the day's pull request.
