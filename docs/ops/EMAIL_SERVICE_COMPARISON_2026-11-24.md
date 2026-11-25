# Email sending: which service, and what it costs

Written November 24, 2026. Status: PROPOSED. The choice is the owner's (OWNER DECISION REQUIRED). Nothing was signed up for, and nothing sends an email today.

This page answers point 2 of `docs/ops/EMAIL_SENDING_PLAN_2026-11-24.md` ("which service, its price and its terms").

## How the figures were checked, honestly

- The prices below are the providers' **published prices**, read on November 24, 2026 through web search summaries of the providers' own pages. The work session could not open the providers' pages directly (its network does not allow those sites), so every figure is to be **confirmed on the provider's own page on the day of signing up**. Prices change.
- Where the summaries disagreed or did not answer, this page says "not confirmed" instead of guessing.
- This is not legal advice.

## How much would be sent

The sending guard in database draft 56 allows at most 100 emails a day from the fifth week, and none on weekends. That is at most about 2,200 emails a month (100 a day × 22 working days; exact from the rule, the real number will be lower at the start: 20 a day in the first week). Every service below is far larger than this, so the price difference is a few dollars a month. **The terms matter more than the price.**

## The main finding: two kinds of email, two different sets of rules

| | Emails to customers | Emails to stores |
|---|---|---|
| Who gets them | People who ordered from the business's own shop or subscribed | Stores that have never heard from the business |
| What the services say | Allowed everywhere, with a way to stop the emails | Many services do not allow emails to people who did not ask for them. Shopify's own tool does not (see below). For the others it is **not confirmed** and must be read in the service's terms before signing up |
| Risk | Low | Higher: spam complaints can get an account closed and hurt the business's address for order emails too |

This is why the plan already asks for a second address for store outreach, separate from the one used for orders.

## The options

| Service | Published price | Fits customer emails? | Fits store outreach? | Effort to set up |
|---|---|---|---|---|
| **Shopify's own email tool** (now called Shopify Messaging) | 10,000 emails a month free on a paid Shopify plan, then $1 per 1,000 | Yes. It sends only to customers who agreed to marketing emails, and handles "unsubscribe" by itself | **No.** Shopify sends only to people who opted in; bought or collected lists are against Shopify's terms | Lowest: it is already inside Shopify |
| **Resend** | Free: 3,000 a month, at most 100 a day. Paid: $20 a month for 50,000 | Yes | Not confirmed; read the terms first | Medium: needs the sending program (piece 5 of the plan) |
| **Postmark** | Free: 100 a month (testing only). Paid: from $15 a month for 10,000 | Yes | Not confirmed; read the terms first | Medium: needs the sending program |
| **Amazon SES** | $0.16 per 1,000 for a new account, no monthly fee (about $0.35 a month at 2,200 emails; estimate) | Yes | Not confirmed; read the terms first | Highest: the most technical account to set up |
| **A normal business mailbox** (for example Google Workspace Business Starter) | $8.40 per person a month, or $7 with a one-year commitment. Limit 2,000 emails a day per mailbox | Possible, but it has no automatic "unsubscribe" handling | This is how small, personal outreach is usually sent: one email to one store. The provider's rules against spam still apply | Low for writing by hand; a program sending through it is a separate decision |

A business mailbox on the business's own domain is needed in every case (point 1 of the plan), whichever service is chosen.

## What I recommend (PROPOSED)

1. **Customer emails: start with Shopify's own email tool.** It costs nothing at this size, it only writes to people who agreed, and it handles "unsubscribe" by itself. The Customer Emails page of the dashboard stays the place where the wording is written, checked for health claims and approved; the approved text is then copied into Shopify by the owner. Trade-offs, stated plainly:
   - it reaches only customers who ticked "email me offers", which is fewer people than "everyone who ordered";
   - these sends would be recorded in Shopify, not in the outbox of database draft 56;
   - it is an action in Shopify, so it happens only when the owner does it or approves that specific task.

   Built for this on Nov 24: once a wording is approved, the Customer Emails page has **Copy the subject** and **Copy the email**. `{name}` is copied as a visible `[first name]` mark, to be replaced with the email tool's own "personalize" button (Shopify's help pages describe one for the first name; read through search summaries, not tried here).
2. **Store outreach: do not sign up for a sending service yet.** First read the chosen service's terms on emailing businesses that did not ask. Until then the safe way is the one already designed: few emails a day, personal, from the separate outreach address, each with the business postal address and a line on how to stop the emails.
3. **Database draft 56 and the sending program stay as designed** for the moment a sending service is chosen. Nothing built is wasted: the approval, the slow start, the do-not-email list and the automatic stop are needed with any service.

## What the big mailbox providers require from senders

From Gmail's published sender guidelines (read November 24, 2026 through search summaries):

- every sender must prove its emails are really from its domain (the three "sender settings" of plan point 3);
- marketing emails need a one-click "unsubscribe", and a request to stop must be honoured within 48 hours;
- spam complaints should stay under 0.1% of emails and must never reach 0.3%.

The strictest of these rules apply from about 5,000 emails a day, far above this plan. The guard in draft 56 is stricter anyway: a campaign stops by itself after 2 spam complaints.

## What is still open

- Which service (the owner's decision), and reading its current terms and price on its own page.
- Whether store outreach by email is allowed by the chosen service at all.
- Where the business's domain is managed, because the sender settings are entered there.

## Sources

- Shopify: https://www.shopify.com/email-marketing , https://help.shopify.com/en/manual/promoting-marketing/create-marketing/shopify-messaging/email/create-email/create-campaigns , https://help.shopify.com/en/manual/promoting-marketing/create-marketing/shopify-email/faq , https://help.shopify.com/en/manual/promoting-marketing/create-marketing/shopify-messaging/email/subscriber-list-management , https://www.shopify.com/legal/terms
- Resend: https://resend.com/pricing , https://resend.com/docs/knowledge-base/account-quotas-and-limits
- Postmark: https://postmarkapp.com/pricing
- Amazon SES: https://aws.amazon.com/ses/pricing/ , https://aws.amazon.com/about-aws/whats-new/2026/07/amazon-ses-pricing-plans/
- Google Workspace: https://workspace.google.com/pricing , https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace
- Gmail sender guidelines: https://support.google.com/a/answer/81126 , https://support.google.com/mail/answer/14229414
