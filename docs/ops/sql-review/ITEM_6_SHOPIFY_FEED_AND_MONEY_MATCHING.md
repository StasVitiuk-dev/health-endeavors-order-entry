# Review item 6 — automatic Shopify feed and money matching (owner request of Nov 22)

Status: OWNER DECISION REQUIRED · PROPOSED 2026-11-22 · production steps PENDING your separate approval
Nothing here has been run in production or connected to Shopify, Chase or Wells Fargo.
I never run, deploy or connect it myself: you do, after approving it.

## What you asked for

> Match all transactions automatically and let me know somewhere if there is a mismatch.
> Do both now: the matching and alerts with made-up data plus manual file upload, and the
> automatic Shopify feed. I don't want to use another service I don't trust for the bank.

## How it works (three parts)

| Part | What it does | Where it is now |
|---|---|---|
| 1 Money matching (Accounting) | You choose a **Chase checking** export (deposits) or a **Wells Fargo card** export (purchases). The dashboard reads the file **in your browser only** and checks: every Shopify payout and wholesale payment arrived once and in full; refunds went out; every card purchase is recorded as an expense. Each difference says what and why. | Built, behind the preview switch "Money matching" (Feature Flags page). Works today on card purchases against your recorded expenses; deposits need part 2 |
| 2 Automatic Shopify feed | Once a day, a small program on your database reads **only** Shopify Payments payouts and the charges, refunds and fees inside them (read-only), stores a copy, and checks that each payout adds up | Draft: database change 42, program `docs/ops/edge-drafts/shopify-payouts-sync/` |
| 3 "Let me know" | Every difference (from the daily check, or saved from a bank or card file) stays on a list until you or an administrator mark it checked with a note. Home shows "N money differences to look at" with a button to Accounting | Built behind a switch that is not on the Feature Flags page; does nothing until change 42 is installed |

Your bank login is never used or stored anywhere. The bank side stays a file you download
from Chase (about once a month) and choose on the Accounting page.

## The exact files

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/42_DRAFT_shopify_payouts_money_issues.sql` (install) | 242 | `dfbcaa89a6112c17` |
| `docs/ops/sql/drafts/43_DRAFT_rollback_shopify_payouts_money_issues.sql` (undo) | 45 | `7e99fc42666da360` |
| `docs/ops/edge-drafts/shopify-payouts-sync/sync-core.mjs` (the daily program's logic) | 124 | `ee738a11abdf4b39` |
| `docs/ops/edge-drafts/shopify-payouts-sync/index.ts` (the Supabase Edge Function around it) | 61 | `64daea3395bec019` |

## What change 42 adds (no existing table changes)

- `shopify_payouts`, `shopify_balance_transactions`: the read-only copy. Only the daily program
  (Supabase's service role) writes them; nobody signed in can, the owner included.
- `money_match_issues`: the list of differences. Open until checked with a note; never deleted.
- `check_shopify_payouts()`: each payout must equal the net of its own transactions (the payout's
  own transfer line and test orders left out). Running it again adds nothing.
- `record_money_issue(...)`, `mark_money_issue_checked(id, note)`: owner or administrator.
- Who sees what: you and administrators read all three; staff and visitors read nothing.

## What the Shopify access key can do

A custom app in your Shopify admin with **only these two read-only permissions**:
`read_shopify_payments_accounts` and `read_shopify_payments_payouts`. It cannot change orders,
products, customers, prices or money, and it cannot see bank account numbers (that permission is
deliberately not requested). The program sends only read queries and refuses anything else.

## Steps for you, after approving (I will guide you one click at a time, with screenshots)

1. Shopify admin → Settings → Apps → Develop apps → create "Health Endeavors payout reader" with
   the two permissions above → install → copy its Admin API access token. **Do not send it to me.**
2. Supabase → SQL Editor → run file 42 (check the fingerprint first) → run the check below.
3. Supabase → Edge Functions → create `shopify-payouts-sync` from the two files.
4. Supabase → Edge Functions → Secrets: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN` (the token
   from step 1), `SYNC_TRIGGER_SECRET` (a long random string).
5. Supabase → Integrations → Cron: a daily job (for example 7:00 Chicago time) that calls the
   function with the header `x-sync-secret`.
6. In the dashboard, this browser only: `localStorage.setItem('he_money_issues','on')`.

## After running file 42: check (read-only)

```sql
select to_regclass('public.shopify_payouts') is not null as payouts_table,
       to_regclass('public.money_match_issues') is not null as differences_table,
       (select count(*) from public.money_match_issues) as differences,
       has_table_privilege('anon', 'public.money_match_issues', 'select') as visitors_can_read;
```
Expected: `true | true | 0 | false`. Anything else: stop and send me a screenshot.

## Staging results (throwaway database, made-up data; never Shopify or a bank)

| Test | Result |
|---|---|
| `local-test/shopify_payouts_test.sh`: install twice; the copy written only by the sync; the daily check finds the payout that does not add up, once; who sees what; saving from a file, twice = once; marking checked needs owner/admin and a note, once; nothing edited or deleted; rollback | **35 of 35** |
| `local-test/shopify_sync_core_test.mjs`: the daily program against made-up Shopify replies: read-only queries, two pages each, a rate-limit pause, Shopify's own date filters, running twice changes nothing, an updated payout is updated, a wrong key / Shopify error / repeated rate limit writes nothing, an unreadable amount is reported and left out | **17 of 17** |
| SQL drafts static checks (no security definer, fixed search path, pinned row rules, nothing granted to visitors, no write grant on the Shopify copy) | 115 of 115 |
| Money matching engine (Chase and Wells Fargo layouts, amounts and dates read exactly, payouts, deposits, refunds, card purchases) | 10 of 10 |
| Money matching page (example, your own files read in the browser and never sent, a non-statement file refused) | 15 passed, computer and phone size |
| Saved differences page, against a real throwaway database (Home banner, mark checked with a note, saving a card file twice = once, staff see nothing) | 15 passed, computer and phone size |

## Rollback and recovery

- **No differences recorded:** run file 43. It removes everything 42 added. Running it twice is harmless.
- **Differences recorded:** file 43 refuses and says how many. Export `money_match_issues` first;
  then, if you decide, run `set he.rollback_delete_money_issues = 'yes, delete the differences';` and file 43.
- Turn the feed off at any time: delete the daily Cron job (step 5) or the Shopify app (step 1).
  The copy of payouts can always be read again from Shopify.

## Honest limits

- Deposits are matched only once the feed runs; until then every Chase deposit shows as "not
  explained", and the page says why.
- Wholesale payments join the matching once invoice storage (item 1) is installed.
- The Chase and Wells Fargo layouts follow their standard CSV exports; a blacked-out sample of
  each from you would confirm them.
- Shopify field names were checked against Shopify's API documentation (version 2026-10), not
  against your store.

## Your decision

- [ ] Approve change 42 and the daily program (then I guide you through steps 1–6), or
- [ ] Not yet.
