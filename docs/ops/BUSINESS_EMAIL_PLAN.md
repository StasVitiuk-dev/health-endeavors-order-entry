# Business email addresses — plan (Nov 24, 2026)

Status: **PROPOSED** (owner request: addresses ending in the business domain for
orders, marketing, stores and outreach; the owner will connect them later).
Related: `docs/ops/OPERATIONS_CHAIN_ALL_CHANNELS.md` (gap 3: outside messages in
the feed). No passwords or keys ever go in chat or in this repository.
Which sending service, its published price and what is still not confirmed: the
email service comparison of Nov 24 (it arrives with PR #78, next to the email sending plan).

The settings that keep these addresses out of spam (SPF, DKIM, DMARC), step by step:
`docs/ops/EMAIL_SENDER_SETTINGS_GUIDE.md` (Nov 26).

## Principle: few paid mailboxes, many free addresses

Most addresses can be **aliases** (extra addresses that land in one mailbox, free),
so only a few paid mailboxes are needed. A provider with a mail API (for example
Google Workspace) lets the dashboard read the inbox with the owner's approval.

## On the main domain (people and customers write here)

| Address | Use | Mailbox or alias |
|---|---|---|
| support@ | customer questions from every channel; the feed reads it | mailbox 1 |
| orders@ | order, marketplace and shipping notifications | alias → mailbox 1 |
| hello@ | website contact form, general | alias → mailbox 1 |
| wholesale@ | stores that reply, wholesale orders | mailbox 2 |
| purchasing@ | suppliers, supplier invoices and documents | alias → mailbox 2 |
| billing@ | payouts, bank, platform bills, sales tax | mailbox 3 (owner only) |
| admin@ | owner of the seller, domain and service accounts; strongest 2-step login; never used for sending | alias → mailbox 3 |
| the owner's own name@ | owner's business mail | mailbox 3 |
| news@ | sender name for newsletters, sent through the store's email tool, not typed by hand | alias |

## Outreach to stores (about 100 emails a day): a separate domain

Cold emails to stores are judged by inbox providers on the **sending domain's**
reputation. If outreach ever gets marked as spam, the main domain must not suffer,
or order and support mail would start landing in spam too. So:

- a **second domain** used only for outreach (a close variant of the business name);
- **3 outreach mailboxes** on it, about 30–35 emails a day each, after a 2–3 week
  warm-up that starts with a handful a day;
- replies are forwarded to wholesale@ on the main domain, where the feed shows them;
- every email follows US rules for commercial email: honest sender and subject, a
  working "unsubscribe", and a real **postal address**. The owner's home address
  stays private: use a PO box or a virtual mailbox address. OWNER DECISION REQUIRED.
- the agents only **draft**; the owner approves sending (decision D1).

## Count and rough cost

About **3 paid mailboxes** on the main domain plus **3** on the outreach domain,
so 6 in total, plus the second domain (about $10–15 a year). Mailbox prices are
roughly $7–8 per mailbox a month at the common providers (check the current price).
Owner decisions: the provider, and whether to start with the main domain only
(3 mailboxes) and add outreach when the store outreach begins.
