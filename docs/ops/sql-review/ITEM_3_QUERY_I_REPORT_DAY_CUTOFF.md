# Review item 3 of 4 — read-only Query I: which day cutoff does the nightly report use?

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · 2026-11-16
It changes nothing, but it reads production data, so it waits for your approval too.

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) | Last changed in |
|---|---|---|---|
| `docs/ops/sql/12_READONLY_I_report_day_cutoff.sql` | 66 | `510aac569f16c15a` | `fcef560` |

One SELECT statement. The full text is in the review package (`5-sql/item-3/`).

## Target environment

The Health Endeavors **production** Supabase project, in Supabase → SQL Editor, by
you. So far run only on throwaway copies with made-up data.

## Purpose — the question it answers

You decided on Nov 14 that the reporting day ends at midnight **Central** time.
The nightly job that fills `daily_reports` is not in this repository, so the code
cannot say which cutoff it uses. The data can: for each saved report in the last
45 days the query counts that day's orders twice (by the Central day and by the
UTC day) and says which count the report agrees with.

## What it reads and returns

- **Reads:** `daily_reports` (date, order count) and `orders` (time placed, whether
  deleted). Last 45 days.
- **Returns six columns:**

| Column | Meaning |
|---|---|
| `item` | `I-<date>` for each saved report; `I00` is the conclusion |
| `reported` | orders on the saved report |
| `central_day` | orders that day by the Central calendar day (on `I00`: days that agree with Central) |
| `utc_day` | the same by the UTC calendar day (on `I00`: days that agree with UTC) |
| `verdict` | SAME EITHER WAY · MATCHES CENTRAL · MATCHES UTC · MATCHES NEITHER (per day); PASS · ACTION · UNCLEAR · NOT ENOUGH DATA · NO DATA (`I00`) |
| `action` | what to do, in plain words |

- **Never returns:** names, e-mails, addresses, order contents or amounts. Counts only.

## How it was confirmed read-only

| Check (`local-test/report_day_cutoff_test.sh`, 24 of 24) | Result |
|---|---|
| Runs inside a `read only` transaction | no error |
| Runs as a login that may only **read** `orders` and `daily_reports` | same answer, row for row |
| That login tries to add, change or delete an order, or read another table | refused every time ("permission denied") |
| Fingerprint of every order and saved report, before and after | identical |
| The query text | one statement; no word that could change data |
| Output | six columns; no customer name |

## Sample summary (made-up data, run read-only on 2026-11-16)

Fourteen made-up days, 3–5 orders a day, with an evening order every third day
(evening orders are what tell the two cutoffs apart). A made-up nightly job counts
by the Central day. Output, as run through the read-only login:

```
     item     | reported | central_day | utc_day |     verdict     |                                             action                                              
--------------+----------+-------------+---------+-----------------+-------------------------------------------------------------------------------------------------
 I-2026-11-02 |        3 |           3 |       3 | SAME EITHER WAY | Cannot tell the cutoffs apart on this day (normal).
 I-2026-11-03 |        4 |           4 |       4 | SAME EITHER WAY | Cannot tell the cutoffs apart on this day (normal).
 I-2026-11-04 |        4 |           4 |       3 | MATCHES CENTRAL | The saved report agrees with the Central-time day.
 I-2026-11-05 |        4 |           4 |       5 | MATCHES CENTRAL | The saved report agrees with the Central-time day.
 I-2026-11-06 |        3 |           3 |       3 | SAME EITHER WAY | Cannot tell the cutoffs apart on this day (normal).
 I-2026-11-07 |        5 |           5 |       4 | MATCHES CENTRAL | The saved report agrees with the Central-time day.
 I-2026-11-08 |        3 |           3 |       4 | MATCHES CENTRAL | The saved report agrees with the Central-time day.
 I-2026-11-09 |        4 |           4 |       4 | SAME EITHER WAY | Cannot tell the cutoffs apart on this day (normal).
 I-2026-11-10 |        4 |           4 |       3 | MATCHES CENTRAL | The saved report agrees with the Central-time day.
 I-2026-11-11 |        4 |           4 |       5 | MATCHES CENTRAL | The saved report agrees with the Central-time day.
 I-2026-11-12 |        3 |           3 |       3 | SAME EITHER WAY | Cannot tell the cutoffs apart on this day (normal).
 I-2026-11-13 |        5 |           5 |       4 | MATCHES CENTRAL | The saved report agrees with the Central-time day.
 I-2026-11-14 |        3 |           3 |       4 | MATCHES CENTRAL | The saved report agrees with the Central-time day.
 I-2026-11-15 |        4 |           4 |       4 | SAME EITHER WAY | Cannot tell the cutoffs apart on this day (normal).
 I00          |          |           8 |       0 | PASS            | The nightly report already follows the Central-time day on 8 telling day(s). Nothing to change.
(15 rows)
```

How to read it: an order placed at 7:30 pm Central is already the next day in
UTC, so it changes the UTC count of two days (its own and the next). That makes
8 of the 14 days able to tell the cutoffs apart, and on every one of them the
saved report agrees with the Central count, so `I00` says **PASS**. On the other
6 days the two counts are equal ("SAME EITHER WAY"): that is normal.

## What happens with each result in production

| `I00` | Meaning | Next step |
|---|---|---|
| PASS | the report already follows the Central day | nothing |
| ACTION | it follows the UTC day | send me the result; the nightly job needs a change (separate approval) |
| UNCLEAR | some days each way | send me the result |
| NOT ENOUGH DATA | no telling day in 45 days | run again later |
| NO DATA | no saved reports | run again after the nightly report has run |

## How to run it (after your approval)

Supabase → SQL Editor → New query → paste the file → Run → Export CSV → send me
the file. It contains counts only.

## Your decision

- [ ] Approve running Query I in production, or
- [ ] Not yet.
