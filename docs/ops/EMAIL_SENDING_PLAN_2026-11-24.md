# Email sending: what is ready, and what real sending still needs

Written November 24, 2026. Status labels: CURRENT (in the repository), PROPOSED, OWNER DECISION REQUIRED.

**Nothing sends an email today.** This page is the plan for the day the owner approves real sending.

## 1. What exists (CURRENT)

| Piece | Where | State |
|---|---|---|
| Store Campaigns page: write one email, wording check, approve once, choose how many stores and which first, see who would get it on which day | dashboard, switch "Store Campaigns" (off) | built; drafts only |
| Store finder: score a pasted list of stores, with reasons | on the Store Campaigns page | built; looks nothing up |
| Customer Emails page: five kinds, ready texts, approve once, exact list of who would get it; marketplace buyers never | dashboard, switch "Customer Emails" (off) | built; drafts only |
| The drafts of these pages on every device | shared settings, `docs/ops/sql/drafts/50_DRAFT_shared_settings.sql` | built; needs draft 50 installed |
| **The database records and rules for sending** | `docs/ops/sql/drafts/56_DRAFT_email_sending.sql`, rollback `docs/ops/sql/drafts/57_DRAFT_rollback_email_sending.sql` | DRAFT, not installed; 96 local checks pass (`docs/ops/sql/local-test/email_sending_test.sh`) |
| Saving a campaign from the dashboard into those records | `assets/sales/he-email-store.js`, switch "Saved email campaigns" under "features that save real records" (off) | built; sends nothing; usable only after draft 56 is installed |

### What draft 56 does, in plain words

It adds three lists to the database and the rules around them. It contains no code that reaches an email service.

1. **Approved campaigns.** One line per wording the owner approved: for stores or for customers, the subject, the email, the business postal address, who approved and when. An approved wording can never be changed; a changed text is a new campaign and a new approval. A wording with a health or medical claim is refused by the database too.
2. **The outbox.** One line per email that is to go out: which campaign, which address, on which day, and what happened to it (queued, sent, failed, bounced, marked as spam, skipped with the reason). Nothing is ever deleted from it.
3. **The do-not-email list.** An address that unsubscribed, bounced or marked an email as spam. It only grows. An address on it is never queued and never handed to the sending program.

The sending guard is enforced by the database itself, not only by the page:

- a slow start: 20 emails a day in the first working week, then 40, 60, 80, and 100 a day from the fifth week; never on a weekend;
- a store is not written to again within 90 days;
- a bounce or a spam complaint puts the address on the do-not-email list by itself;
- a campaign stops by itself after 2 spam complaints, or when more than 5% of at least 20 sent emails came back; what was still queued is skipped.

Who may do what: only the owner approves a campaign, chooses who it goes to, and pauses or stops it. The owner and administrators can read everything and add an address to the do-not-email list. Staff and visitors see nothing. Only the sending program can be handed emails and record what happened to them; a person signed in to the dashboard cannot.

## 2. What real sending still needs

| # | What | Who | State |
|---|---|---|---|
| 1 | A business email address on the business's own domain (for example hello@ the business's domain), and a second address for outreach so order emails are never affected | Owner | OWNER DECISION REQUIRED |
| 2 | An account with an email sending service, in the owner's own name. Which service, its price and its terms are **not checked yet** | Owner, with a comparison prepared first | OWNER DECISION REQUIRED |
| 3 | The domain's sender settings (the records that prove an email really comes from the business), set where the domain is managed | Owner, guided one step at a time | NOT STARTED |
| 4 | Install database draft 56 | Owner, after approving it, in a guided sitting | NOT STARTED |
| 5 | The sending program: a small server-side piece that asks the database for today's emails, hands each to the email service, and records what happened. It holds the service's key, which the owner enters in the database's own settings; the key never appears in this repository, in a pull request or in chat | To be written as a draft for the owner's approval | PROPOSED, not written |
| 6 | A way for the email service to report bounces, complaints and unsubscribes back, so the do-not-email list fills by itself | Part of piece 5 | PROPOSED, not written |
| 7 | The dashboard part that saves an approved campaign and its list into the database: on Store Campaigns and Customer Emails, "Save this campaign (nothing is sent)", the list of saved campaigns with pause, resume and stop, and "Someone asked not to be emailed" | Built, behind the switch "Saved email campaigns" (off; it can only be turned on once draft 56 is installed) | CURRENT (`assets/sales/he-email-store.js`); tested against a stand-in for the database, not against production |
| 8 | The owner's approval of the first real send, to a small list, with the owner's own address in it | Owner | OWNER DECISION REQUIRED |

Order: 1 and 2 first (they take the longest and are outside the dashboard), then 3, then 4 (after which piece 7 can be switched on), then 5 and 6, then 8.

## 3. Rules that stay in force

- No real customer or store message is sent without the owner's approval of that specific task.
- Every marketing email carries a line on how to stop the emails and the business postal address.
- Only people who ordered or subscribed are written to. Buyers on Amazon, Etsy and TikTok Shop are never emailed.
- No texting at the start; email only.
- No passwords, keys or tokens in this repository, in pull requests or in chat.

## 4. Honest limits

- The points about marketplace buyers and about what a marketing email must contain are general practice, not legal advice, and are to be checked against each site's current seller rules and the law before the first real send.
- "Days" in the slow start are counted from the first day an email was queued to go.
- The do-not-email list cannot be shortened from the dashboard. Taking an address off it after a mistake is a reviewed statement the owner runs.
- Draft 56 was tested only on a throwaway local database, never on production.
