# Review item 22 — the nightly "everything adds up" check

Status: OWNER DECISION REQUIRED · production run PENDING your separate approval · written 2026-11-27
(night). Nothing here has been run in production. I never run it myself: you run it, after approving it.
Part of the two-week launch plan (`docs/ops/LAUNCH_PLAN_2_WEEKS.md`, step 7 of the database list).

## What it does, in plain words

Three small steps, so that a number that cannot be right is noticed the next morning without anyone
remembering to look:

1. **Draft 23, four rules:** the database itself refuses a value that cannot be right, whoever writes
   it: recalled stock below zero, a batch with more left than was received, a delivery line with more
   received than ordered, a negative refund.
2. **Draft 25, the nightly check:** every night (about 12:17 AM Central in winter, 1:17 AM in summer)
   the database runs the 15 checks of Query F (stock buckets, orders, returns, approvals and more) and
   keeps each night's answer. It only reads business tables and writes only its own results.
3. **Draft 29, on Home:** you and administrators can see the last night's answer on Home, with "last
   tried" and "last worked" shown separately. Switch `integrity_results_home`, **off** until you turn it on.

## Before you decide

- **When to warn (decision X8-D4).** Proposed: Home warns if the check has not worked for one night,
  with some slack for a late run. Say "yes" or name another rule.
- Draft 23 stops, changing nothing, if any record already breaks a rule; it says how many. Then we look
  at those records together first (Query E or F lists them).
- Draft 25 adds a **scheduled job** in your database (pg_cron). If pg_cron is not installed there,
  it says so and schedules nothing; the rest still installs.

## The order (one evening, about 20 minutes, then one day's wait)

| Step | What | Needs first |
|---|---|---|
| 1 | Draft 23 (the four rules) | nothing |
| 2 | Draft 25 (the nightly check and its job) | nothing |
| 3 | Draft 29 (the results on Home, switch off) | draft 25 |
| 4 | The next day: the check below shows a first night `ok` → Feature Flags → turn on **Nightly integrity check on Home** | a first run |

## The exact SQL

| File | Lines | Fingerprint (SHA-256, first 16) |
|---|---|---|
| `docs/ops/sql/drafts/23_DRAFT_integrity_constraints.sql` (four rules) | 60 | `5a2d462e3ede105c` |
| `docs/ops/sql/drafts/24_DRAFT_rollback_integrity_constraints.sql` (undo of 23) | 27 | `125480e13244bfe1` |
| `docs/ops/sql/drafts/25_DRAFT_integrity_check_schedule.sql` (the nightly check) | 141 | `f0aeec10b5d50d6a` |
| `docs/ops/sql/drafts/26_DRAFT_rollback_integrity_check_schedule.sql` (undo of 25) | 30 | `4a8aea8a45feb6c6` |
| `docs/ops/sql/drafts/29_DRAFT_integrity_results_on_home.sql` (results on Home) | 101 | `7afb423336e8a20b` |
| `docs/ops/sql/drafts/30_DRAFT_rollback_integrity_results_on_home.sql` (undo of 29) | 53 | `1e7d050135b01953` |

Every function here runs with the caller's own rights (security invoker). The results are readable only
by you and administrators (`is_owner_or_admin()`, which your database has); nobody can write them except
the job. **Nov 27:** all three install cleanly on a copy shaped like your real database as tonight's
looks showed it (`docs/ops/sql/local-test/production_shape_install_test.sh`, 33 of 33).

## After running: check (read-only)

The day after (at least one row `ok` with 15 checks; the switch `false`; the job active):

```sql
select started_at, status, checks, error from public.integrity_check_runs order by started_at desc limit 3;
select flag_key, enabled from public.feature_flags where flag_key = 'integrity_results_home';
select jobname, schedule, active from cron.job where jobname = 'integrity_check_nightly';
```
The third line only if draft 25 said the job was scheduled (it errors when pg_cron is not installed).

## Undo

- Home card: turn the switch off (instant).
- Then file 30, then 26 (removes the job and the results), then 24 (removes the four rules). No business
  record is changed by any of them.

## Not on this page

Report totals (draft 13) wait on your refund decision (N4); the permission fixes wait on Query G.
