# SQL for your review: invoice storage (draft 32) and read-only Query I

Status: CURRENT · 2026-11-16 · For: Stas · OWNER DECISION REQUIRED
Nothing on this page has been run in production. "Staging" here is a throwaway
copy of the database shape on the build machine, filled with made-up rows.

The exact SQL is in these files (also in the review package):

| File | What it is |
|---|---|
| `docs/ops/sql/drafts/32_DRAFT_invoices.sql` | invoice storage and numbering — a change, needs approval |
| `docs/ops/sql/drafts/33_DRAFT_rollback_invoices.sql` | its rollback |
| `docs/ops/sql/12_READONLY_I_report_day_cutoff.sql` | Query I — reads only |

---

## Part A — SQL draft 32: invoice storage

### What it changes

It **adds** two new, empty tables and four functions. It changes no existing
table, row, permission or screen, and nothing in the dashboard uses it until a
later, separate change connects it.

| Added | Purpose |
|---|---|
| table `invoices` | one row per draft or issued invoice: lines, amounts, who is billed, tax decision, number, dates |
| table `invoice_counters` | the last number used in each year |
| a guard on `invoices` | the only thing that hands out a number; keeps an issued invoice unchangeable |
| `issue_invoice(id, terms, credit_approved)` | issue one draft |
| `void_invoice(id, reason)` | void one issued invoice |
| a second guard | refuses to delete anything but a draft |

### Who can read, issue and void (verified on the staging copy)

| Who | Read | Prepare / edit / delete a draft | Issue | Void |
|---|---|---|---|---|
| Visitor (not signed in) | no | no | no | no |
| Deactivated account | no | no | no | no |
| Active staff | yes | yes | **no** | **no** |
| Administrator | yes | yes | yes | yes |
| Owner | yes | yes | yes | yes |

Staff are refused both ways: through the function, and by editing the row's
status directly.

### How an issued invoice is protected from edits

Once issued, the guard refuses any change to the number, the dates, the terms,
the lines, every amount, the tax rate and place, the exemption reason, who is
billed and where it ships. It cannot be deleted and cannot go back to a draft.
The only changes allowed are: void it (with a written reason of at least five
characters; the row and its number stay), or mark it partly paid / paid. A paid
invoice cannot be voided. All of that is checked for the owner too.

### How duplicate invoice numbers are prevented

| Situation | What happens | Check |
|---|---|---|
| A number is typed in by hand | Ignored. Only the guard assigns numbers. | "a typed number … is ignored" (3 checks) |
| The same request arrives twice (lost reply, retry, double click) | The second call returns the number the invoice already has, marked "already issued". The counter does not move. | "asking again is safe" (3 checks) |
| **The same draft requested 12 times at the same moment** | Exactly one request issues it; the other 11 are told it was already issued; one number is used. | new on Nov 16 (5 checks) |
| **Twenty different invoices issued at the same moment** | Twenty different, consecutive numbers, no gap and no repeat. The year's counter row is locked while a number is taken. | "two people issuing at the same moment" (4 checks) |
| An attempt fails or is undone part-way | Its number is handed back; no gap. | 1 check |
| An invoice is voided | Its number is never handed out again. | 2 checks |
| Two live invoices for one order | Refused. | 1 check |

Behind these: the number is assigned in the same transaction as the change to
"issued"; `invoice_number` is unique; `(year, sequence)` is unique.

### Tax (your decision of Nov 16)

A draft whose tax is pending stores **no** rate, tax or total — the database
refuses a 0 put there in place of unknown — and cannot be issued. A confirmed
rate must name the place it is for. A resale-exempt invoice carries tax 0 and
must record the verified document. The total must equal the parts.

### Staging test results

| Test | Result |
|---|---|
| `docs/ops/sql/local-test/invoices_test.sh` — install, permissions, tax rules, numbering, simultaneous requests, void, rollback | **87 passed, 0 failed** |
| `docs/ops/sql/local-test/invoice_store_adapter_test.js` — the dashboard's storage code against the same draft | **34 passed, 0 failed** |
| Install run twice | second run changes nothing |
| Rows in every other table before and after | identical |

### Rollback plan

Run `33_DRAFT_rollback_invoices.sql`. It removes the two tables and the
functions and touches nothing else. It **refuses to run** once any invoice has
been issued or voided, because those are business records (your Nov 14 decision
that numbers stay on the record); in that case export the rows first and decide
separately. With only drafts, it removes them and says how many. Running it
twice is harmless. Tested: refused with issued rows present; succeeds on a fresh
copy; install works again afterwards.

### Limits you should know

- It uses the two existing permission helpers (`is_owner_or_admin`,
  `is_active_staff`). The install stops, changing nothing, if they are missing.
- No audit trigger is attached to the new tables: the name of production's
  audit trigger function is not in this repository.
- Payments are not stored yet; the status values exist so that can follow.
- An owner or administrator could edit `invoice_counters` directly. That is the
  same trust they already have over invoices; staff cannot touch it.

**Status: pending your approval. Not to be run in production until you say so.**

---

## Part B — read-only Query I

| | |
|---|---|
| **Question it answers** | Does the nightly report end its day at midnight Central time (your Nov 14 decision), or at midnight UTC? The nightly job's code is not in this repository, so the data is the only way to tell. |
| **Database it targets** | The Health Endeavors production Supabase project, run by you in the SQL editor — **only after you approve**. So far it has run only on the staging copy. |
| **What it reads** | Two tables: `daily_reports` (the date and the order count) and `orders` (the time each order was placed, and whether it was deleted). Last 45 days. |
| **What it returns** | Six columns: `item`, `reported`, `central_day`, `utc_day`, `verdict`, `action`. One row per saved report, plus a first row `I00` with the conclusion. |
| **What it never returns** | No customer name, e-mail, address, order contents or amounts. Only counts of orders per day. |
| **What it changes** | Nothing. It is one SELECT. |

How to read the result: for each day it counts that day's orders twice — by the
Central calendar day and by the UTC calendar day — and says which count the
saved report agrees with. Most days the two counts are equal ("SAME EITHER
WAY"), which is normal; only a day with an evening order can tell them apart.

| `I00` verdict | Meaning | What to do |
|---|---|---|
| PASS | the report already follows the Central day | nothing |
| ACTION | it follows the UTC day | show me the result; the nightly job needs a change |
| UNCLEAR | some days each way | show me the result |
| NOT ENOUGH DATA | no day in the window can tell them apart | run it again later |
| NO DATA | no saved reports in the last 45 days | run it again after the nightly report has run |

### Verified in staging with read-only access

`docs/ops/sql/local-test/report_day_cutoff_test.sh` — **24 passed, 0 failed**.

| Checked | Result |
|---|---|
| Runs inside a read-only transaction | yes, no error |
| Runs through an account that may only read those two tables | yes; same answer, row for row, as the database owner gets |
| That account cannot add, change or delete anything, or read any other table | refused each time ("permission denied") |
| Every order and saved report before and after | identical (fingerprint compared) |
| The query text | one statement; no word that could change data |
| Made-up nightly job counting by the Central day | PASS |
| Made-up job counting by the UTC day | ACTION |
| One day each way | UNCLEAR |
| Reports agreeing with neither count | NOT ENOUGH DATA |
| A midday-only day | SAME EITHER WAY |
| A deleted order | not counted |
| A report older than 45 days | left out |
| Output | six columns; no customer name anywhere |

The staging rows were made up, so these results say the query is correct and
harmless. They say nothing yet about production — that is what running it there
would tell us.

**Status: waiting for your approval before it is run in production.** When you
approve: Supabase → SQL Editor → New query → paste the file → Run → export the
result as CSV and send it to me. It contains counts only.
