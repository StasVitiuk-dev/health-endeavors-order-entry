# Review item 8 — SQL draft 46: your confirmed sales tax rates

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-23
Nothing here has been run in production. I never run it myself: you run it, after approving it.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/46_DRAFT_tax_rates.sql` (install) | 236 | `536e2c569fdfd262` |
| `docs/ops/sql/drafts/47_DRAFT_rollback_tax_rates.sql` (undo) | 43 | `d51c92bd167fae34` |

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by you. Tested only
on a throwaway local copy with made-up data.

## What it does, in plain words

A small new list, **tax_rates**, where the rate you confirm is kept: the place (a short name such as
"Ships from: Illinois", **never your address**), the rate, the day it starts, where it comes from
(for example "IDOR Tax Rate Finder"), who confirmed it and when, and when it was last re-checked.

- **Only you** can confirm a rate, end it or re-check it. Administrators and staff can only read it
  (it appears on invoices). Visitors see nothing.
- A rate is **never deleted and never edited**: if the rate changes, you confirm a new one from its
  start day and the old one automatically ends the day before.
- Two rates for the same place can never overlap. Confirming the same rate twice records it once.
- Every change is also written to the audit log (the same one tasks use).
- Changes no existing table. Issued invoices keep their own copy of the rate they used.

On the dashboard (Tax Records, behind the `he_tax_rates` switch, PR "Tax rate screen"): a table of
your rates with **In force / Re-check due / Starts later / Ended**, a **"Re-checked today, still
correct"** button, and a short form to confirm a rate. After every January 1 and July 1, a rate shows
**Re-check due** and new invoices stay **TAX PENDING** until you re-check it.

## Order and dependencies

- Needs, in production: `auth.uid()`, `current_role()`, `is_active_staff()`, `is_owner_or_admin()`,
  the `tasks` and `audit_log` tables and the audit trigger on `tasks`. If one is missing, it stops
  and changes nothing.
- Depends on no other draft. Most useful just before the invoice item (item 1, draft 32).
- Safe to run twice.

## Local test (throwaway database, made-up data)

`docs/ops/sql/local-test/tax_rates_test.sh`: **47 of 47 passed** (Nov 23): install twice; only the
owner confirms (administrator, staff, visitor refused); who can read; refusals (rate above 25% or
negative, no start day, no source, a place that is too short or too long, a rate that starts before
the one in force, an overlapping insert, editing the rate or start day, deleting); a January change
ending the old rate on December 31; a second place; re-check (today's date in Central time, typed
dates ignored, staff refused, an ended rate refused); the audit log; rollback (stops while rates
exist, removes everything with written authorization, harmless twice, reinstall works).
Dashboard tests against the same database: `tests/specs/tax-rates-ext23.spec.js`.

## After running: check (read-only, paste into the SQL editor)

```sql
select to_regclass('public.tax_rates') is not null as table_present,
       (select count(*) from public.tax_rates) as rates,
       (select count(*) from pg_trigger where tgname = 'tax_rates_audit') as audit_trigger,
       has_table_privilege('anon', 'public.tax_rates', 'select') as visitors_can_read;
```
Expected: `true | 0 | 1 | false`. Anything else: stop and send me a screenshot.

## Undo

- No rate confirmed yet: run file 47. It removes everything 46 added. Harmless twice.
- Rates confirmed: file 47 stops and says how many. They are your record of what you confirmed;
  export them first, then (only if you decide they can go) run
  `set he.rollback_delete_tax_rates = 'yes, delete the tax rates';` and file 47 in the same session.

## Your decision

- [ ] Approve running draft 46 in production (best: after the tax answers are settled), or
- [ ] Not yet.
