# Production read-only checks: everything in one place (EXT9)

**Status:** CURRENT (2026-10-10, extension 9). Every check below **only reads**. None changes data, settings, policies, functions, schedules or backups. Claude never runs them: Stas runs them in the Supabase dashboard (SQL Editor) or looks at a page, and sends back the CSV or a screenshot. Superseded as the entry point: the scattered run guides (`QUERY_C_OWNER_RUN_GUIDE.md`, `QUERY_E_OWNER_RUN_GUIDE.md`) stay valid as detail.

**How to run any query file (same every time):** Supabase → your project → **SQL Editor** → **New query** → paste the WHOLE file from GitHub (open the file → **Raw** → select all → copy) → **Run** → **Export → Download CSV** → send the CSV. If it stops with an error, send a screenshot of the error; nothing was changed.

**How to know it is read-only:** each file is one `select` (or `with … select`) statement. The automatic test `tests/specs/sql-readonly.spec.js` proves on every change that the file contains no write, schema or permission command outside quoted text.

| # | Check | Why | Exact query / action | Expected output | Send back | Unblocks |
|---|---|---|---|---|---|---|
| **V1** | **Backups (2 minutes)** | Nothing in production should change while backup health is unknown | See §1 below (look only) | Newest nightly backup and restore test: green, within 2 days | One line: "nightly green/red + date; restore test green/red + date; minutes OK/out" | Every production change |
| **V2** | **Query C**: agents, switches, schedules, other stock writers, triggers, value rules, audit coverage | R1–R5 must know whether anything else writes stock; the true agent states | `docs/ops/sql/02_READONLY_C_agents.sql` (255 lines, SHA-256 starts `5322509e64950bce`) | 11 sections (0 counts … 10 audit coverage), one row per item; no function code, e-mails or tokens are printed | CSV | R1–R5 install plan (D-ops-6), agent matrix rows 1–8, X3-17 |
| **V3** | **Agent states** (part of V2, sections 1, 2, 5) | Agent #1 may still be paused since Sept 24 | in V2 | Section 2: one row per agent with on/off; section 5: pg_cron jobs for #4/#5/#6 active | (in V2's CSV) | `AGENT_CURRENT_STATE_EXT9.md` "UNVERIFIED" rows |
| **V4** | **Query D**: elevated functions | A function running with owner rights that anyone can call would bypass the dashboard's rules | `docs/ops/sql/03_READONLY_D_definer_function_identity_check.sql` (72 lines, SHA-256 `ce9965d5a5ad531a…`) | One row per elevated function: who may call it, whether it checks the caller | CSV | SE-02 permission fixes; the 34 "UNKNOWN until Query D" rules in the write-path inventory |
| **V5** | **Query G**: permissions inventory (NEW EXT9) | The three recorded concerns: tasks updatable by anyone signed in, anon rights, duplicate read policies; plus tables without RLS | `docs/ops/sql/06_READONLY_G_permissions_inventory.sql` (81 lines, SHA-256 `3138f769c4c80670…`) | Rows G01–G07 with PASS / WARN / FAIL / INFO; goal: no FAIL | CSV | Permission fix drafts (`PERMISSION_RLS_MAP_EXT9.md` §4) |
| **V6** | **Query E**: stock vs history, deliveries vs stock and expense | Shows any existing mismatch before R1–R5 (a "before" picture) | `docs/ops/sql/04_READONLY_E_stock_reconciliation.sql` | Every count 0 (non-zero = something to look at) | CSV | Draft 23 (constraints) precheck; R1–R5 confidence |
| **V7** | **Query F**: daily integrity (stuck work, duplicates, wrong references, impossible values) | Same, for workflows | `docs/ops/sql/05_READONLY_F_daily_integrity_check.sql` | 15 rows F01–F15; goal: all 0 | CSV | Draft 23 precheck; scheduling decision X8-D4 |
| **V8** | **Function fingerprint** (only after an R1–R5 install) | Proves the installed functions are exactly the reviewed ones | The fingerprint query in `R1-R5-INSTALL-RUNBOOK.md` (step "Fingerprint check") | `3df2bf7a07b451f12f9359ceca1c85df` | Screenshot | Turning on any stock switch |
| **V9** | **Stock switches** (only after drafts/21) | All five must start OFF | `select flag_key, enabled from public.feature_flags where flag_key like 'stock_fn_%' order by flag_key;` | 5 rows, all `false` | Screenshot | First switch on |
| **V10** | **GitHub access** (X6-17) | The session can still bypass review | GitHub → repository → Settings → Collaborators and teams (look only) | `stasvitiuk-reos`: Write; Claude connected as that account | Screenshot | Merge confidence |

## 1. The 2-minute backup check (V1)

The private backups repository is **off-limits to Claude**. Only Stas looks.

1. Open GitHub → the **private backups repository** → **Actions** tab.
2. Find the newest **nightly backup** run. Note the date and whether it is green ✓ or red ✗.
3. Find the newest **monthly restore test** run. Note the date and colour.
4. GitHub → Settings → Billing → Actions minutes: are minutes left this month?
5. Do **not** click "Re-run", do not open logs, do not download anything, do not change settings.

| What you see | Status | What happens next |
|---|---|---|
| Nightly green, ≤ 2 days old; restore test green, ≤ 35 days old; minutes left | **VERIFIED HEALTHY** | Production changes may be scheduled |
| Green but older than 2 days (nightly) or 35 days (restore test) | **STALE** | No production change; check why the schedule stopped (often: minutes ran out) |
| Red ✗ on the newest run | **FAILED** | No production change; tell the session "nightly red, date" |
| You could not find or open it | **UNKNOWN** | No production change |
| Not looked yet | **NOT CHECKED** (today's state) | — |

Send back only: *"nightly: green/red, date; restore test: green/red, date; minutes: OK/out"*. Never paste log text, file names or contents. **UNKNOWN and NOT CHECKED are never shown as green** on the dashboard (Home shows "Backups: not verified here").

## 2. What is still uncertain in production (until these come back)

| Unknown | Answered by |
|---|---|
| Whether anything other than the dashboard writes stock | V2 §6, §8 |
| Agent #1 on/off; #2/#3/#7/#8 workflows really disabled | V2 §1–2, §5 (and the owner's own look at the private repo's Actions page for #2/#3/#7/#8) |
| Server rules for 34 write paths (tables outside the Query A export) | V4 + V5 |
| feature_flags real columns (X3-17) | V2 §10 |
| Backup health | V1 |
| Existing stock / workflow mismatches | V6, V7 |
| Which functions anon can call | V4, V5 (G06) |
