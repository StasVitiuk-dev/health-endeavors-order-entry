# What the business's tools cost each month, and how to keep it low

Written November 26, 2026, at the owner's request ("how much will everything here gonna cost me a
month when I gonna launch it … is there is any way that we can make it take as less money from us
as art possible"). Status: **CURRENT estimate**. These are list prices as known on Nov 26, 2026;
**confirm each on the provider's own pricing page on the day of signing up**, because they change.
Related: email prices in `docs/ops/EMAIL_SERVICE_COMPARISON_2026-11-24.md`; the AI budget in
`assets/sales/he-sales-cost.js` (`docs/ops/SALES_GROWTH_AND_WHOLESALE_SYSTEM.md`).

## What the owner's GitHub billing shows (Nov 26, 2026, owner's screenshots)

- **Billed: $0** on every day shown. The "gross" figure of about $165 for the month is the value of
  the free test runs on this public repository, not a bill.
- **Budgets:** Actions, Packages, Git LFS, AI Credits and Codespaces each set to **$0.00 with
  "Usage blocked"**, so GitHub cannot charge anything.
- Caution: the private backups repository uses GitHub's free included minutes too. If it ever ran
  out of them, the $0 budget would **stop** the nightly backup instead of charging. That is why the
  owner's backup report includes "minutes: OK/out" (`RECOVERY_AND_BACKUP_READINESS.md` §8, E3).

## Fixed costs each month (the same with or without sales)

| Service | What it does | Estimate per month |
|---|---|---|
| GitHub | the dashboard, its tests, the backups | **$0** (public repository; backups within the free minutes) |
| Supabase (database) | orders, stock, accounting | **Pro, about $25** base plan (owner's screenshot, Nov 26: "Pro Plan", **spend cap enabled**). The spend cap limits **usage** beyond the plan's included amounts; it does **not** cover compute, point-in-time recovery or certain items you switch on yourself (see below) |
| Shopify Basic | the online store | about **$39**, or about **$29 when paid yearly** |
| Google Workspace (proposed) | business email | about **$7–8.40 per mailbox** (`EMAIL_SERVICE_COMPARISON_2026-11-24.md`) |
| Domain name | the business's web address | about **$1–2** |
| Shopify's customer emails | order and shipping emails | **$0** up to 10,000 a month on a paid plan, then about $1 per 1,000 |

**Total: about $75–80 a month** with Supabase Pro (the owner's plan, confirmed Nov 26), one mailbox
and Shopify paid yearly.

**Spend cap (Supabase, Nov 26):** on. **Corrected Nov 27:** an earlier note here said the spend cap means
"no charge beyond the plan, ever". That was too broad. Supabase's cost-control page
(https://supabase.com/docs/guides/platform/cost-control) says the spend cap applies to **usage** and that
**compute, point-in-time recovery (PITR) and certain opt-in items are excluded** (as relayed by the owner
on Nov 27; the page could not be opened from Claude's session to re-read the full list, so check it there
before relying on a specific item). In short, the bill has three parts:

| Part | What it is | Limited by the spend cap? |
|---|---|---|
| Base plan | Pro, about $25 a month | — (the fixed price) |
| Add-ons you switch on | for example a bigger compute size, PITR, and other opt-in items named on that page | **no**: each is charged while it is on |
| Usage beyond what Pro includes | for example database size, file storage, data transfer, monthly users | **yes**: with the cap on, usage stops at the included amount instead of being charged (the trade-off: the project can be limited until the next month) |

Today nothing is switched on beyond the base plan (as far as the owner's Nov 26 screenshot shows), so the
expected bill is the base plan. Before switching on any add-on, read its price on Supabase's page.
Recommendation unchanged: keep the cap on; look again once real orders run at volume. Billing and
spend-cap settings are the owner's; Claude never changes them.

## Costs that come only with sales

- **Card payments:** about 2.9% + 30¢ per online order on Shopify Basic (about $1.17 on a $30 order).
  Confirm on Shopify's page.
- **Shipping labels:** per parcel, normally covered by what the customer pays at checkout.
- **Marketplaces** (Amazon, Etsy, TikTok Shop): each takes its own fee, only where the business sells.
- **AI agents:** only if they are connected to a paid AI service. Routine work is set to use no AI,
  and the dashboard's AI budget has a daily and monthly limit with a hard stop.

## Ways to keep it low (owner's choice for each)

1. Pay Shopify **yearly** (about $120 a year less).
2. Start with **one mailbox**; support@, orders@ and dmarc@ as free aliases of it
   (`BUSINESS_EMAIL_PLAN.md`).
3. Keep the **$0 GitHub budgets** as they are, and keep reporting "minutes: OK/out".
4. Supabase: the owner is already on **Pro** (its own daily backups, the database never pauses), with
   the spend cap on (it limits usage, not add-ons such as compute or PITR: see above).
5. Use **Shopify's own email** for customer messages instead of a paid sending service.
6. Avoid **paid Shopify apps** unless one clearly pays for itself; most of what they offer is built
   into the dashboard.
7. Optional: the tests run twice per change (on the push and on the pull request). That costs
   nothing on a public repository, so it is left as is; halving it would be a workflow change
   through a pull request the owner approves.
