# Review item 15 — SQL draft 60: reviews on every device

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-24
Nothing here has been run in production. I never run it myself: you run it, after approving it.

**This step posts nothing and reads no site.** It only keeps the reviews you paste or type in on
the Reviews page.

Why: your rule of Nov 24, "the same on every phone and computer; nothing kept in only one browser".
Until this step is installed, the reviews on the Reviews page live in the one browser where you
added them.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/60_DRAFT_customer_reviews.sql` (install) | 262 | `096167f3c7cf7581` |
| `docs/ops/sql/drafts/61_DRAFT_rollback_customer_reviews.sql` (undo) | 47 | `eab2592de7f6ac9f` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up data.

## What it does, in plain words

A new list, **customer_reviews**: one line per review, with where it was written, the stars, the
text, its date, and whether it still needs a look.

- **You and administrators** read the reviews, add them and mark them. Staff and visitors see
  nothing.
- **The same review is never kept twice** (same site, same date, same words; capitals and spacing
  do not count).
- **A review is never deleted.** "Remove" marks it removed and it stays on the record. Adding a
  removed review again brings it back.
- **Only the mark can change** (needs a look, answered, no reply needed, removed), with who marked
  it and when. The text, the stars, the site and the date cannot be changed afterwards.
- Every change is also written to the audit log (the same one tasks use).
- It refuses to install over a table of the same name that it did not create, and changes no
  existing table.

One thing to know: a review is what a customer wrote in public on a site. If the customer typed a
phone number or a name into it, that is stored with the text. The dashboard hides such details on
screen.

## Order and dependencies

- Needs, in production: `auth.uid()`, `is_owner_or_admin()`, `gen_random_uuid()`, the `tasks` and
  `audit_log` tables and the audit trigger on `tasks`. If one is missing, it stops and changes
  nothing.
- Depends on no other draft. Safe to run twice.
- Supabase shows its usual warning about a "destructive operation": the file lists only
  `drop policy if exists …` and `drop trigger if exists …` on its own new table.

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/customer_reviews_test.sh`: **55 of 55 passed** (Nov 24). It acts as the
owner, an administrator, a staff member, a deactivated account and a visitor, and covers: install
twice; adding a list (lines that are not reviews are counted, not guessed); the same review never
twice; the limits (200 at a time, 2,000 characters); who may read, add and mark; a row typed in for
someone else is stored under the signed-in person; marking, with who and when; a removed review
comes back when added again; the text, stars, site and date cannot be changed; nothing can be
deleted; the audit log; the rollback; a foreign table of the same name is left untouched.
Dashboard tests: `tests/specs/review-inbox-ext24.spec.js` ("reviews on every device").

## After running: check (read-only, paste into the SQL editor)

```sql
select to_regclass('public.customer_reviews') is not null as table_present,
       (select count(*) from public.customer_reviews) as reviews,
       (select relrowsecurity from pg_class where oid = 'public.customer_reviews'::regclass) as row_level_security_on,
       (select count(*) from pg_trigger where tgname = 'customer_reviews_audit') as audit_trigger,
       has_table_privilege('anon', 'public.customer_reviews', 'select') as visitors_can_read,
       has_table_privilege('authenticated', 'public.customer_reviews', 'delete') as anyone_can_delete;
```
Expected: `true | 0 | true | 1 | false | false`. Anything else: stop and send me a screenshot. This
check was tried on the throwaway local database.

Then on the dashboard:

1. **Admin → Feature Flags**: turn on the preview switch **Reviews**, then, under **Features that
   save real records (owner only)**, **Reviews on every device → Turn on**. It shows "Installed"
   once this step has run. Reload the page.
2. **Sales → Reviews**. The line under the title reads "Kept in the database: the same on every
   phone and computer, for you and the administrators." Reviews you had already added in this
   browser are moved to the database by themselves, once.
3. Add one review. On your phone: turn the same two switches on, reload, open Reviews. The same
   review is there. Mark it answered on one device; after a reload it is answered on the other.

## Undo

- Nothing saved yet: run file 61. It removes everything 60 added. Harmless twice.
- Reviews saved: file 61 stops and says how many. Then (only if you decide they can go) run
  `set he.rollback_delete_customer_reviews = 'yes, delete the saved reviews';` and file 61 in the
  same session. Afterwards the Reviews page keeps reviews in each browser again, as before.

## Your decision

- [ ] Approve running draft 60 in production, or
- [ ] Not yet.
