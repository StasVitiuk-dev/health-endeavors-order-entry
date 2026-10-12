# Production read-only checks: everything in one place (EXT10)

**Status:** CURRENT (2026-10-11, extension 10). Supersedes `PRODUCTION_READONLY_VERIFICATION_EXT9.md` as the entry point (that file stays as history; its V1–V10 are unchanged and repeated here with two additions). Every check below **only reads**: none changes data, settings, policies, functions, schedules or backups. Claude never runs them; Stas runs them in Supabase (SQL Editor) or looks at a page, and sends back a CSV or a screenshot.

**How to run any query file (same every time):** Supabase → your project → **SQL Editor** → **New query** → paste the WHOLE file from GitHub (open the file → **Raw** → select all → copy) → **Run** → **Export → Download CSV** → send the CSV. If it stops with an error, send a screenshot of the error; nothing was changed.

**How to know it is read-only:** each file is a single `select` (or `with … select`). `tests/specs/sql-readonly.spec.js` proves on every change that the file holds no write, schema or permission command. **Fingerprint:** the first 16 characters of the file's SHA-256 are listed so the file pasted is exactly the reviewed one (on a Mac: `shasum -a 256 <file>`; optional).

**Never send:** passwords, keys, tokens, log text from the backups repository, customer names or e-mails. The checks are written so their output holds none of these.

| # | Check | Why | Exact query / action (fingerprint) | Expected output | Send back | Unblocks |
|---|---|---|---|---|---|---|
| **V1** | **Backups (2 minutes)** | Nothing in production should change while backup health is unknown | §1 below (look only) | newest nightly backup and restore test green, within 2 / 35 days | one line: "nightly green/red + date; restore test green/red + date; minutes OK/out" | every production change |
| **V2** | **Query C**: agents, switches, schedules, other stock writers, triggers, audit coverage | R1–R5 must know whether anything else writes stock; true agent states | `docs/ops/sql/02_READONLY_C_agents.sql` (`5322509e64950bce`, 255 lines) | 11 sections, one row per item; no function code, e-mails or tokens | CSV | R1–R5 install (D-ops-6), agent rows #1–#8 |
| **V3** | **Agent states** (inside V2: sections 1, 2, 5) | Agent #1 may still be paused since Sept 24 | in V2 | one row per agent with on/off; pg_cron jobs for #4/#5/#6 | (in V2) | `AGENT_CURRENT_STATE_EXT9.md` "UNVERIFIED" rows |
| **V4** | **Query D**: elevated (definer) functions | a function with owner rights anyone can call bypasses the dashboard's rules | `03_READONLY_D_definer_function_identity_check.sql` (`ce9965d5a5ad531a`, 72 lines) | one row per elevated function: who may call it, whether it checks the caller | CSV | permission fixes; 34 "UNKNOWN until Query D" write paths |
| **V5** | **Query G**: permissions inventory | tasks updatable by anyone signed in, anon rights, duplicate read policies, tables without RLS | `06_READONLY_G_permissions_inventory.sql` (`3138f769c4c80670`, 81 lines) | G01–G07 PASS / WARN / FAIL / INFO; goal no FAIL | CSV | permission fix drafts (`PERMISSION_RLS_MAP_EXT9.md` §4) |
| **V6** | **Query E**: stock vs history, deliveries vs stock and expense | a "before" picture of any mismatch | `04_READONLY_E_stock_reconciliation.sql` (`bc04bb9b37c64b9e`, 103 lines) | every count 0 | CSV | drafts/23 precheck; R1–R5 confidence |
| **V7** | **Query F**: daily integrity (stuck work, duplicates, wrong references, impossible values) | same, for workflows; also the first manual run before the nightly version | `05_READONLY_F_daily_integrity_check.sql` (`0cd8671658cf66b4`, 92 lines) | 15 rows F01–F15; goal all 0 | CSV | drafts/23 precheck; X8-D4 thresholds |
| **V8** | **Function fingerprint** (only after an R1–R5 install) | proves the installed functions are exactly the reviewed ones | fingerprint query in `R1-R5-INSTALL-RUNBOOK.md` | `f6d9c2c8be690710eeb721041f6779d9` (EXT17 version; was `3df2bf7a…` before the INT-4 fix) | screenshot | turning on any stock switch |
| **V9** | **Stock switches** (only after drafts/21) | all five must start OFF | `select flag_key, enabled from public.feature_flags where flag_key like 'stock_fn_%' order by flag_key;` | 5 rows, all `false` | screenshot | first stock switch on |
| **V10** | **GitHub access** (X6-17) | the session can still bypass review | GitHub → repository → Settings → Collaborators and teams (look only) | `stasvitiuk-reos`: Write; Claude connected as that account | screenshot | merge confidence |
| **V11** (NEW) | **Request-key columns and switch** (only after drafts/19 + 27) | the `request_keys` switch must find the columns, and start OFF | `select count(*) filter (where column_name = 'client_request_id') as tables_with_key from information_schema.columns where table_schema = 'public';` then `select flag_key, enabled from public.feature_flags where flag_key = 'request_keys';` | first: the number of tables drafts/19 reported (up to 22); second: 1 row, `false` | screenshot | turning on `request_keys` |
| **V12** (NEW) | **Nightly check installed and readable** (only after drafts/25 + 29) | Home must have a first result before its switch is turned on | `select started_at, status, checks, error from public.integrity_check_runs order by started_at desc limit 3;` and `select flag_key, enabled from public.feature_flags where flag_key = 'integrity_results_home';` and, if pg_cron exists, `select jobname, schedule, active from cron.job where jobname = 'integrity_check_nightly';` | at least one row `ok`, 15 checks; switch `false`; job active | screenshot | turning on "Nightly integrity check on Home" |
| **V13** (NEW, EXT10b) | **Drift check: does production match what was reviewed?** | catches a wrong function version, anon access, or a switch ON without its dependency | `docs/ops/sql/07_READONLY_H_drift_check.sql` (11 rows) | every row PASS or NOT INSTALLED (normal before that step); any FAIL = stop | CSV | every switch-on step; after every production step |

**Reading a CSV without Claude:** `node tests/tools/interpret-query-results.js H downloaded.csv --run-date 2026-10-15` (also D, E, F, G) prints PASS / WARN / FAIL / UNKNOWN per row and overall, refuses a file that is not that query's output, and warns if the file contains an e-mail address (then do not store it; send only the summary). Query C is an inventory and is read as it is.

**Every result is recorded with:** the query letter and the first 16 characters of its fingerprint (table above), the date it was run, and the overall verdict (`evidence/README.md`).

## 1. The 2-minute backup check (V1)

The private backups repository is **off-limits to Claude**. Only Stas looks.

1. GitHub → the **private backups repository** → **Actions** tab.
2. Newest **nightly backup** run: date, green ✓ or red ✗.
3. Newest **monthly restore test** run: date and colour.
4. GitHub → Settings → Billing → Actions minutes: minutes left this month?
5. Do **not** click "Re-run", open logs, download anything or change settings.

| What you see | Status | What happens next |
|---|---|---|
| Nightly green ≤ 2 days old; restore test green ≤ 35 days old; minutes left | **VERIFIED HEALTHY** | production changes may be scheduled |
| Green but older than 2 days (nightly) or 35 days (restore test) | **STALE** | no production change; find why the schedule stopped (often: minutes ran out) |
| Red ✗ on the newest run | **FAILED** | no production change; tell the session "nightly red, date" |
| Could not find or open it | **UNKNOWN** | no production change |
| Not looked yet | **NOT CHECKED** (today's state) | — |

**Evidence expiry:** a VERIFIED HEALTHY answer is valid for **7 days** for planning and must be re-checked on the day of any production step (P2 onward). Home keeps showing "Backups: not verified here" because the dashboard cannot read the private repository; that line never turns green on its own (D5 / U16 would change that, owner decision).

## 2. What each answer unblocks (result intake)

When a CSV or screenshot comes back, the next session files it under `docs/ops/evidence/` **without customer data** (counts and record numbers only), records the date in `CURRENT_PLATFORM_STATE_EXT10.md` §3, and marks the matching row in `OWNER_UNBLOCK_CENTER_EXT10.md`. A result older than 30 days is **STALE** for planning (backups: 7 days) and must be re-run before the production step it unblocks.

| Unknown today | Answered by |
|---|---|
| anything other than the dashboard writing stock | V2 §6, §8 |
| Agent #1 on/off; #2/#3/#7/#8 really disabled | V2 §1–2, §5 (+ the owner's own look at the private repo's Actions page) |
| server rules for 34 write paths | V4 + V5 |
| `feature_flags` real columns (X3-17) | V2 §10 |
| backup health | V1 |
| existing stock / workflow mismatches | V6, V7 |
| which functions anon can call | V4, V5 (G06) |
