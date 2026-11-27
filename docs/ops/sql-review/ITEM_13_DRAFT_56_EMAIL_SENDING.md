# Review item 13 — SQL draft 56: the records and rules for email sending

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-24
Nothing here has been run in production. I never run it myself: you run it, after approving it.

**This step sends no email.** It contains no code that reaches an email service. It only adds the
records and the rules that real sending will have to obey later.

Why: your decision of Nov 24 ("I want to approve the texts and what is in the email, but not the
actual sending of each one"), and your question about staying out of spam.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/56_DRAFT_email_sending.sql` (install) | 566 | `8d101087cd892784` |
| `docs/ops/sql/drafts/57_DRAFT_rollback_email_sending.sql` (undo) | 63 | `118416d2a4452354` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up data.

## What it does, in plain words

Three new lists:

1. **Approved campaigns.** One line per wording you approved (for stores or for customers): the
   subject, the email, the business postal address, who approved and when. An approved wording can
   never be changed; a changed text is a new campaign and a new approval. A wording with a health or
   medical claim is refused by the database too.
2. **The outbox.** One line per email that is to go out: which campaign, which address, on which
   day, and what happened to it. Nothing is ever deleted from it.
3. **The do-not-email list.** An address that unsubscribed, bounced or marked an email as spam. It
   only grows. An address on it is never queued.

The rules the database enforces by itself:

- a slow start: 20 emails a day in the first working week, then 40, 60, 80, and 100 a day from the
  fifth week; never on a weekend;
- a store is not written to again within 90 days;
- a bounce or a spam complaint puts the address on the do-not-email list;
- a campaign stops by itself after 2 spam complaints, or when more than 5% of at least 20 sent
  emails came back.

Who may do what: **you and administrators** approve a campaign, choose who it goes to, and pause or
stop it (changed Nov 25, before anything was installed, for your decision of Nov 24: an
administrator is "almost like owner"; until then it was you only; each campaign keeps who
approved it, and a stop says who stopped it). You and administrators can read everything and add an address to the do-not-email list. Staff and
visitors see nothing. Only a sending program (which does not exist yet) could be handed emails to
send; a person signed in to the dashboard cannot.

## Order and dependencies

- Needs, in production: `auth.uid()`, `current_role()`, `is_owner_or_admin()`,
  `gen_random_uuid()`, the `tasks` and `audit_log` tables and the audit trigger on `tasks`. If one
  is missing, it stops and changes nothing.
- Depends on no other draft. It refuses to install over a table of the same name that it did not
  create, and changes no existing table.
- Safe to run twice.
- **No hurry.** It is useful only once you want campaigns saved in the database. Real sending needs
  more than this step: see `docs/ops/EMAIL_SENDING_PLAN_2026-11-24.md`.
- Supabase shows its usual warning about a "destructive operation": the file lists only
  `drop policy if exists …` and `drop trigger if exists …` on its own new tables.

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/email_sending_test.sh`: **102 of 102 passed** (Nov 25, with administrators approving, queuing, pausing and stopping; 96 of 96 on Nov 24). It acts as the
owner, an administrator, a staff member, a visitor and the sending program, and covers: install
twice; only the owner approves; a health claim refused; the wording cannot be changed afterwards;
who is left out and why; the daily limits and weekends; the 90 days between emails to one store;
bounces and complaints; the automatic stop; that a signed-in person cannot take emails to send;
nothing can be deleted; the rollback.
Dashboard tests: `tests/specs/email-store-ext24.spec.js` (against a stand-in for the database).

## After running: check (read-only, paste into the SQL editor)

```sql
select to_regclass('public.email_campaigns') is not null as campaigns_table,
       to_regclass('public.email_outbox') is not null as outbox_table,
       to_regclass('public.email_suppressions') is not null as do_not_email_table,
       (select count(*) from public.email_campaigns) + (select count(*) from public.email_outbox) + (select count(*) from public.email_suppressions) as rows_saved,
       has_table_privilege('anon', 'public.email_outbox', 'select') as visitors_can_read,
       has_function_privilege('authenticated', 'public.next_emails_to_send(integer)', 'execute') as a_signed_in_person_can_take_emails_to_send,
       public.email_daily_cap(current_date) as emails_allowed_today;
```
Expected: `true | true | true | 0 | false | false | 20` (the last number is `0` if you run it on a
Saturday or Sunday). Anything else: stop and send me a screenshot. This check was tried on the
throwaway local database.

Then on the dashboard:

1. **Admin → Feature Flags → Features that save real records (owner and administrators) → Saved email campaigns
   → Turn on.** It shows "Installed" once this step has run.
2. Turn on the preview switch **Store Campaigns** (or **Customer Emails**) and open that page.
3. Approve a wording and show who would get it. Under **Save this campaign (nothing is sent)**,
   give it a name and save. It appears in the list of saved campaigns below.
4. Press **Stop** on it (twice, it asks again). It shows as stopped. Nothing was sent at any point.

## Undo

- Nothing saved yet: run file 57. It removes everything 56 added. Harmless twice.
- Something saved: file 57 stops and says so. **The do-not-email list would be lost with it, so
  save that list first.** Then (only if you decide the records can go) run
  `set he.rollback_delete_email_sending = 'yes, delete the email records';` and file 57 in the same
  session.

## Your decision

- [ ] Approve running draft 56 in production, or
- [ ] Not yet (recommended until the business email and the email service are decided).
