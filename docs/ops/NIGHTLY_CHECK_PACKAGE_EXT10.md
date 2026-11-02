# Nightly integrity check on Home: scheduling package (EXT10, U43)

**Status:** CURRENT (2026-10-11). Dashboard card IMPLEMENTED IN BRANCH, TESTED LOCALLY (16 page tests). SQL drafts 25 + 26 (EXT9) and **29 + 30 (EXT10)** TESTED LOCALLY, **NOT INSTALLED**. Nothing is scheduled or switched on. Thresholds are **PROPOSED** defaults; the owner decides them (X8-D4).

Plain English: every night the database can run the 15 data checks of Query F by itself and keep the answer. The Home page then shows, at a glance, whether last night's check passed, found something to look at, found data that cannot be right, failed to run, or is out of date. Until the owner installs it and turns on its Home switch, the card says "Not set up yet" and never pretends things are fine.

## 1. What the card shows

| State | When | Colour + word (never colour alone) |
|---|---|---|
| NOT VERIFIED | switch missing/off; switch on but tables missing; installed but never ran; signed-in person is not owner/admin | grey, "NOT VERIFIED" |
| PASS | last success within 26 h and every check found 0 | grey, "PASS" |
| WARN | a "stuck work" or "probable duplicate" check found something | amber, "WARN" |
| FAIL | a "points at the wrong thing" or "impossible value" check found something, **or** the last attempt failed (its error text is shown; results are from the last run that worked) | red, "FAIL" |
| STALE | last success older than 26 h (even if it found nothing) | amber, "STALE" |
| UNKNOWN | switch or results could not be read | amber, "UNKNOWN" |

Freshness line: last success (date, time, "x hours ago"), last attempt (worked / FAILED / still running), and the staleness threshold. Drill-down: each of the 15 checks with PASS/WARN/FAIL, the count, up to 300 characters of examples (record numbers, shown as text), and an **Open** button to the page where it can be fixed. Opens automatically when something was found.

## 2. Scheduling package (for the owner's decision; nothing is activated)

| Item | Proposal | Why |
|---|---|---|
| Frequency | once a night | the checks look for slow problems (stuck, duplicates), not live ones |
| Time | 06:17 UTC (≈ 1:17 am Central) (`'17 6 * * *'`, drafts/25) | quiet hour; off the :00 minute most jobs use |
| Expected runtime | **0.3 s at 50,000 orders / 100,000 lines / 25,000 tasks / 25,000 expenses** (local, `integrity_perf_test.sh`); today's real data is far smaller | measured, not guessed |
| Timeout | 60 s (`set statement_timeout` in the cron command, see §4) | 200× the measured time; a hung run is recorded as failed |
| Alert threshold | any FAIL check → red on Home; any WARN → amber | proposed; owner may want some checks (e.g. F05 late POs) as info only |
| Staleness | 26 h (one missed night plus slack) | proposed |
| Who sees it | owner and administrators only (read rule in drafts/29); staff see "owner and administrators only" | results name record numbers |
| Failure behaviour | a failed run is logged with its error, its half results are undone, Home shows FAIL with the error and the last good results | tested (`integrity_home_test.sh`: division by zero planted) |
| Retention | 90 nights of runs and results, then removed by the job itself | small table (≈ 15 rows a night) |
| Alerts outside the dashboard (e-mail, SMS) | **none** | sending messages is not approved; Home only |
| How to disable | (1) turn off "Nightly integrity check on Home" (instant, Feature Switches); (2) stop the schedule: `select cron.unschedule('integrity_check_nightly');`; (3) remove: drafts/30, then drafts/26 | in order of how much is undone |

## 3. Install order (owner, after approval)

1. drafts/25 (view + results table + function + schedule if pg_cron exists).
2. drafts/29 (run log, read rule for owner/admin, Home switch OFF). It stops, changing nothing, if 25 is missing.
3. Run once by hand to have a first result: `select public.run_integrity_check();` (SQL editor, as the database owner).
4. Read-only check: `PRODUCTION_READONLY_VERIFICATION_EXT10.md` V-F2.
5. Turn on "Nightly integrity check on Home" on Feature Switches. The page refuses if the tables cannot be read.

Rollback: switch off → drafts/30 → drafts/26 (30 refuses while the switch is on; 30 must run before 26).

## 4. Suggested timeout wording for the schedule (owner's choice)

drafts/25 schedules `select public.run_integrity_check()`. To add the 60-second limit, the cron command can be `set statement_timeout = '60s'; select public.run_integrity_check();` (one-line change to drafts/25 before installing, or `cron.alter_job` afterwards). Left as a decision because it changes a production job definition.

## 5. Evidence

| Check | Result |
|---|---|
| `integrity_home_test.sh` (drafts/29 + 30 on PostgreSQL 16) | 25/25 |
| `integrity_perf_test.sh` (50k orders) | 10/10, 337 ms |
| `integrity_schedule_test.sh` (drafts/25 + 26, EXT9) | 12/12 (unchanged) |
| `tests/specs/nightly-check-ext10.spec.js` | 16/16 (states, freshness, drill-down, escaping, staff, 90-night bound, switch refusal) |
| Static SQL rules | the only policies any draft creates are these two read rules (allow-listed exactly) |
